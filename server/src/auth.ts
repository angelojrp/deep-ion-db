import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'
import { getPool } from './meta'

/**
 * Autenticação SSO via OpenID Connect (issue #56) + papéis/RBAC (issue #57).
 *
 * Produção: defina OIDC_ISSUER, OIDC_AUDIENCE e (opcional) OIDC_JWKS_URI.
 * Dev/local: AUTH_DISABLED=true injeta um usuário admin de desenvolvimento.
 */

export interface AuthUser {
  id: string
  subject: string
  email: string | null
  name: string | null
  role: string
}

export function authDisabled(): boolean {
  return process.env.AUTH_DISABLED === 'true'
}

const issuer = process.env.OIDC_ISSUER
const audience = process.env.OIDC_AUDIENCE

let keySet: JWTVerifyGetKey | null = null
function getKeySet(): JWTVerifyGetKey {
  if (keySet) return keySet
  const uri =
    process.env.OIDC_JWKS_URI ??
    (issuer ? `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs` : undefined)
  if (!uri) throw new Error('OIDC_JWKS_URI/OIDC_ISSUER não configurado.')
  keySet = createRemoteJWKSet(new URL(uri))
  return keySet
}

/**
 * Valida a configuração OIDC ao iniciar. Se AUTH_DISABLED não estiver ativo e
 * OIDC_ISSUER ou OIDC_AUDIENCE não estiverem definidos, lança erro para evitar
 * operar sem validar essas claims (fail-closed).
 */
export function assertOidcConfigured(): void {
  if (authDisabled()) return
  if (!issuer) {
    throw new Error(
      '[auth] OIDC_ISSUER não configurado. Defina a variável ou use AUTH_DISABLED=true.'
    )
  }
  if (!audience) {
    throw new Error(
      '[auth] OIDC_AUDIENCE não configurado. Defina a variável ou use AUTH_DISABLED=true.'
    )
  }
}

/** Verifica um token; `keys` permite injetar um JWKS local (testes). */
export async function verifyToken(token: string, keys?: JWTVerifyGetKey): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, keys ?? getKeySet(), {
    issuer: issuer || undefined,
    audience: audience || undefined
  })
  return payload
}

/** Cria/atualiza o usuário a partir das claims do token. O primeiro usuário vira admin. */
export async function upsertUser(payload: JWTPayload): Promise<AuthUser> {
  const subject = String(payload.sub)
  const email = (payload.email as string | undefined) ?? null
  const name = ((payload.name ?? payload.preferred_username) as string | undefined) ?? null
  const pool = getPool()
  const existing = await pool.query('select id, role from users where subject = $1', [subject])
  if (existing.rows[0]) {
    const r = existing.rows[0]
    await pool.query('update users set email = $2, name = $3 where id = $1', [r.id, email, name])
    return { id: r.id, subject, email, name, role: r.role }
  }
  const count = await pool.query('select count(*)::int as n from users')
  const role = count.rows[0].n === 0 ? 'admin' : 'user'
  const ins = await pool.query(
    'insert into users (subject, email, name, role) values ($1,$2,$3,$4) returning id',
    [subject, email, name, role]
  )
  return { id: ins.rows[0].id, subject, email, name, role }
}

const DEV_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000000',
  subject: 'dev',
  email: 'dev@local',
  name: 'Dev',
  role: 'admin'
}

export function devUser(): AuthUser {
  return DEV_USER
}
