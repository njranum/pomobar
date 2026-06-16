import { useState, useEffect } from 'react'
import type { PickerTask } from '@/shared/types'

interface Props {
  planningMode: 'idle' | 'in_progress' | 'syncing' | 'done'
  selected: PickerTask | null
  onSelect: (task: PickerTask | null) => void
}

const fmtDate = (iso: string): string => {
  const [, m, d] = iso.split('-')
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[Number(m) - 1]} ${Number(d)}`
}

export default function TaskPicker({ planningMode, selected, onSelect }: Props): React.JSX.Element {
  const [tasks, setTasks] = useState<PickerTask[]>([])
  const [stale, setStale] = useState(true)
  const [planningTasks, setPlanningTasks] = useState<PickerTask[]>([])

  useEffect(() => {
    window.api.getTaskCache().then(setTasks)
    window.api
      .fetchTasks()
      .then((fresh) => {
        setTasks(fresh)
        setStale(false)
      })
      .catch(() => setStale(false))
  }, [])

  useEffect(() => {
    if (planningMode === 'done') {
      window.api.getPlanningTasks().then(setPlanningTasks)
    }
  }, [planningMode])

  const handleRefresh = (): void => {
    setStale(true)
    window.api
      .fetchTasks()
      .then((fresh) => {
        setTasks(fresh)
        setStale(false)
      })
      .catch(() => setStale(false))
  }

  const scheduledTasks = tasks.filter((t) => !t.fromPlanning)
  const isEmpty = planningTasks.length === 0 && scheduledTasks.length === 0

  const taskButton = (t: PickerTask, showDate: boolean): React.JSX.Element => (
    <button
      onClick={() => onSelect(selected?.id === t.id ? null : t)}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] ${
        selected?.id === t.id ? 'bg-accent text-white' : 'text-label hover:bg-fill'
      }`}
    >
      <span className="truncate">{t.title}</span>
      {showDate && t.scheduledDate && (
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            selected?.id === t.id
              ? 'text-white/70'
              : t.overdue
                ? 'text-danger'
                : 'text-label-secondary'
          }`}
        >
          {fmtDate(t.scheduledDate)}
        </span>
      )}
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-label-secondary">Select a task</span>
          {stale && <span className="text-[11px] text-label-tertiary">↻</span>}
        </div>
        <button onClick={handleRefresh} className="text-[11px] text-accent hover:underline">
          Refresh
        </button>
      </div>
      {isEmpty ? (
        <p className="text-[13px] text-label-tertiary">
          {stale ? 'Loading tasks…' : 'No tasks scheduled — add one in Notion.'}
        </p>
      ) : (
        <ul className="flex max-h-72 min-h-0 flex-col gap-0.5 overflow-y-auto">
          {planningTasks.length > 0 && (
            <li className="px-1 pt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-label-tertiary">
              Today&apos;s plan
            </li>
          )}
          {planningTasks.map((t) => (
            <li key={t.id}>{taskButton(t, false)}</li>
          ))}
          {planningTasks.length > 0 && scheduledTasks.length > 0 && (
            <li className="px-1 pt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-label-tertiary">
              Scheduled
            </li>
          )}
          {scheduledTasks.map((t) => (
            <li key={t.id}>{taskButton(t, true)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
