import Store from 'electron-store'
import { DEFAULT_CONFIG } from '@/shared/types'
import type { PomodoroConfig, SessionRecord } from '@/shared/types'
// Create a skeleton schema

interface PersistedState {
  state: 'idle' | 'focus' | 'shortBreak' | 'longBreak' | 'paused' | 'planning'
  sessionType: SessionRecord['type'] | null
  startTime: string | null
  accumulatedMs: number
  lastTickAt: string | null
  cyclePosition: number
  task: string | null
}

export interface StoreSchema {
  config: PomodoroConfig
  sessions: SessionRecord[]
  syncQueue: string[]
  lastState: PersistedState | null
}

const store = new Store<StoreSchema>({
  defaults: { config: DEFAULT_CONFIG, sessions: [], syncQueue: [], lastState: null },
})
export default store // default export matching store in ipc.ts
