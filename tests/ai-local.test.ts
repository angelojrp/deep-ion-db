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

describe('LocalProvider', () => {
  it('monta a request no padrão OpenAI Chat Completions com URL local', async () => {
    const { fn, calls } = mockFetch({ choices: [{ message: { content: 'SELECT 4;' } }] })
    const provider = createProvider(
      {
        kind: 'local',
        apiKey: '',
        model: 'llama3.2',
        baseUrl: 'http://localhost:11434/v1'
      },
      fn
    )
    const out = await provider.chat([{ role: 'user', content: 'gere um select' }], {
      system: 'voce e um DBA'
    })

    expect(out).toBe('SELECT 4;')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions')
    const body = JSON.parse(calls[0].init.body)
    expect(body.model).toBe('llama3.2')
    expect(body.messages[0]).toEqual({ role: 'system', content: 'voce e um DBA' })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'gere um select' })
  })

  it('não envia Authorization quando apiKey está vazio', async () => {
    const { fn, calls } = mockFetch({ choices: [{ message: { content: 'ok' } }] })
    const provider = createProvider(
      { kind: 'local', apiKey: '', model: 'mistral', baseUrl: 'http://localhost:1234/v1' },
      fn
    )
    await provider.chat([{ role: 'user', content: 'x' }])
    expect(calls[0].init.headers.authorization).toBeUndefined()
  })

  it('envia Authorization Bearer quando apiKey é informada', async () => {
    const { fn, calls } = mockFetch({ choices: [{ message: { content: 'ok' } }] })
    const provider = createProvider(
      {
        kind: 'local',
        apiKey: 'lm-studio-key',
        model: 'qwen2.5',
        baseUrl: 'http://localhost:1234/v1'
      },
      fn
    )
    await provider.chat([{ role: 'user', content: 'x' }])
    expect(calls[0].init.headers.authorization).toBe('Bearer lm-studio-key')
  })

  it('usa http://localhost:11434/v1 como baseUrl padrão quando não informada', async () => {
    const { fn, calls } = mockFetch({ choices: [{ message: { content: 'ok' } }] })
    const provider = createProvider({ kind: 'local', apiKey: '', model: 'llama3.2' }, fn)
    await provider.chat([{ role: 'user', content: 'x' }])
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions')
  })

  it('lança erro em resposta não-ok', async () => {
    const { fn } = mockFetch('model not found', false, 404)
    const provider = createProvider(
      { kind: 'local', apiKey: '', model: 'nonexistent', baseUrl: 'http://localhost:11434/v1' },
      fn
    )
    await expect(provider.chat([{ role: 'user', content: 'x' }])).rejects.toThrow('Local 404')
  })

  it('passa AbortSignal.timeout na request', async () => {
    const { fn, calls } = mockFetch({ choices: [{ message: { content: 'ok' } }] })
    const provider = createProvider(
      { kind: 'local', apiKey: '', model: 'llama3.2', baseUrl: 'http://localhost:11434/v1' },
      fn
    )
    await provider.chat([{ role: 'user', content: 'x' }])
    expect(calls[0].init.signal).toBeDefined()
  })
})
