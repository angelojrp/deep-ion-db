import { type JSX, useCallback, useEffect, useRef, useState } from 'react'
import type { AIPublicConfig, AiChatMessage, DbKind } from '@shared/types'
import {
  dbaChatSystem,
  diagnoseSystem,
  explainSqlSystem,
  nlToSqlSystem,
  optimizeSqlSystem,
  schemaContext,
  schemaDocsSystem,
  stripCodeFences
} from '@ai/features'
import { useApi } from '../api'

interface Props {
  connectionId: string | null
  kind: DbKind | undefined
  currentSql: string
  onInsertSql: (sql: string) => void
  onOpenDoc: (title: string, content: string) => void
  onClose: () => void
}

type Mode = 'chat' | 'sql'

interface Turn {
  role: 'user' | 'assistant'
  text: string
  isSql?: boolean
}

/** Provedores que enviam dados a servidores externos e exigem consentimento. */
const CLOUD_PROVIDERS: ReadonlySet<string> = new Set(['anthropic', 'openai'])

function isCloudProvider(config: AIPublicConfig | null): boolean {
  if (!config) return false
  return CLOUD_PROVIDERS.has(config.kind)
}

function providerLabel(config: AIPublicConfig | null): string {
  if (!config) return ''
  switch (config.kind) {
    case 'anthropic':
      return 'Anthropic'
    case 'openai':
      return 'OpenAI'
    default:
      return config.kind
  }
}

