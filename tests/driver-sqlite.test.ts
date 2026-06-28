import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteDriver } from '../src/main/db/drivers/sqlite'
import type { ConnectionConfig } from '../src/shared/types'

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'test-sqlite',
    name: 'Test SQLite',
    kind: 'sqlite',
    filePath: ':memory:',
    ...overrides
  }
}

describe('SqliteDriver', () => {
  let driver: SqliteDriver

  beforeEach(async () => {
    driver = new SqliteDriver(makeConfig())
    await driver.connect()
  })

  afterEach(async () => {
    await driver.disconnect()
  })

  describe('query()', () => {
    it('retorna QueryResult correto para SELECT', async () => {
      const result = await driver.query("SELECT 1 AS num, 'hello' AS msg")

      expect(result.columns).toEqual(['num', 'msg'])
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]).toEqual({ num: 1, msg: 'hello' })
      expect(result.rowCount).toBe(1)
      expect(result.command).toBe('SELECT')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('retorna múltiplas linhas corretamente', async () => {
      await driver.query('CREATE TABLE nums (n INTEGER)')
      await driver.query('INSERT INTO nums VALUES (10)')
      await driver.query('INSERT INTO nums VALUES (20)')
      await driver.query('INSERT INTO nums VALUES (30)')

      const result = await driver.query('SELECT n FROM nums ORDER BY n')

      expect(result.columns).toEqual(['n'])
      expect(result.rowCount).toBe(3)
      expect(result.rows.map((r) => r.n)).toEqual([10, 20, 30])
    })

    it('retorna affectedRows para DDL/DML', async () => {
      const result = await driver.query('CREATE TABLE t (id INTEGER)')

      expect(result.columns).toEqual([])
      expect(result.rows).toEqual([])
      expect(result.command).toBe('OK')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('retorna rowCount correto após INSERT', async () => {
      await driver.query('CREATE TABLE items (val TEXT)')
      const result = await driver.query("INSERT INTO items VALUES ('a')")

      expect(result.rowCount).toBe(1)
      expect(result.command).toBe('OK')
    })

    it('lança erro para SQL inválido', async () => {
      await expect(driver.query('SELECT FROM WHERE')).rejects.toThrow()
    })
  })

  describe('listTables()', () => {
    it('retorna lista vazia quando não há tabelas', async () => {
      const tables = await driver.listTables()
      expect(tables).toEqual([])
    })

    it('retorna tabelas criadas', async () => {
      await driver.query('CREATE TABLE users (id INTEGER, name TEXT)')
      await driver.query('CREATE TABLE orders (id INTEGER)')

      const tables = await driver.listTables()

      expect(tables).toHaveLength(2)
      expect(tables.every((t) => t.schema === 'main')).toBe(true)
      const names = tables.map((t) => t.name)
      expect(names).toContain('users')
      expect(names).toContain('orders')
    })

    it('não lista tabelas internas do SQLite (sqlite_*)', async () => {
      const tables = await driver.listTables()
      expect(tables.every((t) => !t.name.startsWith('sqlite_'))).toBe(true)
    })
  })

  describe('execBatch()', () => {
    it('executa múltiplos statements em transação', async () => {
      await driver.query('CREATE TABLE accounts (id INTEGER, balance INTEGER)')
      await driver.query('INSERT INTO accounts VALUES (1, 100)')

      await driver.execBatch([
        { sql: 'UPDATE accounts SET balance = balance + ? WHERE id = ?', params: [50, 1] },
        { sql: 'INSERT INTO accounts VALUES (?, ?)', params: [2, 200] }
      ])

      const result = await driver.query('SELECT balance FROM accounts WHERE id = 1')
      expect(result.rows[0].balance).toBe(150)

      const result2 = await driver.query('SELECT * FROM accounts ORDER BY id')
      expect(result2.rowCount).toBe(2)
    })

    it('faz rollback em caso de erro', async () => {
      await driver.query('CREATE TABLE wallets (id INTEGER PRIMARY KEY, amount INTEGER)')
      await driver.query('INSERT INTO wallets VALUES (1, 500)')

      // Segundo statement vai falhar (violação de PK)
      await expect(
        driver.execBatch([
          { sql: 'INSERT INTO wallets VALUES (?, ?)', params: [2, 100] },
          { sql: 'INSERT INTO wallets VALUES (?, ?)', params: [1, 999] } // ID 1 já existe
        ])
      ).rejects.toThrow()

      // ID 2 não deve ter sido inserido por causa do rollback
      const result = await driver.query('SELECT * FROM wallets')
      expect(result.rowCount).toBe(1)
      expect(result.rows[0].id).toBe(1)
    })
  })

  describe('listColumns()', () => {
    it('retorna colunas corretamente', async () => {
      await driver.query('CREATE TABLE products (id INTEGER NOT NULL, name TEXT, price REAL)')

      const cols = await driver.listColumns('main', 'products')

      expect(cols).toHaveLength(3)
      expect(cols[0]).toMatchObject({ name: 'id', dataType: 'INTEGER', nullable: false })
      expect(cols[1]).toMatchObject({ name: 'name', dataType: 'TEXT', nullable: true })
      expect(cols[2]).toMatchObject({ name: 'price', dataType: 'REAL', nullable: true })
    })
  })

  describe('primaryKeys()', () => {
    it('retorna chaves primárias', async () => {
      await driver.query('CREATE TABLE pk_test (id INTEGER PRIMARY KEY, val TEXT)')

      const pks = await driver.primaryKeys('main', 'pk_test')

      expect(pks).toEqual(['id'])
    })

    it('retorna lista vazia quando não há PK', async () => {
      await driver.query('CREATE TABLE no_pk (col1 TEXT, col2 INTEGER)')

      const pks = await driver.primaryKeys('main', 'no_pk')

      expect(pks).toEqual([])
    })
  })

  describe('serverHealth()', () => {
    it('retorna métricas com tamanho e tabelas', async () => {
      await driver.query('CREATE TABLE health_test (x INTEGER)')

      const metrics = await driver.serverHealth()

      expect(metrics.length).toBeGreaterThanOrEqual(2)
      const labels = metrics.map((m) => m.label)
      expect(labels).toContain('Tamanho (bytes)')
      expect(labels).toContain('Tabelas')
      const tablesMetric = metrics.find((m) => m.label === 'Tabelas')
      expect(Number(tablesMetric?.value)).toBeGreaterThanOrEqual(1)
    })
  })

  describe('erro quando não conectado', () => {
    it('lança erro ao chamar query antes de connect()', async () => {
      const uninit = new SqliteDriver(makeConfig())
      await expect(uninit.query('SELECT 1')).rejects.toThrow('Banco SQLite não inicializado')
    })

    it('lança erro se filePath não for fornecido', async () => {
      const noPath = new SqliteDriver(makeConfig({ filePath: undefined }))
      await expect(noPath.connect()).rejects.toThrow('Caminho do arquivo SQLite é obrigatório')
    })
  })

  describe('tableDdl()', () => {
    it('retorna DDL da tabela', async () => {
      await driver.query('CREATE TABLE ddl_test (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')

      const ddl = await driver.tableDdl('main', 'ddl_test')

      expect(ddl).toContain('ddl_test')
      expect(ddl).toContain('CREATE TABLE')
    })

    it('retorna mensagem quando tabela não existe', async () => {
      const ddl = await driver.tableDdl('main', 'nonexistent_table')
      expect(ddl).toContain('DDL não encontrado')
    })
  })
})
