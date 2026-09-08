import { describe, expect, it } from 'vitest'
import { PortalPublisher } from './base.js'
import { OlxPortalPublisher } from './olx.js'
import { PropertyFinderPortalPublisher } from './property_finder.js'
import { BayutPortalPublisher } from './bayut.js'
import { DubizzlePortalPublisher } from './dubizzle.js'
import { FALLBACK_PORTAL_ROWS, loadPortalAdapterClass } from './registry.js'
import {
  publishBayut,
  publishDubizzle,
  publishOlx,
  publishPropertyFinder,
  publishToRealEstatePortal,
  REAL_ESTATE_PORTALS,
} from '../realestate.js'

describe('portal stub adapters', () => {
  it('maps each seed code to a PortalPublisher subclass', async () => {
    const classes = {
      olx: OlxPortalPublisher,
      property_finder: PropertyFinderPortalPublisher,
      bayut: BayutPortalPublisher,
      dubizzle: DubizzlePortalPublisher,
    }
    expect(FALLBACK_PORTAL_ROWS.map((r) => r.code)).toEqual([
      'olx', 'property_finder', 'bayut', 'dubizzle',
    ])
    for (const row of FALLBACK_PORTAL_ROWS) {
      expect(row.is_active).toBe(false)
      expect(row.adapter_class_name).toBe(`portals/${row.code}.js`)
      const Cls = await loadPortalAdapterClass(row.code, row.adapter_class_name)
      expect(Cls).toBe(classes[row.code])
      const adapter = new Cls(row)
      expect(adapter).toBeInstanceOf(PortalPublisher)
      await expect(adapter.publish({}, {})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
      await expect(adapter.fetchInboundLeads({})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
      await expect(adapter.validateListing({})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    }
  })

  it('keeps the four publish* exports throwing NOT_IMPLEMENTED', async () => {
    expect(REAL_ESTATE_PORTALS).toEqual(expect.arrayContaining([
      'olx', 'property_finder', 'bayut', 'dubizzle',
    ]))
    await expect(publishOlx()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    await expect(publishPropertyFinder()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    await expect(publishBayut()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    await expect(publishDubizzle()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })

  it('rejects unknown portals with PORTAL_NOT_SUPPORTED', async () => {
    await expect(publishToRealEstatePortal('not_a_portal')).rejects.toMatchObject({
      code: 'PORTAL_NOT_SUPPORTED',
    })
  })
})
