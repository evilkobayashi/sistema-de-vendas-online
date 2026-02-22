export interface QueryResult<T> {
  rows: T[];
}

export interface DatabaseClient {
  query<T = unknown>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}
