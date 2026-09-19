/**
 * AGT-HTX-003 — canonical import field keys + human labels.
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
] as const

export type ImportFieldKey = (typeof IMPORT_FIELD_KEYS)[number]

export const IMPORT_FIELD_LABELS: Record<ImportFieldKey, string> = {
  listing_id: 'Listing ID',
  external_reference: 'External reference',
  transaction_type: 'Transaction type',
  original_listed_price: 'Original listed price',
  final_sold_price: 'Final sold price',
  currency: 'Currency',
  listed_at: 'Listed at',
  closed_at: 'Closed at',
  days_on_market: 'Days on market',
  offers_received_count: 'Offers received',
  viewings_conducted: 'Viewings conducted',
  buyer_type: 'Buyer type',
  buyer_nationality: 'Buyer nationality',
  payment_method: 'Payment method',
  down_payment_percent: 'Down payment %',
  mortgage_provider: 'Mortgage provider',
  close_reason: 'Close reason',
  attribution_source: 'Attribution source',
  agent_notes: 'Agent notes',
  source_note: 'Source note',
}

/** Required for a row to import successfully. */
export const REQUIRED_IMPORT_FIELDS: ImportFieldKey[] = [
  'final_sold_price',
  'closed_at',
]

export function guessColumnMap(headers: string[]): Partial<Record<ImportFieldKey, string>> {
  const lower = headers.map((h) => ({ raw: h, key: h.trim().toLowerCase() }))
  const map: Partial<Record<ImportFieldKey, string>> = {}
  const aliases: Record<ImportFieldKey, string[]> = {
    listing_id: ['listing_id', 'property_id', 'listing'],
    external_reference: ['external_reference', 'reference', 'ref'],
    transaction_type: ['transaction_type', 'type'],
    original_listed_price: ['original_listed_price', 'listed_price'],
    final_sold_price: ['final_sold_price', 'sold_price', 'sale_price', 'sold for'],
    currency: ['currency'],
    listed_at: ['listed_at', 'listed_date'],
    closed_at: ['closed_at', 'closed_date', 'sold_date', 'date sold'],
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
    source_note: ['source_note'],
  }
  for (const field of IMPORT_FIELD_KEYS) {
    const match = lower.find((h) => aliases[field].includes(h.key))
    if (match) map[field] = match.raw
  }
  return map
}
