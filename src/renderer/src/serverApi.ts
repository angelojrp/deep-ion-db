import type {
  AppApi,
  Capabilities,
  ColumnInfo,
  HistoryEntry,
  HistoryInput,
  QueryResult,
  SavedConnection,
  SchemaTable
} from '@shared/types'

/**
 * Modo servidor (#123): implementação de `AppApi` sobre HTTP para o desktop
 * operar como thin client de um servidor web Deep Ion DB. As credenciais dos
 * bancos ficam no servidor (modelo proxy): o desktop só envia SQL e o ID do
 * data source. Os arquivos de workspace continuam locais (delegados ao Electron).
 */

export const SERVER_CAPABILITIES: Capabilities = {
  adHocConnections: false,
  managedDataSources: true,
  workspaceFiles: true,
  backup: false,
  sessions: false,
  roles: false,
  health: false,
  jobs: false,
  erDiagram: false,
  schemaDiff: false,
  editableGrid: false,
  history: true,
  ai: false,
  exportResults: true,
  serverMode: true
}

interface ServerApiOptions {
  /** URL base do servidor (ex.: https://db.empresa.com). */
  serverUrl: string
  /** Token de acesso atual (`''` quando o servidor não exige auth). */
  getToken: () => string | null
  /** Chamado quando o servidor responde 401 (token expirado/ausente). */
  onUnauthorized: () => void
}

const unsupported = (feature: string): never => {
  throw new Error(`Recurso "${feature}" não está disponível no modo servidor.`)
}

// Histórico local (localStorage), por servidor — independe do backend.
function histKey(serverUrl: string): string {
  return `server.history.${serverUrl}`
}

export function createServerApi(opts: ServerApiOptions): AppApi {
  const base = opts.serverUrl.replace(/\/$/, '')

  async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const t = opts.getToken()
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(t ? { authorization: `Bearer ${t}` } : {}),
        ...(init.headers ?? {})
      }
    })
    if (res.status === 401) {
      opts.onUnauthorized()
      throw new Error('Sessão expirada. Faça login novamente no servidor.')
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null)
    if (!res.ok) {
      const msg = (data && (data.error as string)) || `HTTP ${res.status}`
      throw new Error(msg)
    }
    return data as T
  }

  function histRead(): HistoryEntry[] {
    try {
      return JSON.parse(localStorage.getItem(histKey(base)) ?? '[]') as HistoryEntry[]
    } catch {
      return []
    }
  }
  function histWrite(items: HistoryEntry[]): void {
    localStorage.setItem(histKey(base), JSON.stringify(items.slice(0, 200)))
  }

  const db: AppApi['db'] = {
    connect: async (config) => ({ id: config.id }),
    disconnect: async () => {},
    query: (id, sql) =>
      req<QueryResult>(`/api/data-sources/${id}/query`, {
        method: 'POST',
        body: JSON.stringify({ sql })
      }),
    listTables: async (id) =>
      (await req<{ tables: SchemaTable[] }>(`/api/data-sources/${id}/tables`, { method: 'POST' }))
        .tables,
    listColumns: async (id, schema, table) =>
      (
        await req<{ columns: ColumnInfo[] }>(`/api/data-sources/${id}/columns`, {
          method: 'POST',
          body: JSON.stringify({ schema, table })
        })
      ).columns,
    primaryKeys: async () => [],
    execBatch: async () => unsupported('edição na grade'),
    tableDdl: async (id, schema, table) => {
      const cols = await db.listColumns(id, schema, table)
      const lines = cols.map((c) => `  "${c.name}" ${c.dataType}${c.nullable ? '' : ' NOT NULL'}`)
      const qualified = schema && schema !== 'public' ? `"${schema}"."${table}"` : `"${table}"`
      return `CREATE TABLE ${qualified} (\n${lines.join(',\n')}\n);`
    },
    activeSessions: async () => unsupported('sessões'),
    killSession: async () => unsupported('sessões'),
    listRoles: async () => unsupported('usuários/roles'),
    serverHealth: async () => unsupported('saúde do servidor'),
    foreignKeys: async () => [],
    indexes: async () => [],
    routines: async () => [],
    jobs: async () => [],
    backup: async () => ({ ok: false, error: 'Backup não está disponível no modo servidor.' })
  }

  return {
    db,
    conn: {
      list: async () => {
        const { dataSources } = await req<{
          dataSources: { id: string; name: string; kind: string }[]
        }>('/api/data-sources')
        return dataSources.map((d): SavedConnection => ({
          id: d.id,
          name: d.name,
          kind: d.kind as SavedConnection['kind']
        }))
      },
      save: async () => unsupported('salvar conexão'),
      remove: async () => unsupported('remover conexão'),
      connect: async (id) => ({ id })
    },
    // Workspace local continua funcionando no desktop, mesmo em modo servidor.
    ws: window.api.ws,
    hist: {
      list: async () => histRead(),
      add: async (entry: HistoryInput) => {
        const e: HistoryEntry = { ...entry, id: crypto.randomUUID(), favorite: false }
        histWrite([e, ...histRead()])
        return e
      },
      toggleFavorite: async (id) => {
        histWrite(histRead().map((e) => (e.id === id ? { ...e, favorite: !e.favorite } : e)))
      },
      remove: async (id) => {
        histWrite(histRead().filter((e) => e.id !== id))
      },
      clear: async () => {
        histWrite(histRead().filter((e) => e.favorite))
      }
    },
    ai: {
      getConfig: async () => null,
      setConfig: async () => unsupported('configuração de IA'),
      setConsent: async () => unsupported('configuração de IA'),
      chat: async () => unsupported('IA')
    }
  }
}
