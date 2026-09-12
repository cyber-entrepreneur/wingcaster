import type { CompletedVia } from './types'
import { completedViaPhrase } from './copy'

/** Relative timestamp for captions. Numerals are wrapped by the caller in `<Numeric>`. */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diffMs = then - Date.now()
  const abs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' })
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (abs < minute) return rtf.format(Math.round(diffMs / 1000), 'second')
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), 'day')
  return rtf.format(Math.round(diffMs / (30 * day)), 'month')
}

export function completedCaption(
  via: CompletedVia | string | null | undefined,
  completedAt: string | null | undefined,
): string {
  const when = formatRelativeTime(completedAt)
  const autoSources = new Set(['onboarding', 'whatsapp_intake', 'dashboard_action', 'bulk_import'])
  if (via && autoSources.has(via)) {
    const source = completedViaPhrase(via)
    return when ? `Completed via ${source} — ${when}` : `Completed via ${source}`
  }
  return when ? `Completed — ${when}` : 'Completed'
}

export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  const digits = e164.replace(/\D/g, '')
  if (digits.length < 4) return e164
  const last2 = digits.slice(-2)
  if (digits.startsWith('971')) return `+971 5X XXX XX${last2}`
  const ccLen = digits.length > 10 ? digits.length - 10 : Math.min(3, digits.length - 2)
  const cc = digits.slice(0, ccLen)
  return `+${cc} ••• ••• ${last2}`
}

export function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []
  for (const token of tokens) {
    if (seen.has(token)) continue
    seen.add(token)
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) valid.push(token)
    else invalid.push(token)
  }
  return { valid: valid.slice(0, 50), invalid }
}
