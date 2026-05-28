import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '@/shared/ipc-channels'

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', {
      ping: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.PING),
      storeGet: (key: string): Promise<unknown> => ipcRenderer.invoke(IPC_CHANNELS.STORE_GET, key),
      storeSet: (key: string, value: unknown): void =>
        ipcRenderer.send(IPC_CHANNELS.STORE_SET, key, value),
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
