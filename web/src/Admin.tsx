import { type JSX, useCallback, useEffect, useState } from 'react'
import { ConfirmModal, Modal } from './Modal'

interface DataSource {
  id: string
  name: string
  kind: string
  host: string | null
  port: number | null
  database: string | null
  username: string | null
  ssl: boolean
  environment: string
}

interface User {
  id: string
  email: string | null
  name: string | null
  role: string
  created_at: string
}

interface Grant {
  id: string
  user_id: string
  data_source_id: string
  mode: string
  created_at: string
  expires_at: string | null
  suspended: boolean
  expired: boolean
}

interface AuditEntry {
  id: number
  ts: string
  user_id: string | null
  email: string | null
  data_source_id: string | null
  action: string
  detail: unknown
}

interface AuditPage {
  entries: AuditEntry[]
  total: number
  page: number
  pageSize: number
}

type Tab = 'data-sources' | 'users' | 'grants' | 'audit'

const DB_ICONS: Record<string, string> = {
  postgres: '🐘',
  mysql: '🐬',
  sqlite: '📄',
  mssql: '🪟',
  oracle: '🔶'
}

const DB_LABELS: Record<string, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  mssql: 'SQL Server',
  oracle: 'Oracle'
}

const DEFAULT_PORTS: Record<string, string> = {
  postgres: '5432',
  mysql: '3306',
  mssql: '1433',
  oracle: '1521',
  sqlite: ''
}

function token(): string {
  return localStorage.getItem('token') ?? ''
}

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const t = token()
  const res = await fetch(path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(t ? { authorization: `Bearer ${t}` } : {}),
      ...(opts.headers ?? {})
    }
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const msg = (data && (data as { error?: string }).error) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data as T
}

// ---------- Data Sources tab ----------

interface DsForm {
  name: string
  kind: string
  host: string
  port: string
  database: string
  username: string
  password: string
  ssl: boolean
  environment: string
}

const emptyDsForm = (): DsForm => ({
  name: '',
  kind: 'postgres',
  host: '',
  port: '5432',
  database: '',
  username: '',
  password: '',
  ssl: false,
  environment: 'nonprod'
})

