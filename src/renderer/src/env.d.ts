/// <reference types="vite/client" />
//
interface Window {
  api: {
    storeGet: (key: string) => Promise<unknown>
    storeSet: (key: string, value: unknown) => void
  }
}
