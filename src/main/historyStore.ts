import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import type { HistoryEntry, HistoryInput } from './db/types'

const MAX_ENTRIES = 500
const MAX_FAVORITES_KEPT = 200

interface HistoryFile {
  version: number
  entries: HistoryEntry[]
}

/** Persiste o histórico de queries em userData/history.json (favoritos preservados). */
export class HistoryStore {
  private readonly file = join(app.getPath('userData'), 'history.json')
  private data: HistoryFile = { version: 1, entries: [] }

  load(): void {
    try {
      if (existsSync(this.file)) {
        this.data = JSON.parse(readFileSync(this.file, 'utf-8')) as HistoryFile
      }
    } catch {
      this.data = { version: 1, entries: [] }
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  private trim(): void {
    const favorites = this.data.entries.filter((e) => e.favorite)
    const recents = this.data.entries.filter((e) => !e.favorite).slice(0, MAX_ENTRIES)
    this.data.entries = [...favorites.slice(0, MAX_FAVORITES_KEPT), ...recents].sort(
      (a, b) => b.ts - a.ts
    )
  }

  list(): HistoryEntry[] {
    return this.data.entries
  }

  add(input: HistoryInput): HistoryEntry {
    const entry: HistoryEntry = { ...input, id: randomUUID(), favorite: false }
    this.data.entries.unshift(entry)
    this.trim()
    this.persist()
    return entry
  }

  toggleFavorite(id: string): void {
    const e = this.data.entries.find((x) => x.id === id)
    if (e) {
      e.favorite = !e.favorite
      this.persist()
    }
  }

  remove(id: string): void {
    this.data.entries = this.data.entries.filter((e) => e.id !== id)
    this.persist()
  }

  clear(): void {
    // mantém favoritos ao limpar
    this.data.entries = this.data.entries.filter((e) => e.favorite)
    this.persist()
  }
}
