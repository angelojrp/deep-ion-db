import { describe, expect, it } from 'vitest'
import { schemaContext, stripCodeFences } from '../src/ai'

describe('schemaContext', () => {
  it('qualifica por schema (exceto main) e limita a lista', () => {
    const ctx = schemaContext([
      { schema: 'public', name: 'users' },
      { schema: 'main', name: 'notes' }
    ])
    expect(ctx).toContain('public.users')
    expect(ctx).toContain('notes')
    expect(ctx).not.toContain('main.notes')
  })

  it('indica indisponível quando vazio', () => {
    expect(schemaContext([])).toBe('(schema indisponível)')
  })
})

describe('stripCodeFences', () => {
  it('remove cercas ```sql', () => {
    expect(stripCodeFences('```sql\nSELECT 1;\n```')).toBe('SELECT 1;')
  })
  it('mantém texto sem cercas', () => {
    expect(stripCodeFences('SELECT 2;')).toBe('SELECT 2;')
  })
})
