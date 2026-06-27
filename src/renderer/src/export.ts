import type { QueryResult } from '@shared/types'

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function toCsv(r: QueryResult): string {
  const head = r.columns.map(csvEscape).join(',')
  const rows = r.rows.map((row) => r.columns.map((c) => csvEscape(row[c])).join(','))
  return [head, ...rows].join('\r\n')
}

export function toJson(r: QueryResult): string {
  return JSON.stringify(r.rows, null, 2)
}
