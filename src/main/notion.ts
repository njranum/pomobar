import { Client } from '@notionhq/client'
import type { DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints/databases'
import type {
  CreatePageParameters,
  UpdatePageParameters,
} from '@notionhq/client/build/src/api-endpoints/pages'
import store from './store'
import type { PickerTask } from '@/shared/types'

let client: Client | null = null

export function getNotion(): Client | null {
  const auth = store.get('notionSecret')
  if (!auth) return null
  if (!client) client = new Client({ auth })
  return client
}

export function resetNotion(): void {
  client = null
}

export async function resolveDataSourceId(c: Client, pageId: string): Promise<string> {
  const db = await c.databases.retrieve({ database_id: pageId })
  if (db.object === 'database' && 'data_sources' in db) {
    const full = db as DatabaseObjectResponse
    if (full.data_sources.length > 0) return full.data_sources[0].id
  }
  return pageId
}

export function extractNotionId(input: string): string {
  const s = input.trim()
  const uuid = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (uuid) return uuid[0]
  const hex = s.match(/[0-9a-f]{32}/i)
  if (hex) return hex[0]
  return s
}

export async function fetchScheduledTasks(): Promise<PickerTask[]> {
  const c = getNotion()
  if (!c) return []
  const dbId = store.get('notionTargets').tasksDbId
  if (!dbId) return []
  const today = new Date().toISOString().slice(0, 10)
  const res = await c.dataSources.query({
    data_source_id: dbId,
    filter: {
      and: [
        { property: 'Status', select: { does_not_equal: 'Done' } },
        { property: 'Status', select: { does_not_equal: 'Abandoned' } },
        {
          or: [
            { property: 'Scheduled Date', date: { on_or_before: today } },
            { property: 'Scheduled Date', date: { is_empty: true } },
          ],
        },
      ],
    },
  })
  return res.results.flatMap((page) => {
    if (page.object !== 'page' || !('properties' in page)) return []
    const nameProp = page.properties['Name']
    const dateProp = page.properties['Scheduled Date']
    const title = nameProp?.type === 'title' ? nameProp.title.map((t) => t.plain_text).join('') : ''
    if (!title) return []
    const scheduledDate = dateProp?.type === 'date' ? (dateProp.date?.start ?? null) : null
    return [
      {
        id: page.id,
        title,
        scheduledDate,
        overdue: scheduledDate !== null && scheduledDate < today,
      },
    ]
  })
}

export function markTaskDone(taskId: string): void {
  const c = getNotion()
  if (!c) return
  const props: UpdatePageParameters['properties'] = {
    Status: { select: { name: 'Done' } },
    'Completed Date': { date: { start: new Date().toISOString().slice(0, 10) } },
  }
  c.pages.update({ page_id: taskId, properties: props }).catch(() => {
    /* best-effort */
  })
}

export async function resolvePlanningCollectionId(): Promise<string> {
  const c = getNotion()
  if (!c) throw new Error('Notion not configured')
  const planningDbId = store.get('planningDbId')
  if (!planningDbId) throw new Error('Planning DB not configured')
  return resolveDataSourceId(c, planningDbId)
}

function formatPlanningDate(iso: string): string {
  const [y, m, d] = iso.split('-')
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
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`
}

export async function createOrFetchTodayPlanningRow(effectiveDateStr: string): Promise<string> {
  const c = getNotion()
  if (!c) throw new Error('Notion not configured')
  const collectionId = await resolvePlanningCollectionId()
  const planningDbId = store.get('planningDbId') as string
  const todayName = `Planning — ${formatPlanningDate(effectiveDateStr)}`

  const results = await c.dataSources.query({ data_source_id: collectionId })
  const existing = results.results.find((page) => {
    if (page.object !== 'page' || !('properties' in page)) return false
    const nameProp = page.properties['Name']
    return nameProp?.type === 'title' && nameProp.title[0]?.plain_text === todayName
  })
  if (existing) return existing.id

  const page = await c.pages.create({
    parent: { database_id: planningDbId },
    properties: {
      Name: { title: [{ text: { content: todayName } }] },
      Date: { date: { start: effectiveDateStr } },
    } as NonNullable<CreatePageParameters['properties']>,
  })
  return page.id
}

export async function writePomodoroGoal(rowId: string, pomodoroGoal: number): Promise<void> {
  const c = getNotion()
  if (!c) throw new Error('Notion not configured')
  const props: UpdatePageParameters['properties'] = {
    'Pomodoro Goal': { number: pomodoroGoal },
  }
  await c.pages.update({ page_id: rowId, properties: props })
}

export async function fetchPlanningTasks(rowId: string): Promise<PickerTask[]> {
  const c = getNotion()
  if (!c) throw new Error('Notion not configured')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = (await (c.pages as any).retrieve({ page_id: rowId })) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = page.properties as Record<string, any>
  const relations: Array<{ id: string }> = props['Tasks to Complete']?.relation ?? []
  const entries = await Promise.all(
    relations.map(async ({ id }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = (await (c.pages as any).retrieve({ page_id: id })) as any
      const title: string = t.properties?.Name?.title?.[0]?.plain_text ?? 'Untitled'
      const status: string | null = t.properties?.Status?.select?.name ?? null
      return {
        task: { id, title, scheduledDate: null, overdue: false, fromPlanning: true },
        status,
      }
    })
  )
  return entries.filter((e) => e.status !== 'Done' && e.status !== 'Abandoned').map((e) => e.task)
}

export async function readPlanningGoals(
  rowId: string
): Promise<{ focusTimeGoalMins: number | null; pomodoroGoal: number | null }> {
  const c = getNotion()
  if (!c) throw new Error('Notion not configured')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = (await (c.pages as any).retrieve({ page_id: rowId })) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = page.properties as Record<string, any>
  return {
    focusTimeGoalMins: props['Focus Time Goal']?.number ?? null,
    pomodoroGoal: props['Pomodoro Goal']?.number ?? null,
  }
}

export async function validateNotionSecret(
  secret: string,
  tasksDbId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const c = new Client({ auth: secret })
    await c.databases.retrieve({ database_id: tasksDbId })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
