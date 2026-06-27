import { type JSX, useCallback, useEffect, useState } from 'react'
import type {
  ConnectionConfig,
  ConnectionSummary,
  QueryResult,
  SavedConnection
} from '@shared/types'
import Sidebar from './components/Sidebar'
import SqlEditor from './components/SqlEditor'
import ResultsGrid from './components/ResultsGrid'

export default function App(): JSX.Element {
  const [connections, setConnections] = useState<ConnectionSummary[]>([])
  const [saved, setSaved] = useState<SavedConnection[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sql, setSql] = useState('SELECT 1 AS hello;')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const active = connections.find((c) => c.id === activeId) ?? null

  const refreshSaved = useCallback(async () => {
    setSaved(await window.api.conn.list())
  }, [])

  useEffect(() => {
    refreshSaved().catch(() => {})
  }, [refreshSaved])

  const addActive = useCallback((c: ConnectionSummary) => {
    setConnections((prev) => [...prev.filter((x) => x.id !== c.id), c])
    setActiveId(c.id)
  }, [])

  const handleConnect = useCallback(
    async (config: ConnectionConfig, persist: boolean) => {
      await window.api.db.connect(config)
      if (persist) {
        await window.api.conn.save(config)
        await refreshSaved()
      }
      addActive({ id: config.id, name: config.name, kind: config.kind })
    },
    [addActive, refreshSaved]
  )

  const handleConnectSaved = useCallback(
    async (s: SavedConnection) => {
      await window.api.conn.connect(s.id)
      addActive({ id: s.id, name: s.name, kind: s.kind })
    },
    [addActive]
  )

  const handleDeleteSaved = useCallback(
    async (id: string) => {
      await window.api.conn.remove(id)
      await refreshSaved()
    },
    [refreshSaved]
  )

  const handleDisconnect = useCallback(async (id: string) => {
    await window.api.db.disconnect(id)
    setConnections((prev) => prev.filter((c) => c.id !== id))
    setActiveId((prev) => (prev === id ? null : prev))
  }, [])

  const runQuery = useCallback(async () => {
    if (!activeId) {
      setError('Conecte-se a um banco antes de executar.')
      return
    }
    setRunning(true)
    setError(null)
    try {
      const res = await window.api.db.query(activeId, sql)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setResult(null)
    } finally {
      setRunning(false)
    }
  }, [activeId, sql])

  return (
    <div className="app">
      <Sidebar
        connections={connections}
        saved={saved}
        activeId={activeId}
        onConnect={handleConnect}
        onConnectSaved={handleConnectSaved}
        onDeleteSaved={handleDeleteSaved}
        onSelect={setActiveId}
        onDisconnect={handleDisconnect}
        onInsertSql={setSql}
      />

      <main className="workspace">
        <div className="toolbar">
          <button className="run-btn" onClick={runQuery} disabled={!activeId || running}>
            {running ? 'Executando…' : '▶ Executar'}
          </button>
          <span className="hint">Ctrl/Cmd + Enter</span>
          <span className="conn-status">
            {active ? `● ${active.name} (${active.kind})` : '○ Sem conexão'}
          </span>
        </div>

        <div className="editor-pane">
          <SqlEditor value={sql} onChange={setSql} onRun={runQuery} />
        </div>

        <div className="results-pane">
          {error ? <pre className="error">{error}</pre> : <ResultsGrid result={result} />}
        </div>
      </main>
    </div>
  )
}
