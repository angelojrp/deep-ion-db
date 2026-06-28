import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { PostgresDriver } from '../main/db/drivers/postgres'
import type { ConnectionConfig } from '../main/db/types'

/**
 * Servidor MCP (issue #30) — expõe um PostgreSQL como tools para agentes de IA
 * (Claude Code, etc.), em modo SOMENTE LEITURA. Reaproveita o PostgresDriver.
 *
 * Config por variáveis de ambiente:
 *   DEEPION_DB_HOST, DEEPION_DB_PORT, DEEPION_DB_USER, DEEPION_DB_PASSWORD, DEEPION_DB_NAME
 */

const READONLY = /^\s*(select|with|explain|show)\b/i

function configFromEnv(): ConnectionConfig {
  return {
    id: 'mcp',
    name: 'mcp',
    kind: 'postgres',
    host: process.env.DEEPION_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DEEPION_DB_PORT ?? 5432),
    user: process.env.DEEPION_DB_USER,
    password: process.env.DEEPION_DB_PASSWORD,
    database: process.env.DEEPION_DB_NAME
  }
}

function text(value: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }]
  }
}

async function main(): Promise<void> {
  const driver = new PostgresDriver(configFromEnv())
  await driver.connect()

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
    'Executa uma consulta SOMENTE LEITURA (SELECT/WITH/EXPLAIN/SHOW) e retorna até 200 linhas.',
    { sql: z.string() },
    async ({ sql }) => {
      if (!READONLY.test(sql)) {
        return {
          content: [{ type: 'text', text: 'Permitido apenas SELECT/WITH/EXPLAIN/SHOW.' }],
          isError: true
        }
      }
      const r = await driver.query(sql)
      return text({ columns: r.columns, rows: r.rows.slice(0, 200), rowCount: r.rowCount })
    }
  )

  await server.connect(new StdioServerTransport())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
