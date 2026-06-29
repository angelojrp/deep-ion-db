import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { DbKind } from '../shared/types'
import type { Driver } from '../main/db/types'

/**
 * Servidor MCP (issue #30 / #146) — expõe qualquer banco suportado como tools
 * para agentes de IA (Claude Code, etc.), em modo SOMENTE LEITURA.
 * O driver é injetado de fora (dependency injection); sem acoplamento ao PostgreSQL.
 */

/**
 * Rejeita SQL com múltiplos statements (ex.: SELECT 1; DROP TABLE users).
 * Remove o ponto-e-vírgula final (opcional) antes de verificar.
 */
function hasMultipleStatements(sql: string): boolean {
  const withoutTrailingSemicolon = sql.trimEnd().replace(/;\s*$/, '')
  return /;\s*\S/.test(withoutTrailingSemicolon)
}

function text(value: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }]
  }
}

/** Prefixo EXPLAIN adequado ao dialeto do banco. */
function explainPrefix(kind: DbKind): string {
  if (kind === 'postgres') return 'EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS) '
  if (kind === 'sqlite') return 'EXPLAIN QUERY PLAN '
  return 'EXPLAIN '
}

/** Cria um McpServer pronto para conectar a um transport, usando o driver fornecido. */
export function createMcpServer(driver: Driver, kind: DbKind = 'postgres'): McpServer {
  const server = new McpServer({ name: 'deep-ion-db', version: '0.1.0' })

  server.tool('list_tables', 'Lista tabelas e views do banco.', {}, async () =>
    text(await driver.listTables())
  )

  server.tool('list_schemas', 'Lista schemas (namespaces) disponíveis no banco.', {}, async () => {
    const tables = await driver.listTables()
    const schemas = [...new Set(tables.map((t) => t.schema).filter(Boolean))]
    return text(schemas)
  })

  server.tool(
    'list_columns',
    'Lista colunas de uma tabela.',
    { schema: z.string(), table: z.string() },
    async ({ schema, table }) => text(await driver.listColumns(schema, table))
  )

  server.tool(
    'describe_table',
    'Descreve uma tabela em detalhes: colunas, tipos, PKs, FKs e índices.',
    { schema: z.string(), table: z.string() },
    async ({ schema, table }) => {
      const [columns, primaryKeys, indexes, allForeignKeys] = await Promise.all([
        driver.listColumns(schema, table),
        driver.primaryKeys(schema, table),
        driver.indexes(schema, table),
        driver.foreignKeys()
      ])
      const foreignKeys = allForeignKeys.filter(
        (fk) => fk.table === table || fk.table === `${schema}.${table}`
      )
      return text({ schema, table, columns, primaryKeys, indexes, foreignKeys })
    }
  )

  server.tool(
    'get_table_ddl',
    'Retorna o DDL completo (CREATE TABLE ...) de uma tabela.',
    { schema: z.string(), table: z.string() },
    async ({ schema, table }) => text(await driver.tableDdl(schema, table))
  )

  server.tool(
    'query',
    'Executa uma consulta SOMENTE LEITURA e retorna até 200 linhas. Multi-statements são proibidos.',
    { sql: z.string() },
    async ({ sql }) => {
      if (hasMultipleStatements(sql)) {
        return {
          content: [
            {
              type: 'text',
              text: 'Multi-statements são proibidos no modo somente leitura. Envie um único statement por vez.'
            }
          ],
          isError: true
        }
      }
      const r = await driver.query(sql)
      return text({ columns: r.columns, rows: r.rows.slice(0, 200), rowCount: r.rowCount })
    }
  )

  server.tool(
    'explain_query',
    'Retorna o plano de execução (EXPLAIN ANALYZE) de uma query SQL para análise de performance.',
    { sql: z.string() },
    async ({ sql }) => {
      if (hasMultipleStatements(sql)) {
        return {
          content: [{ type: 'text', text: 'Multi-statements não são permitidos.' }],
          isError: true
        }
      }
      const r = await driver.query(`${explainPrefix(kind)}${sql}`)
      return text({ columns: r.columns, rows: r.rows })
    }
  )

  return server
}
