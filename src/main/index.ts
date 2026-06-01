import { app, Tray, nativeImage, Menu } from 'electron'
import { join } from 'path'
import { createPopover } from './popover'
import { registerIpcHandlers } from './ipc'
import { setPopoverWindow, broadcastSnapshot } from './broadcast'
import timer from './timer'
import { is } from '@electron-toolkit/utils'

if (process.platform === 'darwin') {
  app.dock?.hide()
  app.setActivationPolicy('accessory')
}

let tray: Tray | null = null

app.whenReady().then(() => {
  // test ipc connection
  registerIpcHandlers()

  // Get the tray icon image
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'tray-icon@2x.png')
    : join(__dirname, '../../resources/tray-icon@2x.png')
  const trayIcon = nativeImage.createFromPath(iconPath)
  trayIcon.setTemplateImage(true)

  // Create the tray
  tray = new Tray(trayIcon)
  tray.setToolTip('pomobar')

  // Create the main popoveru
  const popover = createPopover()
  setPopoverWindow(popover)

  // subscribe to the timer ticks
  timer.onSnapshot(broadcastSnapshot)

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

  // Create manual pop up context menu to allow selection of timer states for testing
  if (is.dev) {
    const menuTray = tray
    const devMenu = Menu.buildFromTemplate([
      { label: 'Start Focus', click: () => timer.startFocus({ id: null, title: 'dev' }) },
      {
        label: 'Pause / Resume',
        click: () => {
          if (timer.getSnapshot().state === 'paused') timer.resume()
          else timer.pause()
        },
      },
      { label: 'Cancel', click: () => timer.cancel() },
      { label: 'End Early', click: () => timer.endEarly() },
      { label: 'Complete Now', click: () => timer.completeNow() },
    ])
    menuTray.on('right-click', () => menuTray.popUpContextMenu(devMenu))
  }
})
