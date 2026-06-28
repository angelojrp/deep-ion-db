import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runBackup } from '../src/main/backup'

describe('runBackup (sqlite)', () => {
  it('copia o arquivo do banco', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'deepion-bkp-'))
    const src = join(dir, 'src.db')
    writeFileSync(src, 'DATA-DB')
    const dest = join(dir, 'out.db')
    await runBackup({ id: 'x', name: 'x', kind: 'sqlite', filePath: src }, dest)
    expect(existsSync(dest)).toBe(true)
    expect(readFileSync(dest, 'utf-8')).toBe('DATA-DB')
  })

  it('falha sem arquivo de origem', async () => {
    await expect(
      runBackup({ id: 'x', name: 'x', kind: 'sqlite' }, join(tmpdir(), 'x.db'))
    ).rejects.toThrow()
  })
})
