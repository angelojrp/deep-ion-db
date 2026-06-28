import { describe, expect, it } from 'vitest'
import { DEFAULT_MODELS, createProvider } from '../src/ai'

interface Call {
  url: string
  init: { method: string; headers: Record<string, string>; body: string }
}

function mockFetch(payload: unknown, ok = true, status = 200): { fn: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const fn = (url: unknown, init: unknown): Promise<unknown> => {
    calls.push({ url: String(url), init: init as Call['init'] })
    return Promise.resolve({
      ok,
      status,
      headers: { get: (_: string) => null },
      json: async () => payload,
      text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload))
    })
  }
  return { fn: fn as unknown as typeof fetch, calls }
}

describe('AnthropicProvider', () => {
  it('monta a request no padrão Messages API e parseia o texto', async () => {
    const { fn, calls } = mockFetch({ content: [{ type: 'text', text: 'SELECT 1;' }] })
    const provider = createProvider(
      { kind: 'anthropic', apiKey: 'sk-ant-test', model: DEFAULT_MODELS.anthropic },
      fn
    )
    const out = await provider.chat([{ role: 'user', content: 'gere um select' }], {
      system: 'voce e um DBA',
      maxTokens: 256
    })

    expect(out).toBe('SELECT 1;')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages')
    expect(calls[0].init.headers['x-api-key']).toBe('sk-ant-test')
    expect(calls[0].init.headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(calls[0].init.body)
    expect(body.model).toBe('claude-opus-4-8')
    expect(body.max_tokens).toBe(256)
    expect(body.system).toBe('voce e um DBA')
    expect(body.messages).toEqual([{ role: 'user', content: 'gere um select' }])
  })

  it('lança erro categorizado em resposta não-ok', async () => {
    const { fn } = mockFetch('overloaded', false, 529)
    const provider = createProvider(
      { kind: 'anthropic', apiKey: 'k', model: 'claude-opus-4-8' },
      fn
    )
    await expect(provider.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(
      /indisponível|529/i
    )
  })
})

describe('OpenAIProvider', () => {
  it('monta a request no padrão Chat Completions e parseia o texto', async () => {
    const { fn, calls } = mockFetch({ choices: [{ message: { content: 'SELECT 2;' } }] })
    const provider = createProvider(
      { kind: 'openai', apiKey: 'sk-openai-test', model: DEFAULT_MODELS.openai },
      fn
    )
    const out = await provider.chat([{ role: 'user', content: 'gere um select' }], {
      system: 'voce e um DBA'
    })

    expect(out).toBe('SELECT 2;')
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions')
    expect(calls[0].init.headers.authorization).toBe('Bearer sk-openai-test')
    const body = JSON.parse(calls[0].init.body)
    expect(body.model).toBe('gpt-4o')
    expect(body.messages[0]).toEqual({ role: 'system', content: 'voce e um DBA' })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'gere um select' })
  })

  it('respeita baseUrl custom (on-prem/compatível)', async () => {
    const { fn, calls } = mockFetch({ choices: [{ message: { content: 'ok' } }] })
    const provider = createProvider(
      { kind: 'openai', apiKey: 'k', model: 'local', baseUrl: 'http://localhost:1234/' },
      fn
    )
    await provider.chat([{ role: 'user', content: 'x' }])
    expect(calls[0].url).toBe('http://localhost:1234/v1/chat/completions')
  })

  it('lança erro em resposta não-ok', async () => {
    const { fn } = mockFetch('bad', false, 401)
    const provider = createProvider({ kind: 'openai', apiKey: 'k', model: 'gpt-4o' }, fn)
    await expect(provider.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(
      /inválida|sem permissão|401/i
    )
  })
})
