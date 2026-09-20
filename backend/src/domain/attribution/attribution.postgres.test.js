/**
 * Wave 2C — Real-PG coverage for conversions, attribution credits, finance
 * attest boundary, rollups, standalone executions, and tenant isolation.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { expect, it } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, query } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import {
  createExecution,
  ingestEvent,
  withTenant,
} from '../../lib/growth-os/index.js'
import {
  attributeConversions,
  computeCreditWeights,
  getAttributionPerformance,
  listAttributionCredits,
  listConversions,
  materialiseConversionFromEvent,
  materialiseConversionsForTenant,
  recomputeAttributionCredits,
  attestTransactionClosed,
  attestCommissionEarned,
  readDealEconomics,
} from './index.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

const WAVE2C_FILES = [
  '730_attribution_enums.sql',
  '731_conversions_attribution_credits.sql',
  '732_closed_transactions_commission_expand.sql',
]

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Wave2C', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave2c.test`],
  )
  await pool.query(
    `INSERT INTO public.agencies (id, name, data)
     VALUES ($1, $2, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [agencyId, `Agency ${agencyId}`],
  )
  await pool.query(
    `INSERT INTO public.agents (id, user_id, email, name, agency_id, data)
     VALUES ($1, $2, $3, 'Agent', $4, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [agentId, userId, `${agentId}@wave2c.test`, agencyId],
  )
}

async function seedContact(pool, { contactId, agentId, agencyId }) {
  await pool.query(
    `INSERT INTO public.contacts
       (id, name, status, tags, assigned_agent_id, agency_id, data)
     VALUES ($1, $2, 'lead', '[]'::jsonb, $3, $4, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [contactId, 'Contact', agentId, agencyId],
  )
}

async function asGrowthOsRole(pool, gucs, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE growth_os_app_role')
    for (const [key, value] of Object.entries(gucs || {})) {
      await client.query('SELECT set_config($1, $2, true)', [key, String(value)])
    }
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try { await client.query('ROLLBACK') } catch { /* aborted */ }
    throw error
  } finally {
    client.release()
  }
}

async function insertSpend(pool, {
  id, executionId, agencyId, agentId, valueMicros,
}) {
  await pool.query(
    `INSERT INTO public.metric_observations (
       id, subject_type, subject_id, execution_id, metric_name, metric_value,
       aggregation_type, observed_at, source, agency_id, agent_id, data, dimensions
     ) VALUES (
       $1, 'execution', $2, $2, 'spend', $3,
       'cumulative', NOW(), 'test', $4, $5, '{}'::jsonb, '{}'::jsonb
     )`,
    [id, executionId, valueMicros, agencyId, agentId],
  )
}

