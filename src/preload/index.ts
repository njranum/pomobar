import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels } from '@/shared/ipc-channels'
import type { TimerSnapshot, PomodoroConfig, DayStats, TaskRef, PickerTask } from '@/shared/types'

const api = {
  // electron store
  storeGet: (key: string): Promise<unknown> => ipcRenderer.invoke(IpcChannels.StoreGet, key),
  storeSet: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.StoreSet, key, value),
  // invoke: renderer -> main
  getSnapshot: (): Promise<TimerSnapshot> => ipcRenderer.invoke(IpcChannels.TimerGetSnapshot),
  startFocus: (task: TaskRef): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.TimerStartFocus, { task }),
  pause: (): Promise<void> => ipcRenderer.invoke(IpcChannels.TimerPause),
  resume: (): Promise<void> => ipcRenderer.invoke(IpcChannels.TimerResume),
  cancel: (): Promise<void> => ipcRenderer.invoke(IpcChannels.TimerCancel),
  endEarly: (): Promise<void> => ipcRenderer.invoke(IpcChannels.TimerEndEarly),
  resolveComplete: (markComplete: boolean): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.TimerResolveComplete, { markComplete }),
  getStats: (): Promise<DayStats> => ipcRenderer.invoke(IpcChannels.StatsGet),
  getConfig: (): Promise<PomodoroConfig> => ipcRenderer.invoke(IpcChannels.ConfigGet),
  setConfig: (patch: Partial<PomodoroConfig>): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.ConfigSet, patch),
  isConfigured: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.NotionIsConfigured),
  notionValidate: (secret: string, tasksDbId: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IpcChannels.NotionValidate, { secret, tasksDbId }),
  notionSetup: (p: { secret: string; tasksDbId: string; sessionsDbId: string }): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.NotionSetup, p),
  fetchTasks: (): Promise<PickerTask[]> => ipcRenderer.invoke(IpcChannels.TasksFetch),
  getTaskCache: (): Promise<PickerTask[]> => ipcRenderer.invoke(IpcChannels.TaskCacheGet),
  getPendingSync: (): Promise<number> => ipcRenderer.invoke(IpcChannels.SyncPendingGet),
  // events: main -> renderer (each returns an unsubscribe fn)
  onSnapshot: (cb: (s: TimerSnapshot) => void): (() => void) => {
    const h = (_: unknown, s: TimerSnapshot): void => cb(s)
    ipcRenderer.on(IpcChannels.TimerSnapshot, h)
    return (): void => {
      ipcRenderer.removeListener(IpcChannels.TimerSnapshot, h)
    }
  },
  onStats: (cb: (s: DayStats) => void): (() => void) => {
    const h = (_: unknown, s: DayStats): void => cb(s)
    ipcRenderer.on(IpcChannels.StatsUpdated, h)
    return (): void => {
      ipcRenderer.removeListener(IpcChannels.StatsUpdated, h)
    }
  },
  onPromptMarkComplete: (cb: (p: { task: string }) => void): (() => void) => {
    const h = (_: unknown, p: { task: string }): void => cb(p)
    ipcRenderer.on(IpcChannels.PromptMarkComplete, h)
    return (): void => {
      ipcRenderer.removeListener(IpcChannels.PromptMarkComplete, h)
    }
  },
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
