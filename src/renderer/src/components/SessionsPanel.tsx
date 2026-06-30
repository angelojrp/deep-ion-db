import { type JSX, useCallback, useEffect, useState } from 'react'
import type { SessionInfo } from '@shared/types'
import { useApi } from '../api'
import { useConfirm } from '../ui'

interface Props {
  connectionId: string
  onClose: () => void
}

export default function SessionsPanel({ connectionId, onClose }: Props): JSX.Element {
  const [items, setItems] = useState<SessionInfo[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const api = useApi()
  const confirm = useConfirm()

  const load = useCallback(() => {
    setLoading(true)
    setErr(null)
    api.db
      .activeSessions(connectionId)
      .then(setItems)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [api, connectionId])

  useEffect(() => {
    load()
  }, [load])

  async function kill(pid: string | number): Promise<void> {
    const ok = await confirm({
      title: 'Encerrar sessão',
      message: `Encerrar a sessão ${pid}?`,
      confirmLabel: 'Encerrar',
      danger: true
    })
    if (!ok) return
    try {
      await api.db.killSession(connectionId, pid)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Sessões ativas {loading ? '…' : `(${items.length})`}</strong>
          <span className="head-actions">
            <button className="icon-btn" title="Recarregar" onClick={load}>
              ⟳
            </button>
            <button className="icon-btn" title="Fechar" onClick={onClose}>
              ×
            </button>
          </span>
        </div>
        {err && <pre className="error">{err}</pre>}
        <div className="grid-scroll" style={{ maxHeight: '60vh' }}>
          <table className="grid">
            <thead>
              <tr>
                <th>PID</th>
                <th>Usuário</th>
                <th>Database</th>
                <th>Estado</th>
                <th>Duração</th>
                <th>Query</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Nenhuma sessão.
                  </td>
                </tr>
              )}
              {items.map((s) => (
                <tr key={String(s.pid)}>
                  <td>{String(s.pid)}</td>
                  <td>{s.user ?? ''}</td>
                  <td>{s.database ?? ''}</td>
                  <td>{s.state ?? ''}</td>
                  <td>{s.durationMs != null ? `${Math.round(s.durationMs)} ms` : ''}</td>
                  <td className="sess-query" title={s.query ?? ''}>
                    {s.query ?? ''}
                  </td>
                  <td>
                    <button className="link" title="Encerrar sessão" onClick={() => kill(s.pid)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
