// @vitest-environment jsdom
/**
 * AGN-WLB-003 — white-label copy editor page contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getAgencyWhiteLabelCopy: vi.fn(),
  updateAgencyWhiteLabelCopy: vi.fn(),
  publishAgencyWhiteLabelCopy: vi.fn(),
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

import { AgencyWhiteLabelCopyPage } from './AgencyWhiteLabelCopyPage'

const COPY_CONFIG = {
  id: 'cfg_1',
  agency_id: 'agency-1',
  template_id: null,
  logo_url: null,
  favicon_url: null,
  primary_color: null,
  accent_color: null,
  font_pair: null,
  copy_fields: {
    header: { tagline: 'Find your home' },
    about: { paragraph: 'We are a boutique agency.', mission: 'Client-first service.' },
    featured_listings: {
      filter: 'all' as const,
      area: '',
      property_type: '',
      price_min: null,
      price_max: null,
      sort: 'newest' as const,
    },
    team: { intro: 'Meet our agents.' },
    contact: { phone: '+971 4 000 0000', email: 'hello@elite.test', address: 'Dubai', hours: '9-6' },
    footer: { disclaimer: 'Licensed brokerage.' },
  },
  custom_domain: null,
  ssl_status: 'none',
  published_at: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent.affiliation.role = 'owner'
  authMock.loading = false
  apiMock.getAgencyWhiteLabelCopy.mockResolvedValue({
    config: COPY_CONFIG,
    agency_name: 'Elite Realty',
  })
  apiMock.updateAgencyWhiteLabelCopy.mockResolvedValue({ config: COPY_CONFIG })
  apiMock.publishAgencyWhiteLabelCopy.mockResolvedValue({
    config: { ...COPY_CONFIG, published_at: '2026-09-03T00:00:00Z' },
  })
})

afterEach(() => {
  cleanup()
})

describe('AgencyWhiteLabelCopyPage', () => {
  it('loads copy fields for admins', async () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/agency/white-label/copy']}>
          <AgencyWhiteLabelCopyPage />
        </MemoryRouter>
      </ToastProvider>,
    )
    await waitFor(() => expect(apiMock.getAgencyWhiteLabelCopy).toHaveBeenCalled())
    expect(screen.getByDisplayValue('Find your home')).toBeTruthy()
  })

  it('shows forbidden guard for non-admin members', async () => {
    authMock.agent.affiliation.role = 'member'
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/agency/white-label/copy']}>
          <AgencyWhiteLabelCopyPage />
        </MemoryRouter>
      </ToastProvider>,
    )
    await waitFor(() => expect(screen.getByText('Admin access required')).toBeTruthy())
    expect(apiMock.getAgencyWhiteLabelCopy).not.toHaveBeenCalled()
  })

  it('publishes copy config', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/agency/white-label/copy']}>
          <AgencyWhiteLabelCopyPage />
        </MemoryRouter>
      </ToastProvider>,
    )
    await waitFor(() => expect(screen.getByDisplayValue('Find your home')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /^publish$/i }))
    await waitFor(() => expect(apiMock.publishAgencyWhiteLabelCopy).toHaveBeenCalled())
  })
})
