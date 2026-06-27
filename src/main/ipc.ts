import { ipcMain } from 'electron'
import { DbManager } from './db/manager'
import type { ConnectionConfig } from './db/types'

const manager = new DbManager()

/** Registra os handlers IPC do banco. Os erros são propagados ao renderer. */
export function registerDbIpc(): void {
  ipcMain.handle('db:connect', (_e, config: ConnectionConfig) => manager.connect(config))
  ipcMain.handle('db:disconnect', (_e, id: string) => manager.disconnect(id))
  ipcMain.handle('db:query', (_e, id: string, sql: string) => manager.query(id, sql))
  ipcMain.handle('db:listTables', (_e, id: string) => manager.listTables(id))
  ipcMain.handle('db:listColumns', (_e, id: string, schema: string, table: string) =>
    manager.listColumns(id, schema, table)
  )
}

export function shutdownDb(): Promise<void> {
  return manager.disconnectAll()
}
