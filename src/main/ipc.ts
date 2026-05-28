import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import store from './store'

export function registerIcpHandlers(): void {
  // Ping - test handler
  ipcMain.handle(IPC_CHANNELS.PING, async () => {
    console.log('[main] received: ping')
    return 'pong'
  })
  //
  ipcMain.handle(IPC_CHANNELS.STORE_GET, (_event, key: string) => {
    return store.get(key)
  })
  ipcMain.handle(IPC_CHANNELS.STORE_SET, (_event, key: string, value: unknown) => {
    return store.set(key, value)
  })
}
