import { useState } from 'react'
import { useTimer } from './hooks/useTimer'

export default function App(): React.JSX.Element {
  const { snap, startFocus, pause, resume, cancel, endEarly } = useTimer() // live timer state
  const [task, setTask] = useState('') // what we type into the box

  // allow start if task is non-empty and we are in idle / break states
  const canStart =
    task.trim().length > 0 &&
    (snap?.state === 'idle' || snap?.state === 'shortBreak' || snap?.state === 'longBreak')

  const isActive = snap?.state === 'focus' || snap?.state === 'paused'

  return (
    <div className="flex flex-col gap-3 p-4">
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
