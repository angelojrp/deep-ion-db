import type { AIChatOptions, AIMessage, AIProvider, AIProviderConfig } from './types'
import { AIHttpError, toAIHttpError, withRetry } from './retry'

const TIMEOUT_MS = 30_000

/** Adaptador OpenAI — Chat Completions (POST /v1/chat/completions). */
export class OpenAIProvider implements AIProvider {
  readonly kind = 'openai' as const

  constructor(
    private config: AIProviderConfig,
    private fetchFn: typeof fetch = fetch
  ) {}

  private baseUrl(): string {
    return (this.config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '')
  }

  private commonHeaders(): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.config.apiKey}`
    }
  }

  private buildMessages(messages: AIMessage[], opts: AIChatOptions): Record<string, unknown>[] {
    return [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ]
  }

  async chat(messages: AIMessage[], opts: AIChatOptions = {}): Promise<string> {
    const base = this.baseUrl()
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: this.buildMessages(messages, opts)
    }
    if (opts.maxTokens) body.max_tokens = opts.maxTokens

    return withRetry(async () => {
      let res: Response
      try {
        res = await this.fetchFn(`${base}/v1/chat/completions`, {
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
        throw await toAIHttpError(res, 'OpenAI')
      }

      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      return data.choices?.[0]?.message?.content ?? ''
    })
  }

  async chatStream(
    messages: AIMessage[],
    onToken: (token: string) => void,
    opts: AIChatOptions = {},
    signal?: AbortSignal
  ): Promise<void> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: this.buildMessages(messages, opts),
      stream: true
    }
    if (opts.maxTokens) body.max_tokens = opts.maxTokens

    const res = await this.fetchFn(`${this.baseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: this.commonHeaders(),
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
    }
    if (!res.body) return

    const decoder = new TextDecoder()
    let buffer = ''

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
            choices?: { delta?: { content?: string } }[]
          }
          const token = evt.choices?.[0]?.delta?.content
          if (token) onToken(token)
        } catch {
          /* chunk malformado — ignora */
        }
      }
    }
  }
}

// Re-export so consumers can catch typed errors if needed
export { AIHttpError }
