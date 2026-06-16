import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EndedSession } from '@/main/timer'
import type { SessionType } from '@/shared/types'

// In-memory stand-in for the electron-store wrapper. `vi.hoisted` runs before
// the imports, so the factory below can safely close over it. Tests mutate
// `storeMock.config` to exercise different durations and cycle lengths.
const storeMock = vi.hoisted(() => ({
  config: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    pomodorosPerCycle: 4,
    discordWebhookUrl: null as string | null,
  },
}))

vi.mock('@/main/store', () => ({
  default: {
    get: (key: string): unknown => (key === 'config' ? storeMock.config : null),
    set: (): void => undefined,
  },
}))

// timer exports a singleton created at module-eval, with a setInterval bound at
// construction. Reset modules per test so each gets a fresh, isolated machine,
// and enable fake timers first so the interval is captured by the fake clock.
type TimerModule = typeof import('@/main/timer')
let timer: TimerModule['default']

const MINUTE = 60_000

async function freshTimer(): Promise<void> {
  vi.resetModules()
  const mod = await import('@/main/timer')
  timer = mod.default
}

beforeEach(async () => {
  vi.useFakeTimers()
  storeMock.config = {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    pomodorosPerCycle: 4,
    discordWebhookUrl: null,
  }
  await freshTimer()
})

afterEach(() => {
  timer.dispose()
  vi.useRealTimers()
})

describe('initial state', () => {
  it('starts idle with cycle position 1 and no active session', () => {
    const snap = timer.getSnapshot()
    expect(snap.state).toBe('idle')
    expect(snap.sessionType).toBeNull()
    expect(snap.cyclePosition).toBe(1)
    expect(snap.remainingMs).toBe(0)
    expect(snap.totalMs).toBe(0)
    expect(snap.task).toBeNull()
    expect(snap.isPause).toBe(false)
    expect(timer.isSessionActive()).toBe(false)
  })
})

describe('start / pause / resume / cancel', () => {
  it('startFocus enters the focus state with the configured duration and task', () => {
    timer.startFocus({ id: 'abc', title: 'Write tests' })
    const snap = timer.getSnapshot()
    expect(snap.state).toBe('focus')
    expect(snap.sessionType).toBe('focus')
    expect(snap.task).toBe('Write tests')
    expect(snap.totalMs).toBe(25 * MINUTE)
    expect(snap.remainingMs).toBe(25 * MINUTE)
    expect(snap.cyclePosition).toBe(1)
    expect(timer.isSessionActive()).toBe(true)
  })

  it('ignores startFocus while already focusing', () => {
    timer.startFocus({ id: null, title: 'First' })
    timer.startFocus({ id: null, title: 'Second' })
    expect(timer.getSnapshot().task).toBe('First')
  })

  it('pause freezes the clock and flags the pause; resume continues it', () => {
    timer.startFocus({ id: null, title: 'Focus' })
    vi.advanceTimersByTime(MINUTE)
    timer.pause()

    const paused = timer.getSnapshot()
    expect(paused.state).toBe('paused')
    expect(paused.isPause).toBe(true)
    expect(paused.remainingMs).toBe(24 * MINUTE)

    // Time spent while paused must not advance the clock.
    vi.advanceTimersByTime(5 * MINUTE)
    expect(timer.getSnapshot().remainingMs).toBe(24 * MINUTE)

    timer.resume()
    expect(timer.getSnapshot().state).toBe('focus')
    vi.advanceTimersByTime(MINUTE)
    expect(timer.getSnapshot().remainingMs).toBe(23 * MINUTE)
  })

  it('pause is illegal from idle and leaves the state unchanged', () => {
    timer.pause()
    expect(timer.getSnapshot().state).toBe('idle')
  })

  it('cancel ends the session as not completed and returns to idle', () => {
    const ended: EndedSession[] = []
    timer.onSessionEnded((e) => ended.push(e))

    timer.startFocus({ id: 'x', title: 'Focus' })
    vi.advanceTimersByTime(MINUTE)
    timer.cancel()

    expect(ended).toHaveLength(1)
    expect(ended[0].completed).toBe(false)
    expect(timer.getSnapshot().state).toBe('idle')
    expect(timer.isSessionActive()).toBe(false)
  })
})

describe('elapsed time accounting', () => {
  it('records actual elapsed time, excluding paused time, on the ended session', () => {
    const ended: EndedSession[] = []
    timer.onSessionEnded((e) => ended.push(e))

    timer.startFocus({ id: null, title: 'Focus' })
    vi.advanceTimersByTime(MINUTE) // 1 min running
    timer.pause()
    vi.advanceTimersByTime(2 * MINUTE) // 2 min paused — must not count
    timer.resume()
    vi.advanceTimersByTime(MINUTE) // 1 min running
    timer.endEarly()

    // The first ended session is the focus session ended by endEarly.
    expect(ended[0].type).toBe('focus')
    expect(ended[0].durationMs).toBe(2 * MINUTE)
    expect(ended[0].completed).toBe(true)
  })

  it('records the elapsed duration on natural completion, not the configured one', () => {
    storeMock.config.focusMinutes = 1
    const ended: EndedSession[] = []
    timer.onSessionEnded((e) => ended.push(e))

    timer.startFocus({ id: null, title: 'Focus' })
    vi.advanceTimersByTime(1 * MINUTE)

    const focusEnded = ended.find((e) => e.type === 'focus')
    expect(focusEnded?.completed).toBe(true)
    expect(focusEnded?.durationMs).toBeGreaterThanOrEqual(1 * MINUTE)
    // Allow for the 250ms tick granularity overshoot, but stay near 1 minute.
    expect(focusEnded?.durationMs).toBeLessThan(1 * MINUTE + 1_000)
  })
})

