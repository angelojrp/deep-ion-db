import oracledb from 'oracledb'
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

/** Driver Oracle via node-oracledb em thin mode (JS puro, sem Instant Client). */
export class OracleDriver extends BaseDriver implements Driver {
  private pool: oracledb.Pool | null = null
  private readonly config: ConnectionConfig

  constructor(config: ConnectionConfig) {
    super(config.queryTimeoutMs)
    this.config = config
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
    oracledb.fetchAsString = [oracledb.CLOB]
  }

  async connect(): Promise<void> {
    const host = this.config.host ?? 'localhost'
    const port = this.config.port ?? 1521
    const service = this.config.database ?? 'XEPDB1'
    this.pool = await oracledb.createPool({
      user: this.config.user,
      password: this.config.password,
      connectString: `${host}:${port}/${service}`,
      poolMin: 0,
      poolMax: 4
    })
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close(0)
      this.pool = null
    }
  }

  private get(): oracledb.Pool {
    if (!this.pool) throw new Error('Conexão Oracle não está aberta.')
    return this.pool
  }

  private async run<T = Record<string, unknown>>(
    text: string,
    binds: oracledb.BindParameters = {}
  ): Promise<oracledb.Result<T>> {
    const conn = await this.get().getConnection()
    try {
      return await conn.execute<T>(text, binds, { autoCommit: true })
    } finally {
      await conn.close()
    }
  }

  async query(text: string): Promise<QueryResult> {
    const start = performance.now()
    const conn = await this.get().getConnection()
    try {
      const res = await this.withTimeout(
        conn.execute(text, [], { autoCommit: true }),
        this.timeoutMs
      )
      const durationMs = performance.now() - start
      if (res.rows) {
        const columns = (res.metaData ?? []).map((m) => m.name)
        const rows = res.rows as Record<string, unknown>[]
        return this.normalizeQueryResult(columns, rows, rows.length, durationMs, 'SELECT')
      }
      return this.normalizeQueryResult([], [], res.rowsAffected ?? 0, durationMs, 'OK')
    } finally {
      await conn.close()
    }
  }

  async listTables(): Promise<SchemaTable[]> {
    const res = await this.run(
      `select owner as "schema", table_name as "name", 'BASE TABLE' as "type" from all_tables
        union all
       select owner as "schema", view_name as "name", 'VIEW' as "type" from all_views
        order by 1, 2`
    )
    return res.rows as unknown as SchemaTable[]
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const res = await this.run(
      `select column_name as "name", data_type as "dataType", nullable as "nullable"
         from all_tab_columns where owner = :schema and table_name = :table
        order by column_id`,
      { schema, table }
    )
    return (res.rows as Record<string, string>[]).map((r) => ({
      name: r.name,
      dataType: r.dataType,
      nullable: r.nullable === 'Y'
    }))
  }

  async primaryKeys(schema: string, table: string): Promise<string[]> {
    const res = await this.run(
      `select cols.column_name as "name"
         from all_constraints cons
         join all_cons_columns cols
           on cons.constraint_name = cols.constraint_name and cons.owner = cols.owner
        where cons.constraint_type = 'P' and cons.owner = :schema and cons.table_name = :table
        order by cols.position`,
      { schema, table }
    )
    return (res.rows as Record<string, string>[]).map((r) => r.name)
  }

  async execBatch(statements: SqlStatement[]): Promise<void> {
    const conn = await this.get().getConnection()
    try {
      for (const s of statements) {
        let i = 0
        const sqlText = s.sql.replace(/\?/g, () => `:p${i++}`)
        const binds: Record<string, unknown> = {}
        s.params.forEach((v, idx) => (binds[`p${idx}`] = v))
        await conn.execute(sqlText, binds as oracledb.BindParameters, { autoCommit: false })
      }
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      await conn.close()
    }
  }

  async tableDdl(schema: string, table: string): Promise<string> {
    try {
      const res = await this.run(
        `select dbms_metadata.get_ddl('TABLE', :table, :schema) as "ddl" from dual`,
        { schema, table }
      )
      const ddl = (res.rows as Record<string, string>[])[0]?.ddl
      if (ddl) return ddl.trim().endsWith(';') ? ddl.trim() : `${ddl.trim()};`
    } catch {
      /* sem privilégio em dbms_metadata — gera DDL básico a partir das colunas */
    }
    const cols = await this.listColumns(schema, table)
    const pk = await this.primaryKeys(schema, table)
    const lines = cols.map((c) => `  "${c.name}" ${c.dataType}${c.nullable ? '' : ' NOT NULL'}`)
    if (pk.length) lines.push(`  PRIMARY KEY (${pk.map((c) => `"${c}"`).join(', ')})`)
    return `CREATE TABLE "${schema}"."${table}" (\n${lines.join(',\n')}\n);`
  }

  async activeSessions(): Promise<SessionInfo[]> {
    try {
      const res = await this.run(
        `select sid || ',' || serial# as "pid", username as "user",
                sys_context('USERENV','DB_NAME') as "database", status as "state",
                sql_id as "query", null as "durationMs"
           from v$session where type = 'USER' and username is not null`
      )
      return res.rows as unknown as SessionInfo[]
    } catch {
      return []
    }
  }

  async killSession(pid: string | number): Promise<void> {
    await this.run(`alter system kill session '${String(pid)}' immediate`)
  }

  async listRoles(): Promise<RoleInfo[]> {
    const res = await this.run(
      `select username as "name", 1 as "canLogin" from all_users order by username`
    )
    return (res.rows as Record<string, unknown>[]).map((r) => ({
      name: r.name as string,
      canLogin: !!r.canLogin
    }))
  }

  async serverHealth(): Promise<HealthMetric[]> {
    const one = async (q: string): Promise<string> => {
      try {
        const r = await this.run(q)
        return String((r.rows as Record<string, unknown>[])[0]?.v ?? '-')
      } catch {
        return '-'
      }
    }
    return [
      {
        label: 'Sessões de usuário',
        value: await one(`select count(*) as "v" from v$session where type = 'USER'`)
      },
      { label: 'Versão', value: await one(`select version as "v" from v$instance`) }
    ]
  }

  async foreignKeys(): Promise<ForeignKey[]> {
    try {
      const res = await this.run(
        `select ac.table_name as "table", acc.column_name as "column",
                rac.table_name as "refTable", racc.column_name as "refColumn"
           from all_constraints ac
           join all_cons_columns acc
             on ac.constraint_name = acc.constraint_name and ac.owner = acc.owner
           join all_constraints rac
             on ac.r_constraint_name = rac.constraint_name and ac.r_owner = rac.owner
           join all_cons_columns racc
             on rac.constraint_name = racc.constraint_name and rac.owner = racc.owner
            and racc.position = acc.position
          where ac.constraint_type = 'R'
            and ac.owner = sys_context('USERENV','CURRENT_SCHEMA')`
      )
      return res.rows as unknown as ForeignKey[]
    } catch {
      return []
    }
  }

  async indexes(schema: string, table: string): Promise<IndexInfo[]> {
    const res = await this.run(
      `select index_name as "name" from all_indexes
        where owner = :schema and table_name = :table order by index_name`,
      { schema, table }
    )
    return (res.rows as Record<string, string>[]).map((r) => ({ name: r.name }))
  }

  async routines(schema: string): Promise<RoutineInfo[]> {
    const res = await this.run(
      `select object_name as "name", object_type as "type" from all_objects
        where owner = :schema and object_type in ('PROCEDURE','FUNCTION','PACKAGE')
        order by object_name`,
      { schema }
    )
    return res.rows as unknown as RoutineInfo[]
  }

  async jobs(): Promise<JobInfo[]> {
    try {
      const res = await this.run(
        `select job_name as "name", case when enabled = 'TRUE' then 1 else 0 end as "enabled"
           from all_scheduler_jobs order by job_name`
      )
      return (res.rows as Record<string, unknown>[]).map((r) => ({
        name: r.name as string,
        enabled: !!r.enabled
      }))
    } catch {
      return []
    }
  }
}
