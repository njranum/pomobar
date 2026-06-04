import { BrowserWindow } from 'electron'
import { IpcChannels } from '@/shared/ipc-channels'
import type { DayStats, TimerSnapshot } from '@/shared/types'

let popover: BrowserWindow | null = null
export const setPopoverWindow = (w: BrowserWindow): void => {
  popover = w
}

export const broadcastSnapshot = (s: TimerSnapshot): void => {
  if (popover && !popover.isDestroyed()) {
    popover?.webContents.send(IpcChannels.TimerSnapshot, s)
  }
}

export const broadcastStats = (s: DayStats): void => {
  popover?.webContents.send(IpcChannels.StatsUpdated, s)
}

export const broadcastPromptMarkComplete = (task: string): void => {
  popover?.webContents.send(IpcChannels.PromptMarkComplete, { task })
}

export const showPopover = (): void => {
  popover?.show()
  popover?.focus()
}
