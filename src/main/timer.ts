import { EventEmitter } from 'node:events'
import store from './store'
import type { AppState, SessionType, TaskRef, TimerSnapshot } from '@/shared/types'

interface ActiveSession {
  type: SessionType
  totalMs: number // capture only once at the start
  startedAt: number // running segment start (reset on resume)
  sessionStart: number // wall-clock start time never rewritten
  accumulatedMs: number
  task: string | null // focus = task title, breaks = null
}

export interface EndedSession {
  type: SessionType
  task: string | null
  startedAt: number
  endedAt: number
  durationMs: number
  completed: boolean // true = ran to zero or ended manually, false = cancelled
  cycleNumber: number
}

class Timer extends EventEmitter {
  private state: AppState = 'idle'
  private session: ActiveSession | null = null
  private cyclePosition = 1
  private readonly interval: NodeJS.Timeout

  constructor() {
    super()
    this.interval = setInterval(() => this.tick(), 250)
  }

  dispose(): void {
    clearInterval(this.interval)
  }

  startFocus(task: TaskRef): void {
    if (!this.isOneOf('idle', 'shortBreak', 'longBreak')) {
      return this.reject('startFocus', this.state)
    }
    // a running break cut short by a focus must be logged
    if (this.session && this.isOneOf('shortBreak', 'longBreak')) {
      const wasLong = this.session.type === 'longBreak'
      this.endSession(true)
      if (wasLong) this.cyclePosition = 1
    }

    // dev aid: trace focus starts while testing
    console.info(`[timer] startFocus — task="${task.title}" cyclePosition=${this.cyclePosition}`)
    const { focusMinutes } = store.get('config')
    this.begin('focus', focusMinutes, task.title)
    this.state = 'focus'
    this.emitSnapshot()
  }

  pause(): void {
    if (this.state !== 'focus' || !this.session) return this.reject('pause', this.state)
    // dev aid: trace pauses while testing
    console.info(`[timer] pause — remainingMs=${this.session.totalMs - this.elapsed()}`)
    this.session.accumulatedMs += Date.now() - this.session.startedAt
    this.state = 'paused'
    this.emitSnapshot()
  }

  resume(): void {
    if (this.state !== 'paused' || !this.session) return this.reject('resume', this.state)
    // dev aid: trace resumes while testing
    console.info(`[timer] resume — task="${this.session.task}"`)
    this.session.startedAt = Date.now()
    this.state = 'focus'
    this.emitSnapshot()
  }

  cancel(): void {
    if (!this.isOneOf('focus', 'paused') || !this.session) return this.reject('cancel', this.state)
    // dev aid: trace cancels while testing
    console.info(
      `[timer] cancel — task="${this.session.task}" elapsedMs=${this.elapsed()} (not counted)`
    )
    this.endSession(false) // doesn't count as completed
    this.state = 'idle'
    this.session = null
    this.emitSnapshot()
  }

  endEarly(): void {
    if (!this.isOneOf('focus', 'paused') || !this.session)
      return this.reject('endEarly', this.state)
    // dev aid: trace early completions while testing
    console.info(
      `[timer] endEarly — task="${this.session.task}" cyclePosition=${this.cyclePosition} (counts as complete)`
    )
    this.completeFocus() // end early counts as completed
  }

  getSnapshot(): TimerSnapshot {
    const config = store.get('config')
    return {
      state: this.state,
      sessionType: this.session?.type ?? null,
      remainingMs: this.session ? Math.max(0, this.session.totalMs - this.elapsed()) : 0,
      totalMs: this.session?.totalMs ?? 0,
      cyclePosition: this.cyclePosition,
      pomodorosPerCycle: config.pomodorosPerCycle,
      task: this.session?.task ?? null,
      isPause: this.state === 'paused',
    }
  }

  completeNow(): void {
    if (!this.session) return this.reject('completeNow', this.state)
    this.onSessionComplete()
  }

  onSnapshot(listener: (s: TimerSnapshot) => void): this {
    return this.on('snapshot', listener)
  }
  onSessionEnded(listener: (e: EndedSession) => void): this {
    return this.on('sessionEnded', listener)
  }
  onNaturalComplete(listener: (info: { type: SessionType }) => void): this {
    return this.on('naturalComplete', listener)
  }

  private tick(): void {
    if (!this.session || this.state === 'paused') return
    if (this.elapsed() >= this.session.totalMs) this.onSessionComplete()
    else this.emitSnapshot()
  }

  private onSessionComplete(): void {
    if (!this.session) return
    this.emit('naturalComplete', { type: this.session.type })
    if (this.session.type === 'focus') this.completeFocus()
    else this.completeBreak()
  }

  private completeFocus(): void {
    if (!this.session) return
    const { pomodorosPerCycle, shortBreakMinutes, longBreakMinutes } = store.get('config')
    this.endSession(true)
    if (this.cyclePosition < pomodorosPerCycle) {
      this.cyclePosition += 1
      this.begin('shortBreak', shortBreakMinutes, null)
      this.state = 'shortBreak'
    } else {
      this.begin('longBreak', longBreakMinutes, null)
      this.state = 'longBreak'
    }
    this.emitSnapshot()
  }

  private completeBreak(): void {
    if (!this.session) return
    const wasLong = this.session.type === 'longBreak'
    this.endSession(true)
    if (wasLong) this.cyclePosition = 1
    this.state = 'idle'
    this.session = null
    this.emitSnapshot()
  }

  private begin(type: SessionType, minutes: number, task: string | null): void {
    const now = Date.now()
    this.session = {
      type,
      totalMs: minutes * 60000,
      startedAt: now,
      sessionStart: now,
      accumulatedMs: 0,
      task,
    }
  }

  private endSession(completed: boolean): void {
    if (!this.session) return
    this.emit('sessionEnded', {
      type: this.session.type,
      task: this.session.task,
      startedAt: this.session.sessionStart,
      endedAt: Date.now(),
      durationMs: this.elapsed(),
      completed,
      cycleNumber: this.cyclePosition,
    } satisfies EndedSession)
  }

  private elapsed(): number {
    if (!this.session) return 0
    const running = this.state === 'paused' ? 0 : Date.now() - this.session.startedAt
    return this.session.accumulatedMs + running
  }

  private emitSnapshot(): void {
    this.emit('snapshot', this.getSnapshot())
  }

  private isOneOf(...states: AppState[]): boolean {
    return states.includes(this.state)
  }

  private reject(method: string, from: AppState): void {
    console.warn(`[timer] ${method} is illegal from state "${from}" - ignored`)
  }
}
export const timer = new Timer()
export default timer
