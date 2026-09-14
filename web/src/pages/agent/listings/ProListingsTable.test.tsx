import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LISTING_STATUSES, mapStatusToApi } from '@/lib/listingStatus'

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'ProListingsTable.tsx'),
  'utf8',
)

describe('ProListingsTable inline status', () => {
  it('round-trips all 6 statuses through mapStatusToApi without error-toast mapping', () => {
    expect(SOURCE).toContain('const mapped = mapStatusToApi(status)')
    expect(SOURCE).toContain('await api.updateProperty(id, { status: mapped })')
    expect(SOURCE).toContain("variant: 'error'")

    const accepted = new Set([
      'active',
      'draft',
      'unpublished',
      'archived',
      'published',
      'underOffer',
      'closed',
    ])
    for (const status of LISTING_STATUSES) {
      expect(accepted.has(mapStatusToApi(status))).toBe(true)
    }
    expect(mapStatusToApi('underOffer')).toBe('underOffer')
    expect(mapStatusToApi('closed')).toBe('closed')
  })
})
