import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import store from './store'
import timer from './timer'
import { computeStats, buildRecord, writeSession } from './sessions'
import type { PomodoroConfig, TaskRef } from '@/shared/types'
import { validateConfig } from '@/shared/validateConfig'
import {
  validateNotionSecret,
  extractNotionId,
  resetNotion,
  resolveDataSourceId,
  fetchScheduledTasks,
  markTaskDone,
  createOrFetchTodayPlanningRow,
  readPlanningGoals,
  writePomodoroGoal,
  fetchPlanningTasks,
} from './notion'
import { needsPlanning, effectiveDate } from './planning'

export let activeFocusTask: TaskRef | null = null
export let activePlanningRowId: string | null = null

export function registerIpcHandlers(): void {
  const PROTECTED = new Set(['notionSecret', 'notionTargets'])
  ipcMain.handle(IpcChannels.StoreGet, (_event, key: string) => {
    if (PROTECTED.has(key)) return undefined
    return store.get(key)
  })
  ipcMain.handle(IpcChannels.StoreSet, (_event, key: string, value: unknown) => {
    if (PROTECTED.has(key)) return
    return store.set(key, value)
  })
  // Timer Controls
  ipcMain.handle(IpcChannels.TimerGetSnapshot, () => timer.getSnapshot())
  ipcMain.handle(IpcChannels.TimerStartFocus, (_e, { task }: { task: TaskRef }) => {
    if (needsPlanning()) return { ok: false, reason: 'planning_required' }
    activeFocusTask = task
    timer.startFocus(task)
    return { ok: true }
  })
  ipcMain.handle(IpcChannels.NeedsPlanning, () => needsPlanning())
  ipcMain.handle(IpcChannels.PlanningSync, async () => {
    const rowId = activePlanningRowId
    if (!rowId) return { pomodoroGoal: null, focusTimeGoalMins: null, tasks: [] }
    const { focusTimeGoalMins } = await readPlanningGoals(rowId)
    const config = store.get('config')
    let pomodoroGoal: number | null = null
    if (focusTimeGoalMins !== null) {
      pomodoroGoal = Math.ceil(focusTimeGoalMins / config.focusMinutes)
      await writePomodoroGoal(rowId, pomodoroGoal)
    }
    const planningTasks = await fetchPlanningTasks(rowId)
    const scheduledTasks = await fetchScheduledTasks()
    const merged = [
      ...planningTasks,
      ...scheduledTasks.filter((t) => !planningTasks.find((p) => p.id === t.id)),
    ]
    store.set('taskCache', merged)
    activePlanningRowId = null
    return { pomodoroGoal, focusTimeGoalMins, tasks: merged }
  })
  ipcMain.handle(IpcChannels.PlanningComplete, () => {
    const { startedAt, endedAt } = timer.endPlanning()
    const record = buildRecord({
      type: 'planning',
      task: null,
      taskId: null,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      cycleNumber: timer.getSnapshot().cyclePosition,
      completed: true,
    })
    writeSession(record)
    store.set('lastPlanningDate', effectiveDate())
    return { ok: true }
  })
  ipcMain.handle(IpcChannels.PlanningStart, async () => {
    const planningDbId = store.get('planningDbId')
    if (!planningDbId) return { ok: false, reason: 'not_configured' }
    try {
      const rowId = await createOrFetchTodayPlanningRow(effectiveDate())
      activePlanningRowId = rowId
      store.set('todayPlanningRowId', rowId)
      timer.startPlanning()
      return { ok: true, rowId }
    } catch (e) {
      return { ok: false, reason: String(e) }
    }
  })
  ipcMain.handle(IpcChannels.TimerPause, () => timer.pause())
  ipcMain.handle(IpcChannels.TimerResume, () => timer.resume())
  ipcMain.handle(IpcChannels.TimerCancel, () => {
    activeFocusTask = null
    timer.cancel()
  })
  ipcMain.handle(IpcChannels.TimerEndEarly, () => {
    const task = activeFocusTask
    activeFocusTask = null
    timer.endEarly()
    if (task?.id) markTaskDone(task.id)
  })
  // Stats
  ipcMain.handle(IpcChannels.StatsGet, () => computeStats())
  // Config
  ipcMain.handle(IpcChannels.ConfigGet, () => store.get('config'))
  ipcMain.handle(IpcChannels.ConfigSet, (_e, patch: Partial<PomodoroConfig>) => {
    const errors = validateConfig(patch)
    if (errors.length > 0) return { ok: false, errors }
    store.set('config', { ...store.get('config'), ...patch })
    return { ok: true }
  })
  //
  ipcMain.handle(
    IpcChannels.TimerResolveComplete,
    (_e, { markComplete }: { markComplete: boolean }) => {
      const task = activeFocusTask
      activeFocusTask = null
      if (markComplete && task?.id) markTaskDone(task.id)
    }
  )
  // Notion
  ipcMain.handle(IpcChannels.NotionIsConfigured, () => {
    const targets = store.get('notionTargets')
    return !!store.get('notionSecret') && !!targets.tasksDbId && !!targets.sessionsDbId
  })
  ipcMain.handle(
    IpcChannels.NotionValidate,
    (_e, { secret, tasksDbId }: { secret: string; tasksDbId: string }) =>
      validateNotionSecret(secret, extractNotionId(tasksDbId))
  )
  ipcMain.handle(IpcChannels.TasksFetch, async () => {
    try {
      const tasks = await fetchScheduledTasks()
      store.set('taskCache', tasks)
      return tasks
    } catch {
      return store.get('taskCache')
    }
  })
  ipcMain.handle(IpcChannels.TaskCacheGet, () => store.get('taskCache'))
  ipcMain.handle(IpcChannels.SyncPendingGet, () => store.get('syncQueue').length)
  ipcMain.handle(IpcChannels.DailyGoalsGet, () => store.get('dailyGoals'))
  ipcMain.handle(
    IpcChannels.NotionSetup,
    async (_e, p: { secret: string; tasksDbId: string; sessionsDbId: string }) => {
      const { Client } = await import('@notionhq/client')
      const c = new Client({ auth: p.secret })
      const tasksPageId = extractNotionId(p.tasksDbId)
      const sessionsPageId = extractNotionId(p.sessionsDbId)
      const tasksDbId = await resolveDataSourceId(c, tasksPageId)
      store.set('notionSecret', p.secret)
      store.set('notionTargets', { tasksDbId, sessionsDbId: sessionsPageId })
      resetNotion()
    }
  )
}
