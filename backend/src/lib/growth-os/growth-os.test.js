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
  getConsent,
  ELIGIBILITY_REASON_CODES,
} from './index.js'

beforeEach(() => {
  findAll.mockReset()
  findOne.mockReset()
  insert.mockReset()
  update.mockReset()
  query.mockReset()
})

function mockHealthyChannel() {
  query.mockImplementation(async (sql) => {
    if (String(sql).includes('channel_connections')) {
      return [{ '?column?': 1 }]
    }
    return []
  })
}

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

  it('rejects unknown event_name', async () => {
    await expect(ingestEvent({
      eventName: 'ad.delivered',
      eventCategory: 'delivery',
      providerEventId: 'prov_ff',
    })).rejects.toMatchObject({ code: 'UNKNOWN_EVENT_NAME' })
  })

  it('rejects event_category mismatch', async () => {
    await expect(ingestEvent({
      eventName: 'message.delivered',
      eventCategory: 'business',
      providerEventId: 'prov_bad',
    })).rejects.toMatchObject({ code: 'EVENT_CATEGORY_MISMATCH' })
  })

  it('requires an idempotency key', async () => {
    await expect(ingestEvent({
      eventName: 'message.delivered',
      eventCategory: 'delivery',
    })).rejects.toMatchObject({ code: 'MISSING_PROVIDER_EVENT_ID' })
  })

  it('builds deterministic provider_event_id for internal events', async () => {
    findOne.mockResolvedValueOnce(null)
    query.mockResolvedValueOnce([{
      id: 'evt_1',
      event_name: 'execution.created',
      event_category: 'system',
      provider_event_id: 'publishing:execution:exec_1:execution.created:2026-01-01T00:00:00.000Z',
      context: {},
      data: {},
    }])
    await ingestEvent({
      eventName: 'execution.created',
      source: 'publishing',
      objectRef: 'execution:exec_1',
      occurredAt: '2026-01-01T00:00:00.000Z',
    })
    expect(query.mock.calls[0][1][16]).toBe(
      'publishing:execution:exec_1:execution.created:2026-01-01T00:00:00.000Z',
    )
  })
})

