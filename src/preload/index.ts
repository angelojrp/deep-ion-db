import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi, ConnectionConfig } from '@shared/types'

const api: AppApi = {
  db: {
    connect: (config: ConnectionConfig) => ipcRenderer.invoke('db:connect', config),
    disconnect: (id: string) => ipcRenderer.invoke('db:disconnect', id),
    query: (id: string, sql: string) => ipcRenderer.invoke('db:query', id, sql),
    listTables: (id: string) => ipcRenderer.invoke('db:listTables', id),
    listColumns: (id: string, schema: string, table: string) =>
      ipcRenderer.invoke('db:listColumns', id, schema, table)
  },
  conn: {
    list: () => ipcRenderer.invoke('conn:list'),
    save: (config: ConnectionConfig) => ipcRenderer.invoke('conn:save', config),
    remove: (id: string) => ipcRenderer.invoke('conn:remove', id),
    connect: (id: string) => ipcRenderer.invoke('conn:connect', id)
  }
}

contextBridge.exposeInMainWorld('api', api)
