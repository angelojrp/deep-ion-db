import { join } from 'path'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { PostgresDriver } from '../../src/main/db/drivers/postgres'
import type { ConnectionConfig } from '../../src/shared/types'
import { metaConfigured, metaStatus, migrate } from './meta'
import {
  createDataSource,
  deleteDataSource,
  getDataSourceConfig,
  listDataSources,
  loadDataSource,
  type DataSourceInput
} from './dataSources'
import { vaultUsingDefaultKey } from './vault'
import { type AuthUser, authDisabled, devUser, upsertUser, verifyToken } from './auth'
import { createGrant, deleteGrant, getGrantMode, isReadOnlySql, listGrants } from './grants'
import { audit, listAudit } from './audit'
import {
  MAX_SESSIONS_PER_USER,
  STATEMENT_TIMEOUT_MS,
  SessionLimiter,
  capRows,
  effectiveMode
} from './policy'

const sessions = new SessionLimiter()

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
  }
}

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

  // Autenticação OIDC (#56) — protege as rotas /api (exceto status público).
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api')) return
    if (req.url.startsWith('/api/meta/status')) return
    if (req.url.startsWith('/api/auth/config')) return
    if (authDisabled()) {
      req.user = devUser()
      return
    }
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      reply.code(401)
      return reply.send({ error: 'não autenticado' })
    }
    try {
      req.user = await upsertUser(await verifyToken(header.slice(7)))
    } catch {
      reply.code(401)
      return reply.send({ error: 'token inválido' })
    }
  })

  // Config pública de auth (#106): a UI usa para iniciar o login OIDC (Auth Code + PKCE).
  // `audience` é usado como client_id no IdP. Não expõe segredos.
  app.get('/api/auth/config', async () => ({
    authDisabled: authDisabled(),
    issuer: process.env.OIDC_ISSUER ?? null,
    audience: process.env.OIDC_AUDIENCE ?? null
  }))

  app.get('/api/me', async (req) => req.user ?? null)

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
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    if (!req.body?.name) {
      reply.code(400)
      return { error: 'name é obrigatório.' }
    }
    const ds = await createDataSource(req.body)
    await audit(req.user.id, ds.id, 'data_source.create', { name: ds.name })
    return ds
  })

  app.delete<{ Params: { id: string } }>('/api/data-sources/:id', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    await deleteDataSource(req.params.id)
    await audit(req.user.id, req.params.id, 'data_source.delete')
    return { ok: true }
  })

  // ----- Grants (#60) -----
  app.get('/api/grants', async (req) => {
    const all = req.user?.role === 'admin'
    return { grants: await listGrants(all ? undefined : req.user?.id) }
  })

  app.post<{ Body: { userId: string; dataSourceId: string; mode?: string } }>(
    '/api/grants',
    async (req, reply) => {
      if (req.user?.role !== 'admin') {
        reply.code(403)
        return { error: 'requer papel admin' }
      }
      const g = await createGrant(req.body.userId, req.body.dataSourceId, req.body.mode ?? 'read')
      await audit(req.user.id, req.body.dataSourceId, 'grant.create', {
        userId: req.body.userId,
        mode: g.mode
      })
      return g
    }
  )

  app.delete<{ Params: { id: string } }>('/api/grants/:id', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    await deleteGrant(req.params.id)
    return { ok: true }
  })

  // ----- Conexão proxied (#61): usa o banco sem expor host/usuário/senha -----
  app.post<{ Params: { id: string }; Body: { sql: string } }>(
    '/api/data-sources/:id/query',
    async (req, reply) => {
      const user = req.user!
      const grant = user.role === 'admin' ? 'readwrite' : await getGrantMode(user.id, req.params.id)
      if (!grant) {
        await audit(user.id, req.params.id, 'query.denied', { reason: 'sem concessão' })
        reply.code(403)
        return { error: 'sem acesso a este data source' }
      }
      const ds = await loadDataSource(req.params.id)
      if (!ds) {
        reply.code(404)
        return { error: 'data source não encontrado' }
      }
      // Política (#64): produção força somente-leitura.
      const mode = effectiveMode(grant, ds.environment)
      if (mode === 'read' && !isReadOnlySql(req.body.sql)) {
        await audit(user.id, req.params.id, 'query.denied', {
          reason: ds.environment === 'prod' ? 'prod-somente-leitura' : 'somente-leitura'
        })
        reply.code(403)
        return { error: 'somente-leitura: apenas SELECT/WITH/EXPLAIN' }
      }
      // Limite de sessões por usuário (#65).
      if (!sessions.tryAcquire(user.id)) {
        reply.code(429)
        return { error: `limite de ${MAX_SESSIONS_PER_USER} execuções simultâneas atingido` }
      }
      const driver = new PostgresDriver(ds.config)
      try {
        await driver.connect()
        await driver.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
        const result = capRows(await driver.query(req.body.sql))
        await audit(user.id, req.params.id, 'query', {
          rowCount: result.rowCount,
          readonly: mode === 'read',
          truncated: result.truncated ?? false
        })
        return result
      } catch (e) {
        await audit(user.id, req.params.id, 'query.error', {
          error: e instanceof Error ? e.message : String(e)
        })
        reply.code(400)
        return { error: e instanceof Error ? e.message : String(e) }
      } finally {
        sessions.release(user.id)
        await driver.disconnect().catch(() => {})
      }
    }
  )

  app.post<{ Params: { id: string } }>('/api/data-sources/:id/tables', async (req, reply) => {
    const user = req.user!
    const mode = user.role === 'admin' ? 'readwrite' : await getGrantMode(user.id, req.params.id)
    if (!mode) {
      reply.code(403)
      return { error: 'sem acesso a este data source' }
    }
    const config = await getDataSourceConfig(req.params.id)
    if (!config) {
      reply.code(404)
      return { error: 'data source não encontrado' }
    }
    const driver = new PostgresDriver(config)
    try {
      await driver.connect()
      const tables = await driver.listTables()
      await audit(user.id, req.params.id, 'tables')
      return { tables }
    } finally {
      await driver.disconnect().catch(() => {})
    }
  })

  // Colunas de uma tabela (explorer da UI unificada).
  app.post<{ Params: { id: string }; Body: { schema: string; table: string } }>(
    '/api/data-sources/:id/columns',
    async (req, reply) => {
      const user = req.user!
      const mode = user.role === 'admin' ? 'readwrite' : await getGrantMode(user.id, req.params.id)
      if (!mode) {
        reply.code(403)
        return { error: 'sem acesso a este data source' }
      }
      const config = await getDataSourceConfig(req.params.id)
      if (!config) {
        reply.code(404)
        return { error: 'data source não encontrado' }
      }
      const driver = new PostgresDriver(config)
      try {
        await driver.connect()
        return { columns: await driver.listColumns(req.body.schema, req.body.table) }
      } finally {
        await driver.disconnect().catch(() => {})
      }
    }
  )

  // ----- Auditoria (#63) -----
  app.get('/api/audit', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    return { entries: await listAudit() }
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

  // Frontend web (#55) servido estaticamente (após as rotas /api).
  await app.register(fastifyStatic, {
    root: join(__dirname, '../../web/public'),
    prefix: '/'
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
