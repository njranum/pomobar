import { app, Tray, nativeImage } from 'electron'
import { join } from 'path'

if (process.platform === 'darwin') {
  app.dock?.hide()
  app.setActivationPolicy('accessory')
}

let tray: Tray | null = null

app.whenReady().then(() => {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon@2x.png')
    : join(__dirname, '../../resources/tray-icon@2x.png')
  const trayIcon = nativeImage.createFromPath(iconPath)
  trayIcon.setTemplateImage(true)

  tray = new Tray(trayIcon)
  tray.setToolTip('pomobar')
})
