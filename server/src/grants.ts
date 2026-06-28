import { getPool } from './meta'

/** Concessões de acesso a data sources por usuário (issue #60). mode: 'read' | 'readwrite'. */

export interface GrantRow {
  id: string
  user_id: string
  data_source_id: string
  mode: string
  created_at: string
}

export async function listGrants(userId?: string): Promise<GrantRow[]> {
  if (userId) {
    const res = await getPool().query(
      'select * from grants where user_id = $1 order by created_at desc',
      [userId]
    )
    return res.rows as GrantRow[]
  }
  const res = await getPool().query('select * from grants order by created_at desc')
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
     returning *`,
    [userId, dataSourceId, mode === 'readwrite' ? 'readwrite' : 'read']
  )
  return res.rows[0] as GrantRow
}

export async function deleteGrant(id: string): Promise<void> {
  await getPool().query('delete from grants where id = $1', [id])
}

/** Retorna o modo de acesso do usuário ao data source, ou null se não tiver concessão. */
export async function getGrantMode(userId: string, dataSourceId: string): Promise<string | null> {
  const res = await getPool().query(
    'select mode from grants where user_id = $1 and data_source_id = $2',
    [userId, dataSourceId]
  )
  return res.rows[0]?.mode ?? null
}

/** Heurística simples: a query é somente-leitura? (SELECT/WITH/EXPLAIN/SHOW) */
export function isReadOnlySql(sql: string): boolean {
  return /^\s*(select|with|explain|show)\b/i.test(sql.trim())
}
