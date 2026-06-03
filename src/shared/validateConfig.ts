import type { PomodoroConfig } from './types'

// discord webhook regex
export const isDiscordWebhook = (u: string): boolean =>
  /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(u.trim())

export function validateConfig(p: Partial<PomodoroConfig>): string[] {
  const errs: string[] = []
  const hook = p.discordWebhookUrl

  for (const k of ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes'] as const) {
    const v = p[k]
    if (v !== undefined && (v < 1 || v > 120)) errs.push(`${k} must be between 1 & 120`)
  }
  if (p.pomodorosPerCycle !== undefined && (p.pomodorosPerCycle < 1 || p.pomodorosPerCycle > 8)) {
    errs.push('pomodorosPerCycle must be between 1 & 8')
  }

  if (hook !== undefined && hook !== null && hook.trim()) {
    if (!isDiscordWebhook(hook)) {
      errs.push('Discord webhook URL is invalid')
    }
  } else {
    errs.push('Discord webhook URL must be set')
  }
  return errs
}
