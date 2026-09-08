import { randomUUID } from 'node:crypto'
import { beforeEach, expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import {
  FEATURES,
  portalFeatureCode,
  portalFeatureKey,
  refreshPortalFeatures,
  resetDynamicPortalFeaturesForTests,
} from '../credits/features.js'
import { grant } from '../credits/engine.js'
import {
  applyPortalActivationDecision,
  getPortalByCode,
  listPortalActivationHistory,
  listPortalRegistry,
  requestPortalActivation,
  upsertPortalRegistry,
} from '../portals/store.js'
import {
  bootPortalRegistry,
  getPortalEntry,
  listPortalCodes,
  loadPortalAdapterClass,
  resetPortalRegistryForTests,
} from './portals/registry.js'
import { PortalPublisher } from './portals/base.js'
import { OlxPortalPublisher } from './portals/olx.js'
import {
  publishOlx,
  publishToRealEstatePortal,
  REAL_ESTATE_PORTALS,
  refreshRealEstatePortalExport,
} from './realestate.js'

finPostgresSuite('portal registry (BE-DESIGN-01)', { seed: true }, ({ pool }) => {
  beforeEach(async () => {
    resetPortalRegistryForTests()
    resetDynamicPortalFeaturesForTests()
    await pool().query(
      `DELETE FROM public.portal_registry
        WHERE code NOT IN ('olx', 'property_finder', 'bayut', 'dubizzle')`,
    )
    await pool().query(
      `UPDATE public.portal_registry SET is_active = false
        WHERE code IN ('olx', 'property_finder', 'bayut', 'dubizzle')`,
    )
  })

  it('seeds four inactive stub portals idempotently', async () => {
    const portals = await listPortalRegistry()
    const codes = portals.map((p) => p.code).sort()
    expect(codes).toEqual(['bayut', 'dubizzle', 'olx', 'property_finder'])
    for (const p of portals) {
      expect(p.is_active).toBe(false)
      expect(p.adapter_class_name).toBe(`portals/${p.code}.js`)
      expect(p.publisher_config?.stub).toBe(true)
    }
    const byCode = Object.fromEntries(portals.map((p) => [p.code, p]))
    expect(byCode.olx.country_codes).toEqual(expect.arrayContaining(['EG', 'LB']))
    expect(byCode.bayut.country_codes).toEqual(expect.arrayContaining(['AE', 'SA']))
    expect(byCode.dubizzle.country_codes).toEqual(['AE'])
    expect(byCode.property_finder.country_codes).toEqual(
      expect.arrayContaining(['AE', 'SA', 'EG', 'LB']),
    )

    const before = await pool().query(`SELECT count(*)::int AS n FROM public.portal_registry`)
    await pool().query(
      `INSERT INTO public.portal_registry (
         id, code, display_name, adapter_class_name, is_active
       ) VALUES ($1,'olx','OLX','portals/olx.js', false)
       ON CONFLICT (code) DO NOTHING`,
      [randomUUID()],
    )
    const after = await pool().query(`SELECT count(*)::int AS n FROM public.portal_registry`)
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })

  it('supports registry CRUD + pending activation history', async () => {
    const created = await upsertPortalRegistry({
      code: 'aqar',
      display_name: 'Aqar',
      country_codes: ['SA'],
      adapter_class_name: 'portals/olx.js',
      is_active: false,
      publisher_config: { stub: true },
    })
    expect(created.code).toBe('aqar')

    const fetched = await getPortalByCode('aqar')
    expect(fetched.id).toBe(created.id)
    expect(fetched.country_codes).toEqual(['SA'])

    const pending = await requestPortalActivation({
      portalCode: created.code,
      requestedBy: 'pa-user-1',
      reason: 'BD deal signed',
      proposedIsActive: true,
    })
    expect(pending.state).toBe('pending')
    expect(pending.action).toBe('activate')

    const decided = await applyPortalActivationDecision({
      pendingId: pending.id,
      reviewerId: 'pa-user-2',
      approve: true,
      reviewNote: 'activate for KSA',
    })
    expect(decided.portal.is_active).toBe(true)

    const history = await listPortalActivationHistory(created.code)
    expect(history.map((h) => h.event_type)).toEqual(
      expect.arrayContaining(['submitted', 'approved']),
    )

    await expect(
      pool().query(
        `UPDATE public.portal_activation_history SET notes = $1 WHERE id = $2`,
        ['nope', history[0].id],
      ),
    ).rejects.toThrow(/append-only/)
  })

  it('boots adapters from portal_registry (code → class) and preserves NOT_IMPLEMENTED', async () => {
    await bootPortalRegistry({ queryFn: (sql, params) => pool().query(sql, params).then((r) => r.rows) })
    refreshRealEstatePortalExport()

    expect(listPortalCodes().sort()).toEqual(['bayut', 'dubizzle', 'olx', 'property_finder'])
    expect([...REAL_ESTATE_PORTALS].sort()).toEqual(['bayut', 'dubizzle', 'olx', 'property_finder'])

    const Cls = await loadPortalAdapterClass('olx', 'portals/olx.js')
    expect(Cls).toBe(OlxPortalPublisher)
    expect(new Cls()).toBeInstanceOf(PortalPublisher)

    const olx = getPortalEntry('olx')
    expect(olx.featureCode).toBe(FEATURES.PUBLISHING_REALESTATE_OLX)
    expect(olx.adapter.constructor.name).toBe('OlxPortalPublisher')

    await expect(publishOlx({})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    await expect(publishToRealEstatePortal('bayut', {})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    await expect(publishToRealEstatePortal('nope', {})).rejects.toMatchObject({ code: 'PORTAL_NOT_SUPPORTED' })
  })

  it('auto-registers FEATURES when is_active=true via refreshPortalFeatures', async () => {
    expect(FEATURES.PUBLISHING_REALESTATE_OLX).toBe('publishing.realestate.olx')
    expect(FEATURES.PUBLISHING_REALESTATE_PROPERTY_FINDER).toBe('publishing.realestate.property_finder')
    expect(FEATURES.PUBLISHING_REALESTATE_BAYUT).toBe('publishing.realestate.bayut')
    expect(FEATURES.PUBLISHING_REALESTATE_DUBIZZLE).toBe('publishing.realestate.dubizzle')

    const inactive = await refreshPortalFeatures()
    expect(inactive).not.toContain('publishing.realestate.olx')

    await upsertPortalRegistry({
      code: 'wasalt',
      display_name: 'Wasalt',
      country_codes: ['SA'],
      adapter_class_name: 'portals/olx.js',
      is_active: true,
      publisher_config: { stub: true },
    })

    const registered = await refreshPortalFeatures()
    expect(registered).toContain(portalFeatureCode('wasalt'))
    expect(FEATURES[portalFeatureKey('wasalt')]).toBe(portalFeatureCode('wasalt'))
    expect(FEATURES.PUBLISHING_REALESTATE_WASALT).toBe('publishing.realestate.wasalt')

    const metered = await pool().query(
      `SELECT code, category, active, data FROM public.metered_features WHERE code = $1`,
      [portalFeatureCode('wasalt')],
    )
    expect(metered.rows).toHaveLength(1)
    expect(metered.rows[0].category).toBe('publishing.realestate')
    expect(metered.rows[0].data).toMatchObject({ portal: 'wasalt', source: 'portal_registry' })
  })

  it('meters portal publish with country_code on the consumption payload', async () => {
    await bootPortalRegistry({ queryFn: (sql, params) => pool().query(sql, params).then((r) => r.rows) })

    const tenantId = randomUUID()
    await grant({
      tenantId,
      source: 'promo',
      amount: 10_000,
      currency: 'USD',
      grantRef: { idempotency_key: `portal-meter:${tenantId}`, reason: 'portal country meter' },
    })

    const requestId = randomUUID()
    await expect(publishOlx({
      creditContext: { tenantId, requestId },
      countryCode: 'ae',
      listing: { id: 'listing-1', title: 'Test' },
    })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })

    const { rows } = await pool().query(
      `SELECT feature, data FROM public.credit_consumptions
        WHERE tenant_id = $1 AND request_id = $2`,
      [tenantId, requestId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].feature).toBe('publishing.realestate.olx')
    expect(rows[0].data.country_code).toBe('AE')
    expect(rows[0].data.portal).toBe('olx')
    expect(rows[0].data.event_type).toBe('publish')
  })
})
