import { describe, expect, it } from 'vitest'
import {
  applyColumnMapping,
  guessColumnMapping,
  mappedRowsToCsv,
  parseCsvText,
  validateMapping,
} from './closed-transactions-csv'

describe('closed-transactions-csv', () => {
  it('parses headers and rows', () => {
    const parsed = parseCsvText('listing_id,sold_price,closed_date\np-1,100000,2024-01-01')
    expect(parsed.headers).toEqual(['listing_id', 'sold_price', 'closed_date'])
    expect(parsed.rows).toHaveLength(1)
  })

  it('guesses aliases for common headers', () => {
    const mapping = guessColumnMapping(['property_id', 'sale_price', 'sold_date'])
    expect(mapping.listing_id).toBe('property_id')
    expect(mapping.final_sold_price).toBe('sale_price')
    expect(mapping.closed_at).toBe('sold_date')
  })

  it('remaps rows and serialises canonical CSV', () => {
    const parsed = parseCsvText('ref,sold,closed\nREF-1,250000,2024-02-01')
    const mapping = guessColumnMapping(parsed.headers)
    mapping.external_reference = 'ref'
    mapping.final_sold_price = 'sold'
    mapping.closed_at = 'closed'
    const rows = applyColumnMapping(parsed, mapping)
    const csv = mappedRowsToCsv(rows)
    expect(csv).toContain('external_reference')
    expect(csv).toContain('REF-1')
    expect(validateMapping(mapping)).toBeNull()
  })

  it('requires listing or reference and sold/closed fields', () => {
    expect(validateMapping({})).toMatch(/Listing ID or External reference/)
    expect(validateMapping({ listing_id: 'a' })).toMatch(/Final sold price/)
  })
})
