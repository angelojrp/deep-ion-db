import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PostgresDriver } from '../../src/main/db/drivers/postgres'
import type { ConnectionConfig } from '../../src/shared/types'
import { metaConfigured, metaStatus, migrate } from './meta'
import {
  createDataSource,
  deleteDataSource,
  getDataSourceConfig,
  listDataSources,
  type DataSourceInput
} from './dataSources'
import { vaultUsingDefaultKey } from './vault'

/**
 * Backend web (MVP do épico #53) — reaproveita a camada de drivers do app desktop.
 * Corte fino: PostgreSQL. Auth/data sources/grants entram nas issues seguintes (#56/#59/#60).
 * AVISO: endpoints ainda sem autenticação — uso interno/dev até o OIDC (#56).
 */

type PgConnInput = Pick<
  ConnectionConfig,
  'host' | 'port' | 'user' | 'password' | 'database' | 'ssl'
>

function makeDriver(input: PgConnInput): PostgresDriver {
  return new PostgresDriver({ id: 'web', name: 'web', kind: 'postgres', ...input })
}

async function withDriver<T>(
  input: PgConnInput,
  fn: (d: PostgresDriver) => Promise<T>
): Promise<T> {
  const driver = makeDriver(input)
  await driver.connect()
  try {
    return await fn(driver)
  } finally {
    await driver.disconnect().catch(() => {})
  }
}

async function main(): Promise<void> {
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: true })

  app.get('/health', async () => ({
    ok: true,
    service: 'deep-ion-db-server',
    version: '0.0.1'
  }))

  app.get('/api/meta/status', async (_req, reply) => {
    if (!metaConfigured()) return { configured: false }
    try {
      return { configured: true, ...(await metaStatus()) }
    } catch (e) {
      reply.code(503)
      return {
        configured: true,
        connected: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  })

  app.post<{ Body: { config: PgConnInput } }>('/api/test-connection', async (req, reply) => {
    try {
      await withDriver(req.body.config, async (d) => d.query('select 1'))
      return { ok: true }
    } catch (e) {
      reply.code(400)
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  app.post<{ Body: { config: PgConnInput; sql: string } }>('/api/query', async (req, reply) => {
    try {
      return await withDriver(req.body.config, (d) => d.query(req.body.sql))
    } catch (e) {
      reply.code(400)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  app.post<{ Body: { config: PgConnInput } }>('/api/tables', async (req, reply) => {
    try {
      return await withDriver(req.body.config, (d) => d.listTables())
    } catch (e) {
      reply.code(400)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  // ----- Data sources gerenciados (#59) — credenciais no cofre (#62) -----
  app.get('/api/data-sources', async () => ({ dataSources: await listDataSources() }))

  app.post<{ Body: DataSourceInput }>('/api/data-sources', async (req, reply) => {
    if (!req.body?.name) {
      reply.code(400)
      return { error: 'name é obrigatório.' }
    }
    return await createDataSource(req.body)
  })

  app.delete<{ Params: { id: string } }>('/api/data-sources/:id', async (req) => {
    await deleteDataSource(req.params.id)
    return { ok: true }
  })

  app.post<{ Params: { id: string } }>('/api/data-sources/:id/test', async (req, reply) => {
    const config = await getDataSourceConfig(req.params.id)
    if (!config) {
      reply.code(404)
      return { ok: false, error: 'data source não encontrado.' }
    }
    const driver = new PostgresDriver(config)
    try {
      await driver.connect()
      await driver.query('select 1')
      return { ok: true }
    } catch (e) {
      reply.code(400)
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    } finally {
      await driver.disconnect().catch(() => {})
    }
  })

  if (metaConfigured()) {
    try {
      await migrate()
      app.log.info('Metadados: schema migrado.')
    } catch (e) {
      app.log.error({ err: e }, 'Falha ao migrar metadados (seguindo mesmo assim).')
    }
  }
  if (vaultUsingDefaultKey()) {
    app.log.warn('META_ENCRYPTION_KEY não definida — usando chave de DEV. Defina em produção!')
  }

  const port = Number(process.env.PORT ?? 4000)
  await app.listen({ port, host: '0.0.0.0' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
