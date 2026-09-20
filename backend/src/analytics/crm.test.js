import { beforeEach, describe, expect, it, vi } from 'vitest'

// Characterization tests: crm.js had no coverage, so these pin the current
// aggregation output before/after the SQL-pushdown refactor. findAll is mocked
// per-collection and ignores its filter argument, so these exercise the in-JS
// scoping/aggregation that remains the behavioural authority.
const db = vi.hoisted(() => ({ findAll: vi.fn() }))
vi.mock('../db.js', () => db)
vi.mock('../opportunities.js', () => ({ getPipelineSummary: vi.fn() }))

let getCrmAnalytics
let getCommunicationsAnalytics

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  ;({ getCrmAnalytics, getCommunicationsAnalytics } = await import('./crm.js'))
})

describe('getCrmAnalytics', () => {
  function seed() {
    db.findAll.mockImplementation(async (collection) => {
      if (collection === 'opportunities') {
        return [
          { id: 'opp_1', agency_id: 'agc_1', agent_id: 'agt_1', stage: 'closed_won', deal_value: 100000, probability: 100, created_at: '2026-09-01T10:00:00Z', closed_at: '2026-09-05T10:00:00Z' },
          { id: 'opp_2', agency_id: 'agc_1', agent_id: 'agt_1', stage: 'negotiation', deal_value: 50000, probability: 40, created_at: '2026-09-02T10:00:00Z', expected_close_date: '2026-10-15T10:00:00Z' },
          { id: 'opp_3', agency_id: 'agc_2', agent_id: 'agt_9', stage: 'closed_won', deal_value: 999, probability: 100, created_at: '2026-09-02T10:00:00Z' },
        ]
      }
      if (collection === 'contacts') {
        return [
          { id: 'c1', agency_id: 'agc_1', assigned_agent_id: 'agt_1', status: 'lead', first_touch_channel: 'bazaar', created_at: '2026-09-01T10:00:00Z' },
          { id: 'c2', agency_id: 'agc_1', assigned_agent_id: 'agt_1', status: 'qualified', first_touch_channel: 'direct', created_at: '2026-09-02T10:00:00Z' },
          { id: 'c3', agency_id: 'agc_2', assigned_agent_id: 'agt_9', status: 'lead', first_touch_channel: 'bazaar', created_at: '2026-09-02T10:00:00Z' },
        ]
      }
      if (collection === 'tasks') {
        return [
          { id: 't1', agency_id: 'agc_1', status: 'completed', priority: 'high', created_at: '2026-09-01T10:00:00Z' },
          { id: 't2', agency_id: 'agc_1', status: 'pending', priority: 'low', due_at: '2020-01-01T00:00:00Z', created_at: '2026-09-02T10:00:00Z' },
        ]
      }
      if (collection === 'viewings') {
        return [
          { id: 'v1', agency_id: 'agc_1', outcome: 'interested', created_at: '2026-09-01T10:00:00Z' },
        ]
      }
      return []
    })
  }

  it('summarises CRM metrics for an agency', async () => {
    seed()
    const result = await getCrmAnalytics({ agencyId: 'agc_1' })

    expect(result.summary).toEqual({
      contacts_created: 2,
      opportunities_created: 2,
      open_opportunities: 1,
      closed_won: 1,
      closed_lost: 0,
      win_rate: 100,
      conversion_rate: 100,
      total_pipeline_value: 50000,
      weighted_pipeline_value: 20000,
      total_tasks: 2,
      completed_tasks: 1,
      pending_tasks: 1,
      overdue_tasks: 1,
      task_completion_rate: 50,
      task_overdue_rate: 100,
      viewings_total: 1,
    })
    expect(result.lead_sources).toEqual(
      expect.arrayContaining([
        { label: 'bazaar', value: 1 },
        { label: 'direct', value: 1 },
      ]),
    )
    expect(result.won_revenue_by_month).toEqual([{ label: '2026-09', value: 100000 }])
    expect(result.revenue_forecast).toEqual([{ label: '2026-10', value: 50000 }])
    expect(result.scope).toEqual({ agent_id: null, agency_id: 'agc_1', start_date: null, end_date: null })
  })

  it('excludes other agencies and honours the date window', async () => {
    seed()
    // Window starts 2026-09-02, so the 2026-09-01 rows drop out.
    const result = await getCrmAnalytics({ agencyId: 'agc_1', startDate: '2026-09-02T00:00:00Z' })

    expect(result.summary.contacts_created).toBe(1)
    expect(result.summary.opportunities_created).toBe(1)
    expect(result.summary.total_tasks).toBe(1)
    expect(result.summary.viewings_total).toBe(0)
  })
})

describe('getCommunicationsAnalytics', () => {
  it('aggregates channel volume and response times for an agency', async () => {
    db.findAll.mockImplementation(async (collection) => {
      if (collection === 'conversations') {
        return [
          { id: 'cv1', agency_id: 'agc_1', assigned_agent_id: 'agt_1', status: 'open', created_at: '2026-09-01T09:00:00Z' },
          { id: 'cv2', agency_id: 'agc_1', assigned_agent_id: 'agt_2', status: 'closed', unread_count: 2, created_at: '2026-09-02T09:00:00Z' },
          { id: 'cv3', agency_id: 'agc_2', assigned_agent_id: 'agt_9', status: 'open', created_at: '2026-09-02T09:00:00Z' },
        ]
      }
      if (collection === 'conversation_messages') {
        return [
          { id: 'm1', agency_id: 'agc_1', conversation_id: 'cv1', direction: 'inbound', channel: 'whatsapp', created_at: '2026-09-01T10:00:00Z' },
          { id: 'm2', agency_id: 'agc_1', conversation_id: 'cv1', direction: 'outbound', channel: 'whatsapp', status: 'delivered', created_at: '2026-09-01T10:05:00Z' },
          { id: 'm3', agency_id: 'agc_1', conversation_id: 'cv2', direction: 'inbound', channel: 'email', created_at: '2026-09-02T09:00:00Z' },
          { id: 'm4', agency_id: 'agc_2', conversation_id: 'cv3', direction: 'inbound', channel: 'sms', created_at: '2026-09-02T09:00:00Z' },
        ]
      }
      return []
    })

    const result = await getCommunicationsAnalytics({ agencyId: 'agc_1' })

    expect(result.summary).toEqual({
      conversations_total: 2,
      messages_total: 3,
      inbound_messages: 2,
      outbound_messages: 1,
      unread_conversations: 1,
      assigned_conversations: 2,
      unassigned_conversations: 0,
    })
    expect(result.channel_volume[0]).toEqual({ label: 'whatsapp', inbound: 1, outbound: 1, total: 2 })
    expect(result.first_response_time.sample_count).toBe(1)
    expect(result.first_response_time.average.minutes).toBe(5)
    expect(result.response_time.sample_count).toBe(1)
  })
})
