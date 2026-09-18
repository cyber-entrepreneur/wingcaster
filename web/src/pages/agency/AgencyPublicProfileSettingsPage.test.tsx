// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicAgencyProfile } from '@/components/agency/PublicAgencyProfile'
import { AgencyPublicProfileSettingsPage } from './AgencyPublicProfileSettingsPage'

const { addToast, apiMock } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getMyAgency: vi.fn(),
    getAgencyPublicProfileSettings: vi.fn(),
    updateAgencyPublicProfileSettings: vi.fn(),
    createInquiry: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'owner-1' }, loading: false }),
}))
vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>('@/components/ui/toast')
  return { ...actual, useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }) }
})
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const SETTINGS = {
  agency_id: 'agency-1',
  show_team: true,
  show_listings: true,
  show_reviews: true,
  show_closed_transactions: false,
  show_contact_form: true,
  hero_title: 'Find your place with Aleph',
  hero_body: 'Local intelligence with global reach.',
  meta_description: 'Aleph Realty property advisors and active listings.',
  updated_at: '2026-09-18T20:00:00.000Z',
  updated_by: 'owner-1',
  is_default: false,
}

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/agency/public-profile']}>
      <Routes>
        <Route path="/agency/public-profile" element={<AgencyPublicProfileSettingsPage />} />
        <Route path="/agency" element={<div>agency home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.dir = 'ltr'
  apiMock.getMyAgency.mockResolvedValue({ id: 'agency-1', name: 'Aleph Realty' })
  apiMock.getAgencyPublicProfileSettings.mockResolvedValue({ settings: SETTINGS })
  apiMock.updateAgencyPublicProfileSettings.mockImplementation(async (_id, update) => ({
    settings: { ...SETTINGS, ...update, updated_at: '2026-09-18T21:00:00.000Z' },
  }))
  apiMock.createInquiry.mockResolvedValue({ id: 'inquiry-1' })
  vi.spyOn(window, 'open').mockImplementation(() => null)
})

describe('AgencyPublicProfileSettingsPage', () => {
  it('loads visibility, hero, SEO, and live preview state', async () => {
    renderSettings()

    expect(await screen.findByRole('heading', { name: 'Public profile settings' })).toBeTruthy()
    expect(screen.getByLabelText('Hero title')).toHaveValue('Find your place with Aleph')
    expect(screen.getByLabelText('Meta description')).toHaveValue('Aleph Realty property advisors and active listings.')
    expect(screen.getByRole('checkbox', { name: /Team/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Closed transactions/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Save and publish' })).toBeDisabled()
  })

  it('publishes all visibility and copy fields', async () => {
    renderSettings()
    await screen.findByDisplayValue('Find your place with Aleph')

    fireEvent.click(screen.getByRole('checkbox', { name: /Team/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Closed transactions/ }))
    fireEvent.change(screen.getByLabelText('Hero title'), { target: { value: 'Dubai homes, expertly represented' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }))

    await waitFor(() => expect(apiMock.updateAgencyPublicProfileSettings).toHaveBeenCalledWith(
      'agency-1',
      expect.objectContaining({
        show_team: false,
        show_closed_transactions: true,
        hero_title: 'Dubai homes, expertly represented',
      }),
    ))
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Public profile published' }))
  })

  it('opens the actual public agency route for preview', async () => {
    renderSettings()
    await screen.findByDisplayValue('Find your place with Aleph')

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect(window.open).toHaveBeenCalledWith('/public/agency/agency-1', '_blank', 'noopener,noreferrer')
  })

  it('shows a retryable error state', async () => {
    apiMock.getAgencyPublicProfileSettings.mockRejectedValueOnce(new Error('Profile service unavailable'))
    renderSettings()

    expect(await screen.findByRole('alert')).toHaveTextContent('Profile service unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByDisplayValue('Find your place with Aleph')).toBeTruthy()
  })

  it('uses RTL-safe navigation and mobile-first controls', async () => {
    document.documentElement.dir = 'rtl'
    renderSettings()
    await screen.findByDisplayValue('Find your place with Aleph')

    expect(screen.getByRole('link', { name: /Agency management/ }).querySelector('svg')?.getAttribute('class')).toContain('rtl:rotate-180')
    expect(screen.getByRole('button', { name: 'Save and publish' }).getAttribute('class')).toContain('min-h-tap')
  })
})

describe('PublicAgencyProfile visibility', () => {
  it('renders only enabled sections and keeps the contact action wired', async () => {
    render(
      <MemoryRouter>
        <PublicAgencyProfile agency={{
          id: 'agency-1',
          name: 'Aleph Realty',
          profile_settings: {
            ...SETTINGS,
            show_team: false,
            show_listings: false,
            show_reviews: false,
            show_closed_transactions: true,
            show_contact_form: true,
          },
          members: [],
          listings: [],
          reviews: [],
          closed_transactions: [{ id: 'tx-1', type: 'sale', closed_at: '2026-08-01' }],
        }} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: /Our team/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: /Listings/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Closed transactions' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sara' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sara@example.com' } })
    fireEvent.change(screen.getByLabelText('How can the agency help?'), { target: { value: 'I would like to discuss a listing.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }))
    await waitFor(() => expect(apiMock.createInquiry).toHaveBeenCalledWith(expect.objectContaining({
      agency_id: 'agency-1',
      source: 'public_agency_profile',
    })))
  })
})
