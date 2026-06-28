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

  private baseUrl(): string {
    return (this.config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')
  }

  private commonHeaders(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01'
    }
  }

  private buildBody(
    messages: AIMessage[],
    opts: AIChatOptions,
    extra?: Record<string, unknown>
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: opts.maxTokens ?? 4096,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...extra
    }
    if (opts.system) body.system = opts.system
    return body
  }

  async chat(messages: AIMessage[], opts: AIChatOptions = {}): Promise<string> {
    const base = this.baseUrl()
    const body = this.buildBody(messages, opts)
    return withRetry(async () => {
      let res: Response
      try {
        res = await this.fetchFn(`${base}/v1/messages`, {
          method: 'POST',
          headers: this.commonHeaders(),
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

  async chatStream(
    messages: AIMessage[],
    onToken: (token: string) => void,
    opts: AIChatOptions = {},
    signal?: AbortSignal
  ): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl()}/v1/messages`, {
      method: 'POST',
      headers: { ...this.commonHeaders(), accept: 'text/event-stream' },
      body: JSON.stringify(this.buildBody(messages, opts, { stream: true })),
      signal
    })
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
    }
    if (!res.body) return

    const decoder = new TextDecoder()
    let buffer = ''

    // Node.js ReadableStream é iterável de forma assíncrona.
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      if (signal?.aborted) break
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') return
        try {
          const evt = JSON.parse(raw) as {
            type?: string
            delta?: { type?: string; text?: string }
          }
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            onToken(evt.delta.text ?? '')
          }
        } catch {
          /* chunk malformado — ignora */
        }
      }
    }
  }
}

// Re-export so consumers can catch typed errors if needed
export { AIHttpError }
