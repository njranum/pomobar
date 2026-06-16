export type AppState = 'idle' | 'focus' | 'shortBreak' | 'longBreak' | 'paused' | 'planning'
export type SessionType = 'focus' | 'shortBreak' | 'longBreak' | 'planning'
export interface TaskRef {
  id: string | null
  title: string
}
//
export interface TimerSnapshot {
  state: AppState
  sessionType: SessionType | null
  remainingMs: number
  totalMs: number
  cyclePosition: number
  pomodorosPerCycle: number
  task: string | null
  isPause: boolean
}

export interface PomodoroConfig {
  focusMinutes: number // default 25
  shortBreakMinutes: number // default 5
  longBreakMinutes: number // default 15
  pomodorosPerCycle: number // default 4
  discordWebhookUrl: string | null
}
export const DEFAULT_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  pomodorosPerCycle: 4,
  discordWebhookUrl: null,
}

export type SyncStatus = 'pending_sync' | 'synced'
export interface SessionRecord {
  id: string // uuid
  name: string // auto e.g., "Focus - 30 May 13:15"
  type: SessionType
  date: string // yyyy-mm-dd
  startTime: string
  endTime: string
  durationMs: number // Actual minutes elapsed
  cycleNumber: number
  completed: boolean
  task: string | null // null on breaks
  taskId: string | null // Notion page id; null on breaks or plain-text tasks
  syncStatus: SyncStatus
  notionPageId: string | null
}

export interface PickerTask {
  id: string
  title: string
  scheduledDate: string | null
  overdue: boolean
  fromPlanning?: boolean
}

export interface DayStats {
  pomodorosToday: number
  focusMsToday: number
  streak: number
}
