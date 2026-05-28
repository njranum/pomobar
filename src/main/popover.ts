import { BrowserWindow } from 'electron'
import path from 'path'

let popover: BrowserWindow | null = null

export function createPopover(): BrowserWindow {
  popover = new BrowserWindow({
    width: 320,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    popover.webContents.openDevTools({ mode: 'detach' })
  }

  // Load renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    // dev
    popover.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // prod
    popover.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // hide popover if it is open and you click off the bounds
  popover.on('blur', () => {
    if (popover?.isVisible()) {
      popover.hide()
    }
  })

  return popover
}
