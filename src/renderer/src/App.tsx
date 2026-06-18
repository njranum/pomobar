import { useState, useEffect, useRef } from 'react'
import { useTimer } from './hooks/useTimer'
import { useStats } from './hooks/useStats'
import { validateConfig } from '@/shared/validateConfig'
import type { PomodoroConfig, PickerTask, SessionType } from '@/shared/types'
import SetupWizard from './components/SetupWizard'
import DiscordSetup from './components/DiscordSetup'
import TaskPicker, { type TaskPickerHandle } from './components/TaskPicker'
import {
  SECTION_HEADER,
  BODY,
  SECONDARY,
  LINK,
  BTN_PRIMARY,
  BTN_SUBTLE,
  NUMBER_FIELD,
} from './styles'

const fmtFocus = (ms: number): string => {
  const m = Math.round(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

const fmtClock = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const sessionLabel = (t: SessionType | null): string =>
  t === 'shortBreak'
    ? 'Short break'
    : t === 'longBreak'
      ? 'Long break'
      : t === 'planning'
        ? 'Planning'
        : 'Focus'

// Progress-ring geometry (SVG units)
const RING_R = 74
const RING_C = 2 * Math.PI * RING_R

export default function App(): React.JSX.Element {
  const { snap, startFocus, pause, resume, cancel, endEarly, prompt, resolvePrompt } = useTimer() // live timer state

  const [selectedTask, setSelectedTask] = useState<PickerTask | null>(null)
  const [view, setView] = useState<'main' | 'config' | 'wizard' | 'discord'>('main')
  const [cfg, setCfg] = useState<PomodoroConfig | null>(null)
  const [configured, setConfigured] = useState(true)
  const pickerRef = useRef<TaskPickerHandle>(null)
  const [tasksStale, setTasksStale] = useState(true)

  // Report NATURAL content height so the main process can size the popover to fit.
  // Measure #root (never height-pegged) — using documentElement.scrollHeight would
  // never drop below the viewport, so the window could grow but never shrink.
  useEffect(() => {
    const el = document.getElementById('root')
    if (!el) return
    let raf = 0
    const report = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() =>
        // round UP so a fractional height can't clip into a 1px scrollbar
        window.api.setWindowHeight(Math.ceil(el.getBoundingClientRect().height))
      )
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    window.api.getConfig().then(setCfg)
    window.api.isConfigured().then((ok) => {
      setConfigured(ok)
      if (!ok) setView('wizard')
    })
  }, [])

  // The popover restores focus to the last-focused control when it reopens, leaving
  // a stray focus ring on the cog. Clear focus on open/close so nothing looks
  // selected when the popover appears. (Tab navigation doesn't fire window focus.)
  useEffect(() => {
    const clearFocus = (): void => {
      const el = document.activeElement
      if (el instanceof HTMLElement && el !== document.body) el.blur()
    }
    window.addEventListener('focus', clearFocus)
    window.addEventListener('blur', clearFocus)
    return () => {
      window.removeEventListener('focus', clearFocus)
      window.removeEventListener('blur', clearFocus)
    }
  }, [])

  const canStart =
    selectedTask !== null &&
    (snap?.state === 'idle' || snap?.state === 'shortBreak' || snap?.state === 'longBreak')

  const isActive = snap?.state === 'focus' || snap?.state === 'paused'

  const stats = useStats()

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
        <button onClick={() => setView('main')} className={`self-start ${LINK}`}>
          ← Back
        </button>
        <h2 className={SECTION_HEADER}>Settings</h2>
        {cfg && (
          <div className="flex flex-col gap-1.5">
            <label className={`flex items-center justify-between gap-2 ${BODY}`}>
              Focus (min)
              <input
                type="number"
                value={cfg.focusMinutes}
                onChange={(e) => setCfg({ ...cfg, focusMinutes: Number(e.target.value) })}
                className={NUMBER_FIELD}
              />
            </label>
            <label className={`flex items-center justify-between gap-2 ${BODY}`}>
              Short break (min)
              <input
                type="number"
                value={cfg.shortBreakMinutes}
                onChange={(e) => setCfg({ ...cfg, shortBreakMinutes: Number(e.target.value) })}
                className={NUMBER_FIELD}
              />
            </label>
            <label className={`flex items-center justify-between gap-2 ${BODY}`}>
              Long break (min)
              <input
                type="number"
                value={cfg.longBreakMinutes}
                onChange={(e) => setCfg({ ...cfg, longBreakMinutes: Number(e.target.value) })}
                className={NUMBER_FIELD}
              />
            </label>
            <label className={`flex items-center justify-between gap-2 ${BODY}`}>
              Pomodoros per cycle
              <input
                type="number"
                value={cfg.pomodorosPerCycle}
                onChange={(e) => setCfg({ ...cfg, pomodorosPerCycle: Number(e.target.value) })}
                className={NUMBER_FIELD}
              />
            </label>
            {errors.length > 0 && (
              <ul className="text-[11px] text-danger">
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
              className={BTN_PRIMARY}
            >
              Save
            </button>
            <div className="mt-1 flex flex-col gap-2 border-t border-separator pt-3">
              <div className={`flex items-center justify-between ${BODY}`}>
                <span className="flex items-center gap-1.5">
                  Notion
                  {configured ? (
                    <span className="text-label-secondary">
                      <span className="text-[#30d158]">✓</span> Connected
                    </span>
                  ) : (
                    <span className="text-label-secondary">Not connected</span>
                  )}
                </span>
                <button onClick={() => setView('wizard')} className={`${LINK} hover:underline`}>
                  {configured ? 'Reconnect' : 'Connect'}
                </button>
              </div>
              <div className={`flex items-center justify-between ${BODY}`}>
                <span className="flex items-center gap-1.5">
                  Discord
                  {cfg.discordWebhookUrl ? (
                    <span className="text-label-secondary">
                      <span className="text-[#30d158]">✓</span> Connected
                    </span>
                  ) : (
                    <span className="text-label-secondary">Not connected</span>
                  )}
                </span>
                <button onClick={() => setView('discord')} className={`${LINK} hover:underline`}>
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
    <div className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[13px] font-medium text-label">Pomobar</span>
        <div className="flex items-center gap-3">
          {!isActive && prompt === null && planningMode === 'done' && (
            <button
              onClick={() => pickerRef.current?.refresh()}
              title="Refresh tasks"
              aria-label="Refresh tasks"
              className="rounded text-label-secondary hover:text-label focus-visible:ring-1 focus-visible:ring-accent/40"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                aria-hidden
                className={`fill-current ${tasksStale ? 'animate-spin' : ''}`}
              >
                <path d="M8 3a5 5 0 1 0 4.546 2.914l1.273-.682A6.5 6.5 0 1 1 8 1.5V0l3 2.5L8 5V3z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setView('config')}
            title="Settings"
            aria-label="Settings"
            className="rounded text-label-secondary hover:text-label focus-visible:ring-1 focus-visible:ring-accent/40"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Goals */}
      {planningMode === 'done' &&
        stats &&
        (pomodoroGoal !== null || focusTimeGoalMins !== null) && (
          <>
            <div className="px-4 pb-2">
              {pomodoroGoal !== null && (
                <div className={`flex items-center gap-2 ${SECONDARY}`}>
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
                <div className={`mt-1 flex items-center gap-2 ${SECONDARY}`}>
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
              {stats.streak > 0 && (
                <p className={`mt-0.5 leading-tight ${SECONDARY}`}>
                  🔥 {stats.streak}-day streak
                  {stats.streakAtRisk && <span className="text-danger"> · at risk</span>}
                </p>
              )}
            </div>
            <div className="border-t border-separator" />
          </>
        )}

      {/* Middle content — sizes to content (the task list caps + scrolls itself) */}
      <div className="flex flex-col px-4 py-3">
        {planningMode === 'in_progress' && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-label-secondary">
              Fill in your plan in Notion, then click Complete.
            </p>
            <button onClick={handleCompletePlanning} className={BTN_PRIMARY}>
              Complete planning
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
                  ref={pickerRef}
                  planningMode={planningMode}
                  selected={selectedTask}
                  onSelect={setSelectedTask}
                  onStaleChange={setTasksStale}
                />
              </div>
            )}

            {/* Active session */}
            {isActive && snap && (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                {/* Ring (focal point) */}
                <div className="flex flex-1 flex-col items-center justify-center gap-4">
                  {snap.task && <p className="text-center text-[15px] text-label">{snap.task}</p>}
                  <div className="relative flex items-center justify-center">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      <circle
                        cx="80"
                        cy="80"
                        r={RING_R}
                        strokeWidth="6"
                        className="fill-none stroke-track"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r={RING_R}
                        strokeWidth="6"
                        strokeLinecap="round"
                        className="fill-none stroke-accent"
                        strokeDasharray={RING_C}
                        strokeDashoffset={
                          RING_C *
                          (1 - Math.min(1, Math.max(0, snap.remainingMs / (snap.totalMs || 1))))
                        }
                        transform="rotate(-90 80 80)"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-[30px] font-medium leading-none tabular-nums text-label">
                        {fmtClock(snap.remainingMs)}
                      </span>
                      <span className={`mt-1 ${SECONDARY}`}>
                        {sessionLabel(snap.sessionType)} · {snap.cyclePosition} of{' '}
                        {snap.pomodorosPerCycle}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => (snap.isPause ? resume() : pause())}
                    className={`flex items-center justify-center gap-2 text-label ${BTN_SUBTLE}`}
                  >
                    {snap.isPause ? (
                      'Resume'
                    ) : (
                      <>
                        <svg
                          width="9"
                          height="11"
                          viewBox="0 0 9 11"
                          aria-hidden
                          className="fill-label"
                        >
                          <rect width="3" height="11" rx="1" />
                          <rect x="6" width="3" height="11" rx="1" />
                        </svg>
                        Pause
                      </>
                    )}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => cancel()} className={`flex-1 text-danger ${BTN_SUBTLE}`}>
                      Cancel
                    </button>
                    <button
                      onClick={() => endEarly()}
                      className={`flex-1 text-accent ${BTN_SUBTLE}`}
                    >
                      End &amp; complete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mark complete prompt */}
            {prompt !== null && (
              <div className="flex flex-col gap-2">
                <p className={BODY}>Mark &quot;{prompt}&quot; complete?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      resolvePrompt(true)
                      setSelectedTask(null)
                    }}
                    className={`flex-1 text-accent ${BTN_SUBTLE}`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => resolvePrompt(false)}
                    className={`flex-1 text-label-secondary ${BTN_SUBTLE}`}
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
              <button onClick={handlePlanMyDay} className={`w-full ${BTN_PRIMARY}`}>
                Plan my day
              </button>
            ) : (
              <button
                disabled={!canStart}
                onClick={() => {
                  if (selectedTask) startFocus({ id: selectedTask.id, title: selectedTask.title })
                }}
                className={`w-full ${BTN_PRIMARY}`}
              >
                Start session
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
