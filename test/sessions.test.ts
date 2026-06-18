import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRecord, SessionType } from '@/shared/types'

// sessions.ts imports the electron-store wrapper at module-eval; stub it with a
// mutable in-memory `sessions` array so the stats helpers can be exercised
// without Electron app paths. `vi.hoisted` lets the factory close over it.
const storeMock = vi.hoisted(() => ({ sessions: [] as unknown[] }))

vi.mock('@/main/store', () => ({
  default: {
    get: (key: string): unknown => (key === 'sessions' ? storeMock.sessions : []),
    set: (): void => undefined,
  },
}))

import { buildRecord, computeStats, computeStreak, sessionToNotionProps } from '@/main/sessions'

const baseInput = {
  type: 'focus' as const,
  startedAt: Date.parse('2026-06-16T09:00:00.000Z'),
  endedAt: Date.parse('2026-06-16T09:25:00.000Z'),
  durationMs: 24 * 60_000, // elapsed, not the configured 25
  cycleNumber: 2,
  completed: true,
  task: 'Write tests',
  taskId: 'notion-page-id',
}

describe('buildRecord', () => {
  it('carries through the elapsed duration and completion flag', () => {
    const rec = buildRecord(baseInput)
    expect(rec.durationMs).toBe(24 * 60_000)
    expect(rec.completed).toBe(true)
    expect(rec.cycleNumber).toBe(2)
    expect(rec.type).toBe('focus')
    expect(rec.syncStatus).toBe('pending_sync')
    expect(rec.notionPageId).toBeNull()
  })

  it('keeps the task and taskId for focus sessions', () => {
    const rec = buildRecord(baseInput)
    expect(rec.task).toBe('Write tests')
    expect(rec.taskId).toBe('notion-page-id')
    expect(rec.name.startsWith('Focus - ')).toBe(true)
  })

  it('drops the task and taskId for break sessions', () => {
    const rec = buildRecord({ ...baseInput, type: 'shortBreak', task: 'leftover', taskId: 'x' })
    expect(rec.task).toBeNull()
    expect(rec.taskId).toBeNull()
    expect(rec.name.startsWith('Short Break - ')).toBe(true)
  })

  it('assigns a unique id per record', () => {
    expect(buildRecord(baseInput).id).not.toBe(buildRecord(baseInput).id)
  })
})

describe('sessionToNotionProps', () => {
  it('rounds the duration to whole minutes and maps the core properties', () => {
    const props = sessionToNotionProps(buildRecord({ ...baseInput, durationMs: 90_000 }))
    expect(props['Duration (mins)']).toEqual({ number: 2 }) // 90s rounds to 2
    expect(props['Type']).toEqual({ select: { name: 'Focus' } })
    expect(props['Completed']).toEqual({ checkbox: true })
    expect(props['Cycle Number']).toEqual({ number: 2 })
  })

  it('includes a Task relation only when a taskId is present', () => {
    const withTask = sessionToNotionProps(buildRecord(baseInput))
    expect(withTask['Task']).toEqual({ relation: [{ id: 'notion-page-id' }] })

    const breakProps = sessionToNotionProps(buildRecord({ ...baseInput, type: 'shortBreak' }))
    expect(breakProps['Task']).toBeUndefined()
  })
})

// Build a minimal SessionRecord; only the fields the stats helpers read
// (type, completed, date, startTime, durationMs) carry meaning here.
let nextId = 0
function record(
  startTime: string,
  opts: { type?: SessionType; completed?: boolean; durationMs?: number } = {}
): SessionRecord {
  return {
    id: String(nextId++),
    name: 'Session',
    type: opts.type ?? 'focus',
    date: startTime.slice(0, 10),
    startTime,
    endTime: startTime,
    durationMs: opts.durationMs ?? 25 * 60_000,
    cycleNumber: 1,
    completed: opts.completed ?? true,
    task: null,
    taskId: null,
    syncStatus: 'pending_sync',
    notionPageId: null,
  }
}

