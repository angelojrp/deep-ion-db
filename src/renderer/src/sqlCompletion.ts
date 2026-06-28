import type * as Monaco from 'monaco-editor'
import type { AppApi, ColumnInfo, DbKind, SchemaTable } from '@shared/types'

/** API de dados injetada (desktop: window.api; web: cliente HTTP). */
let apiRef: AppApi | null = null
export function setCompletionApi(api: AppApi): void {
  apiRef = api
}

interface SchemaState {
  connectionId: string | null
  kind: DbKind | null
  tables: SchemaTable[]
}

const state: SchemaState = { connectionId: null, kind: null, tables: [] }
const colCache = new Map<string, ColumnInfo[]>()

/** Atualiza o schema usado pelo autocomplete para a conexão da aba ativa. */
export function setActiveSchema(
  connectionId: string | null,
  kind: DbKind | null,
  tables: SchemaTable[]
): void {
  state.connectionId = connectionId
  state.kind = kind
  state.tables = tables
}

const KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'JOIN',
  'LEFT JOIN',
  'INNER JOIN',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'INSERT INTO',
  'UPDATE',
  'DELETE FROM',
  'VALUES',
  'SET',
  'AND',
  'OR',
  'NOT',
  'NULL',
  'IS NULL',
  'AS',
  'ON',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END'
]

async function getColumns(table: SchemaTable): Promise<ColumnInfo[]> {
  const key = `${state.connectionId}:${table.schema}.${table.name}`
  const cached = colCache.get(key)
  if (cached) return cached
  if (!state.connectionId || !apiRef) return []
  try {
    const cols = await apiRef.db.listColumns(state.connectionId, table.schema, table.name)
    colCache.set(key, cols)
    return cols
  } catch {
    return []
  }
}

let registered = false

/** Registra (uma vez) o provedor de autocomplete SQL no Monaco. */
export function registerSqlCompletion(monaco: typeof Monaco): void {
  if (registered) return
  registered = true

  monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' '],
    async provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }
      const lineToCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      })

      const suggestions: Monaco.languages.CompletionItem[] = []

      // "tabela." → colunas daquela tabela
      const dot = /([A-Za-z_][\w]*)\.\w*$/.exec(lineToCursor)
      if (dot) {
        const ref = dot[1].toLowerCase()
        const table = state.tables.find((t) => t.name.toLowerCase() === ref)
        if (table) {
          for (const c of await getColumns(table)) {
            suggestions.push({
              label: c.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: c.name,
              detail: `${c.dataType}${c.nullable ? ' · null' : ''}`,
              range
            })
          }
          return { suggestions }
        }
      }

      // tabelas/views
      for (const t of state.tables) {
        suggestions.push({
          label: t.schema && t.schema !== 'main' ? `${t.schema}.${t.name}` : t.name,
          kind: monaco.languages.CompletionItemKind.Struct,
          insertText: t.name,
          detail: t.type,
          range
        })
      }
      // palavras-chave
      for (const k of KEYWORDS) {
        suggestions.push({
          label: k,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: k,
          range
        })
      }
      return { suggestions }
    }
  })
}
