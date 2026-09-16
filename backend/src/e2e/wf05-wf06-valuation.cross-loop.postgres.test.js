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
import { findOne } from '../db.js'
import { PRICE_REPORTS_SUBMIT_FEATURE_CODE } from '../lib/packages/registry.js'
import { grantPriceReportsSubmit } from '../lib/packages/test-support.js'
import { runSlaStuckRequestsReaper } from '../workers/sla-stuck-requests-reaper.js'
import { runReportExpiryTick, reportExpiresAt } from '../workers/report-expiry-worker.js'

async function agentAccount(label = 'Agent', {
  platformAdmin = false,
  priceReportsSubmit = false,
  pool: dbPool = null,
} = {}) {
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
  if (priceReportsSubmit) {
    if (!dbPool) throw new Error('agentAccount: pool required when priceReportsSubmit=true')
    await grantPriceReportsSubmit(dbPool, { userId })
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

  // Locks the production entitlement gate at the Real-PG boundary: a plain agent
  // (Free-tier subscription, no `valuation.price_reports.submit` package flag —
  // migration 338) MUST be rejected with 403 FEATURE_NOT_ENABLED on both submit
  // routes. This is the negative complement to the `priceReportsSubmit: true`
  // grant every other case uses, and the exact drift the Real-PG lane exists to
  // catch (unit mocks stub `requirePriceReportsSubmitEntitlement`, hiding it).
  it('entitlement gate: plain agent without the price_reports.submit flag is rejected 403 on both submit routes', async () => {
    const plain = await agentAccount('WF Ungranted Reporter') // no priceReportsSubmit grant
    const comparableId = await seedExternalComparable(pool(), { title: 'Ungranted comp' })

    const comparable = await request(app)
      .post('/api/pricing/report-comparable')
      .set('Authorization', `Bearer ${plain.token}`)
      .send({
        comparable_id: comparableId,
        comparable_type: 'external',
        reason: 'already_sold',
        notes: 'Should be gated — no Pro entitlement.',
      })
    expect(comparable.status, JSON.stringify(comparable.body)).toBe(403)
    expect(comparable.body.code).toBe('FEATURE_NOT_ENABLED')
    expect(comparable.body.required_capability).toBe(PRICE_REPORTS_SUBMIT_FEATURE_CODE)

    const priceReport = await request(app)
      .post('/api/pricing/agent-price-reports')
      .set('Authorization', `Bearer ${plain.token}`)
      .send({
        external_property_title: 'Ungranted 2BR',
        external_property_location: 'Dubai Marina',
        property_type: 'apartment',
        bedrooms: 2,
        sold_price: 1_050_000,
        currency: 'AED',
        sold_date: '2026-08-15',
        notes: 'Should be gated — no Pro entitlement.',
        segment_id: `seg_ae_ungranted_${plain.userId.slice(0, 8)}`,
        segment_label: 'Dubai Marina · 2BR apartments',
        recommendation_price_point: 1_050_000,
      })
    expect(priceReport.status, JSON.stringify(priceReport.body)).toBe(403)
    expect(priceReport.body.code).toBe('FEATURE_NOT_ENABLED')
    expect(priceReport.body.required_capability).toBe(PRICE_REPORTS_SUBMIT_FEATURE_CODE)
  })

  it('WF-05 full loop: submit → queue → confirm-remove → agent outcome ImpactPanel fields', async () => {
    const reporter = await agentAccount('WF05 Reporter', { priceReportsSubmit: true, pool: pool() })
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
    // Keep the filing reporter a normal agent (high-impact evidence is agent-owned).
    // OWN_CASE is asserted via a separate platform_admin who we re-tag as
    // reporter_id — reaches the handler past requirePlatformAdmin without
    // weakening the admin vote gate.
    const reporter = await agentAccount('WF05 High Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('WF05 High PA', { platformAdmin: true })
    const ownAdmin = await agentAccount('WF05 Own-Case Admin', { platformAdmin: true })
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

    const approvalId = proposed.body.approval_request_id
    const pa2 = await agentAccount('WF05 Second PA', { platformAdmin: true })

    const same = await request(app)
      .post(`/api/admin/valuation/approval-requests/${approvalId}/vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ decision: 'approve', notes: 'same reviewer' })
    expect(same.status).toBe(409)
    expect(same.body.code).toBe('SAME_REVIEWER')

    await pool().query(
      `UPDATE market_pricing.comparable_reports SET reporter_id = $1 WHERE id = $2`,
      [ownAdmin.userId, reportId],
    )
    const own = await request(app)
      .post(`/api/admin/valuation/approval-requests/${approvalId}/vote`)
      .set('Authorization', `Bearer ${ownAdmin.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ decision: 'approve', notes: 'own case' })
    expect(own.status).toBe(403)
    expect(own.body.code).toBe('OWN_CASE')

    const vote = await request(app)
      .post(`/api/admin/valuation/approval-requests/${approvalId}/vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ decision: 'approve', notes: 'second PA confirms remove' })
    expect(vote.status, JSON.stringify(vote.body)).toBe(200)
    expect(String(vote.body.status || vote.body.report?.status)).toMatch(/confirmed_removed/i)

    const approved = await pool().query(
      `SELECT status FROM fin.approval_requests WHERE id = $1`,
      [approvalId],
    )
    expect(approved.rows[0]?.status).toBe('APPROVED')

    const ecAfter = await pool().query(
      `SELECT status FROM market_pricing.external_comparables WHERE id = $1`,
      [comparableId],
    )
    expect(ecAfter.rows[0]?.status).toBe('removed')

    const audit = await pool().query(
      `SELECT action FROM fin.financial_audit_events
        WHERE approval_request_id = $1
          AND action = 'COMPARABLE_REPORT_CONFIRMED_REMOVED'
        ORDER BY created_at DESC LIMIT 1`,
      [approvalId],
    )
    expect(audit.rows[0]?.action).toBe('COMPARABLE_REPORT_CONFIRMED_REMOVED')

    const outbox = await pool().query(
      `SELECT topic FROM fin.outbox_events
        WHERE dedupe_key = $1
           OR (topic = 'valuation.comparable_removed' AND payload->>'approval_request_id' = $2)
        ORDER BY created_at DESC LIMIT 1`,
      [`wf05:comparable_remove:${approvalId}:approve`, approvalId],
    )
    expect(outbox.rows[0]?.topic).toBe('valuation.comparable_removed')

    const again = await request(app)
      .post(`/api/admin/valuation/approval-requests/${approvalId}/vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ decision: 'approve', notes: 'already done' })
    expect(again.status).toBe(410)
    expect(again.body.code).toBe('TOKEN_CONSUMED')
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
    const reporter = await agentAccount('WF06 Pro Reporter', { priceReportsSubmit: true, pool: pool() })
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
    expect(submit.body.segment_id).toBe(segmentId)
    expect(Number(submit.body.recommendation_price_point)).toBe(soldPrice)
    expect(submit.body.country_code).toBe('AE')
    expect(submit.body.env || 'live').toBe('live')

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
    // Reporter is also platform_admin so OWN_CASE is reachable past
    // requirePlatformAdmin — do not weaken the admin vote gate for this assert.
    const reporter = await agentAccount('WF06 High Reporter', {
      platformAdmin: true,
      priceReportsSubmit: true,
      pool: pool(),
    })
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
        notes: 'High-delta Marina sale needing second approver.',
        segment_id: segmentId,
        segment_label: 'Dubai Marina · high delta',
        recommendation_price_point: 1850000,
        country_code: 'AE',
      })
    expect(submit.status).toBe(201)
    const reportId = submit.body.id

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

    expect(row.segment_id).toBe(segmentId)
    expect(Number(row.recommendation_price_point)).toBe(1850000)

    const approvalId = review.body.approval_request_id || review.body.request_id
    const pa2 = await agentAccount('WF06 Second PA', { platformAdmin: true })

    const same = await request(app)
      .post(`/api/admin/valuation/approval-requests/${approvalId}/vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ decision: 'approve' })
    expect(same.status).toBe(409)
    expect(same.body.code).toBe('SAME_REVIEWER')

    const own = await request(app)
      .post(`/api/admin/valuation/approval-requests/${approvalId}/vote`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ decision: 'approve' })
    expect(own.status).toBe(403)
    expect(own.body.code).toBe('OWN_CASE')

    const vote = await request(app)
      .post(`/api/admin/valuation/approval-requests/${approvalId}/vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ decision: 'approve', notes: 'second PA incorporate' })
    expect(vote.status, JSON.stringify(vote.body)).toBe(200)
    expect(vote.body.status).toBe('incorporated')
    expect(vote.body.incorporated).toBe(true)

    const approved = await pool().query(
      `SELECT status FROM fin.approval_requests WHERE id = $1`,
      [approvalId],
    )
    expect(approved.rows[0]?.status).toBe('APPROVED')

    const afterVote = await pool().query(
      `SELECT price_point, source_report_id FROM market_pricing.pricing_benchmarks
        WHERE segment_id = $1 AND env = 'live'`,
      [segmentId],
    )
    expect(Number(afterVote.rows[0]?.price_point)).toBe(1850000)
    expect(afterVote.rows[0]?.source_report_id).toBe(reportId)

    const reportAfter = await findOne('agent_price_reports', (r) => r.id === reportId)
    expect(reportAfter.status).toBe('incorporated')

    // One-snapshot invariant: APPROVED ⇔ incorporated ⇔ second_approval_approved audit
    const invariant = await pool().query(
      `SELECT
         ar.status AS approval_status,
         pr.status AS report_status,
         COALESCE(pr.data->'audit_trail', '[]'::jsonb) AS audit_trail
       FROM fin.approval_requests ar
       JOIN market_pricing.agent_price_reports pr ON pr.id = $2
      WHERE ar.id = $1`,
      [approvalId, reportId],
    )
    expect(invariant.rows[0].approval_status).toBe('APPROVED')
    expect(invariant.rows[0].report_status).toBe('incorporated')
    const auditTrail = invariant.rows[0].audit_trail
    const trail = typeof auditTrail === 'string' ? JSON.parse(auditTrail) : auditTrail
    expect(trail.some((e) => e.action === 'second_approval_approved')).toBe(true)

    const outbox = await pool().query(
      `SELECT topic FROM fin.outbox_events
        WHERE dedupe_key = $1
           OR (topic = 'valuation.price_report_incorporated' AND payload->>'approval_request_id' = $2)
        ORDER BY created_at DESC LIMIT 1`,
      [`wf06:price_incorporate:${approvalId}:approve`, approvalId],
    )
    expect(outbox.rows[0]?.topic).toBe('valuation.price_report_incorporated')

    const again = await request(app)
      .post(`/api/admin/valuation/approval-requests/${approvalId}/vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ decision: 'approve' })
    expect(again.status).toBe(410)
    expect(again.body.code).toBe('TOKEN_CONSUMED')
  })


  it('WF-06 approve chaos: commitIncorporate throw rolls back vote (no partial state)', async () => {
    const reporter = await agentAccount('WF06 Chaos Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('WF06 Chaos PA', { platformAdmin: true })
    const segmentId = `seg_ae_chaos_${reporter.userId.slice(0, 8)}`
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
        external_property_title: 'Chaos path',
        external_property_location: 'Dubai Marina',
        property_type: 'apartment',
        bedrooms: 2,
        sold_price: 1850000,
        currency: 'AED',
        notes: 'Chaos injection path for atomicity proof.',
        segment_id: segmentId,
        segment_label: 'Dubai Marina · chaos',
        recommendation_price_point: 1850000,
        country_code: 'AE',
      })
    expect(submit.status, JSON.stringify(submit.body)).toBe(201)
    const reportId = submit.body.id

    const review = await request(app)
      .post(`/api/admin/pricing/agent-price-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ status: 'verified', incorporate: true, notes: 'Needs second eyes' })
    expect(review.status).toBe(200)
    const approvalId = review.body.approval_request_id || review.body.request_id
    expect(approvalId).toBeTruthy()

    // Inject failure flag used by commitIncorporate (rolls back outer approve txn).
    await pool().query(
      `UPDATE market_pricing.agent_price_reports
          SET data = COALESCE(data, '{}'::jsonb) || '{"__force_incorporate_throw": true}'::jsonb
        WHERE id = $1`,
      [reportId],
    )

    const pa2 = await agentAccount('WF06 Chaos PA2', { platformAdmin: true })
    const vote = await request(app)
      .post(`/api/admin/valuation/approval-requests/${approvalId}/vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ decision: 'approve', notes: 'should roll back' })
    expect(vote.status).toBeGreaterThanOrEqual(500)

    const snap = await pool().query(
      `SELECT
         (SELECT status FROM fin.approval_requests WHERE id = $1) AS approval_status,
         (SELECT status FROM market_pricing.agent_price_reports WHERE id = $2) AS report_status,
         (SELECT COUNT(*)::int FROM fin.approval_actions
           WHERE request_id = $1 AND decision = 'APPROVED'
             AND actor_id::text = $3) AS second_vote_actions,
         (SELECT COUNT(*)::int FROM fin.outbox_events
           WHERE topic = 'valuation.price_report_incorporated'
             AND payload->>'approval_request_id' = $1::text) AS outbox_rows,
         (SELECT COALESCE(data->'audit_trail', '[]'::jsonb)
            FROM market_pricing.agent_price_reports WHERE id = $2) AS audit_trail`,
      [approvalId, reportId, pa2.userId],
    )
    const row = snap.rows[0]
    expect(row.approval_status).toBe('REQUESTED')
    expect(row.report_status).toBe('pending_second_approval')
    expect(row.second_vote_actions).toBe(0)
    expect(row.outbox_rows).toBe(0)
    const trail = typeof row.audit_trail === 'string' ? JSON.parse(row.audit_trail) : row.audit_trail
    expect(Array.isArray(trail) ? trail.some((e) => e.action === 'second_approval_approved') : false).toBe(false)
  })

  it('WF-05 reject-as-invalid -> rejected outcome', async () => {
    const reporter = await agentAccount('WF05 Reject Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('WF05 Reject PA', { platformAdmin: true })
    const comparableId = await seedExternalComparable(pool(), { title: 'Reject path comp' })

    const submit = await request(app)
      .post('/api/pricing/report-comparable')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        comparable_id: comparableId,
        comparable_type: 'external',
        reason: 'other',
        notes: 'Looks fine to me after re-check.',
      })
    expect(submit.status).toBe(201)
    const reportId = submit.body.id

    const reject = await request(app)
      .post(`/api/admin/pricing/reports/${reportId}/reject-as-invalid`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ reason_code: 'comparable_correct', notes: 'Listing still active on portal.' })
    expect(reject.status, JSON.stringify(reject.body)).toBe(200)
    expect(reject.body.status).toBe('rejected')
    expect(reject.body.decision).toBe('REJECT_AS_INVALID')

    const mine = await request(app)
      .get('/api/pricing/my-comparable-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
    expect(mine.status).toBe(200)
    expect(mine.body.find((r) => r.id === reportId)?.status).toBe('rejected')
  })

  it('WF-05 request-info -> awaiting_info (needs-revision)', async () => {
    const reporter = await agentAccount('WF05 Info Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('WF05 Info PA', { platformAdmin: true })
    const comparableId = await seedExternalComparable(pool(), { title: 'Needs info comp' })

    const submit = await request(app)
      .post('/api/pricing/report-comparable')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        comparable_id: comparableId,
        comparable_type: 'external',
        reason: 'already_sold',
        notes: 'Sold last week per broker.',
      })
    expect(submit.status).toBe(201)

    const info = await request(app)
      .post(`/api/admin/pricing/reports/${submit.body.id}/request-info`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({
        reason_code: 'need_sale_record',
        notes: 'Please attach DLD sale extract.',
        requested_evidence: ['sale_record'],
      })
    expect(info.status, JSON.stringify(info.body)).toBe(200)
    expect(info.body.status).toBe('awaiting_info')

    const mine = await request(app)
      .get('/api/pricing/my-comparable-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
    expect(mine.body.find((r) => r.id === submit.body.id)?.status).toBe('awaiting_info')
  })

  it('WF-05 withdrawn -> proposal recalled to pending', async () => {
    const reporter = await agentAccount('WF05 Withdraw Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('WF05 Withdraw PA', { platformAdmin: true })
    const comparableId = await seedExternalComparable(pool(), { title: 'Withdraw path villa' })
    await seedHighImpactEvidence(pool(), { agentId: reporter.userId, comparableId })

    const submit = await request(app)
      .post('/api/pricing/report-comparable')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        comparable_id: comparableId,
        comparable_type: 'external',
        reason: 'incorrect_price',
        notes: 'Price looks fabricated on portal.',
      })
    expect(submit.status).toBe(201)
    const reportId = submit.body.id

    const elevation = signElevatedToken({ userId: pa.userId, tokenVersion: 1 })
    const proposed = await request(app)
      .post(`/api/admin/pricing/reports/${reportId}/confirm-remove`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .set(ELEVATION_HEADER, elevation)
      .send({ notes: 'Proposing then withdrawing.' })
    expect(proposed.status).toBe(202)
    expect(proposed.body.status).toBe('remove_proposed')

    const recall = await request(app)
      .post(`/api/admin/pricing/reports/${reportId}/recall-proposal`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ reason: 'Found confirming sale record; withdrawing proposal.' })
    expect(recall.status, JSON.stringify(recall.body)).toBe(200)
    expect(recall.body.status).toBe('pending')

    if (proposed.body.approval_request_id) {
      const approval = await pool().query(
        `SELECT status FROM fin.approval_requests WHERE id = $1`,
        [proposed.body.approval_request_id],
      )
      expect(approval.rows[0]?.status).toBe('WITHDRAWN')
    }
  })

  it('WF-05 expired/SLA auto-close via report-expiry worker', async () => {
    const reporter = await agentAccount('WF05 Expiry Reporter', { priceReportsSubmit: true, pool: pool() })
    const comparableId = await seedExternalComparable(pool(), { title: 'Expiry path comp' })
    const submit = await request(app)
      .post('/api/pricing/report-comparable')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        comparable_id: comparableId,
        comparable_type: 'external',
        reason: 'already_sold',
        notes: 'Will expire for SLA auto-close.',
      })
    expect(submit.status).toBe(201)
    const reportId = submit.body.id

    await pool().query(
      `UPDATE market_pricing.comparable_reports
          SET expires_at = NOW() - INTERVAL '1 hour',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [reportId],
    )

    const tick = await runReportExpiryTick({ pool: pool() })
    expect(tick.expired || tick.tables?.comparable_reports?.expired || 0).toBeGreaterThan(0)

    const row = await pool().query(
      `SELECT status FROM market_pricing.comparable_reports WHERE id = $1`,
      [reportId],
    )
    expect(row.rows[0]?.status).toBe('expired')
  })

  it('WF-05 signal-only confirm-quarantine -> confirmed_quarantined', async () => {
    const reporter = await agentAccount('WF05 Signal Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('WF05 Signal PA', { platformAdmin: true })
    const comparableId = await seedExternalComparable(pool(), { title: 'Signal-only quarantine' })

    const submit = await request(app)
      .post('/api/pricing/report-comparable')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        comparable_id: comparableId,
        comparable_type: 'external',
        reason: 'wrong_details',
        notes: 'Soft signal - quarantine instead of remove.',
      })
    expect(submit.status).toBe(201)

    const quarantine = await request(app)
      .post(`/api/admin/pricing/reports/${submit.body.id}/confirm-quarantine`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ notes: 'Temporary quarantine while portal catches up.', quarantine_hours: 72 })
    expect(quarantine.status, JSON.stringify(quarantine.body)).toBe(200)
    expect(quarantine.body.status).toBe('confirmed_quarantined')

    const mine = await request(app)
      .get('/api/pricing/my-comparable-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
    expect(mine.body.find((r) => r.id === submit.body.id)?.status).toBe('confirmed_quarantined')
  })

  it('WF-06 PA reject -> rejected; agent outcome sees rejection', async () => {
    const reporter = await agentAccount('WF06 Reject Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('WF06 Reject PA', { platformAdmin: true })
    const submit = await request(app)
      .post('/api/pricing/agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        external_property_title: 'Reject path sale',
        external_property_location: 'JLT',
        property_type: 'apartment',
        bedrooms: 1,
        sold_price: 900000,
        currency: 'AED',
        notes: 'Agent claims closed sale.',
        segment_id: 'seg_ae_jlt_1br',
        segment_label: 'JLT · 1BR',
        recommendation_price_point: 900000,
        country_code: 'AE',
      })
    expect(submit.status).toBe(201)
    const reportId = submit.body.id

    const reject = await request(app)
      .post(`/api/admin/pricing/agent-price-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ status: 'rejected', reason_code: 'insufficient_evidence', notes: 'No DLD proof attached.' })
    expect(reject.status, JSON.stringify(reject.body)).toBe(200)
    expect(reject.body.status).toBe('rejected')

    const mine = await request(app)
      .get('/api/pricing/my-agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
    expect(mine.status).toBe(200)
    const outcome = mine.body.find((r) => r.id === reportId)
    expect(outcome?.status).toBe('rejected')
    expect(outcome?.incorporated).not.toBe(true)
  })

  it('WF-06 request-info loop -> request_info then agent resubmit state', async () => {
    const reporter = await agentAccount('WF06 Info Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('WF06 Info PA', { platformAdmin: true })
    const submit = await request(app)
      .post('/api/pricing/agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        external_property_location: 'Business Bay',
        property_type: 'apartment',
        bedrooms: 2,
        sold_price: 1400000,
        currency: 'AED',
        notes: 'Need more sale evidence from agent.',
        segment_id: 'seg_ae_bbay_2br',
        segment_label: 'Business Bay · 2BR',
        recommendation_price_point: 1400000,
        country_code: 'AE',
      })
    expect(submit.status).toBe(201)

    const info = await request(app)
      .post(`/api/admin/pricing/agent-price-reports/${submit.body.id}/review`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ status: 'request_info', reason_code: 'need_sale_record', notes: 'Need DLD PDF.' })
    expect(info.status, JSON.stringify(info.body)).toBe(200)
    expect(info.body.status).toBe('request_info')

    const mine = await request(app)
      .get('/api/pricing/my-agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
    expect(mine.body.find((r) => r.id === submit.body.id)?.status).toBe('request_info')
  })

  it('WF-06 agent-sees-rejection outcome fields after PA reject', async () => {
    const reporter = await agentAccount('WF06 Outcome Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('WF06 Outcome PA', { platformAdmin: true })
    const submit = await request(app)
      .post('/api/pricing/agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        external_property_title: 'Outcome reject sale',
        sold_price: 1100000,
        currency: 'AED',
        country_code: 'AE',
        notes: 'Will be rejected for outcome panel.',
        segment_id: 'seg_ae_outcome_1br',
        segment_label: 'Outcome · 1BR',
        recommendation_price_point: 1100000,
      })
    expect(submit.status).toBe(201)
    const reportId = submit.body.id

    await request(app)
      .post(`/api/admin/pricing/agent-price-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ status: 'rejected', notes: 'Comparable already in pool; not a closed sale.' })

    const mine = await request(app)
      .get('/api/pricing/my-agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
    const outcome = mine.body.find((r) => r.id === reportId)
    expect(outcome).toBeTruthy()
    expect(outcome.status).toBe('rejected')
    expect(outcome.reviewed_at || outcome.updated_at).toBeTruthy()
    expect(outcome.incorporated === true).toBe(false)
  })

  it('SLA stuck reaper -> dead_letter + sla_reaped audit for WF-05 and WF-06', async () => {
    const reporter = await agentAccount('SLA Reaper Reporter', { priceReportsSubmit: true, pool: pool() })
    const pa = await agentAccount('SLA Reaper PA', { platformAdmin: true })

    // WF-05 high-impact ? REQUESTED approval, then age it past SLA
    const comparableId = await seedExternalComparable(pool(), { title: 'SLA stuck comp' })
    await seedHighImpactEvidence(pool(), { agentId: reporter.userId, comparableId })
    const submit5 = await request(app)
      .post('/api/pricing/report-comparable')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        comparable_id: comparableId,
        comparable_type: 'external',
        reason: 'incorrect_price',
        notes: 'High impact stuck approval for reaper.',
      })
    expect(submit5.status).toBe(201)
    const elevation = signElevatedToken({ userId: pa.userId, tokenVersion: 1 })
    const proposed = await request(app)
      .post(`/api/admin/pricing/reports/${submit5.body.id}/confirm-remove`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .set(ELEVATION_HEADER, elevation)
      .send({ notes: 'Leave pending for SLA reaper.' })
    expect(proposed.status).toBe(202)
    const apr5 = proposed.body.approval_request_id
    expect(apr5).toBeTruthy()

    // WF-06 high-delta ? pending_second_approval
    const segmentId = `seg_ae_sla_${reporter.userId.slice(0, 8)}`
    await pool().query(
      `INSERT INTO market_pricing.pricing_benchmarks
         (id, segment_id, country_code, currency, price_point, computed_at, env, created_at, updated_at, data)
       VALUES ($1, $2, 'AE', 'AED', 1000000, CURRENT_TIMESTAMP, 'live',
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb)`,
      [randomUUID(), segmentId],
    )
    const submit6 = await request(app)
      .post('/api/pricing/agent-price-reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({
        external_property_location: 'Marina',
        property_type: 'apartment',
        bedrooms: 2,
        sold_price: 1850000,
        currency: 'AED',
        notes: 'High-delta report left pending for SLA reaper coverage.',
        segment_id: segmentId,
        segment_label: 'Marina · SLA stuck',
        recommendation_price_point: 1850000,
        country_code: 'AE',
      })
    expect(submit6.status).toBe(201)
    const review = await request(app)
      .post(`/api/admin/pricing/agent-price-reports/${submit6.body.id}/review`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ status: 'verified', incorporate: true, notes: 'High delta stuck for reaper' })
    expect(review.status).toBe(200)
    const apr6 = review.body.approval_request_id || review.body.request_id
    expect(apr6).toBeTruthy()

    await pool().query(
      `UPDATE fin.approval_requests
          SET created_at = NOW() - INTERVAL '72 hours',
              updated_at = NOW() - INTERVAL '72 hours'
        WHERE id = ANY($1::uuid[])`,
      [[apr5, apr6]],
    )

    const result = await runSlaStuckRequestsReaper({ pool: pool(), slaHours: 48 })
    expect(result.reaped).toBeGreaterThanOrEqual(2)

    for (const id of [apr5, apr6]) {
      const row = await pool().query(
        `SELECT status FROM fin.approval_requests WHERE id = $1`,
        [id],
      )
      expect(row.rows[0]?.status).toBe('dead_letter')
      const audit = await pool().query(
        `SELECT type, action FROM public.audit_log
          WHERE entity_id = $1 AND type = 'sla_reaped'
          ORDER BY created_at DESC LIMIT 1`,
        [id],
      )
      expect(audit.rows[0]?.type).toBe('sla_reaped')
    }
  })
})
