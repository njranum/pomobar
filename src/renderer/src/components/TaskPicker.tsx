import { useState, useEffect } from 'react'
import type { PickerTask } from '@/shared/types'

interface Props {
  disabled: boolean
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

export default function TaskPicker({ disabled, selected, onSelect }: Props): React.JSX.Element {
  const [tasks, setTasks] = useState<PickerTask[]>([])
  const [stale, setStale] = useState(true)

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

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Select a task</span>
          {stale && <span className="text-xs text-gray-300">↻</span>}
        </div>
        <button
          onClick={handleRefresh}
          disabled={disabled}
          className="text-xs text-blue-600 hover:underline disabled:opacity-40"
        >
          Refresh
        </button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400">
          {stale ? 'Loading tasks…' : 'No tasks scheduled — add one in Notion.'}
        </p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                disabled={disabled}
                onClick={() => onSelect(selected?.id === t.id ? null : t)}
                className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-sm ${
                  selected?.id === t.id
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 hover:border-gray-300'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="truncate">{t.title}</span>
                {t.scheduledDate && (
                  <span
                    className={`shrink-0 text-xs ${
                      selected?.id === t.id
                        ? 'text-white/70'
                        : t.overdue
                          ? 'text-red-500'
                          : 'text-gray-400'
                    }`}
                  >
                    {fmtDate(t.scheduledDate)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
