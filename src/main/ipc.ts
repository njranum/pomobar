import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import store from './store'

export function registerIcpHandlers(): void {
  //
  ipcMain.handle(IpcChannels.StoreGet, (_event, key: string) => {
    return store.get(key)
  })
  ipcMain.handle(IpcChannels.StoreSet, (_event, key: string, value: unknown) => {
    return store.set(key, value)
  })
}
