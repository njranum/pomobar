export const IPC_CHANNELS = {
  // Test IPC_CHANNELS
  PING: 'ping',

  // --- Store ---
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
