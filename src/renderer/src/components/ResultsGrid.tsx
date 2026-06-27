import { type JSX, useMemo } from 'react'
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { QueryResult } from '@shared/types'
import { toCsv, toJson } from '../export'

type Row = Record<string, unknown>

async function exportResult(result: QueryResult, kind: 'csv' | 'json'): Promise<void> {
  const content = kind === 'csv' ? toCsv(result) : toJson(result)
  await window.api.ws.saveAs(`export.${kind}`, content)
}

function renderCell(value: unknown): JSX.Element | string {
  if (value === null || value === undefined) return <span className="null">NULL</span>
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function ResultsGrid({ result }: { result: QueryResult | null }): JSX.Element {
  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      (result?.columns ?? []).map((name, i) => ({
        id: `${i}:${name}`,
        header: name,
        accessorFn: (row) => row[name]
      })),
    [result]
  )

  const data = useMemo<Row[]>(() => result?.rows ?? [], [result])

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

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

  return (
    <div className="grid-wrap">
      <div className="grid-status">
        <span>
          {result.rowCount} linha(s) • {Math.round(result.durationMs)} ms
        </span>
        <span className="grid-actions">
          <button className="link" title="Exportar CSV" onClick={() => exportResult(result, 'csv')}>
            CSV
          </button>
          <button
            className="link"
            title="Exportar JSON"
            onClick={() => exportResult(result, 'json')}
          >
            JSON
          </button>
        </span>
      </div>
      <div className="grid-scroll">
        <table className="grid">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{renderCell(cell.getValue())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
