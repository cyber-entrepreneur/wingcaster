/**
 * AGT-HTX-003 — CSV parsing + column mapping for closed-transaction imports.
 */

export const IMPORT_FIELD_KEYS = [
  'listing_id',
  'external_reference',
  'transaction_type',
  'original_listed_price',
  'final_sold_price',
  'currency',
  'listed_at',
  'closed_at',
  'days_on_market',
  'offers_received_count',
  'viewings_conducted',
  'buyer_type',
  'buyer_nationality',
  'payment_method',
  'down_payment_percent',
  'mortgage_provider',
  'close_reason',
  'attribution_source',
  'agent_notes',
  'source_note',
]

/**
 * Small tolerant CSV parser — handles quoted values with commas inside,
 * newlines as row separator, first row as header. No dependency added.
 */
export function parseSimpleCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!lines.length) return { headers: [], rows: [] }
  const headers = splitCsvRow(lines[0]).map((h) => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i])
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] != null ? String(cells[idx]).trim() : ''
    })
    rows.push(obj)
  }
  return { headers, rows }
}

function splitCsvRow(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && line[i + 1] === '"' && inQuotes) { cur += '"'; i++; continue }
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

/**
 * Remap source CSV headers to canonical import keys.
 * columnMap: { final_sold_price: "Sale Price", closed_at: "Date Sold" }
 */
export function applyColumnMapping(rows, columnMap = {}) {
  if (!columnMap || typeof columnMap !== 'object') return rows
  const entries = Object.entries(columnMap).filter(([, source]) => source)
  if (!entries.length) return rows
  return rows.map((row) => {
    const out = { ...row }
    for (const [target, source] of entries) {
      if (source in row) out[target] = row[source]
    }
    return out
  })
}

export function normaliseCsvRow(row) {
  const lower = {}
  for (const [k, v] of Object.entries(row || {})) {
    lower[String(k).trim().toLowerCase()] = v
  }
  return {
    listing_id: lower.listing_id || lower.property_id || lower.listing || '',
    external_reference: lower.external_reference || lower.reference || '',
    transaction_type: lower.transaction_type || lower.type || 'sale',
    original_listed_price: lower.original_listed_price || lower.listed_price || '',
    final_sold_price: lower.final_sold_price || lower.sold_price || lower.sale_price || '',
    currency: lower.currency || 'USD',
    listed_at: lower.listed_at || lower.listed_date || null,
    closed_at: lower.closed_at || lower.closed_date || lower.sold_date || null,
    days_on_market: lower.days_on_market || '',
    offers_received_count: lower.offers_received_count || lower.offers || '',
    viewings_conducted: lower.viewings_conducted || lower.viewings || '',
    buyer_type: (lower.buyer_type || '').toLowerCase(),
    buyer_nationality: lower.buyer_nationality || lower.nationality || '',
    payment_method: (lower.payment_method || '').toLowerCase(),
    down_payment_percent: lower.down_payment_percent || lower.down_payment || '',
    mortgage_provider: lower.mortgage_provider || '',
    close_reason: (lower.close_reason || '').toLowerCase(),
    agent_notes: lower.agent_notes || lower.notes || '',
    attribution_source: (lower.attribution_source || lower.source || '').toLowerCase(),
    source_note: lower.source_note || '',
  }
}

export function previewClosedTransactionsCsv({ csvText, columnMap }) {
  const { headers, rows } = parseSimpleCsv(csvText)
  const mapped = applyColumnMapping(rows, columnMap)
  const preview = mapped.slice(0, 12).map((row, idx) => {
    const norm = normaliseCsvRow(row)
    return {
      row: idx + 2,
      listing_id: norm.listing_id || null,
      external_reference: norm.external_reference || null,
      transaction_type: norm.transaction_type,
      final_sold_price: norm.final_sold_price || null,
      closed_at: norm.closed_at || null,
      currency: norm.currency,
      valid: Boolean((norm.listing_id || norm.external_reference) && norm.final_sold_price && norm.closed_at),
    }
  })
  return {
    headers,
    row_count: rows.length,
    preview,
    valid_count: preview.filter((p) => p.valid).length,
  }
}
