import { type JSX, useState } from 'react'
import { type AuthConfig, startLogin } from './auth'

interface Props {
  cfg: AuthConfig
  onToken: () => void
}

/** Tela de login do modo web: SSO (OIDC) com fallback de token manual. */
export default function Login({ cfg, onToken }: Props): JSX.Element {
  const [token, setToken] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function login(): Promise<void> {
    setError(null)
    try {
      await startLogin(cfg)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function saveToken(): void {
    if (!token.trim()) return
    localStorage.setItem('token', token.trim())
    onToken()
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <h1 className="brand">Deep Ion DB</h1>
        <p className="muted">Entre com seu provedor de identidade (SSO) para acessar.</p>
        <div className="toolbar">
          <button className="run-btn" onClick={login} disabled={!cfg.issuer}>
            Entrar com SSO
          </button>
          <button className="ghost-btn" onClick={() => setShowManual((v) => !v)}>
            {showManual ? 'Ocultar token manual' : 'Usar token manual'}
          </button>
        </div>
        {!cfg.issuer && (
          <p className="muted">(OIDC_ISSUER não configurado no servidor — use um token manual)</p>
        )}
        {showManual && (
          <div className="token-bar">
            <input
              placeholder="Bearer token OIDC"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button onClick={saveToken}>Entrar</button>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  )
}
