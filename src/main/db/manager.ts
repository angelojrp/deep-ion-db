import type {
  ColumnInfo,
  ConnectionConfig,
  Driver,
  ForeignKey,
  HealthMetric,
  IndexInfo,
  JobInfo,
  QueryResult,
  RoleInfo,
  RoutineInfo,
  SchemaTable,
  SessionInfo,
  SqlStatement
} from './types'
import { PostgresDriver } from './drivers/postgres'
import { MysqlDriver } from './drivers/mysql'
import { SqliteDriver } from './drivers/sqlite'
import { MssqlDriver } from './drivers/mssql'
import { OracleDriver } from './drivers/oracle'

/** Mantém as conexões abertas e roteia as operações para o driver certo. */
export class DbManager {
  private drivers = new Map<string, Driver>()
  private configs = new Map<string, ConnectionConfig>()

  getConfig(id: string): ConnectionConfig | undefined {
    return this.configs.get(id)
  }

  private create(config: ConnectionConfig): Driver {
    switch (config.kind) {
      case 'postgres':
        return new PostgresDriver(config)
      case 'mysql':
        return new MysqlDriver(config)
      case 'sqlite':
        return new SqliteDriver(config)
      case 'mssql':
        return new MssqlDriver(config)
      case 'oracle':
        return new OracleDriver(config)
      default:
        throw new Error(`Tipo de banco não suportado: ${(config as ConnectionConfig).kind}`)
    }
  }

  async connect(config: ConnectionConfig): Promise<{ id: string }> {
    if (this.drivers.has(config.id)) {
      await this.disconnect(config.id)
    }
    const driver = this.create(config)
    await driver.connect()
    this.drivers.set(config.id, driver)
    this.configs.set(config.id, config)
    return { id: config.id }
  }

  async disconnect(id: string): Promise<void> {
    const driver = this.drivers.get(id)
    if (driver) {
      await driver.disconnect()
      this.drivers.delete(id)
      this.configs.delete(id)
    }
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled([...this.drivers.values()].map((d) => d.disconnect()))
    this.drivers.clear()
  }

  /** Retorna o driver ativo para uma conexão, ou undefined se não existir. */
  getDriver(id: string): Driver | undefined {
    return this.drivers.get(id)
  }

  private get(id: string): Driver {
    const driver = this.drivers.get(id)
    if (!driver) throw new Error('Conexão não encontrada ou já fechada.')
    return driver
  }

  query(id: string, sql: string): Promise<QueryResult> {
    return this.get(id).query(sql)
  }

  listTables(id: string): Promise<SchemaTable[]> {
    return this.get(id).listTables()
  }

  listColumns(id: string, schema: string, table: string): Promise<ColumnInfo[]> {
    return this.get(id).listColumns(schema, table)
  }

  primaryKeys(id: string, schema: string, table: string): Promise<string[]> {
    return this.get(id).primaryKeys(schema, table)
  }

  execBatch(id: string, statements: SqlStatement[]): Promise<void> {
    return this.get(id).execBatch(statements)
  }

  tableDdl(id: string, schema: string, table: string): Promise<string> {
    return this.get(id).tableDdl(schema, table)
  }

  activeSessions(id: string): Promise<SessionInfo[]> {
    return this.get(id).activeSessions()
  }

  killSession(id: string, pid: string | number): Promise<void> {
    return this.get(id).killSession(pid)
  }

  listRoles(id: string): Promise<RoleInfo[]> {
    return this.get(id).listRoles()
  }

  serverHealth(id: string): Promise<HealthMetric[]> {
    return this.get(id).serverHealth()
  }

  foreignKeys(id: string): Promise<ForeignKey[]> {
    return this.get(id).foreignKeys()
  }

  indexes(id: string, schema: string, table: string): Promise<IndexInfo[]> {
    return this.get(id).indexes(schema, table)
  }

  routines(id: string, schema: string): Promise<RoutineInfo[]> {
    return this.get(id).routines(schema)
  }

  jobs(id: string): Promise<JobInfo[]> {
    return this.get(id).jobs()
  }
}
