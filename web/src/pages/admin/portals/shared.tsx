/**
 * PA-POR shared presentational helpers (list · detail · history).
 * Status tokens map to the real Broadcast palette — there are no
 * --lc-status-warning-* / --lc-status-danger-* tokens, so warning→underOffer
 * and danger→unpublished (see broadcast-theme.css).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { PortalAdapterStatus } from './types'

/** Status tokens present in broadcast-theme.css. */
export type StatusToken =
  | 'published'
  | 'underOffer'
  | 'unpublished'
  | 'draft'
  | 'closed'
  | 'archived'

export function ToneBadge({
  glyph,
  label,
  token,
  title,
}: {
  glyph: string
  label: ReactNode
  token: StatusToken
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] px-2 py-0.5',
        'text-[length:var(--lc-type-caption,0.75rem)] font-semibold',
      )}
      style={{
        background: `var(--lc-status-${token}-bg)`,
        color: `var(--lc-status-${token}-fg)`,
      }}
    >
      <span aria-hidden="true" style={{ color: `var(--lc-status-${token}-dot)` }}>
        {glyph}
      </span>
      {label}
    </span>
  )
}

export function adapterStatusToken(status: PortalAdapterStatus): { glyph: string; token: StatusToken } {
  switch (status) {
    case 'live':
      return { glyph: '●', token: 'published' }
    case 'deprecated':
      return { glyph: '▢', token: 'archived' }
    default:
      return { glyph: '○', token: 'draft' }
  }
}

export function activeStatusToken(isActive: boolean, hasPending: boolean): { glyph: string; token: StatusToken } {
  if (hasPending) return { glyph: '◐', token: 'underOffer' }
  return isActive ? { glyph: '●', token: 'published' } : { glyph: '▢', token: 'archived' }
}

/** Desktop-min guard (PA console is desktop-only ≥1024px). */
export function useDesktopMin(): boolean {
  const [ok, setOk] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setOk(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return ok
}

/**
 * Deterministic relative time, locale-aware (frozen Date.now() safe in tests).
 *
 * Uses `Intl.RelativeTimeFormat` so Arabic renders real MENA formatting (e.g.
 * `منذ ٥ دقائق`) — never English "5m ago" leaking under `ar` locale.
 * Consumers should pass the app locale from `useLocale()`; defaults to `'en'`.
 */
export function relativeTime(
  iso: string | null | undefined,
  locale: 'en' | 'ar' = 'en',
): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return String(iso)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' })
  const diffMs = Date.now() - then
  const past = diffMs >= 0
  const abs = Math.abs(diffMs)
  const mins = Math.round(abs / 60_000)
  if (mins < 1) return rtf.format(0, 'second')
  if (mins < 60) return rtf.format(past ? -mins : mins, 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 48) return rtf.format(past ? -hours : hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 14) return rtf.format(past ? -days : days, 'day')
  const weeks = Math.round(days / 7)
  if (weeks < 8) return rtf.format(past ? -weeks : weeks, 'week')
  const months = Math.round(days / 30)
  if (months < 24) return rtf.format(past ? -months : months, 'month')
  const years = Math.round(days / 365)
  return rtf.format(past ? -years : years, 'year')
}

export function portalMonogram(code: string, displayName: string): string {
  const source = (displayName || code || '?').trim()
  return source.charAt(0).toUpperCase() || '?'
}

export function featureCode(code: string): string {
  return `PUBLISHING_REALESTATE_${String(code || '').toUpperCase()}`
}

export function countryFlagEmoji(iso: string): string {
  const cc = String(iso || '').trim().toUpperCase()
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return ''
  const A = 0x1f1e6
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65))
}
