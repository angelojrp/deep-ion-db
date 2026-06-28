import { getPool } from './meta'
import type { GrantRow } from './grants'

/** Gerenciamento de usuários (issue #118). */

export interface UserRow {
  id: string
  email: string | null
  name: string | null
  role: string
  created_at: string
}

export async function listUsers(): Promise<UserRow[]> {
  const res = await getPool().query(
    `select id, email, name, role, created_at from users order by created_at`
  )
  return res.rows as UserRow[]
}

export async function getUser(id: string): Promise<UserRow | null> {
  const res = await getPool().query(
    `select id, email, name, role, created_at from users where id = $1`,
    [id]
  )
  return (res.rows[0] as UserRow) ?? null
}

export async function updateUserRole(id: string, role: string): Promise<UserRow | null> {
  const res = await getPool().query(
    `update users set role = $1 where id = $2
     returning id, email, name, role, created_at`,
    [role === 'admin' ? 'admin' : 'user', id]
  )
  return (res.rows[0] as UserRow) ?? null
}

export async function deleteUser(id: string): Promise<{ grantIds: string[] }> {
  const grants = await getPool().query(`select id from grants where user_id = $1`, [id])
  const grantIds = grants.rows.map((r) => r.id as string)
  await getPool().query('delete from users where id = $1', [id])
  return { grantIds }
}

export async function listUserGrants(userId: string): Promise<GrantRow[]> {
  const res = await getPool().query(
    `select id, user_id, data_source_id, mode, created_at, expires_at, suspended,
            (expires_at IS NOT NULL AND expires_at < now()) AS expired
       from grants where user_id = $1 order by created_at desc`,
    [userId]
  )
  return res.rows as GrantRow[]
}
