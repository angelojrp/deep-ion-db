import { type JSX, useState } from 'react'
import type { ConnectionSummary, SchemaTable } from '@shared/types'
import { useApi } from '../api'

interface Props {
  connections: ConnectionSummary[]
  onOpenDoc: (title: string, content: string) => void
  onClose: () => void
}

function key(t: SchemaTable): string {
  return `${t.schema}.${t.name}`
}

export default function DiffPanel({ connections, onOpenDoc, onClose }: Props): JSX.Element {
  const [a, setA] = useState(connections[0]?.id ?? '')
  const [b, setB] = useState(connections[1]?.id ?? connections[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const api = useApi()

  async function compare(): Promise<void> {
    if (!a || !b || a === b) {
      setErr('Escolha duas conexões diferentes (origem e alvo).')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const [ta, tb] = await Promise.all([api.db.listTables(a), api.db.listTables(b)])
      const mapB = new Map(tb.map((t) => [key(t), t]))
      const mapA = new Map(ta.map((t) => [key(t), t]))
      const lines: string[] = [
        `# Diff de schema\n`,
        `Origem → Alvo. Aplicar no **alvo** para igualar à origem.\n`
      ]

      const onlyA = ta.filter((t) => !mapB.has(key(t)))
      const onlyB = tb.filter((t) => !mapA.has(key(t)))
      if (onlyA.length) {
        lines.push('## Tabelas ausentes no alvo (criar)')
        onlyA.forEach((t) => lines.push(`- ${key(t)}`))
        lines.push('')
      }
      if (onlyB.length) {
        lines.push('## Tabelas extra no alvo (remover?)')
        onlyB.forEach((t) => lines.push(`- ${key(t)}`))
        lines.push('')
      }

      const common = ta.filter((t) => mapB.has(key(t))).slice(0, 50)
      const colDiff: string[] = []
      for (const t of common) {
        const [ca, cb] = await Promise.all([
          api.db.listColumns(a, t.schema, t.name),
          api.db.listColumns(b, t.schema, t.name)
        ])
        const cbNames = new Map(cb.map((c) => [c.name, c]))
        const caNames = new Map(ca.map((c) => [c.name, c]))
        const qualified = t.schema === 'main' ? t.name : `${t.schema}.${t.name}`
        for (const c of ca) {
          if (!cbNames.has(c.name))
            colDiff.push(`ALTER TABLE ${qualified} ADD COLUMN ${c.name} ${c.dataType};`)
          else if (cbNames.get(c.name)!.dataType !== c.dataType)
            colDiff.push(
              `-- ${qualified}.${c.name}: tipo difere (origem ${c.dataType} / alvo ${cbNames.get(c.name)!.dataType})`
            )
        }
        for (const c of cb) {
          if (!caNames.has(c.name)) colDiff.push(`ALTER TABLE ${qualified} DROP COLUMN ${c.name};`)
        }
      }
      if (colDiff.length) {
        lines.push('## Diferenças de colunas (script sugerido)\n')
        lines.push('```sql', ...colDiff, '```')
      }
      if (!onlyA.length && !onlyB.length && !colDiff.length) lines.push('Schemas equivalentes ✓')

      onOpenDoc('diff-schema.md', lines.join('\n'))
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
        style={{ width: 'min(520px, 92vw)' }}
      >
        <div className="modal-head">
          <strong>Comparar schemas (diff)</strong>
          <button className="icon-btn" title="Fechar" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="conn-form" style={{ padding: 14 }}>
          <label>
            Origem
            <select value={a} onChange={(e) => setA(e.target.value)}>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind})
                </option>
              ))}
            </select>
          </label>
          <label>
            Alvo
            <select value={b} onChange={(e) => setB(e.target.value)}>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind})
                </option>
              ))}
            </select>
          </label>
          <button onClick={compare} disabled={busy}>
            {busy ? 'Comparando…' : 'Comparar'}
          </button>
          {err && <p className="form-error">{err}</p>}
        </div>
      </div>
    </div>
  )
}
