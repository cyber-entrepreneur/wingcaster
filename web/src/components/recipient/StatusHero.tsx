import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Hourglass,
  Layers,
  Undo2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Numeric } from '@/components/ui/numeric'

/**
 * REC-family status hero — glyph + label + timestamp band.
 *
 * Used by: AGT-REC-002, AGT-REC-003, AGT-REC-004, AGT-REC-005, AGT-REC-006,
 * AGT-PUB-003 (via AggregateOutcomeHero adapter).
 *
 * `emphasis="loud"` may run `--lc-action-primary` as the band background
 * (approval / incorporated moments only). REC-002 APPROVED-AND-QUARANTINED
 * and REC-003 APPROVED-AS-SIGNAL-ONLY must pass `emphasis="default"` even
 * when `state="approved"`.
 */
export type StatusHeroProps = {
  state: 'pending' | 'approved' | 'rejected' | 'expired' | 'withdrawn' | 'superseded' | 'more_info'
  /** Required — no default; brief must supply per-screen wording. */
  label: string
  /** ISO 8601; rendered as relative + absolute via `<Numeric>`. */
  timestamp?: string
  /** Override; default per state (see resolveSurface). */
  glyph?: LucideIcon
  /**
   * `'loud'` = allowed to run `--lc-action-primary` as bg (approval only).
   * `'default'` = calm / provisional surfaces (quarantined, signal-only).
   */
  emphasis?: 'default' | 'loud'
}

type SurfaceSpec = {
  Glyph: LucideIcon
  bandClass: string
  inkClass: string
  glyphClass: string
  glyphChip?: boolean
  timestampMuted: boolean
}

/**
 * State → glyph + surface map (AGT-REC-004 anchor).
 * Loud orange only when `state === 'approved' && emphasis === 'loud'`.
 */
function resolveSurface(
  state: StatusHeroProps['state'],
  emphasis: 'default' | 'loud',
): SurfaceSpec {
  if (state === 'approved' && emphasis === 'loud') {
    return {
      Glyph: CheckCircle2,
      bandClass: 'bg-[var(--lc-action-primary)]',
      inkClass: 'text-[var(--lc-action-primary-text)]',
      glyphClass: 'text-[var(--lc-action-primary)]',
      glyphChip: true,
      timestampMuted: false,
    }
  }

  switch (state) {
    case 'pending':
      return {
        Glyph: Clock,
        bandClass: 'bg-[var(--lc-surface-sunken)] border-b border-[var(--lc-border)]',
        inkClass: 'text-[var(--lc-text-primary)]',
        glyphClass: 'text-[var(--lc-text-primary)]',
        timestampMuted: true,
      }
    case 'approved':
      // emphasis="default" — quarantine / signal-only provisional acceptance
      return {
        Glyph: CheckCircle2,
        bandClass: 'bg-[var(--lc-surface-sunken)]',
        inkClass: 'text-[var(--lc-text-primary)]',
        glyphClass: 'text-[var(--lc-accent-bold-edge)]',
        timestampMuted: true,
      }
    case 'rejected':
      return {
        Glyph: XCircle,
        bandClass:
          'bg-[var(--lc-surface-raised)] border-t-4 border-t-[var(--lc-status-closed-fg)]',
        inkClass: 'text-[var(--lc-text-primary)]',
        glyphClass: 'text-[var(--lc-status-closed-fg)]',
        timestampMuted: true,
      }
    case 'expired':
      return {
        Glyph: Hourglass,
        bandClass:
          'bg-[var(--lc-surface-sunken)] border-t-4 border-t-[var(--lc-text-muted)]',
        inkClass: 'text-[var(--lc-text-muted)]',
        glyphClass: 'text-[var(--lc-text-muted)]',
        timestampMuted: true,
      }
    case 'withdrawn':
      return {
        // Brief maps ArrowUturnLeft → lucide Undo2 (no ArrowUturnLeft in lucide-react).
        Glyph: Undo2,
        bandClass: 'bg-[var(--lc-surface-sunken)]',
        inkClass: 'text-[var(--lc-text-muted)]',
        glyphClass: 'text-[var(--lc-text-muted)]',
        timestampMuted: true,
      }
    case 'superseded':
      return {
        Glyph: Layers,
        bandClass: 'bg-[var(--lc-surface-sunken)]',
        inkClass: 'text-[var(--lc-text-muted)]',
        glyphClass: 'text-[var(--lc-text-muted)]',
        timestampMuted: true,
      }
    case 'more_info':
      return {
        Glyph: AlertCircle,
        bandClass:
          'bg-[var(--lc-surface-raised)] border-t-4 border-t-[var(--lc-status-warning-fg)]',
        inkClass: 'text-[var(--lc-text-primary)]',
        glyphClass: 'text-[var(--lc-status-warning-fg)]',
        timestampMuted: true,
      }
  }
}

/** Stub relative+absolute display; consumer waves may swap in a real formatter. */
function formatTimestampStub(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function StatusHero({
  state,
  label,
  timestamp,
  glyph,
  emphasis = 'default',
}: StatusHeroProps) {
  const surface = resolveSurface(state, emphasis)
  const Glyph = glyph ?? surface.Glyph
  const labelId = 'status-hero-label'

  return (
    <section
      aria-labelledby={labelId}
      className={cn(
        'w-full px-[var(--lc-space-md)] py-[var(--lc-space-lg)] transition-colors duration-base ease-out motion-reduce:transition-none',
        surface.bandClass,
        surface.inkClass,
      )}
    >
      <div className="mx-auto flex max-w-[1200px] items-start gap-[var(--lc-space-md)]">
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full',
            surface.glyphChip ? 'bg-[var(--lc-action-primary-text)] p-2' : 'p-1',
          )}
          aria-hidden="true"
        >
          <Glyph className={cn('h-7 w-7 md:h-8 md:w-8', surface.glyphClass)} />
        </span>
        <div className="min-w-0 flex-1 text-start">
          <h1
            id={labelId}
            className="text-start"
            style={{
              font: 'var(--lc-type-heading-2)',
              letterSpacing: 'var(--lc-tracking-heading-2)',
            }}
          >
            {label}
          </h1>
          {timestamp ? (
            <Numeric
              className={cn(
                'mt-[var(--lc-space-xs)] block',
                surface.timestampMuted
                  ? 'text-[var(--lc-text-muted)]'
                  : 'text-[var(--lc-action-primary-text)] opacity-90',
              )}
              style={{ font: 'var(--lc-type-caption)' }}
              aria-label={`Status timestamp ${formatTimestampStub(timestamp)}`}
            >
              {formatTimestampStub(timestamp)}
            </Numeric>
          ) : null}
        </div>
      </div>
    </section>
  )
}
