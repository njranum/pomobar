// Custom hooks - Need to redo the react.dev for this cause im pretty fuzzy
// Glue together the renderer and the timer running in the main process
// Call this to get the live timer state and the references to the api functions
// that control the timer

import { useState, useEffect } from 'react'
import type { TimerSnapshot } from '@/shared/types'

interface UseTimer {
  snap: TimerSnapshot | null
  prompt: string | null
  startFocus: (task: string) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  cancel: () => Promise<void>
  endEarly: () => Promise<void>
  resolvePrompt: (markComplete: boolean) => void
}

export function useTimer(): UseTimer {
  const [snap, setSnap] = useState<TimerSnapshot | null>(null)
  const [prompt, setPrompt] = useState<string | null>(null)
  //
  useEffect(() => {
    window.api.getSnapshot().then(setSnap)
    const offSnap = window.api.onSnapshot(setSnap)
    const offPrompt = window.api.onPromptMarkComplete(({ task }) => setPrompt(task))
    return () => {
      offSnap()
      offPrompt()
    }
  }, [])
  //
  const resolvePrompt = (markComplete: boolean): void => {
    window.api.resolveComplete(markComplete)
    setPrompt(null)
  }
  //
  return {
    snap,
    prompt,
    startFocus: window.api.startFocus,
    pause: window.api.pause,
    resume: window.api.resume,
    cancel: window.api.cancel,
    endEarly: window.api.endEarly,
    resolvePrompt,
  }
}
