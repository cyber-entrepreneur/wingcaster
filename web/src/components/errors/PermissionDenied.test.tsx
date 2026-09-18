// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PermissionDenied } from './PermissionDenied'
import type { AccessRequest } from '@/api/client'

const apiMock = vi.hoisted(() => ({ requestAccess: vi.fn() }))
const localeMock = vi.hoisted(() => ({ locale: 'en' as 'en' | 'ar', dir: 'ltr' as 'ltr' | 'rtl' }))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => localeMock }))

function renderDenied(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function fakeRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: 'ar1',
    requester_id: 'u1',
    requester_name: 'U One',
    scope: 'platform',
    agency_id: null,
    resource_type: null,
    resource_id: null,
    area_label: 'Tenants',
    reason: null,
    status: 'open',
    created_at: '2026-09-18T20:00:00Z',
    updated_at: '2026-09-18T20:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  apiMock.requestAccess.mockReset()
  localeMock.locale = 'en'
  localeMock.dir = 'ltr'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PermissionDenied', () => {
  it('renders the default title, a reason, and a Go home link', () => {
    renderDenied(<PermissionDenied reason="This area is for platform admins." homeHref="/dashboard" />)
    expect(screen.getByTestId('permission-denied')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /don't have access/i })).toBeInTheDocument()
    expect(screen.getByText('This area is for platform admins.')).toBeInTheDocument()
    const home = screen.getByRole('link', { name: 'Go home' })
    expect(home).toHaveAttribute('href', '/dashboard')
  })

  it('does not show Request access when no target is provided', () => {
    renderDenied(<PermissionDenied />)
    expect(screen.queryByRole('button', { name: 'Request access' })).not.toBeInTheDocument()
  })

  it('files an access request and shows the submitted confirmation', async () => {
    apiMock.requestAccess.mockResolvedValue({ request: fakeRequest(), already_requested: false })
    renderDenied(<PermissionDenied requestAccess={{ scope: 'platform', area_label: 'Tenants' }} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Request access' }))

    expect(apiMock.requestAccess).toHaveBeenCalledWith({ scope: 'platform', area_label: 'Tenants' })
    await screen.findByText(/Access requested/i)
    expect(screen.queryByRole('button', { name: 'Request access' })).not.toBeInTheDocument()
  })

  it('shows the "already requested" copy when the backend reports a duplicate', async () => {
    apiMock.requestAccess.mockResolvedValue({ request: fakeRequest(), already_requested: true })
    renderDenied(<PermissionDenied requestAccess={{ scope: 'platform' }} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Request access' }))
    await screen.findByText(/already requested access/i)
  })

  it('surfaces an inline error and keeps the button when the request fails', async () => {
    apiMock.requestAccess.mockRejectedValue(new Error('boom'))
    renderDenied(<PermissionDenied requestAccess={{ scope: 'platform' }} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Request access' }))

    await screen.findByText(/Couldn't send the request/i)
    expect(screen.getByRole('button', { name: 'Request access' })).toBeInTheDocument()
  })

  it('disables the button while the request is in flight', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    apiMock.requestAccess.mockReturnValue(new Promise((r) => { resolveFn = r }))
    renderDenied(<PermissionDenied requestAccess={{ scope: 'platform' }} />)

    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'Request access' })
    await user.click(button)
    await waitFor(() => expect(screen.getByRole('button', { name: /Sending request/i })).toBeDisabled())

    resolveFn({ request: fakeRequest(), already_requested: false })
    await screen.findByText(/Access requested/i)
  })

  it('mirrors the document direction for RTL', () => {
    localeMock.locale = 'ar'
    localeMock.dir = 'rtl'
    renderDenied(<PermissionDenied />)
    expect(screen.getByTestId('permission-denied')).toHaveAttribute('dir', 'rtl')
  })
})
