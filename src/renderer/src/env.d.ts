/// <reference types="vite/client" />
//
interface Window {
  api: {
    ping: () => Promise<string>
    storeGet: (key: string) => Promise<unknown>
    storeSet: (key: string, value: unknown) => void
  }
}
