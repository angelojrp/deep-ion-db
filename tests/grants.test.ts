import { describe, expect, it } from 'vitest'
import { isReadOnlySql } from '../server/src/grants'

describe('isReadOnlySql', () => {
  it('aceita SELECT/WITH/EXPLAIN/SHOW', () => {
    expect(isReadOnlySql('select * from t')).toBe(true)
    expect(isReadOnlySql('  WITH x as (select 1) select * from x')).toBe(true)
    expect(isReadOnlySql('EXPLAIN select 1')).toBe(true)
    expect(isReadOnlySql('show tables')).toBe(true)
  })

  it('rejeita DML/DDL', () => {
    expect(isReadOnlySql('delete from t')).toBe(false)
    expect(isReadOnlySql('update t set a=1')).toBe(false)
    expect(isReadOnlySql('drop table t')).toBe(false)
    expect(isReadOnlySql('insert into t values (1)')).toBe(false)
  })
})
