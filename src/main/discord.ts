import store from './store'
import timer from './timer'

export function registerDiscord(): void {
  // focus complete, break starting
  timer.onSessionEnded((e) => {
    if (e.type === 'focus' && e.completed) {
      sendDiscord('Focus done - break time')
    }
  })
  // break crosses 20% remaining
  timer.onNearComplete(({ type, remainingMs }) => {
    if (type !== 'focus') {
      sendDiscord(`Break almost over - ~${Math.round(remainingMs / 60000)}m left`)
    }
  })
  // break finished
  timer.onNaturalComplete(({ type }) => {
    if (type !== 'focus') {
      sendDiscord('Break over - back to focus')
    }
  })
}

export function sendDiscord(content: string): void {
  const url = store.get('config').discordWebhookUrl
  if (!url) return // don't error

  const attempt = (tries: number): void => {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
      .then((r) => {
        if (!r.ok && tries < 3) setTimeout(() => attempt(tries + 1), 2000 * tries)
      })
      .catch(() => {
        if (tries < 3) setTimeout(() => attempt(tries + 1), 2000 * tries)
      })
  }
  attempt(1)
}