describe('growth-os consent eligibility', () => {
  it('granted marketing → OK_CONSENT_GRANTED', async () => {
    mockHealthyChannel()
    query.mockImplementation(async (sql, params) => {
      if (String(sql).includes('channel_connections')) return [{ '?column?': 1 }]
      if (String(sql).includes('status = \'withdrawn\'')) return []
      if (String(sql).includes('consent_current') && params?.[2] === 'marketing') {
        return [{
          status: 'granted',
          legal_basis: 'explicit_optin',
          jurisdiction: 'AE',
          expires_at: null,
        }]
      }
      return []
    })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'email', purpose: 'marketing',
    })).resolves.toMatchObject({
      allowed: true,
      reason_code: ELIGIBILITY_REASON_CODES.OK_CONSENT_GRANTED,
    })
  })

  it('denied → DENY_OPTED_OUT', async () => {
    mockHealthyChannel()
    query.mockImplementation(async (sql, params) => {
      if (String(sql).includes('channel_connections')) return [{ '?column?': 1 }]
      if (String(sql).includes('status = \'withdrawn\'')) return []
      if (String(sql).includes('consent_current')) {
        return [{ status: 'denied', expires_at: null }]
      }
      return []
    })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'email', purpose: 'marketing',
    })).resolves.toMatchObject({
      allowed: false,
      reason_code: ELIGIBILITY_REASON_CODES.DENY_OPTED_OUT,
    })
  })

  it('withdrawn on channel → DENY_WITHDRAWN', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('status = \'withdrawn\'')) return [{ '?column?': 1 }]
      return []
    })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'email', purpose: 'marketing',
      skipChannelHealth: true,
    })).resolves.toMatchObject({
      allowed: false,
      reason_code: ELIGIBILITY_REASON_CODES.DENY_WITHDRAWN,
    })
  })

  it('expired grant → DENY_EXPIRED', async () => {
    mockHealthyChannel()
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('channel_connections')) return [{ '?column?': 1 }]
      if (String(sql).includes('status = \'withdrawn\'')) return []
      if (String(sql).includes('consent_current')) {
        return [{
          status: 'granted',
          legal_basis: 'explicit_optin',
          jurisdiction: 'AE',
          expires_at: '2020-01-01T00:00:00.000Z',
        }]
      }
      return []
    })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'email', purpose: 'marketing',
      now: '2026-01-01T00:00:00.000Z',
    })).resolves.toMatchObject({
      allowed: false,
      reason_code: ELIGIBILITY_REASON_CODES.DENY_EXPIRED,
    })
  })

  it('missing consent → DENY_NO_CONSENT', async () => {
    mockHealthyChannel()
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('channel_connections')) return [{ '?column?': 1 }]
      if (String(sql).includes('status = \'withdrawn\'')) return []
      if (String(sql).includes('consent_current')) return []
      return []
    })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'whatsapp', purpose: 'nurture',
    })).resolves.toMatchObject({
      allowed: false,
      reason_code: ELIGIBILITY_REASON_CODES.DENY_NO_CONSENT,
    })
  })

  it('transactional email → OK_TRANSACTIONAL', async () => {
    mockHealthyChannel()
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('channel_connections')) return [{ '?column?': 1 }]
      if (String(sql).includes('status = \'withdrawn\'')) return []
      return []
    })
    await expect(checkEligibility({
      contactId: 'ctc_1', channel: 'email', purpose: 'transactional',
    })).resolves.toMatchObject({
      allowed: true,
      reason_code: ELIGIBILITY_REASON_CODES.OK_TRANSACTIONAL,
    })
  })

  it('whatsapp transactional inside service window → OK_SERVICE_WINDOW', async () => {
    mockHealthyChannel()
    const inboundAt = new Date('2026-01-01T12:00:00.000Z')
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('channel_connections')) return [{ '?column?': 1 }]
      if (String(sql).includes('status = \'withdrawn\'')) return []
      if (String(sql).includes('conversation_messages')) {
        return [{ last_inbound_at: inboundAt.toISOString() }]
      }
      return []
    })
    const result = await checkEligibility({
      contactId: 'ctc_1',
      channel: 'whatsapp',
      purpose: 'transactional',
      now: '2026-01-01T18:00:00.000Z',
    })
    expect(result).toMatchObject({
      allowed: true,
      reason_code: ELIGIBILITY_REASON_CODES.OK_SERVICE_WINDOW,
    })
    expect(result.window_expires_at).toBe(new Date(inboundAt.getTime() + 24 * 3600 * 1000).toISOString())
  })

  it('whatsapp transactional outside window without template → DENY_WHATSAPP_WINDOW_CLOSED_NO_TEMPLATE', async () => {
    mockHealthyChannel()
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('channel_connections')) return [{ '?column?': 1 }]
      if (String(sql).includes('status = \'withdrawn\'')) return []
      if (String(sql).includes('conversation_messages')) return [{ last_inbound_at: '2020-01-01T00:00:00.000Z' }]
      return []
    })
    await expect(checkEligibility({
      contactId: 'ctc_1',
      channel: 'whatsapp',
      purpose: 'transactional',
      now: '2026-01-01T00:00:00.000Z',
    })).resolves.toMatchObject({
      allowed: false,
      reason_code: ELIGIBILITY_REASON_CODES.DENY_WHATSAPP_WINDOW_CLOSED_NO_TEMPLATE,
      required_action: 'use_approved_utility_or_auth_template',
    })
  })

  it('whatsapp transactional outside window with utility template → OK_TEMPLATE', async () => {
    mockHealthyChannel()
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('channel_connections')) return [{ '?column?': 1 }]
      if (String(sql).includes('status = \'withdrawn\'')) return []
      if (String(sql).includes('conversation_messages')) return [{ last_inbound_at: '2020-01-01T00:00:00.000Z' }]
      return []
    })
    await expect(checkEligibility({
      contactId: 'ctc_1',
      channel: 'whatsapp',
      purpose: 'transactional',
      now: '2026-01-01T00:00:00.000Z',
      approvedTemplate: 'utility',
    })).resolves.toMatchObject({
      allowed: true,
      reason_code: ELIGIBILITY_REASON_CODES.OK_TEMPLATE,
    })
  })

  it('whatsapp marketing granted outside window without template → DENY_WHATSAPP_NO_TEMPLATE', async () => {
    mockHealthyChannel()
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('channel_connections')) return [{ '?column?': 1 }]
      if (String(sql).includes('status = \'withdrawn\'')) return []
      if (String(sql).includes('consent_current')) {
        return [{
          status: 'granted',
          legal_basis: 'explicit_optin',
          jurisdiction: 'AE',
          expires_at: null,
        }]
      }
      if (String(sql).includes('conversation_messages')) {
        return [{ last_inbound_at: '2020-01-01T00:00:00.000Z' }]
      }
      return []
    })
    await expect(checkEligibility({
      contactId: 'ctc_1',
      channel: 'whatsapp',
      purpose: 'marketing',
      now: '2026-01-01T00:00:00.000Z',
    })).resolves.toMatchObject({
      allowed: false,
      reason_code: ELIGIBILITY_REASON_CODES.DENY_WHATSAPP_NO_TEMPLATE,
    })
  })

  it('setConsent appends rows and getConsent reads latest', async () => {
    insert.mockImplementation(async (_c, row) => row)
    query.mockResolvedValueOnce([{
      id: 'cns_2',
      contact_id: 'ctc_1',
      channel: 'email',
      purpose: 'marketing',
      status: 'withdrawn',
      captured_at: '2026-02-01T00:00:00.000Z',
    }])
    const row = await setConsent({
      contactId: 'ctc_1',
      channel: 'email',
      purpose: 'marketing',
      status: 'withdrawn',
      legalBasis: 'explicit_optin',
    })
    expect(row.status).toBe('withdrawn')
    expect(insert).toHaveBeenCalledTimes(1)
    const current = await getConsent({
      contactId: 'ctc_1',
      channel: 'email',
      purpose: 'marketing',
    })
    expect(current.status).toBe('withdrawn')
  })
})
