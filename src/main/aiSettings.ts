import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { DEFAULT_MODELS, createProvider } from '../ai'
import type { AIProviderKind } from '../ai'
import type { AIPublicConfig, AiChatMessage, AiSettingsInput } from '@shared/types'

/**
 * Configuração de IA (issue #25): provedor, modelo, endpoint e a chave de API.
 * A chave é guardada criptografada (safeStorage) e nunca trafega para o renderer.
 */

interface Secret {
  enc: boolean
  value: string
}

interface Stored {
  kind: AIProviderKind
  model: string
  baseUrl?: string
  secret?: Secret
}

const file = join(app.getPath('userData'), 'ai.json')
let data: Stored | null = null

export function loadAiSettings(): void {
  try {
    if (existsSync(file)) data = JSON.parse(readFileSync(file, 'utf-8')) as Stored
  } catch {
    data = null
  }
}

function persist(): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

function encrypt(plain: string | undefined): Secret | undefined {
  if (!plain) return undefined
  if (safeStorage.isEncryptionAvailable()) {
    return { enc: true, value: safeStorage.encryptString(plain).toString('base64') }
  }
  return { enc: false, value: Buffer.from(plain, 'utf-8').toString('base64') }
}

function decrypt(secret: Secret | undefined): string | undefined {
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

export function getPublicConfig(): AIPublicConfig | null {
  if (!data) return null
  return { kind: data.kind, model: data.model, baseUrl: data.baseUrl, hasKey: !!data.secret }
}

export function setConfig(input: AiSettingsInput): AIPublicConfig {
  const prev = data
  data = {
    kind: input.kind,
    model: input.model || DEFAULT_MODELS[input.kind],
    baseUrl: input.baseUrl || undefined,
    // mantém a chave anterior se nenhuma nova for informada (e o provedor não mudou)
    secret: input.apiKey
      ? encrypt(input.apiKey)
      : input.kind === prev?.kind
        ? prev?.secret
        : undefined
  }
  persist()
  return getPublicConfig()!
}

export async function chat(messages: AiChatMessage[], system?: string): Promise<string> {
  if (!data) throw new Error('IA não configurada — defina o provedor e a chave em Configurações.')
  const apiKey = decrypt(data.secret)
  if (!apiKey)
    throw new Error('Chave de IA ausente — informe a chave do provedor em Configurações.')
  const provider = createProvider({
    kind: data.kind,
    apiKey,
    model: data.model,
    baseUrl: data.baseUrl
  })
  return provider.chat(messages, system ? { system } : {})
}
