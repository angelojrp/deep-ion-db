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
 * Implementação de AppApi sobre HTTP (modo web), falando com o backend Fastify.
 * Os data sources gerenciados são apresentados à UI como conexões já salvas.
 * Recursos não suportados no web são gateados por capabilities (ver WEB_CAPABILITIES);
 * os métodos correspondentes lançam erro caso sejam chamados mesmo assim.
 */

function token(): string {
  return localStorage.getItem('token') ?? ''
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const t = token()
  const res = await fetch(path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(t ? { authorization: `Bearer ${t}` } : {}),
      ...(opts.headers ?? {})
    }
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const msg = (data && (data.error as string)) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data as T
}

const unsupported = (feature: string): never => {
  throw new Error(`Recurso "${feature}" não está disponível no modo web.`)
}

// Histórico local (localStorage) — funciona no navegador sem backend dedicado.
const HIST_KEY = 'web.history'
function histRead(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]') as HistoryEntry[]
  } catch {
    return []
  }
}
function histWrite(items: HistoryEntry[]): void {
  localStorage.setItem(HIST_KEY, JSON.stringify(items.slice(0, 200)))
}

export const WEB_CAPABILITIES: Capabilities = {
  adHocConnections: false,
  managedDataSources: true,
  workspaceFiles: false,
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
  serverMode: false
}

export const httpApi: AppApi = {
  db: {
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
      const cols = await httpApi.db.listColumns(id, schema, table)
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
    backup: async () => ({ ok: false, error: 'Backup não está disponível no modo web.' })
  },
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
  ws: {
    open: async () => null,
    current: async () => null,
    refresh: async () => null,
    read: async () => unsupported('arquivos do workspace'),
    write: async () => unsupported('arquivos do workspace'),
    create: async () => unsupported('arquivos do workspace'),
    remove: async () => unsupported('arquivos do workspace'),
    // Exportar resultados: download no navegador.
    saveAs: async (defaultName, content) => {
      const blob = new Blob([content], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      a.click()
      URL.revokeObjectURL(url)
      return defaultName
    },
    openFile: async () => null
  },
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
    chat: async () => unsupported('IA')
  }
}
