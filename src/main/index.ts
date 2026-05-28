import { app, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { createPopover } from './popover'
import { registerIcpHandlers } from './ipc'
import store from './store'

if (process.platform === 'darwin') {
  app.dock?.hide()
  app.setActivationPolicy('accessory')
}

let tray: Tray | null = null

app.whenReady().then(() => {
  // test ipc connection
  registerIcpHandlers()

  // Get the tray icon image
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon@2x.png')
    : join(__dirname, '../../resources/tray-icon@2x.png')
  const trayIcon = nativeImage.createFromPath(iconPath)
  trayIcon.setTemplateImage(true)

  // Create the tray
  tray = new Tray(trayIcon)
  tray.setToolTip('pomobar')

  // Create the main popoveru
  const popover = createPopover()

  // Wire the popover to open /close when tray icon isPackaged
  tray.on('click', (_event, bounds) => {
    if (popover.isVisible()) {
      popover.hide()
      return
    }
    //
    const popoverBounds = popover.getBounds()
    const x = Math.round(bounds.x - popoverBounds.width / 2 + bounds.width / 2)
    const y = Math.round(bounds.y + bounds.height)
    popover.setPosition(x, y)
    popover.show()
    popover.focus()
  })
})

console.log('[main] store path:', store.path)
