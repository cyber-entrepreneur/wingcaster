import type { NavPersona } from '@/components/nav/GlobalSearch'

/** Minimal agent shape needed for persona routing (AuthContext /api/auth/me). */
export type PersonaAgent = {
  platform_role?: 'platform_admin' | null | string
  role?: string | null
  affiliation?: { role?: string | null } | null
  [key: string]: unknown
}

const AGENCY_ADMIN_ROLES = new Set(['owner', 'admin', 'agency_admin', 'agency-admin'])

/**
 * Maps the signed-in principal to a Wave 0 chrome persona.
 * Priority: PA (platform_admin) → agency admin → agent.
 */
export function resolvePersona(
  agent: PersonaAgent | null | undefined,
  isAdmin = false,
): NavPersona | null {
  if (!agent) return null
  if (isAdmin || agent.platform_role === 'platform_admin') return 'pa'

  const affiliationRole = String(agent.affiliation?.role ?? '').toLowerCase()
  if (AGENCY_ADMIN_ROLES.has(affiliationRole)) return 'agency'

  const role = String(agent.role ?? '').toLowerCase()
  if (AGENCY_ADMIN_ROLES.has(role)) return 'agency'

  return 'agent'
}

/** Agency-scoped agent (member of an agency tenant) — still uses Agent shell + Team in More. */
export function isAgencyScopedAgent(agent: PersonaAgent | null | undefined): boolean {
  if (!agent) return false
  if (resolvePersona(agent) === 'agency') return true
  return Boolean(agent.affiliation?.role)
}
