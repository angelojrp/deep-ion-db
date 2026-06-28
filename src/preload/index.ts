import { contextBridge, ipcRenderer } from 'electron'
import type {
  AiChatMessage,
  AiSettingsInput,
  AppApi,
  ConnectionConfig,
  HistoryInput,
  ServerAuthApi,
  SqlStatement
} from '@shared/types'

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
      ipcRenderer.invoke('db:tableDdl', id, schema, table),
    activeSessions: (id: string) => ipcRenderer.invoke('db:activeSessions', id),
    killSession: (id: string, pid: string | number) =>
      ipcRenderer.invoke('db:killSession', id, pid),
    listRoles: (id: string) => ipcRenderer.invoke('db:listRoles', id),
    serverHealth: (id: string) => ipcRenderer.invoke('db:serverHealth', id),
    foreignKeys: (id: string) => ipcRenderer.invoke('db:foreignKeys', id),
    indexes: (id: string, schema: string, table: string) =>
      ipcRenderer.invoke('db:indexes', id, schema, table),
    routines: (id: string, schema: string) => ipcRenderer.invoke('db:routines', id, schema),
    jobs: (id: string) => ipcRenderer.invoke('db:jobs', id),
    backup: (id: string) => ipcRenderer.invoke('db:backup', id)
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
      ipcRenderer.invoke('ws:saveAs', defaultName, content),
    openFile: () => ipcRenderer.invoke('ws:openFile')
  },
  hist: {
    list: () => ipcRenderer.invoke('hist:list'),
    add: (entry: HistoryInput) => ipcRenderer.invoke('hist:add', entry),
    toggleFavorite: (id: string) => ipcRenderer.invoke('hist:toggleFavorite', id),
    remove: (id: string) => ipcRenderer.invoke('hist:remove', id),
    clear: () => ipcRenderer.invoke('hist:clear')
  },
  ai: {
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    setConfig: (input: AiSettingsInput) => ipcRenderer.invoke('ai:setConfig', input),
    chat: (messages: AiChatMessage[], system?: string) =>
      ipcRenderer.invoke('ai:chat', messages, system)
  }
}

// Modo servidor (#123): ponte de autenticação/sessões para o thin client.
const serverAuth: ServerAuthApi = {
  config: (serverUrl: string) => ipcRenderer.invoke('server:config', serverUrl),
  login: (serverUrl: string) => ipcRenderer.invoke('server:login', serverUrl),
  token: (serverUrl: string) => ipcRenderer.invoke('server:token', serverUrl),
  logout: (serverUrl: string) => ipcRenderer.invoke('server:logout', serverUrl),
  listSessions: () => ipcRenderer.invoke('server:listSessions'),
  saveSession: (label: string, serverUrl: string) =>
    ipcRenderer.invoke('server:saveSession', label, serverUrl),
  removeSession: (id: string) => ipcRenderer.invoke('server:removeSession', id)
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('serverAuth', serverAuth)
