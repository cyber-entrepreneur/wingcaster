import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { configure, closeDb } from '../../db.js'
import { createTestDatabase } from '../../testing/postgres.js'
import { computePaddleSignature } from '../../fin/funding/psp/paddle.js'
import { handlePaddleWebhookEvent } from './paddle-webhook.js'

const SECRET = 'whsec_pg_test_secret'

// Own the DB lifecycle (instead of finPostgresSuite) so the migration step gets
// a generous timeout — the full chain runs in seconds against a local CI
// Postgres but can take minutes over a network proxy. No world seed needed.
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip

function signed(event) {
  const raw = Buffer.from(JSON.stringify(event), 'utf8')
  const ts = Math.floor(Date.now() / 1000)
  const h1 = computePaddleSignature(SECRET, String(ts), raw)
  return { raw, headers: { 'paddle-signature': `ts=${ts};h1=${h1}` } }
}

suite('paddle subscription sync', () => {
  let database
  let pool

  beforeAll(async () => {
    database = await createTestDatabase('paddle_sync')
    configure({ databaseUrl: database.url, force: true })
    pool = new pg.Pool({ connectionString: database.url })
    pool.on('error', () => {})
  }, 600_000)

  afterAll(async () => {
    await closeDb().catch(() => {})
    if (pool) await pool.end().catch(() => {})
    if (database) await database.teardown().catch(() => {})
  })

  async function publishedPaidVersionId() {
    const { rows } = await pool.query(
      `SELECT v.id
         FROM public.product_package_versions v
         JOIN public.product_packages p ON p.id = v.package_id
        WHERE p.code = 'semsar' AND v.state = 'PUBLISHED'
        ORDER BY v.version_number DESC
        LIMIT 1`,
    )
    return rows[0]?.id
  }

  async function createPaddleSubscription({ tenantId, versionId, subId, customerId }) {
    const { raw, headers } = signed({
      event_type: 'subscription.created',
      notification_id: `ntf_${randomUUID().slice(0, 8)}`,
      data: {
        id: subId,
        customer_id: customerId,
        status: 'active',
        items: [{ price: { id: 'pri_test' } }],
        custom_data: {
          kind: 'subscription',
          credit_tenant_id: tenantId,
          package_version_id: versionId,
          scope: 'personal',
          scope_id: `u-${tenantId.slice(0, 8)}`,
        },
      },
    })
    return handlePaddleWebhookEvent(raw, headers, { secret: SECRET })
  }

  it('adopts the marketing price as the billing price (migration 803)', async () => {
    const { rows } = await pool.query(
      `SELECT v.monthly_price_minor, v.price_usd_monthly_minor
         FROM public.product_package_versions v
         JOIN public.product_packages p ON p.id = v.package_id
        WHERE p.code = 'semsar' AND v.state = 'PUBLISHED'
        ORDER BY v.version_number DESC LIMIT 1`,
    )
    expect(Number(rows[0].monthly_price_minor)).toBe(1500)
    expect(Number(rows[0].monthly_price_minor)).toBe(Number(rows[0].price_usd_monthly_minor))
  })

  it('subscription.created starts a subscription stamped with the Paddle ids', async () => {
    const versionId = await publishedPaidVersionId()
    expect(versionId).toBeTruthy()
    const tenantId = randomUUID()
    const subId = `sub_${randomUUID().slice(0, 12)}`

    const res = await createPaddleSubscription({ tenantId, versionId, subId, customerId: 'ctm_created' })
    expect(res.httpStatus).toBe(200)

    const sub = await pool.query(
      `SELECT status, package_version_id, paddle_subscription_id, paddle_customer_id
         FROM public.tenant_subscriptions WHERE tenant_id = $1`,
      [tenantId],
    )
    expect(sub.rows).toHaveLength(1)
    expect(sub.rows[0].paddle_subscription_id).toBe(subId)
    expect(sub.rows[0].package_version_id).toBe(versionId)
    expect(['ACTIVE', 'PENDING_START']).toContain(sub.rows[0].status)

    const customer = await pool.query(
      `SELECT paddle_customer_id FROM public.tenant_billing_customers WHERE tenant_id = $1`,
      [tenantId],
    )
    expect(customer.rows[0]?.paddle_customer_id).toBe('ctm_created')
  })

  it('is idempotent — a duplicate subscription.created keeps a single open subscription', async () => {
    const versionId = await publishedPaidVersionId()
    const tenantId = randomUUID()
    const subId = `sub_${randomUUID().slice(0, 12)}`
    await createPaddleSubscription({ tenantId, versionId, subId, customerId: 'ctm_dup' })
    await createPaddleSubscription({ tenantId, versionId, subId, customerId: 'ctm_dup' })
    const open = await pool.query(
      `SELECT count(*)::int AS n FROM public.tenant_subscriptions
        WHERE tenant_id = $1 AND status IN ('PENDING_START','ACTIVE','PAUSED','CANCELED_AT_PERIOD_END')`,
      [tenantId],
    )
    expect(open.rows[0].n).toBe(1)
  })

  it('subscription.updated with a scheduled cancel flips to CANCELED_AT_PERIOD_END', async () => {
    const versionId = await publishedPaidVersionId()
    const tenantId = randomUUID()
    const subId = `sub_${randomUUID().slice(0, 12)}`
    await createPaddleSubscription({ tenantId, versionId, subId, customerId: 'ctm_cancel' })

    const { raw, headers } = signed({
      event_type: 'subscription.updated',
      notification_id: `ntf_${randomUUID().slice(0, 8)}`,
      data: {
        id: subId,
        customer_id: 'ctm_cancel',
        status: 'active',
        scheduled_change: { action: 'cancel', effective_at: new Date(Date.now() + 8.64e7).toISOString() },
        items: [{ price: { id: 'pri_test' } }],
        custom_data: { kind: 'subscription', credit_tenant_id: tenantId, package_version_id: versionId },
      },
    })
    const res = await handlePaddleWebhookEvent(raw, headers, { secret: SECRET })
    expect(res.httpStatus).toBe(200)

    const sub = await pool.query(
      `SELECT status FROM public.tenant_subscriptions WHERE paddle_subscription_id = $1`,
      [subId],
    )
    expect(sub.rows[0].status).toBe('CANCELED_AT_PERIOD_END')
  })

  it('subscription.canceled ends the subscription', async () => {
    const versionId = await publishedPaidVersionId()
    const tenantId = randomUUID()
    const subId = `sub_${randomUUID().slice(0, 12)}`
    await createPaddleSubscription({ tenantId, versionId, subId, customerId: 'ctm_end' })

    const { raw, headers } = signed({
      event_type: 'subscription.canceled',
      notification_id: `ntf_${randomUUID().slice(0, 8)}`,
      data: { id: subId, customer_id: 'ctm_end', status: 'canceled' },
    })
    const res = await handlePaddleWebhookEvent(raw, headers, { secret: SECRET })
    expect(res.httpStatus).toBe(200)

    const sub = await pool.query(
      `SELECT status FROM public.tenant_subscriptions WHERE paddle_subscription_id = $1`,
      [subId],
    )
    expect(sub.rows[0].status).toBe('ENDED')
  })
})
