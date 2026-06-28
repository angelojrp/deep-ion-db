import sql from 'mssql'
import type {
  ColumnInfo,
  ConnectionConfig,
  Driver,
  ForeignKey,
  HealthMetric,
  IndexInfo,
  JobInfo,
  QueryResult,
  RoleInfo,
  RoutineInfo,
  SchemaTable,
  SessionInfo,
  SqlStatement
} from '../types'

import { BaseDriver } from './base'

/** Driver SQL Server (Microsoft) via mssql/tedious (JS puro, sem build nativo). */
export class MssqlDriver extends BaseDriver implements Driver {
  private pool: sql.ConnectionPool

  constructor(config: ConnectionConfig) {
    super()
    this.pool = new sql.ConnectionPool({
      server: config.host ?? 'localhost',
      port: config.port ?? 1433,
      user: config.user,
      password: config.password,
      database: config.database,
      options: { trustServerCertificate: true, encrypt: !!config.ssl }
    })
  }

  async connect(): Promise<void> {
    await this.pool.connect()
  }

  async disconnect(): Promise<void> {
    await this.pool.close()
  }

  async query(text: string): Promise<QueryResult> {
    const start = performance.now()
    const res = await this.pool.request().query(text)
    const durationMs = performance.now() - start
    const recordset = res.recordset as
      (Record<string, unknown>[] & { columns?: Record<string, { index: number }> }) | undefined
    if (recordset) {
      const colsMeta = recordset.columns ?? {}
      const columns = Object.keys(colsMeta).sort((a, b) => colsMeta[a].index - colsMeta[b].index)
      return this.normalizeQueryResult(
        columns,
        Array.from(recordset),
        recordset.length,
        durationMs,
        'SELECT'
      )
    }
    return this.normalizeQueryResult([], [], res.rowsAffected?.[0] ?? 0, durationMs, 'OK')
  }

  private async params(
    text: string,
    values: { schema?: string; table?: string }
  ): Promise<sql.IResult<Record<string, unknown>>> {
    const r = this.pool.request()
    if (values.schema !== undefined) r.input('schema', values.schema)
    if (values.table !== undefined) r.input('table', values.table)
    return r.query(text)
  }

  async listTables(): Promise<SchemaTable[]> {
    const res = await this.pool.request().query(
      `select table_schema as [schema], table_name as name, table_type as type
         from information_schema.tables order by table_schema, table_name`
    )
    return res.recordset as unknown as SchemaTable[]
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const res = await this.params(
      `select column_name as name, data_type as dataType, is_nullable as nullable
         from information_schema.columns where table_schema=@schema and table_name=@table
         order by ordinal_position`,
      { schema, table }
    )
    return (res.recordset as Record<string, string>[]).map((r) => ({
      name: r.name,
      dataType: r.dataType,
      nullable: r.nullable === 'YES'
    }))
  }

  async primaryKeys(schema: string, table: string): Promise<string[]> {
    const res = await this.params(
      `select kcu.column_name as name
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name
        where tc.constraint_type='PRIMARY KEY' and tc.table_schema=@schema and tc.table_name=@table
        order by kcu.ordinal_position`,
      { schema, table }
    )
    return (res.recordset as Record<string, string>[]).map((r) => r.name)
  }

  async execBatch(statements: SqlStatement[]): Promise<void> {
    const tx = new sql.Transaction(this.pool)
    await tx.begin()
    try {
      for (const s of statements) {
        const req = new sql.Request(tx)
        let i = 0
        const sqlText = s.sql.replace(/\?/g, () => `@p${i++}`)
        s.params.forEach((v, idx) => req.input(`p${idx}`, v as never))
        await req.query(sqlText)
      }
      await tx.commit()
    } catch (e) {
      await tx.rollback()
      throw e
    }
  }

  async tableDdl(schema: string, table: string): Promise<string> {
    const cols = await this.listColumns(schema, table)
    const pk = await this.primaryKeys(schema, table)
    const lines = cols.map((c) => `  [${c.name}] ${c.dataType}${c.nullable ? '' : ' NOT NULL'}`)
    if (pk.length) lines.push(`  PRIMARY KEY (${pk.map((c) => `[${c}]`).join(', ')})`)
    return `CREATE TABLE [${schema}].[${table}] (\n${lines.join(',\n')}\n);`
  }

  async activeSessions(): Promise<SessionInfo[]> {
    try {
      const res = await this.pool.request().query(
        `select session_id as pid, login_name as [user], db_name(database_id) as [database],
                status as state, cast(null as nvarchar(max)) as query, null as durationMs
           from sys.dm_exec_sessions where is_user_process=1`
      )
      return res.recordset as unknown as SessionInfo[]
    } catch {
      return []
    }
  }

  async killSession(pid: string | number): Promise<void> {
    await this.pool.request().query(`KILL ${Number(pid)}`)
  }

  async listRoles(): Promise<RoleInfo[]> {
    const res = await this.pool.request().query(
      `select name, (type in ('S','U')) as canLogin from sys.database_principals
        where type in ('S','U','R','G') order by name`
    )
    return (res.recordset as Record<string, unknown>[]).map((r) => ({
      name: r.name as string,
      canLogin: !!r.canLogin
    }))
  }

  async serverHealth(): Promise<HealthMetric[]> {
    const one = async (q: string): Promise<string> => {
      const r = await this.pool.request().query(q)
      return String((r.recordset?.[0] as Record<string, unknown>)?.v ?? '-')
    }
    return [
      {
        label: 'Sessões de usuário',
        value: await one('select count(*) v from sys.dm_exec_sessions where is_user_process=1')
      },
      {
        label: 'Versão',
        value: await one("select cast(serverproperty('ProductVersion') as nvarchar) v")
      }
    ]
  }

  async foreignKeys(): Promise<ForeignKey[]> {
    const res = await this.pool.request().query(
      `select pt.name as [table], pc.name as [column], rt.name as refTable, rc.name as refColumn
         from sys.foreign_key_columns fkc
         join sys.tables pt on pt.object_id=fkc.parent_object_id
         join sys.columns pc on pc.object_id=fkc.parent_object_id and pc.column_id=fkc.parent_column_id
         join sys.tables rt on rt.object_id=fkc.referenced_object_id
         join sys.columns rc on rc.object_id=fkc.referenced_object_id and rc.column_id=fkc.referenced_column_id`
    )
    return res.recordset as unknown as ForeignKey[]
  }

  async indexes(schema: string, table: string): Promise<IndexInfo[]> {
    const res = await this.params(
      `select i.name as name from sys.indexes i
         join sys.objects o on i.object_id=o.object_id
         join sys.schemas s on o.schema_id=s.schema_id
        where s.name=@schema and o.name=@table and i.name is not null`,
      { schema, table }
    )
    return (res.recordset as Record<string, string>[]).map((r) => ({ name: r.name }))
  }

  async routines(schema: string): Promise<RoutineInfo[]> {
    const res = await this.params(
      `select routine_name as name, routine_type as type from information_schema.routines
        where specific_schema=@schema order by routine_name`,
      { schema }
    )
    return res.recordset as unknown as RoutineInfo[]
  }

  async jobs(): Promise<JobInfo[]> {
    try {
      const res = await this.pool
        .request()
        .query(`select name, (enabled=1) as enabled from msdb.dbo.sysjobs order by name`)
      return (res.recordset as Record<string, unknown>[]).map((r) => ({
        name: r.name as string,
        enabled: !!r.enabled
      }))
    } catch {
      return []
    }
  }
}
