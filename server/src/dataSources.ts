import { getPool } from './meta'
import { decrypt, encrypt } from './vault'
import type { ConnectionConfig } from '../../src/shared/types'

/** Cadastro central de data sources com credenciais no cofre (issue #59). */

export interface DataSourceInput {
  name: string
  kind?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  ssl?: boolean
  environment?: string
}

export interface DataSourcePublic {
  id: string
  name: string
  kind: string
  host: string | null
  port: number | null
  database: string | null
  username: string | null
  ssl: boolean
  environment: string
}

export async function listDataSources(): Promise<DataSourcePublic[]> {
  const res = await getPool().query(
    `select id, name, kind, host, port, database, username, ssl, environment
       from data_sources order by name`
  )
  return res.rows as DataSourcePublic[]
}

export async function createDataSource(input: DataSourceInput): Promise<DataSourcePublic> {
  const secret = input.password ? encrypt(input.password) : null
  const res = await getPool().query(
    `insert into data_sources (name, kind, host, port, database, username, secret_enc, ssl, environment)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning id, name, kind, host, port, database, username, ssl, environment`,
    [
      input.name,
      input.kind ?? 'postgres',
      input.host ?? null,
      input.port ?? null,
      input.database ?? null,
      input.username ?? null,
      secret,
      input.ssl ?? false,
      input.environment ?? 'nonprod'
    ]
  )
  return res.rows[0] as DataSourcePublic
}

export interface DataSourceUpdateInput {
  name?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  ssl?: boolean
  environment?: string
}

export async function updateDataSource(
  id: string,
  input: DataSourceUpdateInput
): Promise<DataSourcePublic | null> {
  const setClauses: string[] = []
  const values: unknown[] = []
  let i = 1
  if (input.name !== undefined) {
    setClauses.push(`name = $${i++}`)
    values.push(input.name)
  }
  if (input.host !== undefined) {
    setClauses.push(`host = $${i++}`)
    values.push(input.host)
  }
  if (input.port !== undefined) {
    setClauses.push(`port = $${i++}`)
    values.push(input.port)
  }
  if (input.database !== undefined) {
    setClauses.push(`database = $${i++}`)
    values.push(input.database)
  }
  if (input.username !== undefined) {
    setClauses.push(`username = $${i++}`)
    values.push(input.username)
  }
  if (input.password !== undefined) {
    setClauses.push(`secret_enc = $${i++}`)
    values.push(encrypt(input.password))
  }
  if (input.ssl !== undefined) {
    setClauses.push(`ssl = $${i++}`)
    values.push(input.ssl)
  }
  if (input.environment !== undefined) {
    setClauses.push(`environment = $${i++}`)
    values.push(input.environment)
  }
  if (setClauses.length === 0) return null
  values.push(id)
  const res = await getPool().query(
    `update data_sources set ${setClauses.join(', ')} where id = $${i}
     returning id, name, kind, host, port, database, username, ssl, environment`,
    values
  )
  return (res.rows[0] as DataSourcePublic) ?? null
}

export async function deleteDataSource(id: string): Promise<void> {
  await getPool().query('delete from data_sources where id = $1', [id])
}

/** Reconstrói o ConnectionConfig (senha descriptografada) + ambiente — uso interno (proxied/test). */
export async function loadDataSource(
  id: string
): Promise<{ config: ConnectionConfig; environment: string } | null> {
  const res = await getPool().query(
    `select id, name, kind, host, port, database, username, secret_enc, ssl, environment
       from data_sources where id = $1`,
    [id]
  )
  const r = res.rows[0]
  if (!r) return null
  return {
    environment: r.environment,
    config: {
      id: r.id,
      name: r.name,
      kind: r.kind,
      host: r.host ?? undefined,
      port: r.port ?? undefined,
      user: r.username ?? undefined,
      database: r.database ?? undefined,
      password: r.secret_enc ? decrypt(r.secret_enc) : undefined,
      ssl: r.ssl
    }
  }
}

export async function getDataSourceConfig(id: string): Promise<ConnectionConfig | null> {
  return (await loadDataSource(id))?.config ?? null
}
