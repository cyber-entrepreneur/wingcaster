// @vitest-environment jsdom
/**
 * AGN-TPL-002 — agency template editor page contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getAgencyMessageTemplate: vi.fn(),
  createAgencyMessageTemplate: vi.fn(),
  updateAgencyMessageTemplate: vi.fn(),
  publishAgencyMessageTemplate: vi.fn(),
  renderAgencyMessageTemplate: vi.fn(),
  deleteAgencyMessageTemplate: vi.fn(),
  getMyAgency: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

const authMock = vi.hoisted(() => ({
  agent: {
    id: 'user-owner-1',
    name: 'Owner',
    affiliation: { agency_id: 'agency-1', role: 'owner' as string | undefined },
  } as { id: string; name: string; affiliation: { agency_id: string; role: string | undefined } },
  loading: false,
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { AgencyTemplateEditorPage } from './AgencyTemplateEditorPage'

const TEMPLATE = {
  id: 'tpl_1',
  agency_id: 'agency-1',
  name: 'Welcome lead',
  channel: 'whatsapp' as const,
  category: 'greeting' as const,
  subject: null,
  body: 'Hi {{client_name}} from {{agency_name}}',
  variables: ['client_name', 'agency_name'],
  language: 'en',
  approval_status: 'draft' as const,
  usage_count: 0,
  agents_using_count: 0,
  is_default: false,
  created_by: 'user-owner-1',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-02T00:00:00Z',
}

function renderEditor(path = '/agency/templates/tpl_1') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agency/templates/:templateId" element={<AgencyTemplateEditorPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent.affiliation.role = 'owner'
  authMock.loading = false
  apiMock.getAgencyMessageTemplate.mockResolvedValue(TEMPLATE)
  apiMock.getMyAgency.mockResolvedValue({ id: 'agency-1', name: 'Elite Realty' })
  apiMock.updateAgencyMessageTemplate.mockResolvedValue(TEMPLATE)
  apiMock.publishAgencyMessageTemplate.mockResolvedValue({ ...TEMPLATE, approval_status: 'approved' })
  apiMock.renderAgencyMessageTemplate.mockResolvedValue({
    body: 'Hi Sara from Elite Realty',
    subject: null,
    missing_variables: [],
  })
})

afterEach(() => {
  cleanup()
})

describe('AgencyTemplateEditorPage', () => {
  it('loads an existing template for admins', async () => {
    renderEditor()
    await waitFor(() => expect(apiMock.getAgencyMessageTemplate).toHaveBeenCalledWith('tpl_1'))
    expect(screen.getByDisplayValue('Welcome lead')).toBeTruthy()
  })

  it('shows forbidden guard for non-admin members', async () => {
    authMock.agent.affiliation.role = 'member'
    renderEditor()
    await waitFor(() => expect(screen.getByText('Admin access required')).toBeTruthy())
    expect(apiMock.getAgencyMessageTemplate).not.toHaveBeenCalled()
  })

  it('saves draft changes', async () => {
    const user = userEvent.setup()
    renderEditor()
    await waitFor(() => expect(screen.getByDisplayValue('Welcome lead')).toBeTruthy())
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Updated welcome')
    await user.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => expect(apiMock.updateAgencyMessageTemplate).toHaveBeenCalled())
  })
})
