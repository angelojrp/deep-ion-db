import { getPool } from './meta'

/** Auditoria de acessos e execuções (issue #63). Nunca registra dados sensíveis (sem senhas). */

export interface AuditDetail {
  [key: string]: unknown
}

export interface AuditFilters {
  userId?: string
  dataSourceId?: string
  action?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface AuditEntry {
  id: number
  user_id: string | null
  email: string | null
  data_source_id: string | null
  action: string
  detail: unknown
  ts: string
}

export interface AuditPage {
  entries: AuditEntry[]
  total: number
  page: number
  pageSize: number
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

export async function listAudit(filters: AuditFilters = {}): Promise<AuditPage> {
  const { page = 1, pageSize = 50 } = filters
  const clampedPage = Math.max(1, page)
  const clampedSize = Math.min(500, Math.max(1, pageSize))
  const offset = (clampedPage - 1) * clampedSize

  const conditions: string[] = []
  const values: unknown[] = []
  let i = 1

  if (filters.userId) {
    conditions.push(`a.user_id = $${i++}`)
    values.push(filters.userId)
  }
  if (filters.dataSourceId) {
    conditions.push(`a.data_source_id = $${i++}`)
    values.push(filters.dataSourceId)
  }
  if (filters.action) {
    conditions.push(`a.action = $${i++}`)
    values.push(filters.action)
  }
  if (filters.from) {
    conditions.push(`a.ts >= $${i++}`)
    values.push(filters.from)
  }
  if (filters.to) {
    conditions.push(`a.ts <= $${i++}`)
    values.push(filters.to)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRes = await getPool().query(
    `select count(*)::int as n from audit_log a ${where}`,
    values
  )
  const total = countRes.rows[0].n as number

  const dataRes = await getPool().query(
    `select a.id, a.user_id, u.email, a.data_source_id, a.action, a.detail, a.ts
       from audit_log a left join users u on u.id = a.user_id
      ${where}
      order by a.ts desc
      limit $${i} offset $${i + 1}`,
    [...values, clampedSize, offset]
  )

  return {
    entries: dataRes.rows as AuditEntry[],
    total,
    page: clampedPage,
    pageSize: clampedSize
  }
}

export function auditToCsv(entries: AuditEntry[]): string {
  const header = 'id,ts,user_id,email,data_source_id,action,detail'
  const rows = entries.map((e) =>
    [
      e.id,
      e.ts,
      e.user_id ?? '',
      e.email ?? '',
      e.data_source_id ?? '',
      e.action,
      e.detail ? JSON.stringify(e.detail).replace(/"/g, '""') : ''
    ]
      .map((v) => `"${v}"`)
      .join(',')
  )
  return [header, ...rows].join('\n')
}

function isUuid(v: string | null): v is string {
  return (
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) && v !== ZERO
  )
}

const ZERO = '00000000-0000-0000-0000-000000000000'
