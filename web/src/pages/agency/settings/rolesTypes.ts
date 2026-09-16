/**
 * AGN-ROL-001 / AGN-ROL-002 — capability-pack DTOs + presentation helpers.
 *
 * Wire targets (all live on main, BE-BLOCKER-29):
 *   GET   /api/agency/capability-packs
 *   GET   /api/agency/capability-packs/:id
 *   PATCH /api/agency/members/:userId/capability-packs
 *
 * There is no pack-definition PATCH endpoint in v1, so AGN-ROL-002 renders the
 * capability matrix read-only (fully backed by the detail GET). Assignment of a
 * pack to members (AGN-ROL-001 R13 sheet) is the only capability write.
 */

export interface CapabilitySummaryEntry {
  key: string
  label: string
}

export interface CapabilityPackListDto {
  id: string
  kind: 'seeded' | 'custom'
  name: string
  description: string
  capability_summary: CapabilitySummaryEntry[]
  capability_total: number
  member_count: number
  requires_two_person: boolean
  editable: boolean
}

export interface CapabilityPacksResponse {
  agency_id: string
  packs: CapabilityPackListDto[]
  agency_meta: {
    owner_count: number
    member_count_total: number
  }
}

export interface DomainCapabilityDto {
  key: string
  label: string
  description: string
  is_financial: boolean
  enabled: boolean
}

export interface DomainGroupDto {
  key: string
  label: string
  capabilities: DomainCapabilityDto[]
}

export interface PackMemberPreviewDto {
  user_id: string
  display_name: string | null
  avatar_url: string | null
}

export interface CapabilityPackDetailDto {
  id: string
  kind: 'seeded' | 'custom'
  name: string
  description: string
  editable: boolean
  member_count: number
  members_preview: PackMemberPreviewDto[]
  domains: DomainGroupDto[]
}

/** lucide icon key per seeded/custom pack (resolved to a component at render). */
export type PackIconKey = 'coins' | 'megaphone' | 'eye' | 'wrench'

export function packIconKey(pack: { id: string; kind: string }): PackIconKey {
  switch (pack.id) {
    case 'finance':
      return 'coins'
    case 'marketer':
      return 'megaphone'
    case 'read_only':
    case 'read-only':
      return 'eye'
    default:
      return pack.kind === 'custom' ? 'wrench' : 'eye'
  }
}

/** Initials fallback for a member with no avatar (RTL-safe, ASCII-only). */
export function memberInitials(name: string | null): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return '—'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || trimmed[0].toUpperCase()
}
