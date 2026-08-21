import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PoolClient } from 'pg';
import { pool } from './db';

type SeedCommunity = { id: string; joinPolicy: 'open' | 'request' };

async function seedAdmin(client: PoolClient) {
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!', 12);
  const user = await client.query<{ id: string }>(
    `INSERT INTO auth.users (email, password_hash, platform_role, email_verified_at)
     VALUES ($1, $2, 'platform_admin', now())
     ON CONFLICT (email)
     DO UPDATE SET platform_role = 'platform_admin', email_verified_at = COALESCE(auth.users.email_verified_at, now()), updated_at = now()
     RETURNING id`,
    [process.env.SEED_ADMIN_EMAIL ?? 'admin@wb.local', passwordHash],
  );
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO auth.user_phones (user_id, phone_e164)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164, updated_at = now()`,
    [userId, '+966500000000'],
  );
  await client.query(
    `INSERT INTO profile.profiles (user_id, display_name, bio)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
    [userId, 'WB Platform Admin', 'منصة WB لإدارة المجتمع والمعرفة'],
  );
  return userId;
}

async function seedCommunities(client: PoolClient, userId: string) {
  const publicCommunity = await createCommunity(client, userId, 'WB Community', 'wb-community', 'المجتمع العام للنقاش والمعرفة', 'public');
  const closedCommunity = await createCommunity(client, userId, 'WB Builders', 'wb-builders', 'مجتمع مغلق للبنّاء والمساهمين', 'closed');
  await configureCommunity(client, publicCommunity, userId);
  await configureCommunity(client, closedCommunity, userId);
  return { publicCommunityId: publicCommunity.id, closedCommunityId: closedCommunity.id };
}

async function createCommunity(client: PoolClient, userId: string, name: string, slug: string, description: string, visibility: 'public' | 'closed') {
  const result = await client.query<{ id: string }>(
    `INSERT INTO community.communities (name, slug, description, visibility, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [name, slug, description, visibility, userId],
  );
  return { id: result.rows[0].id, joinPolicy: visibility === 'public' ? 'open' as const : 'request' as const };
}

async function configureCommunity(client: PoolClient, community: SeedCommunity, userId: string) {
  await client.query(
    `INSERT INTO community.community_settings (community_id, join_policy)
     VALUES ($1, $2)
     ON CONFLICT (community_id) DO UPDATE SET join_policy = EXCLUDED.join_policy, updated_at = now()`,
    [community.id, community.joinPolicy],
  );
  const membership = await client.query<{ id: string }>(
    `INSERT INTO community.memberships (community_id, user_id, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (community_id, user_id)
     DO UPDATE SET status = 'active', updated_at = now()
     RETURNING id`,
    [community.id, userId],
  );
  await seedMembershipRoles(client, membership.rows[0].id, userId);
}

async function seedMembershipRoles(client: PoolClient, membershipId: string, userId: string) {
  for (const role of ['member', 'community_admin']) {
    await client.query(
      `INSERT INTO community.membership_roles (membership_id, role_code, assigned_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [membershipId, role, userId],
    );
  }
}

async function seedGroups(client: PoolClient, communityId: string, userId: string) {
  await client.query(
    `INSERT INTO community.groups (community_id, name, description, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (community_id, name) DO UPDATE SET description = EXCLUDED.description, updated_at = now()`,
    [communityId, 'Product Builders', 'مجموعة أولية للمنتجات والمشاريع', userId],
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = await seedAdmin(client);
    const { publicCommunityId } = await seedCommunities(client, userId);
    await seedGroups(client, publicCommunityId, userId);
    await client.query('COMMIT');
    console.log('WB V0 seed applied');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
