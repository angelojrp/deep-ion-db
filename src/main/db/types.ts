import type { ColumnInfo, QueryResult, SchemaTable } from '@shared/types'

import type {
  ForeignKey,
  HealthMetric,
  IndexInfo,
  JobInfo,
  RoleInfo,
  RoutineInfo,
  SessionInfo,
  SqlStatement
} from '@shared/types'

export type {
  ColumnInfo,
  ConnectionConfig,
  ForeignKey,
  HealthMetric,
  HistoryEntry,
  HistoryInput,
  IndexInfo,
  JobInfo,
  QueryResult,
  RoleInfo,
  RoutineInfo,
  SavedConnection,
  SchemaTable,
  SessionInfo,
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
  activeSessions(): Promise<SessionInfo[]>
  killSession(pid: string | number): Promise<void>
  listRoles(): Promise<RoleInfo[]>
  serverHealth(): Promise<HealthMetric[]>
  foreignKeys(): Promise<ForeignKey[]>
  indexes(schema: string, table: string): Promise<IndexInfo[]>
  routines(schema: string): Promise<RoutineInfo[]>
  jobs(): Promise<JobInfo[]>
  /** Cancela a query em execução no momento (se suportado pelo banco). */
  cancel?(): Promise<void>
  /** Capacidades específicas do driver. */
  capabilities?: { cancelQuery: boolean }
}
