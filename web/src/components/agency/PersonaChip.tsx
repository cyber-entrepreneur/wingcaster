import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Agency membership persona roles.
 *
 * Used across agency surfaces (AGN-MEM-*, AGN-ROL-*, AGN-DSH-001, AGN-MEM-005 applicant).
 * Distinct from the AGN-MEM-005 top-bar "Applying as…" chip — that screen may compose
 * this badge for applicant, or a separate signed-in identity chip.
 */
export type AgencyPersonaRole = 'owner' | 'admin' | 'member' | 'applicant'

const PERSONA_LABEL: Record<AgencyPersonaRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  applicant: 'Applicant',
}

/**
 * Visual tone per role — Broadcast tokens only.
 * Owner / admin use accent emphasis; member is neutral; applicant is muted/archived tone.
 */
const PERSONA_CLASS: Record<AgencyPersonaRole, string> = {
  owner: cn(
    'border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent)]',
    'text-[var(--lc-accent-bold-text)]',
  ),
  admin: cn(
    'border border-[var(--lc-border-strong)] bg-[var(--lc-action-secondary)]',
    'text-[var(--lc-action-secondary-text)]',
  ),
  member: cn(
    'border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]',
    'text-[var(--lc-text-secondary)]',
  ),
  applicant: cn(
    'border border-transparent bg-[var(--lc-status-archived-bg)]',
    'text-[var(--lc-status-archived-fg)]',
  ),
}

export interface PersonaChipProps {
  /** Agency role to display. */
  role: AgencyPersonaRole
  /** Override visible label (parent supplies i18n). Defaults to English role name. */
  label?: string
  className?: string
}

/**
 * Compact role badge for agency membership persona:
 * `owner` | `admin` | `member` | `applicant`.
 *
 * Used by: AGN-MEM-001/002/002b, AGN-ROL-001/002, AGN-DSH-001, AGN-MEM-005.
 * Stub visual + prop types only — no API.
 */
export function PersonaChip({ role, label, className }: PersonaChipProps) {
  const text = label ?? PERSONA_LABEL[role]

  return (
    <Badge
      variant="outline"
      data-persona={role}
      className={cn(
        'rounded-[var(--lc-radius-pill)] font-semibold',
        PERSONA_CLASS[role],
        className,
      )}
    >
      {text}
    </Badge>
  )
}
