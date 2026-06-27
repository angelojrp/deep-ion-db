import { ipcMain } from 'electron'
import { DbManager } from './db/manager'
import { ConnectionStore } from './connectionStore'
import type { ConnectionConfig } from './db/types'

const manager = new DbManager()
const store = new ConnectionStore()

/** Registra os handlers IPC do banco. Os erros são propagados ao renderer. */
export function registerDbIpc(): void {
  store.load()

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
}

export function shutdownDb(): Promise<void> {
  return manager.disconnectAll()
}
