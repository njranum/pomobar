import type { PomodoroConfig } from './types'

export function validateConfig(p: Partial<PomodoroConfig>): string[] {
  const errs: string[] = []
  for (const k of ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes'] as const) {
    const v = p[k]
    if (v !== undefined && (v < 1 || v > 120)) errs.push(`${k} must be between 1 & 120`)
  }
  if (p.pomodorosPerCycle !== undefined && (p.pomodorosPerCycle < 1 || p.pomodorosPerCycle > 8)) {
    errs.push('pomodorosPerCycle must be between 1 & 8')
  }
  return errs
}
