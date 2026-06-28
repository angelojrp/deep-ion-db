import { type JSX, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

interface DataSource {
  id: string
  name: string
  kind: string
  environment: string
}

interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  durationMs: number
  truncated?: boolean
}

interface Me {
  email: string | null
  role: string
}

function api(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token') ?? ''
  return fetch(path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {})
    }
  })
}

function App(): JSX.Element {
  const [me, setMe] = useState<Me | null>(null)
  const [sources, setSources] = useState<DataSource[]>([])
  const [active, setActive] = useState('')
  const [sql, setSql] = useState('select 1 as hello')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(localStorage.getItem('token') ?? '')

  async function load(): Promise<void> {
    try {
      const m = await (await api('/api/me')).json()
      setMe(m)
      const d = await (await api('/api/data-sources')).json()
      setSources(d.dataSources ?? [])
      if (d.dataSources?.[0]) setActive(d.dataSources[0].id)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function saveToken(): void {
    localStorage.setItem('token', token)
    void load()
  }

  async function run(): Promise<void> {
    setError(null)
    setResult(null)
    try {
      const r = await api(`/api/data-sources/${active}/query`, {
        method: 'POST',
        body: JSON.stringify({ sql })
      })
      const d = await r.json()
      if (!r.ok) setError(d.error ?? 'erro')
      else setResult(d)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="wrap">
      <header>
        <strong>Deep Ion DB</strong> <span className="muted">— web</span>
        <span className="me">
          {me ? `${me.email ?? 'usuário'} (${me.role})` : 'não autenticado'}
        </span>
      </header>

      <div className="token-bar">
        <input
          placeholder="Bearer token OIDC (opcional em modo dev)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button onClick={saveToken}>Salvar token</button>
      </div>

      <div className="toolbar">
        <select value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="">— data source —</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.kind}/{s.environment})
            </option>
          ))}
        </select>
        <button onClick={run} disabled={!active}>
          ▶ Executar
        </button>
      </div>

      <textarea value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} />

      {error && <pre className="error">{error}</pre>}
      {result && (
        <div className="result">
          <div className="muted">
            {result.rowCount} linha(s) · {Math.round(result.durationMs)} ms
            {result.truncated ? ' · (truncado)' : ''}
          </div>
          <table>
            <thead>
              <tr>
                {result.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i}>
                  {result.columns.map((c) => (
                    <td key={c}>{row[c] === null ? 'NULL' : String(row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const el = document.getElementById('root')
if (el) createRoot(el).render(<App />)
