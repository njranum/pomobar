import { app, Tray, nativeImage, Menu, type NativeImage } from 'electron'
import { join } from 'path'
import { createPopover } from './popover'
import { registerIpcHandlers } from './ipc'
import {
  setPopoverWindow,
  broadcastSnapshot,
  broadcastStats,
  broadcastPromptMarkComplete,
} from './broadcast'
import timer from './timer'
import { buildRecord, computeStats, writeSession } from './sessions'
import type { AppState, TimerSnapshot } from '@/shared/types'

if (process.platform === 'darwin') {
  app.dock?.hide()
  app.setActivationPolicy('accessory')
}

let tray: Tray | null = null

app.whenReady().then(() => {
  // test ipc connection
  registerIpcHandlers()

  // Resolve resources/icons
  const iconDirs = app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icons')
    : join(__dirname, '../../resources/icons')
  const makeIcon = (state: AppState): NativeImage => {
    const img = nativeImage.createFromPath(join(iconDirs, `${state}Template.png`))
    img.setTemplateImage(true)
    return img
  }
  const icons: Record<AppState, NativeImage> = {
    idle: makeIcon('idle'),
    focus: makeIcon('focus'),
    shortBreak: makeIcon('shortBreak'),
    longBreak: makeIcon('longBreak'),
    paused: makeIcon('paused'),
    planning: makeIcon('planning'),
  }

  // Create the tray
  tray = new Tray(icons.idle)
  tray.setToolTip('pomobar')

  // Create the main popoveru
  const popover = createPopover()
  setPopoverWindow(popover)

  // calculate the time remaining to show in ocon bar
  const mmss = (ms: number): string => {
    const t = Math.round(ms / 1000)
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }
  // make tray icon state dependent and show time left if applicable
  const updateTray = (s: TimerSnapshot): void => {
    tray?.setImage(icons[s.state])
    const showTime = s.state !== 'idle' && s.state !== 'planning'
    tray?.setTitle(showTime ? ` ${mmss(s.remainingMs)}` : '')
  }

  // subscribe to the timer ticks
  timer.onSnapshot(updateTray)
  updateTray(timer.getSnapshot()) // paint idle now
  // subscribe to the state change events
  timer.onSnapshot(broadcastSnapshot)
  timer.onSessionEnded((e) => {
    writeSession(buildRecord(e))
    broadcastStats(computeStats())
  })
  // Subscribe to task complete
  timer.onNaturalComplete(({ type, task }) => {
    if (type === 'focus' && task) broadcastPromptMarkComplete(task)
  })

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
  const menuTray = tray
  const devMenu = Menu.buildFromTemplate([
    {
      label: 'Pause / Resume',
      click: () => {
        if (timer.getSnapshot().state === 'paused') timer.resume()
        else timer.pause()
      },
    },
    { label: 'Cancel', click: () => timer.cancel() },
    { label: 'End Early', click: () => timer.endEarly() },
    { label: 'Complete Now (dev only)', click: () => timer.completeNow() }, // testing aid to pretend like the timer hit 0
  ])
  menuTray.on('right-click', () => menuTray.popUpContextMenu(devMenu))
})
