import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// The main-process logic under test is pure Node, so run the suite in the
// `node` environment. Aliases mirror electron.vite.config.ts so `@/...` and
// `@renderer/...` imports resolve identically under the test runner.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('src'),
      '@renderer': resolve('src/renderer/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
