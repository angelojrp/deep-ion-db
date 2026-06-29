import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/src/meta', () => ({ getPool: vi.fn() }))

import { getPool } from '../../server/src/meta'
import { type AuditEntry, audit, auditToCsv, listAudit } from '../../server/src/audit'

const mockPool = { query: vi.fn() }
vi.mocked(getPool).mockReturnValue(mockPool as never)

const REAL_UUID = '11111111-1111-1111-1111-111111111111'
const DS_UUID = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPool).mockReturnValue(mockPool as never)
})

describe('audit()', () => {
  it('chama insert com os parâmetros corretos', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    await audit(REAL_UUID, DS_UUID, 'query:execute', { sql: 'select 1' })

    expect(mockPool.query).toHaveBeenCalledOnce()
    const [sql, params] = mockPool.query.mock.calls[0]
    expect(sql).toContain('insert into audit_log')
    expect(params[0]).toBe(REAL_UUID)
    expect(params[1]).toBe(DS_UUID)
    expect(params[2]).toBe('query:execute')
    expect(params[3]).toBe(JSON.stringify({ sql: 'select 1' }))
  })

  it('não lança se a query falha (silencioso)', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('DB offline'))

    await expect(audit(REAL_UUID, null, 'query:execute')).resolves.toBeUndefined()
  })

  it('filtra userId que não é UUID válido — passa null para a query', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    await audit('not-a-uuid', DS_UUID, 'login')

    const [, params] = mockPool.query.mock.calls[0]
    expect(params[0]).toBeNull()
  })

  it('filtra o ZERO UUID — passa null para a query', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    await audit('00000000-0000-0000-0000-000000000000', DS_UUID, 'login')

    const [, params] = mockPool.query.mock.calls[0]
    expect(params[0]).toBeNull()
  })

  it('passa null quando detail não informado', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    await audit(REAL_UUID, null, 'connect')

    const [, params] = mockPool.query.mock.calls[0]
    expect(params[3]).toBeNull()
  })
})

describe('listAudit()', () => {
  const mockEntry: AuditEntry = {
    id: 1,
    user_id: REAL_UUID,
    email: 'user@test.com',
    data_source_id: DS_UUID,
    action: 'query:execute',
    detail: { sql: 'select 1' },
    ts: '2026-01-01T00:00:00Z'
  }

  it('sem filtros retorna todas as entradas com paginação padrão', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ n: 1 }] }) // count
      .mockResolvedValueOnce({ rows: [mockEntry] }) // data

    const result = await listAudit()

    expect(result.total).toBe(1)
    expect(result.entries).toHaveLength(1)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(50)
    expect(result.entries[0].action).toBe('query:execute')
  })

  it('com filtro userId adiciona WHERE a.user_id', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ n: 0 }] }).mockResolvedValueOnce({ rows: [] })

    await listAudit({ userId: REAL_UUID })

    const [countSql, countParams] = mockPool.query.mock.calls[0]
    expect(countSql).toContain('a.user_id = $1')
    expect(countParams[0]).toBe(REAL_UUID)
  })

  it('com filtro dataSourceId adiciona WHERE a.data_source_id', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ n: 0 }] }).mockResolvedValueOnce({ rows: [] })

    await listAudit({ dataSourceId: DS_UUID })

    const [countSql, countParams] = mockPool.query.mock.calls[0]
    expect(countSql).toContain('a.data_source_id = $1')
    expect(countParams[0]).toBe(DS_UUID)
  })

  it('com filtro action adiciona WHERE a.action', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ n: 0 }] }).mockResolvedValueOnce({ rows: [] })

    await listAudit({ action: 'login' })

    const [countSql] = mockPool.query.mock.calls[0]
    expect(countSql).toContain('a.action = $1')
  })

  it('paginação calcula offset correto', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ n: 200 }] }).mockResolvedValueOnce({ rows: [] })

    await listAudit({ page: 3, pageSize: 20 })

    const [dataSql, dataParams] = mockPool.query.mock.calls[1]
    // offset = (3-1) * 20 = 40 → último parâmetro
    expect(dataSql).toContain('offset')
    const offset = dataParams[dataParams.length - 1]
    expect(offset).toBe(40)
  })

  it('total vem do count e é retornado corretamente', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ n: 99 }] }).mockResolvedValueOnce({ rows: [] })

    const result = await listAudit()
    expect(result.total).toBe(99)
  })
})

describe('auditToCsv()', () => {
  it('retorna apenas cabeçalho para lista vazia', () => {
    const csv = auditToCsv([])
    expect(csv).toBe('id,ts,user_id,email,data_source_id,action,detail')
  })

  it('cabeçalho tem colunas corretas', () => {
    const csv = auditToCsv([])
    const header = csv.split('\n')[0]
    expect(header).toBe('id,ts,user_id,email,data_source_id,action,detail')
  })

  it('campos são envolvidos em aspas duplas', () => {
    const entry: AuditEntry = {
      id: 1,
      user_id: REAL_UUID,
      email: 'user@test.com',
      data_source_id: DS_UUID,
      action: 'login',
      detail: null,
      ts: '2026-01-01T00:00:00Z'
    }
    const csv = auditToCsv([entry])
    const dataRow = csv.split('\n')[1]
    expect(dataRow).toContain('"1"')
    expect(dataRow).toContain('"login"')
  })

  it('detail como objeto é serializado como JSON', () => {
    const entry: AuditEntry = {
      id: 2,
      user_id: null,
      email: null,
      data_source_id: null,
      action: 'query:execute',
      detail: { sql: 'select 1', rows: 10 },
      ts: '2026-01-01T00:00:00Z'
    }
    const csv = auditToCsv([entry])
    const dataRow = csv.split('\n')[1]
    expect(dataRow).toContain('select 1')
  })

  it('aspas duplas no JSON do detail são escapadas', () => {
    const entry: AuditEntry = {
      id: 3,
      user_id: null,
      email: null,
      data_source_id: null,
      action: 'test',
      detail: { key: 'value with "quotes"' },
      ts: '2026-01-01T00:00:00Z'
    }
    const csv = auditToCsv([entry])
    // As aspas no JSON devem ser escapadas como ""
    const dataRow = csv.split('\n')[1]
    expect(dataRow).toContain('""')
  })

  it('null em user_id e email resulta em string vazia', () => {
    const entry: AuditEntry = {
      id: 4,
      user_id: null,
      email: null,
      data_source_id: null,
      action: 'connect',
      detail: null,
      ts: '2026-01-01T00:00:00Z'
    }
    const csv = auditToCsv([entry])
    const dataRow = csv.split('\n')[1]
    // user_id e email como string vazia entre aspas
    expect(dataRow).toContain('""')
  })
})
