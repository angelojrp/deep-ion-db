import { Pool } from 'pg'

/**
 * Banco de metadados do servidor (épico #53, issue #58): usuários, data sources,
 * grants e auditoria. Migração idempotente no boot.
 */

let pool: Pool | null = null

export function metaConfigured(): boolean {
  return !!process.env.META_DATABASE_URL
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.META_DATABASE_URL
    if (!connectionString) throw new Error('META_DATABASE_URL não configurada.')
    pool = new Pool({ connectionString })
  }
  return pool
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     text UNIQUE NOT NULL,
  email       text,
  name        text,
  role        text NOT NULL DEFAULT 'user',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  kind        text NOT NULL DEFAULT 'postgres',
  host        text,
  port        integer,
  database    text,
  username    text,
  secret_enc  text,
  ssl         boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'nonprod',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  mode           text NOT NULL DEFAULT 'read',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, data_source_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id             bigserial PRIMARY KEY,
  user_id        uuid,
  data_source_id uuid,
  action         text NOT NULL,
  detail         jsonb,
  ts             timestamptz NOT NULL DEFAULT now()
);
`

// Migrações incrementais — idempotentes via IF NOT EXISTS / DO NOTHING
const MIGRATIONS = `
ALTER TABLE grants ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE grants ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

-- audit_log: append-only (protege contra UPDATE/DELETE acidental)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_rules WHERE rulename = 'no_update_audit_log' AND tablename = 'audit_log'
  ) THEN
    CREATE RULE no_update_audit_log AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_rules WHERE rulename = 'no_delete_audit_log' AND tablename = 'audit_log'
  ) THEN
    CREATE RULE no_delete_audit_log AS ON DELETE TO audit_log DO INSTEAD NOTHING;
  END IF;
END $$;
`

export async function migrate(): Promise<void> {
  await getPool().query(SCHEMA)
  await getPool().query(MIGRATIONS)
}

export async function metaStatus(): Promise<{ connected: boolean; tables: string[] }> {
  const res = await getPool().query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`
  )
  return { connected: true, tables: res.rows.map((r) => r.table_name as string) }
}
