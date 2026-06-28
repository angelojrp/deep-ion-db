import { type JSX, useState } from 'react'
import type {
  ColumnInfo,
  ConnectionSummary,
  DbKind,
  SavedConnection,
  SchemaTable
} from '@shared/types'

interface DataSource {
  id: string
  name: string
  kind: DbKind
  connected: boolean
  saved?: SavedConnection
}

interface Props {
  connections: ConnectionSummary[]
  saved: SavedConnection[]
  activeId: string | null
  onConnectSaved: (s: SavedConnection) => Promise<void>
  onSelect: (id: string) => void
  onDisconnect: (id: string) => void
  onDeleteSaved: (id: string) => void
  onInsertSql: (sql: string) => void
}

/** Árvore de exploração multi-conexão (estilo DataGrip): data source → schema → tabela → colunas. */
export default function DatabaseExplorer(props: Props): JSX.Element {
  const { connections, saved } = props
  const [refreshKey, setRefreshKey] = useState(0)

  const sources: DataSource[] = []
  for (const s of saved) {
    sources.push({ id: s.id, name: s.name, kind: s.kind, connected: false, saved: s })
  }
  for (const c of connections) {
    const existing = sources.find((x) => x.id === c.id)
    if (existing) existing.connected = true
    else sources.push({ id: c.id, name: c.name, kind: c.kind, connected: true })
  }

  return (
    <div className="explorer">
      <div className="explorer-head">
        <span className="section-title">Database Explorer</span>
        <button className="icon-btn" title="Recarregar" onClick={() => setRefreshKey((k) => k + 1)}>
          ⟳
        </button>
      </div>
      {sources.length === 0 && <div className="explorer-empty">Nenhuma conexão ainda.</div>}
      {sources.map((s) => (
        <ConnectionNode key={`${s.id}:${refreshKey}`} source={s} {...props} />
      ))}
    </div>
  )
}

interface SchemaGroup {
  name: string
  tables: SchemaTable[]
}

function ConnectionNode({
  source,
  activeId,
  onConnectSaved,
  onSelect,
  onDisconnect,
  onDeleteSaved,
  onInsertSql
}: { source: DataSource } & Omit<Props, 'connections' | 'saved'>): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [schemas, setSchemas] = useState<SchemaGroup[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  async function ensureConnected(): Promise<boolean> {
    if (source.connected) return true
    if (!source.saved) return false
    setConnecting(true)
    setError(null)
    try {
      await onConnectSaved(source.saved)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setConnecting(false)
    }
  }

  async function loadTables(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const tables = await window.api.db.listTables(source.id)
      const map = new Map<string, SchemaTable[]>()
      for (const t of tables) {
        const arr = map.get(t.schema) ?? []
        arr.push(t)
        map.set(t.schema, arr)
      }
      setSchemas([...map.entries()].map(([name, ts]) => ({ name, tables: ts })))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function toggle(): Promise<void> {
    if (expanded) {
      setExpanded(false)
      return
    }
    if (!(await ensureConnected())) return
    setExpanded(true)
    if (!schemas) await loadTables()
  }

  const isActive = activeId === source.id
  const total = schemas?.reduce((n, s) => n + s.tables.length, 0)

  return (
    <div className="node">
      <div className={'node-row' + (isActive ? ' active' : '')}>
        <span className="caret" onClick={toggle}>
          {connecting ? '…' : expanded ? '▾' : '▸'}
        </span>
        <span
          className="node-label"
          title={`${source.kind} — clique para ${source.connected ? 'selecionar' : 'conectar'}`}
          onClick={() => {
            onSelect(source.id)
            void toggle()
          }}
        >
          <span className="ic">{source.connected ? '🟢' : '⚪'}</span>
          {source.name}
          {total !== undefined && <span className="badge">{total}</span>}
        </span>
        <span className="node-actions">
          {source.connected && (
            <button className="link" title="Desconectar" onClick={() => onDisconnect(source.id)}>
              ⏏
            </button>
          )}
          {source.saved && (
            <button
              className="link"
              title="Remover conexão salva"
              onClick={() => onDeleteSaved(source.id)}
            >
              ×
            </button>
          )}
        </span>
      </div>

      {expanded && (
        <div className="children">
          {loading && <div className="node-info">carregando…</div>}
          {error && <div className="form-error">{error}</div>}
          {schemas?.map((sc) => (
            <SchemaNode
              key={sc.name}
              connId={source.id}
              kind={source.kind}
              schema={sc}
              defaultExpanded={schemas.length === 1}
              onInsertSql={onInsertSql}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SchemaNode({
  connId,
  kind,
  schema,
  defaultExpanded,
  onInsertSql
}: {
  connId: string
  kind: DbKind
  schema: SchemaGroup
  defaultExpanded: boolean
  onInsertSql: (sql: string) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div className="node">
      <div className="node-row" onClick={() => setExpanded((e) => !e)}>
        <span className="caret">{expanded ? '▾' : '▸'}</span>
        <span className="node-label">
          <span className="ic">📁</span>
          {schema.name}
          <span className="badge">{schema.tables.length}</span>
        </span>
      </div>
      {expanded && (
        <div className="children">
          {schema.tables.map((t) => (
            <TableNode
              key={`${t.schema}.${t.name}`}
              connId={connId}
              kind={kind}
              table={t}
              onInsertSql={onInsertSql}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TableNode({
  connId,
  kind,
  table,
  onInsertSql
}: {
  connId: string
  kind: DbKind
  table: SchemaTable
  onInsertSql: (sql: string) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [cols, setCols] = useState<ColumnInfo[] | null>(null)
  const [loading, setLoading] = useState(false)

  const qualified = kind === 'sqlite' ? table.name : `${table.schema}.${table.name}`
  const isView = /view/i.test(table.type)

  async function toggle(): Promise<void> {
    if (!expanded && !cols) {
      setLoading(true)
      try {
        setCols(await window.api.db.listColumns(connId, table.schema, table.name))
      } catch {
        setCols([])
      } finally {
        setLoading(false)
      }
    }
    setExpanded((e) => !e)
  }

  return (
    <div className="node">
      <div className="node-row">
        <span className="caret" onClick={toggle}>
          {expanded ? '▾' : '▸'}
        </span>
        <span
          className="node-label"
          title="clique: colunas · duplo-clique: SELECT"
          onClick={toggle}
          onDoubleClick={() => onInsertSql(`SELECT * FROM ${qualified} LIMIT 100;`)}
        >
          <span className="ic">{isView ? '👁' : '▦'}</span>
          {table.name}
        </span>
        <span className="node-actions">
          <button
            className="link"
            title="Inserir SELECT *"
            onClick={() => onInsertSql(`SELECT * FROM ${qualified} LIMIT 100;`)}
          >
            ⤵
          </button>
          <button
            className="link"
            title="Gerar DDL"
            onClick={async () => {
              try {
                onInsertSql(await window.api.db.tableDdl(connId, table.schema, table.name))
              } catch {
                /* ignore */
              }
            }}
          >
            DDL
          </button>
        </span>
      </div>
      {expanded && (
        <div className="children">
          {loading && <div className="node-info">…</div>}
          {cols?.map((c) => (
            <div
              key={c.name}
              className="node-row leaf"
              title={`${c.dataType}${c.nullable ? ' · null' : ' · not null'}`}
              onClick={() => onInsertSql(c.name)}
            >
              <span className="caret-spacer" />
              <span className="node-label">
                <span className="ic">▪</span>
                {c.name}
                <span className="col-type">{c.dataType}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
