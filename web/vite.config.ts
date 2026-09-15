import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN || process.env.SENTRY_AUTH_TOKEN
  const plugins = [react()]

  // Upload source maps on production builds when a Sentry auth token is present.
  if (sentryAuthToken) {
    plugins.push(
      sentryVitePlugin({
        org: env.SENTRY_ORG || process.env.SENTRY_ORG || 'wingcaster',
        project: env.SENTRY_PROJECT_WEB || process.env.SENTRY_PROJECT_WEB || 'wingcaster-web',
        authToken: sentryAuthToken,
        release: {
          name: env.VITE_GIT_SHA || process.env.VITE_GIT_SHA || process.env.GIT_SHA || undefined,
        },
        sourcemaps: {
          filesToDeleteAfterUpload: ['./dist/**/*.map'],
        },
      }),
    )
  }

  return {
    plugins,
    build: {
      // Generate maps so Sentry can upload them when SENTRY_AUTH_TOKEN is set.
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 7100,
      fs: {
        allow: [path.resolve(__dirname, '..')],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 7100,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
