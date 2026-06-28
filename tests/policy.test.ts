import { describe, expect, it } from 'vitest'
import { SessionLimiter, capRows, effectiveMode } from '../server/src/policy'

describe('effectiveMode', () => {
  it('produção força somente-leitura', () => {
    expect(effectiveMode('readwrite', 'prod')).toBe('read')
    expect(effectiveMode('read', 'prod')).toBe('read')
  })
  it('fora de produção respeita a concessão', () => {
    expect(effectiveMode('readwrite', 'nonprod')).toBe('readwrite')
    expect(effectiveMode('read', 'nonprod')).toBe('read')
  })
})

describe('capRows', () => {
  it('não trunca abaixo do teto', () => {
    const r = { columns: ['a'], rows: [{ a: 1 }], rowCount: 1, durationMs: 0 }
    expect(capRows(r).truncated).toBeUndefined()
  })
})

describe('SessionLimiter', () => {
  it('limita execuções simultâneas por usuário', () => {
    const lim = new SessionLimiter()
    const n = Number(process.env.MAX_SESSIONS_PER_USER ?? 5)
    for (let i = 0; i < n; i++) expect(lim.tryAcquire('u')).toBe(true)
    expect(lim.tryAcquire('u')).toBe(false)
    lim.release('u')
    expect(lim.tryAcquire('u')).toBe(true)
  })
})
