/**
 * AGT-CTC-005 — contact export serializer unit tests (no db, no Express).
 */
import { describe, expect, it } from 'vitest'
import {
  EXPORTABLE_FIELDS,
  buildContactExport,
  contactsToCsv,
  contactsToVCard,
  resolveFields,
} from './contact-export.js'

const contacts = [
  { id: 'c1', name: 'Alice Buyer', email: 'alice@example.com', phone: '+971500000001', status: 'active', source: 'whatsapp', tags: ['vip', 'warm'], first_touch_channel: 'whatsapp', first_touch_at: '2026-01-01T00:00:00Z', last_activity_at: '2026-02-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' },
  { id: 'c2', name: 'Bob, "The Closer"', email: 'bob@example.com', phone: null, status: 'lead', source: 'web', tags: [], first_touch_channel: 'web', first_touch_at: null, last_activity_at: null, created_at: '2026-01-05T00:00:00Z' },
]

describe('resolveFields', () => {
  it('defaults to all exportable fields', () => {
    expect(resolveFields()).toEqual(EXPORTABLE_FIELDS)
  })
  it('filters to a requested subset in canonical order', () => {
    expect(resolveFields('email,name')).toEqual(['name', 'email'])
  })
  it('ignores unknown fields and falls back to all when nothing valid', () => {
    expect(resolveFields('bogus,nope')).toEqual(EXPORTABLE_FIELDS)
  })
})

describe('contactsToCsv', () => {
  it('emits a header, joins tags, and RFC-4180-escapes commas/quotes', () => {
    const csv = contactsToCsv(contacts, ['name', 'email', 'tags'])
    const lines = csv.replace(/^\uFEFF/, '').trim().split('\r\n')
    expect(lines[0]).toBe('Name,Email,Tags')
    expect(lines[1]).toBe('Alice Buyer,alice@example.com,vip; warm')
    // Name with a comma and quotes must be wrapped + double-quoted.
    expect(lines[2]).toBe('"Bob, ""The Closer""",bob@example.com,')
  })

  it('starts with a UTF-8 BOM for Excel', () => {
    expect(contactsToCsv(contacts).startsWith('\uFEFF')).toBe(true)
  })
})

describe('contactsToVCard', () => {
  it('produces one VCARD block per contact with FN/EMAIL/TEL', () => {
    const vcf = contactsToVCard(contacts, new Date('2026-03-01T00:00:00Z'))
    expect(vcf.match(/BEGIN:VCARD/g)).toHaveLength(2)
    expect(vcf).toContain('FN:Alice Buyer')
    expect(vcf).toContain('EMAIL;TYPE=INTERNET:alice@example.com')
    expect(vcf).toContain('TEL;TYPE=CELL:+971500000001')
    expect(vcf).toContain('REV:2026-03-01T00:00:00.000Z')
    // Commas + semicolons are escaped per vCard; quotes are left as-is.
    expect(vcf).toContain('FN:Bob\\, "The Closer"')
  })
})

describe('buildContactExport', () => {
  it('builds a csv payload with a dated filename', () => {
    const out = buildContactExport({ contacts, format: 'csv', now: new Date('2026-03-02T10:00:00Z') })
    expect(out.contentType).toBe('text/csv; charset=utf-8')
    expect(out.filename).toBe('contacts-2026-03-02.csv')
    expect(out.rows).toBe(2)
  })
  it('builds a vcard payload', () => {
    const out = buildContactExport({ contacts, format: 'vcard', now: new Date('2026-03-02T10:00:00Z') })
    expect(out.contentType).toBe('text/vcard; charset=utf-8')
    expect(out.filename).toBe('contacts-2026-03-02.vcf')
  })
  it('throws on an unsupported format', () => {
    expect(() => buildContactExport({ contacts, format: 'pdf' })).toThrow(/Unsupported export format/)
  })
})
