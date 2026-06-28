// Gera os ícones do app (PNG/ICO) a partir de build/logo.svg.
// Uso: npm run icons
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'build/logo.svg'))

const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png()

// Ícone principal (electron-builder gera icns/ico a partir deste PNG por plataforma).
await png(1024).toFile(resolve(root, 'build/icon.png'))

// ICO multi-resolução para Windows.
const icoSizes = await Promise.all([16, 24, 32, 48, 64, 128, 256].map((s) => png(s).toBuffer()))
writeFileSync(resolve(root, 'build/icon.ico'), await pngToIco(icoSizes))

// Favicon do renderer (web embutida).
const pub = resolve(root, 'src/renderer/public')
mkdirSync(pub, { recursive: true })
await png(256).toFile(resolve(pub, 'icon.png'))
writeFileSync(resolve(pub, 'favicon.svg'), svg)

console.log('Ícones gerados em build/ e src/renderer/public/')
