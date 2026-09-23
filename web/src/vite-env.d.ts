/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_APP_URL?: string
  readonly VITE_PUBLIC_URL?: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_GIT_SHA?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_UNLAYER_PROJECT_ID?: string
  readonly VITE_PADDLE_CLIENT_TOKEN?: string
  readonly VITE_PADDLE_ENV?: 'sandbox' | 'production'
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
