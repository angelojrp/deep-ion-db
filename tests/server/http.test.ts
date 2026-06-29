/**
 * Testes de integração HTTP para o servidor Fastify (issue #188).
 *
 * Usa app.inject() para testar todos os endpoints sem iniciar um servidor real.
 * AUTH_DISABLED=true injeta o devUser (admin) sem necessidade de Keycloak.
 * Todos os módulos que acessam banco de dados são mockados com vi.mock.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

// AUTH_DISABLED precisa estar ativo antes que os módulos de auth sejam importados
process.env.AUTH_DISABLED = 'true'

// ---------------------------------------------------------------------------
// Mocks — hoistados pelo Vitest antes das importações
// ---------------------------------------------------------------------------

vi.mock('../../server/src/meta', () => ({
  metaConfigured: vi.fn().mockReturnValue(false),
  metaStatus: vi.fn().mockResolvedValue({ connected: true, tables: [] }),
  migrate: vi.fn().mockResolvedValue(undefined),
  getPool: vi.fn()
}))

vi.mock('../../server/src/dataSources', () => ({
  listDataSources: vi.fn().mockResolvedValue([]),
  createDataSource: vi.fn().mockResolvedValue({
    id: 'ds-001',
    name: 'Test DB',
    kind: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'testdb',
    username: 'user',
    ssl: false,
    environment: 'nonprod'
  }),
  deleteDataSource: vi.fn().mockResolvedValue(undefined),
  getDataSourceConfig: vi.fn().mockResolvedValue(null),
  loadDataSource: vi.fn().mockResolvedValue(null),
  updateDataSource: vi.fn().mockResolvedValue(null)
}))

// Parcial: mantém authDisabled, devUser e assertOidcConfigured reais
vi.mock('../../server/src/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/src/auth')>()
  return {
    ...actual,
    verifyToken: vi.fn().mockRejectedValue(new Error('not needed in tests')),
    upsertUser: vi.fn().mockRejectedValue(new Error('not needed in tests'))
  }
})

vi.mock('../../server/src/audit', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
  listAudit: vi.fn().mockResolvedValue({ entries: [], total: 0, page: 1, pageSize: 50 }),
  auditToCsv: vi.fn().mockReturnValue('id,ts,user_id,email,data_source_id,action,detail')
}))

vi.mock('../../server/src/users', () => ({
  listUsers: vi.fn().mockResolvedValue([]),
  updateUserRole: vi.fn().mockResolvedValue(null),
  deleteUser: vi.fn().mockResolvedValue({ grantIds: [] }),
  listUserGrants: vi.fn().mockResolvedValue([])
}))

// Parcial: mantém isReadOnlySql real (função pura, sem dependência de BD)
vi.mock('../../server/src/grants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/src/grants')>()
  return {
    ...actual,
    listGrants: vi.fn().mockResolvedValue([]),
    createGrant: vi.fn().mockResolvedValue({
      id: 'grant-001',
      user_id: 'user-abc',
      data_source_id: 'ds-001',
      mode: 'read',
      created_at: '2026-01-01T00:00:00Z',
      expires_at: null,
      suspended: false,
      expired: false
    }),
    deleteGrant: vi.fn().mockResolvedValue(undefined),
    updateGrant: vi.fn().mockResolvedValue(null),
    getGrantMode: vi.fn().mockResolvedValue('readwrite')
  }
})

// Mock dos drivers — evita tentativas de conexão real com banco de dados.
// Usa função regular (não arrow) como implementação de construtor para Vitest 4.x.
// Instâncias de mock são compartilhadas para que os métodos sejam rastreáveis.

vi.mock('../../src/main/db/drivers/postgres', () => {
  const mockPgInstance = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ columns: ['?column?'], rows: [[1]], rowCount: 1 }),
    listTables: vi.fn().mockResolvedValue([]),
    listColumns: vi.fn().mockResolvedValue([])
  }
  return {
    PostgresDriver: vi.fn().mockImplementation(function () {
      return mockPgInstance
    })
  }
})

vi.mock('../../src/main/db/drivers/mysql', () => {
  const mockInstance = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0 }),
    listTables: vi.fn().mockResolvedValue([]),
    listColumns: vi.fn().mockResolvedValue([])
  }
  return {
    MysqlDriver: vi.fn().mockImplementation(function () {
      return mockInstance
    })
  }
})

vi.mock('../../src/main/db/drivers/sqlite', () => {
  const mockInstance = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0 }),
    listTables: vi.fn().mockResolvedValue([]),
    listColumns: vi.fn().mockResolvedValue([])
  }
  return {
    SqliteDriver: vi.fn().mockImplementation(function () {
      return mockInstance
    })
  }
})

vi.mock('../../src/main/db/drivers/mssql', () => {
  const mockInstance = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0 }),
    listTables: vi.fn().mockResolvedValue([]),
    listColumns: vi.fn().mockResolvedValue([])
  }
  return {
    MssqlDriver: vi.fn().mockImplementation(function () {
      return mockInstance
    })
  }
})

vi.mock('../../src/main/db/drivers/oracle', () => {
  const mockInstance = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0 }),
    listTables: vi.fn().mockResolvedValue([]),
    listColumns: vi.fn().mockResolvedValue([])
  }
  return {
    OracleDriver: vi.fn().mockImplementation(function () {
      return mockInstance
    })
  }
})

// Mock do plugin de arquivos estáticos — diretório web/public pode não existir em testes
vi.mock('@fastify/static', () => ({
  default: vi.fn().mockImplementation(async function () {})
}))

// ---------------------------------------------------------------------------
// Importações reais (após os mocks)
// ---------------------------------------------------------------------------

import { buildApp } from '../../server/src/index'
import * as dataSourcesMod from '../../server/src/dataSources'
import * as auditMod from '../../server/src/audit'
import * as usersMod from '../../server/src/users'
import * as grantsMod from '../../server/src/grants'

// ---------------------------------------------------------------------------
// Setup do ciclo de vida
// ---------------------------------------------------------------------------

const DEV_USER_ID = '00000000-0000-0000-0000-000000000000'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
})

// Redefine apenas os mocks de dados entre testes (sem clearAllMocks para não
// perder implementações dos drivers que não são re-configuradas no beforeEach)
beforeEach(() => {
  vi.mocked(dataSourcesMod.listDataSources).mockResolvedValue([])
  vi.mocked(dataSourcesMod.createDataSource).mockResolvedValue({
    id: 'ds-001',
    name: 'Test DB',
    kind: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'testdb',
    username: 'user',
    ssl: false,
    environment: 'nonprod'
  })
  vi.mocked(dataSourcesMod.deleteDataSource).mockResolvedValue(undefined)
  vi.mocked(dataSourcesMod.loadDataSource).mockResolvedValue(null)
  vi.mocked(auditMod.audit).mockResolvedValue(undefined)
  vi.mocked(auditMod.listAudit).mockResolvedValue({ entries: [], total: 0, page: 1, pageSize: 50 })
  vi.mocked(usersMod.listUsers).mockResolvedValue([])
  vi.mocked(usersMod.updateUserRole).mockResolvedValue(null)
  vi.mocked(usersMod.deleteUser).mockResolvedValue({ grantIds: [] })
  vi.mocked(usersMod.listUserGrants).mockResolvedValue([])
  vi.mocked(grantsMod.listGrants).mockResolvedValue([])
  vi.mocked(grantsMod.createGrant).mockResolvedValue({
    id: 'grant-001',
    user_id: 'user-abc',
    data_source_id: 'ds-001',
    mode: 'read',
    created_at: '2026-01-01T00:00:00Z',
    expires_at: null,
    suspended: false,
    expired: false
  })
  vi.mocked(grantsMod.deleteGrant).mockResolvedValue(undefined)
  vi.mocked(grantsMod.getGrantMode).mockResolvedValue('readwrite')
})

// ---------------------------------------------------------------------------
// Casos de teste
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('retorna 200 com ok:true e service name', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.service).toBe('deep-ion-db-server')
  })
})

describe('GET /api/auth/config', () => {
  it('retorna 200 com authDisabled:true quando AUTH_DISABLED=true', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/config' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.authDisabled).toBe(true)
  })

  it('inclui campos issuer e audience na resposta (null quando não configurados)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/config' })

    const body = res.json()
    expect(body).toHaveProperty('issuer')
    expect(body).toHaveProperty('audience')
  })
})

describe('GET /api/me', () => {
  it('retorna 200 com dados do devUser (id, role admin e subject)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(DEV_USER_ID)
    expect(body.role).toBe('admin')
    expect(body.subject).toBe('dev')
  })
})

describe('GET /api/meta/status', () => {
  it('retorna configured:false quando metaConfigured retorna false', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/meta/status' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.configured).toBe(false)
  })
})

describe('GET /api/data-sources', () => {
  it('retorna 200 com lista de data sources para admin', async () => {
    const mockDs = [
      {
        id: 'ds-001',
        name: 'Prod DB',
        kind: 'postgres',
        host: 'db.prod',
        port: 5432,
        database: 'prod',
        username: 'admin',
        ssl: true,
        environment: 'prod'
      }
    ]
    vi.mocked(dataSourcesMod.listDataSources).mockResolvedValue(mockDs)

    const res = await app.inject({ method: 'GET', url: '/api/data-sources' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.dataSources).toHaveLength(1)
    expect(body.dataSources[0].name).toBe('Prod DB')
  })

  it('retorna lista vazia quando não há data sources cadastrados', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/data-sources' })

    expect(res.statusCode).toBe(200)
    expect(res.json().dataSources).toEqual([])
  })
})

describe('POST /api/data-sources', () => {
  it('retorna 400 quando body não tem campo name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ kind: 'postgres' })
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toMatch(/name/)
  })

  it('retorna 400 quando body está completamente vazio (sem name)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({})
    })

    expect(res.statusCode).toBe(400)
  })

  it('cria data source e retorna o objeto criado quando name está presente', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Novo DB', kind: 'postgres', host: 'localhost', port: 5432 })
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe('ds-001')
    expect(body.name).toBe('Test DB')
    expect(dataSourcesMod.createDataSource).toHaveBeenCalledOnce()
    expect(auditMod.audit).toHaveBeenCalledWith(DEV_USER_ID, 'ds-001', 'data_source.create', {
      name: 'Test DB'
    })
  })
})

describe('DELETE /api/data-sources/:id', () => {
  it('retorna 200 com ok:true e registra evento de auditoria', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/data-sources/ds-001' })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(dataSourcesMod.deleteDataSource).toHaveBeenCalledWith('ds-001')
    expect(auditMod.audit).toHaveBeenCalledWith(DEV_USER_ID, 'ds-001', 'data_source.delete')
  })
})

describe('GET /api/users', () => {
  it('retorna 200 com lista de usuários para admin', async () => {
    const mockUsers = [
      {
        id: 'user-001',
        email: 'alice@test.com',
        name: 'Alice',
        role: 'admin',
        created_at: '2026-01-01'
      }
    ]
    vi.mocked(usersMod.listUsers).mockResolvedValue(mockUsers)

    const res = await app.inject({ method: 'GET', url: '/api/users' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.users).toHaveLength(1)
    expect(body.users[0].email).toBe('alice@test.com')
  })

  it('retorna array vazio quando não há usuários cadastrados', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users' })

    expect(res.statusCode).toBe(200)
    expect(res.json().users).toEqual([])
  })
})

describe('PATCH /api/users/:id', () => {
  it('retorna 400 quando tenta alterar o próprio papel (self-edit proibido)', async () => {
    // devUser.id = DEV_USER_ID; alterar o próprio papel deve ser recusado
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${DEV_USER_ID}`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ role: 'user' })
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toMatch(/próprio papel/)
  })

  it('retorna 404 quando usuário alvo não existe', async () => {
    vi.mocked(usersMod.updateUserRole).mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/outro-user-id',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ role: 'user' })
    })

    expect(res.statusCode).toBe(404)
  })

  it('retorna 200 com usuário atualizado e registra auditoria', async () => {
    const updatedUser = {
      id: 'outro-user-id',
      email: 'bob@test.com',
      name: 'Bob',
      role: 'user',
      created_at: '2026-01-01'
    }
    vi.mocked(usersMod.updateUserRole).mockResolvedValue(updatedUser)

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/outro-user-id',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ role: 'user' })
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe('outro-user-id')
    expect(auditMod.audit).toHaveBeenCalledWith(DEV_USER_ID, null, 'user.role_changed', {
      userId: 'outro-user-id',
      role: 'user'
    })
  })
})

describe('GET /api/grants', () => {
  it('retorna 200 com lista de grants — admin recebe todos (userId=undefined)', async () => {
    const mockGrants = [
      {
        id: 'g-001',
        user_id: 'user-abc',
        data_source_id: 'ds-001',
        mode: 'read',
        created_at: '2026-01-01T00:00:00Z',
        expires_at: null,
        suspended: false,
        expired: false
      }
    ]
    vi.mocked(grantsMod.listGrants).mockResolvedValue(mockGrants)

    const res = await app.inject({ method: 'GET', url: '/api/grants' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.grants).toHaveLength(1)
    expect(body.grants[0].mode).toBe('read')
    // Admin passa undefined para listGrants (busca todos)
    expect(grantsMod.listGrants).toHaveBeenCalledWith(undefined)
  })
})

describe('POST /api/grants', () => {
  it('cria grant e retorna 200 com o registro criado e auditoria registrada', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/grants',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userId: 'user-abc', dataSourceId: 'ds-001', mode: 'read' })
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe('grant-001')
    expect(body.mode).toBe('read')
    expect(grantsMod.createGrant).toHaveBeenCalledWith('user-abc', 'ds-001', 'read')
    expect(auditMod.audit).toHaveBeenCalledWith(DEV_USER_ID, 'ds-001', 'grant.create', {
      userId: 'user-abc',
      mode: 'read'
    })
  })
})

describe('DELETE /api/grants/:id', () => {
  it('retorna 200 com ok:true e registra auditoria de remoção', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/grants/grant-001' })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(grantsMod.deleteGrant).toHaveBeenCalledWith('grant-001')
    expect(auditMod.audit).toHaveBeenCalledWith(DEV_USER_ID, null, 'grant.deleted', {
      grantId: 'grant-001'
    })
  })
})

describe('GET /api/audit', () => {
  it('retorna 200 com entradas de auditoria para admin', async () => {
    const mockEntries = [
      {
        id: 1,
        user_id: DEV_USER_ID,
        email: 'dev@local',
        data_source_id: 'ds-001',
        action: 'query',
        detail: { rowCount: 10 },
        ts: '2026-01-01T00:00:00Z'
      }
    ]
    vi.mocked(auditMod.listAudit).mockResolvedValue({
      entries: mockEntries,
      total: 1,
      page: 1,
      pageSize: 50
    })

    const res = await app.inject({ method: 'GET', url: '/api/audit' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].action).toBe('query')
  })

  it('repassa parâmetros de paginação para listAudit', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/audit?page=2&pageSize=10' })

    expect(res.statusCode).toBe(200)
    expect(auditMod.listAudit).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10 })
    )
  })
})

describe('GET /api/users/:id/grants', () => {
  it('retorna 200 com lista de grants do usuário solicitado', async () => {
    const userGrants = [
      {
        id: 'g-002',
        user_id: 'user-abc',
        data_source_id: 'ds-001',
        mode: 'readwrite',
        created_at: '2026-01-01T00:00:00Z',
        expires_at: null,
        suspended: false,
        expired: false
      }
    ]
    vi.mocked(usersMod.listUserGrants).mockResolvedValue(userGrants)

    const res = await app.inject({ method: 'GET', url: '/api/users/user-abc/grants' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.grants).toHaveLength(1)
    expect(body.grants[0].mode).toBe('readwrite')
    expect(usersMod.listUserGrants).toHaveBeenCalledWith('user-abc')
  })
})

describe('POST /api/data-sources/:id/query', () => {
  it('retorna 403 quando SQL é DML e data source está em ambiente prod (modo read forçado)', async () => {
    // prod força effectiveMode = 'read', independente do grant do admin
    vi.mocked(dataSourcesMod.loadDataSource).mockResolvedValue({
      config: {
        id: 'ds-prod',
        name: 'Prod DB',
        kind: 'postgres',
        host: 'prod-server',
        port: 5432,
        database: 'proddb',
        user: 'dbuser',
        ssl: false
      },
      environment: 'prod'
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/data-sources/ds-prod/query',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ sql: 'DELETE FROM users' })
    })

    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.error).toMatch(/somente-leitura/)
  })

  it('retorna 200 com resultado da query quando SELECT em banco nonprod (readwrite)', async () => {
    vi.mocked(dataSourcesMod.loadDataSource).mockResolvedValue({
      config: {
        id: 'ds-dev',
        name: 'Dev DB',
        kind: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'devdb',
        user: 'devuser',
        ssl: false
      },
      environment: 'nonprod'
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/data-sources/ds-dev/query',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ sql: 'SELECT 1' })
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('rows')
    expect(body).toHaveProperty('columns')
    expect(auditMod.audit).toHaveBeenCalledWith(
      DEV_USER_ID,
      'ds-dev',
      'query',
      expect.objectContaining({ readonly: false })
    )
  })

  it('retorna 404 quando data source não existe', async () => {
    vi.mocked(dataSourcesMod.loadDataSource).mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/api/data-sources/ds-inexistente/query',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ sql: 'SELECT 1' })
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/auth/token', () => {
  it('retorna 501 (não implementado: fluxo Auth Code + PKCE é externo)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/token' })

    expect(res.statusCode).toBe(501)
    expect(res.json().error).toMatch(/não implementado/)
  })
})
