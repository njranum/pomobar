import { describe, expect, it } from 'vitest'
import { isDiscordWebhook, validateConfig } from '@/shared/validateConfig'
import type { PomodoroConfig } from '@/shared/types'

// A syntactically valid webhook so duration/cycle errors can be asserted in
// isolation — validateConfig always requires a webhook to be set.
const WEBHOOK = 'https://discord.com/api/webhooks/123456789/abcDEF-_token'

const withHook = (p: Partial<PomodoroConfig>): Partial<PomodoroConfig> => ({
  discordWebhookUrl: WEBHOOK,
  ...p,
})

describe('isDiscordWebhook', () => {
  it('accepts canonical, canary, ptb and discordapp webhook hosts', () => {
    expect(isDiscordWebhook('https://discord.com/api/webhooks/1/abc')).toBe(true)
    expect(isDiscordWebhook('https://canary.discord.com/api/webhooks/1/abc')).toBe(true)
    expect(isDiscordWebhook('https://ptb.discord.com/api/webhooks/1/abc')).toBe(true)
    expect(isDiscordWebhook('https://discordapp.com/api/webhooks/1/abc')).toBe(true)
  })

  it('rejects non-webhook URLs', () => {
    expect(isDiscordWebhook('https://example.com/api/webhooks/1/abc')).toBe(false)
    expect(isDiscordWebhook('http://discord.com/api/webhooks/1/abc')).toBe(false)
    expect(isDiscordWebhook('https://discord.com/api/webhooks/abc/def')).toBe(false)
    expect(isDiscordWebhook('not a url')).toBe(false)
  })
})

describe('validateConfig duration bounds (1–120)', () => {
  for (const k of ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes'] as const) {
    it(`accepts the valid edges for ${k}`, () => {
      expect(validateConfig(withHook({ [k]: 1 }))).toEqual([])
      expect(validateConfig(withHook({ [k]: 120 }))).toEqual([])
    })

    it(`rejects just-out-of-range values for ${k}`, () => {
      expect(validateConfig(withHook({ [k]: 0 }))).toContain(`${k} must be between 1 & 120`)
      expect(validateConfig(withHook({ [k]: 121 }))).toContain(`${k} must be between 1 & 120`)
    })

    it(`rejects far-out-of-range values for ${k}`, () => {
      expect(validateConfig(withHook({ [k]: -5 }))).toContain(`${k} must be between 1 & 120`)
      expect(validateConfig(withHook({ [k]: 1000 }))).toContain(`${k} must be between 1 & 120`)
    })
  }
})

describe('validateConfig pomodorosPerCycle bounds (1–8)', () => {
  it('accepts the valid edges', () => {
    expect(validateConfig(withHook({ pomodorosPerCycle: 1 }))).toEqual([])
    expect(validateConfig(withHook({ pomodorosPerCycle: 8 }))).toEqual([])
  })

  it('rejects just-out-of-range and far-out-of-range values', () => {
    const msg = 'pomodorosPerCycle must be between 1 & 8'
    expect(validateConfig(withHook({ pomodorosPerCycle: 0 }))).toContain(msg)
    expect(validateConfig(withHook({ pomodorosPerCycle: 9 }))).toContain(msg)
    expect(validateConfig(withHook({ pomodorosPerCycle: 100 }))).toContain(msg)
  })
})

describe('validateConfig webhook requirement', () => {
  it('requires a webhook to be set', () => {
    const msg = 'Discord webhook URL must be set'
    expect(validateConfig({})).toContain(msg)
    expect(validateConfig({ discordWebhookUrl: null })).toContain(msg)
    expect(validateConfig({ discordWebhookUrl: '   ' })).toContain(msg)
  })

  it('flags a malformed webhook', () => {
    expect(validateConfig({ discordWebhookUrl: 'https://example.com/x' })).toContain(
      'Discord webhook URL is invalid'
    )
  })

  it('omitted duration fields produce no bound errors', () => {
    expect(validateConfig(withHook({}))).toEqual([])
  })
})
