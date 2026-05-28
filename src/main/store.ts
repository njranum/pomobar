import ElectronStore from 'electron-store'

// Create a skeleton schema
export interface StoreSchema {
  config: Record<string, never>
  syncQueue: unknown[]
}

const store = new ElectronStore<StoreSchema>({
  schema: {
    config: {
      type: 'object',
      default: {},
    },
    syncQueue: {
      type: 'array',
      default: [],
    },
  },
})

export default store
