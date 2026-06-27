import { type JSX, useEffect, useState } from 'react'
import type { DbKind, QueryResult, SqlStatement } from '@shared/types'
import { toCsv, toJson } from '../export'

export interface EditContext {
  connectionId: string
  kind: DbKind
  schema: string
  table: string
  pkCols: string[]
}

interface Props {
  result: QueryResult | null
  edit?: EditContext | null
  onApplied?: () => void
}

type Row = Record<string, unknown>

function display(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function quoteIdent(kind: DbKind, id: string): string {
  if (kind === 'mysql') return '`' + id.replace(/`/g, '``') + '`'
  return '"' + id.replace(/"/g, '""') + '"'
}

function ph(kind: DbKind, i: number): string {
  return kind === 'postgres' ? `$${i}` : '?'
}

function qualified(ctx: EditContext): string {
  const t = quoteIdent(ctx.kind, ctx.table)
  return ctx.kind === 'sqlite' || ctx.schema === 'main'
    ? t
    : `${quoteIdent(ctx.kind, ctx.schema)}.${t}`
}

async function exportResult(result: QueryResult, kind: 'csv' | 'json'): Promise<void> {
  const content = kind === 'csv' ? toCsv(result) : toJson(result)
  await window.api.ws.saveAs(`export.${kind}`, content)
}

export default function ResultsGrid({ result, edit, onApplied }: Props): JSX.Element {
  const [editMode, setEditMode] = useState(false)
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({})
  const [deleted, setDeleted] = useState<Set<number>>(new Set())
  const [newRows, setNewRows] = useState<Record<string, string>[]>([])
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  useEffect(() => {
    setEditMode(false)
    setEdits({})
    setDeleted(new Set())
    setNewRows([])
    setApplyError(null)
  }, [result])

  if (!result) {
    return <div className="placeholder">Execute uma query para ver os resultados.</div>
  }
  if (result.columns.length === 0) {
    return (
      <div className="placeholder">
        OK — {result.rowCount} linha(s) afetada(s) em {Math.round(result.durationMs)} ms.
      </div>
    )
  }

  const cols = result.columns
  const rows = result.rows as Row[]
  const pendingCount =
    Object.values(edits).reduce((n, r) => n + Object.keys(r).length, 0) +
    deleted.size +
    newRows.length

  function setCell(rowIdx: number, col: string, value: string): void {
    setEdits((prev) => ({ ...prev, [rowIdx]: { ...prev[rowIdx], [col]: value } }))
  }

  function toggleDelete(rowIdx: number): void {
    setDeleted((prev) => {
      const next = new Set(prev)
      if (next.has(rowIdx)) next.delete(rowIdx)
      else next.add(rowIdx)
      return next
    })
  }

  function discard(): void {
    setEdits({})
    setDeleted(new Set())
    setNewRows([])
    setApplyError(null)
  }

  function buildStatements(ctx: EditContext): SqlStatement[] {
    const stmts: SqlStatement[] = []
    const table = qualified(ctx)

    // UPDATEs
    for (const [idxStr, changed] of Object.entries(edits)) {
      const idx = Number(idxStr)
      if (deleted.has(idx)) continue
      const changedCols = Object.keys(changed)
      if (changedCols.length === 0) continue
      const params: unknown[] = []
      let i = 1
      const setClause = changedCols
        .map((c) => {
          params.push(changed[c])
          return `${quoteIdent(ctx.kind, c)} = ${ph(ctx.kind, i++)}`
        })
        .join(', ')
      const whereClause = ctx.pkCols
        .map((c) => {
          params.push(rows[idx][c])
          return `${quoteIdent(ctx.kind, c)} = ${ph(ctx.kind, i++)}`
        })
        .join(' AND ')
      stmts.push({ sql: `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`, params })
    }

    // DELETEs
    for (const idx of deleted) {
      const params: unknown[] = []
      let i = 1
      const whereClause = ctx.pkCols
        .map((c) => {
          params.push(rows[idx][c])
          return `${quoteIdent(ctx.kind, c)} = ${ph(ctx.kind, i++)}`
        })
        .join(' AND ')
      stmts.push({ sql: `DELETE FROM ${table} WHERE ${whereClause}`, params })
    }

    // INSERTs
    for (const nr of newRows) {
      const entries = Object.entries(nr).filter(([, v]) => v !== '')
      if (entries.length === 0) continue
      const params: unknown[] = []
      let i = 1
      const colList = entries.map(([c]) => quoteIdent(ctx.kind, c)).join(', ')
      const valList = entries
        .map(([, v]) => {
          params.push(v)
          return ph(ctx.kind, i++)
        })
        .join(', ')
      stmts.push({ sql: `INSERT INTO ${table} (${colList}) VALUES (${valList})`, params })
    }

    return stmts
  }

  async function apply(): Promise<void> {
    if (!edit) return
    const stmts = buildStatements(edit)
    if (stmts.length === 0) {
      setEditMode(false)
      return
    }
    setApplying(true)
    setApplyError(null)
    try {
      await window.api.db.execBatch(edit.connectionId, stmts)
      discard()
      setEditMode(false)
      onApplied?.()
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  const canEdit = !!edit && edit.pkCols.length > 0

  return (
    <div className="grid-wrap">
      <div className="grid-status">
        <span>
          {result.rowCount} linha(s) • {Math.round(result.durationMs)} ms
          {edit && edit.pkCols.length === 0 && ' • (sem PK: somente leitura)'}
        </span>
        <span className="grid-actions">
          {canEdit && !editMode && (
            <button className="link" onClick={() => setEditMode(true)}>
              ✎ Editar
            </button>
          )}
          {editMode && (
            <>
              <button className="link" onClick={() => setNewRows((p) => [...p, {}])}>
                ＋ linha
              </button>
              <button className="link" onClick={apply} disabled={applying}>
                {applying ? '…' : `Salvar (${pendingCount})`}
              </button>
              <button className="link" onClick={discard} disabled={applying}>
                Descartar
              </button>
            </>
          )}
          <button className="link" onClick={() => exportResult(result, 'csv')}>
            CSV
          </button>
          <button className="link" onClick={() => exportResult(result, 'json')}>
            JSON
          </button>
        </span>
      </div>
      {applyError && <pre className="error">{applyError}</pre>}
      <div className="grid-scroll">
        <table className="grid">
          <thead>
            <tr>
              {editMode && <th className="row-action" />}
              {cols.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={deleted.has(idx) ? 'row-deleted' : undefined}>
                {editMode && (
                  <td className="row-action">
                    <button
                      className="link"
                      title={deleted.has(idx) ? 'Desfazer exclusão' : 'Excluir linha'}
                      onClick={() => toggleDelete(idx)}
                    >
                      {deleted.has(idx) ? '↺' : '×'}
                    </button>
                  </td>
                )}
                {cols.map((c) => {
                  const edited = edits[idx]?.[c]
                  const value = edited ?? display(row[c])
                  return (
                    <td key={c}>
                      {editMode ? (
                        <input
                          className="cell-input"
                          value={value}
                          disabled={deleted.has(idx)}
                          onChange={(e) => setCell(idx, c, e.target.value)}
                        />
                      ) : row[c] === null || row[c] === undefined ? (
                        <span className="null">NULL</span>
                      ) : (
                        display(row[c])
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {editMode &&
              newRows.map((nr, ni) => (
                <tr key={`new-${ni}`} className="row-new">
                  <td className="row-action">
                    <button
                      className="link"
                      title="Remover"
                      onClick={() => setNewRows((p) => p.filter((_, i) => i !== ni))}
                    >
                      ×
                    </button>
                  </td>
                  {cols.map((c) => (
                    <td key={c}>
                      <input
                        className="cell-input"
                        value={nr[c] ?? ''}
                        placeholder="NULL"
                        onChange={(e) =>
                          setNewRows((p) =>
                            p.map((r, i) => (i === ni ? { ...r, [c]: e.target.value } : r))
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
