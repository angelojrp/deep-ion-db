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
import Tabs from './components/Tabs'

interface QueryTab {
  id: string
  title: string
  connectionId: string | null
  sql: string
  result: QueryResult | null
  error: string | null
  running: boolean
}

function createTab(title: string): QueryTab {
  return {
    id: crypto.randomUUID(),
    title,
    connectionId: null,
    sql: 'SELECT 1 AS hello;',
    result: null,
    error: null,
    running: false
  }
}

export default function App(): JSX.Element {
  const [connections, setConnections] = useState<ConnectionSummary[]>([])
  const [saved, setSaved] = useState<SavedConnection[]>([])
  const [tabs, setTabs] = useState<QueryTab[]>(() => [createTab('Query 1')])
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? '')

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const activeConn = connections.find((c) => c.id === activeTab?.connectionId) ?? null

  const refreshSaved = useCallback(async () => {
    setSaved(await window.api.conn.list())
  }, [])

  useEffect(() => {
    refreshSaved().catch(() => {})
  }, [refreshSaved])

  const updateTab = useCallback((id: string, patch: Partial<QueryTab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const updateActiveTab = useCallback(
    (patch: Partial<QueryTab>) => {
      if (activeTabId) updateTab(activeTabId, patch)
    },
    [activeTabId, updateTab]
  )

  const newTab = useCallback(() => {
    setTabs((prev) => {
      const tab = createTab(`Query ${prev.length + 1}`)
      tab.connectionId = activeTab?.connectionId ?? null
      setActiveTabId(tab.id)
      return [...prev, tab]
    })
  }, [activeTab])

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id)
        const ensured = next.length ? next : [createTab('Query 1')]
        if (id === activeTabId) setActiveTabId(ensured[ensured.length - 1].id)
        return ensured
      })
    },
    [activeTabId]
  )

  const targetNewConnection = useCallback(
    (c: ConnectionSummary) => {
      setConnections((prev) => [...prev.filter((x) => x.id !== c.id), c])
      updateActiveTab({ connectionId: c.id })
    },
    [updateActiveTab]
  )

  const handleConnect = useCallback(
    async (config: ConnectionConfig, persist: boolean) => {
      await window.api.db.connect(config)
      if (persist) {
        await window.api.conn.save(config)
        await refreshSaved()
      }
      targetNewConnection({ id: config.id, name: config.name, kind: config.kind })
    },
    [refreshSaved, targetNewConnection]
  )

  const handleConnectSaved = useCallback(
    async (s: SavedConnection) => {
      await window.api.conn.connect(s.id)
      targetNewConnection({ id: s.id, name: s.name, kind: s.kind })
    },
    [targetNewConnection]
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
    setTabs((prev) => prev.map((t) => (t.connectionId === id ? { ...t, connectionId: null } : t)))
  }, [])

  const runQuery = useCallback(async () => {
    if (!activeTab) return
    if (!activeTab.connectionId) {
      updateTab(activeTab.id, { error: 'Selecione uma conexão para esta aba.' })
      return
    }
    const { id, connectionId, sql } = activeTab
    updateTab(id, { running: true, error: null })
    try {
      const res = await window.api.db.query(connectionId, sql)
      updateTab(id, { result: res, running: false })
    } catch (e) {
      updateTab(id, {
        error: e instanceof Error ? e.message : String(e),
        result: null,
        running: false
      })
    }
  }, [activeTab, updateTab])

  return (
    <div className="app">
      <Sidebar
        connections={connections}
        saved={saved}
        activeId={activeTab?.connectionId ?? null}
        onConnect={handleConnect}
        onConnectSaved={handleConnectSaved}
        onDeleteSaved={handleDeleteSaved}
        onSelect={(id) => updateActiveTab({ connectionId: id })}
        onDisconnect={handleDisconnect}
        onInsertSql={(sql) => updateActiveTab({ sql })}
      />

      <main className="workspace">
        <Tabs
          tabs={tabs.map((t) => ({ id: t.id, title: t.title }))}
          activeId={activeTabId}
          onSelect={setActiveTabId}
          onClose={closeTab}
          onNew={newTab}
        />

        <div className="toolbar">
          <button
            className="run-btn"
            onClick={runQuery}
            disabled={!activeTab?.connectionId || activeTab?.running}
          >
            {activeTab?.running ? 'Executando…' : '▶ Executar'}
          </button>
          <span className="hint">Ctrl/Cmd + Enter</span>
          <select
            className="conn-select"
            value={activeTab?.connectionId ?? ''}
            onChange={(e) => updateActiveTab({ connectionId: e.target.value || null })}
          >
            <option value="">— sem conexão —</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.kind})
              </option>
            ))}
          </select>
          <span className="conn-status">
            {activeConn ? `● ${activeConn.name}` : '○ Sem conexão'}
          </span>
        </div>

        <div className="editor-pane">
          {activeTab && (
            <SqlEditor
              key={activeTab.id}
              value={activeTab.sql}
              onChange={(sql) => updateActiveTab({ sql })}
              onRun={runQuery}
            />
          )}
        </div>

        <div className="results-pane">
          {activeTab?.error ? (
            <pre className="error">{activeTab.error}</pre>
          ) : (
            <ResultsGrid result={activeTab?.result ?? null} />
          )}
        </div>
      </main>
    </div>
  )
}
