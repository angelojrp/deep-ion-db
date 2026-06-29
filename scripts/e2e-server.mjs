/**
 * Script cross-plataforma para iniciar o servidor no modo e2e.
 * Roda o build do web bundle e depois inicia o server com AUTH_DISABLED=true.
 * Usado pelo playwright.config.ts como webServer.command.
 */
import { execSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Build o bundle web (shell:true é cross-plataforma no Node 18+)
execSync('npm run web:build', { cwd: root, stdio: 'inherit', shell: true })

// Inicia o servidor (AUTH_DISABLED e PORT já vêm do env definido pelo playwright)
const server = spawn('npm', ['run', 'server:start'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: true
})

server.on('exit', (code) => process.exit(code ?? 0))
process.on('SIGTERM', () => server.kill('SIGTERM'))
process.on('SIGINT', () => server.kill('SIGINT'))
