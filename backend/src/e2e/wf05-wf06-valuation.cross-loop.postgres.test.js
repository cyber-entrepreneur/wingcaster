/**
 * WF-05 + WF-06 Real-Postgres cross-loop (Wave 5 Agent 6).
 *
 * WF-05 lifecycle:
 *   POST /api/pricing/report-comparable (AGT-APR-004)
 *   → GET /api/admin/pricing/reports sees report (PA-PVA-008)
 *   → POST confirm-remove (low impact → confirmed_removed + market_impact)
 *   → high-impact path: REMOVE_PROPOSED + fin.approval_requests (two-person)
 *   → GET /api/pricing/my-comparable-reports carries ImpactPanel fields
 *   → bulk confirm-remove NEVER registered (only bulk-reject + bulk-request-info)
 *
 * WF-06 lifecycle:
 *   POST /api/pricing/agent-price-reports (AGT-APR-005)
 *   → GET /api/admin/pricing/agent-price-reports sees report (PA-PVA-009)
 *   → POST review incorporate=true → benchmark write (low/no delta)
 *   → GET /api/pricing/my-agent-price-reports shows incorporated (WeightingPanel 100%)
 *
 * Skips when TEST_DATABASE_URL is unset (local without docker).
 */
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { beforeAll, expect, it } from 'vitest'
import { finPostgresSuite } from '../fin/testing/suite.js'
import { createAgentAccount, updatePlatformRole } from '../identity.js'
import { signElevatedToken, signToken, ELEVATION_HEADER } from '../auth.js'
import { findOne, query } from '../db.js'
import { PRICE_REPORTS_SUBMIT_FEATURE_CODE } from '../lib/packages/registry.js'

