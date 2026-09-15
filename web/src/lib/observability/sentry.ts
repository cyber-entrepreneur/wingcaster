/**
 * Frontend Sentry bootstrap.
 *
 * Silent no-op when VITE_SENTRY_DSN is unset.
 * Session replay is off by default; error replays are masked (PII policy).
 */

import * as Sentry from '@sentry/react'

export const REDACTED = '[Filtered]'

const SENSITIVE_KEY =
  /^(?:password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|auth|api[_-]?key|session|session[_-]?id|cookie|cookies|otp|otp[_-]?code|code|totp|backup[_-]?code|backup[_-]?codes|ssn|social[_-]?security|national[_-]?id|applicant[_-]?id|credit[_-]?card|card[_-]?number|cvv|cvc|email|e[_-]?mail|phone|phone[_-]?number|mobile|name|first[_-]?name|last[_-]?name|full[_-]?name)$/i

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const PHONE_RE = /(?:\+\d[\d\s().-]{6,}\d)|(?:\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/g
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(String(key || ''))
}

function scrubStringValue(value: string): string {
  if (UUID_RE.test(value)) return value
  return value.replace(EMAIL_RE, REDACTED).replace(PHONE_RE, REDACTED)
}

export function scrubValue(input: unknown, parentKey = ''): unknown {
  if (parentKey && isSensitiveKey(parentKey)) return REDACTED
  if (input == null) return input
  if (typeof input === 'string') return scrubStringValue(input)
  if (typeof input !== 'object') return input

  if (Array.isArray(input)) {
    return input.map((item) => scrubValue(item, parentKey))
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : scrubValue(value, key)
  }
  return out
}

export function scrubPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (!event) return event

  if (event.request) {
    if (event.request.data != null) {
      event.request.data = scrubValue(event.request.data)
    }
    if (event.request.query_string != null) {
      const qs = event.request.query_string
      if (typeof qs === 'string') {
        try {
          const params = new URLSearchParams(qs)
          const parts: string[] = []
          for (const [key, value] of params.entries()) {
            const scrubbed = isSensitiveKey(key) ? REDACTED : scrubStringValue(value)
            parts.push(
              isSensitiveKey(key)
                ? `${encodeURIComponent(key)}=${REDACTED}`
                : `${encodeURIComponent(key)}=${encodeURIComponent(scrubbed)}`,
            )
          }
          event.request.query_string = parts.join('&')
        } catch {
          event.request.query_string = REDACTED
        }
      } else {
        event.request.query_string = scrubValue(qs) as typeof qs
      }
    }
    if (event.request.headers) {
      event.request.headers = scrubValue(event.request.headers) as Record<string, string>
    }
    if (event.request.cookies != null) {
      // Sentry types cookies as a map; we replace the whole field with a marker.
      event.request.cookies = { filtered: REDACTED }
    }
  }

  if (event.user) {
    const id = event.user.id
    event.user = id ? { id } : {}
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>
  }

  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as typeof event.contexts
  }

  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (crumb?.data) crumb.data = scrubValue(crumb.data) as Record<string, unknown>
      if (typeof crumb?.message === 'string') crumb.message = scrubStringValue(crumb.message)
    }
  }

  return event
}

let initialized = false

export function initSentry(): void {
  if (initialized) return
  initialized = true

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_GIT_SHA || 'unknown',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0, // no session replay by default (PII)
    replaysOnErrorSampleRate: 0.1, // replays only on error, scrubbed
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    beforeSend: scrubPii,
  })
}

export { Sentry }
