const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const deltaSec = Math.round((now - then) / 1000)
  if (deltaSec < 45) return 'just now'
  if (deltaSec < HOUR) {
    const n = Math.max(1, Math.round(deltaSec / MINUTE))
    return n === 1 ? '1 minute ago' : `${n} minutes ago`
  }
  if (deltaSec < DAY) {
    const n = Math.max(1, Math.round(deltaSec / HOUR))
    return n === 1 ? '1 hour ago' : `${n} hours ago`
  }
  const n = Math.max(1, Math.round(deltaSec / DAY))
  return n === 1 ? '1 day ago' : `${n} days ago`
}

export function formatLongDate(iso: string | null | undefined, locale = 'en'): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatShortDate(iso: string | null | undefined, locale = 'en'): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(clamped / 60)
  const ss = clamped % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '••••'
  const [local, domain] = email.split('@')
  const first = local.slice(0, 1) || '•'
  return `${first}•••@${domain}`
}

export function initialsFromName(name: string | null | undefined): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}
