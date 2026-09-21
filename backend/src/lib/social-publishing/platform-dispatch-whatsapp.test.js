import { describe, expect, it, vi, beforeEach } from 'vitest'

const whatsappMocks = vi.hoisted(() => ({
  isWhatsAppConfigured: vi.fn(),
  resolveWhatsAppCredentials: vi.fn(),
  isTenantWhatsAppConfigured: vi.fn(),
  sendListingToWhatsApp: vi.fn(),
}))

vi.mock('../../whatsapp.js', () => whatsappMocks)

import { dispatchPlatformPublish } from './platform-dispatch.js'

describe('platform-dispatch whatsapp tenant token preference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    whatsappMocks.sendListingToWhatsApp.mockResolvedValue({ message_id: 'msg-1' })
  })

  it('prefers tenant OAuth credentials over global env', async () => {
    whatsappMocks.isTenantWhatsAppConfigured.mockReturnValue(true)
    whatsappMocks.isWhatsAppConfigured.mockReturnValue(false)
    whatsappMocks.resolveWhatsAppCredentials.mockReturnValue({
      accessToken: 'tenant-token',
      phoneNumberId: 'tenant-phone',
      wabaId: 'tenant-waba',
      defaultRecipient: '15551234567',
      source: 'tenant',
    })

    const connection = {
      id: 'conn-wa',
      platform: 'whatsapp',
      settings: {
        enterprise_targets: {
          wa_phone_number_id: 'tenant-phone',
          wa_business_account_id: 'tenant-waba',
        },
      },
    }

    const result = await dispatchPlatformPublish({
      platform: 'whatsapp',
      connection,
      property: { id: 'p1', title: 'Listing' },
      serializedProperty: { id: 'p1', title: 'Listing' },
      caption: 'Hello',
      recipient: '15559876543',
    })

    expect(result.publishError).toBeNull()
    expect(whatsappMocks.sendListingToWhatsApp).toHaveBeenCalledWith(
      { id: 'p1', title: 'Listing' },
      '15559876543',
      null,
      {
        config: {
          accessToken: 'tenant-token',
          phoneNumberId: 'tenant-phone',
          wabaId: 'tenant-waba',
          defaultRecipient: '15551234567',
          source: 'tenant',
        },
      },
    )
  })

  it('falls back to env when tenant credentials are absent', async () => {
    whatsappMocks.isTenantWhatsAppConfigured.mockReturnValue(false)
    whatsappMocks.isWhatsAppConfigured.mockReturnValue(true)
    whatsappMocks.resolveWhatsAppCredentials.mockReturnValue({
      accessToken: 'env-token',
      phoneNumberId: 'env-phone',
      wabaId: 'env-waba',
      defaultRecipient: '15550001111',
      source: 'env',
    })

    const result = await dispatchPlatformPublish({
      platform: 'whatsapp',
      connection: { id: 'conn-wa', platform: 'whatsapp', settings: {} },
      property: { id: 'p1', title: 'Listing' },
      serializedProperty: { id: 'p1', title: 'Listing' },
      recipient: '15552223333',
    })

    expect(result.publishError).toBeNull()
    expect(whatsappMocks.sendListingToWhatsApp).toHaveBeenCalled()
    expect(whatsappMocks.resolveWhatsAppCredentials).toHaveBeenCalled()
  })
})
