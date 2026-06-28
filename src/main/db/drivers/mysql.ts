import mysql from 'mysql2/promise'
import type {
  ColumnInfo,
  ConnectionConfig,
  Driver,
  ForeignKey,
  HealthMetric,
  QueryResult,
  RoleInfo,
  SchemaTable,
  SessionInfo,
  SqlStatement
} from '../types'

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

  async primaryKeys(schema: string, table: string): Promise<string[]> {
    const [rows] = await this.connection.query(
      `select column_name as name
         from information_schema.key_column_usage
        where table_schema = ? and table_name = ? and constraint_name = 'PRIMARY'
        order by ordinal_position`,
      [schema, table]
    )
    return (rows as Record<string, string>[]).map((r) => r.name)
  }

  async execBatch(statements: SqlStatement[]): Promise<void> {
    const conn = this.connection
    try {
      await conn.beginTransaction()
      for (const s of statements) await conn.execute(s.sql, s.params as never[])
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    }
  }

  async activeSessions(): Promise<SessionInfo[]> {
    const [rows] = await this.connection.query(
      `select id as pid, user, db as database, command as state, info as query, time * 1000 as durationMs
         from information_schema.processlist order by time desc`
    )
    return (rows as Record<string, unknown>[]).map((r) => ({
      pid: r.pid as number,
      user: (r.user as string) ?? null,
      database: (r.database as string) ?? null,
      state: (r.state as string) ?? null,
      query: (r.query as string) ?? null,
      durationMs: r.durationMs != null ? Number(r.durationMs) : null
    }))
  }

  async killSession(pid: string | number): Promise<void> {
    await this.connection.query(`KILL ${Number(pid)}`)
  }

  async serverHealth(): Promise<HealthMetric[]> {
    const status = async (name: string): Promise<string> => {
      const [r] = await this.connection.query(`show global status like '${name}'`)
      return String((r as Record<string, string>[])[0]?.Value ?? '-')
    }
    const [sz] = await this.connection.query(
      'select coalesce(sum(data_length+index_length),0) v from information_schema.tables where table_schema = database()'
    )
    return [
      { label: 'Conexões', value: await status('Threads_connected') },
      { label: 'Uptime (s)', value: await status('Uptime') },
      { label: 'Queries', value: await status('Queries') },
      {
        label: 'Tamanho do banco (bytes)',
        value: String((sz as Record<string, unknown>[])[0]?.v ?? '-')
      }
    ]
  }

  async foreignKeys(): Promise<ForeignKey[]> {
    const [rows] = await this.connection.query(
      `select table_name as \`table\`, column_name as \`column\`,
              referenced_table_name as refTable, referenced_column_name as refColumn
         from information_schema.key_column_usage
        where referenced_table_name is not null and table_schema = database()`
    )
    return rows as ForeignKey[]
  }

  async listRoles(): Promise<RoleInfo[]> {
    const [rows] = await this.connection.query(
      `select distinct grantee as name from information_schema.user_privileges order by grantee`
    )
    return (rows as Record<string, string>[]).map((r) => ({ name: r.name }))
  }

  async tableDdl(schema: string, table: string): Promise<string> {
    const [rows] = await this.connection.query(`SHOW CREATE TABLE \`${schema}\`.\`${table}\``)
    const row = (rows as Record<string, string>[])[0]
    const ddl = row?.['Create Table'] ?? row?.['Create View']
    return ddl ? `${ddl};` : `-- DDL não encontrado para ${schema}.${table}`
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
