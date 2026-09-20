import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  insert: vi.fn(),
  findAgentPrimaryConnection: vi.fn(),
  recordDistributionAttempt: vi.fn(),
  createExecution: vi.fn(),
  getChannelConnection: vi.fn(),
  transitionExecution: vi.fn(),
  recordExecutionAttempt: vi.fn(),
  ingestEvent: vi.fn(),
  checkEligibility: vi.fn(),
  dispatchPlatformPublish: vi.fn(),
}))

vi.mock('../../db.js', () => ({
  findOne: mocks.findOne,
  insert: mocks.insert,
  findAll: vi.fn(),
}))

vi.mock('../social/personal-connections-routes.js', () => ({
  findAgentPrimaryConnection: mocks.findAgentPrimaryConnection,
}))

vi.mock('../publishing/record-attempt.js', () => ({
  recordDistributionAttempt: mocks.recordDistributionAttempt,
}))

vi.mock('../growth-os/index.js', () => ({
  createExecution: mocks.createExecution,
  getChannelConnection: mocks.getChannelConnection,
  transitionExecution: mocks.transitionExecution,
  recordExecutionAttempt: mocks.recordExecutionAttempt,
  ingestEvent: mocks.ingestEvent,
  checkEligibility: mocks.checkEligibility,
  buildIdempotencyKey: vi.fn(() => 'idem-key'),
}))

vi.mock('./platform-dispatch.js', () => ({
  dispatchPlatformPublish: mocks.dispatchPlatformPublish,
}))

import { publishListingToSocialChannels } from './consolidated-publish.js'

const property = {
  id: 'prop-1',
  title: 'Test listing',
  city: 'Dubai',
  photos: ['https://example.com/photo.jpg'],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.insert.mockImplementation(async (_table, row) => ({ ...row }))
  mocks.createExecution.mockImplementation(async (row) => ({ id: 'exec-1', ...row }))
  mocks.transitionExecution.mockResolvedValue({ id: 'exec-1', status: 'published' })
  mocks.recordDistributionAttempt.mockResolvedValue(undefined)
  mocks.recordExecutionAttempt.mockResolvedValue(undefined)
  mocks.ingestEvent.mockResolvedValue({ event: { id: 'evt-1' }, inserted: true })
  mocks.checkEligibility.mockResolvedValue({ allowed: true, reason_code: 'OK_CONSENT_GRANTED' })
})

describe('publishListingToSocialChannels', () => {
  it('fans out to connected platforms and records executions', async () => {
    mocks.findAgentPrimaryConnection.mockResolvedValue({
      id: 'conn-ig',
      platform: 'instagram',
      status: 'connected',
      account_name: '@agency',
    })
    mocks.getChannelConnection.mockResolvedValue({
      id: 'chn_mc_conn-ig',
      health: 'connected',
    })
    mocks.dispatchPlatformPublish.mockResolvedValue({
      publishResult: { provider: 'instagram_graph_api', provider_message_id: 'ig-99' },
      publishError: null,
    })

    const { results } = await publishListingToSocialChannels({
      property,
      agentId: 'agent-1',
      channels: [{ platform: 'instagram' }],
      defaultCaption: 'Hello IG',
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ platform: 'instagram', status: 'published', external_id: 'ig-99' })
    expect(mocks.createExecution).toHaveBeenCalledWith(expect.objectContaining({ kind: 'social_post' }))
    expect(mocks.dispatchPlatformPublish).toHaveBeenCalled()
    expect(mocks.ingestEvent).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'post.published' }))
  })

  it('fails unconnected platforms with clear reason', async () => {
    mocks.findAgentPrimaryConnection.mockResolvedValue(null)

    const { results } = await publishListingToSocialChannels({
      property,
      agentId: 'agent-1',
      channels: [{ platform: 'facebook' }],
    })

    expect(results[0]).toMatchObject({ status: 'failed', error_code: 'NOT_CONNECTED' })
    expect(mocks.dispatchPlatformPublish).not.toHaveBeenCalled()
  })

  it('blocks WhatsApp when consent is denied', async () => {
    mocks.findAgentPrimaryConnection.mockResolvedValue({
      id: 'conn-wa',
      platform: 'whatsapp',
      status: 'connected',
      settings: { notify_number: '96170000000' },
    })
    mocks.getChannelConnection.mockResolvedValue({ id: 'chn_mc_conn-wa', health: 'connected' })
    mocks.findOne.mockResolvedValue({ id: 'contact-1', phone: '96170000000' })
    mocks.checkEligibility.mockResolvedValue({ allowed: false, reason_code: 'DENY_NO_CONSENT' })

    const { results } = await publishListingToSocialChannels({
      property,
      agentId: 'agent-1',
      channels: [{ platform: 'whatsapp' }],
      recipient: '96170000000',
    })

    expect(results[0]).toMatchObject({ status: 'failed', error_code: 'DENY_NO_CONSENT' })
    expect(mocks.dispatchPlatformPublish).not.toHaveBeenCalled()
    expect(mocks.ingestEvent).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'message.failed' }))
  })

  it('does not run consent check for public Instagram posts', async () => {
    mocks.findAgentPrimaryConnection.mockResolvedValue({
      id: 'conn-ig',
      platform: 'instagram',
      status: 'connected',
    })
    mocks.getChannelConnection.mockResolvedValue({ id: 'chn_mc_conn-ig', health: 'connected' })
    mocks.dispatchPlatformPublish.mockResolvedValue({
      publishResult: { provider_message_id: 'ig-1' },
      publishError: null,
    })

    await publishListingToSocialChannels({
      property,
      agentId: 'agent-1',
      channels: [{ platform: 'instagram' }],
    })

    expect(mocks.checkEligibility).not.toHaveBeenCalled()
  })
})
