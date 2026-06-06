import { useState } from 'react'
import { isDiscordWebhook } from '@/shared/validateConfig'

interface Props {
  currentUrl: string | null
  onComplete: () => void
}

export default function DiscordSetup({ currentUrl, onComplete }: Props): React.JSX.Element {
  const [url, setUrl] = useState(currentUrl ?? '')
  const [error, setError] = useState<string | null>(null)

  const trimmed = url.trim()
  const isValid = trimmed === '' || isDiscordWebhook(trimmed)

  const handleSave = async (): Promise<void> => {
    if (trimmed && !isDiscordWebhook(trimmed)) {
      setError('Not a valid Discord webhook URL')
      return
    }
    await window.api.setConfig({ discordWebhookUrl: trimmed || null })
    onComplete()
  }

  const handleDisconnect = async (): Promise<void> => {
    await window.api.setConfig({ discordWebhookUrl: null })
    onComplete()
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <button onClick={onComplete} className="self-start text-sm text-blue-600">
        ← Back
      </button>
      <h2 className="text-lg font-semibold">Discord Notifications</h2>
      <p className="text-sm text-gray-600">
        Paste a Discord webhook URL to receive a message when each session ends.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Webhook URL
        <input
          type="password"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(null)
          }}
          placeholder="https://discord.com/api/webhooks/…"
          className="rounded border px-2 py-1"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={!isValid}
        onClick={handleSave}
        className="rounded bg-blue-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save
      </button>
      {currentUrl && (
        <button onClick={handleDisconnect} className="text-sm text-red-600 hover:underline">
          Disconnect
        </button>
      )}
    </div>
  )
}
