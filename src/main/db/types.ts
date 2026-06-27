import type { ColumnInfo, QueryResult, SchemaTable } from '@shared/types'

export type {
  ColumnInfo,
  ConnectionConfig,
  QueryResult,
  SavedConnection,
  SchemaTable,
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
}
