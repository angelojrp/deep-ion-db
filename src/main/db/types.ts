import type { ColumnInfo, QueryResult, SchemaTable } from '@shared/types'

import type { SqlStatement } from '@shared/types'

export type {
  ColumnInfo,
  ConnectionConfig,
  HistoryEntry,
  HistoryInput,
  QueryResult,
  SavedConnection,
  SchemaTable,
  SqlStatement,
  Workspace,
  WsEntry
} from '@shared/types'

/** Contrato implementado por cada driver de banco. */
export interface Driver {
  connect(): Promise<void>
  disconnect(): Promise<void>
  query(sql: string): Promise<QueryResult>
  listTables(): Promise<SchemaTable[]>
  listColumns(schema: string, table: string): Promise<ColumnInfo[]>
  primaryKeys(schema: string, table: string): Promise<string[]>
  execBatch(statements: SqlStatement[]): Promise<void>
  tableDdl(schema: string, table: string): Promise<string>
}
