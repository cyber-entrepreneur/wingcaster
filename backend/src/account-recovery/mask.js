/**
 * Pure PII maskers for account-recovery PA surfaces (list + detail).
 * Shared by BE-ACR-01 / BE-ACR-09; reveal UI uses these alongside full values.
 */

function asString(value) {
  if (value == null) return ''
  return String(value).trim()
}

/**
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  const raw = asString(email)
  const at = raw.indexOf('@')
  if (at <= 0) return raw ? '***' : ''
  const local = raw.slice(0, at)
  const domain = raw.slice(at + 1)
  if (!domain) return `${local.slice(0, 1)}***@***`
  const parts = domain.split('.')
  const tld = parts.length > 1 ? parts[parts.length - 1] : ''
  const domainHead = parts[0] || ''
  const localVisible = local.slice(0, Math.min(1, local.length))
  const domainMask = '*'.repeat(Math.max(8, Math.min(domainHead.length, 12)))
  return `${localVisible}***@${domainMask}${tld ? `.${tld}` : ''}`
}

/**
 * Mask phone preserving country hint + last 2 digits.
 * Example: +971 5X XXX XX12
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  const raw = asString(phone)
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  const hasPlus = raw.trim().startsWith('+')
  // Heuristic CC: NANP (+1) or first 1–3 digits for longer international numbers.
  let ccLen = 1
  if (digits.length >= 11 && digits.startsWith('1')) ccLen = 1
  else if (digits.length >= 12) ccLen = 3
  else if (digits.length >= 10) ccLen = 2
  else ccLen = Math.min(3, Math.max(1, digits.length - 7))

  const cc = digits.slice(0, ccLen)
  const national = digits.slice(ccLen)
  const last2 = national.slice(-2)
  const mid = national.slice(0, -2)
  let midMasked = ''
  if (mid.length <= 1) {
    midMasked = mid.replace(/\d/g, 'X')
  } else {
    // Keep first national digit as X-group shape similar to brief examples.
    const groups = []
    let i = 0
    if (mid.length > 0) {
      groups.push('X')
      i = 1
    }
    while (i < mid.length) {
      const chunk = mid.slice(i, i + 3)
      groups.push('X'.repeat(chunk.length))
      i += 3
    }
    midMasked = groups.join(' ')
  }
  const prefix = hasPlus || raw.includes('+') ? `+${cc}` : cc
  if (!midMasked) return `${prefix} XX${last2}`
  return `${prefix} ${midMasked} XX${last2}`.replace(/\s+/g, ' ').trim()
}

/**
 * @param {string} username
 * @returns {string}
 */
export function maskUsername(username) {
  const raw = asString(username)
  if (!raw) return ''
  if (raw.length <= 2) return `${raw.slice(0, 1)}*`
  if (raw.length <= 4) return `${raw.slice(0, 2)}${'*'.repeat(raw.length - 2)}`
  return `${raw.slice(0, 2)}${'*'.repeat(Math.max(4, raw.length - 4))}${raw.slice(-2)}`
}

/**
 * @param {string} name
 * @returns {string}
 */
export function maskDisplayName(name) {
  const raw = asString(name)
  if (!raw) return ''
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    const w = parts[0]
    return w.length <= 1 ? '*' : `${w.slice(0, 1)}${'*'.repeat(Math.max(4, w.length - 1))}`
  }
  const first = parts[0]
  const rest = parts.slice(1).map((p) => (p.length ? `${p.slice(0, 1)}${'*'.repeat(Math.max(4, p.length - 1))}` : ''))
  return [first, ...rest].join(' ')
}

/**
 * Mask IPv4 / IPv6 keeping a coarse prefix.
 * @param {string} ip
 * @returns {string}
 */
export function maskIp(ip) {
  const raw = asString(ip)
  if (!raw) return ''
  if (raw.includes(':')) {
    const parts = raw.split(':').filter((p, idx, arr) => !(p === '' && arr[idx - 1] === ''))
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}:****`
    return '****'
  }
  const octets = raw.split('.')
  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.XXX.XXX`
  }
  return 'XXX.XXX.XXX.XXX'
}

/**
 * Shorten / mask user-agent into a coarse device · browser label when possible.
 * @param {string} ua
 * @returns {string}
 */
export function maskUserAgent(ua) {
  const raw = asString(ua)
  if (!raw) return ''
  let device = 'Device'
  let browser = 'Browser'
  if (/iPhone/i.test(raw)) device = 'iPhone'
  else if (/Android/i.test(raw)) device = 'Android'
  else if (/iPad/i.test(raw)) device = 'iPad'
  else if (/Macintosh|Mac OS/i.test(raw)) device = 'Mac'
  else if (/Windows/i.test(raw)) device = 'Windows'
  else if (/Linux/i.test(raw)) device = 'Linux'

  if (/Edg\//i.test(raw)) browser = 'Edge'
  else if (/Chrome\//i.test(raw) && !/Chromium/i.test(raw)) browser = 'Chrome'
  else if (/Firefox\//i.test(raw)) browser = 'Firefox'
  else if (/Safari\//i.test(raw) && !/Chrome\//i.test(raw)) browser = 'Safari'

  const versionMatch = raw.match(/(?:Edg|Chrome|Firefox|Version)\/(\d+)/i)
  const ver = versionMatch ? ` ${versionMatch[1]}` : ''
  return `${device} · ${browser}${ver}`
}

/**
 * Best-effort reason category for queue chips.
 * @param {string} reason
 * @param {string|null|undefined} explicit
 * @returns {string|null}
 */
export function deriveReasonCategory(reason, explicit = null) {
  if (explicit) return String(explicit)
  const text = asString(reason).toLowerCase()
  if (!text) return null
  if (/phish|compromis|hack|takeover|suspicious/.test(text)) return 'compromised_account'
  if (/phone|sms|sim|whatsapp/.test(text)) return 'lost_phone'
  if (/email|inbox|mail/.test(text)) return 'lost_email'
  if (/2fa|totp|authenticator|mfa/.test(text)) return 'lost_2fa'
  return 'other'
}
