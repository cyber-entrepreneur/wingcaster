import { useMemo } from 'react'
import { useAuth, type AuthAgent, type TenantMembership } from '@/context/AuthContext'
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
 * Canonical membership read (Wave-8 DSH mount): `agent.tenant_memberships[0].ui_mode`
 * (plural). Also accepts nested `data.ui_mode` (JSONB column per AGT-DSH-002 brief).
 * Singular `tenant_membership` is intentionally ignored — that shape loses.
 */
function uiModeFromTenantMemberships(memberships: TenantMembership[] | undefined): UiMode | null {
  if (!Array.isArray(memberships) || memberships.length === 0) return null
  const first = memberships[0]
  if (!first || typeof first !== 'object') return null

  const direct = asUiMode(first.ui_mode)
  if (direct) return direct

  const nested = first.data
  if (nested && typeof nested === 'object') {
    return asUiMode(nested.ui_mode)
  }
  return null
}

/**
 * Resolve effective `ui_mode` from `/auth/me`-shaped payloads.
 * Prefer per-tenant membership override (`tenant_memberships[0]`), then user/agent
 * data, then top-level field. Defaults to Guided when Agent 1's PATCH/GET wiring
 * is not yet present.
 */
export function resolveUiModeFromAgent(
  agent: AuthAgent | Record<string, unknown> | null | undefined,
): UiMode {
  if (!agent) return 'guided'

  const memberships = (agent as AuthAgent).tenant_memberships
  const fromMemberships = uiModeFromTenantMemberships(memberships)
  if (fromMemberships) return fromMemberships

  const data = (agent as { data?: unknown }).data
  if (data && typeof data === 'object') {
    const fromData = asUiMode((data as { ui_mode?: unknown }).ui_mode)
    if (fromData) return fromData
  }

  const direct = asUiMode((agent as { ui_mode?: unknown }).ui_mode)
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

  const uiMode = useMemo(() => resolveUiModeFromAgent(agent), [agent])

  const shouldRenderPro = uiMode === 'pro' && isProCapable
  const effectiveMode: UiMode = shouldRenderPro ? 'pro' : 'guided'

  return {
    uiMode,
    effectiveMode,
    shouldRenderPro,
    loading,
  }
}
