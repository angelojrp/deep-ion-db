import { Client } from 'pg'
import type {
  ColumnInfo,
  ConnectionConfig,
  Driver,
  QueryResult,
  SchemaTable,
  SqlStatement
} from '../types'

export class PostgresDriver implements Driver {
  private client: Client

  constructor(config: ConnectionConfig) {
    this.client = new Client({
      host: config.host,
      port: config.port ?? 5432,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined
    })
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    await this.client.end()
  }

  async query(sql: string): Promise<QueryResult> {
    const start = performance.now()
    const res = await this.client.query(sql)
    const durationMs = performance.now() - start
    // Múltiplos comandos retornam um array de resultados; usamos o último.
    const result = Array.isArray(res) ? res[res.length - 1] : res
    return {
      columns: result.fields?.map((f: { name: string }) => f.name) ?? [],
      rows: (result.rows as Record<string, unknown>[]) ?? [],
      rowCount: result.rowCount ?? result.rows?.length ?? 0,
      durationMs,
      command: result.command
    }
  }

  async listTables(): Promise<SchemaTable[]> {
    const res = await this.client.query(
      `select table_schema as schema, table_name as name, table_type as type
         from information_schema.tables
        where table_schema not in ('pg_catalog', 'information_schema')
        order by table_schema, table_name`
    )
    return res.rows.map((r) => ({ schema: r.schema, name: r.name, type: r.type }))
  }

  async primaryKeys(schema: string, table: string): Promise<string[]> {
    const res = await this.client.query(
      `select a.attname as name
         from pg_index i
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
        where i.indrelid = format('%I.%I', $1, $2)::regclass and i.indisprimary
        order by array_position(i.indkey, a.attnum)`,
      [schema, table]
    )
    return res.rows.map((r) => r.name as string)
  }

  async execBatch(statements: SqlStatement[]): Promise<void> {
    try {
      await this.client.query('BEGIN')
      for (const s of statements) await this.client.query(s.sql, s.params)
      await this.client.query('COMMIT')
    } catch (e) {
      await this.client.query('ROLLBACK')
      throw e
    }
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const res = await this.client.query(
      `select column_name as name, data_type as "dataType", is_nullable as nullable
         from information_schema.columns
        where table_schema = $1 and table_name = $2
        order by ordinal_position`,
      [schema, table]
    )
    return res.rows.map((r) => ({
      name: r.name,
      dataType: r.dataType,
      nullable: r.nullable === 'YES'
    }))
  }
}
