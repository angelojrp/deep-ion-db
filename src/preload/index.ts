import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi, ConnectionConfig, HistoryInput, SqlStatement } from '@shared/types'

const api: AppApi = {
  db: {
    connect: (config: ConnectionConfig) => ipcRenderer.invoke('db:connect', config),
    disconnect: (id: string) => ipcRenderer.invoke('db:disconnect', id),
    query: (id: string, sql: string) => ipcRenderer.invoke('db:query', id, sql),
    listTables: (id: string) => ipcRenderer.invoke('db:listTables', id),
    listColumns: (id: string, schema: string, table: string) =>
      ipcRenderer.invoke('db:listColumns', id, schema, table),
    primaryKeys: (id: string, schema: string, table: string) =>
      ipcRenderer.invoke('db:primaryKeys', id, schema, table),
    execBatch: (id: string, statements: SqlStatement[]) =>
      ipcRenderer.invoke('db:execBatch', id, statements),
    tableDdl: (id: string, schema: string, table: string) =>
      ipcRenderer.invoke('db:tableDdl', id, schema, table)
  },
  conn: {
    list: () => ipcRenderer.invoke('conn:list'),
    save: (config: ConnectionConfig) => ipcRenderer.invoke('conn:save', config),
    remove: (id: string) => ipcRenderer.invoke('conn:remove', id),
    connect: (id: string) => ipcRenderer.invoke('conn:connect', id)
  },
  ws: {
    open: () => ipcRenderer.invoke('ws:open'),
    current: () => ipcRenderer.invoke('ws:current'),
    refresh: () => ipcRenderer.invoke('ws:refresh'),
    read: (path: string) => ipcRenderer.invoke('ws:read', path),
    write: (path: string, content: string) => ipcRenderer.invoke('ws:write', path, content),
    create: (dir: string, name: string) => ipcRenderer.invoke('ws:create', dir, name),
    remove: (path: string) => ipcRenderer.invoke('ws:remove', path),
    saveAs: (defaultName: string, content: string) =>
      ipcRenderer.invoke('ws:saveAs', defaultName, content)
  },
  hist: {
    list: () => ipcRenderer.invoke('hist:list'),
    add: (entry: HistoryInput) => ipcRenderer.invoke('hist:add', entry),
    toggleFavorite: (id: string) => ipcRenderer.invoke('hist:toggleFavorite', id),
    remove: (id: string) => ipcRenderer.invoke('hist:remove', id),
    clear: () => ipcRenderer.invoke('hist:clear')
  }
}

contextBridge.exposeInMainWorld('api', api)
