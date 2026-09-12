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
import { formatRelativeAbsolute } from './formatRelativeAbsolute'

/**
 * REC-family status hero — glyph + label + timestamp band.
 *
 * Used by: AGT-REC-002, AGT-REC-003, AGT-REC-004, AGT-REC-005, AGT-REC-006,
 * AGT-PUB-003 (via AggregateOutcomeHero adapter).
 *
 * `emphasis="loud"` may run `--lc-action-primary` as the band background
 * (APPROVED-AND-REMOVED / APPROVED-AND-INCORPORATED only). Defaults to
 * `'default'` so accidental loud orange cannot happen.
 *
 * Wave 5 consumers of calm approved surfaces (must pass `emphasis="default"`
 * or omit the prop even when `state="approved"`):
 * - AGT-REC-002 APPROVED-AND-QUARANTINED — sunken + CheckCircle2 in
 *   `--lc-accent-bold-edge`
 * - AGT-REC-003 APPROVED-AS-SIGNAL-ONLY — same provisional grammar
 */
export type StatusHeroProps = {
  state: 'pending' | 'approved' | 'rejected' | 'expired' | 'withdrawn' | 'superseded' | 'more_info'
  /** Required — no default; brief must supply per-screen wording. */
  label: string
  /** ISO 8601; rendered as relative + absolute via `<Numeric>`. */
  timestamp?: string
  /**
   * Optional verb prefix before the relative clock, e.g. "Decided", "Submitted".
   * Renders `{prefix} {relative} · {absolute}`.
   */
  timestampPrefix?: string
  /** Override; default per state (see resolveSurface). */
  glyph?: LucideIcon
  /**
   * `'loud'` = allowed to run `--lc-action-primary` as bg (approval only).
   * `'default'` (prop default) = calm / provisional surfaces for
   * REC-002 quarantine + REC-003 signal-only.
   */
  emphasis?: 'default' | 'loud'
  className?: string
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
      // emphasis="default" — REC-002 APPROVED-AND-QUARANTINED /
      // REC-003 APPROVED-AS-SIGNAL-ONLY provisional acceptance
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

export function StatusHero({
  state,
  label,
  timestamp,
  timestampPrefix,
  glyph,
  emphasis = 'default',
  className,
}: StatusHeroProps) {
  const surface = resolveSurface(state, emphasis)
  const Glyph = glyph ?? surface.Glyph
  const labelId = 'status-hero-label'
  const displayTs = timestamp
    ? formatRelativeAbsolute(timestamp, timestampPrefix)
    : null

  return (
    <section
      aria-labelledby={labelId}
      data-rec-status={state}
      data-rec-emphasis={emphasis}
      className={cn(
        'w-full px-[var(--lc-space-md)] py-[var(--lc-space-xl)] transition-colors duration-[var(--lc-duration-base)] ease-[var(--lc-easing-out)] motion-reduce:transition-none',
        surface.bandClass,
        surface.inkClass,
        className,
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
            className="text-start [font:var(--lc-type-heading-2)] [letter-spacing:var(--lc-tracking-heading-2)] md:[font:var(--lc-type-heading-1)] md:[letter-spacing:var(--lc-tracking-heading-1)]"
          >
            {label}
          </h1>
          {displayTs ? (
            <Numeric
              className={cn(
                'mt-[var(--lc-space-xs)] block',
                surface.timestampMuted
                  ? 'text-[var(--lc-text-muted)]'
                  : 'text-[var(--lc-action-primary-text)] opacity-90',
              )}
              style={{ font: 'var(--lc-type-caption)' }}
              aria-label={`Status timestamp ${displayTs}`}
            >
              {displayTs}
            </Numeric>
          ) : null}
        </div>
      </div>
    </section>
  )
}
