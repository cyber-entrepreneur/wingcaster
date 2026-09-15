import { cn } from '@/lib/utils'
import type { ReasonCategory, SeverityTier, ComparableReportStatus } from './types'
import {
  REASON_CATEGORY_OPTIONS,
  SEVERITY_OPTIONS,
  STATUS_LABELS,
} from './copy'

/** Reason-category pill — token tints + glyph + label (never color alone). */
export function ReasonCategoryBadge({ category }: { category: ReasonCategory | string }) {
  const opt = REASON_CATEGORY_OPTIONS.find((o) => o.value === category)
  const label = opt?.label ?? category
  const glyph = opt?.glyph ?? '○'
  const tone = categoryTone(category)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold',
        tone.bg,
        tone.fg,
      )}
    >
      <span aria-hidden className={tone.dot}>
        {glyph}
      </span>
      {label}
    </span>
  )
}

function categoryTone(category: string): { bg: string; fg: string; dot: string } {
  switch (category) {
    case 'wrong_price':
    case 'wrong_area':
      return {
        bg: 'bg-[var(--lc-status-warning-bg)]',
        fg: 'text-[var(--lc-status-warning-fg)]',
        dot: 'text-[var(--lc-status-warning-dot)]',
      }
    case 'already_sold':
      return {
        bg: 'bg-[var(--lc-status-closed-bg)]',
        fg: 'text-[var(--lc-status-closed-fg)]',
        dot: 'text-[var(--lc-status-closed-dot)]',
      }
    case 'duplicate':
      return {
        bg: 'bg-[var(--lc-status-archived-bg)]',
        fg: 'text-[var(--lc-status-archived-fg)]',
        dot: 'text-[var(--lc-status-archived-dot)]',
      }
    case 'spam':
      return {
        bg: 'bg-[var(--lc-status-danger-bg)]',
        fg: 'text-[var(--lc-status-danger-fg)]',
        dot: 'text-[var(--lc-status-danger-dot)]',
      }
    default:
      return {
        bg: 'bg-[var(--lc-status-draft-bg)]',
        fg: 'text-[var(--lc-status-draft-fg)]',
        dot: 'text-[var(--lc-status-draft-dot)]',
      }
  }
}

/** Severity pill — Critical shares danger tint with High but uses ✕ glyph. */
export function SeverityBadge({ severity }: { severity: SeverityTier | string }) {
  const opt = SEVERITY_OPTIONS.find((o) => o.value === severity)
  const label = opt?.label ?? severity
  const glyph = opt?.glyph ?? '●'
  const tone =
    severity === 'low'
      ? {
          bg: 'bg-[var(--lc-status-published-bg)]',
          fg: 'text-[var(--lc-status-published-fg)]',
          dot: 'text-[var(--lc-status-published-dot)]',
        }
      : severity === 'medium'
        ? {
            bg: 'bg-[var(--lc-status-warning-bg)]',
            fg: 'text-[var(--lc-status-warning-fg)]',
            dot: 'text-[var(--lc-status-warning-dot)]',
          }
        : {
            bg: 'bg-[var(--lc-status-danger-bg)]',
            fg: 'text-[var(--lc-status-danger-fg)]',
            dot: 'text-[var(--lc-status-danger-dot)]',
          }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold',
        tone.bg,
        tone.fg,
      )}
    >
      <span aria-hidden className={tone.dot}>
        {glyph}
      </span>
      {label}
    </span>
  )
}

export function ReportStatusBadge({ status }: { status: ComparableReportStatus | string }) {
  const label = STATUS_LABELS[status] ?? status
  const tone =
    status === 'pending' || status === 'pending_second_approval' || status === 'REMOVE_PROPOSED'
      ? {
          bg: 'bg-[var(--lc-status-underOffer-bg)]',
          fg: 'text-[var(--lc-status-underOffer-fg)]',
          glyph: '◐',
        }
      : status === 'confirmed_removed'
        ? {
            bg: 'bg-[var(--lc-status-published-bg)]',
            fg: 'text-[var(--lc-status-published-fg)]',
            glyph: '●',
          }
        : status === 'confirmed_quarantined' || status === 'awaiting_info'
          ? {
              bg: 'bg-[var(--lc-status-warning-bg)]',
              fg: 'text-[var(--lc-status-warning-fg)]',
              glyph: '▲',
            }
          : status === 'rejected'
            ? {
                bg: 'bg-[var(--lc-status-unpublished-bg)]',
                fg: 'text-[var(--lc-status-unpublished-fg)]',
                glyph: '✕',
              }
            : {
                bg: 'bg-[var(--lc-status-archived-bg)]',
                fg: 'text-[var(--lc-status-archived-fg)]',
                glyph: '▢',
              }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold',
        tone.bg,
        tone.fg,
      )}
    >
      <span aria-hidden>{tone.glyph}</span>
      {label}
    </span>
  )
}

export function formatRelativeSubmitted(iso: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const deltaSec = Math.round((Date.now() - then) / 1000)
  if (deltaSec < 60) return 'just now'
  const mins = Math.round(deltaSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function formatSlaChip(hoursRemaining: number): {
  label: string
  tone: 'green' | 'amber' | 'danger'
} {
  const h = Math.abs(Math.round(hoursRemaining * 10) / 10)
  if (hoursRemaining < 0) {
    return {
      label: `Review SLA breached by ${h}h`,
      tone: 'danger',
    }
  }
  if (hoursRemaining < 6) {
    return { label: `${h}h left · at risk`, tone: 'danger' }
  }
  if (hoursRemaining <= 24) {
    return { label: `${h}h left · at risk`, tone: 'amber' }
  }
  return { label: `${h}h left`, tone: 'green' }
}

export function slaToneClass(tone: 'green' | 'amber' | 'danger'): string {
  if (tone === 'green') return 'text-[var(--lc-status-published-fg)]'
  if (tone === 'amber') return 'text-[var(--lc-status-warning-fg)]'
  return 'text-[var(--lc-status-danger-fg)]'
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}