describe('computeStats', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    storeMock.sessions = []
  })
  afterEach(() => vi.useRealTimers())

  it('counts only completed focus sessions dated today', () => {
    vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'))
    storeMock.sessions = [
      record('2026-06-16T09:00:00.000Z', { durationMs: 25 * 60_000 }), // counts
      record('2026-06-16T10:00:00.000Z', { durationMs: 24 * 60_000 }), // counts
      record('2026-06-16T11:00:00.000Z', { completed: false }), // not completed
      record('2026-06-16T08:00:00.000Z', { type: 'shortBreak' }), // not focus
      record('2026-06-15T09:00:00.000Z'), // not today
    ]
    const stats = computeStats()
    expect(stats.pomodorosToday).toBe(2)
    expect(stats.focusMsToday).toBe(49 * 60_000)
  })

  it('reports zeroes when there are no qualifying sessions', () => {
    vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'))
    const stats = computeStats()
    expect(stats.pomodorosToday).toBe(0)
    expect(stats.focusMsToday).toBe(0)
    expect(stats.streak).toBe(0)
    expect(stats.streakAtRisk).toBe(false)
  })
})

describe('computeStreak', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('counts consecutive days up to the first gap (today secured)', () => {
    vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'))
    const streak = computeStreak([
      record('2026-06-16T10:00:00.000Z'),
      record('2026-06-15T10:00:00.000Z'),
      record('2026-06-14T10:00:00.000Z'),
      // gap on the 13th
      record('2026-06-12T10:00:00.000Z'),
    ])
    expect(streak).toEqual({ count: 3, atRisk: false })
  })

  it('carries the streak in from yesterday when today is not done yet (at risk)', () => {
    // It is the third day and no focus session has been logged today, but the
    // run through the previous two days is unbroken — surface it, flagged at risk.
    vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'))
    const streak = computeStreak([
      record('2026-06-15T10:00:00.000Z'),
      record('2026-06-14T10:00:00.000Z'),
    ])
    expect(streak).toEqual({ count: 2, atRisk: true })
  })

  it('treats the day as not yet rolled over before 4am (cutoff on "now")', () => {
    // It is 02:00, so "today" still counts as the previous calendar day.
    vi.setSystemTime(new Date('2026-06-16T02:00:00.000Z'))
    const streak = computeStreak([
      record('2026-06-16T01:00:00.000Z'), // 1am — belongs to the 15th
      record('2026-06-15T10:00:00.000Z'), // also the 15th
      record('2026-06-14T10:00:00.000Z'),
    ])
    expect(streak).toEqual({ count: 2, atRisk: false })
  })

  it('attributes a pre-4am session to the previous day (cutoff on the record)', () => {
    // Daytime now, but the only session was logged at 03:30 — which belongs to the
    // previous day. Today isn't secured yet, so it counts as a 1-day streak at risk.
    vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'))
    const streak = computeStreak([record('2026-06-16T03:30:00.000Z')])
    expect(streak).toEqual({ count: 1, atRisk: true })
  })

  it('ignores non-focus and uncompleted sessions', () => {
    vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'))
    const streak = computeStreak([
      record('2026-06-16T10:00:00.000Z', { type: 'shortBreak' }),
      record('2026-06-16T11:00:00.000Z', { completed: false }),
    ])
    expect(streak).toEqual({ count: 0, atRisk: false })
  })

  it('returns a broken streak when yesterday was also missed', () => {
    // Today not done and yesterday (the 15th) has no session — the run is gone.
    vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'))
    const streak = computeStreak([record('2026-06-14T10:00:00.000Z')])
    expect(streak).toEqual({ count: 0, atRisk: false })
  })

  it('returns 0 for no sessions', () => {
    vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'))
    expect(computeStreak([])).toEqual({ count: 0, atRisk: false })
  })
})
