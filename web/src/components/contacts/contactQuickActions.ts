/**
 * Deep-link "contact" quick actions for a contact row.
 *
 * Every action here is a pure client-side deep link built from the contact's own
 * email / phone / social handles — no backend. Actions are only returned when the
 * underlying data exists, so the menu never shows a dead link.
 */

export type QuickActionContact = {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  emails?: Array<{ label?: string; address?: string }> | null
  phones?: Array<{ label?: string; number?: string }> | null
  socials?: Partial<Record<
    'whatsapp' | 'telegram' | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'linkedin' | 'snapchat' | 'discord',
    string
  >> | null
}

export type ContactActionKey =
  | 'email' | 'call' | 'sms' | 'whatsapp' | 'telegram'
  | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'linkedin'

export type ContactAction = {
  key: ContactActionKey
  label: string
  href: string
  /** external links open in a new tab; tel/mailto/sms stay in-place. */
  external: boolean
}

function firstEmail(c: QuickActionContact): string {
  if (c.email && c.email.trim()) return c.email.trim()
  const row = (c.emails || []).find((e) => e && e.address && e.address.trim())
  return row?.address?.trim() || ''
}

function firstPhone(c: QuickActionContact): string {
  if (c.phone && c.phone.trim()) return c.phone.trim()
  const row = (c.phones || []).find((p) => p && p.number && p.number.trim())
  return row?.number?.trim() || ''
}

/** Digits only, for wa.me / tel-style targets. */
function digits(v: string): string {
  return (v || '').replace(/[^\d]/g, '')
}

/** Strip a leading @, and any known profile-URL prefix, to get a bare handle. */
function handle(v: string): string {
  let s = (v || '').trim()
  s = s.replace(/^@/, '')
  s = s.replace(/^https?:\/\/(www\.)?[^/]+\//i, '') // drop scheme+host if a full URL was pasted
  return s.replace(/\/+$/, '')
}

/** True when the value looks like a full URL the user pasted verbatim. */
function isUrl(v: string): boolean {
  return /^https?:\/\//i.test((v || '').trim())
}

function socialProfile(raw: string | undefined, base: string): string {
  const v = (raw || '').trim()
  if (!v) return ''
  return isUrl(v) ? v : `${base}${handle(v)}`
}

/**
 * Build the available "contact" deep-link actions for a contact, in a stable
 * order. Only actions whose data exists are returned.
 */
export function buildContactActions(contact: QuickActionContact): ContactAction[] {
  const actions: ContactAction[] = []
  const email = firstEmail(contact)
  const phone = firstPhone(contact)
  const s = contact.socials || {}

  if (email) actions.push({ key: 'email', label: `Email ${email}`, href: `mailto:${email}`, external: false })
  if (phone) actions.push({ key: 'call', label: `Call ${phone}`, href: `tel:${phone}`, external: false })

  const waTarget = digits(s.whatsapp || '') || digits(phone)
  if (waTarget) actions.push({ key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/${waTarget}`, external: true })

  if (phone) actions.push({ key: 'sms', label: 'SMS', href: `sms:${phone}`, external: false })

  if (s.telegram && s.telegram.trim()) {
    const t = s.telegram.trim()
    actions.push({ key: 'telegram', label: 'Telegram', href: isUrl(t) ? t : `https://t.me/${handle(t)}`, external: true })
  }

  const ig = socialProfile(s.instagram, 'https://instagram.com/')
  if (ig) actions.push({ key: 'instagram', label: 'Instagram', href: ig, external: true })
  const fb = socialProfile(s.facebook, 'https://facebook.com/')
  if (fb) actions.push({ key: 'facebook', label: 'Facebook', href: fb, external: true })
  const tw = socialProfile(s.twitter, 'https://x.com/')
  if (tw) actions.push({ key: 'twitter', label: 'X / Twitter', href: tw, external: true })
  const tk = s.tiktok && s.tiktok.trim()
    ? (isUrl(s.tiktok) ? s.tiktok.trim() : `https://tiktok.com/@${handle(s.tiktok)}`)
    : ''
  if (tk) actions.push({ key: 'tiktok', label: 'TikTok', href: tk, external: true })
  const li = socialProfile(s.linkedin, 'https://linkedin.com/in/')
  if (li) actions.push({ key: 'linkedin', label: 'LinkedIn', href: li, external: true })

  return actions
}
