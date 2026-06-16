import type { SessionRecord, SessionType, DayStats } from '@/shared/types'
import type { CreatePageParameters } from '@notionhq/client'
import { randomUUID } from 'crypto'
import store from './store'
import { getNotion } from './notion'

const fmt = (d: Date): string => {
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildRecord(p: {
  type: SessionType
  startedAt: number
  endedAt: number
  durationMs: number
  cycleNumber: number
  completed: boolean
  task: string | null
  taskId: string | null
}): SessionRecord {
  const start = new Date(p.startedAt)
  const label =
    p.type === 'focus'
      ? 'Focus'
      : p.type === 'shortBreak'
        ? 'Short Break'
        : p.type === 'longBreak'
          ? 'Long Break'
          : 'Planning'
  return {
    id: randomUUID(),
    name: `${label} - ${fmt(start)}`,
    type: p.type,
    date: start.toISOString().slice(0, 10),
    startTime: start.toISOString(),
    endTime: new Date(p.endedAt).toISOString(),
    durationMs: p.durationMs,
    cycleNumber: p.cycleNumber,
    completed: p.completed,
    task: p.type === 'focus' ? p.task : null,
    taskId: p.type === 'focus' ? p.taskId : null,
    syncStatus: 'pending_sync', // we store locally before attempting to push to Notion
    notionPageId: null,
  }
}

export function sessionToNotionProps(r: SessionRecord): Record<string, unknown> {
  const typeLabel =
    r.type === 'focus'
      ? 'Focus'
      : r.type === 'shortBreak'
        ? 'Short Break'
        : r.type === 'longBreak'
          ? 'Long Break'
          : 'Planning'
  const props: Record<string, unknown> = {
    Name: { title: [{ text: { content: r.name } }] },
    Date: { date: { start: r.date } },
    'Start Time': { date: { start: r.startTime } },
    'End Time': { date: { start: r.endTime } },
    'Duration (mins)': { number: Math.round(r.durationMs / 60000) },
    Type: { select: { name: typeLabel } },
    'Cycle Number': { number: r.cycleNumber },
    Completed: { checkbox: r.completed },
  }
  if (r.taskId) props['Task'] = { relation: [{ id: r.taskId }] }
  return props
}

export function writeSession(rec: SessionRecord): SessionRecord {
  store.set('sessions', [...store.get('sessions'), rec])
  store.set('syncQueue', [...store.get('syncQueue'), rec.id])
  return rec
}

function dropFromQueue(id: string): void {
  store.set(
    'syncQueue',
    store.get('syncQueue').filter((q) => q !== id)
  )
}

function markSynced(id: string, notionPageId: string): void {
  store.set(
    'sessions',
    store
      .get('sessions')
      .map((s) => (s.id === id ? { ...s, syncStatus: 'synced' as const, notionPageId } : s))
  )
}

export async function processSyncQueue(): Promise<void> {
  const c = getNotion()
  if (!c) return
  const queue = store.get('syncQueue')
  if (queue.length === 0) return
  const dbId = store.get('notionTargets').sessionsDbId
  if (!dbId) return
  for (const id of queue) {
    const rec = store.get('sessions').find((s) => s.id === id)
    if (!rec) {
      dropFromQueue(id)
      continue
    }
    try {
      const page = await c.pages.create({
        parent: { database_id: dbId },
        properties: sessionToNotionProps(rec) as NonNullable<CreatePageParameters['properties']>,
      })
      markSynced(rec.id, page.id)
      dropFromQueue(id)
    } catch {
      // leave in queue for retry
    }
  }
}

export function computeStats(): DayStats {
  const allSessions = store.get('sessions')
  const today = new Date().toISOString().slice(0, 10)
  const todays = allSessions.filter((s) => s.date === today && s.type === 'focus' && s.completed)
  return {
    pomodorosToday: todays.length,
    focusMsToday: todays.reduce((a, s) => a + s.durationMs, 0),
    streak: computeStreak(allSessions),
  }
}

function effectiveDateForTs(ts: number): string {
  const d = new Date(ts)
  const cutoff = new Date(d)
  cutoff.setHours(4, 0, 0, 0)
  const ref = d < cutoff ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1) : d
  return ref.toISOString().split('T')[0]
}

export function computeStreak(sessions: SessionRecord[]): number {
  const focusDays = new Set(
    sessions
      .filter((s) => s.type === 'focus' && s.completed)
      .map((s) => effectiveDateForTs(new Date(s.startTime).getTime()))
  )
  let streak = 0
  const d = new Date()
  if (d.getHours() < 4) d.setDate(d.getDate() - 1)
  while (focusDays.has(d.toISOString().split('T')[0])) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}
