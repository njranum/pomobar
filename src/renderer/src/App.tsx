import { useState } from 'react'
import { useTimer } from './hooks/useTimer'
import { useStats } from './hooks/useStats'

const fmtFocus = (ms: number): string => {
  const m = Math.round(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export default function App(): React.JSX.Element {
  const { snap, startFocus, pause, resume, cancel, endEarly, prompt, resolvePrompt } = useTimer() // live timer state
  const [task, setTask] = useState('') // what we type into the box

  // allow start if task is non-empty and we are in idle / break states
  const canStart =
    task.trim().length > 0 &&
    (snap?.state === 'idle' || snap?.state === 'shortBreak' || snap?.state === 'longBreak')

  const isActive = snap?.state === 'focus' || snap?.state === 'paused'

  const stats = useStats()

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="border-b border-gray-200 pb-2 text-sm text-gray-600">
        {stats
          ? `${stats.pomodorosToday} pomodoros | ${fmtFocus(stats.focusMsToday)}`
          : '- pomodoros | -'}
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
