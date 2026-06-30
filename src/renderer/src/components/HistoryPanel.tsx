import { type JSX, useCallback, useEffect, useState } from 'react'
import type { HistoryEntry } from '@shared/types'
import { useApi } from '../api'
import { useConfirm } from '../ui'

interface Props {
  onClose: () => void
  onPick: (sql: string) => void
}

export default function HistoryPanel({ onClose, onPick }: Props): JSX.Element {
  const [items, setItems] = useState<HistoryEntry[]>([])
  const [q, setQ] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const api = useApi()
  const confirm = useConfirm()

  const load = useCallback(() => {
    api.hist
      .list()
      .then(setItems)
      .catch(() => {})
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  const filtered = items.filter(
    (e) => (!favOnly || e.favorite) && e.sql.toLowerCase().includes(q.toLowerCase())
  )

  async function toggleFav(id: string): Promise<void> {
    await api.hist.toggleFavorite(id)
    load()
  }
  async function remove(id: string): Promise<void> {
    await api.hist.remove(id)
    load()
  }
  async function clear(): Promise<void> {
    const ok = await confirm({
      title: 'Limpar histórico',
      message: 'Limpar histórico? (favoritos são mantidos)',
      confirmLabel: 'Limpar',
      danger: true
    })
    if (ok) {
      await api.hist.clear()
      load()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Histórico de queries</strong>
          <button className="icon-btn" title="Fechar" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-tools">
          <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={favOnly}
              onChange={(e) => setFavOnly(e.target.checked)}
            />
            Só favoritos
          </label>
          <button className="ghost-btn" onClick={clear}>
            Limpar
          </button>
        </div>
        <div className="hist-list">
          {filtered.length === 0 && <div className="explorer-empty">Nada aqui.</div>}
          {filtered.map((e) => (
            <div key={e.id} className="hist-item">
              <button className="star" title="Favoritar" onClick={() => toggleFav(e.id)}>
                {e.favorite ? '★' : '☆'}
              </button>
              <pre
                className="hist-sql"
                title="Inserir no editor"
                onClick={() => {
                  onPick(e.sql)
                  onClose()
                }}
              >
                {e.sql.length > 240 ? e.sql.slice(0, 240) + '…' : e.sql}
              </pre>
              <div className="hist-meta">
                <span>{e.connectionName}</span>
                <span className={e.ok ? 'ok' : 'fail'}>
                  {e.ok ? `${e.rowCount} linha(s) · ${Math.round(e.durationMs)} ms` : 'erro'}
                </span>
                <span>{new Date(e.ts).toLocaleString()}</span>
                <button className="link" title="Remover" onClick={() => remove(e.id)}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
