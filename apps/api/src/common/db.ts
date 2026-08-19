import { Pool, PoolClient, QueryResultRow } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://wk:wk@localhost:5432/wk',
  max: 10,
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return pool.query<T>(text, values);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function dbUser(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    phoneNumber: String(row.phone_number),
    displayName: String(row.display_name),
    platformRole: String(row.platform_role),
    emailVerifiedAt: row.email_verified_at ? new Date(String(row.email_verified_at)).toISOString() : null,
    status: String(row.status),
  };
}
