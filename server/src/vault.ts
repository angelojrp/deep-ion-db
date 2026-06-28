import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * Cofre de segredos do servidor (issue #62). Criptografa credenciais em repouso
 * com AES-256-GCM. A chave vem de META_ENCRYPTION_KEY (defina em produção!).
 */

const keyMaterial = process.env.META_ENCRYPTION_KEY ?? 'dev-insecure-key-change-me'
const key = scryptSync(keyMaterial, 'deepion-vault', 32)

export function vaultUsingDefaultKey(): boolean {
  return !process.env.META_ENCRYPTION_KEY
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

export function decrypt(payload: string): string {
  const [ivB, tagB, dataB] = payload.split('.')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString(
    'utf8'
  )
}
