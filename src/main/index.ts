import { app, BrowserWindow, shell } from 'electron'
import { join, resolve } from 'path'
import { registerDbIpc, shutdownDb } from './ipc'
import { handleProtocolCallback, registerServerAuthIpc } from './serverAuth'

const SERVER_PROTOCOL = 'deepion'

/** Registra o app como handler do esquema `deepion://` (modo servidor, #123). */
function registerProtocolClient(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    // Em desenvolvimento o executável é o Electron; passe o script de entrada.
    app.setAsDefaultProtocolClient(SERVER_PROTOCOL, process.execPath, [resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(SERVER_PROTOCOL)
  }
}

/** Extrai e trata um eventual `deepion://callback` presente em argv (Win/Linux). */
function consumeProtocolFromArgv(argv: string[]): void {
  const deepLink = argv.find((a) => a.startsWith(`${SERVER_PROTOCOL}://`))
  if (deepLink) handleProtocolCallback(deepLink)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    title: 'Deep Ion DB',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Links (ex.: no preview de Markdown) abrem no navegador, nunca navegam o app.
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Auto-update via Releases do GitHub (apenas no app empacotado). */
function setupAutoUpdate(): void {
  if (!app.isPackaged) return
  import('electron-updater')
    .then(({ autoUpdater }) => {
      autoUpdater.checkForUpdatesAndNotify().catch((e) => console.warn('auto-update:', e))
    })
    .catch((e) => console.warn('auto-update indisponível:', e))
}

// Instância única: necessário para receber o `deepion://callback` via
// `second-instance` no Windows/Linux (o SO relança o app com a URL em argv).
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    consumeProtocolFromArgv(argv)
  })

  // macOS entrega o deep link por este evento.
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleProtocolCallback(url)
  })

  registerProtocolClient()

  app.whenReady().then(() => {
    registerDbIpc()
    registerServerAuthIpc()
    createWindow()
    setupAutoUpdate()
    // App iniciado diretamente pelo deep link (Win/Linux, primeira instância).
    consumeProtocolFromArgv(process.argv)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void shutdownDb()
})
