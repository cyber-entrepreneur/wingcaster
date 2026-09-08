import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { API_BASE, setAuthToken } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { publishSessionEvent, subscribeSessionEvents } from '@/lib/broadcast'

export type WingcasterEnv = 'live' | 'test'

/** Header name mirrored on every subsequent PA request. */
export const WINGCASTER_ENV_HEADER = 'X-Wingcaster-Env'

export const ENV_STORAGE_KEY = 'wingcaster.env'

export const LIVE_SWITCH_CONFIRM_TOKEN = 'SWITCH TO LIVE'

export const CONFIRM_REQUIRED_ERROR = 'LIVE-bound switch requires confirmation'

type EnvStore = {
  env: WingcasterEnv
  switching: boolean
  confirmLiveOpen: boolean
  sessionChangedElsewhere: boolean
  error: string | null
}

const listeners = new Set<() => void>()

let store: EnvStore = {
  env: 'live',
  switching: false,
  confirmLiveOpen: false,
  sessionChangedElsewhere: false,
  error: null,
}

let suppressReload = false
let crossTabSubscribed = false

function emit() {
  for (const listener of listeners) listener()
}

function patchStore(partial: Partial<EnvStore>) {
  store = { ...store, ...partial }
  emit()
}

export function isWingcasterEnv(value: unknown): value is WingcasterEnv {
  return value === 'live' || value === 'test'
}

export function normalizeEnv(value: unknown): WingcasterEnv {
  if (value === 'TEST' || value === 'test') return 'test'
  return 'live'
}

export function getWingcasterEnv(): WingcasterEnv {
  return store.env
}

export function readStoredEnv(): WingcasterEnv | null {
  try {
    const raw = sessionStorage.getItem(ENV_STORAGE_KEY) ?? localStorage.getItem(ENV_STORAGE_KEY)
    return isWingcasterEnv(raw) ? raw : null
  } catch {
    return null
  }
}

export function writeStoredEnv(env: WingcasterEnv): void {
  try {
    sessionStorage.setItem(ENV_STORAGE_KEY, env)
    localStorage.setItem(ENV_STORAGE_KEY, env)
  } catch {
    /* private mode — in-memory mirror still works for this tab */
  }
}

/**
 * Client-side mirror of X-Wingcaster-Env. Import from api/client headers()
 * (Wave 0 wiring) so every PA request carries the active env.
 */
export function setWingcasterEnvMirror(env: WingcasterEnv): void {
  const next = normalizeEnv(env)
  writeStoredEnv(next)
  if (store.env !== next) {
    patchStore({ env: next })
  } else {
    // Keep storage in sync even when env string unchanged.
    store = { ...store, env: next }
  }
}

function bootstrapMirror(seed?: unknown): WingcasterEnv {
  const next = normalizeEnv(seed ?? (typeof window !== 'undefined' ? readStoredEnv() : null) ?? 'live')
  writeStoredEnv(next)
  store = { ...store, env: next }
  return next
}

if (typeof window !== 'undefined') {
  bootstrapMirror()
}

function readAuthToken(): string | null {
  try {
    return localStorage.getItem('fi_token') || localStorage.getItem('sa_token')
  } catch {
    return null
  }
}

function envHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [WINGCASTER_ENV_HEADER]: getWingcasterEnv(),
  }
  const token = readAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

type SwitchSessionResponse = {
  token?: string
  env?: string
  environment?: string
  agent?: { env?: string; environment?: string; fin_environment?: string }
}

export async function postEnvSwitch(target: WingcasterEnv): Promise<WingcasterEnv> {
  const res = await fetch(`${API_BASE}/admin/env/switch`, {
    method: 'POST',
    headers: envHeaders(),
    body: JSON.stringify({ target }),
  })

  const bodyText = await res.text()
  const parsed = bodyText
    ? (() => {
        try {
          return JSON.parse(bodyText) as SwitchSessionResponse & { error?: string }
        } catch {
          return null
        }
      })()
    : null

  if (!res.ok) {
    const message =
      (parsed && typeof parsed === 'object' && parsed.error && String(parsed.error)) ||
      `Couldn't switch environments (${res.status})`
    throw new Error(message)
  }

  const headerEnv = normalizeEnv(res.headers.get(WINGCASTER_ENV_HEADER))
  const bodyEnv = normalizeEnv(
    parsed?.env ??
      parsed?.environment ??
      parsed?.agent?.env ??
      parsed?.agent?.environment ??
      parsed?.agent?.fin_environment ??
      target,
  )
  const next = headerEnv || bodyEnv || target

  if (parsed?.token) setAuthToken(parsed.token)
  setWingcasterEnvMirror(next)
  return next
}

