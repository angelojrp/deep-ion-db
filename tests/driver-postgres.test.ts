import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Shared mock objects created via vi.hoisted so they're available in vi.mock factories
const pgPool = vi.hoisted(() => ({
  query: vi.fn(),
  end: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  connect: vi.fn()
}))

const pgPoolClient = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn()
}))

// Mock pg before importing driver
vi.mock('pg', () => ({
  Pool: class {
    query = pgPool.query
    end = pgPool.end
    connect = pgPool.connect
  }
}))

import { PostgresDriver } from '../src/main/db/drivers/postgres'
import type { ConnectionConfig } from '../src/shared/types'

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'test-pg',
    name: 'Test Postgres',
    kind: 'postgres',
    host: 'localhost',
    port: 5432,
    user: 'test',
    password: 'secret',
    database: 'testdb',
    ...overrides
  }
}

describe('PostgresDriver', () => {
  let driver: PostgresDriver

  beforeEach(async () => {
    vi.clearAllMocks()
    pgPool.end.mockResolvedValue(undefined)
    // pool.connect() returns a client with query and release
    pgPool.connect.mockResolvedValue(pgPoolClient)
    pgPoolClient.release.mockReturnValue(undefined)
    pgPoolClient.query.mockResolvedValue({ rows: [], rowCount: 0, command: 'OK' })

    driver = new PostgresDriver(makeConfig())
    // connect() calls pool.connect() then client.release() — just a connectivity check
    await driver.connect()
  })

  afterEach(async () => {
    await driver.disconnect()
  })

  describe('connect() / disconnect()', () => {
    it('obtém uma conexão do pool e libera imediatamente ao conectar', () => {
      expect(pgPool.connect).toHaveBeenCalledOnce()
      expect(pgPoolClient.release).toHaveBeenCalledOnce()
    })

    it('chama pool.end() ao desconectar', async () => {
      await driver.disconnect()
      expect(pgPool.end).toHaveBeenCalledOnce()
    })
  })

  // Helper: o driver faz client.query('SELECT pg_backend_pid()') antes da query real
  function mockQuerySequence(result: unknown) {
    pgPoolClient.query
      .mockResolvedValueOnce({ rows: [{ pid: 12345 }] }) // pg_backend_pid()
      .mockResolvedValueOnce(result) // query do usuário
  }

  describe('query()', () => {
    it('retorna QueryResult correto para SELECT', async () => {
      mockQuerySequence({
        fields: [{ name: 'id' }, { name: 'name' }],
        rows: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ],
        rowCount: 2,
        command: 'SELECT'
      })

      const result = await driver.query('SELECT id, name FROM users')

      expect(result.columns).toEqual(['id', 'name'])
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0]).toEqual({ id: 1, name: 'Alice' })
      expect(result.rowCount).toBe(2)
      expect(result.command).toBe('SELECT')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('retorna rowCount correto para INSERT', async () => {
      mockQuerySequence({
        fields: [],
        rows: [],
        rowCount: 1,
        command: 'INSERT'
      })

      const result = await driver.query("INSERT INTO users VALUES (3, 'Carol')")

      expect(result.rowCount).toBe(1)
      expect(result.command).toBe('INSERT')
      expect(result.columns).toEqual([])
    })

    it('lida com resultado array (múltiplos statements) — usa o último', async () => {
      mockQuerySequence([
        { fields: [], rows: [], rowCount: 0, command: 'CREATE' },
        {
          fields: [{ name: 'n' }],
          rows: [{ n: 42 }],
          rowCount: 1,
          command: 'SELECT'
        }
      ])

      const result = await driver.query('CREATE TABLE t(n int); SELECT 42 as n')

      expect(result.command).toBe('SELECT')
      expect(result.rows[0].n).toBe(42)
    })

    it('propaga erro do cliente', async () => {
      pgPoolClient.query
        .mockResolvedValueOnce({ rows: [{ pid: 12345 }] }) // pg_backend_pid()
        .mockRejectedValueOnce(new Error('connection refused'))

      await expect(driver.query('SELECT 1')).rejects.toThrow('connection refused')
    })
  })

  describe('listTables()', () => {
    it('executa query em information_schema e retorna SchemaTable[]', async () => {
      pgPool.query.mockResolvedValue({
        fields: [{ name: 'schema' }, { name: 'name' }, { name: 'type' }],
        rows: [
          { schema: 'public', name: 'users', type: 'BASE TABLE' },
          { schema: 'public', name: 'v_users', type: 'VIEW' }
        ],
        rowCount: 2,
        command: 'SELECT'
      })

      const tables = await driver.listTables()

      expect(tables).toHaveLength(2)
      expect(tables[0]).toEqual({ schema: 'public', name: 'users', type: 'BASE TABLE' })
      expect(tables[1]).toEqual({ schema: 'public', name: 'v_users', type: 'VIEW' })

      const sql = pgPool.query.mock.calls[0][0] as string
      expect(sql).toContain('information_schema.tables')
      expect(sql).toContain('pg_catalog')
    })
  })

  describe('primaryKeys()', () => {
    it('retorna nomes das colunas PK', async () => {
      pgPool.query.mockResolvedValue({
        rows: [{ name: 'id' }],
        rowCount: 1,
        command: 'SELECT'
      })

      const pks = await driver.primaryKeys('public', 'users')

      expect(pks).toEqual(['id'])
      expect(pgPool.query).toHaveBeenCalledWith(expect.any(String), ['public', 'users'])
    })
  })

  describe('execBatch()', () => {
    it('executa BEGIN, statements e COMMIT via client dedicado', async () => {
      pgPoolClient.query.mockResolvedValue({ rows: [], rowCount: 0, command: 'OK' })

      await driver.execBatch([
        { sql: 'INSERT INTO t VALUES ($1)', params: [1] },
        { sql: 'INSERT INTO t VALUES ($1)', params: [2] }
      ])

      const calls = pgPoolClient.query.mock.calls as [string, ...unknown[]][]
      expect(calls[0][0]).toBe('BEGIN')
      expect(calls[1][0]).toBe('INSERT INTO t VALUES ($1)')
      expect(calls[2][0]).toBe('INSERT INTO t VALUES ($1)')
      expect(calls[3][0]).toBe('COMMIT')
      expect(pgPoolClient.release).toHaveBeenCalled()
    })

    it('faz ROLLBACK e relança erro em caso de falha', async () => {
      pgPoolClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'OK' }) // BEGIN
        .mockRejectedValueOnce(new Error('unique violation')) // statement
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'OK' }) // ROLLBACK

      await expect(
        driver.execBatch([{ sql: 'INSERT INTO t VALUES ($1)', params: [1] }])
      ).rejects.toThrow('unique violation')

      const calls = pgPoolClient.query.mock.calls as [string, ...unknown[]][]
      const queryNames = calls.map((c) => c[0])
      expect(queryNames).toContain('ROLLBACK')
      expect(pgPoolClient.release).toHaveBeenCalled()
    })
  })

  describe('listColumns()', () => {
    it('executa query parametrizada e mapeia nullable corretamente', async () => {
      pgPool.query.mockResolvedValue({
        rows: [
          { name: 'id', dataType: 'integer', nullable: 'NO' },
          { name: 'email', dataType: 'text', nullable: 'YES' }
        ],
        rowCount: 2,
        command: 'SELECT'
      })

      const cols = await driver.listColumns('public', 'users')

      expect(cols).toHaveLength(2)
      expect(cols[0]).toEqual({ name: 'id', dataType: 'integer', nullable: false })
      expect(cols[1]).toEqual({ name: 'email', dataType: 'text', nullable: true })
      expect(pgPool.query).toHaveBeenCalledWith(expect.any(String), ['public', 'users'])
    })
  })

  describe('listRoles()', () => {
    it('retorna roles do banco', async () => {
      pgPool.query.mockResolvedValue({
        rows: [
          { name: 'admin', canLogin: true, isSuper: true },
          { name: 'readonly', canLogin: true, isSuper: false }
        ],
        rowCount: 2,
        command: 'SELECT'
      })

      const roles = await driver.listRoles()

      expect(roles).toHaveLength(2)
      expect(roles[0]).toEqual({ name: 'admin', canLogin: true, isSuper: true })
    })
  })

  describe('jobs()', () => {
    it('retorna lista vazia quando pg_cron não está instalado', async () => {
      pgPool.query.mockRejectedValue(new Error('relation "cron.job" does not exist'))

      const jobs = await driver.jobs()

      expect(jobs).toEqual([])
    })

    it('retorna jobs quando pg_cron está disponível', async () => {
      pgPool.query.mockResolvedValue({
        rows: [
          { name: 'cleanup', schedule: '0 2 * * *', command: 'DELETE FROM logs', enabled: true }
        ],
        rowCount: 1,
        command: 'SELECT'
      })

      const jobs = await driver.jobs()

      expect(jobs).toHaveLength(1)
      expect(jobs[0].name).toBe('cleanup')
    })
  })
})
