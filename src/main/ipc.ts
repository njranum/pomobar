import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'

export function registerIcpHandlers(): void {
  // Ping - test handler
  ipcMain.handle(IPC_CHANNELS.PING, async () => {
    console.log('[main] ping received')
    return 'pong'
  })
}
