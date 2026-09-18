import { beforeEach, describe, expect, it, vi } from 'vitest'

const templates = vi.hoisted(() => ({
  getTemplates: vi.fn(),
  getTemplateById: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
}))

vi.mock('../../message-templates.js', () => templates)

let listAgencyMessageTemplates
let publishAgencyMessageTemplate

beforeEach(async () => {
  vi.resetModules()
  templates.getTemplates.mockReset()
  templates.getTemplateById.mockReset()
  templates.createTemplate.mockReset()
  templates.updateTemplate.mockReset()

  templates.getTemplates.mockResolvedValue([
    {
      id: 'tpl_1',
      owner_type: 'agency',
      owner_id: 'agc_1',
      name: 'Welcome',
      channel: 'whatsapp',
      category: 'greeting',
      subject: null,
      body: 'Hi {{client_name}}',
      variables: ['client_name'],
      language: 'en',
      approval_status: 'draft',
      usage_count: 3,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-02T00:00:00Z',
    },
  ])

  ;({ listAgencyMessageTemplates, publishAgencyMessageTemplate } = await import('./agency-message-templates.js'))
})

describe('agency message templates', () => {
  it('lists agency-owned templates', async () => {
    const rows = await listAgencyMessageTemplates('agc_1')
    expect(templates.getTemplates).toHaveBeenCalledWith({
      ownerType: 'agency',
      ownerId: 'agc_1',
      channel: undefined,
      category: undefined,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'tpl_1',
      agency_id: 'agc_1',
      usage_count: 3,
      agents_using_count: 3,
    })
  })

  it('publishes a template by setting approval_status approved', async () => {
    templates.getTemplateById.mockResolvedValue({
      id: 'tpl_1',
      owner_type: 'agency',
      owner_id: 'agc_1',
      name: 'Welcome',
      channel: 'whatsapp',
      category: 'greeting',
      subject: null,
      body: 'Hi',
      variables: [],
      language: 'en',
      approval_status: 'draft',
      usage_count: 0,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    })
    templates.updateTemplate.mockResolvedValue({
      id: 'tpl_1',
      owner_type: 'agency',
      owner_id: 'agc_1',
      name: 'Welcome',
      channel: 'whatsapp',
      category: 'greeting',
      subject: null,
      body: 'Hi',
      variables: [],
      language: 'en',
      approval_status: 'approved',
      usage_count: 0,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-03T00:00:00Z',
    })

    const published = await publishAgencyMessageTemplate('agc_1', 'tpl_1')
    expect(templates.updateTemplate).toHaveBeenCalledWith('tpl_1', { approval_status: 'approved' })
    expect(published?.approval_status).toBe('approved')
  })
})
