import { getPool } from './meta'

/** Concessões de acesso a data sources por usuário (issue #60). mode: 'read' | 'readwrite'. */

export interface GrantRow {
  id: string
  user_id: string
  data_source_id: string
  mode: string
  created_at: string
  expires_at: string | null
  suspended: boolean
  expired: boolean
}

export interface GrantUpdate {
  mode?: string
  expiresAt?: string | null
  suspended?: boolean
}

export async function listGrants(userId?: string): Promise<GrantRow[]> {
  const base = `
    select id, user_id, data_source_id, mode, created_at, expires_at, suspended,
           (expires_at IS NOT NULL AND expires_at < now()) AS expired
      from grants`
  const res = userId
    ? await getPool().query(`${base} where user_id = $1 order by created_at desc`, [userId])
    : await getPool().query(`${base} order by created_at desc`)
  return res.rows as GrantRow[]
}

export async function createGrant(
  userId: string,
  dataSourceId: string,
  mode: string
): Promise<GrantRow> {
  const res = await getPool().query(
    `insert into grants (user_id, data_source_id, mode) values ($1,$2,$3)
     on conflict (user_id, data_source_id) do update set mode = excluded.mode
     returning id, user_id, data_source_id, mode, created_at, expires_at, suspended,
               (expires_at IS NOT NULL AND expires_at < now()) AS expired`,
    [userId, dataSourceId, mode === 'readwrite' ? 'readwrite' : 'read']
  )
  return res.rows[0] as GrantRow
}

export async function updateGrant(id: string, update: GrantUpdate): Promise<GrantRow | null> {
  const setClauses: string[] = []
  const values: unknown[] = []
  let i = 1
  if (update.mode !== undefined) {
    setClauses.push(`mode = $${i++}`)
    values.push(update.mode === 'readwrite' ? 'readwrite' : 'read')
  }
  if ('expiresAt' in update) {
    setClauses.push(`expires_at = $${i++}`)
    values.push(update.expiresAt ?? null)
  }
  if (update.suspended !== undefined) {
    setClauses.push(`suspended = $${i++}`)
    values.push(update.suspended)
  }
  if (setClauses.length === 0) return null
  values.push(id)
  const res = await getPool().query(
    `update grants set ${setClauses.join(', ')} where id = $${i}
     returning id, user_id, data_source_id, mode, created_at, expires_at, suspended,
               (expires_at IS NOT NULL AND expires_at < now()) AS expired`,
    values
  )
  return (res.rows[0] as GrantRow) ?? null
}

export async function deleteGrant(id: string): Promise<void> {
  await getPool().query('delete from grants where id = $1', [id])
}

/** Retorna o modo de acesso do usuário ao data source, ou null se não tiver concessão. */
export async function getGrantMode(userId: string, dataSourceId: string): Promise<string | null> {
  const res = await getPool().query(
    `select mode, expires_at, suspended from grants
      where user_id = $1 and data_source_id = $2`,
    [userId, dataSourceId]
  )
  const row = res.rows[0]
  if (!row) return null
  if (row.suspended) return null
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null
  return row.mode as string
}

/**
 * Verifica se a SQL é segura para execução no modo somente leitura.
 * Retorna `false` (bloqueando) se:
 *  - não iniciar com SELECT/WITH/EXPLAIN/SHOW, ou
 *  - contiver múltiplos statements (prevenção de bypass por CTEs com DML).
 *
 * Nota: a camada de execução deve complementar com `SET TRANSACTION READ ONLY`
 * para garantia em nível de banco de dados.
 */
export function isReadOnlySql(sql: string): boolean {
  const trimmed = sql.trim()
  if (!/^(select|with|explain|show)\b/i.test(trimmed)) return false
  // Rejeita multi-statements (ex.: SELECT 1; DROP TABLE users)
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, '')
  if (/;\s*\S/.test(withoutTrailingSemicolon)) return false
  return true
}
