import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db';

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!', 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, phone_number, display_name, platform_role, email_verified_at)
       VALUES ($1, $2, $3, $4, 'platform_admin', now())
       ON CONFLICT (email) DO UPDATE SET platform_role = 'platform_admin', email_verified_at = COALESCE(users.email_verified_at, now())
       RETURNING id`,
      [process.env.SEED_ADMIN_EMAIL ?? 'admin@wb.local', passwordHash, '+966500000000', 'WB Platform Admin'],
    );
    const userId = user.rows[0].id;
    const publicCommunity = await client.query<{ id: string }>(
      `INSERT INTO communities (name, slug, description, visibility) VALUES ($1, $2, $3, 'public')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      ['WB Community', 'wb-community', 'المجتمع العام للنقاش والمعرفة'],
    );
    const closedCommunity = await client.query<{ id: string }>(
      `INSERT INTO communities (name, slug, description, visibility) VALUES ($1, $2, $3, 'closed')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      ['WB Builders', 'wb-builders', 'مجتمع مغلق للبنّاء والمساهمين'],
    );
    for (const communityId of [publicCommunity.rows[0].id, closedCommunity.rows[0].id]) {
      await client.query(
        `INSERT INTO community_memberships (community_id, user_id, status, role) VALUES ($1, $2, 'active', 'community_admin')
         ON CONFLICT (community_id, user_id) DO UPDATE SET status = 'active', role = 'community_admin'`,
        [communityId, userId],
      );
    }
    await client.query(
      `INSERT INTO groups (community_id, name, description) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [publicCommunity.rows[0].id, 'Product Builders', 'مجموعة أولية للمنتجات والمشاريع'],
    );
    await client.query('COMMIT');
    console.log('V0 seed applied');
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
