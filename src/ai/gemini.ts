import type { AIChatOptions, AIMessage, AIProvider, AIProviderConfig } from './types'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Adaptador Google Gemini — generateContent REST API. */
export class GeminiProvider implements AIProvider {
  readonly kind = 'gemini' as const

  constructor(
    private config: AIProviderConfig,
    private fetchFn: typeof fetch = fetch
  ) {}

  async chat(messages: AIMessage[], opts: AIChatOptions = {}): Promise<string> {
    const model = this.config.model
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${this.config.apiKey}`

    // Gemini suporta apenas roles 'user' e 'model'; converte 'assistant' → 'model'
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const body: Record<string, unknown> = { contents }
    if (opts.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] }
    }
    if (opts.maxTokens) {
      body.generationConfig = { maxOutputTokens: opts.maxTokens }
    }

    const signal = AbortSignal.timeout(30_000)
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  }
}
