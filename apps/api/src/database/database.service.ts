import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type { ApiRuntimeConfig } from '@wb/config';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

import { API_RUNTIME_CONFIG } from '../runtime-config.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool | undefined;

  constructor(@Inject(API_RUNTIME_CONFIG) private readonly configuration: ApiRuntimeConfig) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  async query<ResultRow extends QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    return this.getPool().query<ResultRow>(text, [...values]);
  }

  async withTransaction<Result>(
    operation: (client: PoolClient) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.getPool().connect();

    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private getPool(): Pool {
    if (this.configuration.databaseUrl === undefined) {
      throw new ServiceUnavailableException('Profile storage is not configured.');
    }

    this.pool ??= new Pool({
      connectionString: this.configuration.databaseUrl,
      max: 10,
    });

    return this.pool;
  }
}
