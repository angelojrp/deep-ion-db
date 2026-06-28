import { type JSX, useEffect, useState } from 'react'
import type { AiChatMessage, DbKind } from '@shared/types'
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

  useEffect(() => {
    if (!connectionId) return
    window.api.db
      .listTables(connectionId)
      .then((t) => setSchemaText(schemaContext(t)))
      .catch(() => {})
  }, [connectionId])

  async function run(system: string, messages: AiChatMessage[], asSql: boolean): Promise<void> {
    setBusy(true)
    setErr(null)
    try {
      const reply = await window.api.ai.chat(messages, system)
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

    if (mode === 'sql') {
      const system = nlToSqlSystem(dialect)
      const user = `${schemaText}\n\nPedido: ${prompt}`
      await run(system, [{ role: 'user', content: user }], true)
    } else {
      const system = dbaChatSystem(dialect, schemaText)
      const history: AiChatMessage[] = [
        ...turns.map((t) => ({ role: t.role, content: t.text })),
        { role: 'user', content: prompt }
      ]
      await run(system, history, false)
    }
  }

  async function explainCurrent(): Promise<void> {
    if (!currentSql.trim()) return
    setTurns((t) => [...t, { role: 'user', text: 'Explique a query atual.' }])
    await run(explainSqlSystem(), [{ role: 'user', content: currentSql }], false)
  }

  async function optimizeCurrent(): Promise<void> {
    if (!currentSql.trim() || !connectionId) return
    setTurns((t) => [...t, { role: 'user', text: 'Otimize a query atual.' }])
    setBusy(true)
    setErr(null)
    try {
      const prefix = kind === 'sqlite' ? 'EXPLAIN QUERY PLAN ' : 'EXPLAIN '
      let plan = '(plano indisponível)'
      try {
        const res = await window.api.db.query(connectionId, prefix + currentSql)
        plan = JSON.stringify(res.rows).slice(0, 4000)
      } catch {
        /* segue sem plano */
      }
      const user = `Schema:\n${schemaText}\n\nQuery:\n${currentSql}\n\nPlano (EXPLAIN):\n${plan}`
      const reply = await window.api.ai.chat(
        [{ role: 'user', content: user }],
        optimizeSqlSystem(dialect)
      )
      setTurns((t) => [...t, { role: 'assistant', text: reply }])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function diagnose(): Promise<void> {
    if (!connectionId) return
    setBusy(true)
    setErr(null)
    try {
      const [health, sessions] = await Promise.all([
        window.api.db.serverHealth(connectionId),
        window.api.db.activeSessions(connectionId)
      ])
      const user =
        `Métricas de saúde:\n${health.map((m) => `${m.label}: ${m.value}`).join('\n')}\n\n` +
        `Sessões ativas (${sessions.length}):\n` +
        sessions
          .slice(0, 20)
          .map((s) => `pid=${s.pid} estado=${s.state ?? '-'} dur=${s.durationMs ?? '-'}ms`)
          .join('\n')
      const reply = await window.api.ai.chat(
        [{ role: 'user', content: user }],
        diagnoseSystem(dialect)
      )
      onOpenDoc('diagnostico-ia.md', reply)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function documentSchema(): Promise<void> {
    if (!connectionId) return
    setBusy(true)
    setErr(null)
    try {
      const tables = await window.api.db.listTables(connectionId)
      const lines: string[] = []
      for (const t of tables.slice(0, 15)) {
        const cols = await window.api.db.listColumns(connectionId, t.schema, t.name)
        const qualified = t.schema && t.schema !== 'main' ? `${t.schema}.${t.name}` : t.name
        lines.push(`${qualified}: ${cols.map((c) => `${c.name} ${c.dataType}`).join(', ')}`)
      }
      const user = `Schema (${dialect}):\n${lines.join('\n')}`
      const reply = await window.api.ai.chat(
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
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(720px, 94vw)' }}
      >
        <div className="modal-head">
          <strong>Assistente IA — DBA ({dialect})</strong>
          <span className="head-actions">
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
  )
}
