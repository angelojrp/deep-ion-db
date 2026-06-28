import { type FormEvent, type JSX, useState } from 'react'
import type {
  ConnectionConfig,
  ConnectionSummary,
  DbKind,
  SavedConnection,
  Workspace,
  WsEntry
} from '@shared/types'
import DatabaseExplorer from './DatabaseExplorer'
import WorkspacePanel from './WorkspacePanel'

interface Props {
  connections: ConnectionSummary[]
  saved: SavedConnection[]
  activeId: string | null
  workspace: Workspace | null
  onConnect: (config: ConnectionConfig, persist: boolean) => Promise<void>
  onConnectSaved: (saved: SavedConnection) => Promise<void>
  onDeleteSaved: (id: string) => void
  onSelect: (id: string) => void
  onDisconnect: (id: string) => void
  onInsertSql: (sql: string) => void
  onOpenWorkspace: () => void
  onRefreshWorkspace: () => void
  onOpenFile: (entry: WsEntry) => void
  onNewFile: (dir: string) => void
  onDeleteFile: (entry: WsEntry) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

const DEFAULT_PORT: Record<DbKind, string> = {
  postgres: '5432',
  mysql: '3306',
  sqlite: '',
  mssql: '1433',
  oracle: '1521'
}

export default function Sidebar({
  connections,
  saved,
  activeId,
  workspace,
  onConnect,
  onConnectSaved,
  onDeleteSaved,
  onSelect,
  onDisconnect,
  onInsertSql,
  onOpenWorkspace,
  onRefreshWorkspace,
  onOpenFile,
  onNewFile,
  onDeleteFile,
  theme,
  onToggleTheme
}: Props): JSX.Element {
  const hasAny = connections.length > 0 || saved.length > 0
  const [showForm, setShowForm] = useState(!hasAny)
  const [kind, setKind] = useState<DbKind>('postgres')
  const [name, setName] = useState('')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('5432')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [database, setDatabase] = useState('')
  const [filePath, setFilePath] = useState('')
  const [persist, setPersist] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function changeKind(next: DbKind): void {
    setKind(next)
    if (next !== 'sqlite') setPort(DEFAULT_PORT[next])
  }

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setConnecting(true)
    setFormError(null)

    const config: ConnectionConfig = {
      id: crypto.randomUUID(),
      name: name || (kind === 'sqlite' ? filePath || 'sqlite' : `${user}@${host}/${database}`),
      kind,
      host,
      port: Number(port) || undefined,
      user,
      password,
      database,
      filePath: kind === 'sqlite' ? filePath : undefined
    }

    try {
      await onConnect(config, persist)
      setShowForm(false)
      setName('')
      setPassword('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h1 className="brand">
          <img className="brand-logo" src="/icon.png" alt="" width={22} height={22} />
          Deep Ion DB
        </h1>
        <span className="head-actions">
          <button
            className="icon-btn"
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
          <button
            className="icon-btn"
            title={showForm ? 'Fechar' : 'Nova conexão'}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '×' : '＋'}
          </button>
        </span>
      </div>

      {showForm && (
        <form className="conn-form" onSubmit={submit}>
          <label>
            Tipo
            <select value={kind} onChange={(e) => changeKind(e.target.value as DbKind)}>
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL / MariaDB</option>
              <option value="sqlite">SQLite</option>
              <option value="mssql">SQL Server</option>
              <option value="oracle">Oracle</option>
            </select>
          </label>

          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="opcional" />
          </label>

          {kind === 'sqlite' ? (
            <label>
              Arquivo
              <input
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="/caminho/banco.db"
              />
            </label>
          ) : (
            <>
              <label>
                Host
                <input value={host} onChange={(e) => setHost(e.target.value)} />
              </label>
              <label>
                Porta
                <input value={port} onChange={(e) => setPort(e.target.value)} />
              </label>
              <label>
                Usuário
                <input value={user} onChange={(e) => setUser(e.target.value)} />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                Database
                <input value={database} onChange={(e) => setDatabase(e.target.value)} />
              </label>
            </>
          )}

          <label className="checkbox">
            <input
              type="checkbox"
              checked={persist}
              onChange={(e) => setPersist(e.target.checked)}
            />
            Salvar conexão (senha criptografada)
          </label>

          <button type="submit" disabled={connecting}>
            {connecting ? 'Conectando…' : 'Conectar'}
          </button>
          {formError && <p className="form-error">{formError}</p>}
        </form>
      )}

      <WorkspacePanel
        workspace={workspace}
        onOpen={onOpenWorkspace}
        onRefresh={onRefreshWorkspace}
        onOpenFile={onOpenFile}
        onNewFile={onNewFile}
        onDelete={onDeleteFile}
      />

      <DatabaseExplorer
        connections={connections}
        saved={saved}
        activeId={activeId}
        onConnectSaved={onConnectSaved}
        onSelect={onSelect}
        onDisconnect={onDisconnect}
        onDeleteSaved={onDeleteSaved}
        onInsertSql={onInsertSql}
      />
    </aside>
  )
}
