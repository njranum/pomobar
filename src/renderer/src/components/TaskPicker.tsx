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
      className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-sm ${
        selected?.id === t.id
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <span className="truncate">{t.title}</span>
      {showDate && t.scheduledDate && (
        <span
          className={`shrink-0 text-xs ${
            selected?.id === t.id ? 'text-white/70' : t.overdue ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          {fmtDate(t.scheduledDate)}
        </span>
      )}
    </button>
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Select a task</span>
          {stale && <span className="text-xs text-gray-300">↻</span>}
        </div>
        <button onClick={handleRefresh} className="text-xs text-blue-600 hover:underline">
          Refresh
        </button>
      </div>
      {isEmpty ? (
        <p className="text-sm text-gray-400">
          {stale ? 'Loading tasks…' : 'No tasks scheduled — add one in Notion.'}
        </p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {planningTasks.length > 0 && (
            <li className="px-1 pt-1 text-xs font-medium text-gray-400">Today&apos;s Plan</li>
          )}
          {planningTasks.map((t) => (
            <li key={t.id}>{taskButton(t, false)}</li>
          ))}
          {planningTasks.length > 0 && scheduledTasks.length > 0 && (
            <li className="px-1 pt-1 text-xs font-medium text-gray-400">Scheduled</li>
          )}
          {scheduledTasks.map((t) => (
            <li key={t.id}>{taskButton(t, true)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
