import { Client } from 'pg'
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

  async activeSessions(): Promise<SessionInfo[]> {
    const res = await this.client.query(
      `select pid, usename as "user", datname as database, state, query,
              extract(epoch from (now() - query_start)) * 1000 as "durationMs"
         from pg_stat_activity
        where pid <> pg_backend_pid()
        order by query_start nulls last`
    )
    return res.rows.map((r) => ({
      pid: r.pid,
      user: r.user ?? null,
      database: r.database ?? null,
      state: r.state ?? null,
      query: r.query ?? null,
      durationMs: r.durationMs != null ? Math.round(Number(r.durationMs)) : null
    }))
  }

  async killSession(pid: string | number): Promise<void> {
    await this.client.query('select pg_terminate_backend($1)', [pid])
  }

  async serverHealth(): Promise<HealthMetric[]> {
    const one = async (sql: string): Promise<string> =>
      String((await this.client.query(sql)).rows[0]?.v ?? '-')
    return [
      {
        label: 'Conexões ativas',
        value: await one('select count(*)::int v from pg_stat_activity')
      },
      {
        label: 'Tamanho do banco',
        value: await one('select pg_size_pretty(pg_database_size(current_database())) v')
      },
      {
        label: 'Cache hit %',
        value: await one(
          'select round(100*sum(blks_hit)/nullif(sum(blks_hit+blks_read),0),2) v from pg_stat_database'
        )
      },
      {
        label: 'Uptime',
        value: await one("select date_trunc('second', now()-pg_postmaster_start_time())::text v")
      }
    ]
  }

  async foreignKeys(): Promise<ForeignKey[]> {
    const res = await this.client.query(
      `select tc.table_name as "table", kcu.column_name as "column",
              ccu.table_name as "refTable", ccu.column_name as "refColumn"
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
         join information_schema.constraint_column_usage ccu
           on ccu.constraint_name = tc.constraint_name
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_schema not in ('pg_catalog', 'information_schema')`
    )
    return res.rows as ForeignKey[]
  }

  async listRoles(): Promise<RoleInfo[]> {
    const res = await this.client.query(
      `select rolname as name, rolcanlogin as "canLogin", rolsuper as "isSuper"
         from pg_roles order by rolname`
    )
    return res.rows.map((r) => ({
      name: r.name,
      canLogin: r.canLogin,
      isSuper: r.isSuper
    }))
  }

  async tableDdl(schema: string, table: string): Promise<string> {
    const cols = await this.listColumns(schema, table)
    const pk = await this.primaryKeys(schema, table)
    const lines = cols.map((c) => `  "${c.name}" ${c.dataType}${c.nullable ? '' : ' NOT NULL'}`)
    if (pk.length) lines.push(`  PRIMARY KEY (${pk.map((c) => `"${c}"`).join(', ')})`)
    return `CREATE TABLE "${schema}"."${table}" (\n${lines.join(',\n')}\n);`
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
