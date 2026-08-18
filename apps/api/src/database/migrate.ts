import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { getApiRuntimeConfig } from '@wb/config';
import { Client } from 'pg';

const migrationsDirectory = fileURLToPath(new URL('../../migrations/', import.meta.url));

async function migrate(): Promise<void> {
  const configuration = getApiRuntimeConfig();

  if (configuration.databaseUrl === undefined) {
    throw new Error('DATABASE_URL must be configured before running migrations.');
  }

  const client = new Client({ connectionString: configuration.databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationNames = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right));

    for (const migrationName of migrationNames) {
      const appliedMigration = await client.query<{ name: string }>(
        'SELECT name FROM schema_migrations WHERE name = $1',
        [migrationName],
      );

      if (appliedMigration.rowCount !== 0) {
        continue;
      }

      const migrationSql = await readFile(`${migrationsDirectory}/${migrationName}`, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(migrationSql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

void migrate();
