import { spawn } from 'child_process'
import { copyFile } from 'fs/promises'
import { createWriteStream } from 'fs'
import type { ConnectionConfig } from './db/types'

/** Executa um processo externo; opcionalmente redireciona stdout para um arquivo. */
function run(
  cmd: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv; outFile?: string } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: opts.env })
    let stderr = ''
    if (opts.outFile && child.stdout) child.stdout.pipe(createWriteStream(opts.outFile))
    child.stderr?.on('data', (d) => {
      stderr += String(d)
    })
    child.on('error', (e) => reject(new Error(`${cmd} indisponível: ${e.message}`)))
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} falhou (${code}): ${stderr.slice(0, 500)}`))
    )
  })
}

/** Backup lógico do banco para `outPath`, conforme o dialeto. */
export async function runBackup(config: ConnectionConfig, outPath: string): Promise<void> {
  if (config.kind === 'sqlite') {
    if (!config.filePath) throw new Error('SQLite sem arquivo de origem.')
    await copyFile(config.filePath, outPath)
    return
  }
  if (config.kind === 'postgres') {
    await run(
      'pg_dump',
      [
        '-h',
        config.host ?? 'localhost',
        '-p',
        String(config.port ?? 5432),
        '-U',
        config.user ?? '',
        '-f',
        outPath,
        config.database ?? ''
      ],
      { env: { ...process.env, PGPASSWORD: config.password ?? '' } }
    )
    return
  }
  if (config.kind === 'mysql') {
    await run(
      'mysqldump',
      [
        '-h',
        config.host ?? 'localhost',
        '-P',
        String(config.port ?? 3306),
        '-u',
        config.user ?? '',
        `-p${config.password ?? ''}`,
        config.database ?? ''
      ],
      { env: process.env, outFile: outPath }
    )
    return
  }
  throw new Error(`Backup não suportado para ${config.kind}.`)
}
