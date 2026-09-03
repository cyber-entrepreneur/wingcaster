import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { NOW } from '../testing/seed.js'
import { finPostgresSuite } from '../testing/suite.js'
import { runReconciliation } from './runner.js'

async function byCode(pool, now = NOW) {
  const run = await runReconciliation(pool, { now })
  return Object.fromEntries(run.results.map((r) => [r.check_code, r]))
}

finPostgresSuite('reconciliation R119–R120', {}, ({ pool }) => {
  it('R119 is GREEN with one effective PUBLISHED version; DRIFTs when two overlap', async () => {
    const green = await byCode(pool())
    expect(green.R119.result).toBe('GREEN')

    const packageId = randomUUID()
    const v1 = randomUUID()
    const v2 = randomUUID()
    await pool().query(
      `INSERT INTO public.product_packages (
         id, code, display_name, tier, target_audience, currency, billing_cadence, active
       ) VALUES ($1,$2,'Overlap','starter','agent','USD','monthly',true)`,
      [packageId, `ovl-${packageId.slice(0, 8)}`],
    )
    await pool().query(
      `INSERT INTO public.product_package_versions (
         id, package_id, version_number, state, properties_covered, monthly_price_minor, effective_from
       ) VALUES
         ($1,$3,1,'DRAFT',1,100, TIMESTAMPTZ '2020-01-01+00'),
         ($2,$3,2,'DRAFT',2,200, TIMESTAMPTZ '2020-01-01+00')`,
      [v1, v2, packageId],
    )
    await pool().query(
      `UPDATE public.product_package_versions SET state = 'PUBLISHED', published_at = NOW() WHERE id IN ($1,$2)`,
      [v1, v2],
    )
    try {
      const drifted = await byCode(pool())
      expect(drifted.R119.result).toBe('DRIFT')
    } finally {
      await pool().query(
        `UPDATE public.product_package_versions SET state = 'DEPRECATED', effective_to = NOW() WHERE id IN ($1,$2)`,
        [v1, v2],
      )
    }
  })

  it('R120 is GREEN for PENDING_APPROVAL + REQUESTED; DRIFTs on EXECUTED leftover', async () => {
    const packageId = randomUUID()
    const versionId = randomUUID()
    const approvalId = randomUUID()
    await pool().query(
      `INSERT INTO public.product_packages (
         id, code, display_name, tier, target_audience, currency, billing_cadence, active
       ) VALUES ($1,$2,'Pend','starter','agent','USD','monthly',false)`,
      [packageId, `r120-${versionId.slice(0, 8)}`],
    )
    await pool().query(
      `INSERT INTO fin.approval_requests (
         id, environment, tenant_id, action_kind, status, payload_hash,
         created_at, updated_at
       ) VALUES ($1,'LIVE',NULL,'MASS_OPERATION','REQUESTED','r120',NOW(),NOW())`,
      [approvalId],
    )
    await pool().query(
      `INSERT INTO public.product_package_versions (
         id, package_id, version_number, state, properties_covered, monthly_price_minor, approval_request_id
       ) VALUES ($1,$2,1,'PENDING_APPROVAL',1,100,$3)`,
      [versionId, packageId, approvalId],
    )
    try {
      const green = await byCode(pool())
      expect(green.R120.result).toBe('GREEN')

      await pool().query(`UPDATE fin.approval_requests SET status = 'EXECUTED' WHERE id = $1`, [approvalId])
      const drifted = await byCode(pool())
      expect(drifted.R120.result).toBe('DRIFT')
    } finally {
      await pool().query(
        `UPDATE public.product_package_versions SET state = 'DRAFT', approval_request_id = NULL WHERE id = $1`,
        [versionId],
      )
    }
  })
})
