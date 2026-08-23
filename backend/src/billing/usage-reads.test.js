import { describe, expect, it, vi } from 'vitest'
import { listUsageEvents } from './usage-reads.js'

vi.mock('../db.js', () => ({
  query: vi.fn(async () => ([
    {
      id: 'evt-1',
      tenant_id: 'tenant-1',
      subscription_id: null,
      action_key: 'webhook.received',
      quantity: '2',
      channel: 'whatsapp',
      destination_country: 'LB',
      whatsapp_category: null,
      listing_id: null,
      conversation_id: null,
      distribution_id: null,
      casts_charged: '0',
      price_minor: '10',
      cogs_estimate_minor: '1',
      rate_card_version: '1',
      cast_value_minor: '10',
      territory_id: 't-lb',
      zone_id: null,
      metadata: { channel: 'whatsapp' },
      billing_period: '2026-08',
      occurred_at: '2026-08-23T00:00:00.000Z',
      created_at: '2026-08-23T00:00:00.000Z',
    },
  ])),
}))

describe('billing/usage-reads', () => {
  it('projects fin_public.usage_events into the commercial usage shape', async () => {
    const rows = await listUsageEvents({ tenantId: 'tenant-1', billingPeriod: '2026-08', limit: 50 })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'evt-1',
      tenant_id: 'tenant-1',
      action_key: 'webhook.received',
      quantity: 2,
      casts_charged: 0,
      price_minor: 10,
      billing_period: '2026-08',
    })
  })

  // Kept until Stage 13f drops commercial.* — the previous call site was
  // findAll('usage_events') against commercial.usage_events in billing/routes.js.
  it.skip('reads commercial.usage_events (Stage 13f will drop the table)', async () => {
    const { findAll } = await import('../db.js')
    await findAll('usage_events', (e) => e.billing_period === '2026-08')
  })
})
