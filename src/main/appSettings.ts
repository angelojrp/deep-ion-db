import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

interface Settings {
  lastWorkspace?: string
}

const file = join(app.getPath('userData'), 'settings.json')

function read(): Settings {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf-8')) as Settings
  } catch {
    /* ignora settings corrompido */
  }
  return {}
}

function write(data: Settings): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

export function getLastWorkspace(): string | undefined {
  return read().lastWorkspace
}

export function setLastWorkspace(path: string | undefined): void {
  const data = read()
  data.lastWorkspace = path
  write(data)
}
