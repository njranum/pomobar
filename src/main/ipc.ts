import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import store from './store'
import timer from './timer'
import { computeStats } from './sessions'

export function registerIpcHandlers(): void {
  // Register the electron-store getter and setters
  ipcMain.handle(IpcChannels.StoreGet, (_event, key: string) => {
    return store.get(key)
  })
  ipcMain.handle(IpcChannels.StoreSet, (_event, key: string, value: unknown) => {
    return store.set(key, value)
  })
  //
  ipcMain.handle(IpcChannels.TimerGetSnapshot, () => timer.getSnapshot())
  ipcMain.handle(IpcChannels.TimerStartFocus, (_e, { task }: { task: string }) => {
    timer.startFocus({ id: null, title: task })
  })
  ipcMain.handle(IpcChannels.TimerPause, () => timer.pause())
  ipcMain.handle(IpcChannels.TimerResume, () => timer.resume())
  ipcMain.handle(IpcChannels.TimerCancel, () => timer.cancel())
  ipcMain.handle(IpcChannels.TimerEndEarly, () => timer.endEarly())
  //
  ipcMain.handle(IpcChannels.StatsGet, () => computeStats())
}