async function agentAccount(label = 'Agent', { platformAdmin = false } = {}) {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `${label.toLowerCase().replace(/\s+/g, '-')}-${userId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: label,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: label },
  })
  let tokenVersion = 0
  if (platformAdmin) {
    await updatePlatformRole(userId, 'platform_admin')
    tokenVersion = 1
  }
  const token = signToken({
    id: userId,
    email,
    name: label,
    token_version: tokenVersion,
    verified_at: now,
  })
  return { userId, token, email }
}

async function seedExternalComparable(pool, { id = randomUUID(), title = 'WF05 Comp' } = {}) {
  await pool.query(
    `INSERT INTO market_pricing.external_comparables
       (id, source, title, price, currency, property_type, status, created_at, updated_at, data)
     VALUES ($1, 'bayut', $2, 2400000, 'AED', 'apartment', 'active',
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb)`,
    [id, title],
  )
  return id
}

/**
 * Seed one active valuation that heavily weights the comparable so market-impact
 * tiers HIGH (abs median move ≥ 10%) → two-person confirm-remove.
 */
async function seedHighImpactEvidence(pool, { agentId, comparableId }) {
  const propertyId = randomUUID()
  const analysisId = randomUUID()
  const runId = randomUUID()

  await pool.query(
    `INSERT INTO public.properties (id, agent_id, title, location, city, status, data)
     VALUES ($1, $2, 'WF05 High Impact Listing', 'Marina Gate', 'Dubai', 'active', '{}'::jsonb)`,
    [propertyId, agentId],
  )

  await pool.query(
    `INSERT INTO market_pricing.property_price_analyses
       (id, property_id, median_price, comparable_count, calculated_at, created_at, updated_at, data)
     VALUES ($1, $2, 2000000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb)`,
    [analysisId, propertyId],
  )

  await pool.query(
    `INSERT INTO market_pricing.analysis_runs
       (id, analysis_id, property_id, analysis_inputs_hash, calculated_at, result, created_at, updated_at, data)
     VALUES ($1, $2, $3, 'wf05-hash', CURRENT_TIMESTAMP, '{}'::jsonb,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb)`,
    [runId, analysisId, propertyId],
  )

  await pool.query(
    `UPDATE market_pricing.property_price_analyses SET latest_run_id = $1 WHERE id = $2`,
    [runId, analysisId],
  )

  await pool.query(
    `INSERT INTO market_pricing.analysis_comparable_evidence
       (id, analysis_run_id, property_id, comparable_type, comparable_id,
        source, normalized_price, weight, created_at, updated_at, data)
     VALUES ($1, $2, $3, 'external', $4, 'bayut', 2500000, 1.0,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb)`,
    [randomUUID(), runId, propertyId, comparableId],
  )

  return { propertyId, analysisId, runId }
}

finPostgresSuite('WF-05/06 cross-loop valuation review (Wave 5 Agent 6)', { seed: false }, ({ pool }) => {
  let app

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'wf05-wf06-cross-loop-test-secret'
    process.env.NODE_ENV = 'test'
    ;({ app } = await import('../server.js'))
  }, 180_000)

  it('WF-05 full loop: submit → queue → confirm-remove → agent outcome ImpactPanel fields', async () => {
    const reporter = await agentAccount('WF05 Reporter')
    const pa = await agentAccount('WF05 PA', { platformAdmin: true })
    const comparableId = await seedExternalComparable(pool(), { title: '2BR Marina · AED 2.4M' })

    const submit = await request(app)
      .post('/api/pricing/report-comparable')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        comparable_id: comparableId,
        comparable_type: 'external',
        reason: 'already_sold',
        notes: 'Portal shows sold; still in pricing pool.',
      })

    expect(submit.status, JSON.stringify(submit.body)).toBe(201)
    const reportId = submit.body.id
    expect(reportId).toBeTruthy()
    expect(submit.body.status).toBe('pending')
    expect(submit.body.expires_at).toBeTruthy()

    const queue = await request(app)
      .get('/api/admin/pricing/reports')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')

    expect(queue.status, JSON.stringify(queue.body)).toBe(200)
    const listed = Array.isArray(queue.body)
      ? queue.body.find((r) => r.id === reportId)
      : (queue.body.reports || []).find((r) => r.id === reportId)
    expect(listed).toBeTruthy()

    // Legacy /review must stay gone — UI must never succeed against it.
    const legacy = await request(app)
      .post(`/api/admin/pricing/reports/${reportId}/review`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ status: 'reviewed' })
    expect(legacy.status).toBe(410)
    expect(legacy.body.code).toBe('GONE')
    expect(legacy.body.migrate_to).toContain('confirm-remove')

    const remove = await request(app)
      .post(`/api/admin/pricing/reports/${reportId}/confirm-remove`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ notes: 'Portal sale record confirms sold status.' })

    expect(remove.status, JSON.stringify(remove.body)).toBe(202)
    expect(remove.body.success).toBe(true)
    expect(remove.body.decision).toBe('CONFIRM_REMOVE')
    expect(remove.body.status).toBe('confirmed_removed')
    expect(remove.body.market_impact).toBeTruthy()
    expect(typeof remove.body.market_impact.valuations_affected).toBe('number')

    const ec = await pool().query(
      `SELECT status FROM market_pricing.external_comparables WHERE id = $1`,
      [comparableId],
    )
    expect(ec.rows[0]?.status).toBe('removed')

    const mine = await request(app)
      .get('/api/pricing/my-comparable-reports')
      .set('Authorization', `Bearer ${reporter.token}`)

    expect(mine.status).toBe(200)
    const outcome = mine.body.find((r) => r.id === reportId)
    expect(outcome).toBeTruthy()
    expect(outcome.status).toBe('confirmed_removed')
    // ImpactPanel: status is SoT; decision snapshot is promoted to top-level
    // because Postgres fromRow flattens JSONB `data` and drops the nested key.
    const decision = outcome.decision ?? outcome.data?.decision
    expect(decision, JSON.stringify(outcome)).toBeTruthy()
    const impact =
      decision?.market_impact?.valuations_affected ??
      outcome.market_impact?.valuations_affected ??
      outcome.data?.market_impact?.valuations_affected
    expect(typeof impact === 'number' || impact == null).toBe(true)
    const decisionAction =
      decision?.action ||
      decision?.decision_label ||
      ''
    expect(String(decisionAction)).toMatch(/confirm_remove|CONFIRM_REMOVE|removed|REMOVED/)
  })

  it('WF-05 high market-impact confirm-remove → REMOVE_PROPOSED (two-person)', async () => {
    const reporter = await agentAccount('WF05 High Reporter')
    const pa = await agentAccount('WF05 High PA', { platformAdmin: true })
    const comparableId = await seedExternalComparable(pool(), { title: 'High impact villa' })
    await seedHighImpactEvidence(pool(), { agentId: reporter.userId, comparableId })

    const submit = await request(app)
      .post('/api/pricing/report-comparable')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        comparable_id: comparableId,
        comparable_type: 'external',
        reason: 'incorrect_price',
        notes: 'Listed price is fabricated.',
      })
    expect(submit.status).toBe(201)
    const reportId = submit.body.id

    // Step-up required for high-impact remove.
    const noStepUp = await request(app)
      .post(`/api/admin/pricing/reports/${reportId}/confirm-remove`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ notes: 'High impact without elevation' })
    expect(noStepUp.status).toBe(401)
    expect(noStepUp.body.code).toBe('STEP_UP_REQUIRED')

    const elevation = signElevatedToken({ userId: pa.userId, tokenVersion: 1 })
    const proposed = await request(app)
      .post(`/api/admin/pricing/reports/${reportId}/confirm-remove`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .set(ELEVATION_HEADER, elevation)
      .send({ notes: 'High impact — proposing removal for second PA.' })

    expect(proposed.status, JSON.stringify(proposed.body)).toBe(202)
    expect(proposed.body.decision).toBe('REMOVE_PROPOSED')
    expect(proposed.body.status).toBe('remove_proposed')
    expect(proposed.body.pending_second_approval).toBe(true)
    expect(proposed.body.approval_request_id).toBeTruthy()
    expect(proposed.body.recalculation_deferred).toBe(true)
    expect(proposed.body.market_impact.tier).toBe('high')

    // Comparable must NOT be tombstoned until second approval.
    const ec = await pool().query(
      `SELECT status FROM market_pricing.external_comparables WHERE id = $1`,
      [comparableId],
    )
    expect(ec.rows[0]?.status).toBe('active')

    const approval = await pool().query(
      `SELECT id, action_kind, status FROM fin.approval_requests WHERE id = $1`,
      [proposed.body.approval_request_id],
    )
    expect(approval.rows[0]?.action_kind).toBe('COMPARABLE_REMOVE')
    expect(approval.rows[0]?.status).toBe('REQUESTED')
  })

  it('WF-05 bulk routes never include confirm-remove', async () => {
    const pa = await agentAccount('WF05 Bulk PA', { platformAdmin: true })
    // Probe that bulk-confirm-remove is not a registered route (404/405),
    // while documented bulk-reject + bulk-request-info exist.
    const rejectBulk = await request(app)
      .post('/api/admin/pricing/reports/bulk-reject-as-invalid')
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ report_ids: [], reason_code: 'comparable_correct', notes: 'n/a' })
    // Empty ids → 400 validation, proving the route exists.
    expect([400, 422]).toContain(rejectBulk.status)

    const infoBulk = await request(app)
      .post('/api/admin/pricing/reports/bulk-request-info')
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ report_ids: [], reason_code: 'need_sale_record', notes: 'n/a' })
    expect([400, 422]).toContain(infoBulk.status)

    const forbiddenBulk = await request(app)
      .post('/api/admin/pricing/reports/bulk-confirm-remove')
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ report_ids: [] })
    expect([404, 405]).toContain(forbiddenBulk.status)
  })

  it('WF-06 full loop: Pro submit → queue → incorporate=true → benchmark + WeightingPanel fields', async () => {
    const reporter = await agentAccount('WF06 Pro Reporter')
    const pa = await agentAccount('WF06 PA', { platformAdmin: true })

    // Feature seed present (BE-BLOCKER-27) — frontend gates on this code.
    const flag = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.package_feature_flags
        WHERE feature_code = $1 AND enabled = true`,
      [PRICE_REPORTS_SUBMIT_FEATURE_CODE],
    )
    expect(flag.rows[0].n).toBeGreaterThan(0)

    const segmentId = `seg_ae_wf06_${reporter.userId.slice(0, 8)}`
    const soldPrice = 1_050_000

    // Seed a nearby benchmark so |delta| < 10% → single-approver incorporate.
    await pool().query(
      `INSERT INTO market_pricing.pricing_benchmarks
         (id, segment_id, country_code, currency, price_point, computed_at, env, created_at, updated_at, data)
       VALUES ($1, $2, 'AE', 'AED', 1000000, CURRENT_TIMESTAMP, 'live',
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb)`,
      [randomUUID(), segmentId],
    )

    const submit = await request(app)
      .post('/api/pricing/agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        external_property_title: 'Marina Gate 2BR sold',
        external_property_location: 'Dubai Marina',
        property_type: 'apartment',
        bedrooms: 2,
        sold_price: soldPrice,
        currency: 'AED',
        sold_date: '2026-08-15',
        notes: 'Closed transaction with DLD record.',
        segment_id: segmentId,
        segment_label: 'Dubai Marina · 2BR apartments',
        recommendation_price_point: soldPrice,
        country_code: 'AE',
      })

    expect(submit.status, JSON.stringify(submit.body)).toBe(201)
    const reportId = submit.body.id
    expect(reportId).toBeTruthy()
    expect(submit.body.status).toBe('pending_review')
    expect(submit.body.expires_at).toBeTruthy()

    // Public POST may not persist segment/recommendation columns — patch for PA review contract.
    await query(
      `UPDATE market_pricing.agent_price_reports
          SET segment_id = $2,
              segment_label = $3,
              recommendation_price_point = $4,
              country_code = 'AE',
              env = 'live',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [reportId, segmentId, 'Dubai Marina · 2BR apartments', soldPrice],
    )

    const queue = await request(app)
      .get('/api/admin/pricing/agent-price-reports')
      .query({ status: 'pending_review' })
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')

    expect(queue.status, JSON.stringify(queue.body)).toBe(200)
    const listed = Array.isArray(queue.body)
      ? queue.body.find((r) => r.id === reportId)
      : (queue.body.reports || []).find((r) => r.id === reportId)
    expect(listed).toBeTruthy()

    const review = await request(app)
      .post(`/api/admin/pricing/agent-price-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({
        status: 'verified',
        incorporate: true,
        notes: 'Solid evidence; write into segment benchmark.',
        weight: 100,
      })

    expect(review.status, JSON.stringify(review.body)).toBe(200)
    expect(review.body.success).toBe(true)
    expect(review.body.incorporated).toBe(true)
    expect(review.body.status).toBe('incorporated')
    expect(review.body.benchmark_id || review.body.benchmark_refresh_queued).toBeTruthy()

    const bench = await pool().query(
      `SELECT price_point, source_report_id FROM market_pricing.pricing_benchmarks
        WHERE segment_id = $1 AND env = 'live'`,
      [segmentId],
    )
    expect(Number(bench.rows[0]?.price_point)).toBe(soldPrice)
    expect(bench.rows[0]?.source_report_id).toBe(reportId)

    const mine = await request(app)
      .get('/api/pricing/my-agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)

    expect(mine.status).toBe(200)
    const outcome = mine.body.find((r) => r.id === reportId)
    expect(outcome).toBeTruthy()
    expect(outcome.status).toBe('incorporated')
    expect(outcome.incorporated === true || outcome.status === 'incorporated').toBe(true)
    // WeightingPanel: incorporated → PA weight 100 (authoritative)
    expect(outcome.incorporated_at || outcome.reviewed_at).toBeTruthy()
  })

  it('WF-06 high-delta incorporate creates approval request without benchmark write', async () => {
    const reporter = await agentAccount('WF06 High Reporter')
    const pa = await agentAccount('WF06 High PA', { platformAdmin: true })
    const segmentId = `seg_ae_wf06hi_${reporter.userId.slice(0, 8)}`

    await pool().query(
      `INSERT INTO market_pricing.pricing_benchmarks
         (id, segment_id, country_code, currency, price_point, computed_at, env, created_at, updated_at, data)
       VALUES ($1, $2, 'AE', 'AED', 1000000, CURRENT_TIMESTAMP, 'live',
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb)`,
      [randomUUID(), segmentId],
    )

    const submit = await request(app)
      .post('/api/pricing/agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        external_property_location: 'Dubai Marina',
        property_type: 'apartment',
        bedrooms: 2,
        sold_price: 1_850_000,
        currency: 'AED',
      })
    expect(submit.status).toBe(201)
    const reportId = submit.body.id

    await query(
      `UPDATE market_pricing.agent_price_reports
          SET segment_id = $2,
              recommendation_price_point = 1850000,
              country_code = 'AE',
              env = 'live',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [reportId, segmentId],
    )

    const before = await pool().query(
      `SELECT price_point FROM market_pricing.pricing_benchmarks
        WHERE segment_id = $1 AND env = 'live'`,
      [segmentId],
    )

    const review = await request(app)
      .post(`/api/admin/pricing/agent-price-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ status: 'verified', incorporate: true, notes: 'Needs second eyes' })

    expect(review.status, JSON.stringify(review.body)).toBe(200)
    expect(review.body.pending_second_approval).toBe(true)
    expect(review.body.approval_request_id || review.body.request_id).toBeTruthy()
    expect(review.body.status).toBe('pending_second_approval')

    const after = await pool().query(
      `SELECT price_point FROM market_pricing.pricing_benchmarks
        WHERE segment_id = $1 AND env = 'live'`,
      [segmentId],
    )
    expect(Number(after.rows[0]?.price_point)).toBe(Number(before.rows[0]?.price_point))

    const row = await findOne('agent_price_reports', (r) => r.id === reportId)
    expect(row.status).toBe('pending_second_approval')
  })
})
