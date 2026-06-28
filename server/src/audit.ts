import { getPool } from './meta'

/** Auditoria de acessos e execuções (issue #63). Nunca registra dados sensíveis (sem senhas). */

export interface AuditDetail {
  [key: string]: unknown
}

export async function audit(
  userId: string | null,
  dataSourceId: string | null,
  action: string,
  detail?: AuditDetail
): Promise<void> {
  try {
    await getPool().query(
      'insert into audit_log (user_id, data_source_id, action, detail) values ($1,$2,$3,$4)',
      [isUuid(userId) ? userId : null, dataSourceId, action, detail ? JSON.stringify(detail) : null]
    )
  } catch {
    /* auditoria não deve quebrar a operação principal */
  }
}

export async function listAudit(limit = 200): Promise<unknown[]> {
  const res = await getPool().query(
    `select a.id, a.user_id, u.email, a.data_source_id, a.action, a.detail, a.ts
       from audit_log a left join users u on u.id = a.user_id
      order by a.ts desc limit $1`,
    [limit]
  )
  return res.rows
}

function isUuid(v: string | null): v is string {
  return (
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) && v !== ZERO
  )
}

const ZERO = '00000000-0000-0000-0000-000000000000'
