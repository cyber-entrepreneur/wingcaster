/**
 * Fast unit tests for AGT-PUB-005 submit helpers (no Postgres).
 */
import { describe, expect, it } from 'vitest'
import {
  normalizePortalSelections,
  serializePortalForPicker,
} from './submit-job.js'

describe('normalizePortalSelections', () => {
  it('accepts string codes and dedupes', () => {
    expect(normalizePortalSelections(['bayut', 'Bayut', 'olx'])).toEqual([
      { code: 'bayut', country_code: null },
      { code: 'olx', country_code: null },
    ])
  })

  it('accepts object selections with country_code', () => {
    expect(normalizePortalSelections([
      { code: 'property_finder', country_code: 'ae' },
      { portal: 'bayut' },
    ])).toEqual([
      { code: 'property_finder', country_code: 'AE' },
      { code: 'bayut', country_code: null },
    ])
  })

  it('rejects empty selections', () => {
    expect(() => normalizePortalSelections([])).toThrow(/at least one portal/i)
    expect(() => normalizePortalSelections(null)).toThrow(/at least one portal/i)
  })
})

describe('serializePortalForPicker', () => {
  it('maps registry rows without hardcoding portal names', () => {
    const row = {
      code: 'wasalt',
      display_name: 'Wasalt',
      description: 'KSA portal',
      logo_url: null,
      country_codes: ['SA'],
      primary_language: 'ar',
      is_active: true,
      deprecated_at: null,
      publisher_config: { sla_hours: 6 },
    }
    expect(serializePortalForPicker(row)).toEqual({
      code: 'wasalt',
      display_name: 'Wasalt',
      description: 'KSA portal',
      logo_url: null,
      country_codes: ['SA'],
      primary_language: 'ar',
      is_active: true,
      deprecated_at: null,
      sla_hours: 6,
    })
  })
})
