import { PoolClient } from 'pg';
import { query } from '../common/db';

type MembershipRow = Record<string, unknown> & {
  status: string;
  membership_role?: string;
  membership_roles?: string;
};

export async function findJoinableCommunity(communityId: string) {
  const result = await query<{ visibility: string; status: string }>(
    'SELECT visibility, status FROM community.communities WHERE id = $1',
    [communityId],
  );
  return result.rows[0];
}

export async function persistMembership(client: PoolClient, communityId: string, userId: string, status: 'active' | 'pending') {
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
    ? activateMembership(client, membership.rows[0], membershipId)
    : queueMembershipRequest(client, communityId, userId, membership.rows[0]);
}

async function activateMembership(client: PoolClient, membership: Record<string, unknown>, membershipId: string) {
  await client.query(
    `INSERT INTO community.membership_roles (membership_id, role_code)
     VALUES ($1, 'member') ON CONFLICT DO NOTHING`,
    [membershipId],
  );
  return membership;
}

async function queueMembershipRequest(client: PoolClient, communityId: string, userId: string, membership: Record<string, unknown>) {
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

export async function findMembership(userId: string, communityId: string): Promise<MembershipRow> {
  const result = await query<MembershipRow>(
    `SELECT m.*,
            COALESCE((SELECT string_agg(mr.role_code, ',' ORDER BY mr.role_code)
                      FROM community.membership_roles mr
                      WHERE mr.membership_id = m.id), 'member') AS membership_roles
     FROM community.memberships m
     WHERE m.community_id = $1 AND m.user_id = $2`,
    [communityId, userId],
  );
  return result.rows[0] ?? { status: 'none', membership_roles: 'member' };
}

export function membershipStatus(visibility: string, platformRole: string): 'active' | 'pending' {
  return visibility === 'public' || platformRole === 'platform_admin' ? 'active' : 'pending';
}

export function auditMembershipAction(status: 'active' | 'pending') {
  return status === 'active' ? 'membership_activated' : 'membership_requested';
}