/** Modal de consentimento de privacidade para provedores cloud. */
function ConsentModal({
  providerName,
  onAccept,
  onCancel
}: {
  providerName: string
  onAccept: () => void
  onCancel: () => void
}): JSX.Element {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(480px, 92vw)' }}
      >
        <div className="modal-head">
          <strong>Aviso de privacidade — {providerName}</strong>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Para responder às suas perguntas, o assistente enviará os seguintes metadados do banco
            para os servidores do <strong>{providerName}</strong>:
          </p>
          <ul style={{ marginBottom: 12, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Nomes de tabelas e schemas</li>
            <li>Tipos e nomes de colunas (DDL)</li>
            <li>Plano de execução de consultas (EXPLAIN)</li>
            <li>O texto da query ou pergunta que você digitar</li>
          </ul>
          <p style={{ marginBottom: 16, lineHeight: 1.5 }}>
            <strong>Não serão enviados</strong> dados ou linhas das suas tabelas. Você pode
            desativar o envio de schema e plano EXPLAIN nas <em>Configurações de IA</em>.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="ghost-btn" onClick={onCancel}>
              Cancelar
            </button>
            <button onClick={onAccept}>Entendi, continuar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AiAssistantPanel({
  connectionId,
  kind,
  currentSql,
  onInsertSql,
  onOpenDoc,
  onClose
}: Props): JSX.Element {
  const dialect = kind ?? 'SQL'
  const [schemaText, setSchemaText] = useState('(schema indisponível)')
  const [mode, setMode] = useState<Mode>('chat')
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [aiConfig, setAiConfig] = useState<AIPublicConfig | null>(null)
  const [showConsent, setShowConsent] = useState(false)
  /** Ação pendente enquanto o modal de consentimento está aberto. */
  const pendingAction = useRef<(() => Promise<void>) | null>(null)
  const api = useApi()

  useEffect(() => {
    if (!connectionId) return
    api.db
      .listTables(connectionId)
      .then((t) => setSchemaText(schemaContext(t)))
      .catch(() => {})
  }, [api, connectionId])

  useEffect(() => {
    api.ai
      .getConfig()
      .then(setAiConfig)
      .catch(() => {})
  }, [api])

  /** Garante consentimento antes de executar ação com provedor cloud. */
  const withConsent = useCallback(
    async (action: () => Promise<void>): Promise<void> => {
      if (!isCloudProvider(aiConfig)) {
        await action()
        return
      }
      if (aiConfig?.consentGiven) {
        await action()
        return
      }
      pendingAction.current = action
      setShowConsent(true)
    },
    [aiConfig]
  )

  async function handleConsentAccept(): Promise<void> {
    setShowConsent(false)
    try {
      const updated = await api.ai.setConsent()
      setAiConfig(updated)
    } catch {
      /* segue mesmo se falhar ao persistir */
    }
    if (pendingAction.current) {
      const action = pendingAction.current
      pendingAction.current = null
      await action()
    }
  }

  function handleConsentCancel(): void {
    setShowConsent(false)
    pendingAction.current = null
  }

  async function run(system: string, messages: AiChatMessage[], asSql: boolean): Promise<void> {
    setBusy(true)
    setErr(null)
    try {
      const reply = await api.ai.chat(messages, system)
      setTurns((t) => [
        ...t,
        { role: 'assistant', text: asSql ? stripCodeFences(reply) : reply, isSql: asSql }
      ])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function send(): Promise<void> {
    const prompt = input.trim()
    if (!prompt) return
    setInput('')
    setTurns((t) => [...t, { role: 'user', text: prompt }])

    await withConsent(async () => {
      if (mode === 'sql') {
        const ctx = aiConfig?.sendSchema !== false ? `${schemaText}\n\n` : ''
        const system = nlToSqlSystem(dialect)
        const user = `${ctx}Pedido: ${prompt}`
        await run(system, [{ role: 'user', content: user }], true)
      } else {
        const ctx =
          aiConfig?.sendSchema !== false ? schemaText : '(schema omitido por configuração)'
        const system = dbaChatSystem(dialect, ctx)
        const history: AiChatMessage[] = [
          ...turns.map((t) => ({ role: t.role, content: t.text })),
          { role: 'user', content: prompt }
        ]
        await run(system, history, false)
      }
    })
  }

  async function explainCurrent(): Promise<void> {
    if (!currentSql.trim()) return
    setTurns((t) => [...t, { role: 'user', text: 'Explique a query atual.' }])
    await withConsent(async () => {
      await run(explainSqlSystem(), [{ role: 'user', content: currentSql }], false)
    })
  }

  async function optimizeCurrent(): Promise<void> {
    if (!currentSql.trim() || !connectionId) return
    setTurns((t) => [...t, { role: 'user', text: 'Otimize a query atual.' }])
    await withConsent(async () => {
      setBusy(true)
      setErr(null)
      try {
        let planPart = ''
        if (aiConfig?.sendExplain !== false) {
          const prefix = kind === 'sqlite' ? 'EXPLAIN QUERY PLAN ' : 'EXPLAIN '
          try {
            const res = await api.db.query(connectionId, prefix + currentSql)
            const plan = JSON.stringify(res.rows).slice(0, 4000)
            planPart = `\n\nPlano (EXPLAIN):\n${plan}`
          } catch {
            planPart = '\n\nPlano (EXPLAIN): (indisponível)'
          }
        }
        const schemaPart = aiConfig?.sendSchema !== false ? `Schema:\n${schemaText}\n\n` : ''
        const user = `${schemaPart}Query:\n${currentSql}${planPart}`
        const reply = await api.ai.chat(
          [{ role: 'user', content: user }],
          optimizeSqlSystem(dialect)
        )
        setTurns((t) => [...t, { role: 'assistant', text: reply }])
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })
  }

  async function diagnose(): Promise<void> {
    if (!connectionId) return
    await withConsent(async () => {
      setBusy(true)
      setErr(null)
      try {
        const [health, sessions] = await Promise.all([
          api.db.serverHealth(connectionId),
          api.db.activeSessions(connectionId)
        ])
        const user =
          `Métricas de saúde:\n${health.map((m) => `${m.label}: ${m.value}`).join('\n')}\n\n` +
          `Sessões ativas (${sessions.length}):\n` +
          sessions
            .slice(0, 20)
            .map((s) => `pid=${s.pid} estado=${s.state ?? '-'} dur=${s.durationMs ?? '-'}ms`)
            .join('\n')
        const reply = await api.ai.chat([{ role: 'user', content: user }], diagnoseSystem(dialect))
        onOpenDoc('diagnostico-ia.md', reply)
        onClose()
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })
  }

  async function documentSchema(): Promise<void> {
    if (!connectionId) return
    await withConsent(async () => {
      setBusy(true)
      setErr(null)
      try {
        const tables = await api.db.listTables(connectionId)
        const lines: string[] = []
        for (const t of tables.slice(0, 15)) {
          const cols = await api.db.listColumns(connectionId, t.schema, t.name)
          const qualified = t.schema && t.schema !== 'main' ? `${t.schema}.${t.name}` : t.name
          lines.push(`${qualified}: ${cols.map((c) => `${c.name} ${c.dataType}`).join(', ')}`)
        }
        const user = `Schema (${dialect}):\n${lines.join('\n')}`
        const reply = await api.ai.chat(
          [{ role: 'user', content: user }],
          schemaDocsSystem(dialect)
        )
        onOpenDoc('schema.md', reply)
        onClose()
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })
  }

  const providerName = providerLabel(aiConfig)
  const isCloud = isCloudProvider(aiConfig)

  return (
    <>
      {showConsent && (
        <ConsentModal
          providerName={providerName}
          onAccept={() => void handleConsentAccept()}
          onCancel={handleConsentCancel}
        />
      )}
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal"
          onClick={(e) => e.stopPropagation()}
          style={{ width: 'min(720px, 94vw)' }}
        >
          <div className="modal-head">
            <strong>Assistente IA — DBA ({dialect})</strong>
            <span className="head-actions">
              {isCloud && aiConfig && (
                <span
                  title={`Contexto enviado para ${providerName}${aiConfig.sendSchema ? ' · schema' : ''}${aiConfig.sendExplain ? ' · EXPLAIN' : ''}`}
                  style={{
                    fontSize: 11,
                    color: 'var(--muted, #888)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid var(--border, #444)',
                    cursor: 'default',
                    userSelect: 'none'
                  }}
                >
                  🔒 {providerName}
                </span>
              )}
              <button className="icon-btn" title="Limpar" onClick={() => setTurns([])}>
                🗑
              </button>
              <button className="icon-btn" title="Fechar" onClick={onClose}>
                ×
              </button>
            </span>
          </div>

          <div className="modal-tools">
            <div className="seg">
              <button className={mode === 'chat' ? 'on' : ''} onClick={() => setMode('chat')}>
                Chat
              </button>
              <button className={mode === 'sql' ? 'on' : ''} onClick={() => setMode('sql')}>
                NL→SQL
              </button>
            </div>
            <button
              className="ghost-btn"
              onClick={explainCurrent}
              disabled={busy || !currentSql.trim()}
            >
              Explicar
            </button>
            <button
              className="ghost-btn"
              onClick={optimizeCurrent}
              disabled={busy || !currentSql.trim() || !connectionId}
            >
              Otimizar
            </button>
            <button className="ghost-btn" onClick={diagnose} disabled={busy || !connectionId}>
              Diagnóstico
            </button>
            <button className="ghost-btn" onClick={documentSchema} disabled={busy || !connectionId}>
              Documentar schema
            </button>
          </div>

          <div className="ai-chat">
            {turns.length === 0 && (
              <div className="explorer-empty">
                {mode === 'sql'
                  ? 'Descreva em linguagem natural o que você quer consultar.'
                  : 'Pergunte algo sobre o banco conectado.'}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`ai-turn ${t.role}`}>
                <div className="ai-role">{t.role === 'user' ? 'Você' : 'IA'}</div>
                <pre className="ai-text">{t.text}</pre>
                {t.role === 'assistant' && t.isSql && (
                  <button className="link" onClick={() => onInsertSql(t.text)}>
                    ⤵ Inserir no editor
                  </button>
                )}
              </div>
            ))}
            {busy && <div className="explorer-empty">pensando…</div>}
            {err && <pre className="error">{err}</pre>}
          </div>

          <div className="ai-input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === 'sql' ? 'ex.: total de pedidos por cliente no último mês' : 'Pergunte…'
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button onClick={send} disabled={busy || !input.trim()}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
