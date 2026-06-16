import { BrowserWindow } from 'electron'
import path from 'path'

let popover: BrowserWindow | null = null

export function createPopover(): BrowserWindow {
  popover = new BrowserWindow({
    width: 300,
    height: 200, // initial; resized to content height by the renderer (WindowSetHeight)
    show: false,
    useContentSize: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'popover',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // if (process.env['ELECTRON_RENDERER_URL']) {
  //   popover.webContents.openDevTools({ mode: 'detach' })
  // }

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
