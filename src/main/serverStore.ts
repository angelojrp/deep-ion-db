import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { randomUUID } from 'node:crypto'
import type { ServerSession } from '@shared/types'

interface TokenEntry {
  /** true = criptografado via safeStorage; false = base64 simples (fallback sem keyring). */
  enc: boolean
  /** Token de acesso (string vazia quando o servidor tem auth desabilitada). */
  access: string
  refresh?: string
}

interface SessionsFile {
  version: number
  sessions: ServerSession[]
}

interface TokensFile {
  version: number
  tokens: Record<string, TokenEntry>
}

/**
 * Persistência do modo servidor (#123): sessões de servidor em
 * userData/server-sessions.json e tokens (criptografados via safeStorage) em
 * userData/server-tokens.json. Os tokens nunca trafegam para o renderer em
 * texto puro persistido — só o token corrente é entregue sob demanda.
 */
export class ServerStore {
  private readonly sessionsFile = join(app.getPath('userData'), 'server-sessions.json')
  private readonly tokensFile = join(app.getPath('userData'), 'server-tokens.json')
  private sessions: SessionsFile = { version: 1, sessions: [] }
  private tokens: TokensFile = { version: 1, tokens: {} }

  load(): void {
    try {
      if (existsSync(this.sessionsFile)) {
        this.sessions = JSON.parse(readFileSync(this.sessionsFile, 'utf-8')) as SessionsFile
      }
    } catch {
      this.sessions = { version: 1, sessions: [] }
    }
    try {
      if (existsSync(this.tokensFile)) {
        this.tokens = JSON.parse(readFileSync(this.tokensFile, 'utf-8')) as TokensFile
      }
    } catch {
      this.tokens = { version: 1, tokens: {} }
    }
  }

  /** Normaliza a URL do servidor para usar como chave (sem barra final). */
  private key(serverUrl: string): string {
    return serverUrl.replace(/\/$/, '')
  }

  private persistSessions(): void {
    mkdirSync(dirname(this.sessionsFile), { recursive: true })
    writeFileSync(this.sessionsFile, JSON.stringify(this.sessions, null, 2), 'utf-8')
  }

  private persistTokens(): void {
    mkdirSync(dirname(this.tokensFile), { recursive: true })
    writeFileSync(this.tokensFile, JSON.stringify(this.tokens, null, 2), 'utf-8')
  }

  listSessions(): ServerSession[] {
    return this.sessions.sessions
  }

  saveSession(label: string, serverUrl: string): ServerSession {
    const url = this.key(serverUrl)
    const existing = this.sessions.sessions.find((s) => s.serverUrl === url)
    if (existing) {
      existing.label = label || existing.label
      this.persistSessions()
      return existing
    }
    const session: ServerSession = { id: randomUUID(), label: label || url, serverUrl: url }
    this.sessions.sessions.push(session)
    this.persistSessions()
    return session
  }

  removeSession(id: string): void {
    this.sessions.sessions = this.sessions.sessions.filter((s) => s.id !== id)
    this.persistSessions()
  }

  setToken(serverUrl: string, access: string, refresh?: string): void {
    const url = this.key(serverUrl)
    // Token vazio (servidor com auth desabilitada) é guardado em claro como marcador.
    if (access && safeStorage.isEncryptionAvailable()) {
      this.tokens.tokens[url] = {
        enc: true,
        access: safeStorage.encryptString(access).toString('base64'),
        refresh: refresh ? safeStorage.encryptString(refresh).toString('base64') : undefined
      }
    } else {
      this.tokens.tokens[url] = {
        enc: false,
        access: Buffer.from(access, 'utf-8').toString('base64'),
        refresh: refresh ? Buffer.from(refresh, 'utf-8').toString('base64') : undefined
      }
    }
    this.persistTokens()
  }

  getToken(serverUrl: string): string | null {
    const entry = this.tokens.tokens[this.key(serverUrl)]
    if (!entry) return null
    const buf = Buffer.from(entry.access, 'base64')
    if (entry.enc) {
      try {
        return safeStorage.decryptString(buf)
      } catch {
        return null
      }
    }
    return buf.toString('utf-8')
  }

  clearToken(serverUrl: string): void {
    delete this.tokens.tokens[this.key(serverUrl)]
    this.persistTokens()
  }
}
