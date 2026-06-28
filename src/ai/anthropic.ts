import type { AIChatOptions, AIMessage, AIProvider, AIProviderConfig } from './types'

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

    const res = await this.fetchFn(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] }
    return (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
  }
}
