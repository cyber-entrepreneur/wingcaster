import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, setAuthToken } from '@/api/client'
import { publishSessionEvent, subscribeSessionEvents } from '@/lib/broadcast'

export type TenantRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
export type TenantKind = 'personal' | 'agency'

export interface TenantSummary {
  id: string
  name: string
  avatarUrl: string | null
  role: TenantRole
  kind: TenantKind
  listingsCount: number
  agentsCount: number
  /** Other members besides the current user (agency rows). */
  otherMembersCount?: number
  lastActiveAt?: string | null
}

export interface UseTenantResult {
  tenants: TenantSummary[]
  activeTenantId: string | null
  activeTenant: TenantSummary | null
  loading: boolean
  switching: boolean
  error: string | null
  isMultiTenant: boolean
  refresh: () => Promise<void>
  switchTenant: (tenantId: string) => Promise<TenantSummary>
}

const ACTIVE_TENANT_STORAGE_KEY = 'wc_active_tenant_id'

const ROLE_RANK: Record<TenantRole, number> = {
  owner: 0,
  admin: 1,
  manager: 2,
  member: 3,
  viewer: 4,
}

type ApiTenant = {
  id: string
  name: string
  avatarUrl?: string | null
  avatar_url?: string | null
  role: string
  listingsCount?: number
  listings_count?: number
  agentsCount?: number
  agents_count?: number
  otherMembersCount?: number
  other_members_count?: number
  isActive?: boolean
  is_active?: boolean
  tenantType?: string
  tenant_type?: string
  kind?: string
  isPersonal?: boolean
  is_personal?: boolean
  lastActiveAt?: string | null
  last_active_at?: string | null
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('fi_token') || localStorage.getItem('sa_token')
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function authFetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers || {}) },
  })
  const bodyText = await res.text()
  const parsed = bodyText ? (() => {
    try {
      return JSON.parse(bodyText)
    } catch {
      return null
    }
  })() : null

  if (!res.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'error' in parsed && String((parsed as { error: unknown }).error)) ||
      `Request failed (${res.status})`
    throw new Error(message)
  }
  return parsed as T
}

function normalizeRole(role: string): TenantRole {
  const value = role.toLowerCase()
  if (value === 'guest') return 'viewer'
  if (value === 'owner' || value === 'admin' || value === 'manager' || value === 'member' || value === 'viewer') {
    return value
  }
  return 'member'
}

function resolveKind(raw: ApiTenant): TenantKind {
  const explicit = (raw.kind || raw.tenantType || raw.tenant_type || '').toLowerCase()
  if (explicit === 'personal' || explicit === 'agency') return explicit
  if (raw.isPersonal === true || raw.is_personal === true) return 'personal'
  if (typeof raw.id === 'string' && raw.id.startsWith('personal:')) return 'personal'
  return 'agency'
}

export function normalizeTenant(raw: ApiTenant): TenantSummary {
  return {
    id: raw.id,
    name: raw.name,
    avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
    role: normalizeRole(raw.role),
    kind: resolveKind(raw),
    listingsCount: Number(raw.listingsCount ?? raw.listings_count ?? 0),
    agentsCount: Number(raw.agentsCount ?? raw.agents_count ?? 0),
    otherMembersCount:
      raw.otherMembersCount != null || raw.other_members_count != null
        ? Number(raw.otherMembersCount ?? raw.other_members_count)
        : undefined,
    lastActiveAt: raw.lastActiveAt ?? raw.last_active_at ?? null,
  }
}

/** Personal first, then agencies by role rank, then most-recently-active. */
export function sortTenants(tenants: TenantSummary[]): TenantSummary[] {
  return [...tenants].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'personal' ? -1 : 1
    if (a.kind === 'agency' && b.kind === 'agency') {
      const roleDelta = ROLE_RANK[a.role] - ROLE_RANK[b.role]
      if (roleDelta !== 0) return roleDelta
      const aTime = a.lastActiveAt ? Date.parse(a.lastActiveAt) : 0
      const bTime = b.lastActiveAt ? Date.parse(b.lastActiveAt) : 0
      if (aTime !== bTime) return bTime - aTime
    }
    return a.name.localeCompare(b.name)
  })
}

