import { type JSX, useCallback, useEffect, useState } from 'react'
import type { RoleInfo } from '@shared/types'

interface Props {
  connectionId: string
  onInsertSql: (sql: string) => void
  onClose: () => void
}

export default function RolesPanel({ connectionId, onInsertSql, onClose }: Props): JSX.Element {
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setErr(null)
    window.api.db
      .listRoles(connectionId)
      .then(setRoles)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [connectionId])

  useEffect(() => {
    load()
  }, [load])

  function grantTemplate(name: string): void {
    onInsertSql(`GRANT SELECT ON  TO ${name};`)
    onClose()
  }

  function revokeTemplate(name: string): void {
    onInsertSql(`REVOKE SELECT ON  FROM ${name};`)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Usuários e roles {loading ? '…' : `(${roles.length})`}</strong>
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
                <th>Login</th>
                <th>Super</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Nenhum role (ou não suportado neste banco).
                  </td>
                </tr>
              )}
              {roles.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.canLogin === undefined ? '—' : r.canLogin ? 'sim' : 'não'}</td>
                  <td>{r.isSuper === undefined ? '—' : r.isSuper ? 'sim' : 'não'}</td>
                  <td>
                    <button
                      className="link"
                      title="Inserir GRANT"
                      onClick={() => grantTemplate(r.name)}
                    >
                      GRANT
                    </button>{' '}
                    <button
                      className="link"
                      title="Inserir REVOKE"
                      onClick={() => revokeTemplate(r.name)}
                    >
                      REVOKE
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
