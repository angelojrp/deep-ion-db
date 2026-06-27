import mysql from 'mysql2/promise'
import type { ColumnInfo, ConnectionConfig, Driver, QueryResult, SchemaTable } from '../types'

export class MysqlDriver implements Driver {
  private conn: mysql.Connection | null = null

  constructor(private config: ConnectionConfig) {}

  async connect(): Promise<void> {
    this.conn = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port ?? 3306,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      ssl: this.config.ssl ? {} : undefined,
      multipleStatements: false,
      dateStrings: true
    })
  }

  async disconnect(): Promise<void> {
    await this.conn?.end()
    this.conn = null
  }

  private get connection(): mysql.Connection {
    if (!this.conn) throw new Error('Conexão MySQL não inicializada.')
    return this.conn
  }

  async query(sql: string): Promise<QueryResult> {
    const start = performance.now()
    const [rows, fields] = await this.connection.query(sql)
    const durationMs = performance.now() - start

    if (Array.isArray(rows)) {
      return {
        columns: ((fields as mysql.FieldPacket[]) ?? []).map((f) => f.name),
        rows: rows as Record<string, unknown>[],
        rowCount: rows.length,
        durationMs,
        command: 'SELECT'
      }
    }

    const header = rows as mysql.ResultSetHeader
    return {
      columns: [],
      rows: [],
      rowCount: header.affectedRows ?? 0,
      durationMs,
      command: 'OK'
    }
  }

  async listTables(): Promise<SchemaTable[]> {
    const [rows] = await this.connection.query(
      `select table_schema as \`schema\`, table_name as name, table_type as type
         from information_schema.tables
        where table_schema = database()
        order by table_name`
    )
    return (rows as Record<string, string>[]).map((r) => ({
      schema: r.schema,
      name: r.name,
      type: r.type
    }))
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const [rows] = await this.connection.query(
      `select column_name as name, data_type as dataType, is_nullable as nullable
         from information_schema.columns
        where table_schema = ? and table_name = ?
        order by ordinal_position`,
      [schema, table]
    )
    return (rows as Record<string, string>[]).map((r) => ({
      name: r.name,
      dataType: r.dataType,
      nullable: r.nullable === 'YES'
    }))
  }
}
