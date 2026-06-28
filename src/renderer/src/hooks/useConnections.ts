import { useCallback, useState } from 'react'
import type { ConnectionConfig, ConnectionSummary, SavedConnection } from '@shared/types'
import { useApi } from '../api'
import type { EditorTab } from './useTabs'

export interface UseConnectionsOptions {
  updateActiveTab: (patch: Partial<EditorTab>) => void
  clearConnection: (connectionId: string) => void
}

export interface UseConnectionsReturn {
  connections: ConnectionSummary[]
  setConnections: React.Dispatch<React.SetStateAction<ConnectionSummary[]>>
  saved: SavedConnection[]
  setSaved: React.Dispatch<React.SetStateAction<SavedConnection[]>>
  refreshSaved: () => Promise<void>
  handleConnect: (config: ConnectionConfig, persist: boolean) => Promise<void>
  handleConnectSaved: (s: SavedConnection) => Promise<void>
  handleDeleteSaved: (id: string) => Promise<void>
  handleDisconnect: (id: string) => Promise<void>
}

export function useConnections({
  updateActiveTab,
  clearConnection
}: UseConnectionsOptions): UseConnectionsReturn {
  const api = useApi()
  const [connections, setConnections] = useState<ConnectionSummary[]>([])
  const [saved, setSaved] = useState<SavedConnection[]>([])

  const refreshSaved = useCallback(async () => {
    setSaved(await api.conn.list())
  }, [api])

  const targetNewConnection = useCallback(
    (c: ConnectionSummary) => {
      setConnections((prev) => [...prev.filter((x) => x.id !== c.id), c])
      updateActiveTab({ connectionId: c.id })
    },
    [updateActiveTab]
  )

  const handleConnect = useCallback(
    async (config: ConnectionConfig, persist: boolean) => {
      await api.db.connect(config)
      if (persist) {
        await api.conn.save(config)
        await refreshSaved()
      }
      targetNewConnection({ id: config.id, name: config.name, kind: config.kind })
    },
    [api, refreshSaved, targetNewConnection]
  )

  const handleConnectSaved = useCallback(
    async (s: SavedConnection) => {
      await api.conn.connect(s.id)
      targetNewConnection({ id: s.id, name: s.name, kind: s.kind })
    },
    [api, targetNewConnection]
  )

  const handleDeleteSaved = useCallback(
    async (id: string) => {
      await api.conn.remove(id)
      await refreshSaved()
    },
    [api, refreshSaved]
  )

  const handleDisconnect = useCallback(
    async (id: string) => {
      await api.db.disconnect(id)
      setConnections((prev) => prev.filter((c) => c.id !== id))
      clearConnection(id)
    },
    [api, clearConnection]
  )

  return {
    connections,
    setConnections,
    saved,
    setSaved,
    refreshSaved,
    handleConnect,
    handleConnectSaved,
    handleDeleteSaved,
    handleDisconnect
  }
}
