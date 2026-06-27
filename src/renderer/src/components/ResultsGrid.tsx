import { type JSX, useMemo } from 'react'
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { QueryResult } from '@shared/types'

type Row = Record<string, unknown>

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
        {result.rowCount} linha(s) • {Math.round(result.durationMs)} ms
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
