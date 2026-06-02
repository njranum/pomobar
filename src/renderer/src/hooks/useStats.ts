import type { DayStats } from '@/shared/types'
import { useEffect, useState } from 'react'

export function useStats(): DayStats | null {
  const [stats, setStats] = useState<DayStats | null>(null)
  //
  useEffect(() => {
    window.api.getStats().then(setStats)
    return window.api.onStats(setStats)
  }, [])
  //
  return stats
}
