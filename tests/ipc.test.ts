import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted runs before the vi.mock factories, making the shared object available.
const shared = vi.hoisted(() => ({
  connect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  query: vi.fn(),
  listTables: vi.fn(),
  listColumns: vi.fn(),
  primaryKeys: vi.fn(),
  execBatch: vi.fn(),
  tableDdl: vi.fn(),
  activeSessions: vi.fn(),
  killSession: vi.fn(),
  listRoles: vi.fn(),
  serverHealth: vi.fn(),
  foreignKeys: vi.fn(),
  indexes: vi.fn(),
  routines: vi.fn(),
  jobs: vi.fn()
}))

vi.mock('../src/main/db/drivers/postgres', () => ({
  PostgresDriver: class {
    connect = shared.connect
    disconnect = shared.disconnect
    query = shared.query
    listTables = shared.listTables
    listColumns = shared.listColumns
    primaryKeys = shared.primaryKeys
    execBatch = shared.execBatch
    tableDdl = shared.tableDdl
    activeSessions = shared.activeSessions
    killSession = shared.killSession
    listRoles = shared.listRoles
    serverHealth = shared.serverHealth
    foreignKeys = shared.foreignKeys
    indexes = shared.indexes
    routines = shared.routines
    jobs = shared.jobs
  }
}))

vi.mock('../src/main/db/drivers/mysql', () => ({
  MysqlDriver: class {
    connect = shared.connect
    disconnect = shared.disconnect
    query = shared.query
    listTables = shared.listTables
    listColumns = shared.listColumns
    primaryKeys = shared.primaryKeys
    execBatch = shared.execBatch
    tableDdl = shared.tableDdl
    activeSessions = shared.activeSessions
    killSession = shared.killSession
    listRoles = shared.listRoles
    serverHealth = shared.serverHealth
    foreignKeys = shared.foreignKeys
    indexes = shared.indexes
    routines = shared.routines
    jobs = shared.jobs
  }
}))

vi.mock('../src/main/db/drivers/sqlite', () => ({
  SqliteDriver: class {
    connect = shared.connect
    disconnect = shared.disconnect
    query = shared.query
    listTables = shared.listTables
    listColumns = shared.listColumns
    primaryKeys = shared.primaryKeys
    execBatch = shared.execBatch
    tableDdl = shared.tableDdl
    activeSessions = shared.activeSessions
    killSession = shared.killSession
    listRoles = shared.listRoles
    serverHealth = shared.serverHealth
    foreignKeys = shared.foreignKeys
    indexes = shared.indexes
    routines = shared.routines
    jobs = shared.jobs
  }
}))

vi.mock('../src/main/db/drivers/mssql', () => ({
  MssqlDriver: class {
    connect = shared.connect
    disconnect = shared.disconnect
    query = shared.query
    listTables = shared.listTables
    listColumns = shared.listColumns
    primaryKeys = shared.primaryKeys
    execBatch = shared.execBatch
    tableDdl = shared.tableDdl
    activeSessions = shared.activeSessions
    killSession = shared.killSession
    listRoles = shared.listRoles
    serverHealth = shared.serverHealth
    foreignKeys = shared.foreignKeys
    indexes = shared.indexes
    routines = shared.routines
    jobs = shared.jobs
  }
}))

vi.mock('../src/main/db/drivers/oracle', () => ({
  OracleDriver: class {
    connect = shared.connect
    disconnect = shared.disconnect
    query = shared.query
    listTables = shared.listTables
    listColumns = shared.listColumns
    primaryKeys = shared.primaryKeys
    execBatch = shared.execBatch
    tableDdl = shared.tableDdl
    activeSessions = shared.activeSessions
    killSession = shared.killSession
    listRoles = shared.listRoles
    serverHealth = shared.serverHealth
    foreignKeys = shared.foreignKeys
    indexes = shared.indexes
    routines = shared.routines
    jobs = shared.jobs
  }
}))

import { DbManager } from '../src/main/db/manager'
import type { ConnectionConfig, SqlStatement } from '../src/shared/types'

function makePgConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 'conn-1',
    name: 'My PG',
    kind: 'postgres',
    host: 'localhost',
    port: 5432,
    user: 'test',
    password: 'pass',
    database: 'mydb',
    ...overrides
  }
}

