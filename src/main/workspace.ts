import { dialog } from 'electron'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, join, resolve } from 'path'
import { getLastWorkspace, setLastWorkspace } from './appSettings'
import type { Workspace, WsEntry } from './db/types'

const VISIBLE_EXT = new Set(['.sql', '.md', '.markdown', '.txt'])
const MAX_DEPTH = 8

function ext(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

/** Lista recursivamente pastas e arquivos relevantes (.sql/.md/.txt). */
function listTree(dir: string, depth = 0): WsEntry[] {
  if (depth > MAX_DEPTH) return []
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const entries: WsEntry[] = []
  for (const name of names) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const full = join(dir, name)
    let isDir: boolean
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (isDir) {
      const children = listTree(full, depth + 1)
      if (children.length > 0) entries.push({ name, path: full, type: 'dir', children })
    } else if (VISIBLE_EXT.has(ext(name))) {
      entries.push({ name, path: full, type: 'file' })
    }
  }
  // pastas antes de arquivos, ambos ordenados por nome
  return entries.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1
  )
}

function buildWorkspace(root: string): Workspace {
  return { root, tree: listTree(root) }
}

export function currentWorkspace(): Workspace | null {
  const root = getLastWorkspace()
  if (!root || !existsSync(root)) return null
  return buildWorkspace(root)
}

export function refreshWorkspace(): Workspace | null {
  return currentWorkspace()
}

export async function openWorkspace(): Promise<Workspace | null> {
  const res = await dialog.showOpenDialog({
    title: 'Abrir pasta de workspace',
    properties: ['openDirectory', 'createDirectory']
  })
  if (res.canceled || res.filePaths.length === 0) return null
  const root = res.filePaths[0]
  setLastWorkspace(root)
  return buildWorkspace(root)
}

/** Lança um erro se o path resolvido estiver fora do workspace atual. */
function assertInsideWorkspace(filePath: string): void {
  const workspaceRoot = getLastWorkspace()
  if (!workspaceRoot) throw new Error('Nenhum workspace aberto.')
  const resolved = resolve(filePath)
  // Garante separador final para evitar falsos positivos (ex.: /ws-extra vs /ws)
  const root = workspaceRoot.endsWith('/') ? workspaceRoot : `${workspaceRoot}/`
  if (!resolved.startsWith(root) && resolved !== workspaceRoot) {
    throw new Error('Acesso negado: caminho fora do workspace')
  }
}

export function readFile(path: string): string {
  assertInsideWorkspace(path)
  return readFileSync(path, 'utf-8')
}

export function writeFile(path: string, content: string): void {
  assertInsideWorkspace(path)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content, 'utf-8')
}

export function createFile(dir: string, name: string): WsEntry {
  const safe = name.includes('.') ? name : `${name}.sql`
  const full = join(dir, safe)
  if (!existsSync(full)) writeFileSync(full, '', 'utf-8')
  return { name: safe, path: full, type: 'file' }
}

export function removeEntry(path: string): void {
  assertInsideWorkspace(path)
  rmSync(path, { recursive: true, force: true })
}

export async function saveAs(defaultName: string, content: string): Promise<string | null> {
  const res = await dialog.showSaveDialog({
    title: 'Salvar como',
    defaultPath: defaultName,
    filters: [
      { name: 'SQL', extensions: ['sql'] },
      { name: 'Markdown', extensions: ['md'] },
      { name: 'CSV', extensions: ['csv'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'Todos', extensions: ['*'] }
    ]
  })
  if (res.canceled || !res.filePath) return null
  writeFileSync(res.filePath, content, 'utf-8')
  return res.filePath
}

export async function openTextFile(): Promise<{ name: string; content: string } | null> {
  const res = await dialog.showOpenDialog({
    title: 'Abrir arquivo',
    properties: ['openFile'],
    filters: [
      { name: 'CSV', extensions: ['csv'] },
      { name: 'Texto', extensions: ['txt', 'sql', 'md'] },
      { name: 'Todos', extensions: ['*'] }
    ]
  })
  if (res.canceled || !res.filePaths[0]) return null
  const p = res.filePaths[0]
  return { name: basename(p), content: readFileSync(p, 'utf-8') }
}

export { basename }
