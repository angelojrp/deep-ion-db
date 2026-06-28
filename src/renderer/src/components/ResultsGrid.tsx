import { type JSX, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { AppApi, DbKind, QueryResult, SqlStatement } from '@shared/types'
import { toCsv, toJson } from '../export'
import { useApi, useCaps } from '../api'

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

async function exportResult(api: AppApi, result: QueryResult, kind: 'csv' | 'json'): Promise<void> {
  const content = kind === 'csv' ? toCsv(result) : toJson(result)
  await api.ws.saveAs(`export.${kind}`, content)
}

const ROW_HEIGHT = 32

export default function ResultsGrid({ result, edit, onApplied }: Props): JSX.Element {
  const [editMode, setEditMode] = useState(false)
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({})
  const [deleted, setDeleted] = useState<Set<number>>(new Set())
  const [newRows, setNewRows] = useState<Record<string, string>[]>([])
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const api = useApi()
  const caps = useCaps()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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
      await api.db.execBatch(edit.connectionId, stmts)
      discard()
      setEditMode(false)
      onApplied?.()
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  const canEdit = caps.editableGrid && !!edit && edit.pkCols.length > 0

  // Virtual scrolling is only active when not in edit mode (edit mode adds new rows dynamically)
  const useVirtual = !editMode

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: useVirtual
  })

  const virtualItems = useVirtual ? rowVirtualizer.getVirtualItems() : null
  const totalVirtualSize = useVirtual ? rowVirtualizer.getTotalSize() : 0

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
          {caps.exportResults && (
            <>
              <button className="link" onClick={() => exportResult(api, result, 'csv')}>
                CSV
              </button>
              <button className="link" onClick={() => exportResult(api, result, 'json')}>
                JSON
              </button>
            </>
          )}
        </span>
      </div>
      {result.truncated && (
        <div
          style={{
            padding: '6px 12px',
            background: 'var(--color-warning-bg, #fff8e1)',
            color: 'var(--color-warning-text, #7c5800)',
            borderBottom: '1px solid var(--color-warning-border, #ffe082)',
            fontSize: '0.85em'
          }}
        >
          ⚠ Mostrando 10.000 de ~{result.totalRows?.toLocaleString()}+ linhas. Adicione WHERE/LIMIT
          para refinar.
        </div>
      )}
      {applyError && <pre className="error">{applyError}</pre>}
      <div
        ref={scrollContainerRef}
        className="grid-scroll"
        style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}
      >
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
            {useVirtual && virtualItems ? (
              <>
                {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                  <tr style={{ height: virtualItems[0].start }} />
                )}
                {virtualItems.map((virtualRow) => {
                  const idx = virtualRow.index
                  const row = rows[idx]
                  return (
                    <tr key={idx} style={{ height: ROW_HEIGHT }}>
                      {cols.map((c) => (
                        <td key={c}>
                          {row[c] === null || row[c] === undefined ? (
                            <span className="null">NULL</span>
                          ) : (
                            display(row[c])
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {virtualItems.length > 0 &&
                  (() => {
                    const last = virtualItems[virtualItems.length - 1]
                    const paddingBottom = totalVirtualSize - last.end
                    return paddingBottom > 0 ? <tr style={{ height: paddingBottom }} /> : null
                  })()}
              </>
            ) : (
              <>
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
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
