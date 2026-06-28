import { describe, expect, it } from 'vitest'
import { decrypt, encrypt } from '../server/src/vault'

describe('vault', () => {
  it('faz round-trip de criptografia', () => {
    const secret = 'senha-super-secreta-123'
    const enc = encrypt(secret)
    expect(enc).not.toContain(secret)
    expect(enc.split('.').length).toBe(3)
    expect(decrypt(enc)).toBe(secret)
  })

  it('gera ciphertexts diferentes para o mesmo texto (IV aleatório)', () => {
    expect(encrypt('x')).not.toBe(encrypt('x'))
  })
})
