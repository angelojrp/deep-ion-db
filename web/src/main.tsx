import { type JSX, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../src/renderer/src/App'
import { ApiProvider } from '../../src/renderer/src/api'
import '../../src/renderer/src/styles.css'
import './admin.css'
import { httpApi, WEB_CAPABILITIES } from './httpApi'
import { type AuthConfig, completeLogin, fetchAuthConfig } from './auth'
import Login from './Login'
import Admin from './Admin'

type AdminTab = 'data-sources' | 'users' | 'grants' | 'audit'

interface Me {
  role: string
  email: string | null
  name: string | null
}

async function fetchMe(): Promise<Me | null> {
  try {
    const t = localStorage.getItem('token') ?? ''
    const res = await fetch('/api/me', {
      headers: t ? { authorization: `Bearer ${t}` } : {}
    })
    if (!res.ok) return null
    return res.json() as Promise<Me>
  } catch {
    return null
  }
}

const ADMIN_NAV: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'data-sources', label: 'Data Sources', icon: '🗄️' },
  { id: 'users', label: 'Usuários', icon: '👥' },
  { id: 'grants', label: 'Concessões', icon: '🔑' },
  { id: 'audit', label: 'Auditoria', icon: '📋' }
]

/**
 * Entrada do app web: renderiza a UI do desktop (src/renderer/src/App)
 * com um menu bar superior contendo brand, links admin e controles de sessão.
 */
function Root(): JSX.Element {
  const [ready, setReady] = useState(false)
  const [cfg, setCfg] = useState<AuthConfig | null>(null)
  const [authed, setAuthed] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [adminTab, setAdminTab] = useState<AdminTab | null>(null)

  const authDisabled = cfg?.authDisabled ?? false
  const isAdmin = me?.role === 'admin'

  useEffect(() => {
    void (async () => {
      const c = await fetchAuthConfig()
      setCfg(c)
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (code) {
        await completeLogin(code)
        window.history.replaceState({}, '', url.pathname)
      }
      const ok = (c?.authDisabled ?? false) || !!localStorage.getItem('token')
      setAuthed(ok)
      if (ok) setMe(await fetchMe())
      setReady(true)
    })()
  }, [])

  function handleLogout() {
    localStorage.removeItem('token')
    setAuthed(false)
    setMe(null)
    setAdminTab(null)
  }

  if (!ready) return <div className="placeholder">Carregando…</div>
  if (!authed && cfg) return <Login cfg={cfg} onToken={() => setAuthed(true)} />

  if (adminTab !== null) {
    return (
      <Admin
        defaultTab={adminTab}
        onBack={() => setAdminTab(null)}
        onLogout={authDisabled ? undefined : handleLogout}
        authDisabled={authDisabled}
      />
    )
  }

  const displayName = me?.name ?? me?.email ?? null

  return (
    <ApiProvider api={httpApi} caps={WEB_CAPABILITIES}>
      <div className="web-layout">
        <nav className="web-menubar">
          <span className="web-menubar-brand">Deep Ion DB</span>

          {isAdmin && (
            <div className="web-menubar-nav" role="menubar">
              {ADMIN_NAV.map((item) => (
                <button
                  key={item.id}
                  className="web-menubar-item"
                  role="menuitem"
                  onClick={() => setAdminTab(item.id)}
                >
                  <span className="web-menubar-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="web-menubar-end">
            {authDisabled && (
              <span
                className="auth-disabled-badge"
                title="AUTH_DISABLED=true — sem autenticação OIDC"
              >
                ⚠ Modo dev
              </span>
            )}
            {displayName && <span className="web-menubar-user">{displayName}</span>}
            {!authDisabled && (
              <button className="logout-btn" onClick={handleLogout} title="Encerrar sessão">
                Sair
              </button>
            )}
          </div>
        </nav>
        <div className="web-content">
          <App />
        </div>
      </div>
    </ApiProvider>
  )
}

const el = document.getElementById('root')
if (el) createRoot(el).render(<Root />)
