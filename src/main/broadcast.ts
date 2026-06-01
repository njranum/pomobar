import { BrowserWindow } from 'electron'
import { IpcChannels } from '@/shared/ipc-channels'
import type { TimerSnapshot } from '@/shared/types'

let popover: BrowserWindow | null = null
export const setPopoverWindow = (w: BrowserWindow): void => {
  popover = w
}
export const broadcastSnapshot = (s: TimerSnapshot): void => {
  popover?.webContents.send(IpcChannels.TimerSnapshot, s)
}
