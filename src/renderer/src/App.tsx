import {
  type JSX,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import type { AppApi, ConnectionSummary, WsEntry } from '@shared/types'
import Sidebar from './components/Sidebar'
import SqlEditor, { type SqlEditorApi } from './components/SqlEditor'
import ResultsGrid, { type EditContext } from './components/ResultsGrid'
import Tabs from './components/Tabs'
import MarkdownView from './components/MarkdownView'
import HistoryPanel from './components/HistoryPanel'
import SessionsPanel from './components/SessionsPanel'
import RolesPanel from './components/RolesPanel'
import HealthPanel from './components/HealthPanel'
import AiSettingsPanel from './components/AiSettingsPanel'
import AiAssistantPanel from './components/AiAssistantPanel'
import DiffPanel from './components/DiffPanel'
import FeedbackModal from './components/FeedbackModal'
import JobsPanel from './components/JobsPanel'
import { setActiveSchema, setCompletionApi } from './sqlCompletion'
import { useApi, useCaps } from './api'
import { useTabs, baseName, kindFromName, createTab } from './hooks/useTabs'
import { useConnections } from './hooks/useConnections'
import type { SchemaTable, Workspace } from '@shared/types'

/** Detecta uma tabela única em um SELECT simples (sem JOIN) para edição na grade. */
function parseTable(sql: string): { schema?: string; table: string } | null {
  const s = sql.trim().replace(/;+\s*$/, '')
  if (!/^select\b/i.test(s)) return null
  if (/\bjoin\b/i.test(s)) return null
  const m = /\bfrom\s+("?[\w]+"?)(?:\s*\.\s*("?[\w]+"?))?/i.exec(s)
  if (!m) return null
  const unq = (x: string): string => x.replace(/"/g, '')
  return m[2] ? { schema: unq(m[1]), table: unq(m[2]) } : { table: unq(m[1]) }
}

/** Monta o contexto de edição (tabela + PK) se a query for editável; senão null. */
async function computeEditCtx(
  api: AppApi,
  connectionId: string,
  kind: ConnectionSummary['kind'] | undefined,
  sql: string,
  columns: string[]
): Promise<EditContext | null> {
  if (!kind) return null
  const parsed = parseTable(sql)
  if (!parsed) return null
  const schema =
    parsed.schema ?? (kind === 'sqlite' ? 'main' : kind === 'postgres' ? 'public' : null)
  if (!schema) return null
  try {
    const pk = await api.db.primaryKeys(connectionId, schema, parsed.table)
    const pkCols = pk.every((c) => columns.includes(c)) ? pk : []
    return { connectionId, kind, schema, table: parsed.table, pkCols }
  } catch {
    return null
  }
}

export default function App(): JSX.Element {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const [showRoles, setShowRoles] = useState(false)
  const [showHealth, setShowHealth] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [showJobs, setShowJobs] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])
  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark'

  const editorApi = useRef<SqlEditorApi | null>(null)
  const schemaCache = useRef(new Map<string, SchemaTable[]>())
  const api = useApi()
  const caps = useCaps()

  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    updateTab,
    updateActiveTab,
    newTab,
    closeTab,
    openDoc,
    clearConnection
  } = useTabs()

  const {
    connections,
    saved,
    refreshSaved,
    handleConnect,
    handleConnectSaved,
    handleDeleteSaved,
    handleDisconnect
  } = useConnections({ updateActiveTab, clearConnection })

  const activeConn = connections.find((c) => c.id === activeTab?.connectionId) ?? null

  // Injeta a API no autocomplete (desktop: window.api; web: cliente HTTP).
  useEffect(() => {
    setCompletionApi(api)
  }, [api])

  // Altura (px) da área do editor; o restante fica para os resultados (sempre visíveis).
  const [editorHeight, setEditorHeight] = useState<number>(() => {
    const v = Number(localStorage.getItem('editorHeight'))
    return v >= 80 ? v : 320
  })
  useEffect(() => {
    localStorage.setItem('editorHeight', String(editorHeight))
  }, [editorHeight])

  function startResize(e: ReactMouseEvent): void {
    e.preventDefault()
    const startY = e.clientY
    const startH = editorHeight
    const onMove = (ev: MouseEvent): void => {
      const max = Math.max(120, window.innerHeight - 220)
      setEditorHeight(Math.min(max, Math.max(80, startH + (ev.clientY - startY))))
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    refreshSaved().catch(() => {})
    api.ws
      .current()
      .then((w) => setWorkspace(w))
      .catch(() => {})
  }, [api, refreshSaved])

  // Alimenta o autocomplete com o schema da conexão da aba ativa.
  const tabConnId = activeTab?.connectionId ?? null
  const tabKind = activeConn?.kind ?? null
  useEffect(() => {
    if (!tabConnId) {
      setActiveSchema(null, null, [])
      return
    }
    const cached = schemaCache.current.get(tabConnId)
    if (cached) {
      setActiveSchema(tabConnId, tabKind, cached)
      return
    }
    let cancelled = false
    api.db
      .listTables(tabConnId)
      .then((ts) => {
        if (cancelled) return
        schemaCache.current.set(tabConnId, ts)
        setActiveSchema(tabConnId, tabKind, ts)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [api, tabConnId, tabKind])

  const runQuery = useCallback(async () => {
    if (!activeTab) return
    if (!activeTab.connectionId) {
      updateTab(activeTab.id, { error: 'Selecione uma conexão para esta aba.' })
      return
    }
    const { id, connectionId, content } = activeTab
    const sql = editorApi.current?.getRunText()?.trim() || content
    const conn = connections.find((c) => c.id === connectionId)
    updateTab(id, { running: true, error: null })
    try {
      const res = await api.db.query(connectionId, sql)
      const editCtx = await computeEditCtx(api, connectionId, conn?.kind, sql, res.columns)
      updateTab(id, { result: res, running: false, editCtx })
      void api.hist.add({
        sql,
        connectionName: conn?.name ?? '—',
        kind: conn?.kind,
        ts: Date.now(),
        durationMs: res.durationMs,
        rowCount: res.rowCount,
        ok: true
      })
    } catch (e) {
      updateTab(id, {
        error: e instanceof Error ? e.message : String(e),
        result: null,
        running: false,
        editCtx: null
      })
      void api.hist.add({
        sql,
        connectionName: conn?.name ?? '—',
        kind: conn?.kind,
        ts: Date.now(),
        durationMs: 0,
        rowCount: 0,
        ok: false
      })
    }
  }, [api, activeTab, updateTab, connections])

  const explainQuery = useCallback(async () => {
    if (!activeTab?.connectionId) {
      updateActiveTab({ error: 'Selecione uma conexão para esta aba.' })
      return
    }
    const base = editorApi.current?.getRunText()?.trim() || activeTab.content
    const prefix = activeConn?.kind === 'sqlite' ? 'EXPLAIN QUERY PLAN ' : 'EXPLAIN '
    const { id, connectionId } = activeTab
    updateTab(id, { running: true, error: null })
    try {
      const res = await api.db.query(connectionId, prefix + base)
      updateTab(id, { result: res, running: false, editCtx: null })
    } catch (e) {
      updateTab(id, {
        error: e instanceof Error ? e.message : String(e),
        result: null,
        running: false,
        editCtx: null
      })
    }
  }, [api, activeTab, activeConn, updateTab, updateActiveTab])

  // ----- Workspace -----
  const openWorkspace = useCallback(async () => {
    const w = await api.ws.open()
    if (w) setWorkspace(w)
  }, [api])

  const refreshWorkspace = useCallback(async () => {
    setWorkspace(await api.ws.refresh())
  }, [api])

  const openFile = useCallback(
    async (entry: WsEntry) => {
      const existing = tabs.find((t) => t.filePath === entry.path)
      if (existing) {
        setActiveTabId(existing.id)
        return
      }
      const content = await api.ws.read(entry.path)
      const tab = {
        ...createTab(entry.name, kindFromName(entry.name)),
        filePath: entry.path,
        content,
        connectionId: activeTab?.connectionId ?? null,
        dirty: false
      }
      setTabs((prev) => [...prev, tab])
      setActiveTabId(tab.id)
    },
    [api, tabs, activeTab, setTabs, setActiveTabId]
  )

  const saveActive = useCallback(async () => {
    if (!activeTab) return
    if (activeTab.filePath) {
      await api.ws.write(activeTab.filePath, activeTab.content)
      updateTab(activeTab.id, { dirty: false })
    } else {
      const def = `${activeTab.title}.${activeTab.kind === 'markdown' ? 'md' : 'sql'}`
      const path = await api.ws.saveAs(def, activeTab.content)
      if (path) {
        updateTab(activeTab.id, { filePath: path, title: baseName(path), dirty: false })
        await refreshWorkspace()
      }
    }
  }, [api, activeTab, updateTab, refreshWorkspace])

  const newFile = useCallback(
    async (dir: string) => {
      const name = window.prompt('Nome do arquivo (ex.: consulta.sql ou notas.md):')
      if (!name) return
      const entry = await api.ws.create(dir, name)
      await refreshWorkspace()
      await openFile(entry)
    },
    [api, refreshWorkspace, openFile]
  )

  const deleteFile = useCallback(
    async (entry: WsEntry) => {
      if (!window.confirm(`Excluir "${entry.name}"?`)) return
      await api.ws.remove(entry.path)
      setTabs((prev) => prev.filter((t) => t.filePath !== entry.path))
      await refreshWorkspace()
    },
    [api, refreshWorkspace, setTabs]
  )

  const onContentChange = useCallback(
    (content: string) => updateActiveTab({ content, dirty: true }),
    [updateActiveTab]
  )

  const generateEr = useCallback(async () => {
    const cid = activeTab?.connectionId
    if (!cid) return
    const [tables, fks] = await Promise.all([api.db.listTables(cid), api.db.foreignKeys(cid)])
    const san = (s: string): string => s.replace(/[^a-zA-Z0-9_]/g, '_')
    const lines = [
      '# Diagrama ER',
      '',
      '> Renderiza em visualizadores compatíveis com Mermaid (GitHub, VS Code, etc.).',
      '',
      '```mermaid',
      'erDiagram'
    ]
    for (const t of tables) lines.push(`  ${san(t.name)} {`, `  }`)
    for (const fk of fks)
      lines.push(`  ${san(fk.refTable)} ||--o{ ${san(fk.table)} : "${fk.column}"`)
    lines.push('```')
    openDoc('er.md', lines.join('\n'))
  }, [api, activeTab, openDoc])

  return (
    <div className="app">
      <Sidebar
        connections={connections}
        saved={saved}
        activeId={activeTab?.connectionId ?? null}
        workspace={workspace}
        onConnect={handleConnect}
        onConnectSaved={handleConnectSaved}
        onDeleteSaved={handleDeleteSaved}
        onSelect={(id) => updateActiveTab({ connectionId: id })}
        onDisconnect={handleDisconnect}
        onInsertSql={(sql) => updateActiveTab({ content: sql, dirty: true })}
        onOpenWorkspace={openWorkspace}
        onRefreshWorkspace={refreshWorkspace}
        onOpenFile={openFile}
        onNewFile={newFile}
        onDeleteFile={deleteFile}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main className="workspace">
        <Tabs
          tabs={tabs.map((t) => ({ id: t.id, title: t.title, dirty: t.dirty }))}
          activeId={activeTabId}
          onSelect={setActiveTabId}
          onClose={closeTab}
          onNew={newTab}
          onFeedback={() => setShowFeedback(true)}
        />

        {activeTab?.kind === 'markdown' ? (
          <MarkdownView
            key={activeTab.id}
            value={activeTab.content}
            onChange={onContentChange}
            onSave={saveActive}
            theme={monacoTheme}
          />
        ) : (
          <div className="sql-pane">
            <div className="toolbar">
              <button
                className="run-btn"
                onClick={runQuery}
                disabled={!activeTab?.connectionId || activeTab?.running}
              >
                {activeTab?.running ? 'Executando…' : '▶ Executar'}
              </button>
              <button
                className="ghost-btn"
                onClick={explainQuery}
                disabled={!activeTab?.connectionId || activeTab?.running}
                title="Mostrar o plano de execução (EXPLAIN)"
              >
                Explain
              </button>
              <button
                className="ghost-btn"
                onClick={() => editorApi.current?.format()}
                title="Formatar SQL (Ctrl/Cmd + Shift + F)"
              >
                Formatar
              </button>
              {caps.history && (
                <button
                  className="ghost-btn"
                  onClick={() => setShowHistory(true)}
                  title="Histórico de queries"
                >
                  🕘 Histórico
                </button>
              )}
              {caps.sessions && (
                <button
                  className="ghost-btn"
                  onClick={() => setShowSessions(true)}
                  disabled={!activeTab?.connectionId}
                  title="Sessões ativas no servidor"
                >
                  Sessões
                </button>
              )}
              {caps.roles && (
                <button
                  className="ghost-btn"
                  onClick={() => setShowRoles(true)}
                  disabled={!activeTab?.connectionId}
                  title="Usuários e roles"
                >
                  Usuários
                </button>
              )}
              {caps.health && (
                <button
                  className="ghost-btn"
                  onClick={() => setShowHealth(true)}
                  disabled={!activeTab?.connectionId}
                  title="Saúde do servidor"
                >
                  Saúde
                </button>
              )}
              {caps.schemaDiff && (
                <button
                  className="ghost-btn"
                  onClick={() => setShowDiff(true)}
                  disabled={connections.length < 2}
                  title="Comparar schemas (requer 2 conexões)"
                >
                  Diff
                </button>
              )}
              {caps.erDiagram && (
                <button
                  className="ghost-btn"
                  onClick={generateEr}
                  disabled={!activeTab?.connectionId}
                  title="Diagrama ER (Mermaid)"
                >
                  ER
                </button>
              )}
              {caps.jobs && (
                <button
                  className="ghost-btn"
                  onClick={() => setShowJobs(true)}
                  disabled={!activeTab?.connectionId}
                  title="Jobs agendados"
                >
                  Jobs
                </button>
              )}
              {caps.backup && (
                <button
                  className="ghost-btn"
                  onClick={async () => {
                    const cid = activeTab?.connectionId
                    if (!cid) return
                    const r = await api.db.backup(cid)
                    if (r.ok) window.alert(`Backup salvo em ${r.path}`)
                    else if (r.error) window.alert('Backup falhou: ' + r.error)
                  }}
                  disabled={!activeTab?.connectionId}
                  title="Backup do banco (pg_dump/mysqldump/cópia)"
                >
                  Backup
                </button>
              )}
              {caps.ai && (
                <button
                  className="ghost-btn"
                  onClick={() => setShowAssistant(true)}
                  title="Assistente IA (NL→SQL, explicar, chat)"
                >
                  ✨ Assistente
                </button>
              )}
              {caps.ai && (
                <button
                  className="ghost-btn"
                  onClick={() => setShowAi(true)}
                  title="Configuração de IA"
                >
                  IA
                </button>
              )}
              <span className="hint">Ctrl/Cmd + Enter · seleção/statement</span>
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

            <div className="editor-pane" style={{ flex: `0 0 ${editorHeight}px` }}>
              {activeTab && (
                <SqlEditor
                  key={activeTab.id}
                  value={activeTab.content}
                  onChange={onContentChange}
                  onRun={runQuery}
                  onSave={saveActive}
                  dialect={activeConn?.kind}
                  theme={monacoTheme}
                  apiRef={editorApi}
                />
              )}
            </div>

            <div
              className="pane-resizer"
              onMouseDown={startResize}
              title="Arraste para redimensionar"
              role="separator"
              aria-orientation="horizontal"
            />

            <div className="results-pane">
              {activeTab?.error ? (
                <pre className="error">{activeTab.error}</pre>
              ) : (
                <ResultsGrid
                  result={activeTab?.result ?? null}
                  edit={activeTab?.editCtx ?? null}
                  onApplied={runQuery}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          onPick={(sql) => updateActiveTab({ content: sql, dirty: true })}
        />
      )}

      {showSessions && activeTab?.connectionId && (
        <SessionsPanel
          connectionId={activeTab.connectionId}
          onClose={() => setShowSessions(false)}
        />
      )}

      {showRoles && activeTab?.connectionId && (
        <RolesPanel
          connectionId={activeTab.connectionId}
          onInsertSql={(sql) => updateActiveTab({ content: sql, dirty: true })}
          onClose={() => setShowRoles(false)}
        />
      )}

      {showHealth && activeTab?.connectionId && (
        <HealthPanel connectionId={activeTab.connectionId} onClose={() => setShowHealth(false)} />
      )}

      {showAi && <AiSettingsPanel onClose={() => setShowAi(false)} />}

      {showDiff && (
        <DiffPanel
          connections={connections}
          onOpenDoc={openDoc}
          onClose={() => setShowDiff(false)}
        />
      )}

      {showJobs && activeTab?.connectionId && (
        <JobsPanel connectionId={activeTab.connectionId} onClose={() => setShowJobs(false)} />
      )}

      {showAssistant && (
        <AiAssistantPanel
          connectionId={activeTab?.connectionId ?? null}
          kind={activeConn?.kind}
          currentSql={activeTab?.content ?? ''}
          onInsertSql={(sql) => updateActiveTab({ content: sql, dirty: true })}
          onOpenDoc={openDoc}
          onClose={() => setShowAssistant(false)}
        />
      )}

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  )
}
