// @vitest-environment jsdom
/**
 * AGN-TPL-001 — agency templates list page contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  listAgencyMessageTemplates: vi.fn(),
  createAgencyMessageTemplate: vi.fn(),
  publishAgencyMessageTemplate: vi.fn(),
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

import { AgencyTemplatesListPage } from './AgencyTemplatesListPage'

const TEMPLATE = {
  id: 'tpl_1',
  agency_id: 'agency-1',
  name: 'Welcome lead',
  channel: 'whatsapp' as const,
  category: 'greeting' as const,
  subject: null,
  body: 'Hi {{client_name}}',
  variables: ['client_name'],
  language: 'en',
  approval_status: 'draft' as const,
  usage_count: 2,
  agents_using_count: 2,
  is_default: false,
  created_by: 'user-owner-1',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-02T00:00:00Z',
}

function renderPage(path = '/agency/templates') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agency/templates" element={<AgencyTemplatesListPage />} />
          <Route path="/agency/templates/:templateId" element={<AgencyTemplatesListPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent.affiliation.role = 'owner'
  authMock.loading = false
  apiMock.listAgencyMessageTemplates.mockResolvedValue({ templates: [TEMPLATE] })
  apiMock.createAgencyMessageTemplate.mockResolvedValue({ ...TEMPLATE, id: 'tpl_new' })
  apiMock.publishAgencyMessageTemplate.mockResolvedValue({ ...TEMPLATE, approval_status: 'approved' })
})

afterEach(() => {
  cleanup()
})

describe('AgencyTemplatesListPage', () => {
  it('lists agency templates for admins', async () => {
    renderPage()
    await waitFor(() => expect(apiMock.listAgencyMessageTemplates).toHaveBeenCalled())
    expect(screen.getByText('Welcome lead')).toBeTruthy()
  })

  it('shows forbidden guard for non-admin members', async () => {
    authMock.agent.affiliation.role = 'member'
    renderPage()
    await waitFor(() => expect(screen.getByText('Admin access required')).toBeTruthy())
    expect(apiMock.listAgencyMessageTemplates).not.toHaveBeenCalled()
  })

  it('publishes a draft template', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Welcome lead')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /publish/i }))
    await waitFor(() => expect(apiMock.publishAgencyMessageTemplate).toHaveBeenCalledWith('tpl_1'))
  })
})
