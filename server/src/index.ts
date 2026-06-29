import { join } from 'path'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import fastifyStatic from '@fastify/static'
import { PostgresDriver } from '../../src/main/db/drivers/postgres'
import { MysqlDriver } from '../../src/main/db/drivers/mysql'
import { SqliteDriver } from '../../src/main/db/drivers/sqlite'
import { MssqlDriver } from '../../src/main/db/drivers/mssql'
import { OracleDriver } from '../../src/main/db/drivers/oracle'
import type { ConnectionConfig, QueryResult } from '../../src/shared/types'
import type { Driver } from '../../src/main/db/types'
import { metaConfigured, metaStatus, migrate } from './meta'
import {
  createDataSource,
  deleteDataSource,
  getDataSourceConfig,
  listDataSources,
  loadDataSource,
  updateDataSource,
  type DataSourceInput,
  type DataSourceUpdateInput
} from './dataSources'
import { vaultUsingDefaultKey } from './vault'
import {
  type AuthUser,
  assertOidcConfigured,
  authDisabled,
  devUser,
  upsertUser,
  verifyToken
} from './auth'
import {
  createGrant,
  deleteGrant,
  getGrantMode,
  isReadOnlySql,
  listGrants,
  updateGrant,
  type GrantUpdate
} from './grants'
import { audit, auditToCsv, listAudit, type AuditFilters } from './audit'
import { listUsers, updateUserRole, deleteUser, listUserGrants } from './users'
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

/** Backend web (épico #53) — reaproveita a camada de drivers do app desktop. */

type PgConnInput = Pick<
  ConnectionConfig,
  'host' | 'port' | 'user' | 'password' | 'database' | 'ssl'
>

function makeDriver(input: PgConnInput): PostgresDriver {
  return new PostgresDriver({ id: 'web', name: 'web', kind: 'postgres', ...input })
}

