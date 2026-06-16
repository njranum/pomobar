import { Notification } from 'electron'
import timer from './timer'
import type { SessionType } from '@/shared/types'

const label = (t: SessionType): string =>
  t === 'focus' ? 'Focus' : t === 'shortBreak' ? 'Short break' : 'Long break'

const notify = (title: string, body: string): void => {
  if (Notification.isSupported()) new Notification({ title, body }).show()
}

const remaining = (ms: number): string => {
  const mins = Math.round(ms / 60000)
  return mins >= 1 ? `${mins} min remaining` : `${Math.round(ms / 1000)}s remaining`
}

export function registerNotifications(): void {
  timer.onNaturalComplete(({ type }) => {
    notify(
      `${label(type)} complete`,
      type === 'focus' ? 'Time for a break.' : 'Break over — back to focus.'
    )
  })
  timer.onNearComplete(({ type, remainingMs }) => {
    notify(`${label(type)} almost done`, remaining(remainingMs))
  })
}
