// Build do frontend web (arquitetura unificada): bundla a MESMA App do desktop
// (src/renderer/src) com um AppApi sobre HTTP. Uso: npm run web:build
import { build, context } from 'esbuild'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const options = {
  entryPoints: [resolve(root, 'web/src/main.tsx')],
  bundle: true,
  format: 'esm',
  outfile: resolve(root, 'web/public/app.js'),
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  // Aliases (absolutos) iguais aos do renderer/electron-vite.
  alias: {
    '@ai': resolve(root, 'src/ai'),
    '@shared': resolve(root, 'src/shared'),
    '@renderer': resolve(root, 'src/renderer/src')
  },
  loader: { '.ttf': 'file', '.woff': 'file', '.woff2': 'file' }
}

if (process.argv.includes('--watch')) {
  const ctx = await context(options)
  await ctx.watch()
  console.log('web:build em watch…')
} else {
  await build(options)
  console.log('web bundle gerado em web/public/app.js')
}
