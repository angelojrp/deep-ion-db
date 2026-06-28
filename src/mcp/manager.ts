import http from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { DbKind } from '../shared/types'
import type { DbManager } from '../main/db/manager'
import { createMcpServer } from './server'

/**
 * Gerencia o ciclo de vida do servidor MCP HTTP embutido no processo Electron.
 * Permite iniciar/parar um servidor MCP para qualquer conexão ativa.
 */

export interface McpStatus {
  running: boolean
  port?: number
  kind?: DbKind
  connectionId?: string
}

interface McpState {
  port: number
  kind: DbKind
  connectionId: string
  httpServer: http.Server
  transport: StreamableHTTPServerTransport
}

let current: McpState | null = null

/** Inicia o servidor MCP para a conexão informada. Para o anterior se já houver um ativo. */
export async function startMcpForConnection(
  connectionId: string,
  dbManager: DbManager
): Promise<{ port: number }> {
  // Para o servidor anterior, se existir.
  await stopMcp()

  const driver = dbManager.getDriver(connectionId)
  if (!driver) throw new Error('Conexão não encontrada ou não está ativa.')

  const config = dbManager.getConfig(connectionId)
  if (!config) throw new Error('Configuração da conexão não encontrada.')

  const mcpServer = createMcpServer(driver)

  // Modo stateless — sem sessions; cada request é independente.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await mcpServer.connect(transport)

  const httpServer = http.createServer((req, res) => {
    transport.handleRequest(req, res).catch((err: unknown) => {
      console.error('[MCP] Erro ao processar request:', err)
      if (!res.headersSent) {
        res.writeHead(500).end('Internal Server Error')
      }
    })
  })

  const port = await new Promise<number>((resolve, reject) => {
    // Porta 0 = SO escolhe uma porta livre.
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address()
      if (addr && typeof addr === 'object') {
        resolve(addr.port)
      } else {
        reject(new Error('Não foi possível determinar a porta do servidor MCP.'))
      }
    })
    httpServer.once('error', reject)
  })

  current = { port, kind: config.kind, connectionId, httpServer, transport }
  return { port }
}

/** Para o servidor MCP em execução, se houver. */
export async function stopMcp(): Promise<void> {
  if (!current) return
  const { httpServer, transport } = current
  current = null
  await transport.close().catch(() => {})
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
}

/** Retorna o status atual do servidor MCP. */
export function getMcpStatus(): McpStatus {
  if (!current) return { running: false }
  return {
    running: true,
    port: current.port,
    kind: current.kind,
    connectionId: current.connectionId
  }
}
