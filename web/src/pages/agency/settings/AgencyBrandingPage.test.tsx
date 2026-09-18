// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AgencyBrandingPage } from './AgencyBrandingPage'

const { addToast, apiMock } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getMyAgency: vi.fn(),
    getAgencyBranding: vi.fn(),
    updateAgencyBranding: vi.fn(),
    resetAgencyBranding: vi.fn(),
    uploadMedia: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'user-owner', name: 'Agency Owner' },
    loading: false,
  }),
}))
vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>('@/components/ui/toast')
  return { ...actual, useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }) }
})
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const BRANDING = {
  agency_id: 'agency-1',
  name: 'Aleph Realty',
  description: 'Trusted property advisors.',
  logo_url: null,
  favicon_url: null,
  primary_color: '#C93C08',
  accent_color: '#0A7A85',
  font_family: 'ibm-plex-sans' as const,
  updated_at: '2026-09-18T18:00:00.000Z',
  updated_by: 'user-owner',
  is_default: false,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/settings/branding']}>
      <Routes>
        <Route path="/agency/settings/branding" element={<AgencyBrandingPage />} />
        <Route path="/agency/settings" element={<div>settings home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.dir = 'ltr'
  apiMock.getMyAgency.mockResolvedValue({ id: 'agency-1', name: 'Aleph Realty' })
  apiMock.getAgencyBranding.mockResolvedValue({ branding: BRANDING })
  apiMock.updateAgencyBranding.mockImplementation(async (_id, update) => ({
    branding: { ...BRANDING, ...update, updated_at: '2026-09-18T19:00:00.000Z' },
  }))
  apiMock.resetAgencyBranding.mockResolvedValue({
    branding: {
      ...BRANDING,
      logo_url: null,
      favicon_url: null,
      primary_color: null,
      accent_color: null,
      font_family: 'system',
      is_default: true,
    },
  })
  apiMock.uploadMedia.mockResolvedValue({
    items: [{ url: '/uploads/aleph-logo.svg', media_type: 'image', filename: 'logo.svg' }],
  })
})

describe('AgencyBrandingPage', () => {
  it('loads agency identity, visual settings, and a live preview', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Identity and branding' })).toBeTruthy()
    expect(screen.getByLabelText('Agency name')).toHaveValue('Aleph Realty')
    expect(screen.getByLabelText('Description')).toHaveValue('Trusted property advisors.')
    expect(screen.getByLabelText('Primary color')).toHaveValue('#C93C08')
    expect(screen.getByText('Live preview')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('publishes strict identity and brand settings', async () => {
    renderPage()
    await screen.findByDisplayValue('Aleph Realty')

    fireEvent.change(screen.getByLabelText('Agency name'), { target: { value: 'Aleph International' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Cross-border property advisors.' } })
    fireEvent.click(screen.getByRole('radio', { name: /Archivo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(apiMock.updateAgencyBranding).toHaveBeenCalledWith('agency-1', expect.objectContaining({
      name: 'Aleph International',
      description: 'Cross-border property advisors.',
      primary_color: '#C93C08',
      accent_color: '#0A7A85',
      font_family: 'archivo',
    })))
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Agency brand published' }))
  })

  it('uploads and stages an agency logo before save', async () => {
    renderPage()
    await screen.findByDisplayValue('Aleph Realty')
    const file = new File(['logo'], 'logo.svg', { type: 'image/svg+xml' })

    fireEvent.change(screen.getByLabelText('Choose agency logo'), { target: { files: [file] } })

    await waitFor(() => expect(apiMock.uploadMedia).toHaveBeenCalledWith([file]))
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(apiMock.updateAgencyBranding).toHaveBeenCalledWith(
      'agency-1',
      expect.objectContaining({ logo_url: '/uploads/aleph-logo.svg' }),
    ))
  })

  it('resets visual settings while preserving identity', async () => {
    apiMock.getAgencyBranding.mockResolvedValueOnce({
      branding: { ...BRANDING, logo_url: '/uploads/logo.png' },
    })
    renderPage()
    await screen.findByDisplayValue('Aleph Realty')

    fireEvent.click(screen.getByRole('button', { name: 'Reset visual brand' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset visual brand' }))

    await waitFor(() => expect(apiMock.resetAgencyBranding).toHaveBeenCalledWith('agency-1'))
    expect(screen.getByLabelText('Agency name')).toHaveValue('Aleph Realty')
    expect(screen.getByLabelText('Description')).toHaveValue('Trusted property advisors.')
  })

  it('shows a retryable error state', async () => {
    apiMock.getAgencyBranding.mockRejectedValueOnce(new Error('Brand service unavailable'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Brand service unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByDisplayValue('Aleph Realty')).toBeTruthy()
    expect(apiMock.getAgencyBranding).toHaveBeenCalledTimes(2)
  })

  it('uses logical RTL navigation and mobile-first controls', async () => {
    document.documentElement.dir = 'rtl'
    renderPage()
    await screen.findByDisplayValue('Aleph Realty')

    const backLink = screen.getByRole('link', { name: /Agency settings/ })
    expect(backLink.querySelector('svg')?.getAttribute('class')).toContain('rtl:rotate-180')
    expect(screen.getByRole('button', { name: 'Save changes' }).getAttribute('class')).toContain('min-h-tap')
  })
})
