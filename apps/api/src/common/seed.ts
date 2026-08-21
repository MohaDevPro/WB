import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db';

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!', 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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

    const publicCommunity = await client.query<{ id: string }>(
      `INSERT INTO community.communities (name, slug, description, visibility, created_by)
       VALUES ($1, $2, $3, 'public', $4)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      ['WB Community', 'wb-community', 'المجتمع العام للنقاش والمعرفة', userId],
    );
    const closedCommunity = await client.query<{ id: string }>(
      `INSERT INTO community.communities (name, slug, description, visibility, created_by)
       VALUES ($1, $2, $3, 'closed', $4)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id`,
      ['WB Builders', 'wb-builders', 'مجتمع مغلق للبنّاء والمساهمين', userId],
    );

    for (const [communityId, joinPolicy] of [
      [publicCommunity.rows[0].id, 'open'],
      [closedCommunity.rows[0].id, 'request'],
    ] as const) {
      await client.query(
        `INSERT INTO community.community_settings (community_id, join_policy)
         VALUES ($1, $2)
         ON CONFLICT (community_id) DO UPDATE SET join_policy = EXCLUDED.join_policy, updated_at = now()`,
        [communityId, joinPolicy],
      );
      const membership = await client.query<{ id: string }>(
        `INSERT INTO community.memberships (community_id, user_id, status)
         VALUES ($1, $2, 'active')
         ON CONFLICT (community_id, user_id)
         DO UPDATE SET status = 'active', updated_at = now()
         RETURNING id`,
        [communityId, userId],
      );
      for (const role of ['member', 'community_admin']) {
        await client.query(
          `INSERT INTO community.membership_roles (membership_id, role_code, assigned_by)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [membership.rows[0].id, role, userId],
        );
      }
    }

    await client.query(
      `INSERT INTO community.groups (community_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (community_id, name) DO UPDATE SET description = EXCLUDED.description, updated_at = now()`,
      [publicCommunity.rows[0].id, 'Product Builders', 'مجموعة أولية للمنتجات والمشاريع', userId],
    );

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
