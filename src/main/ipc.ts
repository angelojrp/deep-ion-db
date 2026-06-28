import { dialog, ipcMain } from 'electron'
import { DbManager } from './db/manager'
import { runBackup } from './backup'
import { ConnectionStore } from './connectionStore'
import { HistoryStore } from './historyStore'
import * as ws from './workspace'
import * as ai from './aiSettings'
import type { ConnectionConfig, HistoryInput, SqlStatement } from './db/types'
import type { AiChatMessage, AiSettingsInput, QueryResult } from '@shared/types'

const ROW_LIMIT = 10_000

const manager = new DbManager()
const store = new ConnectionStore()
const history = new HistoryStore()

/** Registra os handlers IPC do banco. Os erros são propagados ao renderer. */
export function registerDbIpc(): void {
  store.load()
  history.load()
  ai.loadAiSettings()

  ipcMain.handle('db:connect', (_e, config: ConnectionConfig) => manager.connect(config))
  ipcMain.handle('db:disconnect', (_e, id: string) => manager.disconnect(id))
  ipcMain.handle('db:query', async (_e, id: string, sql: string): Promise<QueryResult> => {
    const result = await manager.query(id, sql)
    if (result.rows.length > ROW_LIMIT) {
      const totalRows = result.rows.length
      return {
        ...result,
        rows: result.rows.slice(0, ROW_LIMIT),
        rowCount: ROW_LIMIT,
        truncated: true,
        totalRows
      }
    }
    return result
  })
  ipcMain.handle('db:listTables', (_e, id: string) => manager.listTables(id))
  ipcMain.handle('db:listColumns', (_e, id: string, schema: string, table: string) =>
    manager.listColumns(id, schema, table)
  )
  ipcMain.handle('db:primaryKeys', (_e, id: string, schema: string, table: string) =>
    manager.primaryKeys(id, schema, table)
  )
  ipcMain.handle('db:execBatch', (_e, id: string, statements: SqlStatement[]) =>
    manager.execBatch(id, statements)
  )
  ipcMain.handle('db:tableDdl', (_e, id: string, schema: string, table: string) =>
    manager.tableDdl(id, schema, table)
  )
  ipcMain.handle('db:activeSessions', (_e, id: string) => manager.activeSessions(id))
  ipcMain.handle('db:killSession', (_e, id: string, pid: string | number) =>
    manager.killSession(id, pid)
  )
  ipcMain.handle('db:listRoles', (_e, id: string) => manager.listRoles(id))
  ipcMain.handle('db:serverHealth', (_e, id: string) => manager.serverHealth(id))
  ipcMain.handle('db:foreignKeys', (_e, id: string) => manager.foreignKeys(id))
  ipcMain.handle('db:indexes', (_e, id: string, schema: string, table: string) =>
    manager.indexes(id, schema, table)
  )
  ipcMain.handle('db:routines', (_e, id: string, schema: string) => manager.routines(id, schema))
  ipcMain.handle('db:jobs', (_e, id: string) => manager.jobs(id))
  ipcMain.handle('db:backup', async (_e, id: string) => {
    const config = manager.getConfig(id)
    if (!config) return { ok: false, error: 'Conexão não encontrada.' }
    const def =
      config.kind === 'sqlite' ? `${config.name}.db` : `${config.database ?? config.name}.sql`
    const res = await dialog.showSaveDialog({ title: 'Salvar backup', defaultPath: def })
    if (res.canceled || !res.filePath) return { ok: false }
    try {
      await runBackup(config, res.filePath)
      return { ok: true, path: res.filePath }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

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
  ipcMain.handle('ws:openFile', () => ws.openTextFile())

  // Integração com IA (config + chat). A chave fica só no main.
  ipcMain.handle('ai:getConfig', () => ai.getPublicConfig())
  ipcMain.handle('ai:setConfig', (_e, input: AiSettingsInput) => ai.setConfig(input))
  ipcMain.handle('ai:setConsent', () => ai.setConsent())
  ipcMain.handle('ai:chat', (_e, messages: AiChatMessage[], system?: string) =>
    ai.chat(messages, system)
  )

  // Streaming incremental (issue #143).
  ipcMain.handle('ai:stream', async (event, messages: AiChatMessage[], system?: string) => {
    try {
      await ai.chatStream(
        messages,
        (token) => {
          if (!event.sender.isDestroyed()) event.sender.send('ai:token', token)
        },
        system
      )
      if (!event.sender.isDestroyed()) event.sender.send('ai:done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!event.sender.isDestroyed()) event.sender.send('ai:error', msg)
    }
  })
  ipcMain.handle('ai:cancelStream', () => {
    ai.cancelStream()
  })

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
