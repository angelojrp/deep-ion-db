import { type JSX, useCallback, useState } from 'react'
import type { ConnectionConfig, QueryResult } from '@shared/types'
import Sidebar from './components/Sidebar'
import SqlEditor from './components/SqlEditor'
import ResultsGrid from './components/ResultsGrid'

export default function App(): JSX.Element {
  const [connections, setConnections] = useState<ConnectionConfig[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sql, setSql] = useState('SELECT 1 AS hello;')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const active = connections.find((c) => c.id === activeId) ?? null

  const handleConnect = useCallback(async (config: ConnectionConfig) => {
    await window.api.db.connect(config)
    setConnections((prev) => [...prev.filter((c) => c.id !== config.id), config])
    setActiveId(config.id)
  }, [])

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
        activeId={activeId}
        onConnect={handleConnect}
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