function makeDriverFromConfig(config: ConnectionConfig): Driver {
  switch (config.kind) {
    case 'mysql':
      return new MysqlDriver(config)
    case 'sqlite':
      return new SqliteDriver(config)
    case 'mssql':
      return new MssqlDriver(config)
    case 'oracle':
      return new OracleDriver(config)
    default:
      return new PostgresDriver(config)
  }
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
  // Fail-closed: aborta se OIDC não estiver configurado corretamente em produção
  assertOidcConfigured()

  const app = Fastify({ logger: true })

  // CORS restrito: lê CORS_ORIGINS do env (vírgula-separado) ou usa localhost em dev
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()) ?? [
    'http://localhost:4000'
  ]
  await app.register(cors, { origin: corsOrigins })

  // Rate limiting global: 200 req/min por IP
  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute'
  })

  // Extrai a origem do OIDC_ISSUER para incluir no connect-src do CSP,
  // permitindo que a UI faça discovery e troca de tokens com o IdP (ex: Keycloak).
  const oidcOrigins: string[] = []
  if (process.env.OIDC_ISSUER && !authDisabled()) {
    try {
      oidcOrigins.push(new URL(process.env.OIDC_ISSUER).origin)
    } catch {
      // URL inválida — ignora; o CSP fica conservador
    }
  }

  // Helmet: headers de segurança com CSP permitindo Monaco CDN, workers e IdP OIDC
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        scriptSrcElem: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'data:'],
        workerSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", ...oidcOrigins],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    }
  })

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
  app.get('/api/auth/config', async () => ({
    authDisabled: authDisabled(),
    issuer: process.env.OIDC_ISSUER ?? null,
    audience: process.env.OIDC_AUDIENCE ?? null
  }))

  // Rota de auth com rate-limit restrito (20 req/min): previne força-bruta em endpoints de token.
  app.post(
    '/api/auth/token',
    {
      config: {
        rateLimit: { max: 20, timeWindow: '1 minute' }
      }
    },
    async (_req, reply) => {
      // Troca de tokens gerenciada pelo provedor OIDC externo (Keycloak).
      // Este endpoint reservado garante rate-limiting restrito caso seja implementado.
      reply.code(501)
      return { error: 'não implementado: use o fluxo Auth Code + PKCE com o provedor OIDC.' }
    }
  )

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

  // ----- Endpoints ad-hoc (issue #120): exigem role admin) -----
  app.post<{ Body: { config: PgConnInput } }>('/api/test-connection', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    try {
      await withDriver(req.body.config, async (d) => d.query('select 1'))
      return { ok: true }
    } catch (e) {
      reply.code(400)
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  app.post<{ Body: { config: PgConnInput; sql: string } }>('/api/query', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    try {
      return await withDriver(req.body.config, (d) => d.query(req.body.sql))
    } catch (e) {
      reply.code(400)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  app.post<{ Body: { config: PgConnInput } }>('/api/tables', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    try {
      return await withDriver(req.body.config, (d) => d.listTables())
    } catch (e) {
      reply.code(400)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  // ----- Data sources gerenciados (#59) — credenciais no cofre (#62) -----
  app.get('/api/data-sources', async (req) => {
    const user = req.user!
    const all = await listDataSources()
    if (user.role === 'admin') return { dataSources: all }
    // Usuários não-admin veem apenas data sources com grants ativos para eles
    const grants = await listGrants(user.id)
    const grantedIds = new Set(
      grants.filter((g) => !g.suspended && !g.expired).map((g) => g.data_source_id)
    )
    return { dataSources: all.filter((ds) => grantedIds.has(ds.id)) }
  })

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

  // PATCH /api/data-sources/:id — editar data source sem deletar (issue #116)
  app.patch<{ Params: { id: string }; Body: DataSourceUpdateInput }>(
    '/api/data-sources/:id',
    async (req, reply) => {
      if (req.user?.role !== 'admin') {
        reply.code(403)
        return { error: 'requer papel admin' }
      }
      const updated = await updateDataSource(req.params.id, req.body)
      if (!updated) {
        reply.code(404)
        return { error: 'data source não encontrado' }
      }
      // Registra diff sem expor senha
      const diffBody: Record<string, unknown> = { ...req.body }
      delete diffBody['password']
      await audit(req.user.id, req.params.id, 'data_source.update', diffBody)
      return updated
    }
  )

  app.delete<{ Params: { id: string } }>('/api/data-sources/:id', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    await deleteDataSource(req.params.id)
    await audit(req.user.id, req.params.id, 'data_source.delete')
    return { ok: true }
  })

  // ----- Usuários (#118) -----
  app.get('/api/users', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    return { users: await listUsers() }
  })

  app.patch<{ Params: { id: string }; Body: { role: string } }>(
    '/api/users/:id',
    async (req, reply) => {
      if (req.user?.role !== 'admin') {
        reply.code(403)
        return { error: 'requer papel admin' }
      }
      if (req.params.id === req.user.id) {
        reply.code(400)
        return { error: 'não é possível alterar o próprio papel' }
      }
      const updated = await updateUserRole(req.params.id, req.body.role)
      if (!updated) {
        reply.code(404)
        return { error: 'usuário não encontrado' }
      }
      await audit(req.user.id, null, 'user.role_changed', {
        userId: req.params.id,
        role: req.body.role
      })
      return updated
    }
  )

  app.delete<{ Params: { id: string } }>('/api/users/:id', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    if (req.params.id === req.user.id) {
      reply.code(400)
      return { error: 'não é possível remover o próprio usuário' }
    }
    const { grantIds } = await deleteUser(req.params.id)
    await audit(req.user.id, null, 'user.deleted', {
      userId: req.params.id,
      revokedGrants: grantIds
    })
    return { ok: true }
  })

  app.get<{ Params: { id: string } }>('/api/users/:id/grants', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    return { grants: await listUserGrants(req.params.id) }
  })

  // ----- Grants (#60, #121) -----
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

  // PATCH /api/grants/:id — atualizar modo, expiração, suspensão (issue #121)
  app.patch<{ Params: { id: string }; Body: GrantUpdate }>(
    '/api/grants/:id',
    async (req, reply) => {
      if (req.user?.role !== 'admin') {
        reply.code(403)
        return { error: 'requer papel admin' }
      }
      const updated = await updateGrant(req.params.id, req.body)
      if (!updated) {
        reply.code(404)
        return { error: 'grant não encontrado' }
      }
      await audit(req.user.id, updated.data_source_id, 'grant.updated', {
        grantId: req.params.id,
        ...req.body
      })
      return updated
    }
  )

  app.delete<{ Params: { id: string } }>('/api/grants/:id', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    await deleteGrant(req.params.id)
    await audit(req.user.id, null, 'grant.deleted', { grantId: req.params.id })
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
      const mode = effectiveMode(grant, ds.environment)
      if (mode === 'read' && !isReadOnlySql(req.body.sql)) {
        await audit(user.id, req.params.id, 'query.denied', {
          reason: ds.environment === 'prod' ? 'prod-somente-leitura' : 'somente-leitura'
        })
        reply.code(403)
        return { error: 'somente-leitura: apenas SELECT/WITH/EXPLAIN' }
      }
      if (!sessions.tryAcquire(user.id)) {
        reply.code(429)
        return { error: `limite de ${MAX_SESSIONS_PER_USER} execuções simultâneas atingido` }
      }
      const driver = makeDriverFromConfig(ds.config)
      try {
        await driver.connect()
        // statement_timeout é específico do PostgreSQL
        if (ds.config.kind === 'postgres') {
          await driver.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
        }
        let result: QueryResult & { truncated?: boolean }
        if (mode === 'read' && ds.config.kind === 'postgres') {
          // Garante somente leitura em nível de transação (PostgreSQL)
          await driver.query('BEGIN')
          try {
            await driver.query('SET TRANSACTION READ ONLY')
            result = capRows(await driver.query(req.body.sql))
            await driver.query('COMMIT')
          } catch (e) {
            await driver.query('ROLLBACK').catch(() => {})
            throw e
          }
        } else {
          result = capRows(await driver.query(req.body.sql))
        }
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
    const driver = makeDriverFromConfig(config)
    try {
      await driver.connect()
      const tables = await driver.listTables()
      await audit(user.id, req.params.id, 'tables')
      return { tables }
    } finally {
      await driver.disconnect().catch(() => {})
    }
  })

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
      const driver = makeDriverFromConfig(config)
      try {
        await driver.connect()
        return { columns: await driver.listColumns(req.body.schema, req.body.table) }
      } finally {
        await driver.disconnect().catch(() => {})
      }
    }
  )

  // ----- Auditoria (#63, #119) — com filtros, paginação e export CSV -----
  app.get<{ Querystring: AuditFilters & { export?: string } }>('/api/audit', async (req, reply) => {
    if (req.user?.role !== 'admin') {
      reply.code(403)
      return { error: 'requer papel admin' }
    }
    const { export: exp, ...filters } = req.query
    if (exp === 'csv') {
      // Export sem paginação: busca todas as entradas com os filtros aplicados
      const { entries } = await listAudit({ ...filters, pageSize: 500, page: 1 })
      // Iterar até buscar tudo (max 10k para segurança)
      let all = entries
      let pg = 2
      while (all.length < 10_000 && entries.length === 500) {
        const next = await listAudit({ ...filters, pageSize: 500, page: pg++ })
        all = [...all, ...next.entries]
        if (next.entries.length < 500) break
      }
      await reply.header('Content-Type', 'text/csv; charset=utf-8')
      await reply.header('Content-Disposition', 'attachment; filename="audit.csv"')
      return reply.send(auditToCsv(all))
    }
    return listAudit({
      ...filters,
      page: filters.page ? Number(filters.page) : 1,
      pageSize: filters.pageSize ? Number(filters.pageSize) : 50
    })
  })

  app.post<{ Params: { id: string } }>('/api/data-sources/:id/test', async (req, reply) => {
    const user = req.user!
    // Requer papel admin ou grant ativo sobre o data source
    if (user.role !== 'admin') {
      const grant = await getGrantMode(user.id, req.params.id)
      if (!grant) {
        reply.code(403)
        return { ok: false, error: 'requer papel admin ou concessão sobre este data source' }
      }
    }
    const config = await getDataSourceConfig(req.params.id)
    if (!config) {
      reply.code(404)
      return { ok: false, error: 'data source não encontrado.' }
    }
    const driver = makeDriverFromConfig(config)
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
