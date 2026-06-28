import { type JSX, useCallback, useEffect, useState } from 'react'
import type { HealthMetric } from '@shared/types'
import { useApi } from '../api'

interface Props {
  connectionId: string
  onClose: () => void
}

export default function HealthPanel({ connectionId, onClose }: Props): JSX.Element {
  const [metrics, setMetrics] = useState<HealthMetric[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const api = useApi()

  const load = useCallback(() => {
    setLoading(true)
    setErr(null)
    api.db
      .serverHealth(connectionId)
      .then(setMetrics)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [api, connectionId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Saúde do servidor {loading ? '…' : ''}</strong>
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
        <div className="health-grid">
          {metrics.map((m) => (
            <div key={m.label} className="health-card">
              <div className="health-value">{m.value}</div>
              <div className="health-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
