import Store from 'electron-store'
import { DEFAULT_CONFIG } from '@/shared/types'
import type { PomodoroConfig, SessionRecord, PickerTask } from '@/shared/types'
// Create a skeleton schema

export interface PersistedState {
  state: 'idle' | 'focus' | 'shortBreak' | 'longBreak' | 'paused' | 'planning'
  sessionType: SessionRecord['type'] | null
  startTime: string | null
  accumulatedMs: number
  lastTickAt: string | null
  cyclePosition: number
  task: string | null
  taskId: string | null
}

export interface NotionTargets {
  tasksDbId: string | null
  sessionsDbId: string | null
}

export interface StoreSchema {
  config: PomodoroConfig
  sessions: SessionRecord[]
  syncQueue: string[]
  lastState: PersistedState | null
  notionSecret: string | null
  notionTargets: NotionTargets
  taskCache: PickerTask[]
  planningDbId: string | null
  lastPlanningDate: string | null
  todayPlanningRowId: string | null
}

const store = new Store<StoreSchema>({
  defaults: {
    config: DEFAULT_CONFIG,
    sessions: [],
    syncQueue: [],
    lastState: null,
    notionSecret: null,
    notionTargets: { tasksDbId: null, sessionsDbId: null },
    taskCache: [],
    planningDbId: null,
    lastPlanningDate: null,
    todayPlanningRowId: null,
  },
})
export default store // default export matching store in ipc.ts
