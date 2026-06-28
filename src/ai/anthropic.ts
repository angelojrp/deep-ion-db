import type { AIChatOptions, AIMessage, AIProvider, AIProviderConfig } from './types'
import { AIHttpError, toAIHttpError, withRetry } from './retry'

const TIMEOUT_MS = 30_000

/** Adaptador Anthropic — Messages API (POST /v1/messages). */
export class AnthropicProvider implements AIProvider {
  readonly kind = 'anthropic' as const

  constructor(
    private config: AIProviderConfig,
    private fetchFn: typeof fetch = fetch
  ) {}

  async chat(messages: AIMessage[], opts: AIChatOptions = {}): Promise<string> {
    const base = (this.config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: opts.maxTokens ?? 4096,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    }
    if (opts.system) body.system = opts.system

    return withRetry(async () => {
      let res: Response
      try {
        res = await this.fetchFn(`${base}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS)
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'TimeoutError') {
          throw new Error('Requisição à IA excedeu o tempo limite', { cause: err })
        }
        throw new Error('Sem conexão com o serviço de IA', { cause: err })
      }

      if (!res.ok) {
        throw await toAIHttpError(res, 'Anthropic')
      }

      const data = (await res.json()) as { content?: { type: string; text?: string }[] }
      return (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('')
    })
  }
}

// Re-export so consumers can catch typed errors if needed
export { AIHttpError }
