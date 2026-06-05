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
