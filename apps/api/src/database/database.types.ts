export type DatabaseResult<Row> = Readonly<{
  rowCount: number;
  rows: readonly Row[];
}>;

export type DatabaseClient = Readonly<{
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<DatabaseResult<Row>>;
}>;
