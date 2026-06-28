import { BrowserWindow, ipcMain, net, shell } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import type { ServerAuthConfig, ServerLoginResult } from '@shared/types'
import { ServerStore } from './serverStore'

/**
 * Modo servidor (#123) — autenticação OIDC do desktop contra um servidor web
 * Deep Ion DB. O login usa Authorization Code + PKCE: o app abre o navegador
 * do sistema e captura o redirect via protocol handler `deepion://callback`.
 * O token é guardado com segurança (safeStorage) pelo ServerStore.
 */

const PROTOCOL = 'deepion'
const REDIRECT_URI = `${PROTOCOL}://callback`
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

const store = new ServerStore()

interface PendingLogin {
  resolve: (result: ServerLoginResult) => void
  verifier: string
  tokenEndpoint: string
  clientId: string
  serverUrl: string
  timer: ReturnType<typeof setTimeout>
}

/** Logins em andamento, indexados pelo `state` do fluxo OIDC. */
const pending = new Map<string, PendingLogin>()

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function trimUrl(url: string): string {
  return url.replace(/\/$/, '')
}

async function getJson<T>(url: string, opts?: Parameters<typeof net.fetch>[1]): Promise<T> {
  const res = await net.fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function fetchServerAuthConfig(serverUrl: string): Promise<ServerAuthConfig> {
  return getJson<ServerAuthConfig>(`${trimUrl(serverUrl)}/api/auth/config`)
}

async function discover(
  issuer: string
): Promise<{ authorization_endpoint: string; token_endpoint: string }> {
  return getJson(`${trimUrl(issuer)}/.well-known/openid-configuration`)
}

function focusMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
}

export async function startServerLogin(serverUrl: string): Promise<ServerLoginResult> {
  const base = trimUrl(serverUrl)
  let cfg: ServerAuthConfig
  try {
    cfg = await fetchServerAuthConfig(base)
  } catch (e) {
    return {
      ok: false,
      authDisabled: false,
      error: `Servidor inacessível: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  // Sem OIDC: o servidor aceita requisições sem token (dev). Guarda marcador vazio.
  if (cfg.authDisabled) {
    store.setToken(base, '')
    return { ok: true, authDisabled: true }
  }
  if (!cfg.issuer) {
    return { ok: false, authDisabled: false, error: 'Servidor sem OIDC_ISSUER configurado.' }
  }

  let endpoints: { authorization_endpoint: string; token_endpoint: string }
  try {
    endpoints = await discover(cfg.issuer)
  } catch (e) {
    return {
      ok: false,
      authDisabled: false,
      error: `Falha ao descobrir endpoints do IdP: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  const clientId = cfg.audience ?? 'deepion'
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(16))
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  })

  return new Promise<ServerLoginResult>((resolve) => {
    const timer = setTimeout(() => {
      if (pending.delete(state)) {
        resolve({ ok: false, authDisabled: false, error: 'Tempo de login esgotado.' })
      }
    }, LOGIN_TIMEOUT_MS)
    pending.set(state, {
      resolve,
      verifier,
      tokenEndpoint: endpoints.token_endpoint,
      clientId,
      serverUrl: base,
      timer
    })
    void shell.openExternal(`${endpoints.authorization_endpoint}?${params.toString()}`)
  })
}

async function exchangeCode(p: PendingLogin, code: string): Promise<void> {
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: p.clientId,
      code_verifier: p.verifier
    })
    const res = await net.fetch(p.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })
    if (!res.ok) {
      p.resolve({
        ok: false,
        authDisabled: false,
        error: `Falha ao trocar token (HTTP ${res.status}).`
      })
      return
    }
    const tokens = (await res.json()) as { access_token?: string; refresh_token?: string }
    if (!tokens.access_token) {
      p.resolve({ ok: false, authDisabled: false, error: 'Resposta do IdP sem access_token.' })
      return
    }
    store.setToken(p.serverUrl, tokens.access_token, tokens.refresh_token)
    p.resolve({ ok: true, authDisabled: false })
  } catch (e) {
    p.resolve({
      ok: false,
      authDisabled: false,
      error: e instanceof Error ? e.message : String(e)
    })
  }
}

/**
 * Trata o redirect `deepion://callback?code=...&state=...` recebido do
 * navegador externo (via open-url no macOS ou second-instance no Win/Linux).
 */
export function handleProtocolCallback(rawUrl: string): void {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return
  }
  if (url.protocol !== `${PROTOCOL}:`) return
  const state = url.searchParams.get('state')
  if (!state) return
  const p = pending.get(state)
  if (!p) return
  pending.delete(state)
  clearTimeout(p.timer)
  focusMainWindow()

  const code = url.searchParams.get('code')
  if (!code) {
    const err = url.searchParams.get('error') ?? 'Callback sem code.'
    p.resolve({ ok: false, authDisabled: false, error: err })
    return
  }
  void exchangeCode(p, code)
}

/** Registra os handlers IPC do modo servidor. */
export function registerServerAuthIpc(): void {
  store.load()
  ipcMain.handle('server:config', (_e, serverUrl: string) => fetchServerAuthConfig(serverUrl))
  ipcMain.handle('server:login', (_e, serverUrl: string) => startServerLogin(serverUrl))
  ipcMain.handle('server:token', (_e, serverUrl: string) => store.getToken(serverUrl))
  ipcMain.handle('server:logout', (_e, serverUrl: string) => store.clearToken(serverUrl))
  ipcMain.handle('server:listSessions', () => store.listSessions())
  ipcMain.handle('server:saveSession', (_e, label: string, serverUrl: string) =>
    store.saveSession(label, serverUrl)
  )
  ipcMain.handle('server:removeSession', (_e, id: string) => store.removeSession(id))
}