describe('20%-remaining warning', () => {
  it('fires exactly once when remaining time crosses the 20% threshold', () => {
    storeMock.config.focusMinutes = 1 // total 60s, warn at 80% elapsed (48s)
    const warnings: { type: SessionType; remainingMs: number }[] = []
    timer.onNearComplete((info) => warnings.push(info))

    timer.startFocus({ id: null, title: 'Focus' })

    vi.advanceTimersByTime(47_000)
    expect(warnings).toHaveLength(0)

    vi.advanceTimersByTime(3_000) // now at 50s, past the 48s threshold
    expect(warnings).toHaveLength(1)
    expect(warnings[0].type).toBe('focus')
    expect(warnings[0].remainingMs).toBeLessThanOrEqual(12_000)

    vi.advanceTimersByTime(5_000) // still running, must not fire again
    expect(warnings).toHaveLength(1)
  })
})

describe('focus -> break -> focus transitions and completion semantics', () => {
  it('transitions to a short break on natural completion and emits naturalComplete', () => {
    storeMock.config.focusMinutes = 1
    const natural: { type: SessionType; task: string | null }[] = []
    timer.onNaturalComplete((info) => natural.push(info))

    timer.startFocus({ id: null, title: 'Focus' })
    vi.advanceTimersByTime(1 * MINUTE)

    expect(natural[0].type).toBe('focus')
    const snap = timer.getSnapshot()
    expect(snap.state).toBe('shortBreak')
    expect(snap.sessionType).toBe('shortBreak')
    expect(snap.task).toBeNull()
  })

  it('treats endEarly as a completed focus that flows into a break', () => {
    timer.startFocus({ id: null, title: 'Focus' })
    vi.advanceTimersByTime(MINUTE)
    timer.endEarly()
    expect(timer.getSnapshot().state).toBe('shortBreak')
  })
})

describe('cycle counting', () => {
  // Drive a focus session to natural completion with a 1-minute config.
  const completeFocus = (): void => {
    timer.startFocus({ id: null, title: 'Focus' })
    vi.advanceTimersByTime(1 * MINUTE)
  }

  beforeEach(() => {
    storeMock.config.focusMinutes = 1
    storeMock.config.shortBreakMinutes = 1
    storeMock.config.longBreakMinutes = 1
    storeMock.config.pomodorosPerCycle = 4
  })

  it('shows position 1 on the first focus and increments through the cycle', () => {
    // 1st focus shows position 1.
    timer.startFocus({ id: null, title: 'Focus' })
    expect(timer.getSnapshot().cyclePosition).toBe(1)
    vi.advanceTimersByTime(1 * MINUTE) // -> short break, position now 2

    // 2nd focus (cutting the break short) shows position 2.
    timer.startFocus({ id: null, title: 'Focus' })
    expect(timer.getSnapshot().cyclePosition).toBe(2)
  })

  it('records the focus cycleNumber before it is incremented', () => {
    const ended: EndedSession[] = []
    timer.onSessionEnded((e) => ended.push(e))
    completeFocus()
    const focusEnded = ended.find((e) => e.type === 'focus')
    expect(focusEnded?.cycleNumber).toBe(1)
  })

  it('runs a long break after the configured pomodoros, holding position at 4 (deferred increment)', () => {
    // pomodoros 1..3 each flow into a short break, advancing position.
    completeFocus() // pos -> 2, short break
    timer.startFocus({ id: null, title: 'Focus' })
    completeFocusInPlace()
    timer.startFocus({ id: null, title: 'Focus' })
    completeFocusInPlace()

    // 4th focus shows position 4, not 5.
    timer.startFocus({ id: null, title: 'Focus' })
    expect(timer.getSnapshot().cyclePosition).toBe(4)

    // Completing the 4th focus opens a long break; position stays at 4 (the
    // increment is deliberately deferred to avoid ever showing "5 of 4").
    vi.advanceTimersByTime(1 * MINUTE)
    const onLongBreak = timer.getSnapshot()
    expect(onLongBreak.sessionType).toBe('longBreak')
    expect(onLongBreak.cyclePosition).toBe(4)

    // Completing the long break resets the position to 1 and returns to idle.
    vi.advanceTimersByTime(1 * MINUTE)
    const afterLong = timer.getSnapshot()
    expect(afterLong.state).toBe('idle')
    expect(afterLong.cyclePosition).toBe(1)
  })

  // Helper used above: advance one minute to finish the in-progress focus.
  function completeFocusInPlace(): void {
    vi.advanceTimersByTime(1 * MINUTE)
  }
})
