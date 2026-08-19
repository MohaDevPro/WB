import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { PGlite, type Transaction } from '@electric-sql/pglite';
import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ApiRuntimeConfig } from '@wb/config';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

import type { DatabaseClient, DatabaseResult } from './database.types.js';
import { API_RUNTIME_CONFIG } from '../runtime-config.js';

const localDatabaseDirectory = process.env.WB_LOCAL_DATABASE_DIR ?? '.wb-data';
const migrationsDirectory = fileURLToPath(new URL('../../migrations/', import.meta.url));

type PGliteQueryExecutor = Pick<Transaction, 'query'>;

function toDatabaseResult<Row>(result: {
  readonly rowCount?: number | null;
  readonly rows: readonly Row[];
}): DatabaseResult<Row> {
  return Object.freeze({
    rowCount: result.rowCount ?? result.rows.length,
    rows: result.rows,
  });
}

function fromPoolClient(client: PoolClient): DatabaseClient {
  return Object.freeze({
    async query<Row = Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<DatabaseResult<Row>> {
      const result = (await client.query(text, [...values])) as QueryResult<QueryResultRow>;
      return toDatabaseResult(result) as DatabaseResult<Row>;
    },
  });
}

function fromPGliteClient(client: PGliteQueryExecutor): DatabaseClient {
  return Object.freeze({
    async query<Row = Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<DatabaseResult<Row>> {
      const result = await client.query<Row>(text, [...values]);
      return toDatabaseResult(result);
    },
  });
}

@Injectable()
export class DatabaseService implements OnModuleDestroy, OnModuleInit {
  private localDatabase: PGlite | undefined;
  private pool: Pool | undefined;

  constructor(@Inject(API_RUNTIME_CONFIG) private readonly configuration: ApiRuntimeConfig) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    await this.localDatabase?.close();
  }

  async onModuleInit(): Promise<void> {
    await this.applyMigrations();
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<DatabaseResult<Row>> {
    if (this.usesNetworkDatabase()) {
      const result = await this.getPool().query<Row>(text, [...values]);
      return toDatabaseResult(result);
    }

    const result = await this.getLocalDatabase().query<Row>(text, [...values]);
    return toDatabaseResult(result);
  }

  async withTransaction<Result>(
    operation: (client: DatabaseClient) => Promise<Result>,
  ): Promise<Result> {
    if (this.usesNetworkDatabase()) {
      const client = await this.getPool().connect();

      try {
        await client.query('BEGIN');
        const result = await operation(fromPoolClient(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return this.getLocalDatabase().transaction(async (transaction) =>
      operation(fromPGliteClient(transaction)),
    );
  }

  private async applyMigrations(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationNames = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right));

    for (const migrationName of migrationNames) {
      const appliedMigration = await this.query<{ name: string }>(
        'SELECT name FROM schema_migrations WHERE name = $1',
        [migrationName],
      );

      if (appliedMigration.rowCount !== 0) {
        continue;
      }

      const migrationSql = await readFile(`${migrationsDirectory}/${migrationName}`, 'utf8');
      await this.applyMigration(migrationName, migrationSql);
    }
  }

  private async applyMigration(name: string, sql: string): Promise<void> {
    if (this.usesNetworkDatabase()) {
      const client = await this.getPool().connect();

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return;
    }

    await this.getLocalDatabase().transaction(async (transaction) => {
      await transaction.exec(sql);
      await transaction.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    });
  }

  private getLocalDatabase(): PGlite {
    this.localDatabase ??= new PGlite(localDatabaseDirectory);
    return this.localDatabase;
  }

  private getPool(): Pool {
    if (this.configuration.databaseUrl === undefined) {
      throw new Error('A network database URL is required outside local development.');
    }

    this.pool ??= new Pool({
      connectionString: this.configuration.databaseUrl,
      max: 10,
    });

    return this.pool;
  }

  private usesNetworkDatabase(): boolean {
    return this.configuration.databaseUrl?.startsWith('postgresql://') ?? false;
  }
}
