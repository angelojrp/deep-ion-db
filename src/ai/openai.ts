import type { AIChatOptions, AIMessage, AIProvider, AIProviderConfig } from './types'

/** Adaptador OpenAI — Chat Completions (POST /v1/chat/completions). */
export class OpenAIProvider implements AIProvider {
  readonly kind = 'openai' as const

  constructor(
    private config: AIProviderConfig,
    private fetchFn: typeof fetch = fetch
  ) {}

  async chat(messages: AIMessage[], opts: AIChatOptions = {}): Promise<string> {
    const base = (this.config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '')
    const chatMessages = [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ]
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: chatMessages
    }
    if (opts.maxTokens) body.max_tokens = opts.maxTokens

    const res = await this.fetchFn(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content ?? ''
  }
}
