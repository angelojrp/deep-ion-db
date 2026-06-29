import { describe, expect, it, vi } from 'vitest'
import { createMcpServer } from '../src/mcp/server'
import type { Driver } from '../src/main/db/types'

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    query: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0, durationMs: 1 }),
    listTables: vi.fn().mockResolvedValue([
      { schema: 'public', name: 'users', type: 'table' },
      { schema: 'public', name: 'posts', type: 'table' },
      { schema: 'app', name: 'logs', type: 'table' }
    ]),
    listColumns: vi.fn().mockResolvedValue([
      { name: 'id', dataType: 'int4', nullable: false },
      { name: 'name', dataType: 'text', nullable: true }
    ]),
    primaryKeys: vi.fn().mockResolvedValue(['id']),
    execBatch: vi.fn(),
    tableDdl: vi
      .fn()
      .mockResolvedValue('CREATE TABLE public.users (id INT PRIMARY KEY, name TEXT)'),
    activeSessions: vi.fn().mockResolvedValue([]),
    killSession: vi.fn(),
    listRoles: vi.fn().mockResolvedValue([]),
    serverHealth: vi.fn().mockResolvedValue([]),
    foreignKeys: vi
      .fn()
      .mockResolvedValue([
        { table: 'posts', column: 'user_id', refTable: 'users', refColumn: 'id' }
      ]),
    indexes: vi.fn().mockResolvedValue([{ name: 'users_pkey', detail: 'btree (id)' }]),
    routines: vi.fn().mockResolvedValue([]),
    jobs: vi.fn().mockResolvedValue([]),
    ...overrides
  }
}

async function callTool(
  server: ReturnType<typeof createMcpServer>,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  // _registeredTools é um objeto plain keyed pelo nome da tool (SDK MCP)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<
    string,
    { handler: (args: unknown) => Promise<unknown> }
  >
  const tool = tools?.[toolName]
  if (!tool) throw new Error(`Tool "${toolName}" não encontrada`)
  return tool.handler(args) as Promise<{
    content: { type: string; text: string }[]
    isError?: boolean
  }>
}

describe('createMcpServer', () => {
  describe('list_tables', () => {
    it('retorna tabelas do driver', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver)
      const result = await callTool(server, 'list_tables')
      expect(result.content[0].type).toBe('text')
      const data = JSON.parse(result.content[0].text) as unknown[]
      expect(data).toHaveLength(3)
      expect(driver.listTables).toHaveBeenCalled()
    })
  })

  describe('list_schemas', () => {
    it('retorna schemas únicos extraídos das tabelas', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver)
      const result = await callTool(server, 'list_schemas')
      const schemas = JSON.parse(result.content[0].text) as string[]
      expect(schemas).toContain('public')
      expect(schemas).toContain('app')
      expect(schemas).toHaveLength(2)
    })
  })

  describe('list_columns', () => {
    it('retorna colunas para schema/table', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver)
      const result = await callTool(server, 'list_columns', { schema: 'public', table: 'users' })
      const cols = JSON.parse(result.content[0].text) as { name: string }[]
      expect(cols[0].name).toBe('id')
      expect(driver.listColumns).toHaveBeenCalledWith('public', 'users')
    })
  })

  describe('describe_table', () => {
    it('retorna colunas, PKs, FKs e índices', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver)
      const result = await callTool(server, 'describe_table', {
        schema: 'public',
        table: 'posts'
      })
      const data = JSON.parse(result.content[0].text) as {
        schema: string
        table: string
        columns: unknown[]
        primaryKeys: string[]
        indexes: unknown[]
        foreignKeys: unknown[]
      }
      expect(data.schema).toBe('public')
      expect(data.table).toBe('posts')
      expect(data.columns).toHaveLength(2)
      expect(data.primaryKeys).toContain('id')
      expect(data.indexes).toHaveLength(1)
      // FK table = 'posts' → incluída
      expect(data.foreignKeys).toHaveLength(1)
    })

    it('filtra FKs pela tabela alvo', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver)
      // users não tem FKs saindo dela (o FK é em posts)
      const result = await callTool(server, 'describe_table', {
        schema: 'public',
        table: 'users'
      })
      const data = JSON.parse(result.content[0].text) as { foreignKeys: unknown[] }
      expect(data.foreignKeys).toHaveLength(0)
    })
  })

  describe('get_table_ddl', () => {
    it('retorna DDL da tabela via driver.tableDdl', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver)
      const result = await callTool(server, 'get_table_ddl', {
        schema: 'public',
        table: 'users'
      })
      expect(result.content[0].text).toContain('CREATE TABLE')
      expect(driver.tableDdl).toHaveBeenCalledWith('public', 'users')
    })
  })

  describe('query', () => {
    it('executa SELECT e retorna resultado', async () => {
      const driver = makeDriver({
        query: vi.fn().mockResolvedValue({
          columns: ['id', 'name'],
          rows: [{ id: 1, name: 'Alice' }],
          rowCount: 1,
          durationMs: 5
        })
      })
      const server = createMcpServer(driver)
      const result = await callTool(server, 'query', { sql: 'SELECT * FROM users' })
      const data = JSON.parse(result.content[0].text) as { rowCount: number }
      expect(data.rowCount).toBe(1)
    })

    it('rejeita multi-statements', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver)
      const result = await callTool(server, 'query', {
        sql: 'SELECT 1; DROP TABLE users'
      })
      expect(result.isError).toBe(true)
      expect(driver.query).not.toHaveBeenCalled()
    })

    it('aceita ponto-e-vírgula final sem rejeitar', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver)
      const result = await callTool(server, 'query', { sql: 'SELECT 1;' })
      expect(result.isError).toBeUndefined()
    })
  })

  describe('explain_query', () => {
    it('usa EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS) para postgres', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver, 'postgres')
      await callTool(server, 'explain_query', { sql: 'SELECT * FROM users' })
      expect(driver.query).toHaveBeenCalledWith(
        expect.stringContaining('EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS)')
      )
    })

    it('usa EXPLAIN QUERY PLAN para sqlite', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver, 'sqlite')
      await callTool(server, 'explain_query', { sql: 'SELECT * FROM users' })
      expect(driver.query).toHaveBeenCalledWith(expect.stringContaining('EXPLAIN QUERY PLAN'))
    })

    it('usa EXPLAIN genérico para mysql', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver, 'mysql')
      await callTool(server, 'explain_query', { sql: 'SELECT * FROM users' })
      expect(driver.query).toHaveBeenCalledWith(expect.stringMatching(/^EXPLAIN SELECT/))
    })

    it('rejeita multi-statements', async () => {
      const driver = makeDriver()
      const server = createMcpServer(driver, 'postgres')
      const result = await callTool(server, 'explain_query', {
        sql: 'SELECT 1; SELECT 2'
      })
      expect(result.isError).toBe(true)
      expect(driver.query).not.toHaveBeenCalled()
    })
  })
})
