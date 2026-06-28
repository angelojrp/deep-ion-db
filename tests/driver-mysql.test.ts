import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted so the shared pool and connection mocks are available in vi.mock factories
const mysqlPool = vi.hoisted(() => ({
  query: vi.fn(),
  getConnection: vi.fn(),
  end: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
}))

const mysqlConn = vi.hoisted(() => ({
  query: vi.fn(),
  execute: vi.fn(),
  beginTransaction: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  commit: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  rollback: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  release: vi.fn()
}))

// Mock mysql2/promise before importing the driver
vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn().mockReturnValue(mysqlPool)
  }
}))

import mysql from 'mysql2/promise'
import { MysqlDriver } from '../src/main/db/drivers/mysql'
import type { ConnectionConfig } from '../src/shared/types'

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'test-mysql',
    name: 'Test MySQL',
    kind: 'mysql',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'secret',
    database: 'testdb',
    ...overrides
  }
}

describe('MysqlDriver', () => {
  let driver: MysqlDriver

  beforeEach(async () => {
    vi.clearAllMocks()
    mysqlPool.end.mockResolvedValue(undefined)
    mysqlPool.getConnection.mockResolvedValue(mysqlConn)
    mysqlConn.release.mockReturnValue(undefined)
    mysqlConn.beginTransaction.mockResolvedValue(undefined)
    mysqlConn.commit.mockResolvedValue(undefined)
    mysqlConn.rollback.mockResolvedValue(undefined)
    ;(mysql.createPool as ReturnType<typeof vi.fn>).mockReturnValue(mysqlPool)

    driver = new MysqlDriver(makeConfig())
    // connect() calls createPool, then pool.getConnection(), then conn.release()
    await driver.connect()
  })

  afterEach(async () => {
    await driver.disconnect()
  })

  describe('connect() / disconnect()', () => {
    it('chama createPool com as configurações corretas', () => {
      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'secret',
          database: 'testdb'
        })
      )
    })

    it('obtém uma conexão do pool e libera imediatamente ao conectar', () => {
      expect(mysqlPool.getConnection).toHaveBeenCalledOnce()
      expect(mysqlConn.release).toHaveBeenCalledOnce()
    })

    it('chama pool.end() ao desconectar', async () => {
      await driver.disconnect()
      expect(mysqlPool.end).toHaveBeenCalledOnce()
    })
  })

  // Helper: query() chama conn.query('SELECT CONNECTION_ID()') antes da query real
  function mockQuerySequence(result: [unknown, unknown]) {
    mysqlConn.query
      .mockResolvedValueOnce([[{ id: 12345 }], []]) // CONNECTION_ID()
      .mockResolvedValueOnce(result) // query do usuário
  }

  describe('query()', () => {
    it('retorna QueryResult correto para SELECT (array de rows)', async () => {
      const fakeRows = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]
      const fakeFields = [{ name: 'id' }, { name: 'name' }]
      mockQuerySequence([fakeRows, fakeFields])

      const result = await driver.query('SELECT id, name FROM users')

      expect(result.columns).toEqual(['id', 'name'])
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0]).toEqual({ id: 1, name: 'Alice' })
      expect(result.rowCount).toBe(2)
      expect(result.command).toBe('SELECT')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('retorna rowCount correto para DML (ResultSetHeader)', async () => {
      const header = { affectedRows: 3, insertId: 0 }
      mockQuerySequence([header, undefined])

      const result = await driver.query('DELETE FROM users WHERE active = 0')

      expect(result.rowCount).toBe(3)
      expect(result.command).toBe('OK')
      expect(result.columns).toEqual([])
      expect(result.rows).toEqual([])
    })

    it('lança erro para SQL inválido', async () => {
      mysqlConn.query
        .mockResolvedValueOnce([[{ id: 12345 }], []]) // CONNECTION_ID()
        .mockRejectedValueOnce(new Error("Table 'testdb.ghost' doesn't exist"))

      await expect(driver.query('SELECT * FROM ghost')).rejects.toThrow(
        "Table 'testdb.ghost' doesn't exist"
      )
    })

    it('retorna 0 em affectedRows quando undefined', async () => {
      const header = { affectedRows: undefined, insertId: 0 }
      mockQuerySequence([header, undefined])

      const result = await driver.query('CREATE TABLE new_table (id INT)')

      expect(result.rowCount).toBe(0)
    })
  })

  describe('listTables()', () => {
    it('executa query em information_schema e retorna SchemaTable[]', async () => {
      const fakeRows = [
        { schema: 'testdb', name: 'users', type: 'BASE TABLE' },
        { schema: 'testdb', name: 'v_active', type: 'VIEW' }
      ]
      mysqlPool.query.mockResolvedValue([fakeRows, []])

      const tables = await driver.listTables()

      expect(tables).toHaveLength(2)
      expect(tables[0]).toEqual({ schema: 'testdb', name: 'users', type: 'BASE TABLE' })
      expect(tables[1]).toEqual({ schema: 'testdb', name: 'v_active', type: 'VIEW' })

      const sql = mysqlPool.query.mock.calls[0][0] as string
      expect(sql).toContain('information_schema.tables')
    })
  })

  describe('primaryKeys()', () => {
    it('retorna nomes das colunas PK', async () => {
      mysqlPool.query.mockResolvedValue([[{ name: 'id' }], []])

      const pks = await driver.primaryKeys('testdb', 'users')

      expect(pks).toEqual(['id'])
      expect(mysqlPool.query).toHaveBeenCalledWith(expect.any(String), ['testdb', 'users'])
    })
  })

  describe('execBatch()', () => {
    it('executa beginTransaction, execute e commit via conexão dedicada', async () => {
      mysqlConn.execute.mockResolvedValue([{ affectedRows: 1 }, []])

      await driver.execBatch([
        { sql: 'INSERT INTO t VALUES (?)', params: [1] },
        { sql: 'INSERT INTO t VALUES (?)', params: [2] }
      ])

      expect(mysqlConn.beginTransaction).toHaveBeenCalledOnce()
      expect(mysqlConn.execute).toHaveBeenCalledTimes(2)
      expect(mysqlConn.commit).toHaveBeenCalledOnce()
      expect(mysqlConn.rollback).not.toHaveBeenCalled()
      expect(mysqlConn.release).toHaveBeenCalled()
    })

    it('faz rollback e relança erro em caso de falha', async () => {
      mysqlConn.execute.mockRejectedValue(new Error('Duplicate entry'))

      await expect(
        driver.execBatch([{ sql: 'INSERT INTO t VALUES (?)', params: [1] }])
      ).rejects.toThrow('Duplicate entry')

      expect(mysqlConn.rollback).toHaveBeenCalledOnce()
      expect(mysqlConn.commit).not.toHaveBeenCalled()
      expect(mysqlConn.release).toHaveBeenCalled()
    })
  })

  describe('listColumns()', () => {
    it('executa query parametrizada e mapeia nullable corretamente', async () => {
      const fakeRows = [
        { name: 'id', dataType: 'int', nullable: 'NO' },
        { name: 'email', dataType: 'varchar', nullable: 'YES' }
      ]
      mysqlPool.query.mockResolvedValue([fakeRows, []])

      const cols = await driver.listColumns('testdb', 'users')

      expect(cols).toHaveLength(2)
      expect(cols[0]).toEqual({ name: 'id', dataType: 'int', nullable: false })
      expect(cols[1]).toEqual({ name: 'email', dataType: 'varchar', nullable: true })
      expect(mysqlPool.query).toHaveBeenCalledWith(expect.any(String), ['testdb', 'users'])
    })
  })

  describe('listRoles()', () => {
    it('retorna usuários do information_schema', async () => {
      mysqlPool.query.mockResolvedValue([[{ name: "'root'@'localhost'" }], []])

      const roles = await driver.listRoles()

      expect(roles).toHaveLength(1)
      expect(roles[0].name).toBe("'root'@'localhost'")
    })
  })

  describe('indexes()', () => {
    it('retorna índices da tabela', async () => {
      mysqlPool.query.mockResolvedValue([[{ name: 'PRIMARY' }, { name: 'idx_email' }], []])

      const indexes = await driver.indexes('testdb', 'users')

      expect(indexes).toHaveLength(2)
      expect(indexes[0].name).toBe('PRIMARY')
      expect(mysqlPool.query).toHaveBeenCalledWith(expect.any(String), ['testdb', 'users'])
    })
  })

  describe('erro quando não conectado', () => {
    it('lança erro ao chamar query antes de connect()', async () => {
      const uninit = new MysqlDriver(makeConfig())
      // Não chama connect() — _pool === null
      await expect(uninit.query('SELECT 1')).rejects.toThrow('Pool MySQL não inicializado')
    })
  })
})
