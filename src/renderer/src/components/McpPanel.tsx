import { type JSX, useState } from 'react'
import type { DbKind } from '@shared/types'
import { useApi } from '../api'

interface McpStatus {
  running: boolean
  port?: number
  kind?: DbKind
  connectionId?: string
}

interface Props {
  activeId: string | null
  mcpStatus: McpStatus
  mcpBusy: boolean
  onStart: () => Promise<void>
  onStop: () => Promise<void>
  onStatusRefresh: () => Promise<void>
}

export default function McpPanel({
  activeId,
  mcpStatus,
  mcpBusy,
  onStart,
  onStop,
  onStatusRefresh
}: Props): JSX.Element | null {
  const api = useApi()
  const [configuring, setConfiguring] = useState(false)
  const [configResult, setConfigResult] = useState<string | null>(null)

  if (!activeId) return null

  const isActiveConn = mcpStatus.running && mcpStatus.connectionId === activeId
  const mcpUrl = isActiveConn ? `http://localhost:${mcpStatus.port}/mcp` : null
  const cliCommand = mcpUrl ? `claude mcp add deep-ion-db --sse ${mcpUrl}` : null

  async function handleCopy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard não disponível
    }
  }

  async function handleConfigureClaudeCode(): Promise<void> {
    setConfiguring(true)
    setConfigResult(null)
    try {
      const result = await api.mcp.configureClaudeCode()
      setConfigResult(`Configurado em ${result.path}. Rode /mcp no Claude Code para verificar.`)
      await onStatusRefresh()
    } catch (err) {
      setConfigResult(err instanceof Error ? err.message : String(err))
    } finally {
      setConfiguring(false)
    }
  }

  return (
    <div className="mcp-panel">
      <div className="mcp-panel-header">
        <span className="mcp-panel-title">Claude Code MCP</span>
        {isActiveConn ? (
          <span className="mcp-indicator mcp-indicator--active" title="Servidor MCP ativo">
            ●
          </span>
        ) : (
          <span className="mcp-indicator mcp-indicator--idle" title="Servidor MCP inativo">
            ○
          </span>
        )}
      </div>

      {isActiveConn ? (
        <>
          <div className="mcp-info-row">
            <span className="mcp-label">Porta:</span>
            <span className="mcp-value">{mcpStatus.port}</span>
          </div>

          <div className="mcp-copy-row">
            <code className="mcp-url">{mcpUrl}</code>
            <button
              className="mcp-copy-btn"
              title="Copiar URL"
              onClick={() => void handleCopy(mcpUrl!)}
            >
              📋
            </button>
          </div>

          <div className="mcp-copy-row mcp-cli-row">
            <code className="mcp-cli">{cliCommand}</code>
            <button
              className="mcp-copy-btn"
              title="Copiar comando CLI"
              onClick={() => void handleCopy(cliCommand!)}
            >
              📋
            </button>
          </div>

          <div className="mcp-actions">
            <button
              className="mcp-btn mcp-btn--primary"
              disabled={configuring}
              onClick={() => void handleConfigureClaudeCode()}
              title="Adiciona automaticamente em ~/.claude.json"
            >
              {configuring ? '…' : '⚡ Configurar Claude Code'}
            </button>
            <button
              className="mcp-btn mcp-btn--stop"
              disabled={mcpBusy}
              onClick={() => void onStop()}
            >
              {mcpBusy ? '…' : 'Parar MCP'}
            </button>
          </div>

          {configResult && <p className="mcp-config-result">{configResult}</p>}
        </>
      ) : (
        <button
          className="mcp-btn mcp-btn--start"
          disabled={mcpBusy}
          onClick={() => void onStart()}
          title="Inicia servidor MCP para esta conexão"
        >
          {mcpBusy ? '…' : '⚡ Habilitar MCP para IA'}
        </button>
      )}
    </div>
  )
}
