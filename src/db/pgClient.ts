import { Pool } from 'pg';
import { DatabaseClient, QueryResult } from './database';

export class PgDatabaseClient implements DatabaseClient {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async query<T>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.pool.query<T>(text, values);
    return { rows: result.rows };
  }
}
