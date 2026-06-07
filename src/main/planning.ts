import store from './store'

export function effectiveDate(): string {
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setHours(4, 0, 0, 0)
  const ref = now < cutoff ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now
  return ref.toISOString().split('T')[0]
}

export function needsPlanning(): boolean {
  if (!store.get('planningDbId')) return false
  return store.get('lastPlanningDate') !== effectiveDate()
}
