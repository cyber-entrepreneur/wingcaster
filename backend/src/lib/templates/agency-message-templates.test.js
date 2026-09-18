import { beforeEach, describe, expect, it, vi } from 'vitest'

const templates = vi.hoisted(() => ({
  getTemplateById: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  renderTemplate: vi.fn(),
  getTemplates: vi.fn(),
}))

vi.mock('../../message-templates.js', () => templates)

let updateAgencyMessageTemplate
let renderAgencyMessageTemplate
let deleteAgencyMessageTemplate

beforeEach(async () => {
  vi.resetModules()
  Object.values(templates).forEach((fn) => fn.mockReset())

  templates.getTemplateById.mockResolvedValue({
    id: 'tpl_1',
    owner_type: 'agency',
    owner_id: 'agc_1',
    name: 'Welcome',
    channel: 'whatsapp',
    category: 'greeting',
    subject: null,
    body: 'Hi {{client_name}} from {{agency_name}}',
    variables: ['client_name', 'agency_name'],
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
    name: 'Updated',
    channel: 'whatsapp',
    category: 'greeting',
    subject: null,
    body: 'Hi',
    variables: [],
    language: 'en',
    approval_status: 'draft',
    usage_count: 0,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-03T00:00:00Z',
  })
  templates.renderTemplate.mockReturnValue({
    body: 'Hi Sara from Elite Realty',
    subject: null,
    missing_variables: [],
  })

  ;({
    updateAgencyMessageTemplate,
    renderAgencyMessageTemplate,
    deleteAgencyMessageTemplate,
  } = await import('./agency-message-templates.js'))
})

describe('agency message templates editor', () => {
  it('updates an agency template', async () => {
    const updated = await updateAgencyMessageTemplate('agc_1', 'tpl_1', { name: 'Updated' })
    expect(templates.updateTemplate).toHaveBeenCalledWith('tpl_1', { name: 'Updated' })
    expect(updated?.name).toBe('Updated')
  })

  it('renders a template with variables', async () => {
    const rendered = await renderAgencyMessageTemplate('agc_1', 'tpl_1', {
      client_name: 'Sara',
      agency_name: 'Elite Realty',
    })
    expect(templates.renderTemplate).toHaveBeenCalled()
    expect(rendered?.body).toContain('Elite Realty')
  })

  it('deletes an agency template', async () => {
    templates.deleteTemplate.mockResolvedValue(true)
    const deleted = await deleteAgencyMessageTemplate('agc_1', 'tpl_1')
    expect(deleted).toBe(true)
    expect(templates.deleteTemplate).toHaveBeenCalledWith('tpl_1')
  })
})
