import electron from 'electron'
import type { BrowserWindow as BrowserWindowType, Tray as TrayType } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  screen,
} = electron
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

const COMMAND_CHANNEL = 'blackhole:command'

let win: BrowserWindowType | null = null
let tray: TrayType | null = null

function sendCommand(command: string) {
  if (!win || win.isDestroyed()) {
    return
  }

  win.webContents.send(COMMAND_CHANNEL, command)
}

function createTrayImage() {
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVR42mNgGAWjYBSMglEwCkbBKBhFwwAAABAAAAH0ivRAAAAAAElFTkSuQmCC',
  )
}

function rebuildMenu() {
  const template = [
    { label: 'Reset parameters', click: () => sendCommand('reset') },
    { type: 'separator' as const },
    { label: 'Quit', click: () => app.quit() },
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  tray?.setContextMenu(menu)
}

function createTray() {
  tray = new Tray(createTrayImage())
  tray.setToolTip('Black Hole Overlay')
  rebuildMenu()
}

function getRendererQuery() {
  const debugRawCapture = process.env['DEBUG_RAW_CAPTURE'] ?? process.env['DEBUG_RAW_CROP']

  return {
    ...(debugRawCapture ? { debugRawCapture } : {}),
  }
}

function createWindow() {
  const display = screen.getPrimaryDisplay()
  const terminalWidth = Math.min(1280, Math.round(display.workArea.width * 0.82))
  const terminalHeight = Math.min(820, Math.round(display.workArea.height * 0.78))
  const terminalX = display.workArea.x + Math.round((display.workArea.width - terminalWidth) * 0.5)
  const terminalY = display.workArea.y + Math.round((display.workArea.height - terminalHeight) * 0.5)
  const bounds = { x: terminalX, y: terminalY, width: terminalWidth, height: terminalHeight }

  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    movable: true,
    fullscreenable: false,
    focusable: true,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#080c12',
    icon: path.join(process.env.VITE_PUBLIC, 'icon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.setZoomFactor(1)

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (message.startsWith('[blackhole]')) {
      console.info('[renderer]', message)
      return
    }

    if (level >= 3) {
      console.error('[renderer]', { level, message, line, sourceId })
    }
  })
  win.once('ready-to-show', () => {
    if (!win || win.isDestroyed()) {
      return
    }

    win.show()
  })

  const rendererQuery = getRendererQuery()
  if (VITE_DEV_SERVER_URL) {
    const url = new URL(VITE_DEV_SERVER_URL)
    for (const [key, value] of Object.entries(rendererQuery)) {
      url.searchParams.set(key, value)
    }
    win.loadURL(url.toString())
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), { query: rendererQuery })
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  createTray()
})
