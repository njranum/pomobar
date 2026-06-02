import type { SessionRecord, SessionType } from '@/shared/types'
import { randomUUID } from 'crypto'
import store from './store'

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
}): SessionRecord {
  const start = new Date(p.startedAt)
  const label =
    p.type === 'focus' ? 'Focus' : p.type === 'shortBreak' ? 'Short Break' : 'Long Break'
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
    syncStatus: 'pending_sync', // we store locally before attempting to push to Notion
    notionPageId: null,
  }
}

export function writeSession(rec: SessionRecord): SessionRecord {
  store.set('sessions', [...store.get('sessions'), rec])
  store.set('syncQueue', [...store.get('syncQueue'), rec.id])
  return rec
}
