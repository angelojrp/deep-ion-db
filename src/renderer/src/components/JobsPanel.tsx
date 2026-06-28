import { type JSX, useCallback, useEffect, useState } from 'react'
import type { JobInfo } from '@shared/types'

interface Props {
  connectionId: string
  onClose: () => void
}

export default function JobsPanel({ connectionId, onClose }: Props): JSX.Element {
  const [jobs, setJobs] = useState<JobInfo[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setErr(null)
    window.api.db
      .jobs(connectionId)
      .then(setJobs)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [connectionId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Jobs agendados {loading ? '…' : `(${jobs.length})`}</strong>
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
                <th>Nome</th>
                <th>Agendamento</th>
                <th>Ativo</th>
                <th>Comando</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Nenhum job (pg_cron/Events ausente ou não suportado).
                  </td>
                </tr>
              )}
              {jobs.map((j) => (
                <tr key={j.name}>
                  <td>{j.name}</td>
                  <td>{j.schedule ?? ''}</td>
                  <td>{j.enabled === undefined ? '—' : j.enabled ? 'sim' : 'não'}</td>
                  <td className="sess-query" title={j.command ?? ''}>
                    {j.command ?? ''}
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