function ensureCrossTabSubscription() {
  if (crossTabSubscribed || typeof window === 'undefined') return
  crossTabSubscribed = true
  subscribeSessionEvents((event) => {
    if (event.type !== 'env-changed') return
    if (event.env === store.env) return

    patchStore({
      env: event.env,
      confirmLiveOpen: false,
      sessionChangedElsewhere: true,
    })
    writeStoredEnv(event.env)

    if (suppressReload) return
    window.location.reload()
  })
}

async function runSwitch(target: WingcasterEnv) {
  patchStore({ switching: true, error: null })
  try {
    const next = await postEnvSwitch(target)
    suppressReload = true
    publishSessionEvent({ type: 'env-changed', env: next })
    patchStore({ confirmLiveOpen: false, env: next })
    window.location.reload()
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn't switch environments. Try again."
    patchStore({ error: message, switching: false })
    throw err
  } finally {
    suppressReload = false
    // If reload did not happen (failure), clear switching.
    if (store.switching) patchStore({ switching: false })
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  ensureCrossTabSubscription()
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): EnvStore {
  return store
}

function getServerSnapshot(): EnvStore {
  return store
}

export type UseEnvResult = {
  env: WingcasterEnv
  isLive: boolean
  isTest: boolean
  switching: boolean
  confirmLiveOpen: boolean
  sessionChangedElsewhere: boolean
  error: string | null
  openLiveConfirm: () => void
  closeLiveConfirm: () => void
  /**
   * Select an env from the popover.
   * LIVE-bound (test → live) opens the confirm dialog and does NOT call the API.
   * TEST-bound (live → test) calls the API immediately.
   */
  selectEnv: (target: WingcasterEnv) => Promise<void>
  /**
   * Perform the LIVE switch after UI type-to-confirm + checkboxes pass.
   * Rejects unless `confirmed: true` — cannot bypass the dialog contract.
   */
  confirmSwitchToLive: (opts: { confirmed: true }) => Promise<void>
  clearError: () => void
}

/**
 * PA session environment (LIVE ↔ TEST).
 * Shared module store so badge, strip, and confirm dialog stay in sync.
 * Publishes env-changed on wingcaster-session; reloads on success / cross-tab.
 */
export function useEnv(): UseEnvResult {
  const { agent, isAdmin, loading: authLoading } = useAuth()
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const agentEnv =
    (agent as { env?: unknown; environment?: unknown; fin_environment?: unknown } | null)?.env ??
    (agent as { environment?: unknown } | null)?.environment ??
    (agent as { fin_environment?: unknown } | null)?.fin_environment

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) return
    if (agentEnv == null) return
    const next = normalizeEnv(agentEnv)
    if (next === store.env) return
    setWingcasterEnvMirror(next)
  }, [authLoading, isAdmin, agentEnv])

  const openLiveConfirm = useCallback(() => {
    if (store.env === 'live') return
    patchStore({
      confirmLiveOpen: true,
      sessionChangedElsewhere: false,
      error: null,
    })
  }, [])

  const closeLiveConfirm = useCallback(() => {
    if (store.switching) return
    patchStore({ confirmLiveOpen: false })
  }, [])

  const selectEnv = useCallback(async (target: WingcasterEnv) => {
    if (target === store.env) return

    // LIVE-bound: open confirmation — never hit the API here.
    if (target === 'live') {
      openLiveConfirm()
      return
    }

    // TEST-bound: instant switch.
    await runSwitch('test')
  }, [openLiveConfirm])

  const confirmSwitchToLive = useCallback(async (opts: { confirmed: true }) => {
    if (!opts || opts.confirmed !== true) {
      throw new Error(CONFIRM_REQUIRED_ERROR)
    }
    if (store.env === 'live') {
      patchStore({ confirmLiveOpen: false })
      return
    }
    await runSwitch('live')
  }, [])

  const clearError = useCallback(() => {
    patchStore({ error: null })
  }, [])

  return {
    env: snapshot.env,
    isLive: snapshot.env === 'live',
    isTest: snapshot.env === 'test',
    switching: snapshot.switching,
    confirmLiveOpen: snapshot.confirmLiveOpen,
    sessionChangedElsewhere: snapshot.sessionChangedElsewhere,
    error: snapshot.error,
    openLiveConfirm,
    closeLiveConfirm,
    selectEnv,
    confirmSwitchToLive,
    clearError,
  }
}

/** Test-only: reset module store between cases. */
export function __resetEnvStoreForTests(seed: WingcasterEnv = 'live') {
  store = {
    env: seed,
    switching: false,
    confirmLiveOpen: false,
    sessionChangedElsewhere: false,
    error: null,
  }
  writeStoredEnv(seed)
  suppressReload = false
  emit()
}
