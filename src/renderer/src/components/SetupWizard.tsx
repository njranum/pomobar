import { useState } from 'react'

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
        <button onClick={onCancel} className="self-start text-sm text-blue-600">
          ← Back
        </button>
      )}
      <h2 className="text-lg font-semibold">Connect Notion</h2>
      <p className="text-sm text-gray-600">
        Create an internal integration at{' '}
        <span className="font-mono text-xs">notion.so/my-integrations</span>, share{' '}
        <span className="font-mono text-xs">DB Focus Tasks</span> and{' '}
        <span className="font-mono text-xs">DB Pomodoro Sessions</span> with it, then paste the
        details below.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Integration secret
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ntn_…"
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        DB Focus Tasks — URL or ID
        <input
          type="text"
          value={tasksUrl}
          onChange={(e) => setTasksUrl(e.target.value)}
          placeholder="https://notion.so/… or 32-char ID"
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        DB Pomodoro Sessions — URL or ID
        <input
          type="text"
          value={sessionsUrl}
          onChange={(e) => setSessionsUrl(e.target.value)}
          placeholder="https://notion.so/… or 32-char ID"
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        DB Planning — URL or ID (optional)
        <input
          type="text"
          value={planningUrl}
          onChange={(e) => setPlanningUrl(e.target.value)}
          placeholder="https://notion.so/… or 32-char ID"
          className="rounded border px-2 py-1"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="rounded bg-blue-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'validating' ? 'Validating…' : 'Validate & Save'}
      </button>
    </div>
  )
}
