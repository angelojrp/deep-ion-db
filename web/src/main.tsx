import { type JSX, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../src/renderer/src/App'
import { ApiProvider } from '../../src/renderer/src/api'
import '../../src/renderer/src/styles.css'
import { httpApi, WEB_CAPABILITIES } from './httpApi'
import { type AuthConfig, completeLogin, fetchAuthConfig } from './auth'
import Login from './Login'

/**
 * Entrada do app web (arquitetura unificada): renderiza a MESMA UI do desktop
 * (src/renderer/src/App), injetando um AppApi sobre HTTP + capabilities de web.
 * Antes disso, resolve a autenticação OIDC (#106).
 */
function Root(): JSX.Element {
  const [ready, setReady] = useState(false)
  const [cfg, setCfg] = useState<AuthConfig | null>(null)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    void (async () => {
      const c = await fetchAuthConfig()
      setCfg(c)
      // Callback do IdP: troca o code por token e limpa a URL.
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (code) {
        await completeLogin(code)
        window.history.replaceState({}, '', url.pathname)
      }
      const ok = (c?.authDisabled ?? false) || !!localStorage.getItem('token')
      setAuthed(ok)
      setReady(true)
    })()
  }, [])

  if (!ready) return <div className="placeholder">Carregando…</div>
  if (!authed && cfg) return <Login cfg={cfg} onToken={() => setAuthed(true)} />

  return (
    <ApiProvider api={httpApi} caps={WEB_CAPABILITIES}>
      <App />
    </ApiProvider>
  )
}

const el = document.getElementById('root')
if (el) createRoot(el).render(<Root />)
