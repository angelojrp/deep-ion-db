import { describe, expect, it } from 'vitest'
import { createProvider } from '../src/ai'

interface Call {
  url: string
  init: { method: string; headers: Record<string, string>; body: string; signal?: unknown }
}

function mockFetch(payload: unknown, ok = true, status = 200): { fn: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const fn = (url: unknown, init: unknown): Promise<unknown> => {
    calls.push({ url: String(url), init: init as Call['init'] })
    return Promise.resolve({
      ok,
      status,
      json: async () => payload,
      text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload))
    })
  }
  return { fn: fn as unknown as typeof fetch, calls }
}

describe('GeminiProvider', () => {
  it('monta a request no padrão generateContent e parseia o texto', async () => {
    const { fn, calls } = mockFetch({
      candidates: [{ content: { parts: [{ text: 'SELECT 3;' }] } }]
    })
    const provider = createProvider(
      { kind: 'gemini', apiKey: 'AIza-test', model: 'gemini-2.0-flash' },
      fn
    )
    const out = await provider.chat([{ role: 'user', content: 'gere um select' }], {
      system: 'voce e um DBA',
      maxTokens: 256
    })

    expect(out).toBe('SELECT 3;')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('generativelanguage.googleapis.com')
    expect(calls[0].url).toContain('gemini-2.0-flash')
    expect(calls[0].url).toContain('key=AIza-test')
    const body = JSON.parse(calls[0].init.body)
    expect(body.contents).toHaveLength(1)
    expect(body.contents[0].role).toBe('user')
    expect(body.contents[0].parts[0].text).toBe('gere um select')
    expect(body.systemInstruction.parts[0].text).toBe('voce e um DBA')
    expect(body.generationConfig.maxOutputTokens).toBe(256)
  })

  it('converte role assistant para model', async () => {
    const { fn, calls } = mockFetch({
      candidates: [{ content: { parts: [{ text: 'ok' }] } }]
    })
    const provider = createProvider({ kind: 'gemini', apiKey: 'k', model: 'gemini-1.5-pro' }, fn)
    await provider.chat([
      { role: 'user', content: 'olá' },
      { role: 'assistant', content: 'tudo bem' },
      { role: 'user', content: 'gere sql' }
    ])
    const body = JSON.parse(calls[0].init.body)
    expect(body.contents[1].role).toBe('model')
  })

  it('lança erro em resposta não-ok (chave inválida)', async () => {
    const { fn } = mockFetch('API key not valid', false, 400)
    const provider = createProvider(
      { kind: 'gemini', apiKey: 'bad-key', model: 'gemini-2.0-flash' },
      fn
    )
    await expect(provider.chat([{ role: 'user', content: 'x' }])).rejects.toThrow('Gemini 400')
  })

  it('passa AbortSignal.timeout na request', async () => {
    const { fn, calls } = mockFetch({
      candidates: [{ content: { parts: [{ text: 'ok' }] } }]
    })
    const provider = createProvider({ kind: 'gemini', apiKey: 'k', model: 'gemini-1.5-flash' }, fn)
    await provider.chat([{ role: 'user', content: 'x' }])
    expect(calls[0].init.signal).toBeDefined()
  })
})
