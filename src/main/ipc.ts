import { ipcMain } from 'electron'
import { DbManager } from './db/manager'
import { ConnectionStore } from './connectionStore'
import { HistoryStore } from './historyStore'
import * as ws from './workspace'
import type { ConnectionConfig, HistoryInput } from './db/types'

const manager = new DbManager()
const store = new ConnectionStore()
const history = new HistoryStore()

/** Registra os handlers IPC do banco. Os erros são propagados ao renderer. */
export function registerDbIpc(): void {
  store.load()
  history.load()

  ipcMain.handle('db:connect', (_e, config: ConnectionConfig) => manager.connect(config))
  ipcMain.handle('db:disconnect', (_e, id: string) => manager.disconnect(id))
  ipcMain.handle('db:query', (_e, id: string, sql: string) => manager.query(id, sql))
  ipcMain.handle('db:listTables', (_e, id: string) => manager.listTables(id))
  ipcMain.handle('db:listColumns', (_e, id: string, schema: string, table: string) =>
    manager.listColumns(id, schema, table)
  )

  // Conexões salvas (senha criptografada, nunca exposta ao renderer).
  ipcMain.handle('conn:list', () => store.list())
  ipcMain.handle('conn:save', (_e, config: ConnectionConfig) => store.save(config))
  ipcMain.handle('conn:remove', (_e, id: string) => store.remove(id))
  ipcMain.handle('conn:connect', (_e, id: string) => {
    const config = store.getConfig(id)
    if (!config) throw new Error('Conexão salva não encontrada.')
    return manager.connect(config)
  })

  // Workspace local (arquivos .sql/.md).
  ipcMain.handle('ws:open', () => ws.openWorkspace())
  ipcMain.handle('ws:current', () => ws.currentWorkspace())
  ipcMain.handle('ws:refresh', () => ws.refreshWorkspace())
  ipcMain.handle('ws:read', (_e, path: string) => ws.readFile(path))
  ipcMain.handle('ws:write', (_e, path: string, content: string) => ws.writeFile(path, content))
  ipcMain.handle('ws:create', (_e, dir: string, name: string) => ws.createFile(dir, name))
  ipcMain.handle('ws:remove', (_e, path: string) => ws.removeEntry(path))
  ipcMain.handle('ws:saveAs', (_e, defaultName: string, content: string) =>
    ws.saveAs(defaultName, content)
  )

  // Histórico de queries.
  ipcMain.handle('hist:list', () => history.list())
  ipcMain.handle('hist:add', (_e, entry: HistoryInput) => history.add(entry))
  ipcMain.handle('hist:toggleFavorite', (_e, id: string) => history.toggleFavorite(id))
  ipcMain.handle('hist:remove', (_e, id: string) => history.remove(id))
  ipcMain.handle('hist:clear', () => history.clear())
}

export function shutdownDb(): Promise<void> {
  return manager.disconnectAll()
}
