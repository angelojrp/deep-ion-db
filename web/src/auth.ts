/** OIDC Authorization Code + PKCE no navegador (#106) para o modo web. */

export interface AuthConfig {
  authDisabled: boolean
  issuer: string | null
  audience: string | null
}

function base64url(bytes: ArrayBuffer): string {
  const b = btoa(String.fromCharCode(...new Uint8Array(bytes)))
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomVerifier(): string {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  return base64url(a.buffer)
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(digest)
}

async function discover(
  issuer: string
): Promise<{ authorization_endpoint: string; token_endpoint: string }> {
  const r = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`)
  if (!r.ok) throw new Error('Falha ao descobrir endpoints do IdP')
  return r.json()
}

const redirectUri = (): string => window.location.origin + '/'

export async function fetchAuthConfig(): Promise<AuthConfig | null> {
  try {
    return await (await fetch('/api/auth/config')).json()
  } catch {
    return null
  }
}

export async function startLogin(cfg: AuthConfig): Promise<void> {
  if (!cfg.issuer) throw new Error('OIDC_ISSUER não configurado no servidor')
  const clientId = cfg.audience ?? 'deepion'
  const d = await discover(cfg.issuer)
  const verifier = randomVerifier()
  sessionStorage.setItem('pkce_verifier', verifier)
  sessionStorage.setItem('pkce_token_endpoint', d.token_endpoint)
  sessionStorage.setItem('pkce_client_id', clientId)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri(),
    scope: 'openid profile email',
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256'
  })
  window.location.assign(`${d.authorization_endpoint}?${params.toString()}`)
}

/** Troca o `code` do callback por tokens. Retorna true se autenticou. */
export async function completeLogin(code: string): Promise<boolean> {
  const verifier = sessionStorage.getItem('pkce_verifier')
  const tokenEndpoint = sessionStorage.getItem('pkce_token_endpoint')
  const clientId = sessionStorage.getItem('pkce_client_id')
  if (!verifier || !tokenEndpoint || !clientId) return false
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: clientId,
    code_verifier: verifier
  })
  const r = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  })
  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('pkce_token_endpoint')
  sessionStorage.removeItem('pkce_client_id')
  if (!r.ok) return false
  const t = await r.json()
  if (t.access_token) localStorage.setItem('token', t.access_token)
  if (t.refresh_token) localStorage.setItem('refresh_token', t.refresh_token)
  return !!t.access_token
}

export function logout(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
}
