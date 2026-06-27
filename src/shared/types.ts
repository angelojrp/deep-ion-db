/** Tipos compartilhados entre main, preload e renderer. */

export type DbKind = 'postgres' | 'mysql' | 'sqlite'

export interface ConnectionConfig {
  id: string
  name: string
  kind: DbKind
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  /** Caminho do arquivo para SQLite. */
  filePath?: string
  ssl?: boolean
}

export interface QueryResult {
  /** Nomes das colunas, na ordem retornada. */
  columns: string[]
  /** Linhas como objetos chaveados pelo nome da coluna. */
  rows: Record<string, unknown>[]
  /** Linhas retornadas (SELECT) ou afetadas (INSERT/UPDATE/DELETE). */
  rowCount: number
  /** Duração da execução em milissegundos. */
  durationMs: number
  /** Comando executado, quando disponível (ex.: SELECT, INSERT, OK). */
  command?: string
}

export interface SchemaTable {
  schema: string
  name: string
  type: string
}

export interface ColumnInfo {
  name: string
  dataType: string
  nullable: boolean
}

/** Superfície exposta ao renderer via contextBridge. */
export interface DbApi {
  connect(config: ConnectionConfig): Promise<{ id: string }>
  disconnect(id: string): Promise<void>
  query(id: string, sql: string): Promise<QueryResult>
  listTables(id: string): Promise<SchemaTable[]>
  listColumns(id: string, schema: string, table: string): Promise<ColumnInfo[]>
}

export interface AppApi {
  db: DbApi
}
