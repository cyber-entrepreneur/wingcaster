/**
 * Shared relative + absolute timestamp formatting for REC-family surfaces.
 * Absolute always uses a stable en-GB day-first form so Numeric mono stays consistent.
 */

export function formatAbsoluteTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatRelativeTimestamp(iso: string, now = Date.now()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const diffMs = d.getTime() - now
  const absSec = Math.round(Math.abs(diffMs) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second')
  const absMin = Math.round(absSec / 60)
  if (absMin < 60) return rtf.format(Math.sign(diffMs) * absMin, 'minute')
  const absHr = Math.round(absMin / 60)
  if (absHr < 48) return rtf.format(Math.sign(diffMs) * absHr, 'hour')
  const absDay = Math.round(absHr / 24)
  if (absDay < 60) return rtf.format(Math.sign(diffMs) * absDay, 'day')
  const absMonth = Math.round(absDay / 30)
  return rtf.format(Math.sign(diffMs) * absMonth, 'month')
}

/** e.g. "Decided 2 hours ago · 07 Sep 2026, 14:22" */
export function formatRelativeAbsolute(
  iso: string,
  prefix?: string,
  now = Date.now(),
): string {
  const relative = formatRelativeTimestamp(iso, now)
  const absolute = formatAbsoluteTimestamp(iso)
  const body = `${relative} · ${absolute}`
  return prefix ? `${prefix} ${body}` : body
}
