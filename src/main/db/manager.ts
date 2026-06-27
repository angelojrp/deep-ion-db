import type { ColumnInfo, ConnectionConfig, Driver, QueryResult, SchemaTable } from './types'
import { PostgresDriver } from './drivers/postgres'
import { MysqlDriver } from './drivers/mysql'
import { SqliteDriver } from './drivers/sqlite'

/** Mantém as conexões abertas e roteia as operações para o driver certo. */
export class DbManager {
  private drivers = new Map<string, Driver>()

  private create(config: ConnectionConfig): Driver {
    switch (config.kind) {
      case 'postgres':
        return new PostgresDriver(config)
      case 'mysql':
        return new MysqlDriver(config)
      case 'sqlite':
        return new SqliteDriver(config)
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
    return { id: config.id }
  }

  async disconnect(id: string): Promise<void> {
    const driver = this.drivers.get(id)
    if (driver) {
      await driver.disconnect()
      this.drivers.delete(id)
    }
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled([...this.drivers.values()].map((d) => d.disconnect()))
    this.drivers.clear()
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
}
