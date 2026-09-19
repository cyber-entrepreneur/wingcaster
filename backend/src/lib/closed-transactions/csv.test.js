import { describe, expect, it } from 'vitest'
import { applyColumnMapping, normaliseCsvRow, parseSimpleCsv, previewClosedTransactionsCsv } from './csv.js'

describe('closed-transaction CSV helpers', () => {
  it('parses quoted CSV rows', () => {
    const text = 'listing_id,notes\nabc,"hello, world"'
    const { headers, rows } = parseSimpleCsv(text)
    expect(headers).toEqual(['listing_id', 'notes'])
    expect(rows[0].notes).toBe('hello, world')
  })

  it('applies column mapping before normalisation', () => {
    const mapped = applyColumnMapping(
      [{ 'Sale Price': '500000', 'Date Sold': '2024-01-01' }],
      { final_sold_price: 'Sale Price', closed_at: 'Date Sold' },
    )
    const norm = normaliseCsvRow(mapped[0])
    expect(norm.final_sold_price).toBe('500000')
    expect(norm.closed_at).toBe('2024-01-01')
  })

  it('previews valid row counts', () => {
    const csv = [
      'reference,final_sold_price,closed_at',
      'REF-1,100000,2023-06-01',
      'REF-2,,2023-06-02',
    ].join('\n')
    const preview = previewClosedTransactionsCsv({ csvText: csv })
    expect(preview.row_count).toBe(2)
    expect(preview.preview[0].valid).toBe(true)
    expect(preview.preview[1].valid).toBe(false)
  })
})
