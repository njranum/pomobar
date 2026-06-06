import { useState, useEffect } from 'react'
import { useTimer } from './hooks/useTimer'
import { useStats } from './hooks/useStats'
import { validateConfig } from '@/shared/validateConfig'
import type { PomodoroConfig } from '@/shared/types'
import SetupWizard from './components/SetupWizard'

const fmtFocus = (ms: number): string => {
  const m = Math.round(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export default function App(): React.JSX.Element {
  const { snap, startFocus, pause, resume, cancel, endEarly, prompt, resolvePrompt } = useTimer() // live timer state

  const [task, setTask] = useState('') // what we type into the box
  const [view, setView] = useState<'main' | 'config' | 'wizard'>('main')
  const [cfg, setCfg] = useState<PomodoroConfig | null>(null)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    window.api.getConfig().then(setCfg)
    window.api.isConfigured().then((ok) => {
      setConfigured(ok)
      if (!ok) setView('wizard')
    })
  }, [])

  // allow start if task is non-empty and we are in idle / break states
  const canStart =
    task.trim().length > 0 &&
    (snap?.state === 'idle' || snap?.state === 'shortBreak' || snap?.state === 'longBreak')

  const isActive = snap?.state === 'focus' || snap?.state === 'paused'

  const stats = useStats()
  // wizard view
  if (view === 'wizard') {
    return (
      <SetupWizard
        onComplete={() => {
          setConfigured(true)
          setView('main')
        }}
      />
    )
  }
  // config view
  if (view === 'config') {
    const errors = cfg ? validateConfig(cfg) : []
    return (
      <div className="flex flex-col gap-3 p-4">
        <button onClick={() => setView('main')} className="self-start text-sm text-blue-600">
          ← Back
        </button>
        <h2 className="text-lg font-semibold">Settings</h2>
        {cfg && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between gap-2">
              Focus (min)
              <input
                type="number"
                value={cfg.focusMinutes}
                onChange={(e) => setCfg({ ...cfg, focusMinutes: Number(e.target.value) })}
                className="w-20 rounded border px-2 py-1"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              Short break (min)
              <input
                type="number"
                value={cfg.shortBreakMinutes}
                onChange={(e) => setCfg({ ...cfg, shortBreakMinutes: Number(e.target.value) })}
                className="w-20 rounded border px-2 py-1"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              Long break (min)
              <input
                type="number"
                value={cfg.longBreakMinutes}
                onChange={(e) => setCfg({ ...cfg, longBreakMinutes: Number(e.target.value) })}
                className="w-20 rounded border px-2 py-1"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              Pomodoros per cycle
              <input
                type="number"
                value={cfg.pomodorosPerCycle}
                onChange={(e) => setCfg({ ...cfg, pomodorosPerCycle: Number(e.target.value) })}
                className="w-20 rounded border px-2 py-1"
              />
            </label>
            <label className="flex items-center justify-between gap-2">Discord webhook</label>
            <input
              type="password"
              value={cfg.discordWebhookUrl ?? ''}
              onChange={(e) => setCfg({ ...cfg, discordWebhookUrl: e.target.value })}
              placeholder="https://discord.com/api/webhooks/..."
              className="2-40 rounded border px-2 py-1"
            />
            {errors.length > 0 && (
              <ul className="text-sm text-red-600">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <button
              disabled={errors.length > 0}
              onClick={() =>
                window.api.setConfig({
                  ...cfg,
                  discordWebhookUrl: cfg.discordWebhookUrl?.trim()
                    ? cfg.discordWebhookUrl.trim()
                    : null,
                })
              }
              className="rounded bg-blue-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
            <div className="mt-1 flex items-center justify-between border-t pt-3">
              <span className="text-sm text-gray-600">
                Notion {configured ? '✓ connected' : '✗ not connected'}
              </span>
              <button
                onClick={() => setView('wizard')}
                className="text-sm text-blue-600 hover:underline"
              >
                {configured ? 'Reconnect' : 'Connect'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
  // main view
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-2 text-sm text-gray-600">
        <span>
          {stats
            ? `${stats.pomodorosToday} pomodoros | ${fmtFocus(stats.focusMsToday)}`
            : '- pomodoros | -'}
        </span>
        <button onClick={() => setView('config')} title="Settings" aria-label="Settings">
          ⚙
        </button>
      </div>
      {/* Task entry + start */}
      <div className="flex flex-col gap-2">
        <input
          disabled={isActive}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="What are you going to work on?"
          className="rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          disabled={!canStart}
          onClick={() => startFocus(task.trim())}
          className="rounded bg-blue-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start Session
        </button>
      </div>

      {/* Active-session controls, in their own box below */}
      {isActive && (
        <div className="flex gap-2 rounded border border-gray-200 p-3">
          <button
            onClick={() => (snap?.isPause ? resume() : pause())}
            className="flex-1 rounded bg-gray-200 px-3 py-1"
          >
            {snap?.isPause ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => cancel()}
            className="flex-1 rounded bg-red-600 px-3 py-1 text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => endEarly()}
            className="flex-1 rounded bg-green-600 px-3 py-1 text-white"
          >
            End early + complete
          </button>
        </div>
      )}
      {prompt !== null && (
        <div className="flex flex-col gap-2 rounded border border-amber-300 bg-amber-50 p-3">
          <p>Mark “{prompt}” complete?</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                resolvePrompt(true)
                setTask('')
              }}
              className="flex-1 rounded bg-green-600 px-3 py-1 text-white"
            >
              Yes
            </button>
            <button
              onClick={() => resolvePrompt(false)}
              className="flex-1 rounded bg-gray-200 px-3 py-1"
            >
              No
            </button>
          </div>
        </div>
      )}

      <button
        disabled
        title="Available in later version"
        className="rounded bg-gray-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Plan My Day
      </button>
    </div>
  )
}
