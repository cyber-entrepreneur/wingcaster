import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/**
 * Agency membership persona roles.
 *
 * Used across agency surfaces (AGN-MEM-*, AGN-ROL-*, AGN-DSH-001).
 * For the AGN-MEM-005 top-bar “Applying as…” / “Sign in” chip, use
 * `variant="apply"` (see {@link ApplyPersonaChipProps}).
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

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}

export type RolePersonaChipProps = {
  /** Default role-badge mode (AGN-MEM / AGN-ROL / AGN-DSH). */
  variant?: 'role'
  /** Agency role to display. */
  role: AgencyPersonaRole
  /** Override visible label (parent supplies i18n). Defaults to English role name. */
  label?: string
  className?: string
}

export type ApplyPersonaChipProps = {
  /**
   * AGN-MEM-005 top-bar / under-H1 persona chip:
   * anonymous → “Already have an account? Sign in”
   * signed-in → Avatar + “Applying as {name} · Not you? Sign out”
   */
  variant: 'apply'
  signedIn: boolean
  displayName?: string
  email?: string | null
  avatarUrl?: string | null
  /** Sign-in destination (default `/login` with returnTo left to parent). */
  signInHref?: string
  onSignOut?: () => void
  className?: string
}

export type PersonaChipProps = RolePersonaChipProps | ApplyPersonaChipProps

function RolePersonaChip({ role, label, className }: RolePersonaChipProps) {
  const text = label ?? PERSONA_LABEL[role]

  return (
    <Badge
      variant="outline"
      data-persona={role}
      data-persona-variant="role"
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

function ApplyPersonaChipView({
  signedIn,
  displayName,
  email,
  avatarUrl,
  signInHref = '/login',
  onSignOut,
  className,
}: ApplyPersonaChipProps) {
  if (!signedIn) {
    return (
      <p
        data-persona-variant="apply"
        data-persona-state="anonymous"
        className={cn(
          'text-[var(--lc-text-secondary)]',
          className,
        )}
        style={{ font: 'var(--lc-type-body-sm)' }}
      >
        Already have an account?{' '}
        <Link
          to={signInHref}
          className="font-semibold text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    )
  }

  const name = displayName?.trim() || 'You'
  const masked = email ? maskEmail(email) : null

  return (
    <div
      data-persona-variant="apply"
      data-persona-state="signed-in"
      className={cn(
        'flex min-h-[var(--lc-tap-target-min)] items-center gap-[var(--lc-space-xs)]',
        'rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-sm)] py-1',
        className,
      )}
    >
      <Avatar className="h-8 w-8 rounded-[var(--lc-radius-pill)]">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="rounded-[var(--lc-radius-pill)] text-[var(--lc-type-caption)]">
          {monogram(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0" style={{ font: 'var(--lc-type-body-sm)' }}>
        <span className="text-[var(--lc-text-secondary)]">Applying as </span>
        <span className="font-semibold text-[var(--lc-text-heading)]">{name}</span>
        {masked ? (
          <span className="text-[var(--lc-text-muted)]"> · {masked}</span>
        ) : null}
        <span className="text-[var(--lc-text-muted)]">
          {' '}
          · Not you?{' '}
          <button
            type="button"
            className={cn(
              'min-h-[var(--lc-tap-target-min)] font-medium text-[var(--lc-text-brand)]',
              'underline-offset-2 hover:underline',
            )}
            onClick={onSignOut}
          >
            Sign out
          </button>
        </span>
      </div>
    </div>
  )
}

/**
 * Compact role badge **or** AGN-MEM-005 apply-flow identity chip.
 *
 * - `variant="role"` (default): owner | admin | member | applicant badge.
 * - `variant="apply"`: anonymous Sign-in link or signed-in “Applying as…” strip.
 *
 * Used by: AGN-MEM-001/002/002b, AGN-ROL-001/002, AGN-DSH-001, AGN-MEM-005.
 */
export function PersonaChip(props: PersonaChipProps) {
  if (props.variant === 'apply') {
    return <ApplyPersonaChipView {...props} />
  }
  return <RolePersonaChip {...props} />
}
