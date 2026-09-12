import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { startSubscription } from './lifecycle.js'
import { registerPublicPricingRoutes } from './public-pricing-routes.js'
import { getActiveTierCatalog } from './tier-config.js'
import {
  FREE_PACKAGE_ID,
  FREE_VERSION_ID,
  MARKETING_PACKAGE_IDS,
  MARKETING_VERSION_IDS,
  withTx,
} from './test-support.js'

const EXPECTED_CODES = ['semsar', 'boutique', 'small_team', 'agency', 'brokerage', 'enterprise']

async function makeApp(databaseUrl) {
  const { configure } = await import('../../db.js')
  configure({ databaseUrl, force: true })
  const app = express()
  registerPublicPricingRoutes(app)
  return app
}

finPostgresSuite('packages marketing fields', {}, ({ pool, url }) => {
  it('seeds 6 portal groups, 6 marketing tiers, and deactivates free', async () => {
    const groups = await pool().query(
      `SELECT id FROM public.portal_groups ORDER BY id`,
    )
    expect(groups.rows.map((r) => r.id)).toEqual([
      'all_in_market',
      'all_mena_phase_1',
      'all_plus_priority',
      'primary_plus_secondary',
      'single_pick',
      'top_three_in_market',
    ])

    const packages = await pool().query(
      `SELECT code, active, deactivated_at FROM public.product_packages
        WHERE id = ANY($1::uuid[])
        ORDER BY code`,
      [Object.values(MARKETING_PACKAGE_IDS)],
    )
    expect(packages.rows).toHaveLength(6)
    expect(packages.rows.every((row) => row.active === true)).toBe(true)

    const free = await pool().query(
      `SELECT active, deactivated_at FROM public.product_packages WHERE id = $1`,
      [FREE_PACKAGE_ID],
    )
    expect(free.rows[0].active).toBe(false)
    expect(free.rows[0].deactivated_at).toBeTruthy()

    const billing = await pool().query(
      `SELECT properties_covered, monthly_price_minor
         FROM public.product_package_versions WHERE id = $1`,
      [MARKETING_VERSION_IDS.semsar],
    )
    expect(Number(billing.rows[0].properties_covered)).toBe(0)
    expect(Number(billing.rows[0].monthly_price_minor)).toBe(0)
  })

  it('getActiveTierCatalog returns the 6 seeded tiers in sort_order', async () => {
    const catalog = await withTx(pool(), (client) => getActiveTierCatalog(client))
    expect(catalog.map((t) => t.code)).toEqual(EXPECTED_CODES)
    expect(catalog.map((t) => t.sort_order)).toEqual([1, 2, 3, 4, 5, 6])
    expect(catalog.map((t) => t.sort_order)).toEqual(
      [...catalog].sort((a, b) => a.sort_order - b.sort_order).map((t) => t.sort_order),
    )
    const brokerage = catalog.find((t) => t.code === 'brokerage')
    expect(brokerage.agent_cap).toBeNull()
    expect(brokerage.feature_quotas.push_notifications).toBe(-1)
    expect(catalog.find((t) => t.code === 'semsar').price).toEqual({
      monthly_usd: 15, annual_usd: 150, currency: 'USD',
    })
  })

  it('GET /api/public/pricing-tiers returns 200 with Cache-Control and the seeded shape', async () => {
    const app = await makeApp(url())
    const res = await request(app).get('/api/public/pricing-tiers')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('public, s-maxage=300, stale-while-revalidate=600')
    expect(res.body.currency).toBe('USD')
    expect(res.body.tiers.map((t) => t.code)).toEqual(EXPECTED_CODES)
    expect(res.body.tiers.find((t) => t.code === 'brokerage').agent_cap).toBeNull()
    expect(res.body.tiers.find((t) => t.code === 'enterprise').feature_quotas.email_sends).toBe(-1)
  })

  it('reflects a price update immediately (no in-process cache)', async () => {
    const app = await makeApp(url())
    await pool().query(
      `UPDATE public.product_package_versions
          SET price_usd_monthly_minor = 1600
        WHERE id = $1`,
      [MARKETING_VERSION_IDS.semsar],
    )
    const res = await request(app).get('/api/public/pricing-tiers')
    expect(res.status).toBe(200)
    expect(res.body.tiers.find((t) => t.code === 'semsar').price.monthly_usd).toBe(16)
    await pool().query(
      `UPDATE public.product_package_versions
          SET price_usd_monthly_minor = 1500
        WHERE id = $1`,
      [MARKETING_VERSION_IDS.semsar],
    )
  })

  it('excludes inactive packages and DRAFT versions from the endpoint', async () => {
    const app = await makeApp(url())
    await pool().query(
      `UPDATE public.product_packages SET active = false WHERE id = $1`,
      [MARKETING_PACKAGE_IDS.boutique],
    )
    await pool().query(
      `UPDATE public.product_package_versions SET state = 'DRAFT' WHERE id = $1`,
      [MARKETING_VERSION_IDS.agency],
    )
    const res = await request(app).get('/api/public/pricing-tiers')
    expect(res.status).toBe(200)
    expect(res.body.tiers.map((t) => t.code)).toEqual(
      ['semsar', 'small_team', 'brokerage', 'enterprise'],
    )
    await pool().query(
      `UPDATE public.product_packages SET active = true WHERE id = $1`,
      [MARKETING_PACKAGE_IDS.boutique],
    )
    await pool().query(
      `UPDATE public.product_package_versions SET state = 'PUBLISHED' WHERE id = $1`,
      [MARKETING_VERSION_IDS.agency],
    )
  })

  it('does not change free-tier billing: startSubscription still uses the published free version', async () => {
    const tenantId = '31600000-0000-4000-8000-000000000099'
    const now = '2026-09-01T00:00:00.000Z'
    const sub = await withTx(pool(), (client) => startSubscription(client, {
      tenantId,
      packageVersionId: FREE_VERSION_ID,
      propertiesCommitted: 0,
      billingCycleStart: now,
      now,
    }))
    expect(sub.status).toBe('ACTIVE')
    expect(sub.package_version_id).toBe(FREE_VERSION_ID)
  })
})
