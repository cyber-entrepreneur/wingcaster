/**
 * AGT-HTX-003 — CSV parse + column mapping helpers for closed-transaction import.
 */

export const CANONICAL_IMPORT_FIELDS = [
  { key: 'listing_id', label: 'Listing ID', required: false },
  { key: 'external_reference', label: 'External reference', required: false },
  { key: 'transaction_type', label: 'Transaction type', required: false },
  { key: 'original_listed_price', label: 'Original listed price', required: false },
  { key: 'final_sold_price', label: 'Final sold price', required: true },
  { key: 'currency', label: 'Currency', required: false },
  { key: 'listed_at', label: 'Listed at', required: false },
  { key: 'closed_at', label: 'Closed at', required: true },
  { key: 'days_on_market', label: 'Days on market', required: false },
  { key: 'offers_received_count', label: 'Offers received', required: false },
  { key: 'viewings_conducted', label: 'Viewings conducted', required: false },
  { key: 'buyer_type', label: 'Buyer type', required: false },
  { key: 'buyer_nationality', label: 'Buyer nationality', required: false },
  { key: 'payment_method', label: 'Payment method', required: false },
  { key: 'down_payment_percent', label: 'Down payment %', required: false },
  { key: 'mortgage_provider', label: 'Mortgage provider', required: false },
  { key: 'close_reason', label: 'Close reason', required: false },
  { key: 'attribution_source', label: 'Attribution source', required: false },
  { key: 'agent_notes', label: 'Agent notes', required: false },
] as const

export type CanonicalImportField = (typeof CANONICAL_IMPORT_FIELDS)[number]['key']

const HEADER_ALIASES: Record<CanonicalImportField, string[]> = {
  listing_id: ['listing_id', 'property_id', 'listing'],
  external_reference: ['external_reference', 'reference'],
  transaction_type: ['transaction_type', 'type'],
  original_listed_price: ['original_listed_price', 'listed_price'],
  final_sold_price: ['final_sold_price', 'sold_price', 'sale_price'],
  currency: ['currency'],
  listed_at: ['listed_at', 'listed_date'],
  closed_at: ['closed_at', 'closed_date', 'sold_date'],
  days_on_market: ['days_on_market', 'dom'],
  offers_received_count: ['offers_received_count', 'offers'],
  viewings_conducted: ['viewings_conducted', 'viewings'],
  buyer_type: ['buyer_type'],
  buyer_nationality: ['buyer_nationality', 'nationality'],
  payment_method: ['payment_method'],
  down_payment_percent: ['down_payment_percent', 'down_payment'],
  mortgage_provider: ['mortgage_provider'],
  close_reason: ['close_reason'],
  attribution_source: ['attribution_source', 'source'],
  agent_notes: ['agent_notes', 'notes'],
}

export type ColumnMapping = Partial<Record<CanonicalImportField, string>>

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

function splitCsvRow(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && line[i + 1] === '"' && inQuotes) {
      cur += '"'
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

export function parseCsvText(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!lines.length) return { headers: [], rows: [] }
  const headers = splitCsvRow(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).map((line) => splitCsvRow(line))
  return { headers, rows }
}

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalised = headers.map((h) => h.trim().toLowerCase())
  const mapping: ColumnMapping = {}
  for (const field of CANONICAL_IMPORT_FIELDS) {
    const aliases = HEADER_ALIASES[field.key]
    const idx = normalised.findIndex((h) => aliases.includes(h))
    if (idx >= 0) mapping[field.key] = headers[idx]
  }
  return mapping
}

export function applyColumnMapping(parsed: ParsedCsv, mapping: ColumnMapping): Record<string, string>[] {
  const headerIndex = new Map(parsed.headers.map((h, i) => [h, i]))
  return parsed.rows.map((cells) => {
    const row: Record<string, string> = {}
    for (const field of CANONICAL_IMPORT_FIELDS) {
      const sourceHeader = mapping[field.key]
      if (!sourceHeader) continue
      const idx = headerIndex.get(sourceHeader)
      if (idx == null) continue
      row[field.key] = cells[idx] != null ? String(cells[idx]).trim() : ''
    }
    return row
  })
}

export function mappedRowsToCsv(rows: Record<string, string>[]): string {
  const headers = CANONICAL_IMPORT_FIELDS.map((f) => f.key)
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(
      headers
        .map((key) => {
          const value = row[key] ?? ''
          if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
          return value
        })
        .join(','),
    )
  }
  return lines.join('\n')
}

export function validateMapping(mapping: ColumnMapping): string | null {
  const hasListing = Boolean(mapping.listing_id || mapping.external_reference)
  if (!hasListing) return 'Map either Listing ID or External reference.'
  if (!mapping.final_sold_price) return 'Map Final sold price.'
  if (!mapping.closed_at) return 'Map Closed at.'
  return null
}
