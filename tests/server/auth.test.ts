import { type JWTPayload, SignJWT, createLocalJWKSet, generateKeyPair } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/src/meta', () => ({ getPool: vi.fn() }))

// Importações adiadas para depois do mock
import { getPool } from '../../server/src/meta'

const mockPool = { query: vi.fn() }
vi.mocked(getPool).mockReturnValue(mockPool as never)

// Importar auth depois de configurar mocks
import {
  assertOidcConfigured,
  authDisabled,
  devUser,
  upsertUser,
  verifyToken
} from '../../server/src/auth'

describe('authDisabled()', () => {
  afterEach(() => {
    delete process.env.AUTH_DISABLED
  })

  it('retorna false quando AUTH_DISABLED não está definido', () => {
    delete process.env.AUTH_DISABLED
    expect(authDisabled()).toBe(false)
  })

  it('retorna true quando AUTH_DISABLED=true', () => {
    process.env.AUTH_DISABLED = 'true'
    expect(authDisabled()).toBe(true)
  })

  it('retorna false quando AUTH_DISABLED=false', () => {
    process.env.AUTH_DISABLED = 'false'
    expect(authDisabled()).toBe(false)
  })
})

describe('devUser()', () => {
  it('retorna objeto fixo com role admin', () => {
    const user = devUser()
    expect(user.subject).toBe('dev')
    expect(user.role).toBe('admin')
    expect(user.email).toBe('dev@local')
    expect(user.name).toBe('Dev')
    expect(user.id).toBe('00000000-0000-0000-0000-000000000000')
  })
})

describe('assertOidcConfigured()', () => {
  afterEach(() => {
    delete process.env.AUTH_DISABLED
  })

  it('não lança quando AUTH_DISABLED=true', () => {
    process.env.AUTH_DISABLED = 'true'
    expect(() => assertOidcConfigured()).not.toThrow()
  })

  it('lança quando OIDC_ISSUER não está definido e AUTH_DISABLED não é true', () => {
    // No módulo, issuer é capturado no nível do módulo. Como o módulo é carregado
    // sem OIDC_ISSUER, issuer = undefined, então assertOidcConfigured lança.
    process.env.AUTH_DISABLED = 'false'
    expect(() => assertOidcConfigured()).toThrow(/OIDC_ISSUER/)
  })
})

describe('verifyToken()', () => {
  it('aceita token válido com JWKS local (ES256)', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256')
    const jwks = createLocalJWKSet({ keys: [await (await import('jose')).exportJWK(publicKey)] })

    const token = await new SignJWT({ sub: 'user-123', email: 'user@test.com' })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey)

    const payload = await verifyToken(token, jwks)
    expect(payload.sub).toBe('user-123')
    expect(payload.email).toBe('user@test.com')
  })

  it('rejeita token com assinatura inválida', async () => {
    const { privateKey: key1 } = await generateKeyPair('ES256')
    const { publicKey: key2 } = await generateKeyPair('ES256')
    const jwks = createLocalJWKSet({ keys: [await (await import('jose')).exportJWK(key2)] })

    const token = await new SignJWT({ sub: 'user-abc' })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key1)

    await expect(verifyToken(token, jwks)).rejects.toThrow()
  })

  it('rejeita token expirado', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256')
    const jwks = createLocalJWKSet({ keys: [await (await import('jose')).exportJWK(publicKey)] })

    const token = await new SignJWT({ sub: 'user-exp' })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuedAt()
      .setExpirationTime('1s')
      .sign(privateKey)

    // Aguarda expirar
    await new Promise((r) => setTimeout(r, 1100))

    await expect(verifyToken(token, jwks)).rejects.toThrow()
  })
})

describe('upsertUser()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPool).mockReturnValue(mockPool as never)
  })

  const basePayload: JWTPayload = {
    sub: 'subject-abc',
    email: 'user@example.com',
    name: 'Test User'
  }

  it('primeiro usuário recebe role admin', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] }) // select existing
      .mockResolvedValueOnce({ rows: [{ n: 0 }] }) // count
      .mockResolvedValueOnce({ rows: [{ id: 'new-id-1' }] }) // insert

    const result = await upsertUser(basePayload)
    expect(result.role).toBe('admin')
    expect(result.subject).toBe('subject-abc')
    expect(result.email).toBe('user@example.com')
    expect(result.id).toBe('new-id-1')
  })

  it('segundo usuário recebe role user', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] }) // select existing
      .mockResolvedValueOnce({ rows: [{ n: 1 }] }) // count (1 user já existe)
      .mockResolvedValueOnce({ rows: [{ id: 'new-id-2' }] }) // insert

    const result = await upsertUser({ ...basePayload, sub: 'subject-def' })
    expect(result.role).toBe('user')
  })

  it('usuário existente é atualizado mantendo a role original', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'existing-id', role: 'admin' }] }) // select existing
      .mockResolvedValueOnce({ rows: [] }) // update

    const result = await upsertUser(basePayload)
    expect(result.role).toBe('admin')
    expect(result.id).toBe('existing-id')

    // Verifica que o update foi chamado com os parâmetros corretos
    const updateCall = mockPool.query.mock.calls[1]
    expect(updateCall[0]).toContain('update users set email')
    expect(updateCall[1]).toEqual(['existing-id', 'user@example.com', 'Test User'])
  })

  it('usa preferred_username quando name não está presente', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ n: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'id-pref' }] })

    const payload: JWTPayload = {
      sub: 'sub-pref',
      email: 'pref@example.com',
      preferred_username: 'prefuser'
    }

    const result = await upsertUser(payload)
    expect(result.name).toBe('prefuser')
  })

  it('aceita payload sem email e name (campos ficam null)', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ n: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'id-null' }] })

    const result = await upsertUser({ sub: 'sub-null' })
    expect(result.email).toBeNull()
    expect(result.name).toBeNull()
  })
})
