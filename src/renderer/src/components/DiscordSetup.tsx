import { useState } from 'react'
import { isDiscordWebhook } from '@/shared/validateConfig'
import { SECTION_HEADER, BODY, SECONDARY, LINK, BTN_PRIMARY, TEXT_FIELD } from '../styles'

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
      <button onClick={onComplete} className={`self-start ${LINK}`}>
        ← Back
      </button>
      <h2 className={SECTION_HEADER}>Discord notifications</h2>
      <p className={SECONDARY}>
        Paste a Discord webhook URL to receive a message when each session ends.
      </p>
      <label className={`flex flex-col gap-1 ${BODY}`}>
        Webhook URL
        <input
          type="password"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(null)
          }}
          placeholder="https://discord.com/api/webhooks/…"
          className={TEXT_FIELD}
        />
      </label>
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <button disabled={!isValid} onClick={handleSave} className={BTN_PRIMARY}>
        Save
      </button>
      {currentUrl && (
        <button onClick={handleDisconnect} className="text-[13px] text-danger hover:underline">
          Disconnect
        </button>
      )}
    </div>
  )
}
