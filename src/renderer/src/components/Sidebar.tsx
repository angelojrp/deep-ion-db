import { type FormEvent, type JSX, useEffect, useState } from 'react'
import type { ConnectionConfig, DbKind, SchemaTable } from '@shared/types'

interface Props {
  connections: ConnectionConfig[]
  activeId: string | null
  onConnect: (config: ConnectionConfig) => Promise<void>
  onSelect: (id: string) => void
  onDisconnect: (id: string) => void
  onInsertSql: (sql: string) => void
}

const DEFAULT_PORT: Record<DbKind, string> = {
  postgres: '5432',
  mysql: '3306',
  sqlite: ''
}

export default function Sidebar({
  connections,
  activeId,
  onConnect,
  onSelect,
  onDisconnect,
  onInsertSql
}: Props): JSX.Element {
  const [kind, setKind] = useState<DbKind>('postgres')
  const [name, setName] = useState('')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('5432')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [database, setDatabase] = useState('')
  const [filePath, setFilePath] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function changeKind(next: DbKind): void {
    setKind(next)
    if (next !== 'sqlite') setPort(DEFAULT_PORT[next])
  }

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setConnecting(true)
    setFormError(null)

    const config: ConnectionConfig = {
      id: crypto.randomUUID(),
      name: name || (kind === 'sqlite' ? filePath || 'sqlite' : `${user}@${host}/${database}`),
      kind,
      host,
      port: Number(port) || undefined,
      user,
      password,
      database,
      filePath: kind === 'sqlite' ? filePath : undefined
    }

    try {
      await onConnect(config)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <aside className="sidebar">
      <h1 className="brand">Deep Ion DB</h1>

      <form className="conn-form" onSubmit={submit}>
        <label>
          Tipo
          <select value={kind} onChange={(e) => changeKind(e.target.value as DbKind)}>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL / MariaDB</option>
            <option value="sqlite">SQLite</option>
          </select>
        </label>

        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="opcional" />
        </label>

        {kind === 'sqlite' ? (
          <label>
            Arquivo
            <input
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/caminho/banco.db"
            />
          </label>
        ) : (
          <>
            <label>
              Host
              <input value={host} onChange={(e) => setHost(e.target.value)} />
            </label>
            <label>
              Porta
              <input value={port} onChange={(e) => setPort(e.target.value)} />
            </label>
            <label>
              Usuário
              <input value={user} onChange={(e) => setUser(e.target.value)} />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Database
              <input value={database} onChange={(e) => setDatabase(e.target.value)} />
            </label>
          </>
        )}

        <button type="submit" disabled={connecting}>
          {connecting ? 'Conectando…' : 'Conectar'}
        </button>
        {formError && <p className="form-error">{formError}</p>}
      </form>

      <div className="connections">
        {connections.map((c) => (
          <div key={c.id} className={'conn-item' + (c.id === activeId ? ' active' : '')}>
            <span className="conn-name" onClick={() => onSelect(c.id)} title={c.kind}>
              {c.name}
            </span>
            <button className="link" title="Desconectar" onClick={() => onDisconnect(c.id)}>
              ×
            </button>
          </div>
        ))}
      </div>

      {activeId && (
        <TableTree
          key={activeId}
          connectionId={activeId}
          kind={connections.find((c) => c.id === activeId)?.kind}
          onInsertSql={onInsertSql}
        />
      )}
    </aside>
  )
}

interface TreeProps {
  connectionId: string
  kind: DbKind | undefined
  onInsertSql: (sql: string) => void
}

function TableTree({ connectionId, kind, onInsertSql }: TreeProps): JSX.Element {
  const [tables, setTables] = useState<SchemaTable[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    window.api.db
      .listTables(connectionId)
      .then((t) => {
        if (!cancelled) setTables(t)
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [connectionId])

  function selectTable(t: SchemaTable): void {
    const qualified = kind === 'sqlite' ? t.name : `${t.schema}.${t.name}`
    onInsertSql(`SELECT * FROM ${qualified} LIMIT 100;`)
  }

  return (
    <div className="tree">
      <div className="tree-title">Tabelas {loading ? '…' : `(${tables.length})`}</div>
      {err && <p className="form-error">{err}</p>}
      {tables.map((t) => (
        <div
          key={`${t.schema}.${t.name}`}
          className="tree-item"
          title={`${t.type} — clique para gerar SELECT`}
          onClick={() => selectTable(t)}
        >
          {t.schema !== 'main' ? `${t.schema}.` : ''}
          {t.name}
        </div>
      ))}
    </div>
  )
}
