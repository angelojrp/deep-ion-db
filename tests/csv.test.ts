import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/renderer/src/csv'

describe('parseCsv', () => {
  it('parseia campos simples', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3']
    ])
  })

  it('respeita aspas com vírgula e aspas escapadas', () => {
    expect(parseCsv('nome,obs\n"silva, jr","ele disse ""oi"""')).toEqual([
      ['nome', 'obs'],
      ['silva, jr', 'ele disse "oi"']
    ])
  })

  it('suporta quebra de linha dentro de aspas', () => {
    expect(parseCsv('a\n"linha1\nlinha2"')).toEqual([['a'], ['linha1\nlinha2']])
  })

  it('ignora linhas totalmente vazias', () => {
    expect(parseCsv('a\n\nb')).toEqual([['a'], ['b']])
  })
})
