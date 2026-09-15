import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Global environment stays 'node' for the pure-logic test files (helpers,
    // validators, formatters) so they run fast. Component tests that need a
    // DOM opt in via `// @vitest-environment jsdom` at the top of the file —
    // vitest reads that directive per-file and swaps environments.
    globals: true,
    // Stabilize Date/Intl for visual snapshots (must be set before module load).
    env: { TZ: 'UTC' },
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'backend/src/**/*.{test,spec}.js'],
    hookTimeout: 60000,
    testTimeout: 120000,
    fileParallelism: false,
    // Forks + single worker: threads pool ignored parent NODE_OPTIONS and
    // OOMed GHA. Pin worker heap to 4GB so parent+worker fit ubuntu-latest
    // (~7GB); CI shards across 24 runners so RSS stays under the ceiling.
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    poolOptions: {
      forks: {
        singleFork: false,
        execArgv: ['--max-old-space-size=4096'],
      },
    },

    setupFiles: ['./vitest.setup.ts'],
    // Coverage config is defined but off by default. Enable with
    // `npm test -- --coverage`. Thresholds will be tightened as the
    // component-test surface grows.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
})
