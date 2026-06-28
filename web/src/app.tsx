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

interface AuthConfig {
  authDisabled: boolean
  issuer: string | null
  audience: string | null
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

// ----- OIDC Authorization Code + PKCE (#106) -----

function base64url(bytes: ArrayBuffer): string {
  const b = btoa(String.fromCharCode(...new Uint8Array(bytes)))
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomVerifier(): string {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  return base64url(a.buffer)
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(digest)
}

async function discover(
  issuer: string
): Promise<{ authorization_endpoint: string; token_endpoint: string }> {
  const r = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`)
  if (!r.ok) throw new Error('Falha ao descobrir endpoints do IdP')
  return r.json()
}

const REDIRECT_URI = (): string => window.location.origin + '/'

async function startLogin(cfg: AuthConfig): Promise<void> {
  if (!cfg.issuer) throw new Error('OIDC_ISSUER não configurado no servidor')
  const clientId = cfg.audience ?? 'deepion'
  const d = await discover(cfg.issuer)
  const verifier = randomVerifier()
  sessionStorage.setItem('pkce_verifier', verifier)
  sessionStorage.setItem('pkce_token_endpoint', d.token_endpoint)
  sessionStorage.setItem('pkce_client_id', clientId)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI(),
    scope: 'openid profile email',
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256'
  })
  window.location.assign(`${d.authorization_endpoint}?${params.toString()}`)
}

/** Troca o `code` do callback por tokens. Retorna true se autenticou. */
async function completeLogin(code: string): Promise<boolean> {
  const verifier = sessionStorage.getItem('pkce_verifier')
  const tokenEndpoint = sessionStorage.getItem('pkce_token_endpoint')
  const clientId = sessionStorage.getItem('pkce_client_id')
  if (!verifier || !tokenEndpoint || !clientId) return false
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI(),
    client_id: clientId,
    code_verifier: verifier
  })
  const r = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  })
  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('pkce_token_endpoint')
  sessionStorage.removeItem('pkce_client_id')
  if (!r.ok) return false
  const t = await r.json()
  if (t.access_token) localStorage.setItem('token', t.access_token)
  if (t.refresh_token) localStorage.setItem('refresh_token', t.refresh_token)
  return !!t.access_token
}

function App(): JSX.Element {
  const [me, setMe] = useState<Me | null>(null)
  const [sources, setSources] = useState<DataSource[]>([])
  const [active, setActive] = useState('')
  const [sql, setSql] = useState('select 1 as hello')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(localStorage.getItem('token') ?? '')
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null)
  const [showManual, setShowManual] = useState(false)

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
    void (async () => {
      try {
        setAuthConfig(await (await fetch('/api/auth/config')).json())
      } catch {
        /* servidor antigo: segue no modo manual */
      }
      // Callback do IdP: troca o code por token e limpa a URL.
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (code) {
        await completeLogin(code)
        window.history.replaceState({}, '', url.pathname)
      }
      await load()
    })()
  }, [])

  async function login(): Promise<void> {
    if (!authConfig) return
    setError(null)
    try {
      await startLogin(authConfig)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function logout(): void {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    setToken('')
    setMe(null)
    setSources([])
  }

  function saveToken(): void {
    localStorage.setItem('token', token)
    void load()
  }

  const needsLogin = !!authConfig && !authConfig.authDisabled && !me

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
        {me && !authConfig?.authDisabled && (
          <button onClick={logout} style={{ marginLeft: 8 }}>
            Sair
          </button>
        )}
      </header>

      {needsLogin && (
        <div className="login-box">
          <p className="muted">
            Você não está autenticado. Entre com seu provedor de identidade (SSO).
          </p>
          <div className="toolbar">
            <button onClick={login} disabled={!authConfig?.issuer}>
              Entrar com SSO
            </button>
            <button onClick={() => setShowManual((v) => !v)}>
              {showManual ? 'Ocultar token manual' : 'Usar token manual'}
            </button>
          </div>
          {!authConfig?.issuer && (
            <p className="muted">(OIDC_ISSUER não configurado no servidor — use um token manual)</p>
          )}
          {showManual && (
            <div className="token-bar">
              <input
                placeholder="Bearer token OIDC"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button onClick={saveToken}>Salvar token</button>
            </div>
          )}
        </div>
      )}

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
