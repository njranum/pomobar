import { useState } from 'react'
import { SECTION_HEADER, BODY, SECONDARY, LINK, BTN_PRIMARY, TEXT_FIELD } from '../styles'

interface Props {
  onComplete: () => void
  onCancel?: () => void
}

type Status = 'idle' | 'validating' | 'error'

export default function SetupWizard({ onComplete, onCancel }: Props): React.JSX.Element {
  const [secret, setSecret] = useState('')
  const [tasksUrl, setTasksUrl] = useState('')
  const [sessionsUrl, setSessionsUrl] = useState('')
  const [planningUrl, setPlanningUrl] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    secret.trim() && tasksUrl.trim() && sessionsUrl.trim() && status !== 'validating'

  const handleSubmit = async (): Promise<void> => {
    setStatus('validating')
    setError(null)
    const result = await window.api.notionValidate(secret.trim(), tasksUrl.trim())
    if (!result.ok) {
      setStatus('error')
      setError(result.error ?? 'Validation failed — check your secret and that the DB is shared.')
      return
    }
    await window.api.notionSetup({
      secret: secret.trim(),
      tasksDbId: tasksUrl.trim(),
      sessionsDbId: sessionsUrl.trim(),
    })
    if (planningUrl.trim()) {
      await window.api.setPlanningDb(planningUrl.trim())
    }
    onComplete()
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {onCancel && (
        <button onClick={onCancel} className={`self-start ${LINK}`}>
          ← Back
        </button>
      )}
      <h2 className={SECTION_HEADER}>Connect Notion</h2>
      <p className={SECONDARY}>
        Create an internal integration at{' '}
        <span className="font-mono">notion.so/my-integrations</span>, share{' '}
        <span className="font-mono">DB Focus Tasks</span> and{' '}
        <span className="font-mono">DB Pomodoro Sessions</span> with it, then paste the details
        below.
      </p>
      <label className={`flex flex-col gap-1 ${BODY}`}>
        Integration secret
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ntn_…"
          className={TEXT_FIELD}
        />
      </label>
      <label className={`flex flex-col gap-1 ${BODY}`}>
        DB Focus Tasks — URL or ID
        <input
          type="text"
          value={tasksUrl}
          onChange={(e) => setTasksUrl(e.target.value)}
          placeholder="https://notion.so/… or 32-char ID"
          className={TEXT_FIELD}
        />
      </label>
      <label className={`flex flex-col gap-1 ${BODY}`}>
        DB Pomodoro Sessions — URL or ID
        <input
          type="text"
          value={sessionsUrl}
          onChange={(e) => setSessionsUrl(e.target.value)}
          placeholder="https://notion.so/… or 32-char ID"
          className={TEXT_FIELD}
        />
      </label>
      <label className={`flex flex-col gap-1 ${BODY}`}>
        DB Planning — URL or ID (optional)
        <input
          type="text"
          value={planningUrl}
          onChange={(e) => setPlanningUrl(e.target.value)}
          placeholder="https://notion.so/… or 32-char ID"
          className={TEXT_FIELD}
        />
      </label>
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <button disabled={!canSubmit} onClick={handleSubmit} className={BTN_PRIMARY}>
        {status === 'validating' ? 'Validating…' : 'Validate & save'}
      </button>
    </div>
  )
}
