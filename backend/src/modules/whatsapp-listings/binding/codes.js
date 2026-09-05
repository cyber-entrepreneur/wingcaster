export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function humanHintFromName(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'AGENT'
  const stripped = first.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return stripped || 'AGENT'
}

export function formatDisplayCode(code, firstName) {
  return `WC-${code}-${humanHintFromName(firstName)}`
}
