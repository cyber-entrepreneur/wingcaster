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
    isProCapable,
    loading: Boolean(agent) && (authLoading || tenantLoading),
    switching,
    setMode,
    refresh,
  }
}