describe('DbManager', () => {
  let manager: DbManager

  beforeEach(() => {
    vi.clearAllMocks()
    shared.connect.mockResolvedValue(undefined)
    shared.disconnect.mockResolvedValue(undefined)
    manager = new DbManager()
  })

  describe('connect()', () => {
    it('conecta e retorna o id correto para postgres', async () => {
      const config = makePgConfig()
      const result = await manager.connect(config)
      expect(shared.connect).toHaveBeenCalledOnce()
      expect(result).toEqual({ id: 'conn-1' })
    })

    it('conecta para kind=mysql', async () => {
      const config = makePgConfig({ kind: 'mysql', port: 3306 })
      await manager.connect(config)
      expect(shared.connect).toHaveBeenCalledOnce()
    })

    it('conecta para kind=sqlite', async () => {
      const config: ConnectionConfig = {
        id: 'sqlite-1',
        name: 'Local DB',
        kind: 'sqlite',
        filePath: ':memory:'
      }
      await manager.connect(config)
      expect(shared.connect).toHaveBeenCalledOnce()
    })

    it('desconecta driver anterior antes de reconectar com mesmo id', async () => {
      const config = makePgConfig()
      await manager.connect(config)
      await manager.connect(config)
      expect(shared.disconnect).toHaveBeenCalledOnce()
      expect(shared.connect).toHaveBeenCalledTimes(2)
    })

    it('lança erro para kind não suportado', async () => {
      const config = { ...makePgConfig(), kind: 'unsupported' as ConnectionConfig['kind'] }
      await expect(manager.connect(config)).rejects.toThrow('Tipo de banco não suportado')
    })
  })

  describe('disconnect()', () => {
    it('desconecta e remove o driver do mapa', async () => {
      await manager.connect(makePgConfig())
      await manager.disconnect('conn-1')
      expect(shared.disconnect).toHaveBeenCalledOnce()
      // get() throws synchronously, so wrap in async arrow to capture as rejection
      await expect(async () => manager.query('conn-1', 'SELECT 1')).rejects.toThrow(
        'Conexão não encontrada ou já fechada'
      )
    })

    it('não lança erro ao desconectar id inexistente', async () => {
      await expect(manager.disconnect('nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('getConfig()', () => {
    it('retorna config da conexão ativa', async () => {
      const config = makePgConfig()
      await manager.connect(config)
      expect(manager.getConfig('conn-1')).toEqual(config)
    })

    it('retorna undefined para id inexistente', () => {
      expect(manager.getConfig('ghost')).toBeUndefined()
    })

    it('retorna undefined após desconectar', async () => {
      await manager.connect(makePgConfig())
      await manager.disconnect('conn-1')
      expect(manager.getConfig('conn-1')).toBeUndefined()
    })
  })

  describe('query()', () => {
    it('delega ao driver correto', async () => {
      const fakeResult = {
        columns: ['id'],
        rows: [{ id: 1 }],
        rowCount: 1,
        durationMs: 5,
        command: 'SELECT'
      }
      shared.query.mockResolvedValue(fakeResult)

      await manager.connect(makePgConfig())
      const result = await manager.query('conn-1', 'SELECT id FROM t')

      expect(shared.query).toHaveBeenCalledWith('SELECT id FROM t')
      expect(result).toEqual(fakeResult)
    })

    it('lança erro para conexão não encontrada', async () => {
      await expect(async () => manager.query('nonexistent', 'SELECT 1')).rejects.toThrow(
        'Conexão não encontrada ou já fechada'
      )
    })
  })

  describe('listTables()', () => {
    it('delega ao driver e retorna tabelas', async () => {
      const tables = [{ schema: 'public', name: 'users', type: 'BASE TABLE' }]
      shared.listTables.mockResolvedValue(tables)

      await manager.connect(makePgConfig())
      const result = await manager.listTables('conn-1')

      expect(shared.listTables).toHaveBeenCalledOnce()
      expect(result).toEqual(tables)
    })
  })

  describe('execBatch()', () => {
    it('delega statements ao driver', async () => {
      shared.execBatch.mockResolvedValue(undefined)
      const stmts: SqlStatement[] = [
        { sql: 'INSERT INTO t VALUES ($1)', params: [1] },
        { sql: 'INSERT INTO t VALUES ($1)', params: [2] }
      ]

      await manager.connect(makePgConfig())
      await manager.execBatch('conn-1', stmts)

      expect(shared.execBatch).toHaveBeenCalledWith(stmts)
    })
  })

  describe('listColumns()', () => {
    it('passa schema e table ao driver', async () => {
      const cols = [{ name: 'id', dataType: 'integer', nullable: false }]
      shared.listColumns.mockResolvedValue(cols)

      await manager.connect(makePgConfig())
      const result = await manager.listColumns('conn-1', 'public', 'users')

      expect(shared.listColumns).toHaveBeenCalledWith('public', 'users')
      expect(result).toEqual(cols)
    })
  })

  describe('primaryKeys()', () => {
    it('passa schema e table ao driver', async () => {
      shared.primaryKeys.mockResolvedValue(['id'])

      await manager.connect(makePgConfig())
      const result = await manager.primaryKeys('conn-1', 'public', 'users')

      expect(shared.primaryKeys).toHaveBeenCalledWith('public', 'users')
      expect(result).toEqual(['id'])
    })
  })

  describe('tableDdl()', () => {
    it('delega ao driver com schema e table', async () => {
      shared.tableDdl.mockResolvedValue('CREATE TABLE public.users (...);')

      await manager.connect(makePgConfig())
      const ddl = await manager.tableDdl('conn-1', 'public', 'users')

      expect(shared.tableDdl).toHaveBeenCalledWith('public', 'users')
      expect(ddl).toContain('CREATE TABLE')
    })
  })

  describe('activeSessions()', () => {
    it('delega ao driver', async () => {
      const sessions = [
        { pid: 42, user: 'admin', database: 'mydb', state: 'active', query: null, durationMs: 100 }
      ]
      shared.activeSessions.mockResolvedValue(sessions)

      await manager.connect(makePgConfig())
      const result = await manager.activeSessions('conn-1')

      expect(shared.activeSessions).toHaveBeenCalledOnce()
      expect(result).toEqual(sessions)
    })
  })

  describe('disconnectAll()', () => {
    it('desconecta todos os drivers e limpa o mapa', async () => {
      await manager.connect(makePgConfig({ id: 'conn-1' }))
      await manager.connect(makePgConfig({ id: 'conn-2' }))

      await manager.disconnectAll()

      // disconnect chamado duas vezes (uma por conexão)
      expect(shared.disconnect).toHaveBeenCalledTimes(2)

      // Ambas as conexões devem estar removidas
      await expect(async () => manager.query('conn-1', 'SELECT 1')).rejects.toThrow()
      await expect(async () => manager.query('conn-2', 'SELECT 1')).rejects.toThrow()
    })
  })

  describe('serverHealth()', () => {
    it('delega ao driver', async () => {
      const metrics = [{ label: 'Conexões ativas', value: '5' }]
      shared.serverHealth.mockResolvedValue(metrics)

      await manager.connect(makePgConfig())
      const result = await manager.serverHealth('conn-1')

      expect(shared.serverHealth).toHaveBeenCalledOnce()
      expect(result).toEqual(metrics)
    })
  })

  describe('foreignKeys()', () => {
    it('delega ao driver', async () => {
      const fks = [{ table: 'orders', column: 'user_id', refTable: 'users', refColumn: 'id' }]
      shared.foreignKeys.mockResolvedValue(fks)

      await manager.connect(makePgConfig())
      const result = await manager.foreignKeys('conn-1')

      expect(shared.foreignKeys).toHaveBeenCalledOnce()
      expect(result).toEqual(fks)
    })
  })

  describe('indexes()', () => {
    it('passa schema e table ao driver', async () => {
      const indexes = [{ name: 'idx_email', detail: 'unique' }]
      shared.indexes.mockResolvedValue(indexes)

      await manager.connect(makePgConfig())
      const result = await manager.indexes('conn-1', 'public', 'users')

      expect(shared.indexes).toHaveBeenCalledWith('public', 'users')
      expect(result).toEqual(indexes)
    })
  })

  describe('routines()', () => {
    it('passa schema ao driver', async () => {
      const routines = [{ name: 'fn_calc', type: 'FUNCTION' }]
      shared.routines.mockResolvedValue(routines)

      await manager.connect(makePgConfig())
      const result = await manager.routines('conn-1', 'public')

      expect(shared.routines).toHaveBeenCalledWith('public')
      expect(result).toEqual(routines)
    })
  })

  describe('jobs()', () => {
    it('delega ao driver', async () => {
      const jobs = [
        { name: 'cleanup', schedule: '0 2 * * *', command: 'DELETE FROM logs', enabled: true }
      ]
      shared.jobs.mockResolvedValue(jobs)

      await manager.connect(makePgConfig())
      const result = await manager.jobs('conn-1')

      expect(shared.jobs).toHaveBeenCalledOnce()
      expect(result).toEqual(jobs)
    })
  })
})
