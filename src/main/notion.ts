import { Client } from '@notionhq/client'
import store from './store'

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

export function extractNotionId(input: string): string {
  const s = input.trim()
  const uuid = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (uuid) return uuid[0]
  const hex = s.match(/[0-9a-f]{32}/i)
  if (hex) return hex[0]
  return s
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
