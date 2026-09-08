import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { publishSessionEvent, subscribeSessionEvents } from '@/lib/broadcast'

export type AppLocale = 'en' | 'ar'

export const LOCALE_STORAGE_KEY = 'wingcaster.locale'

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'ar'
}

export function readStoredLocale(): AppLocale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isAppLocale(raw) ? raw : null
  } catch {
    return null
  }
}

export function writeStoredLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* private mode / quota — session still works without persistence */
  }
}

/**
 * First-visit / cold-start order:
 * preferred_locale → localStorage → navigator.language ar-* → en
 */
export function resolveLocale(input: {
  preferredLocale?: string | null
  storedLocale?: string | null
  navigatorLanguage?: string | null
}): AppLocale {
  if (isAppLocale(input.preferredLocale)) return input.preferredLocale
  if (isAppLocale(input.storedLocale)) return input.storedLocale
  const nav = (input.navigatorLanguage ?? '').toLowerCase()
  if (nav.startsWith('ar')) return 'ar'
  return 'en'
}

export function applyDocumentLocale(locale: AppLocale): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.lang = locale
  root.dir = locale === 'ar' ? 'rtl' : 'ltr'
}

function readAuthToken(): string | null {
  try {
    return localStorage.getItem('fi_token') || localStorage.getItem('sa_token')
  } catch {
    return null
  }
}

/** PATCH preferred_locale for signed-in users (Wave 0: PATCH /api/users/me). */
export async function persistPreferredLocale(locale: AppLocale): Promise<void> {
  const token = readAuthToken()
  const res = await fetch(`${API_BASE}/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ preferred_locale: locale }),
  })
  if (!res.ok) {
    const err = new Error(`Failed to save preferred_locale (${res.status})`) as Error & {
      status?: number
    }
    err.status = res.status
    throw err
  }
}

export type SetLocaleResult =
  | { ok: true }
  | { ok: false; error: 'switchFailed'; retry: () => Promise<SetLocaleResult> }

function bootstrapLocale(preferredLocale?: string | null): AppLocale {
  const locale = resolveLocale({
    preferredLocale: preferredLocale ?? null,
    storedLocale: typeof window !== 'undefined' ? readStoredLocale() : null,
    navigatorLanguage: typeof navigator !== 'undefined' ? navigator.language : null,
  })
  applyDocumentLocale(locale)
  return locale
}

/**
 * App-wide locale: syncs `<html lang>` + `<html dir>`, localStorage, optional
 * server preferred_locale, and cross-tab BroadcastChannel.
 */
export function useLocale() {
  const { agent, loading: authLoading } = useAuth()
  const preferredLocale =
    typeof agent?.preferred_locale === 'string' ? agent.preferred_locale : null

  const [locale, setLocaleState] = useState<AppLocale>(() => bootstrapLocale(null))

  // When auth resolves, prefer server preferred_locale over local heuristics.
  useEffect(() => {
    if (authLoading) return
    const next = resolveLocale({
      preferredLocale,
      storedLocale: readStoredLocale(),
      navigatorLanguage: typeof navigator !== 'undefined' ? navigator.language : null,
    })
    setLocaleState((prev) => {
      if (prev === next) return prev
      applyDocumentLocale(next)
      writeStoredLocale(next)
      return next
    })
  }, [authLoading, preferredLocale])

  useEffect(() => {
    applyDocumentLocale(locale)
  }, [locale])

  useEffect(() => {
    return subscribeSessionEvents((event) => {
      if (event.type !== 'locale-changed') return
      setLocaleState((prev) => {
        if (prev === event.locale) return prev
        applyDocumentLocale(event.locale)
        writeStoredLocale(event.locale)
        return event.locale
      })
    })
  }, [])

  const setLocale = useCallback(
    async (next: AppLocale): Promise<SetLocaleResult> => {
      const apply = (value: AppLocale) => {
        setLocaleState(value)
        applyDocumentLocale(value)
        writeStoredLocale(value)
        publishSessionEvent({ type: 'locale-changed', locale: value })
      }

      if (next !== locale) {
        apply(next)
      }

      // Signed-in: persist in background — never block the visual switch.
      if (agent) {
        try {
          await persistPreferredLocale(next)
          return { ok: true }
        } catch {
          const retry = () => setLocale(next)
          return { ok: false, error: 'switchFailed', retry }
        }
      }

      return { ok: true }
    },
    [agent, locale],
  )

  return {
    locale,
    setLocale,
    dir: (locale === 'ar' ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    isArabic: locale === 'ar',
  }
}
