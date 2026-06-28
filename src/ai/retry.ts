/** Utilitário de retry com exponential backoff para chamadas à API de IA. */

export interface RetryOptions {
  /** Número máximo de tentativas (padrão: 3). */
  maxAttempts?: number
  /** Delay base em ms antes do primeiro retry (padrão: 1000). */
  baseDelayMs?: number
}

/** Status HTTP que indicam erro permanente — não deve fazer retry. */
const PERMANENT_ERROR_STATUSES = new Set([400, 401, 403, 404])

/** Extrai o status HTTP de um erro lançado pelo adaptador, se houver. */
function extractStatus(err: unknown): number | null {
  if (err instanceof AIHttpError) return err.status
  return null
}

/** Aguarda `ms` milissegundos. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Erro HTTP com status code acessível, para decisões de retry. */
export class AIHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(message)
    this.name = 'AIHttpError'
  }
}

/**
 * Executa `fn` com retry e exponential backoff.
 * - Retry para 429, 503, 524 e qualquer 5xx.
 * - Sem retry para 400, 401, 403, 404 (erros permanentes).
 * - Respeita o header `Retry-After` (em segundos) quando presente no erro.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3
  const baseDelayMs = opts.baseDelayMs ?? 1000

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const status = extractStatus(err)

      // Erro permanente: não faz retry
      if (status !== null && PERMANENT_ERROR_STATUSES.has(status)) {
        throw err
      }

      // Só faz retry se for o último error de uma tentativa que não é a última
      if (attempt === maxAttempts) break

      // Calcula delay: respeita Retry-After ou usa exponential backoff
      let waitMs = baseDelayMs * Math.pow(2, attempt - 1)
      if (err instanceof AIHttpError && err.retryAfterMs !== undefined) {
        waitMs = err.retryAfterMs
      }

      await delay(waitMs)
    }
  }
  throw lastError
}

/**
 * Converte a resposta HTTP de um fetch em um `AIHttpError` com mensagem acionável,
 * respeitando o header `Retry-After` se presente.
 */
export async function toAIHttpError(res: Response, provider: string): Promise<AIHttpError> {
  const retryAfterHeader = res.headers.get('retry-after')
  const retryAfterMs = retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : undefined

  let message: string
  switch (res.status) {
    case 401:
    case 403:
      message = 'Chave de API inválida ou sem permissão'
      break
    case 429:
      message = 'Cota de requisições esgotada — tente novamente em alguns minutos'
      break
    default:
      if (res.status >= 500) {
        message = 'Serviço de IA temporariamente indisponível'
      } else {
        const body = await res.text().catch(() => '')
        message = `${provider} ${res.status}: ${body}`
      }
  }

  return new AIHttpError(res.status, message, retryAfterMs)
}