function readStoredTenantId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredTenantId(tenantId: string | null): void {
  try {
    if (tenantId) localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantId)
    else localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

type TenantsResponse = {
  tenants?: ApiTenant[]
  activeTenantId?: string | null
  active_tenant_id?: string | null
}

type SwitchTenantResponse = {
  token?: string
  activeTenantId?: string
  active_tenant_id?: string
  tenant?: ApiTenant
  agent?: unknown
}

async function fetchTenants(): Promise<{ tenants: TenantSummary[]; activeTenantId: string | null }> {
  const data = await authFetchJson<TenantsResponse>('/auth/me/tenants')
  const tenants = sortTenants((data.tenants ?? []).map(normalizeTenant))
  const fromApi = data.activeTenantId ?? data.active_tenant_id ?? null
  const activeMarked = tenants.find((t) => {
    const raw = (data.tenants ?? []).find((r) => r.id === t.id)
    return raw?.isActive === true || raw?.is_active === true
  })
  const stored = readStoredTenantId()
  const activeTenantId =
    fromApi ||
    activeMarked?.id ||
    (stored && tenants.some((t) => t.id === stored) ? stored : null) ||
    tenants[0]?.id ||
    null
  return { tenants, activeTenantId }
}

/**
 * Active-tenant state for SHR-NAV-008.
 * Lists memberships via GET /api/auth/me/tenants, switches via POST /api/auth/switch-tenant,
 * mirrors id to localStorage, and syncs across tabs through wingcaster-session.
 */
export function useTenant(): UseTenantResult {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => readStoredTenantId())
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeTenantIdRef = useRef(activeTenantId)
  activeTenantIdRef.current = activeTenantId

  const applyActiveTenantId = useCallback((tenantId: string | null) => {
    setActiveTenantId(tenantId)
    writeStoredTenantId(tenantId)
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    const { tenants: next, activeTenantId: nextActive } = await fetchTenants()
    setTenants(next)
    applyActiveTenantId(nextActive)
  }, [applyActiveTenantId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refresh()
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tenants')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    return subscribeSessionEvents((event) => {
      if (event.type !== 'tenant-switched') return
      if (event.tenantId === activeTenantIdRef.current) return
      applyActiveTenantId(event.tenantId)
      // Soft refresh of memberships + metrics; no forced navigation.
      void refresh().catch(() => {
        /* keep mirrored id even if list refresh fails */
      })
    })
  }, [applyActiveTenantId, refresh])

  const switchTenant = useCallback(
    async (tenantId: string) => {
      if (tenantId === activeTenantIdRef.current) {
        const current = tenants.find((t) => t.id === tenantId)
        if (current) return current
      }

      setSwitching(true)
      setError(null)
      try {
        const res = await authFetchJson<SwitchTenantResponse>('/auth/switch-tenant', {
          method: 'POST',
          body: JSON.stringify({ tenantId }),
        })
        if (res.token) setAuthToken(res.token)

        const nextId = res.activeTenantId ?? res.active_tenant_id ?? tenantId
        applyActiveTenantId(nextId)
        publishSessionEvent({ type: 'tenant-switched', tenantId: nextId })

        try {
          const { tenants: next } = await fetchTenants()
          setTenants(next)
          const found = next.find((t) => t.id === nextId)
          if (found) return found
        } catch {
          /* fall through to optimistic row */
        }

        const optimistic =
          tenants.find((t) => t.id === nextId) ??
          (res.tenant ? normalizeTenant(res.tenant) : null)
        if (optimistic) {
          setTenants((prev) => {
            if (prev.some((t) => t.id === optimistic.id)) return prev
            return sortTenants([...prev, optimistic])
          })
          return optimistic
        }

        return {
          id: nextId,
          name: nextId,
          avatarUrl: null,
          role: 'member' as const,
          kind: 'agency' as const,
          listingsCount: 0,
          agentsCount: 0,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not switch tenants'
        setError(message)
        throw err
      } finally {
        setSwitching(false)
      }
    },
    [applyActiveTenantId, tenants],
  )

  const activeTenant = useMemo(
    () => tenants.find((t) => t.id === activeTenantId) ?? null,
    [tenants, activeTenantId],
  )

  return {
    tenants,
    activeTenantId,
    activeTenant,
    loading,
    switching,
    error,
    isMultiTenant: tenants.length > 1,
    refresh,
    switchTenant,
  }
}
