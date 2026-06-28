import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SERVER_CAPABILITIES, createServerApi } from '../src/renderer/src/serverApi'

/** Stub mínimo de localStorage para o histórico local do modo servidor. */
function fakeLocalStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size
    }
  } as Storage
}

const g = globalThis as unknown as {
  fetch: unknown
  localStorage: Storage
  window: unknown
}

describe('serverApi (modo servidor #123)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    g.fetch = fetchMock
    g.localStorage = fakeLocalStorage()
    // ws é delegado ao Electron local; aqui só precisa existir.
    g.window = { api: { ws: { current: async () => null } } }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function jsonResponse(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body
    } as Response
  }

  it('expõe capabilities coerentes com o thin client', () => {
    expect(SERVER_CAPABILITIES.serverMode).toBe(true)
    expect(SERVER_CAPABILITIES.managedDataSources).toBe(true)
    expect(SERVER_CAPABILITIES.adHocConnections).toBe(false)
    expect(SERVER_CAPABILITIES.workspaceFiles).toBe(true)
  })

  it('lista data sources do servidor como conexões salvas', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ dataSources: [{ id: 'ds1', name: 'Prod', kind: 'postgres' }] })
    )
    const api = createServerApi({
      serverUrl: 'https://db.local/',
      getToken: () => 'tok',
      onUnauthorized: () => {}
    })
    const list = await api.conn.list()
    expect(list).toEqual([{ id: 'ds1', name: 'Prod', kind: 'postgres' }])
    // URL normalizada (sem barra dupla) + Bearer token.
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://db.local/api/data-sources')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('executa query via POST /api/data-sources/:id/query', async () => {
    const result = { columns: ['n'], rows: [{ n: 1 }], rowCount: 1, durationMs: 2 }
    fetchMock.mockResolvedValueOnce(jsonResponse(result))
    const api = createServerApi({
      serverUrl: 'https://db.local',
      getToken: () => 'tok',
      onUnauthorized: () => {}
    })
    const res = await api.db.query('ds1', 'select 1 as n')
    expect(res).toEqual(result)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://db.local/api/data-sources/ds1/query')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ sql: 'select 1 as n' })
  })

  it('aciona onUnauthorized e lança em 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'no' }, 401))
    const onUnauthorized = vi.fn()
    const api = createServerApi({
      serverUrl: 'https://db.local',
      getToken: () => null,
      onUnauthorized
    })
    await expect(api.conn.list()).rejects.toThrow(/expirada/i)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('omite o header Authorization quando não há token (auth desabilitada)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ dataSources: [] }))
    const api = createServerApi({
      serverUrl: 'https://db.local',
      getToken: () => '',
      onUnauthorized: () => {}
    })
    await api.conn.list()
    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
  })
})
