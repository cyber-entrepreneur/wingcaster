import { afterEach, describe, expect, it, vi } from 'vitest'
import { PortalPublisher } from './base.js'
import { OlxPortalPublisher } from './olx.js'
import { PropertyFinderPortalPublisher } from './property_finder.js'
import { BayutPortalPublisher } from './bayut.js'
import { DubizzlePortalPublisher } from './dubizzle.js'
import { FALLBACK_PORTAL_ROWS, loadPortalAdapterClass, resetPortalRegistryForTests } from './registry.js'
import {
  publishBayut,
  publishDubizzle,
  publishOlx,
  publishPropertyFinder,
  publishToRealEstatePortal,
  REAL_ESTATE_PORTALS,
} from '../realestate.js'
import { canonicalPfListing as validPfListing } from './property_finder.js'

const STUB_PORTALS = ['olx', 'bayut', 'dubizzle']

describe('portal adapters', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.PF_API_KEY
    delete process.env.PF_CLIENT_ID
    delete process.env.PF_CLIENT_SECRET
    resetPortalRegistryForTests()
  })

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
      if (STUB_PORTALS.includes(row.code)) {
        await expect(adapter.publish({}, {})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
        await expect(adapter.fetchInboundLeads({})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
        await expect(adapter.validateListing({})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
      }
    }
  })

  it('property_finder is implemented; remaining portals still throw NOT_IMPLEMENTED', async () => {
    const pf = new PropertyFinderPortalPublisher(
      FALLBACK_PORTAL_ROWS.find((r) => r.code === 'property_finder'),
    )
    const validated = await pf.validateListing({})
    expect(validated.valid).toBe(false)
    const publishErr = await pf.publish({}, {}).catch((e) => e)
    expect(publishErr).toBeInstanceOf(Error)
    expect(publishErr.code).not.toBe('NOT_IMPLEMENTED')

    expect(REAL_ESTATE_PORTALS).toEqual(expect.arrayContaining([
      'olx', 'property_finder', 'bayut', 'dubizzle',
    ]))
    await expect(publishOlx()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    await expect(publishBayut()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    await expect(publishDubizzle()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })

    const err = await publishPropertyFinder().catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.code).not.toBe('NOT_IMPLEMENTED')
  })

  it('publishPropertyFinder works through realestate.js with a mocked PF API', async () => {
    process.env.PF_API_KEY = 'k'
    process.env.PF_CLIENT_ID = 'cid'
    process.env.PF_CLIENT_SECRET = 'sec'
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'pf-wired-1',
        url: 'https://www.propertyfinder.ae/en/listing/pf-wired-1',
        status: 'live',
      }),
    })))
    resetPortalRegistryForTests()
    const result = await publishPropertyFinder({
      listing: validPfListing({ country_code: 'AE' }),
      countryCode: 'AE',
    })
    expect(result.externalId).toBe('pf-wired-1')
    expect(result.status).toBe('live')
    expect(result.countryCode).toBe('AE')
  })

  it('rejects unknown portals with PORTAL_NOT_SUPPORTED', async () => {
    await expect(publishToRealEstatePortal('not_a_portal')).rejects.toMatchObject({
      code: 'PORTAL_NOT_SUPPORTED',
    })
  })
})
