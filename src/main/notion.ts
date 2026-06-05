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
