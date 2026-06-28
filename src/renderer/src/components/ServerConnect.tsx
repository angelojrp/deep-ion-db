import { type FormEvent, type JSX, useEffect, useState } from 'react'
import type { ServerSession } from '@shared/types'

interface Props {
  /** Chamado após autenticar com sucesso (URL normalizada + rótulo). */
  onConnected: (serverUrl: string, label: string) => void
  /** Fecha a tela sem conectar. */
  onCancel: () => void
}

/**
 * Tela "Conectar ao servidor" (#123): informa a URL do servidor web, dispara o
 * login OIDC (navegador externo) e lista sessões salvas para reconexão rápida.
 */
export default function ServerConnect({ onConnected, onCancel }: Props): JSX.Element {
  const [serverUrl, setServerUrl] = useState('http://localhost:4000')
  const [label, setLabel] = useState('')
  const [sessions, setSessions] = useState<ServerSession[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.serverAuth.listSessions().then(setSessions)
  }, [])

  async function connect(url: string, name: string): Promise<void> {
    const trimmed = url.trim().replace(/\/$/, '')
    if (!trimmed) {
      setError('Informe a URL do servidor.')
      return
    }
    setBusy(true)
    setError(null)
    setStatus('Abrindo o navegador para autenticação…')
    try {
      const result = await window.serverAuth.login(trimmed)
      if (!result.ok) {
        setError(result.error ?? 'Falha ao autenticar no servidor.')
        return
      }
      await window.serverAuth.saveSession(name || trimmed, trimmed)
      setStatus(null)
      onConnected(trimmed, name || trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    await connect(serverUrl, label)
  }

  async function removeSession(id: string): Promise<void> {
    await window.serverAuth.removeSession(id)
    setSessions(await window.serverAuth.listSessions())
  }

  return (
    <div className="server-connect-overlay">
      <div className="server-connect">
        <h2>Conectar ao servidor</h2>
        <p className="server-connect-hint">
          Use os data sources gerenciados por um servidor Deep Ion DB. As credenciais dos bancos
          permanecem no servidor — o desktop só envia SQL.
        </p>

        {sessions.length > 0 && (
          <div className="server-sessions">
            <h3>Sessões salvas</h3>
            <ul>
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    className="link-btn"
                    disabled={busy}
                    onClick={() => void connect(s.serverUrl, s.label)}
                    title={s.serverUrl}
                  >
                    {s.label}
                  </button>
                  <button
                    className="icon-btn"
                    disabled={busy}
                    title="Remover"
                    onClick={() => void removeSession(s.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form className="conn-form" onSubmit={submit}>
          <label>
            URL do servidor
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://db.empresa.com"
            />
          </label>
          <label>
            Rótulo
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="opcional"
            />
          </label>
          <div className="server-connect-actions">
            <button type="submit" disabled={busy}>
              {busy ? 'Conectando…' : 'Conectar'}
            </button>
            <button type="button" className="ghost-btn" disabled={busy} onClick={onCancel}>
              Cancelar
            </button>
          </div>
          {status && <p className="form-hint">{status}</p>}
          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}
