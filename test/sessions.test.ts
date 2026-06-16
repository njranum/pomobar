import { describe, expect, it, vi } from 'vitest'

// sessions.ts imports the electron-store wrapper at module-eval; stub it so the
// pure record-building helpers can be exercised without Electron app paths.
vi.mock('@/main/store', () => ({
  default: {
    get: (): unknown => [],
    set: (): void => undefined,
  },
}))

import { buildRecord, sessionToNotionProps } from '@/main/sessions'

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
