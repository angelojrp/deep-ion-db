import type { AIChatOptions, AIMessage, AIProvider, AIProviderConfig } from './types'

/**
 * Adaptador Local OpenAI-compatible — para Ollama, LM Studio e qualquer servidor
 * que exponha o endpoint POST /v1/chat/completions no formato OpenAI.
 *
 * Config: `baseUrl` aponta para o servidor local (ex.: http://localhost:11434/v1),
 * `model` é o nome do modelo carregado (ex.: llama3.2, mistral).
 * `apiKey` é opcional — enviado no header Authorization apenas se informado.
 */
export class LocalProvider implements AIProvider {
  readonly kind = 'local' as const

  constructor(
    private config: AIProviderConfig,
    private fetchFn: typeof fetch = fetch
  ) {}

  async chat(messages: AIMessage[], opts: AIChatOptions = {}): Promise<string> {
    const base = (this.config.baseUrl ?? 'http://localhost:11434/v1').replace(/\/$/, '')
    const chatMessages = [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ]
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: chatMessages
    }
    if (opts.maxTokens) body.max_tokens = opts.maxTokens

    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (this.config.apiKey) {
      headers.authorization = `Bearer ${this.config.apiKey}`
    }

    const signal = AbortSignal.timeout(60_000)
    const res = await this.fetchFn(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) {
      throw new Error(`Local ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content ?? ''
  }
}
