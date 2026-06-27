import Database from 'better-sqlite3'
import type { ColumnInfo, ConnectionConfig, Driver, QueryResult, SchemaTable } from '../types'

export class SqliteDriver implements Driver {
  private db: Database.Database | null = null

  constructor(private config: ConnectionConfig) {}

  async connect(): Promise<void> {
    if (!this.config.filePath) {
      throw new Error('Caminho do arquivo SQLite é obrigatório.')
    }
    this.db = new Database(this.config.filePath)
  }

  async disconnect(): Promise<void> {
    this.db?.close()
    this.db = null
  }

  private get handle(): Database.Database {
    if (!this.db) throw new Error('Banco SQLite não inicializado.')
    return this.db
  }

  async query(sql: string): Promise<QueryResult> {
    const start = performance.now()
    const stmt = this.handle.prepare(sql)

    if (stmt.reader) {
      const rows = stmt.all() as Record<string, unknown>[]
      const columns = stmt.columns().map((c) => c.name)
      return {
        columns,
        rows,
        rowCount: rows.length,
        durationMs: performance.now() - start,
        command: 'SELECT'
      }
    }

    const info = stmt.run()
    return {
      columns: [],
      rows: [],
      rowCount: info.changes,
      durationMs: performance.now() - start,
      command: 'OK'
    }
  }

  async listTables(): Promise<SchemaTable[]> {
    const rows = this.handle
      .prepare(
        `select name, type from sqlite_master
          where type in ('table', 'view') and name not like 'sqlite_%'
          order by name`
      )
      .all() as { name: string; type: string }[]
    return rows.map((r) => ({ schema: 'main', name: r.name, type: r.type }))
  }

  async listColumns(_schema: string, table: string): Promise<ColumnInfo[]> {
    const quoted = `"${table.replace(/"/g, '""')}"`
    const rows = this.handle.prepare(`PRAGMA table_info(${quoted})`).all() as {
      name: string
      type: string
      notnull: number
    }[]
    return rows.map((r) => ({
      name: r.name,
      dataType: r.type,
      nullable: r.notnull === 0
    }))
  }
}
