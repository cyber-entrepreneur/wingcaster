/**
 * Build a wa.me deep-link with the message pre-filled.
 * Strips non-digits from the E.164 number; URL-encodes the text.
 */
export function buildWaMeLink(e164: string, text: string): string {
  const digits = String(e164 ?? '').replace(/\D/g, '')
  const encoded = encodeURIComponent(String(text ?? ''))
  if (!digits) return encoded ? `https://wa.me/?text=${encoded}` : 'https://wa.me/'
  return `https://wa.me/${digits}?text=${encoded}`
}

/** `tel:` href for desktop fallback dial. */
export function buildTelLink(e164: string): string {
  const digits = String(e164 ?? '').replace(/\D/g, '')
  return digits ? `tel:+${digits}` : 'tel:'
}
