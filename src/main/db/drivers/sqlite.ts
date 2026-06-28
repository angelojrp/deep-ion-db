import Database from 'better-sqlite3'
import type {
  ColumnInfo,
  ConnectionConfig,
  Driver,
  ForeignKey,
  HealthMetric,
  IndexInfo,
  QueryResult,
  RoutineInfo,
  SchemaTable,
  SqlStatement
} from '../types'

import { BaseDriver } from './base'

export class SqliteDriver extends BaseDriver implements Driver {
  private db: Database.Database | null = null

  constructor(private config: ConnectionConfig) {
    super()
  }

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
      return this.normalizeQueryResult(
        columns,
        rows,
        rows.length,
        performance.now() - start,
        'SELECT'
      )
    }

    const info = stmt.run()
    return this.normalizeQueryResult([], [], info.changes, performance.now() - start, 'OK')
  }

  async primaryKeys(_schema: string, table: string): Promise<string[]> {
    const quoted = `"${table.replace(/"/g, '""')}"`
    const rows = this.handle.prepare(`PRAGMA table_info(${quoted})`).all() as {
      name: string
      pk: number
    }[]
    return rows
      .filter((r) => r.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((r) => r.name)
  }

  async execBatch(statements: SqlStatement[]): Promise<void> {
    const tx = this.handle.transaction((items: SqlStatement[]) => {
      for (const s of items) this.handle.prepare(s.sql).run(...(s.params as never[]))
    })
    tx(statements)
  }

  async killSession(): Promise<void> {
    throw new Error('SQLite (arquivo local) não possui sessões.')
  }

  async indexes(_schema: string, table: string): Promise<IndexInfo[]> {
    const quoted = `"${table.replace(/"/g, '""')}"`
    const rows = this.handle.prepare(`PRAGMA index_list(${quoted})`).all() as {
      name: string
      unique: number
    }[]
    return rows.map((r) => ({ name: r.name, detail: r.unique ? 'unique' : undefined }))
  }

  async routines(): Promise<RoutineInfo[]> {
    return []
  }

  async foreignKeys(): Promise<ForeignKey[]> {
    const tables = (
      this.handle
        .prepare(`select name from sqlite_master where type='table' and name not like 'sqlite_%'`)
        .all() as { name: string }[]
    ).map((r) => r.name)
    const fks: ForeignKey[] = []
    for (const t of tables) {
      const quoted = `"${t.replace(/"/g, '""')}"`
      const rows = this.handle.prepare(`PRAGMA foreign_key_list(${quoted})`).all() as {
        table: string
        from: string
        to: string
      }[]
      for (const r of rows) {
        fks.push({ table: t, column: r.from, refTable: r.table, refColumn: r.to })
      }
    }
    return fks
  }

  override async serverHealth(): Promise<HealthMetric[]> {
    const pageCount = Number(this.handle.pragma('page_count', { simple: true }))
    const pageSize = Number(this.handle.pragma('page_size', { simple: true }))
    const tables = (
      this.handle.prepare("select count(*) v from sqlite_master where type='table'").get() as {
        v: number
      }
    ).v
    return [
      { label: 'Tamanho (bytes)', value: String(pageCount * pageSize) },
      { label: 'Tabelas', value: String(tables) }
    ]
  }

  async tableDdl(_schema: string, table: string): Promise<string> {
    const row = this.handle
      .prepare(`select sql from sqlite_master where name = ? and type in ('table','view')`)
      .get(table) as { sql: string } | undefined
    return row?.sql ? `${row.sql};` : `-- DDL não encontrado para ${table}`
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
