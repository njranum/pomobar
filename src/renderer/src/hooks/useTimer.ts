// Custom hooks - Need to redo the react.dev for this cause im pretty fuzzy
// Glue together the renderer and the timer running in the main process
// Call this to get the live timer state and the references to the api functions
// that control the timer

import { useState, useEffect } from 'react'
import type { TimerSnapshot } from '@/shared/types'

interface UseTimer {
  snap: TimerSnapshot | null
  startFocus: (task: string) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  cancel: () => Promise<void>
  endEarly: () => Promise<void>
}

export function useTimer(): UseTimer {
  const [snap, setSnap] = useState<TimerSnapshot | null>(null)
  useEffect(() => {
    window.api.getSnapshot().then(setSnap)
    return window.api.onSnapshot(setSnap)
  }, [])
  return {
    snap,
    startFocus: window.api.startFocus,
    pause: window.api.pause,
    resume: window.api.resume,
    cancel: window.api.cancel,
    endEarly: window.api.endEarly,
  }
}
