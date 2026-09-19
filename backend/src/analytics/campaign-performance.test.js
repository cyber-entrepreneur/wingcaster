import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
}))

vi.mock('../db.js', () => db)

let getCampaignPerformance

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  db.findAll.mockImplementation(async (collection) => {
    if (collection === 'campaigns') {
      return [
        {
          id: 'cmp_1',
          agency_id: 'agc_1',
          agent_id: 'agt_1',
          name: 'Spring nurture',
          status: 'active',
          trigger: 'new_lead',
          target_channel: 'email',
          steps: [{ channel: 'email', delay_hours: 0 }],
          created_at: '2026-09-10T10:00:00.000Z',
        },
        {
          id: 'cmp_2',
          agency_id: 'agc_1',
          agent_id: 'agt_2',
          name: 'WhatsApp follow-up',
          status: 'paused',
          trigger: 'manual',
          steps: [{ channel: 'whatsapp', delay_hours: 24 }],
          created_at: '2026-09-12T10:00:00.000Z',
        },
        { id: 'cmp_3', agency_id: 'agc_2', name: 'Other agency', status: 'active' },
      ]
    }
    if (collection === 'campaign_enrollments') {
      return [
        { id: 'enr_1', campaign_id: 'cmp_1', status: 'completed' },
        { id: 'enr_2', campaign_id: 'cmp_1', status: 'active' },
        { id: 'enr_3', campaign_id: 'cmp_2', status: 'active' },
      ]
    }
    if (collection === 'campaign_messages') {
      return [
        { id: 'msg_1', campaign_id: 'cmp_1', channel: 'email', status: 'sent', sent_at: '2026-09-15T10:00:00.000Z' },
        { id: 'msg_2', campaign_id: 'cmp_1', channel: 'email', status: 'delivered', sent_at: '2026-09-16T10:00:00.000Z', delivered_at: '2026-09-16T10:05:00.000Z' },
        { id: 'msg_3', campaign_id: 'cmp_2', channel: 'whatsapp', status: 'sent', sent_at: '2026-09-14T10:00:00.000Z' },
      ]
    }
    if (collection === 'agents') {
      return [
        { id: 'agt_1', agency_id: 'agc_1', name: 'Alex Agent' },
        { id: 'agt_2', agency_id: 'agc_1', name: 'Bella Broker' },
      ]
    }
    return []
  })

  ;({ getCampaignPerformance } = await import('./campaign-performance.js'))
})

describe('getCampaignPerformance', () => {
  it('requires agencyId', async () => {
    await expect(getCampaignPerformance({})).rejects.toThrow('agencyId is required')
  })

  it('returns scoped campaign performance rows and overview', async () => {
    const result = await getCampaignPerformance({ agencyId: 'agc_1' })
    expect(result.rows).toHaveLength(2)
    expect(result.overview.campaigns).toBe(2)
    expect(result.overview.total_enrollments).toBe(3)
    expect(result.rows[0].id).toBe('cmp_1')
    expect(result.rows[0].agent_name).toBe('Alex Agent')
    expect(result.by_channel.length).toBeGreaterThan(0)
  })

  it('filters by channel', async () => {
    const result = await getCampaignPerformance({ agencyId: 'agc_1', channel: 'whatsapp' })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].id).toBe('cmp_2')
  })
})
