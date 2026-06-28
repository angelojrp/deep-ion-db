/** Tipos compartilhados entre main, preload e renderer. */

export type DbKind = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'oracle'

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

/** Resumo de uma conexão ativa para exibição na UI. */
export interface ConnectionSummary {
  id: string
  name: string
  kind: DbKind
}

/** Conexão persistida (metadados, sem senha em texto puro). */
export interface SavedConnection {
  id: string
  name: string
  kind: DbKind
  host?: string
  port?: number
  user?: string
  database?: string
  filePath?: string
  ssl?: boolean
}

/** Statement parametrizado (placeholders por dialeto) para aplicação transacional. */
export interface SqlStatement {
  sql: string
  params: unknown[]
}

/** Métrica de saúde do servidor (dashboard). */
export interface HealthMetric {
  label: string
  value: string
}

export interface IndexInfo {
  name: string
  detail?: string
}

export interface RoutineInfo {
  name: string
  type: string
}

export interface JobInfo {
  name: string
  schedule?: string
  command?: string
  enabled?: boolean
}

/** Chave estrangeira (para diagrama ER). */
export interface ForeignKey {
  table: string
  column: string
  refTable: string
  refColumn: string
}

/** Usuário/role do servidor de banco. */
export interface RoleInfo {
  name: string
  canLogin?: boolean
  isSuper?: boolean
}

/** Sessão/atividade ativa no servidor de banco. */
export interface SessionInfo {
  pid: string | number
  user: string | null
  database: string | null
  state: string | null
  query: string | null
  durationMs: number | null
}

/** Superfície exposta ao renderer via contextBridge. */
export interface DbApi {
  connect(config: ConnectionConfig): Promise<{ id: string }>
  disconnect(id: string): Promise<void>
  query(id: string, sql: string): Promise<QueryResult>
  listTables(id: string): Promise<SchemaTable[]>
  listColumns(id: string, schema: string, table: string): Promise<ColumnInfo[]>
  primaryKeys(id: string, schema: string, table: string): Promise<string[]>
  execBatch(id: string, statements: SqlStatement[]): Promise<void>
  tableDdl(id: string, schema: string, table: string): Promise<string>
  activeSessions(id: string): Promise<SessionInfo[]>
  killSession(id: string, pid: string | number): Promise<void>
  listRoles(id: string): Promise<RoleInfo[]>
  serverHealth(id: string): Promise<HealthMetric[]>
  foreignKeys(id: string): Promise<ForeignKey[]>
  indexes(id: string, schema: string, table: string): Promise<IndexInfo[]>
  routines(id: string, schema: string): Promise<RoutineInfo[]>
  jobs(id: string): Promise<JobInfo[]>
  backup(id: string): Promise<{ ok: boolean; path?: string; error?: string }>
}

/** Gerência de conexões salvas (senha guardada com segurança no main). */
export interface ConnApi {
  list(): Promise<SavedConnection[]>
  save(config: ConnectionConfig): Promise<SavedConnection>
  remove(id: string): Promise<void>
  connect(id: string): Promise<{ id: string }>
}

/** Entrada (arquivo ou pasta) na árvore de um workspace. */
export interface WsEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: WsEntry[]
}

export interface Workspace {
  root: string
  tree: WsEntry[]
}

/** Workspace local: pasta com arquivos .sql/.md, estilo projeto. */
export interface WsApi {
  open(): Promise<Workspace | null>
  current(): Promise<Workspace | null>
  refresh(): Promise<Workspace | null>
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  create(dir: string, name: string): Promise<WsEntry>
  remove(path: string): Promise<void>
  saveAs(defaultName: string, content: string): Promise<string | null>
  openFile(): Promise<{ name: string; content: string } | null>
}

/** Entrada do histórico de execução de queries. */
export interface HistoryEntry {
  id: string
  sql: string
  connectionName: string
  kind?: DbKind
  ts: number
  durationMs: number
  rowCount: number
  ok: boolean
  favorite: boolean
}

export type HistoryInput = Omit<HistoryEntry, 'id' | 'favorite'>

export interface HistApi {
  list(): Promise<HistoryEntry[]>
  add(entry: HistoryInput): Promise<HistoryEntry>
  toggleFavorite(id: string): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

/** Integração com IA (épico #3). */
export type AIProviderKind = 'anthropic' | 'openai'

export interface AIPublicConfig {
  kind: AIProviderKind
  model: string
  baseUrl?: string
  hasKey: boolean
}

export interface AiSettingsInput {
  kind: AIProviderKind
  model?: string
  baseUrl?: string
  apiKey?: string
}

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiApi {
  getConfig(): Promise<AIPublicConfig | null>
  setConfig(input: AiSettingsInput): Promise<AIPublicConfig>
  chat(messages: AiChatMessage[], system?: string): Promise<string>
}

export interface AppApi {
  db: DbApi
  conn: ConnApi
  ws: WsApi
  hist: HistApi
  ai: AiApi
}
