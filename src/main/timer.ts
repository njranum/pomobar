import { EventEmitter } from 'node:events'
import store from './store'
import type { AppState, SessionType, TaskRef, TimerSnapshot } from '@/shared/types'

interface ActiveSession {
  type: SessionType
  totalMs: number // capture only once at the start
  startedAt: number
  accumulatedMs: number
  task: string | null // focus = task title, breaks = null
}

export interface EndedSession {
  type: SessionType
  task: string | null
  totalMs: number
  elapsedMs: number
  completed: boolean // true = ran to zero or ended manually, false = cancelled
  cyclePosition: number
}

class Timer extends EventEmitter {
  private state: AppState = 'idle'
  private session: ActiveSession | null = null
  private completedInCycle = 0
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
    const { focusMinutes } = store.get('config')
    this.begin('focus', focusMinutes, task.title)
    this.state = 'focus'
    this.emitSnapshot()
  }

  pause(): void {
    if (this.state !== 'focus' || !this.session) return this.reject('pause', this.state)
    this.session.accumulatedMs += Date.now() - this.session.startedAt
    this.state = 'paused'
    this.emitSnapshot()
  }

  resume(): void {
    if (this.state !== 'paused' || !this.session) return this.reject('resume', this.state)
    this.session.startedAt = Date.now()
    this.state = 'focus'
    this.emitSnapshot()
  }

  cancel(): void {
    if (!this.isOneOf('focus', 'paused') || !this.session) return this.reject('cancel', this.state)
    this.endSession(false) // doesn't count as completed
    this.state = 'idle'
    this.session = null
    this.emitSnapshot()
  }

  endEarly(): void {
    if (!this.isOneOf('focus', 'paused') || !this.session)
      return this.reject('endEarly', this.state)
    this.completeFocus() // end early counts as completed
  }

  getSnapshot(): TimerSnapshot {
    const config = store.get('config')
    return {
      state: this.state,
      sessionType: this.session?.type ?? null,
      remainingMs: this.session ? Math.max(0, this.session.totalMs - this.elapsed()) : 0,
      totalMs: this.session?.totalMs ?? 0,
      cyclePosition: this.completedInCycle,
      pomodorosPerCycle: config.pomodorosPerCycle,
      task: this.session?.task ?? null,
      isPause: this.state === 'paused',
    }
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
    this.endSession(true)
    this.completedInCycle += 1
    const { pomodorosPerCycle, shortBreakMinutes, longBreakMinutes } = store.get('config')
    if (this.completedInCycle >= pomodorosPerCycle) {
      this.begin('longBreak', longBreakMinutes, null)
      this.state = 'longBreak'
    } else {
      this.begin('shortBreak', shortBreakMinutes, null)
      this.state = 'shortBreak'
    }
    this.emitSnapshot()
  }

  private completeBreak(): void {
    if (!this.session) return
    const wasLong = this.session.type === 'longBreak'
    this.endSession(true)
    if (wasLong) this.completedInCycle = 0
    this.state = 'idle'
    this.session = null
    this.emitSnapshot()
  }

  private begin(type: SessionType, minutes: number, task: string | null): void {
    this.session = { type, totalMs: minutes * 60000, startedAt: Date.now(), accumulatedMs: 0, task }
  }

  private endSession(completed: boolean): void {
    if (!this.session) return
    this.emit('sessionEnded', {
      type: this.session.type,
      task: this.session.task,
      totalMs: this.session.totalMs,
      elapsedMs: this.elapsed(),
      completed,
      cyclePosition: this.completedInCycle,
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
