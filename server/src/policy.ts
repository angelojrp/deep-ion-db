import type { QueryResult } from '../../src/shared/types'

/**
 * Políticas por concessão (#64) e limites de sessão (#65).
 * - Ambiente 'prod' força somente-leitura.
 * - statement_timeout e teto de linhas aplicados nas execuções proxied.
 * - Limite de execuções proxied simultâneas por usuário.
 */

export const STATEMENT_TIMEOUT_MS = Number(process.env.QUERY_TIMEOUT_MS ?? 30000)
export const MAX_ROWS = Number(process.env.QUERY_MAX_ROWS ?? 5000)
export const MAX_SESSIONS_PER_USER = Number(process.env.MAX_SESSIONS_PER_USER ?? 5)

/** Modo efetivo: produção sempre somente-leitura, independentemente da concessão. */
export function effectiveMode(grantMode: string, environment: string): 'read' | 'readwrite' {
  if (environment === 'prod') return 'read'
  return grantMode === 'readwrite' ? 'readwrite' : 'read'
}

/** Aplica o teto de linhas, sinalizando truncamento. */
export function capRows(result: QueryResult): QueryResult & { truncated?: boolean } {
  if (result.rows.length <= MAX_ROWS) return result
  return { ...result, rows: result.rows.slice(0, MAX_ROWS), truncated: true }
}

/** Limitador de execuções simultâneas por usuário (#65). */
export class SessionLimiter {
  private inFlight = new Map<string, number>()

  tryAcquire(userId: string): boolean {
    const n = this.inFlight.get(userId) ?? 0
    if (n >= MAX_SESSIONS_PER_USER) return false
    this.inFlight.set(userId, n + 1)
    return true
  }

  release(userId: string): void {
    const n = this.inFlight.get(userId) ?? 0
    if (n <= 1) this.inFlight.delete(userId)
    else this.inFlight.set(userId, n - 1)
  }
}
