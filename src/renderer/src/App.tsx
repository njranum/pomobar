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
    ;(document.activeElement as HTMLElement | null)?.blur()
  }, [])

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

  const [planningMode, setPlanningMode] = useState<'idle' | 'in_progress' | 'syncing' | 'done'>(
    'idle'
  )
  const [focusTimeGoalMins, setFocusTimeGoalMins] = useState<number | null>(null)
  const pomodoroGoal =
    cfg && focusTimeGoalMins !== null ? Math.ceil(focusTimeGoalMins / cfg.focusMinutes) : null

  useEffect(() => {
    window.api.needsPlanning().then(async (needs) => {
      if (!needs) {
        const [goals] = await Promise.all([window.api.getDailyGoals(), window.api.syncPlanning()])
        setFocusTimeGoalMins(goals.focusTimeGoalMins)
        setPlanningMode('done')
      }
    })
  }, [])

  const handleCompletePlanning = async (): Promise<void> => {
    setPlanningMode('syncing')
    await window.api.completePlanning()
    const result = await window.api.syncPlanning()
    setFocusTimeGoalMins(result.focusTimeGoalMins)
    setPlanningMode('done')
  }

  const handlePlanMyDay = async (): Promise<void> => {
    const result = await window.api.startPlanning()
    if (result.ok) {
      setPlanningMode('in_progress')
    } else if (result.reason === 'not_configured') {
      setView('config')
    }
  }

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
        onCancel={configured ? () => setView('config') : undefined}
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
              onClick={() => {
                window.api.setConfig({ ...cfg })
                setView('main')
              }}
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
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[11px] tabular-nums text-label-secondary">
          {stats
            ? `${stats.pomodorosToday} sessions · ${fmtFocus(stats.focusMsToday)}${stats.streak > 0 ? ` · ${stats.streak}-day streak` : ''}`
            : '—'}
        </span>
        <div className="flex items-center gap-2">
          {pendingSync > 0 && (
            <span
              className="text-[11px] text-label-tertiary"
              title={`${pendingSync} session(s) pending sync`}
            >
              ●
            </span>
          )}
          <button
            onClick={() => setView('config')}
            title="Settings"
            aria-label="Settings"
            className="text-label-secondary"
          >
            ⚙
          </button>
        </div>
      </div>
      <div className="mx-4 border-t border-separator" />

      {/* Goals */}
      {planningMode === 'done' &&
        stats &&
        (pomodoroGoal !== null || focusTimeGoalMins !== null) && (
          <>
            <div className="px-4 py-2">
              {pomodoroGoal !== null && (
                <div className="flex items-center gap-2 text-[11px] text-label-secondary">
                  <span className="w-20 shrink-0">Pomodoros</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-track">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${Math.min(100, (stats.pomodorosToday / pomodoroGoal) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="tabular-nums">
                    {stats.pomodorosToday} / {pomodoroGoal}
                  </span>
                </div>
              )}
              {focusTimeGoalMins !== null && (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-label-secondary">
                  <span className="w-20 shrink-0">Focus time</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-track">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${Math.min(100, (stats.focusMsToday / (focusTimeGoalMins * 60_000)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="tabular-nums">
                    {fmtFocus(stats.focusMsToday)} / {focusTimeGoalMins}m
                  </span>
                </div>
              )}
            </div>
            <div className="mx-4 border-t border-separator" />
          </>
        )}

      {/* Scrollable content */}
      <div className="flex flex-1 flex-col overflow-hidden px-4 py-3">
        {planningMode === 'in_progress' && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-label-secondary">
              Fill in your plan in Notion, then click Complete.
            </p>
            <button
              onClick={handleCompletePlanning}
              className="rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-white"
            >
              Complete Planning
            </button>
          </div>
        )}
        {planningMode === 'syncing' && (
          <p className="text-[13px] text-label-secondary">Syncing from Notion…</p>
        )}
        {(planningMode === 'idle' || planningMode === 'done') && (
          <>
            {/* Task picker */}
            {!isActive && prompt === null && planningMode !== 'idle' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <TaskPicker
                  planningMode={planningMode}
                  selected={selectedTask}
                  onSelect={setSelectedTask}
                />
              </div>
            )}

            {/* Active-session controls */}
            {isActive && (
              <div className="flex flex-col gap-2 rounded border border-gray-100 p-3">
                <button
                  onClick={() => (snap?.isPause ? resume() : pause())}
                  className="rounded bg-gray-100 px-3 py-2"
                >
                  {snap?.isPause ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={() => cancel()}
                  className="rounded bg-red-600 px-3 py-2 text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => endEarly()}
                  className="rounded bg-green-600 px-3 py-2 text-white"
                >
                  End early + complete
                </button>
              </div>
            )}

            {/* Mark complete prompt */}
            {prompt !== null && (
              <div className="flex flex-col gap-2 rounded bg-gray-800 p-3 text-white">
                <p>Mark &quot;{prompt}&quot; complete?</p>
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
                    className="flex-1 rounded bg-gray-600 px-3 py-1 text-white"
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {/* Planning needed */}
            {planningMode === 'idle' && !isActive && (
              <p className="text-center text-[11px] text-label-tertiary">
                Plan your day before starting focus tasks.
              </p>
            )}
          </>
        )}
      </div>

      {/* Bottom action */}
      {!isActive && prompt === null && (planningMode === 'idle' || planningMode === 'done') && (
        <>
          <div className="mx-4 border-t border-separator" />
          <div className="px-4 py-3">
            {planningMode === 'idle' ? (
              <button
                onClick={handlePlanMyDay}
                className="w-full rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-white"
              >
                Plan My Day
              </button>
            ) : (
              <button
                disabled={!canStart}
                onClick={() => {
                  if (selectedTask) startFocus({ id: selectedTask.id, title: selectedTask.title })
                }}
                className="w-full rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start Session
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
