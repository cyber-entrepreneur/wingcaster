/**
 * AGT-CTC-005 — Contact export serializers.
 *
 * Pure, side-effect-free helpers that turn contact rows into a downloadable
 * CSV or vCard payload. Kept separate from the route so they can be unit tested
 * without booting Express or a database.
 */

// Fields a Pro agent may pick for a CSV export. Order here is the column order.
// The set is GDPR-minded: it exposes provenance (source, first-touch) and
// activity metadata so an exported book of business is auditable.
export const EXPORTABLE_FIELDS = [
  'name',
  'email',
  'phone',
  'status',
  'source',
  'tags',
  'first_touch_channel',
  'first_touch_at',
  'last_activity_at',
  'created_at',
]

const FIELD_HEADERS = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  status: 'Status',
  source: 'Source',
  tags: 'Tags',
  first_touch_channel: 'First touch channel',
  first_touch_at: 'First touch at',
  last_activity_at: 'Last activity at',
  created_at: 'Created at',
}

/** Keep only known fields, preserving the canonical column order. */
export function resolveFields(requested) {
  if (!requested) return [...EXPORTABLE_FIELDS]
  const wanted = new Set(
    (Array.isArray(requested) ? requested : String(requested).split(','))
      .map((f) => f.trim())
      .filter(Boolean),
  )
  const resolved = EXPORTABLE_FIELDS.filter((f) => wanted.has(f))
  return resolved.length > 0 ? resolved : [...EXPORTABLE_FIELDS]
}

function cellValue(contact, field) {
  const raw = contact[field]
  if (raw == null) return ''
  if (field === 'tags') return Array.isArray(raw) ? raw.join('; ') : String(raw)
  return String(raw)
}

/** RFC-4180 escaping: wrap in quotes when the value has a comma, quote or newline. */
function escapeCsv(value) {
  const s = String(value ?? '')
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function contactsToCsv(contacts, requestedFields) {
  const fields = resolveFields(requestedFields)
  const header = fields.map((f) => escapeCsv(FIELD_HEADERS[f] || f)).join(',')
  const rows = (contacts || []).map((c) => fields.map((f) => escapeCsv(cellValue(c, f))).join(','))
  // Leading BOM so Excel opens UTF-8 correctly.
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`
}

function escapeVCard(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function contactToVCard(contact, now = new Date()) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  const name = contact.name || contact.email || contact.phone || 'Unknown'
  lines.push(`FN:${escapeVCard(name)}`)
  lines.push(`N:${escapeVCard(name)};;;;`)
  if (contact.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(contact.email)}`)
  if (contact.phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(contact.phone)}`)
  const noteParts = []
  if (contact.status) noteParts.push(`Status: ${contact.status}`)
  if (contact.source) noteParts.push(`Source: ${contact.source}`)
  if (Array.isArray(contact.tags) && contact.tags.length) noteParts.push(`Tags: ${contact.tags.join(', ')}`)
  if (noteParts.length) lines.push(`NOTE:${escapeVCard(noteParts.join(' | '))}`)
  lines.push(`REV:${now.toISOString()}`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export function contactsToVCard(contacts, now = new Date()) {
  return `${(contacts || []).map((c) => contactToVCard(c, now)).join('\r\n')}\r\n`
}

/** Build the file payload + metadata for a given format. */
export function buildContactExport({ contacts, format = 'csv', fields, now = new Date() } = {}) {
  const stamp = now.toISOString().slice(0, 10)
  if (format === 'vcard') {
    return {
      body: contactsToVCard(contacts, now),
      contentType: 'text/vcard; charset=utf-8',
      filename: `contacts-${stamp}.vcf`,
      rows: (contacts || []).length,
    }
  }
  if (format === 'csv') {
    return {
      body: contactsToCsv(contacts, fields),
      contentType: 'text/csv; charset=utf-8',
      filename: `contacts-${stamp}.csv`,
      rows: (contacts || []).length,
    }
  }
  const err = new Error(`Unsupported export format: ${format}`)
  err.code = 'INVALID_FORMAT'
  throw err
}
