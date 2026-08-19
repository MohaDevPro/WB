import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { query, transaction } from '../common/db';

type User = { id: string; platformRole: string; emailVerifiedAt: string | null };

@Injectable()
export class CommunitiesService {
  async list(user: User) {
    const result = await query<Record<string, unknown>>(
      `SELECT c.id, c.name, c.slug, c.description, c.visibility, c.status,
              COALESCE(m.status, 'none') AS membership_status,
              COALESCE(m.role, 'member') AS membership_role
       FROM communities c LEFT JOIN community_memberships m ON m.community_id = c.id AND m.user_id = $1
       WHERE c.status = 'active' ORDER BY c.created_at ASC`,
      [user.id],
    );
    return result.rows;
  }

  async get(user: User, communityId: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT c.id, c.name, c.slug, c.description, c.visibility, c.status,
              COALESCE(m.status, 'none') AS membership_status,
              COALESCE(m.role, 'member') AS membership_role
       FROM communities c LEFT JOIN community_memberships m ON m.community_id = c.id AND m.user_id = $2
       WHERE c.id = $1 AND c.status = 'active'`,
      [communityId, user.id],
    );
    const community = result.rows[0];
    if (!community) throw new NotFoundException('Community not found');
    if (community.visibility === 'closed' && community.membership_status !== 'active' && user.platformRole !== 'platform_admin') {
      return { id: community.id, name: community.name, slug: community.slug, description: community.description, visibility: community.visibility, membershipStatus: community.membership_status };
    }
    return community;
  }

  async join(user: User, communityId: string) {
    const community = await query<{ visibility: string; status: string }>('SELECT visibility, status FROM communities WHERE id = $1', [communityId]);
    if (!community.rows[0] || community.rows[0].status !== 'active') throw new NotFoundException('Community not found');
    const status = community.rows[0].visibility === 'public' ? 'active' : 'pending';
    const result = await query<Record<string, unknown>>(
      `INSERT INTO community_memberships (community_id, user_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (community_id, user_id) DO UPDATE SET status = CASE WHEN community_memberships.status IN ('removed','rejected') THEN EXCLUDED.status ELSE community_memberships.status END, updated_at = now()
       RETURNING *`,
      [communityId, user.id, status],
    );
    if (status === 'active') await this.audit(user.id, 'membership_activated', 'community', communityId);
    return result.rows[0];
  }

  async membership(user: User, communityId: string) {
    const result = await query<Record<string, unknown>>('SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2', [communityId, user.id]);
    return result.rows[0] ?? { status: 'none', role: 'member' };
  }

  async groups(user: User, communityId: string) {
    await this.requireActiveMember(user, communityId);
    const result = await query<Record<string, unknown>>('SELECT * FROM groups WHERE community_id = $1 AND status = \'active\' ORDER BY created_at ASC', [communityId]);
    return result.rows;
  }

  async createCommunity(actor: User, input: { name: string; slug: string; description: string; visibility: 'public' | 'closed' }) {
    this.requirePlatformAdmin(actor);
    const result = await query<Record<string, unknown>>(
      'INSERT INTO communities (name, slug, description, visibility) VALUES ($1,$2,$3,$4) RETURNING *',
      [input.name.trim(), input.slug.trim().toLowerCase(), input.description?.trim() ?? '', input.visibility],
    );
    await this.audit(actor.id, 'community_created', 'community', String(result.rows[0].id));
    return result.rows[0];
  }

  async createGroup(actor: User, communityId: string, input: { name: string; description: string }) {
    this.requirePlatformAdmin(actor);
    const result = await query<Record<string, unknown>>(
      'INSERT INTO groups (community_id, name, description) VALUES ($1,$2,$3) RETURNING *',
      [communityId, input.name.trim(), input.description?.trim() ?? ''],
    );
    await this.audit(actor.id, 'group_created', 'group', String(result.rows[0].id));
    return result.rows[0];
  }

  async assignModerator(actor: User, groupId: string, userId: string) {
    this.requirePlatformAdmin(actor);
    await query('INSERT INTO group_moderators (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [groupId, userId]);
    await this.audit(actor.id, 'group_moderator_assigned', 'group', groupId);
    return { success: true };
  }

  async membershipRequests(actor: User, communityId: string) {
    await this.requireCommunityAdmin(actor, communityId);
    const result = await query<Record<string, unknown>>(
      `SELECT m.*, u.email, u.display_name FROM community_memberships m JOIN users u ON u.id = m.user_id
       WHERE m.community_id = $1 AND m.status = 'pending' ORDER BY m.created_at ASC`,
      [communityId],
    );
    return result.rows;
  }

  async decideMembership(actor: User, membershipId: string, decision: 'active' | 'rejected') {
    const membership = await query<{ community_id: string; user_id: string }>('SELECT community_id, user_id FROM community_memberships WHERE id = $1', [membershipId]);
    if (!membership.rows[0]) throw new NotFoundException('Membership request not found');
    await this.requireCommunityAdmin(actor, membership.rows[0].community_id);
    await query('UPDATE community_memberships SET status = $1, updated_at = now() WHERE id = $2', [decision, membershipId]);
    await query('INSERT INTO notifications (user_id, type, payload) VALUES ($1,$2,$3)', [membership.rows[0].user_id, `membership_${decision}`, JSON.stringify({ communityId: membership.rows[0].community_id })]);
    await this.audit(actor.id, `membership_${decision}`, 'membership', membershipId);
    return { success: true, status: decision };
  }

  async requireActiveMember(user: User, communityId: string) {
    if (user.platformRole === 'platform_admin') return;
    const membership = await this.membership(user, communityId);
    if (membership.status !== 'active') throw new ForbiddenException('Active community membership required');
  }

  async requireCommunityAdmin(actor: User, communityId: string) {
    if (actor.platformRole === 'platform_admin') return;
    const membership = await this.membership(actor, communityId);
    if (membership.status !== 'active' || membership.role !== 'community_admin') throw new ForbiddenException('Community admin permission required');
  }

  requirePlatformAdmin(actor: User) {
    if (actor.platformRole !== 'platform_admin') throw new ForbiddenException('Platform admin permission required');
  }

  async canAccessScope(user: User, scopeType: 'community' | 'group', scopeId: string) {
    if (user.platformRole === 'platform_admin') return true;
    const communityId = scopeType === 'community'
      ? scopeId
      : (await query<{ community_id: string }>('SELECT community_id FROM groups WHERE id = $1 AND status = \'active\'', [scopeId])).rows[0]?.community_id;
    if (!communityId) return false;
    const membership = await this.membership(user, communityId);
    return membership.status === 'active';
  }

  private async audit(actorId: string, action: string, resourceType: string, resourceId: string) {
    await query('INSERT INTO audit_events (actor_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)', [actorId, action, resourceType, resourceId]);
  }
}
