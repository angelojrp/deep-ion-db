import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerDbIpc, shutdownDb } from './ipc'

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

app.whenReady().then(() => {
  registerDbIpc()
  createWindow()
  setupAutoUpdate()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void shutdownDb()
})