skipIfNoPostgres()('wave 2c attribution', () => {
  it('migrations are idempotent when SQL is re-applied', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        for (const file of WAVE2C_FILES) {
          const sql = await readFile(join(migrationsDir, file), 'utf8')
          await pool.query(sql)
          await pool.query(sql)
        }
        const tables = await pool.query(`
          SELECT relname FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND relname IN ('conversions', 'attribution_credits')
            AND relkind = 'r'
          ORDER BY 1
        `)
        expect(tables.rows.map((r) => r.relname)).toEqual([
          'attribution_credits',
          'conversions',
        ])
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('funnel events materialise conversions idempotently', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const contactId = `ctc_${randomUUID()}`
      const correlationId = `corr_${randomUUID()}`
      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agentId, agencyId })

        const funnel = [
          'lead.created',
          'lead.qualified',
          'viewing.booked',
          'offer.made',
          'reservation.created',
        ]
        for (const eventName of funnel) {
          await ingestEvent({
            eventName,
            source: 'test:funnel',
            agencyId,
            agentId,
            contactId,
            correlationId,
            idempotencyKey: `test:${correlationId}:${eventName}`,
            occurredAt: new Date().toISOString(),
          })
        }

        const first = await materialiseConversionsForTenant({ agencyId, agentId })
        expect(first.filter((r) => r.inserted)).toHaveLength(funnel.length)

        const second = await materialiseConversionsForTenant({ agencyId, agentId })
        expect(second.every((r) => !r.inserted)).toBe(true)

        const conversions = await listConversions({ agencyId, agentId })
        expect(conversions).toHaveLength(funnel.length)
        expect(conversions.map((c) => c.to_stage).sort()).toEqual([
          'lead', 'offer', 'qualified', 'reservation', 'viewing',
        ].sort())
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('last/first/linear/position credits sum correctly; model switch is re-runnable', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const contactId = `ctc_${randomUUID()}`
      const correlationId = `corr_${randomUUID()}`
      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agentId, agencyId })

        const execA = await createExecution({
          kind: 'social_post', agencyId, agentId, campaignId: `cmp_${randomUUID()}`,
        })
        const execB = await createExecution({
          kind: 'message', agencyId, agentId, campaignId: execA.campaign_id,
        })
        const execC = await createExecution({
          kind: 'paid_ad', agencyId, agentId, campaignId: execA.campaign_id,
        })

        const t0 = Date.now()
        await ingestEvent({
          eventName: 'link.clicked', source: 'test', agencyId, agentId, contactId,
          correlationId, executionId: execA.id,
          occurredAt: new Date(t0).toISOString(),
          idempotencyKey: `clk:${correlationId}:a`,
        })
        await ingestEvent({
          eventName: 'email.clicked', source: 'test', agencyId, agentId, contactId,
          correlationId, executionId: execB.id,
          occurredAt: new Date(t0 + 1000).toISOString(),
          idempotencyKey: `clk:${correlationId}:b`,
        })
        await ingestEvent({
          eventName: 'message.delivered', source: 'test', agencyId, agentId, contactId,
          correlationId, executionId: execC.id,
          occurredAt: new Date(t0 + 2000).toISOString(),
          idempotencyKey: `dlv:${correlationId}:c`,
        })
        const lead = await ingestEvent({
          eventName: 'lead.created', source: 'test', agencyId, agentId, contactId,
          correlationId, executionId: execC.id,
          occurredAt: new Date(t0 + 3000).toISOString(),
          idempotencyKey: `lead:${correlationId}`,
        })

        const { conversion } = await materialiseConversionFromEvent(lead.event, {
          agencyId, agentId,
        })
        expect(conversion.to_stage).toBe('lead')

        const last = await recomputeAttributionCredits({
          conversionId: conversion.id, model: 'last', agencyId, agentId,
        })
        expect(last.credits).toHaveLength(1)
        expect(last.credits[0].execution_id).toBe(execC.id)
        expect(Number(last.credits[0].credit_weight)).toBe(1)

        const first = await recomputeAttributionCredits({
          conversionId: conversion.id, model: 'first', agencyId, agentId,
        })
        expect(first.credits[0].execution_id).toBe(execA.id)

        const linear = await recomputeAttributionCredits({
          conversionId: conversion.id, model: 'linear', agencyId, agentId,
        })
        const linearSum = linear.credits.reduce((s, c) => s + Number(c.credit_weight), 0)
        expect(linearSum).toBeCloseTo(1, 6)
        expect(linear.credits).toHaveLength(3)

        const position = await recomputeAttributionCredits({
          conversionId: conversion.id, model: 'position', agencyId, agentId,
        })
        const posSum = position.credits.reduce((s, c) => s + Number(c.credit_weight), 0)
        expect(posSum).toBeCloseTo(1, 6)

        // Model switch rewrites only that model's rows; conversion untouched
        const beforeConv = await listConversions({ agencyId, agentId })
        await recomputeAttributionCredits({
          conversionId: conversion.id, model: 'last', agencyId, agentId,
        })
        const afterConv = await listConversions({ agencyId, agentId })
        expect(afterConv[0].id).toBe(beforeConv[0].id)
        expect(afterConv[0].occurred_at).toEqual(beforeConv[0].occurred_at)

        const lastCredits = await listAttributionCredits({
          agencyId, agentId, conversionId: conversion.id, model: 'last',
        })
        expect(lastCredits).toHaveLength(1)

        const dd = await recomputeAttributionCredits({
          conversionId: conversion.id, model: 'data_driven', agencyId, agentId,
        })
        expect(dd.configured).toBe(false)
        expect(dd.code).toBe('NOT_CONFIGURED')
        expect(dd.credits).toEqual([])
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('standalone execution (campaign_id NULL) still attributes via execution_id', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const contactId = `ctc_${randomUUID()}`
      const correlationId = `corr_${randomUUID()}`
      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agentId, agencyId })

        const standalone = await createExecution({
          kind: 'social_post',
          agencyId,
          agentId,
          campaignId: null,
        })
        expect(standalone.campaign_id == null || standalone.campaign_id === null).toBe(true)

        await ingestEvent({
          eventName: 'link.clicked', source: 'test', agencyId, agentId, contactId,
          correlationId, executionId: standalone.id,
          occurredAt: new Date().toISOString(),
          idempotencyKey: `solo:clk:${correlationId}`,
        })
        const lead = await ingestEvent({
          eventName: 'lead.created', source: 'test', agencyId, agentId, contactId,
          correlationId, executionId: standalone.id,
          occurredAt: new Date().toISOString(),
          idempotencyKey: `solo:lead:${correlationId}`,
        })
        const { conversion } = await materialiseConversionFromEvent(lead.event, {
          agencyId, agentId,
        })
        const credited = await recomputeAttributionCredits({
          conversionId: conversion.id, model: 'last', agencyId, agentId,
        })
        expect(credited.credits[0].execution_id).toBe(standalone.id)

        const perf = await getAttributionPerformance({
          agencyId, agentId, model: 'last',
        })
        const execRow = perf.by_execution.find((r) => r.execution_id === standalone.id)
        expect(execRow).toBeTruthy()
        expect(execRow.campaign_id).toBeNull()
        expect(execRow.leads).toBe(1)
        // Never fabricate a campaign bucket for null campaign_id
        expect(perf.by_campaign.every((c) => c.campaign_id != null)).toBe(true)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('commission rollup matches ledger fixture; ROAS math correct', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const contactId = `ctc_${randomUUID()}`
      const correlationId = `corr_${randomUUID()}`
      const listingId = `lst_${randomUUID()}`
      const closedId = `ctx_${randomUUID()}`
      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agentId, agencyId })

        const gtvMicros = 500_000_000_000 // 500,000.00
        const commissionMicros = 15_000_000_000 // 15,000.00
        const spendMicros = 3_000_000_000 // 3,000.00

        await pool.query(
          `INSERT INTO public.closed_transactions (
             id, listing_id, agent_id, agency_id, contact_id,
             transaction_type, final_sold_price, currency, closed_at,
             gtv_micros, commission_micros, data
           ) VALUES (
             $1, $2, $3, $4, $5,
             'sale', 500000, 'USD', NOW(),
             $6, $7, '{}'::jsonb
           )`,
          [closedId, listingId, agentId, agencyId, contactId, gtvMicros, commissionMicros],
        )

        const deal = await readDealEconomics({
          closedTransactionId: closedId, agencyId, agentId,
        })
        expect(deal.gtv_micros).toBe(gtvMicros)
        expect(deal.commission_micros).toBe(commissionMicros)

        const exec = await createExecution({
          kind: 'paid_ad', agencyId, agentId, campaignId: `cmp_${randomUUID()}`,
        })
        await insertSpend(pool, {
          id: `mob_${randomUUID()}`,
          executionId: exec.id,
          agencyId,
          agentId,
          valueMicros: spendMicros,
        })

        await ingestEvent({
          eventName: 'link.clicked', source: 'test', agencyId, agentId, contactId,
          correlationId, executionId: exec.id,
          occurredAt: new Date(Date.now() - 5000).toISOString(),
          idempotencyKey: `roi:clk:${correlationId}`,
        })

        const txEvt = await attestTransactionClosed({
          closedTransactionId: closedId,
          agencyId,
          agentId,
          contactId,
          executionId: exec.id,
          campaignId: exec.campaign_id,
          correlationId,
        })
        expect(txEvt.event.value_micros).toBe(gtvMicros)

        const commEvt = await attestCommissionEarned({
          closedTransactionId: closedId,
          agencyId,
          agentId,
          contactId,
          executionId: exec.id,
          campaignId: exec.campaign_id,
          correlationId,
        })
        expect(commEvt.event.value_micros).toBe(commissionMicros)

        await materialiseConversionFromEvent(txEvt.event, { agencyId, agentId })
        await materialiseConversionFromEvent(commEvt.event, { agencyId, agentId })
        await attributeConversions({ agencyId, agentId, models: ['last'] })

        const perf = await getAttributionPerformance({
          agencyId, agentId, model: 'last',
        })
        expect(perf.overview.gtv_micros).toBe(gtvMicros)
        expect(perf.overview.commission_micros).toBe(commissionMicros)
        expect(perf.overview.marketing_cost_micros).toBe(spendMicros)
        expect(perf.overview.roas).toBeCloseTo(commissionMicros / spendMicros, 6)
        expect(perf.overview.roi).toBeCloseTo(
          (commissionMicros - spendMicros) / spendMicros,
          6,
        )
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('strict RLS hides conversions and attribution_credits without tenant GUC', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyA = `agy_${randomUUID()}`
      const agentA = `agt_${randomUUID()}`
      const agencyB = `agy_${randomUUID()}`
      const agentB = `agt_${randomUUID()}`
      const contactA = `ctc_${randomUUID()}`
      try {
        await seedAgencyAgent(pool, { agencyId: agencyA, agentId: agentA })
        await seedAgencyAgent(pool, { agencyId: agencyB, agentId: agentB })
        await seedContact(pool, { contactId: contactA, agentId: agentA, agencyId: agencyA })

        const lead = await ingestEvent({
          eventName: 'lead.created',
          source: 'test',
          agencyId: agencyA,
          agentId: agentA,
          contactId: contactA,
          idempotencyKey: `iso:lead:${contactA}`,
        })
        const { conversion } = await materialiseConversionFromEvent(lead.event, {
          agencyId: agencyA, agentId: agentA,
        })
        await recomputeAttributionCredits({
          conversionId: conversion.id,
          model: 'last',
          agencyId: agencyA,
          agentId: agentA,
          executionIds: [`exec_${randomUUID()}`],
        })

        const hidden = await asGrowthOsRole(pool, {}, async (client) => {
          const c = await client.query('SELECT count(*)::int AS n FROM public.conversions')
          const a = await client.query('SELECT count(*)::int AS n FROM public.attribution_credits')
          return { conversions: c.rows[0].n, credits: a.rows[0].n }
        })
        expect(hidden.conversions).toBe(0)
        expect(hidden.credits).toBe(0)

        const visibleA = await asGrowthOsRole(
          pool,
          { 'app.agency_id': agencyA },
          async (client) => {
            const c = await client.query('SELECT count(*)::int AS n FROM public.conversions')
            return c.rows[0].n
          },
        )
        expect(visibleA).toBe(1)

        const visibleB = await asGrowthOsRole(
          pool,
          { 'app.agency_id': agencyB },
          async (client) => {
            const c = await client.query('SELECT count(*)::int AS n FROM public.conversions')
            return c.rows[0].n
          },
        )
        expect(visibleB).toBe(0)

        const cross = await listConversions({ agencyId: agencyB, agentId: agentB })
        expect(cross).toHaveLength(0)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)
})

// Keep computeCreditWeights import used in case tree-shaking warnings
void computeCreditWeights
void withTenant
void query
