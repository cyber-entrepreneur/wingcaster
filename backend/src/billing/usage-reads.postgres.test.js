/**
 * Real-Postgres — billing usage reads come from fin_public.usage_events.
 */
import { expect, it } from 'vitest'
import { listUsageEvents } from './usage-reads.js'
import { ingestUsageEvent } from '../fin/usage/ingest.js'
import { NOW } from '../fin/testing/seed.js'
import { finPostgresSuite } from '../fin/testing/suite.js'

finPostgresSuite('billing/usage-reads', {}, ({ world }) => {
  it('listUsageEvents reads fin_public.usage_events in the commercial column shape', async () => {
    const sourceEventId = `usage-reads-${NOW}`
    await ingestUsageEvent({
      environment: 'LIVE',
      tenantId: world().tenantA.tenantId,
      holderId: world().tenantA.holderId,
      billingAccountId: world().tenantA.billingAccountId,
      sourceSystem: 'commercial.usage_events',
      sourceEventId,
      eventType: 'webhook.received',
      quantityUnits: 3,
      occurredAt: NOW,
      receivedAt: NOW,
      now: NOW,
      dimensions: {
        public_tenant_id: world().tenantA.publicTenantId,
        quota_billing_period: '2026-08',
        channel: 'whatsapp',
        casts_charged: 0,
        price_minor: 10,
      },
    })

    const rows = await listUsageEvents({
      tenantId: world().tenantA.publicTenantId,
      billingPeriod: '2026-08',
      limit: 50,
    })
    const hit = rows.find((r) => r.id === sourceEventId)
    expect(hit).toMatchObject({
      id: sourceEventId,
      tenant_id: world().tenantA.publicTenantId,
      action_key: 'webhook.received',
      quantity: 3,
      channel: 'whatsapp',
      price_minor: 10,
      billing_period: '2026-08',
    })
  })
})
