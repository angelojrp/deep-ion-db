import { useCallback, useState } from 'react'
import type { QueryResult } from '@shared/types'
import type { EditContext } from '../components/ResultsGrid'

export type TabKind = 'sql' | 'markdown'

export interface EditorTab {
  id: string
  title: string
  kind: TabKind
  filePath: string | null
  connectionId: string | null
  content: string
  result: QueryResult | null
  error: string | null
  running: boolean
  dirty: boolean
  editCtx: EditContext | null
}

export function createTab(title: string, kind: TabKind = 'sql'): EditorTab {
  return {
    id: crypto.randomUUID(),
    title,
    kind,
    filePath: null,
    connectionId: null,
    content: kind === 'sql' ? 'SELECT 1 AS hello;' : '# Notas\n',
    result: null,
    error: null,
    running: false,
    dirty: false,
    editCtx: null
  }
}

export function baseName(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

export function kindFromName(name: string): TabKind {
  return /\.(md|markdown)$/i.test(name) ? 'markdown' : 'sql'
}

export interface UseTabsReturn {
  tabs: EditorTab[]
  setTabs: React.Dispatch<React.SetStateAction<EditorTab[]>>
  activeTabId: string
  setActiveTabId: (id: string) => void
  activeTab: EditorTab | null
  updateTab: (id: string, patch: Partial<EditorTab>) => void
  updateActiveTab: (patch: Partial<EditorTab>) => void
  newTab: () => void
  closeTab: (id: string) => void
  openDoc: (title: string, content: string) => void
  clearConnection: (connectionId: string) => void
}

export function useTabs(): UseTabsReturn {
  const [tabs, setTabs] = useState<EditorTab[]>(() => [createTab('Query 1')])
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? '')

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null

  const updateTab = useCallback((id: string, patch: Partial<EditorTab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const updateActiveTab = useCallback(
    (patch: Partial<EditorTab>) => {
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

  const openDoc = useCallback((title: string, content: string) => {
    setTabs((prev) => {
      const tab = { ...createTab(title, 'markdown'), content }
      setActiveTabId(tab.id)
      return [...prev, tab]
    })
  }, [])

  const clearConnection = useCallback((connectionId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.connectionId === connectionId ? { ...t, connectionId: null } : t))
    )
  }, [])

  return {
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
  }
}
