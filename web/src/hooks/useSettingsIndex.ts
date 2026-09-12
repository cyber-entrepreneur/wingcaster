import { useCallback, useEffect, useState } from 'react'
import { api, type SettingsIndexResponse } from '@/api/client'

/** Shared cache key — invalidate after 2FA enroll, invite accept, or other capability changes. */
export const SETTINGS_INDEX_SWR_KEY = '/api/settings/index'

const STALE_MS = 5 * 60 * 1000
const DEDUPE_MS = 5_000

type Listener = () => void

let cache: SettingsIndexResponse | undefined
let cacheError: Error | null = null
let inflight: Promise<SettingsIndexResponse> | null = null
let lastLoadedAt = 0
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error('Failed to load settings index')
}

function load(force = false): Promise<SettingsIndexResponse> {
  if (inflight) return inflight
  if (!force && cache && Date.now() - lastLoadedAt < DEDUPE_MS) {
    return Promise.resolve(cache)
  }

  inflight = api
    .getSettingsIndex()
    .then((next) => {
      cache = next
      cacheError = null
      lastLoadedAt = Date.now()
      emit()
      return next
    })
    .catch((err) => {
      cacheError = toError(err)
      emit()
      throw cacheError
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

/** Exported mutate surface for downstream pages (2FA enroll, invite accept). */
export function mutateSettingsIndex(
  data?: SettingsIndexResponse | Promise<SettingsIndexResponse>,
  opts?: { revalidate?: boolean },
): Promise<SettingsIndexResponse | undefined> {
  if (data && typeof (data as Promise<SettingsIndexResponse>).then === 'function') {
    return Promise.resolve(data).then((next) => {
      cache = next
      cacheError = null
      lastLoadedAt = Date.now()
      emit()
      if (opts?.revalidate === false) return next
      return load(true).catch(() => next)
    })
  }
  if (data) {
    cache = data as SettingsIndexResponse
    cacheError = null
    lastLoadedAt = Date.now()
    emit()
    if (opts?.revalidate === false) return Promise.resolve(cache)
    return load(true).catch(() => cache)
  }
  return load(true).catch(() => cache)
}

/** Test-only: drop the module cache so RTL suites don't leak index payloads. */
export function resetSettingsIndexCache() {
  cache = undefined
  cacheError = null
  inflight = null
  lastLoadedAt = 0
  emit()
}

/**
 * GET /api/settings/index — server-driven settings menu.
 * SWR semantics without a new npm dependency: shared cache, in-flight dedupe,
 * focus/reconnect revalidate, 5-minute refresh, exported `mutate`.
 * Never reads `session.role`.
 */
export function useSettingsIndex() {
  const [, bump] = useState(0)

  useEffect(() => {
    const onChange = () => bump((n) => n + 1)
    listeners.add(onChange)
    void load(false).catch(() => undefined)

    const revalidateIfStale = () => {
      if (Date.now() - lastLoadedAt >= DEDUPE_MS) void load(true).catch(() => undefined)
    }
    const onFocus = () => revalidateIfStale()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    const id = window.setInterval(() => {
      void load(true).catch(() => undefined)
    }, STALE_MS)

    return () => {
      listeners.delete(onChange)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
      window.clearInterval(id)
    }
  }, [])

  const reload = useCallback(() => mutateSettingsIndex(), [])

  return {
    data: cache ?? null,
    error: cacheError,
    loading: cache === undefined && !cacheError,
    revalidating: Boolean(inflight && cache),
    reload,
    mutate: mutateSettingsIndex,
  }
}
