import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
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

/** Cria um McpServer pronto para conectar a um transport, usando o driver fornecido. */
export function createMcpServer(driver: Driver): McpServer {
  const server = new McpServer({ name: 'deep-ion-db', version: '0.1.0' })

  server.tool('list_tables', 'Lista tabelas e views do banco.', {}, async () =>
    text(await driver.listTables())
  )

  server.tool(
    'list_columns',
    'Lista colunas de uma tabela.',
    { schema: z.string(), table: z.string() },
    async ({ schema, table }) => text(await driver.listColumns(schema, table))
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

  return server
}
