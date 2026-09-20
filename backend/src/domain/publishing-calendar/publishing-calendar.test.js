/**
 * Wave 2B — unit tests for publishing calendar (mocked persistence).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../persistence/index.js', () => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  query: vi.fn(),
}))

vi.mock('../../lib/growth-os/with-tenant.js', () => ({
  withTenant: vi.fn((_agencyId, _agentId, fn) => fn()),
}))

const {
  createExecution,
  getExecution,
  scheduleExecution,
  listExecutions,
  getChannelConnection,
  resolveCapabilities,
} = vi.hoisted(() => ({
  createExecution: vi.fn(),
  getExecution: vi.fn(),
  scheduleExecution: vi.fn(),
  listExecutions: vi.fn(),
  getChannelConnection: vi.fn(),
  resolveCapabilities: vi.fn(),
}))

vi.mock('../../lib/growth-os/index.js', async () => {
  const actual = await vi.importActual('../../lib/growth-os/executions.js')
  return {
    createExecution,
    getExecution,
    scheduleExecution,
    listExecutions,
    getChannelConnection,
    resolveCapabilities,
    transitionExecution: vi.fn(),
    isReschedulable: actual.isReschedulable,
    RESCHEDULABLE_STATUSES: actual.RESCHEDULABLE_STATUSES,
    withTenant: vi.fn((_a, _b, fn) => fn()),
  }
})

vi.mock('../creative/repository.js', () => ({
  loadCreativeBundle: vi.fn(),
}))

import { query } from '../../persistence/index.js'
import { loadCreativeBundle } from '../creative/repository.js'
import {
  queryCalendarExecutions,
  rescheduleCalendarExecution,
} from './calendar.js'
import { validateExecutionNetwork } from './network-validation.js'
import { previewExecution } from './preview.js'
import { isReschedulable } from '../../lib/growth-os/executions.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isReschedulable', () => {
  it('allows draft and scheduled only', () => {
    expect(isReschedulable('draft')).toBe(true)
    expect(isReschedulable('scheduled')).toBe(true)
    expect(isReschedulable('published')).toBe(false)
    expect(isReschedulable('processing')).toBe(false)
    expect(isReschedulable('queued')).toBe(false)
  })
})

describe('queryCalendarExecutions filters', () => {
  it('forwards each filter dimension to listExecutions', async () => {
    listExecutions.mockResolvedValueOnce([
      {
        id: 'exec_1',
        agency_id: 'agc_1',
        agent_id: 'agt_1',
        kind: 'social_post',
        status: 'scheduled',
        scheduled_at: '2026-10-02T12:00:00.000Z',
        campaign_id: 'cmp_1',
        subject_type: 'property',
        subject_id: 'prop_1',
        channel_connection_id: 'chn_1',
        data: {},
      },
    ])

    const result = await queryCalendarExecutions({
      agencyId: 'agc_1',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.000Z',
      status: 'scheduled,draft',
      kind: 'social_post',
      campaignId: 'cmp_1',
      propertyId: 'prop_1',
      channelConnectionId: 'chn_1',
      agentId: 'agt_1',
    })

    expect(listExecutions).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agc_1',
        agentIds: ['agt_1'],
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.000Z',
        status: 'scheduled,draft',
        kind: 'social_post',
        campaignId: 'cmp_1',
        subjectType: 'property',
        subjectId: 'prop_1',
        channelConnectionId: 'chn_1',
      }),
    )
    expect(result.executions).toHaveLength(1)
    expect(result.executions[0].reschedulable).toBe(true)
  })

  it('marks office unsupported when no agent carries office attrs', async () => {
    query.mockResolvedValueOnce([
      { id: 'agt_1', office_id: null, office: null, office_address: null },
    ])
    listExecutions.mockResolvedValueOnce([])

    const result = await queryCalendarExecutions({
      agencyId: 'agc_1',
      office: 'downtown',
    })
    expect(result.meta.unsupported_filters).toContain('office')
    expect(result.executions).toEqual([])
  })
})

describe('rescheduleCalendarExecution', () => {
  it('blocks published executions', async () => {
    getExecution.mockResolvedValueOnce({
      id: 'exec_1',
      status: 'published',
      agency_id: 'agc_1',
    })
    await expect(
      rescheduleCalendarExecution('exec_1', '2026-10-05T00:00:00.000Z', { agencyId: 'agc_1' }),
    ).rejects.toMatchObject({ code: 'INVALID_EXECUTION_TRANSITION' })
    expect(scheduleExecution).not.toHaveBeenCalled()
  })

  it('blocks processing executions', async () => {
    getExecution.mockResolvedValueOnce({
      id: 'exec_1',
      status: 'processing',
      agency_id: 'agc_1',
    })
    await expect(
      rescheduleCalendarExecution('exec_1', '2026-10-05T00:00:00.000Z', { agencyId: 'agc_1' }),
    ).rejects.toMatchObject({ code: 'INVALID_EXECUTION_TRANSITION' })
  })

  it('reschedules draft via scheduleExecution', async () => {
    getExecution.mockResolvedValueOnce({
      id: 'exec_1',
      status: 'draft',
      agency_id: 'agc_1',
      agent_id: 'agt_1',
    })
    scheduleExecution.mockResolvedValueOnce({
      id: 'exec_1',
      status: 'scheduled',
      scheduled_at: '2026-10-05T00:00:00.000Z',
      agency_id: 'agc_1',
      agent_id: 'agt_1',
      kind: 'social_post',
      data: {},
    })
    const row = await rescheduleCalendarExecution('exec_1', '2026-10-05T00:00:00.000Z', {
      agencyId: 'agc_1',
    })
    expect(scheduleExecution).toHaveBeenCalledWith(
      'exec_1',
      '2026-10-05T00:00:00.000Z',
      expect.objectContaining({ agencyId: 'agc_1' }),
    )
    expect(row.status).toBe('scheduled')
    expect(row.reschedulable).toBe(true)
  })
})

describe('validateExecutionNetwork', () => {
  it('flags missing media and expired connection', async () => {
    getExecution.mockResolvedValueOnce({
      id: 'exec_1',
      kind: 'social_post',
      status: 'draft',
      agency_id: 'agc_1',
      agent_id: 'agt_1',
      channel_connection_id: 'chn_1',
      creative_id: null,
      data: { caption: 'hello' },
    })
    getChannelConnection.mockResolvedValueOnce({
      id: 'chn_1',
      health: 'expired',
      agency_id: 'agc_1',
    })
    resolveCapabilities.mockResolvedValueOnce({
      connection: { id: 'chn_1' },
      definition: { platform: 'instagram' },
      capabilities: {},
    })
    loadCreativeBundle.mockResolvedValueOnce(null)

    const result = await validateExecutionNetwork('exec_1', { agencyId: 'agc_1' })
    expect(result.ok).toBe(false)
    expect(result.blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining(['EXPIRED_TOKEN', 'MISSING_MEDIA']),
    )
  })

  it('flags caption too long for X', async () => {
    getExecution.mockResolvedValueOnce({
      id: 'exec_2',
      kind: 'social_post',
      status: 'draft',
      agency_id: 'agc_1',
      channel_connection_id: 'chn_2',
      creative_id: null,
      data: { caption: 'x'.repeat(300), media_urls: ['https://cdn.example/a.jpg'] },
    })
    getChannelConnection.mockResolvedValueOnce({
      id: 'chn_2',
      health: 'connected',
    })
    resolveCapabilities.mockResolvedValueOnce({
      connection: { id: 'chn_2' },
      definition: { platform: 'x' },
      capabilities: {},
    })

    const result = await validateExecutionNetwork('exec_2', { agencyId: 'agc_1' })
    expect(result.blockers.some((b) => b.code === 'CAPTION_TOO_LONG')).toBe(true)
  })
})

describe('previewExecution', () => {
  it('returns channel snapshot without side effects', async () => {
    getExecution.mockResolvedValueOnce({
      id: 'exec_1',
      kind: 'social_post',
      status: 'draft',
      agency_id: 'agc_1',
      agent_id: 'agt_1',
      channel_connection_id: 'chn_1',
      creative_id: null,
      scheduled_at: null,
      campaign_id: null,
      subject_type: 'property',
      subject_id: 'prop_1',
      data: { caption: 'Preview me', media_urls: ['https://cdn.example/a.jpg'] },
    })
    getChannelConnection.mockResolvedValueOnce({
      id: 'chn_1',
      health: 'connected',
      provider_account_id: 'ig_1',
    })
    resolveCapabilities.mockResolvedValueOnce({
      connection: { id: 'chn_1' },
      definition: { platform: 'instagram' },
      capabilities: { formats: ['feed'] },
    })

    const preview = await previewExecution('exec_1', { agencyId: 'agc_1' })
    expect(preview.side_effects).toBe(false)
    expect(preview.platform).toBe('instagram')
    expect(preview.channels[0].caption).toBe('Preview me')
    expect(preview.channels[0].media_urls).toEqual(['https://cdn.example/a.jpg'])
  })
})
