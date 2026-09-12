import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { startSubscription, changePlan, cancelAtPeriodEnd, cancelImmediate } from './lifecycle.js'
import { PRICE_REPORTS_SUBMIT_FEATURE_CODE } from './registry.js'
import {
  FREE_PACKAGE_ID,
  FREE_VERSION_ID,
  FREE_AGENCY_PACKAGE_ID,
  FREE_AGENCY_VERSION_ID,
  PRO_PACKAGE_ID,
  PRO_VERSION_ID,
  PRO_ELITE_PACKAGE_ID,
  PRO_ELITE_VERSION_ID,
  seedPublishedPackage,
  withTx,
} from './test-support.js'

finPostgresSuite('packages migrations 302–304 + 319 + 333', {}, ({ pool }) => {
  it('applies schema, seeds free-tier, and supports start → paid → cancel-end → ended', async () => {
    const tables = await pool().query(
      `SELECT to_regclass('public.metered_features') AS features,
              to_regclass('public.product_packages') AS packages,
              to_regclass('public.tenant_subscriptions') AS subs`,
    )
    expect(tables.rows[0].features).toBeTruthy()
    expect(tables.rows[0].packages).toBeTruthy()
    expect(tables.rows[0].subs).toBeTruthy()

    const free = await pool().query(
      `SELECT p.code, p.tier, p.active, v.state, v.properties_covered, v.monthly_price_minor
         FROM public.product_packages p
         JOIN public.product_package_versions v ON v.package_id = p.id
        WHERE p.id = $1 AND v.id = $2`,
      [FREE_PACKAGE_ID, FREE_VERSION_ID],
    )
    expect(free.rows[0].code).toBe('free-agent')
    expect(free.rows[0].tier).toBe('free')
    // Migration 339 deactivates free from the marketing catalog; the row
    // stays PUBLISHED so onboarding and historical subscriptions still resolve.
    expect(free.rows[0].active).toBe(false)
    expect(free.rows[0].state).toBe('PUBLISHED')
    expect(Number(free.rows[0].properties_covered)).toBe(0)
    expect(Number(free.rows[0].monthly_price_minor)).toBe(0)

    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    const { started, paidSub, canceled, ended } = await withTx(pool(), async (client) => {
      const startedRow = await startSubscription(client, {
        tenantId,
        packageVersionId: FREE_VERSION_ID,
        propertiesCommitted: 0,
        billingCycleStart: now,
        now,
      })
      const paid = await seedPublishedPackage(client, {
        quotas: [{ code: 'publishing.social.instagram', creditsPerProperty: 1 }],
      })
      const changed = await changePlan(client, {
        subscriptionId: startedRow.id,
        newPackageVersionId: paid.versionId,
        prorate: false,
        now,
      })
      const canceledRow = await cancelAtPeriodEnd(client, {
        subscriptionId: changed.subscription.id,
        reason: 'eop',
        now,
      })
      const endedRow = await cancelImmediate(client, {
        subscriptionId: changed.subscription.id,
        reason: 'close',
        now,
      })
      return {
        started: startedRow,
        paidSub: changed.subscription,
        canceled: canceledRow,
        ended: endedRow,
      }
    })
    expect(started.status).toBe('ACTIVE')
    expect(paidSub.package_version_id).not.toBe(FREE_VERSION_ID)
    expect(canceled.status).toBe('CANCELED_AT_PERIOD_END')
    expect(ended.status).toBe('ENDED')
  })

  it('seeds agency free-tier package (migration 319) distinct from agent free-tier', async () => {
    const free = await pool().query(
      `SELECT p.code, p.tier, p.target_audience, p.active, v.state,
              v.properties_covered, v.monthly_price_minor
         FROM public.product_packages p
         JOIN public.product_package_versions v ON v.package_id = p.id
        WHERE p.id = $1 AND v.id = $2`,
      [FREE_AGENCY_PACKAGE_ID, FREE_AGENCY_VERSION_ID],
    )
    expect(free.rows[0].code).toBe('free-agency')
    expect(free.rows[0].tier).toBe('free')
    expect(free.rows[0].target_audience).toBe('agency')
    // Migration 339 deactivates free from the marketing catalog; stays PUBLISHED.
    expect(free.rows[0].active).toBe(false)
    expect(free.rows[0].state).toBe('PUBLISHED')
    expect(Number(free.rows[0].properties_covered)).toBe(0)
    expect(Number(free.rows[0].monthly_price_minor)).toBe(0)

    const flags = await pool().query(
      `SELECT feature_code FROM public.package_feature_flags
        WHERE package_version_id = $1 ORDER BY feature_code`,
      [FREE_AGENCY_VERSION_ID],
    )
    expect(flags.rows.map((r) => r.feature_code)).toEqual([
      'crm.contacts',
      'crm.opportunities',
      'crm.tasks',
      'listings.crud',
    ])
  })

  it('blocks UPDATE of properties_covered on a PUBLISHED version', async () => {
    await expect(pool().query(
      `UPDATE public.product_package_versions
          SET properties_covered = 99
        WHERE id = $1`,
      [FREE_VERSION_ID],
    )).rejects.toThrow(/PACKAGE_VERSION_IMMUTABLE/)
  })

  it('seeds valuation.price_reports.submit on Pro + Pro Elite only (migration 330)', async () => {
    const proRows = await pool().query(
      `SELECT p.id AS package_id, p.code, p.tier, p.target_audience, p.active,
              v.id AS version_id, v.state
         FROM public.product_packages p
         JOIN public.product_package_versions v ON v.package_id = p.id
        WHERE p.id IN ($1, $2)
        ORDER BY p.code`,
      [PRO_PACKAGE_ID, PRO_ELITE_PACKAGE_ID],
    )
    expect(proRows.rows).toHaveLength(2)
    expect(proRows.rows.map((r) => r.code)).toEqual(['pro-agent', 'pro-elite-agent'])
    for (const row of proRows.rows) {
      expect(row.tier).toBe('pro')
      expect(row.target_audience).toBe('agent')
      expect(row.active).toBe(true)
      expect(row.state).toBe('PUBLISHED')
    }
    expect(proRows.rows.find((r) => r.code === 'pro-agent').version_id).toBe(PRO_VERSION_ID)
    expect(proRows.rows.find((r) => r.code === 'pro-elite-agent').version_id).toBe(PRO_ELITE_VERSION_ID)

    const flagged = await pool().query(
      `SELECT f.package_version_id, f.enabled, p.code
         FROM public.package_feature_flags f
         JOIN public.product_package_versions v ON v.id = f.package_version_id
         JOIN public.product_packages p ON p.id = v.package_id
        WHERE f.feature_code = $1
        ORDER BY p.code`,
      [PRICE_REPORTS_SUBMIT_FEATURE_CODE],
    )
    expect(flagged.rows.length).toBeGreaterThanOrEqual(2)
    expect(flagged.rows.every((r) => r.enabled === true)).toBe(true)
    const flaggedCodes = flagged.rows.map((r) => r.code)
    expect(flaggedCodes).toContain('pro-agent')
    expect(flaggedCodes).toContain('pro-elite-agent')
    expect(flaggedCodes).not.toContain('free-agent')
    expect(flaggedCodes).not.toContain('free-agency')

    const freeHasFlag = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.package_feature_flags
        WHERE feature_code = $1
          AND package_version_id IN ($2, $3)`,
      [PRICE_REPORTS_SUBMIT_FEATURE_CODE, FREE_VERSION_ID, FREE_AGENCY_VERSION_ID],
    )
    expect(freeHasFlag.rows[0].n).toBe(0)

    const metered = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.metered_features WHERE code = $1`,
      [PRICE_REPORTS_SUBMIT_FEATURE_CODE],
    )
    expect(metered.rows[0].n).toBe(0)
  })
})
