import { useCallback, useMemo, useState } from 'react'
import { API_BASE } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useIsProCapable } from '@/hooks/useIsProCapable'
import { useTenant } from '@/hooks/useTenant'
import type { UiMode } from '@/lib/uiMode'

export type { UiMode } from '@/lib/uiMode'
export { normalizeUiMode, isUiMode } from '@/lib/uiMode'

function readAuthToken(): string | null {
  try {
    return localStorage.getItem('fi_token') || localStorage.getItem('sa_token')
  } catch {
    return null
  }
}

export type PersistUiModeResult =
  | { ok: true; mode: UiMode }
  | { ok: false; error: string }

/** PATCH ui_mode for the active tenant membership (AGT-SET-002). */
export async function persistUiMode(mode: UiMode): Promise<PersistUiModeResult> {
  const token = readAuthToken()
  const res = await fetch(`${API_BASE}/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ui_mode: mode }),
  })
  if (!res.ok) {
    return { ok: false, error: `Failed to save ui_mode (${res.status})` }
  }
  const body = (await res.json().catch(() => null)) as { ui_mode?: string } | null
  return { ok: true, mode: body?.ui_mode === 'pro' ? 'pro' : mode }
}

export interface UseUiModeResult {
  /** Server preference for the active tenant (`guided` | `pro`). */
  mode: UiMode
  /**
   * What the UI should render now.
   * Pro only when server mode is `pro` AND viewport ≥768px (D-S-06).
   */
  effectiveMode: UiMode
  isProCapable: boolean
  loading: boolean
  switching: boolean
  setMode: (next: UiMode) => Promise<PersistUiModeResult>
  refresh: () => Promise<void>
}

/**
 * Per-tenant Guided ↔ Pro preference + viewport gate.
 * Same user can be Guided in one agency and Pro in another.
 */
export function useUiMode(options?: { forceProCapable?: boolean }): UseUiModeResult {
  const { agent, loading: authLoading } = useAuth()
  const { activeTenant, loading: tenantLoading, refresh } = useTenant()
  const isProCapable = useIsProCapable(options?.forceProCapable)
  const [switching, setSwitching] = useState(false)
  const [optimistic, setOptimistic] = useState<UiMode | null>(null)

  const mode: UiMode = useMemo(() => {
    if (optimistic) return optimistic
    const fromTenant = activeTenant?.uiMode
    return fromTenant === 'pro' ? 'pro' : 'guided'
  }, [activeTenant?.uiMode, optimistic])

  const effectiveMode: UiMode = mode === 'pro' && isProCapable ? 'pro' : 'guided'

  const setMode = useCallback(
    async (next: UiMode): Promise<PersistUiModeResult> => {
      if (next === 'pro' && !isProCapable) {
        return {
          ok: false,
          error: 'Pro mode is available on tablet or larger screens (≥768px).',
        }
      }
      const prev = mode
      setOptimistic(next)
      setSwitching(true)
      try {
        const result = await persistUiMode(next)
        if (!result.ok) {
          setOptimistic(prev)
          return result
        }
        await refresh()
        setOptimistic(null)
        return result
      } catch (err) {
        setOptimistic(prev)
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Could not switch modes',
        }
      } finally {
        setSwitching(false)
      }
    },
    [isProCapable, mode, refresh],
  )

  return {
    mode,
    effectiveMode,
    shouldRenderPro: effectiveMode === 'pro',
    isProCapable,
    loading: Boolean(agent) && (authLoading || tenantLoading),
    switching,
    setMode,
    refresh,
import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useIsProCapable } from '@/hooks/useIsProCapable'

export type UiMode = 'guided' | 'pro'

export interface UseUiModeResult {
  /** Server-persisted preference for the active tenant context. Never flipped by viewport. */
  uiMode: UiMode
  /** Render mode after D-S-06 gate: Pro only when uiMode=pro AND viewport ≥768px. */
  effectiveMode: UiMode
  /** True when Pro layout should mount (uiMode=pro && isProCapable). */
  shouldRenderPro: boolean
  loading: boolean
}

function asUiMode(value: unknown): UiMode | null {
  if (value === 'pro' || value === 'guided') return value
  return null
}

/**
 * Resolve effective `ui_mode` from `/auth/me`-shaped payloads.
 * Prefer per-tenant membership override, then user/agent data, then top-level field.
 * Defaults to Guided when Agent 1's PATCH/GET wiring is not yet present.
 */
export function resolveUiModeFromAgent(agent: Record<string, unknown> | null | undefined): UiMode {
  if (!agent) return 'guided'

  const membership = agent.tenant_membership
  if (membership && typeof membership === 'object') {
    const membershipData = (membership as { data?: unknown }).data
    if (membershipData && typeof membershipData === 'object') {
      const fromMembership = asUiMode((membershipData as { ui_mode?: unknown }).ui_mode)
      if (fromMembership) return fromMembership
    }
  }

  const data = agent.data
  if (data && typeof data === 'object') {
    const fromData = asUiMode((data as { ui_mode?: unknown }).ui_mode)
    if (fromData) return fromData
  }

  const direct = asUiMode(agent.ui_mode)
  if (direct) return direct

  return 'guided'
}

/**
 * Minimal Guided/Pro preference hook for Wave-8 mount branching.
 * Agent 1 (`feat/wave-8-pro`) may replace the read path with a dedicated
 * context + PATCH `/api/users/me` without changing `UseUiModeResult`.
 */
export function useUiMode(): UseUiModeResult {
  const { agent, loading } = useAuth()
  const isProCapable = useIsProCapable()

  const uiMode = useMemo(
    () => resolveUiModeFromAgent(agent as Record<string, unknown> | null),
    [agent],
  )

  const shouldRenderPro = uiMode === 'pro' && isProCapable
  const effectiveMode: UiMode = shouldRenderPro ? 'pro' : 'guided'

  return {
    uiMode,
    effectiveMode,
    shouldRenderPro,
    loading,
  }
}
