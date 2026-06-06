import { useState, useEffect } from 'react'
import { useTimer } from './hooks/useTimer'
import { useStats } from './hooks/useStats'
import { validateConfig } from '@/shared/validateConfig'
import type { PomodoroConfig, PickerTask } from '@/shared/types'
import SetupWizard from './components/SetupWizard'
import DiscordSetup from './components/DiscordSetup'
import TaskPicker from './components/TaskPicker'

const fmtFocus = (ms: number): string => {
  const m = Math.round(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export default function App(): React.JSX.Element {
  const { snap, startFocus, pause, resume, cancel, endEarly, prompt, resolvePrompt } = useTimer() // live timer state

  const [selectedTask, setSelectedTask] = useState<PickerTask | null>(null)
  const [view, setView] = useState<'main' | 'config' | 'wizard' | 'discord'>('main')
  const [cfg, setCfg] = useState<PomodoroConfig | null>(null)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    window.api.getConfig().then(setCfg)
    window.api.isConfigured().then((ok) => {
      setConfigured(ok)
      if (!ok) setView('wizard')
    })
  }, [])

  const canStart =
    selectedTask !== null &&
    (snap?.state === 'idle' || snap?.state === 'shortBreak' || snap?.state === 'longBreak')

  const isActive = snap?.state === 'focus' || snap?.state === 'paused'

  const stats = useStats()
  const [pendingSync, setPendingSync] = useState(0)
  useEffect(() => {
    window.api.getPendingSync().then(setPendingSync)
  }, [stats])
  // discord setup view
  if (view === 'discord') {
    return (
      <DiscordSetup
        currentUrl={cfg?.discordWebhookUrl ?? null}
        onComplete={() => {
          window.api.getConfig().then(setCfg)
          setView('config')
        }}
      />
    )
  }
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
            {errors.length > 0 && (
              <ul className="text-sm text-red-600">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <button
              disabled={errors.length > 0}
              onClick={() => window.api.setConfig({ ...cfg })}
              className="rounded bg-blue-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
            <div className="mt-1 flex flex-col gap-2 border-t pt-3">
              <div className="flex items-center justify-between">
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Discord {cfg.discordWebhookUrl ? '✓ connected' : '✗ not connected'}
                </span>
                <button
                  onClick={() => setView('discord')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {cfg.discordWebhookUrl ? 'Reconnect' : 'Connect'}
                </button>
              </div>
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
        <div className="flex items-center gap-2">
          {pendingSync > 0 && (
            <span
              className="text-xs text-gray-300"
              title={`${pendingSync} session(s) pending sync`}
            >
              ●
            </span>
          )}
          <button onClick={() => setView('config')} title="Settings" aria-label="Settings">
            ⚙
          </button>
        </div>
      </div>
      {/* Task picker + start */}
      <div className="flex flex-col gap-2">
        <TaskPicker disabled={isActive} selected={selectedTask} onSelect={setSelectedTask} />
        <button
          disabled={!canStart}
          onClick={() => {
            if (selectedTask) startFocus({ id: selectedTask.id, title: selectedTask.title })
          }}
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
                setSelectedTask(null)
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
