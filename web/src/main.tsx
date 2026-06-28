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

interface Me {
  role: string
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

/**
 * Entrada do app web (arquitetura unificada): renderiza a MESMA UI do desktop
 * (src/renderer/src/App), injetando um AppApi sobre HTTP + capabilities de web.
 * Antes disso, resolve a autenticação OIDC (#106).
 * Admins veem botão para o painel de administração (issue #115).
 */
function Root(): JSX.Element {
  const [ready, setReady] = useState(false)
  const [cfg, setCfg] = useState<AuthConfig | null>(null)
  const [authed, setAuthed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)

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
      if (ok) {
        const me = await fetchMe()
        setIsAdmin(me?.role === 'admin')
      }
      setReady(true)
    })()
  }, [])

  if (!ready) return <div className="placeholder">Carregando…</div>
  if (!authed && cfg) return <Login cfg={cfg} onToken={() => setAuthed(true)} />

  if (showAdmin) {
    return <Admin onBack={() => setShowAdmin(false)} />
  }

  return (
    <ApiProvider api={httpApi} caps={WEB_CAPABILITIES}>
      {isAdmin && (
        <button
          className="admin-fab"
          title="Painel de Administração"
          onClick={() => setShowAdmin(true)}
        >
          ⚙ Admin
        </button>
      )}
      <App />
    </ApiProvider>
  )
}

const el = document.getElementById('root')
if (el) createRoot(el).render(<Root />)
