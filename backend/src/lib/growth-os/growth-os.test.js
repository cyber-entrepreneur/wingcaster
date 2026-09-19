import { describe, expect, it, vi, beforeEach } from 'vitest'

const { findAll, findOne, insert, update, query } = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  query: vi.fn(),
}))

vi.mock('../../persistence/index.js', () => ({
  findAll,
  findOne,
  insert,
  update,
  query,
}))

import {
  ensureChannelDefinition,
  createChannelConnection,
  resolveCapabilities,
  listChannelConnections,
  createExecution,
  transitionExecution,
  scheduleExecution,
  recordExecutionAttempt,
  ingestEvent,
  checkEligibility,
  setConsent,
} from './index.js'

beforeEach(() => {
  findAll.mockReset()
  findOne.mockReset()
  insert.mockReset()
  update.mockReset()
  query.mockReset()
})

describe('growth-os channels', () => {
  it('ensureChannelDefinition rejects invalid kind', async () => {
    await expect(ensureChannelDefinition({ platform: 'x', kind: 'nope' }))
      .rejects.toMatchObject({ code: 'INVALID_CHANNEL_KIND' })
  })

  it('createChannelConnection rejects raw credentials', async () => {
    findOne.mockResolvedValueOnce({ id: 'chnd_1' })
    await expect(createChannelConnection({
      channelDefinitionId: 'chnd_1',
      credentialsRef: 'ya29.raw-token-value',
    })).rejects.toMatchObject({ code: 'RAW_CREDENTIALS_FORBIDDEN' })
  })

  it('resolveCapabilities merges definition + tenant caps', async () => {
    findOne
      .mockResolvedValueOnce({
        id: 'chn_1',
        channel_definition_id: 'chnd_1',
        tenant_capabilities: { can_boost: true },
      })
      .mockResolvedValueOnce({
        id: 'chnd_1',
        global_capabilities: { can_post: true, can_boost: false },
      })
    const resolved = await resolveCapabilities('chn_1')
    expect(resolved.capabilities).toEqual({ can_post: true, can_boost: true })
  })

  it('listChannelConnections filters by agency', async () => {
    findAll.mockImplementation(async (_c, filter) => {
      const rows = [
        { id: 'a', agency_id: 'agc_1', health: 'connected' },
        { id: 'b', agency_id: 'agc_2', health: 'error' },
      ]
      return rows.filter(filter)
    })
    const rows = await listChannelConnections({ agencyId: 'agc_1' })
    expect(rows).toEqual([{ id: 'a', agency_id: 'agc_1', health: 'connected' }])
  })
})

describe('growth-os executions', () => {
  it('createExecution inserts with prefixed id', async () => {
    insert.mockImplementation(async (_c, row) => row)
    const row = await createExecution({ kind: 'social_post', agencyId: 'agc_1' })
    expect(row.id).toMatch(/^exec_/)
    expect(row.kind).toBe('social_post')
    expect(row.status).toBe('draft')
  })

  it('transitionExecution enforces graph', async () => {
    findOne.mockResolvedValueOnce({ id: 'exec_1', status: 'draft' })
    await expect(transitionExecution('exec_1', 'published'))
      .rejects.toMatchObject({ code: 'INVALID_EXECUTION_TRANSITION' })
  })

  it('scheduleExecution moves draft → scheduled', async () => {
    findOne
      .mockResolvedValueOnce({ id: 'exec_1', status: 'draft', recurrence: null })
      .mockResolvedValueOnce({
        id: 'exec_1',
        status: 'scheduled',
        scheduled_at: '2026-10-01T00:00:00.000Z',
      })
    update.mockResolvedValueOnce(1)
    const row = await scheduleExecution('exec_1', '2026-10-01T00:00:00.000Z')
    expect(row.status).toBe('scheduled')
    expect(row.scheduled_at).toBe('2026-10-01T00:00:00.000Z')
  })

  it('recordExecutionAttempt requires parent', async () => {
    findOne.mockResolvedValueOnce(null)
    await expect(recordExecutionAttempt({ executionId: 'missing' }))
      .rejects.toMatchObject({ code: 'EXECUTION_NOT_FOUND' })
  })
})

