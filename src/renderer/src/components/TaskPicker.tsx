import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { PickerTask } from '@/shared/types'
import { SECTION_HEADER, BODY } from '../styles'

export interface TaskPickerHandle {
  refresh: () => void
}

interface Props {
  planningMode: 'idle' | 'in_progress' | 'syncing' | 'done'
  selected: PickerTask | null
  onSelect: (task: PickerTask | null) => void
  onStaleChange?: (stale: boolean) => void
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

const TaskPicker = forwardRef<TaskPickerHandle, Props>(function TaskPicker(
  { planningMode, selected, onSelect, onStaleChange },
  ref
) {
  const [tasks, setTasks] = useState<PickerTask[]>([])
  const [stale, setStale] = useState(true)
  const [planningTasks, setPlanningTasks] = useState<PickerTask[]>([])

  const loadTasks = useCallback((): void => {
    setStale(true)
    onStaleChange?.(true)
    window.api
      .fetchTasks()
      .then((fresh) => {
        setTasks(fresh)
        setStale(false)
        onStaleChange?.(false)
      })
      .catch(() => {
        setStale(false)
        onStaleChange?.(false)
      })
  }, [onStaleChange])

  useEffect(() => {
    window.api.getTaskCache().then(setTasks)
    loadTasks()
  }, [loadTasks])

  useEffect(() => {
    if (planningMode === 'done') {
      window.api.getPlanningTasks().then(setPlanningTasks)
    }
  }, [planningMode])

  useImperativeHandle(ref, () => ({ refresh: loadTasks }), [loadTasks])

  const scheduledTasks = tasks.filter((t) => !t.fromPlanning)
  const isEmpty = planningTasks.length === 0 && scheduledTasks.length === 0

  const taskButton = (t: PickerTask, showDate: boolean): React.JSX.Element => (
    <button
      onClick={() => onSelect(selected?.id === t.id ? null : t)}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left ${BODY} ${
        selected?.id === t.id ? 'bg-accent text-white' : 'hover:bg-fill'
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
      {isEmpty ? (
        <p className="text-[13px] text-label-tertiary">
          {stale ? 'Loading tasks…' : 'No tasks scheduled — add one in Notion.'}
        </p>
      ) : (
        <ul className="scroll-thin flex max-h-[260px] min-h-0 flex-col gap-0.5 overflow-y-auto">
          {planningTasks.length > 0 && (
            <li className={`px-1 pb-1 ${SECTION_HEADER}`}>Today&apos;s plan</li>
          )}
          {planningTasks.map((t) => (
            <li key={t.id}>{taskButton(t, false)}</li>
          ))}
          {planningTasks.length > 0 && scheduledTasks.length > 0 && (
            <li className={`px-1 pb-1 pt-3 ${SECTION_HEADER}`}>Scheduled</li>
          )}
          {scheduledTasks.map((t) => (
            <li key={t.id}>{taskButton(t, true)}</li>
          ))}
        </ul>
      )}
    </div>
  )
})

export default TaskPicker
