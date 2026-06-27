import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { ConnectionConfig, SavedConnection } from './db/types'

interface StoredSecret {
  /** true = criptografado via safeStorage; false = base64 simples (fallback sem keyring). */
  enc: boolean
  value: string
}

interface StoredConnection extends SavedConnection {
  secret?: StoredSecret
}

interface StoreFile {
  version: number
  connections: StoredConnection[]
}

/**
 * Persiste conexões em userData/connections.json. A senha é guardada criptografada
 * (Electron safeStorage) e nunca trafega para o renderer.
 */
export class ConnectionStore {
  private readonly file = join(app.getPath('userData'), 'connections.json')
  private data: StoreFile = { version: 1, connections: [] }

  load(): void {
    try {
      if (existsSync(this.file)) {
        this.data = JSON.parse(readFileSync(this.file, 'utf-8')) as StoreFile
      }
    } catch {
      this.data = { version: 1, connections: [] }
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  private toSaved(c: StoredConnection): SavedConnection {
    const { secret: _secret, ...meta } = c
    void _secret
    return meta
  }

  private encrypt(password: string | undefined): StoredSecret | undefined {
    if (!password) return undefined
    if (safeStorage.isEncryptionAvailable()) {
      return { enc: true, value: safeStorage.encryptString(password).toString('base64') }
    }
    return { enc: false, value: Buffer.from(password, 'utf-8').toString('base64') }
  }

  private decrypt(secret: StoredSecret | undefined): string | undefined {
    if (!secret) return undefined
    const buf = Buffer.from(secret.value, 'base64')
    if (secret.enc) {
      try {
        return safeStorage.decryptString(buf)
      } catch {
        return undefined
      }
    }
    return buf.toString('utf-8')
  }

  list(): SavedConnection[] {
    return this.data.connections.map((c) => this.toSaved(c))
  }

  save(config: ConnectionConfig): SavedConnection {
    const stored: StoredConnection = {
      id: config.id,
      name: config.name,
      kind: config.kind,
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database,
      filePath: config.filePath,
      ssl: config.ssl,
      secret: this.encrypt(config.password)
    }
    const idx = this.data.connections.findIndex((c) => c.id === stored.id)
    if (idx >= 0) this.data.connections[idx] = stored
    else this.data.connections.push(stored)
    this.persist()
    return this.toSaved(stored)
  }

  remove(id: string): void {
    this.data.connections = this.data.connections.filter((c) => c.id !== id)
    this.persist()
  }

  /** Reconstrói o ConnectionConfig completo (com senha) para conectar — uso interno no main. */
  getConfig(id: string): ConnectionConfig | undefined {
    const c = this.data.connections.find((x) => x.id === id)
    if (!c) return undefined
    return {
      id: c.id,
      name: c.name,
      kind: c.kind,
      host: c.host,
      port: c.port,
      user: c.user,
      database: c.database,
      filePath: c.filePath,
      ssl: c.ssl,
      password: this.decrypt(c.secret)
    }
  }
}
