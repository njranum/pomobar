import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import store from './store'
import timer from './timer'
import { computeStats } from './sessions'
import type { PomodoroConfig } from '@/shared/types'
import { validateConfig } from '@/shared/validateConfig'

export function registerIpcHandlers(): void {
  // Register the electron-store getter and setters
  ipcMain.handle(IpcChannels.StoreGet, (_event, key: string) => {
    return store.get(key)
  })
  ipcMain.handle(IpcChannels.StoreSet, (_event, key: string, value: unknown) => {
    return store.set(key, value)
  })
  // Timer Controls
  ipcMain.handle(IpcChannels.TimerGetSnapshot, () => timer.getSnapshot())
  ipcMain.handle(IpcChannels.TimerStartFocus, (_e, { task }: { task: string }) => {
    timer.startFocus({ id: null, title: task })
  })
  ipcMain.handle(IpcChannels.TimerPause, () => timer.pause())
  ipcMain.handle(IpcChannels.TimerResume, () => timer.resume())
  ipcMain.handle(IpcChannels.TimerCancel, () => timer.cancel())
  ipcMain.handle(IpcChannels.TimerEndEarly, () => timer.endEarly())
  // Stats
  ipcMain.handle(IpcChannels.StatsGet, () => computeStats())
  // Config
  ipcMain.handle(IpcChannels.ConfigGet, () => store.get('config'))
  ipcMain.handle(IpcChannels.ConfigSet, (_e, patch: Partial<PomodoroConfig>) => {
    const errors = validateConfig(patch)
    if (errors.length > 0) return { ok: false, errors }
    store.set('config', { ...store.get('config'), ...patch })
    return { ok: true }
  })
  //
  ipcMain.handle(IpcChannels.TimerResolveComplete, () => {
    // TODO (M2): read markComplete and write Status = Done to the Focus Tasks DB item
  })
}
