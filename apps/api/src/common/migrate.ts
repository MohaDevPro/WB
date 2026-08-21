import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pool } from './db';

const migrations = ['001_bootstrap.sql', '002_modular_schemas.sql'];

async function main() {
  const client = await pool.connect();

  try {
    for (const version of migrations) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM public.schema_migrations WHERE version = $1',
        [version],
      ).catch(() => ({ rowCount: 0 } as { rowCount: number | null }));

      if ((alreadyApplied.rowCount ?? 0) > 0) {
        console.log(`Skipping ${version}; already applied`);
        continue;
      }

      const sqlPath = resolve(dirname(__filename), '../../../../database/migrations', version);
      const sql = await readFile(sqlPath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations(version) VALUES ($1)',
          [version],
        );
        await client.query('COMMIT');
        console.log(`Applied ${version}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
