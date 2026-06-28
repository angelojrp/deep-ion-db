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
  /**
   * Controla `rejectUnauthorized` na conexão TLS com Postgres.
   * Padrão: `true` (seguro). Setar como `false` apenas em ambientes de desenvolvimento/teste,
   * pois desabilita a verificação do certificado do servidor.
   */
  sslRejectUnauthorized?: boolean
  /** Timeout de execução de query em milissegundos (padrão: 30 000). */
  queryTimeoutMs?: number
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
  /** Indica que o resultado foi truncado ao teto de linhas configurado. */
  truncated?: boolean
  /** Total de linhas antes do truncamento (apenas quando truncated = true). */
  totalRows?: number
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
export type AIProviderKind = 'anthropic' | 'openai' | 'gemini' | 'local'

export interface AIPublicConfig {
  kind: AIProviderKind
  model: string
  baseUrl?: string
  hasKey: boolean
  /** Enviar schema/DDL como contexto para a IA (padrão: true). */
  sendSchema: boolean
  /** Enviar plano de EXPLAIN como contexto para a IA (padrão: true). */
  sendExplain: boolean
  /** Usuário aceitou o aviso de privacidade antes de enviar dados a um provedor cloud. */
  consentGiven: boolean
}

export interface AiSettingsInput {
  kind: AIProviderKind
  model?: string
  baseUrl?: string
  apiKey?: string
  /** Controla envio de schema/DDL. */
  sendSchema?: boolean
  /** Controla envio de plano EXPLAIN. */
  sendExplain?: boolean
}

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiApi {
  getConfig(): Promise<AIPublicConfig | null>
  setConfig(input: AiSettingsInput): Promise<AIPublicConfig>
  chat(messages: AiChatMessage[], system?: string): Promise<string>
  /** Registra o aceite do aviso de privacidade para o provedor cloud atual. */
  setConsent(): Promise<AIPublicConfig>
  /** Inicia streaming; tokens chegam via `onToken`. */
  stream(messages: AiChatMessage[], system?: string): Promise<void>
  /** Cancela o streaming em andamento. */
  cancelStream(): Promise<void>
  /** Registra callback para tokens recebidos; retorna função de limpeza. */
  onToken(cb: (token: string) => void): () => void
  /** Registra callback de conclusão do streaming; retorna função de limpeza. */
  onStreamDone(cb: () => void): () => void
  /** Registra callback de erro do streaming; retorna função de limpeza. */
  onStreamError(cb: (msg: string) => void): () => void
}

/** API do servidor MCP embutido (issue #146). */
export interface McpApi {
  start(connectionId: string): Promise<{ port: number }>
  stop(): Promise<void>
  status(): Promise<{ running: boolean; port?: number; kind?: DbKind; connectionId?: string }>
}

export interface AppApi {
  db: DbApi
  conn: ConnApi
  ws: WsApi
  hist: HistApi
  ai: AiApi
  mcp: McpApi
}

/**
 * Modo servidor (#123): o desktop atua como thin client de um servidor web
 * Deep Ion DB. As credenciais dos bancos ficam no servidor; o desktop só
 * conhece o ID do data source e envia SQL para execução remota (proxy).
 */

/** Sessão de servidor salva no desktop (para reconectar rapidamente). */
export interface ServerSession {
  id: string
  label: string
  serverUrl: string
}

/** Config pública de auth do servidor (GET /api/auth/config). */
export interface ServerAuthConfig {
  authDisabled: boolean
  issuer: string | null
  audience: string | null
}

/** Resultado de uma tentativa de login OIDC no servidor. */
export interface ServerLoginResult {
  ok: boolean
  authDisabled: boolean
  error?: string
}

/**
 * Ponte (preload) do modo servidor: descoberta de auth, login OIDC via
 * navegador externo + protocol handler (`deepion://callback`), token guardado
 * com segurança (safeStorage) e persistência de sessões de servidor.
 */
export interface ServerAuthApi {
  /** Descobre a config de auth do servidor. */
  config(serverUrl: string): Promise<ServerAuthConfig>
  /** Inicia o login OIDC; resolve quando o callback do navegador chega. */
  login(serverUrl: string): Promise<ServerLoginResult>
  /** Token de acesso atual para o servidor (`''` quando auth está desabilitada; `null` se não autenticado). */
  token(serverUrl: string): Promise<string | null>
  /** Esquece o token do servidor (logout). */
  logout(serverUrl: string): Promise<void>
  /** Sessões de servidor salvas. */
  listSessions(): Promise<ServerSession[]>
  /** Salva (ou atualiza) uma sessão de servidor. */
  saveSession(label: string, serverUrl: string): Promise<ServerSession>
  /** Remove uma sessão de servidor salva. */
  removeSession(id: string): Promise<void>
}

/**
 * Capacidades do ambiente em que a UI roda (arquitetura unificada desktop/web).
 * A mesma UI é renderizada nos dois; cada recurso é mostrado/ocultado por capability.
 * Desktop (Electron) e web (HTTP) injetam conjuntos diferentes.
 */
export interface Capabilities {
  /** Criar/editar conexões ad-hoc (host/usuário/senha). Desktop: sim; web: não. */
  adHocConnections: boolean
  /** Lista de conexões vem gerenciada do servidor (data sources). Web: sim. */
  managedDataSources: boolean
  /** Pasta de projeto local com arquivos .sql/.md (workspace). Desktop: sim. */
  workspaceFiles: boolean
  /** Backup do banco (pg_dump/mysqldump/cópia). Desktop: sim. */
  backup: boolean
  /** Sessões ativas no servidor. */
  sessions: boolean
  /** Usuários/roles do servidor. */
  roles: boolean
  /** Dashboard de saúde do servidor. */
  health: boolean
  /** Jobs agendados. */
  jobs: boolean
  /** Diagrama ER (engenharia reversa por FKs). */
  erDiagram: boolean
  /** Comparação (diff) de schemas entre conexões. */
  schemaDiff: boolean
  /** Edição inline de dados na grade (CRUD). */
  editableGrid: boolean
  /** Histórico de execução de queries. */
  history: boolean
  /** Integração com IA (assistente, NL→SQL, etc.). */
  ai: boolean
  /** Exportar resultados para arquivo (salvar como). */
  exportResults: boolean
  /** Pode conectar a um servidor web e operar como thin client (#123). Desktop: sim. */
  serverMode: boolean
}