describe('growth-os events', () => {
  it('ingestEvent is idempotent on provider_event_id', async () => {
    findOne.mockResolvedValueOnce({
      id: 'evt_existing',
      provider_event_id: 'prov_1',
      event_name: 'message.delivered',
    })
    const first = await ingestEvent({
      eventName: 'message.delivered',
      eventCategory: 'delivery',
      providerEventId: 'prov_1',
    })
    expect(first.inserted).toBe(false)
    expect(first.event.id).toBe('evt_existing')
    expect(query).not.toHaveBeenCalled()
  })

  it('ingestEvent inserts when new', async () => {
    findOne.mockResolvedValueOnce(null)
    query.mockResolvedValueOnce([{
      id: 'evt_1',
      event_name: 'message.delivered',
      event_category: 'delivery',
      provider_event_id: 'prov_2',
      value_micros: '1000',
      context: {},
      data: {},
    }])
    const result = await ingestEvent({
      eventName: 'message.delivered',
      eventCategory: 'delivery',
      providerEventId: 'prov_2',
      valueMicros: 1000,
      currency: 'USD',
    })
    expect(result.inserted).toBe(true)
    expect(result.event.value_micros).toBe(1000)
    expect(String(query.mock.calls[0][0])).toMatch(/ON CONFLICT \(provider_event_id\)/)
  })
})

describe('growth-os consent eligibility', () => {
  it('granted → allow', async () => {
    findOne.mockResolvedValueOnce({
      id: 'cns_1',
      contact_id: 'ctc_1',
      channel: 'email',
      purpose: 'marketing',
      status: 'granted',
      expires_at: null,
    })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'email', purpose: 'marketing',
    })).resolves.toMatchObject({ allowed: true, reason: 'granted' })
  })

  it('denied → deny', async () => {
    findOne.mockResolvedValueOnce({ status: 'denied', expires_at: null })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'email', purpose: 'marketing',
    })).resolves.toMatchObject({ allowed: false, reason: 'denied' })
  })

  it('withdrawn → deny', async () => {
    findOne.mockResolvedValueOnce({ status: 'withdrawn', expires_at: null })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'email', purpose: 'marketing',
    })).resolves.toMatchObject({ allowed: false, reason: 'withdrawn' })
  })

  it('expired grant → deny', async () => {
    findOne.mockResolvedValueOnce({
      status: 'granted',
      expires_at: '2020-01-01T00:00:00.000Z',
    })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'email', purpose: 'marketing',
      at: '2026-01-01T00:00:00.000Z',
    })).resolves.toMatchObject({ allowed: false, reason: 'expired' })
  })

  it('missing consent → deny', async () => {
    findOne.mockResolvedValueOnce(null)
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'whatsapp', purpose: 'nurture',
    })).resolves.toMatchObject({ allowed: false, reason: 'missing_consent' })
  })

  it('setConsent appends prior_states on update', async () => {
    findOne
      .mockResolvedValueOnce({
        id: 'cns_1',
        contact_id: 'ctc_1',
        channel: 'email',
        purpose: 'marketing',
        status: 'granted',
        captured_at: '2025-01-01T00:00:00.000Z',
        data: {},
      })
      .mockResolvedValueOnce({
        id: 'cns_1',
        status: 'withdrawn',
        data: {
          prior_states: [{ status: 'granted', captured_at: '2025-01-01T00:00:00.000Z' }],
        },
      })
    update.mockImplementation(async (_c, _f, updater) => {
      updater({
        id: 'cns_1',
        status: 'granted',
        data: {},
        legal_basis: null,
        source: null,
        jurisdiction: null,
        proof_ref: null,
        agency_id: null,
        agent_id: null,
      })
      return 1
    })
    const row = await setConsent({
      contactId: 'ctc_1',
      channel: 'email',
      purpose: 'marketing',
      status: 'withdrawn',
    })
    expect(row.status).toBe('withdrawn')
    expect(row.data.prior_states).toHaveLength(1)
    expect(row.data.prior_states[0].status).toBe('granted')
  })
})
