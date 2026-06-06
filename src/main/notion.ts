import { Client } from '@notionhq/client'
import type { DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints/databases'
import type { UpdatePageParameters } from '@notionhq/client/build/src/api-endpoints/pages'
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
