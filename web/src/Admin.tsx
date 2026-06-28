import { type JSX, useCallback, useEffect, useState } from 'react'

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

function DataSourcesTab(): JSX.Element {
  const [sources, setSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DataSource | null>(null)
  const [testResult, setTestResult] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
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
    setForm({
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
    setShowForm(true)
  }

  function openEdit(ds: DataSource): void {
    setEditing(ds)
    setForm({
      name: ds.name,
      kind: ds.kind,
      host: ds.host ?? '',
      port: String(ds.port ?? 5432),
      database: ds.database ?? '',
      username: ds.username ?? '',
      password: '',
      ssl: ds.ssl,
      environment: ds.environment
    })
    setShowForm(true)
  }

  async function save(): Promise<void> {
    setError(null)
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
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function testConn(id: string): Promise<void> {
    setTestResult((r) => ({ ...r, [id]: 'testando…' }))
    try {
      await api(`/api/data-sources/${id}/test`, { method: 'POST' })
      setTestResult((r) => ({ ...r, [id]: 'OK' }))
    } catch (e) {
      setTestResult((r) => ({ ...r, [id]: e instanceof Error ? e.message : 'erro' }))
    }
  }

  async function remove(id: string): Promise<void> {
    if (!confirm('Remover este data source?')) return
    try {
      await api(`/api/data-sources/${id}`, { method: 'DELETE' })
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
        <div className="admin-form">
          <h3>{editing ? 'Editar Data Source' : 'Novo Data Source'}</h3>
          <div className="admin-form-grid">
            <label>
              Nome
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              Tipo
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              >
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlite">SQLite</option>
              </select>
            </label>
            <label>
              Host
              <input
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              />
            </label>
            <label>
              Porta
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
              />
            </label>
            <label>
              Banco
              <input
                value={form.database}
                onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
              />
            </label>
            <label>
              Usuário
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </label>
            <label>
              Senha {editing && '(deixar vazio para manter)'}
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </label>
            <label>
              Ambiente
              <select
                value={form.environment}
                onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
              >
                <option value="nonprod">não-produção</option>
                <option value="prod">produção</option>
              </select>
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={form.ssl}
                onChange={(e) => setForm((f) => ({ ...f, ssl: e.target.checked }))}
              />
              SSL
            </label>
          </div>
          <div className="admin-form-actions">
            <button className="run-btn" onClick={save}>
              Salvar
            </button>
            <button className="ghost-btn" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

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
                <td>{ds.name}</td>
                <td>{ds.kind}</td>
                <td>
                  {ds.host ?? '—'}
                  {ds.port ? `:${ds.port}` : ''}
                </td>
                <td>{ds.database ?? '—'}</td>
                <td>
                  <span className={ds.environment === 'prod' ? 'badge-prod' : 'badge-dev'}>
                    {ds.environment}
                  </span>
                </td>
                <td>{ds.ssl ? 'sim' : 'não'}</td>
                <td>
                  <div className="admin-actions">
                    <button className="ghost-btn" onClick={() => void testConn(ds.id)}>
                      Testar
                    </button>
                    {testResult[ds.id] && (
                      <span className="admin-test-result">{testResult[ds.id]}</span>
                    )}
                    <button className="ghost-btn" onClick={() => openEdit(ds)}>
                      Editar
                    </button>
                    <button className="ghost-btn danger-btn" onClick={() => void remove(ds.id)}>
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={7} className="admin-empty">
                  Nenhum data source cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Users tab ----------

function UsersTab(): JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    if (!confirm('Remover este usuário e todos os seus grants?')) return
    try {
      await api(`/api/users/${id}`, { method: 'DELETE' })
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
                    <button className="ghost-btn danger-btn" onClick={() => void remove(u.id)}>
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="admin-empty">
                  Nenhum usuário.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
  const [showForm, setShowForm] = useState(false)
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
    setError(null)
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
        // Get the created grant id and patch expires_at
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
      setError(e instanceof Error ? e.message : String(e))
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

  async function remove(id: string): Promise<void> {
    if (!confirm('Revogar este grant?')) return
    try {
      await api(`/api/grants/${id}`, { method: 'DELETE' })
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
            setShowForm(true)
          }}
        >
          + Conceder Acesso
        </button>
      </div>

      {showForm && (
        <div className="admin-form">
          <h3>Conceder Acesso</h3>
          <div className="admin-form-grid">
            <label>
              Usuário
              <select
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              >
                <option value="">Selecione…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email ?? u.name ?? u.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data Source
              <select
                value={form.dataSourceId}
                onChange={(e) => setForm((f) => ({ ...f, dataSourceId: e.target.value }))}
              >
                <option value="">Selecione…</option>
                {sources.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Modo
              <select
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              >
                <option value="read">Leitura</option>
                <option value="readwrite">Leitura e Escrita</option>
              </select>
            </label>
            <label>
              Validade (opcional)
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </label>
          </div>
          <div className="admin-form-actions">
            <button
              className="run-btn"
              onClick={create}
              disabled={!form.userId || !form.dataSourceId}
            >
              Conceder
            </button>
            <button className="ghost-btn" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

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
                <td>{dsMap[g.data_source_id] ?? g.data_source_id}</td>
                <td>{g.mode}</td>
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
                    <button className="ghost-btn danger-btn" onClick={() => void remove(g.id)}>
                      Revogar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {grants.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-empty">
                  Nenhum grant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    // Download via link com header de auth não é possível diretamente; usar fetch+blob
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
          placeholder="Usuário ID"
          value={filters.userId}
          onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
        />
        <input
          placeholder="Ação (ex: query)"
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
                      Sem entradas.
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'data-sources', label: 'Data Sources' },
    { id: 'users', label: 'Usuários' },
    { id: 'grants', label: 'Concessões' },
    { id: 'audit', label: 'Auditoria' }
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
