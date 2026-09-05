export function toE164(raw) {
  const source = String(raw || '').trim()
  if (!source) return ''
  const digits = source.replace(/[^\d]/g, '')
  if (!digits) return ''
  return `+${digits}`
}

export function digitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '')
}

export function maskPhone(e164) {
  const digits = digitsOnly(e164)
  if (digits.length < 6) return digits ? `+${digits}` : ''
  const cc = digits.startsWith('1') && digits.length === 11
    ? '1'
    : digits.slice(0, Math.max(1, digits.length - 9))
  return `+${cc} XX XXX ${digits.slice(-4)}`
}

export function formatLastUsed(iso, now = new Date()) {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'never'
  const delta = Math.max(0, now.getTime() - then)
  const minutes = Math.floor(delta / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