function DataSourceForm({
  form,
  setForm,
  editing,
  onSave,
  onClose,
  error
}: {
  form: DsForm
  setForm: (fn: (f: DsForm) => DsForm) => void
  editing: DataSource | null
  onSave: () => Promise<void>
  onClose: () => void
  error: string | null
}): JSX.Element {
  const isSqlite = form.kind === 'sqlite'
  const needsServer = !isSqlite

  function handleKindChange(kind: string): void {
    setForm((f) => ({
      ...f,
      kind,
      port: DEFAULT_PORTS[kind] ?? '',
      host: kind === 'sqlite' ? '' : f.host
    }))
  }

  return (
    <Modal
      title={editing ? 'Editar Data Source' : 'Novo Data Source'}
      onClose={onClose}
      width={580}
    >
      {error && <div className="admin-error">{error}</div>}
      <div className="modal-form">
        <div className="modal-form-section">
          <div className="modal-form-row">
            <label className="modal-label">
              Nome do data source
              <input
                className="modal-input"
                placeholder="ex: prod-postgres, analytics-db"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </label>
            <label className="modal-label modal-label-narrow">
              Ambiente
              <select
                className="modal-input"
                value={form.environment}
                onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
              >
                <option value="nonprod">não-produção</option>
                <option value="prod">produção</option>
              </select>
            </label>
          </div>
        </div>

        <div className="modal-form-section">
          <div className="modal-section-label">Tipo de banco</div>
          <div className="db-kind-grid">
            {Object.entries(DB_LABELS).map(([k, label]) => (
              <button
                key={k}
                className={`db-kind-btn${form.kind === k ? ' selected' : ''}`}
                onClick={() => handleKindChange(k)}
                type="button"
              >
                <span className="db-kind-icon">{DB_ICONS[k]}</span>
                <span className="db-kind-label">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {isSqlite ? (
          <div className="modal-form-section">
            <div className="modal-section-label">Arquivo</div>
            <label className="modal-label">
              Caminho do arquivo .db
              <input
                className="modal-input"
                placeholder="/caminho/para/banco.db"
                value={form.database}
                onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
              />
            </label>
            <p className="form-hint">
              Caminho absoluto para o arquivo SQLite no sistema de arquivos.
            </p>
          </div>
        ) : (
          <>
            <div className="modal-form-section">
              <div className="modal-section-label">Conexão</div>
              <div className="modal-form-row">
                <label className="modal-label">
                  Host
                  <input
                    className="modal-input"
                    placeholder="localhost"
                    value={form.host}
                    onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  />
                </label>
                <label className="modal-label modal-label-port">
                  Porta
                  <input
                    className="modal-input"
                    type="number"
                    placeholder={DEFAULT_PORTS[form.kind] ?? ''}
                    value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                  />
                </label>
              </div>
              <label className="modal-label">
                Banco (database)
                <input
                  className="modal-input"
                  placeholder="nome_do_banco"
                  value={form.database}
                  onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
                />
              </label>
            </div>

            {needsServer && (
              <div className="modal-form-section">
                <div className="modal-section-label">Credenciais</div>
                <div className="modal-form-row">
                  <label className="modal-label">
                    Usuário
                    <input
                      className="modal-input"
                      placeholder="usuario"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    />
                  </label>
                  <label className="modal-label">
                    Senha{editing ? ' (deixar vazio para manter)' : ''}
                    <input
                      className="modal-input"
                      type="password"
                      placeholder={editing ? '••••••••' : 'senha'}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="modal-label modal-label-check">
                  <input
                    type="checkbox"
                    checked={form.ssl}
                    onChange={(e) => setForm((f) => ({ ...f, ssl: e.target.checked }))}
                  />
                  Usar SSL/TLS
                </label>
              </div>
            )}
          </>
        )}
      </div>

      <div className="admin-form-actions">
        <button
          className="run-btn"
          onClick={onSave}
          disabled={!form.name || (!isSqlite && !form.host)}
        >
          {editing ? 'Salvar alterações' : 'Criar data source'}
        </button>
        <button className="ghost-btn" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Modal>
  )
}

function DataSourcesTab(): JSX.Element {
  const [sources, setSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DataSource | null>(null)
  const [testResult, setTestResult] = useState<Record<string, string>>({})
  const [confirmRemove, setConfirmRemove] = useState<DataSource | null>(null)
  const [form, setForm] = useState<DsForm>(emptyDsForm)

  const load = useCallback(async () => {
    try {
      const data = await api<{ dataSources: DataSource[] }>('/api/data-sources')
      setSources(data.dataSources)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openNew(): void {
    setEditing(null)
    setForm(emptyDsForm())
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(ds: DataSource): void {
    setEditing(ds)
    setForm({
      name: ds.name,
      kind: ds.kind,
      host: ds.host ?? '',
      port: String(ds.port ?? DEFAULT_PORTS[ds.kind] ?? ''),
      database: ds.database ?? '',
      username: ds.username ?? '',
      password: '',
      ssl: ds.ssl,
      environment: ds.environment
    })
    setFormError(null)
    setShowForm(true)
  }

  async function save(): Promise<void> {
    setFormError(null)
    const body = {
      name: form.name,
      kind: form.kind,
      host: form.host || undefined,
      port: form.port ? Number(form.port) : undefined,
      database: form.database || undefined,
      username: form.username || undefined,
      password: form.password || undefined,
      ssl: form.ssl,
      environment: form.environment
    }
    try {
      if (editing) {
        await api(`/api/data-sources/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body)
        })
      } else {
        await api('/api/data-sources', { method: 'POST', body: JSON.stringify(body) })
      }
      setShowForm(false)
      setLoading(true)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e))
    }
  }

  async function testConn(id: string): Promise<void> {
    setTestResult((r) => ({ ...r, [id]: 'testando…' }))
    try {
      await api(`/api/data-sources/${id}/test`, { method: 'POST' })
      setTestResult((r) => ({ ...r, [id]: '✓ OK' }))
    } catch (e) {
      setTestResult((r) => ({ ...r, [id]: e instanceof Error ? e.message : 'erro' }))
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await api(`/api/data-sources/${id}`, { method: 'DELETE' })
      setConfirmRemove(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (loading) return <p className="admin-loading">Carregando…</p>

  return (
    <div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-section-bar">
        <h3>
          Data Sources<span className="admin-count">{sources.length}</span>
        </h3>
        <button className="run-btn" onClick={openNew}>
          + Novo Data Source
        </button>
      </div>

      {showForm && (
        <DataSourceForm
          form={form}
          setForm={setForm}
          editing={editing}
          onSave={save}
          onClose={() => setShowForm(false)}
          error={formError}
        />
      )}

      {confirmRemove && (
        <ConfirmModal
          title="Remover data source"
          description={`Remover "${confirmRemove.name}"? Esta ação também removerá todos os grants associados e não pode ser desfeita.`}
          confirmLabel="Remover"
          danger
          onConfirm={() => void remove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {sources.length === 0 ? (
        <div className="admin-empty-state">
          <div className="admin-empty-icon">🗄️</div>
          <div className="admin-empty-title">Nenhum data source cadastrado</div>
          <div className="admin-empty-desc">
            Adicione uma conexão de banco de dados para começar.
          </div>
          <button className="run-btn" onClick={openNew}>
            + Novo Data Source
          </button>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Host</th>
                <th>Banco</th>
                <th>Ambiente</th>
                <th>SSL</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((ds) => (
                <tr key={ds.id}>
                  <td className="ds-name-cell">
                    <span className="ds-icon">{DB_ICONS[ds.kind] ?? '🗄️'}</span>
                    {ds.name}
                  </td>
                  <td>{DB_LABELS[ds.kind] ?? ds.kind}</td>
                  <td>
                    {ds.host ?? '—'}
                    {ds.port ? `:${ds.port}` : ''}
                  </td>
                  <td>{ds.database ?? '—'}</td>
                  <td>
                    <span className={ds.environment === 'prod' ? 'badge-prod' : 'badge-dev'}>
                      {ds.environment === 'prod' ? 'produção' : 'não-prod'}
                    </span>
                  </td>
                  <td>{ds.ssl ? '✓' : '—'}</td>
                  <td>
                    <div className="admin-actions">
                      <button className="ghost-btn" onClick={() => void testConn(ds.id)}>
                        Testar
                      </button>
                      {testResult[ds.id] && (
                        <span
                          className={`admin-test-result${testResult[ds.id].startsWith('✓') ? ' test-ok' : ' test-err'}`}
                        >
                          {testResult[ds.id]}
                        </span>
                      )}
                      <button className="ghost-btn" onClick={() => openEdit(ds)}>
                        Editar
                      </button>
                      <button className="ghost-btn danger-btn" onClick={() => setConfirmRemove(ds)}>
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Users tab ----------

function UsersTab(): JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<User | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<{ users: User[] }>('/api/users')
      setUsers(data.users)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function changeRole(id: string, role: string): Promise<void> {
    try {
      await api(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await api(`/api/users/${id}`, { method: 'DELETE' })
      setConfirmRemove(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (loading) return <p className="admin-loading">Carregando…</p>

  return (
    <div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-section-bar">
        <h3>
          Usuários<span className="admin-count">{users.length}</span>
        </h3>
      </div>

      {confirmRemove && (
        <ConfirmModal
          title="Remover usuário"
          description={`Remover "${confirmRemove.email ?? confirmRemove.name ?? confirmRemove.id}"? Todos os grants deste usuário também serão removidos.`}
          confirmLabel="Remover"
          danger
          onConfirm={() => void remove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {users.length === 0 ? (
        <div className="admin-empty-state">
          <div className="admin-empty-icon">👥</div>
          <div className="admin-empty-title">Nenhum usuário cadastrado</div>
          <div className="admin-empty-desc">
            Usuários aparecem aqui após se autenticarem via SSO pela primeira vez.
          </div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Nome</th>
                <th>Papel</th>
                <th>Desde</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email ?? '—'}</td>
                  <td>{u.name ?? '—'}</td>
                  <td>
                    <select value={u.role} onChange={(e) => void changeRole(u.id, e.target.value)}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div className="admin-actions">
                      <button className="ghost-btn danger-btn" onClick={() => setConfirmRemove(u)}>
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Grants tab ----------

function GrantsTab(): JSX.Element {
  const [grants, setGrants] = useState<Grant[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [sources, setSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<Grant | null>(null)
  const [form, setForm] = useState({ userId: '', dataSourceId: '', mode: 'read', expiresAt: '' })

  const load = useCallback(async () => {
    try {
      const [g, u, ds] = await Promise.all([
        api<{ grants: Grant[] }>('/api/grants'),
        api<{ users: User[] }>('/api/users'),
        api<{ dataSources: DataSource[] }>('/api/data-sources')
      ])
      setGrants(g.grants)
      setUsers(u.users)
      setSources(ds.dataSources)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create(): Promise<void> {
    setFormError(null)
    try {
      await api('/api/grants', {
        method: 'POST',
        body: JSON.stringify({
          userId: form.userId,
          dataSourceId: form.dataSourceId,
          mode: form.mode
        })
      })
      if (form.expiresAt) {
        const updated = await api<{ grants: Grant[] }>('/api/grants')
        const g = updated.grants.find(
          (x) => x.user_id === form.userId && x.data_source_id === form.dataSourceId
        )
        if (g)
          await api(`/api/grants/${g.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ expiresAt: form.expiresAt })
          })
      }
      setShowForm(false)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e))
    }
  }

  async function toggleSuspend(g: Grant): Promise<void> {
    try {
      await api(`/api/grants/${g.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ suspended: !g.suspended })
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function revoke(id: string): Promise<void> {
    try {
      await api(`/api/grants/${id}`, { method: 'DELETE' })
      setConfirmRevoke(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.email ?? u.name ?? u.id]))
  const dsMap = Object.fromEntries(sources.map((d) => [d.id, d.name]))

  if (loading) return <p className="admin-loading">Carregando…</p>

  return (
    <div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-section-bar">
        <h3>
          Concessões<span className="admin-count">{grants.length}</span>
        </h3>
        <button
          className="run-btn"
          onClick={() => {
            setForm({ userId: '', dataSourceId: '', mode: 'read', expiresAt: '' })
            setFormError(null)
            setShowForm(true)
          }}
        >
          + Conceder Acesso
        </button>
      </div>

      {showForm && (
        <Modal title="Conceder Acesso" onClose={() => setShowForm(false)} width={500}>
          {formError && <div className="admin-error">{formError}</div>}
          <div className="modal-form">
            <div className="modal-form-section">
              <label className="modal-label">
                Usuário
                <select
                  className="modal-input"
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                >
                  <option value="">Selecione um usuário…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email ?? u.name ?? u.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modal-label">
                Data Source
                <select
                  className="modal-input"
                  value={form.dataSourceId}
                  onChange={(e) => setForm((f) => ({ ...f, dataSourceId: e.target.value }))}
                >
                  <option value="">Selecione um data source…</option>
                  {sources.map((d) => (
                    <option key={d.id} value={d.id}>
                      {DB_ICONS[d.kind] ?? ''} {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-form-row">
                <label className="modal-label">
                  Modo de acesso
                  <select
                    className="modal-input"
                    value={form.mode}
                    onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
                  >
                    <option value="read">🔍 Somente leitura</option>
                    <option value="readwrite">✏️ Leitura e escrita</option>
                  </select>
                </label>
                <label className="modal-label">
                  Validade (opcional)
                  <input
                    className="modal-input"
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="admin-form-actions">
            <button
              className="run-btn"
              onClick={create}
              disabled={!form.userId || !form.dataSourceId}
            >
              Conceder acesso
            </button>
            <button className="ghost-btn" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {confirmRevoke && (
        <ConfirmModal
          title="Revogar concessão"
          description={`Revogar o acesso de "${userMap[confirmRevoke.user_id] ?? confirmRevoke.user_id}" ao "${dsMap[confirmRevoke.data_source_id] ?? confirmRevoke.data_source_id}"?`}
          confirmLabel="Revogar"
          danger
          onConfirm={() => void revoke(confirmRevoke.id)}
          onCancel={() => setConfirmRevoke(null)}
        />
      )}

      {grants.length === 0 ? (
        <div className="admin-empty-state">
          <div className="admin-empty-icon">🔑</div>
          <div className="admin-empty-title">Nenhuma concessão ativa</div>
          <div className="admin-empty-desc">
            Conceda acesso a usuários para que possam conectar-se aos data sources.
          </div>
          <button
            className="run-btn"
            onClick={() => {
              setForm({ userId: '', dataSourceId: '', mode: 'read', expiresAt: '' })
              setFormError(null)
              setShowForm(true)
            }}
          >
            + Conceder Acesso
          </button>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Data Source</th>
                <th>Modo</th>
                <th>Validade</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} className={g.expired || g.suspended ? 'row-inactive' : ''}>
                  <td>{userMap[g.user_id] ?? g.user_id}</td>
                  <td>
                    <span className="ds-icon">
                      {DB_ICONS[sources.find((s) => s.id === g.data_source_id)?.kind ?? ''] ?? '🗄️'}
                    </span>
                    {dsMap[g.data_source_id] ?? g.data_source_id}
                  </td>
                  <td>{g.mode === 'readwrite' ? '✏️ leitura+escrita' : '🔍 leitura'}</td>
                  <td>{g.expires_at ? new Date(g.expires_at).toLocaleString('pt-BR') : '—'}</td>
                  <td>
                    {g.expired && <span className="badge-warn">expirado</span>}
                    {g.suspended && <span className="badge-muted">suspenso</span>}
                    {!g.expired && !g.suspended && <span className="badge-dev">ativo</span>}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button className="ghost-btn" onClick={() => void toggleSuspend(g)}>
                        {g.suspended ? 'Reativar' : 'Suspender'}
                      </button>
                      <button className="ghost-btn danger-btn" onClick={() => setConfirmRevoke(g)}>
                        Revogar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Audit tab ----------

function AuditTab(): JSX.Element {
  const [page, setPage] = useState<AuditPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    userId: '',
    dataSourceId: '',
    action: '',
    from: '',
    to: ''
  })
  const [currentPage, setCurrentPage] = useState(1)

  const load = useCallback(async (pg: number, f: typeof filters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pg))
      params.set('pageSize', '50')
      if (f.userId) params.set('userId', f.userId)
      if (f.dataSourceId) params.set('dataSourceId', f.dataSourceId)
      if (f.action) params.set('action', f.action)
      if (f.from) params.set('from', f.from)
      if (f.to) params.set('to', f.to)
      const data = await api<AuditPage>(`/api/audit?${params.toString()}`)
      setPage(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(currentPage, filters)
  }, [load, currentPage, filters])

  function applyFilters(): void {
    setCurrentPage(1)
    void load(1, filters)
  }

  function exportCsv(): void {
    const params = new URLSearchParams({ export: 'csv' })
    if (filters.userId) params.set('userId', filters.userId)
    if (filters.dataSourceId) params.set('dataSourceId', filters.dataSourceId)
    if (filters.action) params.set('action', filters.action)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const t = token()
    void (async () => {
      const res = await fetch(`/api/audit?${params.toString()}`, {
        headers: t ? { authorization: `Bearer ${t}` } : {}
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'audit.csv'
      a.click()
      URL.revokeObjectURL(url)
    })()
  }

  const totalPages = page ? Math.ceil(page.total / page.pageSize) : 1

  return (
    <div>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-filters">
        <input
          placeholder="Filtrar por ID de usuário"
          value={filters.userId}
          onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
        />
        <input
          placeholder="Ação (ex: query, login)"
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
        />
        <input
          type="datetime-local"
          title="De"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
        />
        <input
          type="datetime-local"
          title="Até"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
        />
        <div className="admin-filters-spacer" />
        <button className="run-btn" onClick={applyFilters}>
          Filtrar
        </button>
        <button className="ghost-btn" onClick={exportCsv}>
          Exportar CSV
        </button>
      </div>

      {loading && <p className="admin-loading">Carregando…</p>}

      {page && (
        <>
          <p className="admin-meta">
            {page.total} entradas · página {page.page}/{totalPages}
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Data Source</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {page.entries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(e.ts).toLocaleString('pt-BR')}
                    </td>
                    <td>{e.email ?? e.user_id ?? '—'}</td>
                    <td>
                      <code>{e.action}</code>
                    </td>
                    <td>{e.data_source_id ?? '—'}</td>
                    <td>
                      <span className="muted">{e.detail ? JSON.stringify(e.detail) : ''}</span>
                    </td>
                  </tr>
                ))}
                {page.entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      Sem entradas para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <button
              className="ghost-btn"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage <= 1}
            >
              ← Anterior
            </button>
            <span className="muted">
              {currentPage} / {totalPages}
            </span>
            <button
              className="ghost-btn"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= totalPages}
            >
              Próxima →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------- Admin shell ----------

interface Props {
  onBack: () => void
}

export default function Admin({ onBack }: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('data-sources')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'data-sources', label: 'Data Sources', icon: '🗄️' },
    { id: 'users', label: 'Usuários', icon: '👥' },
    { id: 'grants', label: 'Concessões', icon: '🔑' },
    { id: 'audit', label: 'Auditoria', icon: '📋' }
  ]

  return (
    <div className="admin-shell">
      <div className="admin-header">
        <button className="ghost-btn" onClick={onBack}>
          ← Voltar
        </button>
        <div className="admin-heading">
          <h2>Painel de Administração</h2>
          <p className="admin-subtitle">Gerencie data sources, usuários, concessões e auditoria</p>
        </div>
      </div>
      <div className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setTab(t.id)}
          >
            <span className="admin-tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="admin-content">
        {tab === 'data-sources' && <DataSourcesTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'grants' && <GrantsTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </div>
  )
}
