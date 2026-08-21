import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { query, transaction } from '../common/db';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../system/audit.service';

type User = { id: string; platformRole: string; emailVerifiedAt: string | null };

type MembershipRow = Record<string, unknown> & {
  status: string;
  membership_role?: string;
  membership_roles?: string;
};

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: User) {
    const result = await query<Record<string, unknown>>(
      `SELECT c.id, c.name, c.slug, c.description, c.visibility, c.status,
              COALESCE(m.status, 'none') AS membership_status,
              COALESCE((SELECT string_agg(mr.role_code, ',' ORDER BY mr.role_code)
                        FROM community.membership_roles mr
                        WHERE mr.membership_id = m.id), 'member') AS membership_roles
       FROM community.communities c
       LEFT JOIN community.memberships m ON m.community_id = c.id AND m.user_id = $1
       WHERE c.status = 'active'
       ORDER BY c.created_at ASC`,
      [user.id],
    );
    return result.rows;
  }

  async get(user: User, communityId: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT c.id, c.name, c.slug, c.description, c.visibility, c.status,
              COALESCE(m.status, 'none') AS membership_status,
              COALESCE((SELECT string_agg(mr.role_code, ',' ORDER BY mr.role_code)
                        FROM community.membership_roles mr
                        WHERE mr.membership_id = m.id), 'member') AS membership_roles
       FROM community.communities c
       LEFT JOIN community.memberships m ON m.community_id = c.id AND m.user_id = $2
       WHERE c.id = $1 AND c.status = 'active'`,
      [communityId, user.id],
    );
    const community = result.rows[0];
    if (!community) throw new NotFoundException('Community not found');
    if (community.visibility === 'closed' && community.membership_status !== 'active' && user.platformRole !== 'platform_admin') {
      return {
        id: community.id,
        name: community.name,
        slug: community.slug,
        description: community.description,
        visibility: community.visibility,
        membershipStatus: community.membership_status,
      };
    }
    return community;
  }

  async join(user: User, communityId: string) {
    const community = await this.findJoinableCommunity(communityId);
    const status = membershipStatus(community.visibility, user.platformRole);
    const result = await transaction((client) => this.persistMembership(client, communityId, user.id, status));
    await this.auditService.record(user.id, auditMembershipAction(status), 'community', communityId);
    return result;
  }

  private async findJoinableCommunity(communityId: string) {
    const result = await query<{ visibility: string; status: string }>(
      'SELECT visibility, status FROM community.communities WHERE id = $1',
      [communityId],
    );
    const community = result.rows[0];
    if (!community || community.status !== 'active') throw new NotFoundException('Community not found');
    return community;
  }

  private async persistMembership(client: PoolClient, communityId: string, userId: string, status: 'active' | 'pending') {
    const membership = await client.query<Record<string, unknown>>(
      `INSERT INTO community.memberships (community_id, user_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (community_id, user_id)
       DO UPDATE SET status = CASE
         WHEN community.memberships.status IN ('removed', 'rejected') THEN EXCLUDED.status
         ELSE community.memberships.status
       END, updated_at = now()
       RETURNING *`,
      [communityId, userId, status],
    );
    const membershipId = membership.rows[0].id as string;
    return status === 'active'
      ? this.activateMembership(client, membership.rows[0], membershipId)
      : this.queueMembershipRequest(client, communityId, userId, membership.rows[0]);
  }

  private async activateMembership(client: PoolClient, membership: Record<string, unknown>, membershipId: string) {
    await client.query(
      `INSERT INTO community.membership_roles (membership_id, role_code)
       VALUES ($1, 'member') ON CONFLICT DO NOTHING`,
      [membershipId],
    );
    return membership;
  }

  private async queueMembershipRequest(client: PoolClient, communityId: string, userId: string, membership: Record<string, unknown>) {
    await client.query(
      `INSERT INTO community.membership_requests (community_id, user_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (community_id, user_id) WHERE status = 'pending'
       DO UPDATE SET updated_at = now()
       RETURNING id`,
      [communityId, userId],
    );
    return membership;
  }

  async membership(user: User, communityId: string): Promise<MembershipRow> {
    const result = await query<MembershipRow>(
      `SELECT m.*,
              COALESCE((SELECT string_agg(mr.role_code, ',' ORDER BY mr.role_code)
                        FROM community.membership_roles mr
                        WHERE mr.membership_id = m.id), 'member') AS membership_roles
       FROM community.memberships m
       WHERE m.community_id = $1 AND m.user_id = $2`,
      [communityId, user.id],
    );
    return result.rows[0] ?? { status: 'none', membership_roles: 'member' };
  }

  async groups(user: User, communityId: string) {
    await this.requireActiveMember(user, communityId);
    const result = await query<Record<string, unknown>>(
      `SELECT g.*, EXISTS (
         SELECT 1 FROM community.group_memberships gm
         WHERE gm.group_id = g.id AND gm.user_id = $2 AND gm.status = 'active'
       ) AS directly_joined
       FROM community.groups g
       WHERE g.community_id = $1 AND g.status = 'active'
       ORDER BY g.created_at ASC`,
      [communityId, user.id],
    );
    return result.rows;
  }

  async createCommunity(actor: User, input: { name: string; slug: string; description: string; visibility: 'public' | 'closed' }) {
    this.requirePlatformAdmin(actor);
    const result = await transaction(async (client) => {
      const community = await client.query<Record<string, unknown>>(
        `INSERT INTO community.communities (name, slug, description, visibility, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [input.name.trim(), input.slug.trim().toLowerCase(), input.description?.trim() ?? '', input.visibility, actor.id],
      );
      await client.query(
        `INSERT INTO community.community_settings (community_id, join_policy)
         VALUES ($1, $2)`,
        [community.rows[0].id, input.visibility === 'public' ? 'open' : 'request'],
      );
      return community.rows[0];
    });
    await this.auditService.record(actor.id, 'community_created', 'community', String(result.id));
    return result;
  }

  async createGroup(actor: User, communityId: string, input: { name: string; description: string }) {
    this.requirePlatformAdmin(actor);
    const community = await query<{ status: string }>('SELECT status FROM community.communities WHERE id = $1', [communityId]);
    if (!community.rows[0] || community.rows[0].status !== 'active') throw new NotFoundException('Community not found');
    const result = await query<Record<string, unknown>>(
      `INSERT INTO community.groups (community_id, name, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [communityId, input.name.trim(), input.description?.trim() ?? '', actor.id],
    );
    await this.auditService.record(actor.id, 'group_created', 'group', String(result.rows[0].id));
    return result.rows[0];
  }

  async assignModerator(actor: User, groupId: string, userId: string) {
    this.requirePlatformAdmin(actor);
    const group = await query<{ community_id: string }>('SELECT community_id FROM community.groups WHERE id = $1 AND status = \'active\'', [groupId]);
    if (!group.rows[0]) throw new NotFoundException('Group not found');
    const result = await transaction(async (client) => {
      const membership = await client.query<{ id: string }>(
        `INSERT INTO community.group_memberships (group_id, user_id, status)
         VALUES ($1, $2, 'active')
         ON CONFLICT (group_id, user_id)
         DO UPDATE SET status = 'active', updated_at = now()
         RETURNING id`,
        [groupId, userId],
      );
      await client.query(
        `INSERT INTO community.group_membership_roles (group_membership_id, role_code, assigned_by)
         VALUES ($1, 'moderator', $2)
         ON CONFLICT (group_membership_id, role_code) DO NOTHING`,
        [membership.rows[0].id, actor.id],
      );
      return membership.rows[0];
    });
    await this.auditService.record(actor.id, 'group_moderator_assigned', 'group', groupId);
    return { success: true, membershipId: result.id };
  }

  async membershipRequests(actor: User, communityId: string) {
    await this.requireCommunityAdmin(actor, communityId);
    const result = await query<Record<string, unknown>>(
      `SELECT mr.*, u.email, p.display_name
       FROM community.membership_requests mr
       JOIN auth.users u ON u.id = mr.user_id
       LEFT JOIN profile.profiles p ON p.user_id = u.id
       WHERE mr.community_id = $1 AND mr.status = 'pending'
       ORDER BY mr.created_at ASC`,
      [communityId],
    );
    return result.rows;
  }

  async decideMembership(actor: User, requestId: string, decision: 'approved' | 'rejected') {
    const request = await query<{ community_id: string; user_id: string }>(
      `SELECT community_id, user_id FROM community.membership_requests
       WHERE id = $1 AND status = 'pending'`,
      [requestId],
    );
    if (!request.rows[0]) throw new NotFoundException('Membership request not found');
    await this.requireCommunityAdmin(actor, request.rows[0].community_id);

    const status = decision === 'approved' ? 'active' : 'rejected';
    const membershipId = await transaction(async (client) => {
      const membership = await client.query<{ id: string }>(
        `INSERT INTO community.memberships (community_id, user_id, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (community_id, user_id)
         DO UPDATE SET status = EXCLUDED.status, updated_at = now()
         RETURNING id`,
        [request.rows[0].community_id, request.rows[0].user_id, status],
      );
      await client.query(
        `UPDATE community.membership_requests
         SET status = $1, reviewed_by = $2, reviewed_at = now(), updated_at = now()
         WHERE id = $3`,
        [decision, actor.id, requestId],
      );
      if (status === 'active') {
        await client.query(
          `INSERT INTO community.membership_roles (membership_id, role_code, assigned_by)
           VALUES ($1, 'member', $2) ON CONFLICT DO NOTHING`,
          [membership.rows[0].id, actor.id],
        );
      }
      return membership.rows[0].id;
    });
    await this.notifications.notifyMembership(request.rows[0].user_id, actor.id, membershipId, requestId, status === 'active' ? 'active' : 'rejected');
    await this.auditService.record(actor.id, `membership_${decision}`, 'membership_request', requestId);
    return { success: true, status };
  }

  async requireActiveMember(user: User, communityId: string) {
    if (user.platformRole === 'platform_admin') return;
    const membership = await this.membership(user, communityId);
    if (membership.status !== 'active') throw new ForbiddenException('Active community membership required');
  }

  async requireCommunityAdmin(actor: User, communityId: string) {
    if (actor.platformRole === 'platform_admin') return;
    const result = await query(
      `SELECT 1
       FROM community.memberships m
       JOIN community.membership_roles mr ON mr.membership_id = m.id
       WHERE m.community_id = $1 AND m.user_id = $2 AND m.status = 'active'
         AND mr.role_code = 'community_admin'`,
      [communityId, actor.id],
    );
    if (result.rowCount !== 1) throw new ForbiddenException('Community admin permission required');
  }

  requirePlatformAdmin(actor: User) {
    if (actor.platformRole !== 'platform_admin') throw new ForbiddenException('Platform admin permission required');
  }

  async requireGroupModerator(actor: User, groupId: string) {
    if (actor.platformRole === 'platform_admin') return;
    const group = await query<{ community_id: string }>(
      'SELECT community_id FROM community.groups WHERE id = $1 AND status = \'active\'',
      [groupId],
    );
    if (!group.rows[0]) throw new NotFoundException('Group not found');
    try {
      await this.requireCommunityAdmin(actor, group.rows[0].community_id);
      return;
    } catch {
      const result = await query(
        `SELECT 1
         FROM community.group_memberships gm
         JOIN community.group_membership_roles gmr ON gmr.group_membership_id = gm.id
         WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.status = 'active'
           AND gmr.role_code = 'moderator'`,
        [groupId, actor.id],
      );
      if (result.rowCount !== 1) throw new ForbiddenException('Group moderator permission required');
    }
  }

  async canAccessScope(user: User, scopeType: 'community' | 'group' | 'channel', scopeId: string): Promise<boolean> {
    if (user.platformRole === 'platform_admin') return true;
    if (scopeType === 'community') {
      const membership = await this.membership(user, scopeId);
      return membership.status === 'active';
    }
    if (scopeType === 'channel') {
      const channel = await query<{ community_id: string; group_id: string | null }>(
        `SELECT cc.community_id, NULL::uuid AS group_id FROM content.community_channels cc WHERE cc.channel_id = $1
         UNION ALL
         SELECT g.community_id, gc.group_id FROM content.group_channels gc JOIN community.groups g ON g.id = gc.group_id WHERE gc.channel_id = $1`,
        [scopeId],
      );
      const row = channel.rows[0];
      if (!row) return false;
      if (row.group_id) return this.canAccessScope(user, 'group', row.group_id);
      return this.canAccessScope(user, 'community', row.community_id);
    }
    const group = await query<{ community_id: string }>(
      `SELECT community_id FROM community.groups WHERE id = $1 AND status = 'active'`,
      [scopeId],
    );
    const communityId = group.rows[0]?.community_id;
    if (!communityId) return false;
    const communityMembership = await this.membership(user, communityId);
    if (communityMembership.status === 'active') return true;
    const direct = await query(
      `SELECT 1 FROM community.group_memberships
       WHERE group_id = $1 AND user_id = $2 AND status = 'active'`,
      [scopeId, user.id],
    );
    return direct.rowCount === 1;
  }

  private async audit(actorId: string, action: string, resourceType: string, resourceId: string) {
    await query(
      `INSERT INTO system.audit_events (actor_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4)`,
      [actorId, action, resourceType, resourceId],
    );
  }
}

function membershipStatus(visibility: string, platformRole: string): 'active' | 'pending' {
  return visibility === 'public' || platformRole === 'platform_admin' ? 'active' : 'pending';
}

function auditMembershipAction(status: 'active' | 'pending') {
  return status === 'active' ? 'membership_activated' : 'membership_requested';
}
