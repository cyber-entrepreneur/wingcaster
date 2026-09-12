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
