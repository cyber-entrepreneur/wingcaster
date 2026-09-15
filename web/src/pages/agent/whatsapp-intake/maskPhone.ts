/**
 * Privacy mask for bound WhatsApp numbers (AGT-WLB-003).
 * Preserves country code + last 2 digits. UAE example: +971 5X XXX XX67
 */
export function maskPhoneE164(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length < 4) return String(raw)

  const last2 = digits.slice(-2)
  let country = ''
  let national = ''

  if (digits.startsWith('971') && digits.length >= 11) {
    country = '971'
    national = digits.slice(3)
  } else if (digits.startsWith('1') && digits.length === 11) {
    country = '1'
    national = digits.slice(1)
  } else if (digits.length > 10) {
    country = digits.slice(0, digits.length - 9)
    national = digits.slice(country.length)
  } else {
    country = digits.slice(0, 2)
    national = digits.slice(2)
  }

  const first = national.charAt(0) || 'X'
  return `+${country} ${first}X XXX XX${last2}`
}
