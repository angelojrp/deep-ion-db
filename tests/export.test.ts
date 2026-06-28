import { describe, expect, it } from 'vitest'
import { toCsv, toJson } from '../src/renderer/src/export'

const result = {
  columns: ['id', 'nome'],
  rows: [
    { id: 1, nome: 'ana' },
    { id: 2, nome: 'b, "c"' }
  ],
  rowCount: 2,
  durationMs: 1
}

describe('export', () => {
  it('gera CSV com escaping', () => {
    const csv = toCsv(result)
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('id,nome')
    expect(lines[1]).toBe('1,ana')
    expect(lines[2]).toBe('2,"b, ""c"""')
  })

  it('gera JSON das linhas', () => {
    expect(JSON.parse(toJson(result))).toEqual(result.rows)
  })
})
