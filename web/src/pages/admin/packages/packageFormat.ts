/**
 * PA-PKG family pure formatting helpers (no React components — safe for
 * fast-refresh and reuse across pages).
 */
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  AED: 'AED ',
  SAR: 'SAR ',
  EGP: 'EGP ',
}

export function formatMoneyMinor(minor: number | null | undefined, currency = 'USD'): string {
  if (minor == null) return '—'
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `
  return `${symbol}${(Number(minor) / 100).toFixed(2)}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return String(iso)
  return new Date(t).toISOString().slice(0, 10)
}

/** Relative time; `now` is injectable so clock-dependent tests can freeze it. */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—'
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return String(iso)
  const deltaSec = Math.round((now - then) / 1000)
  if (deltaSec < 60) return 'just now'
  const mins = Math.round(deltaSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
