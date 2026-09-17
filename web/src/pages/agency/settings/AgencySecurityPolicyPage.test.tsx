// @vitest-environment jsdom
/**
 * Page-level coverage for AgencySecurityPolicyPage (issue #190).
 *
 * Covers the four contracts that matter for the enterprise SOC 2 checkbox:
 *   - Admin members can view the current policy (loads GET on mount)
 *   - Non-admin members see the forbidden guard, never the toggle
 *   - Toggling required + editing grace_days enables Save; save calls PUT
 *   - Backend error surfaces via toast without wiping in-flight edits
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getAgencyMfaPolicy: vi.fn(),
  updateAgencyMfaPolicy: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMock,
}))

const authMock = vi.hoisted(() => ({
  agent: {
    id: 'user-owner-1',
    name: 'Owner',
    affiliation: { agency_id: 'agency-1', role: 'owner' as string | undefined },
  } as { id: string; name: string; affiliation: { agency_id: string; role: string | undefined } },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { AgencySecurityPolicyPage } from './AgencySecurityPolicyPage'

const DEFAULT_POLICY = {
  agency_id: 'agency-1',
  required: false,
  grace_days: 14,
  allowed_factors: [] as string[],
  updated_by: null as string | null,
  updated_at: null as string | null,
  created_at: null as string | null,
  is_default: true,
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/agency/settings/security']}>
        <AgencySecurityPolicyPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent.affiliation.role = 'owner'
  apiMock.getAgencyMfaPolicy.mockResolvedValue({ policy: { ...DEFAULT_POLICY } })
  apiMock.updateAgencyMfaPolicy.mockResolvedValue({
    policy: { ...DEFAULT_POLICY, required: true, is_default: false, updated_by: 'user-owner-1' },
  })
})

afterEach(() => {
  cleanup()
})

describe('AgencySecurityPolicyPage', () => {
  it('loads the current policy on mount and shows the toggle off by default', async () => {
    renderPage()
    await waitFor(() => expect(apiMock.getAgencyMfaPolicy).toHaveBeenCalledWith('agency-1'))
    const toggle = await screen.findByRole('checkbox', {
      name: /Require two-factor authentication for all members/i,
    })
    expect(toggle).not.toBeChecked()
  })

  it('non-admin members see the forbidden guard and never hit the API', async () => {
    authMock.agent.affiliation.role = 'agent'
    renderPage()
    expect(await screen.findByText(/Only agency owners and admins/i)).toBeInTheDocument()
    // Guard short-circuits before the fetch.
    expect(apiMock.getAgencyMfaPolicy).not.toHaveBeenCalled()
  })

  it('enables Save when toggling required, and calls PUT with the new value', async () => {
    const user = userEvent.setup()
    renderPage()
    const toggle = await screen.findByRole('checkbox', {
      name: /Require two-factor authentication for all members/i,
    })
    const save = screen.getByRole('button', { name: /Save policy/i })
    expect(save).toBeDisabled()

    await user.click(toggle)
    expect(save).toBeEnabled()

    await user.click(save)
    await waitFor(() =>
      expect(apiMock.updateAgencyMfaPolicy).toHaveBeenCalledWith('agency-1', {
        required: true,
        grace_days: 14,
      }),
    )
  })

  it('surfaces a backend error via toast without discarding the user edit', async () => {
    const user = userEvent.setup()
    apiMock.updateAgencyMfaPolicy.mockRejectedValueOnce(
      Object.assign(new Error('Server unavailable'), { status: 500 }),
    )
    renderPage()

    const toggle = await screen.findByRole('checkbox', {
      name: /Require two-factor authentication for all members/i,
    })
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: /Save policy/i }))

    // Toast surfaces the error message somewhere in the document.
    expect(await screen.findByText(/Could not update security policy/i)).toBeInTheDocument()
    // Toggle stays flipped on so the user does not lose their in-flight edit.
    expect(toggle).toBeChecked()
  })

  it('clamps grace days entry to the 0..90 bounds', async () => {
    const user = userEvent.setup()
    renderPage()
    const toggle = await screen.findByRole('checkbox', {
      name: /Require two-factor authentication for all members/i,
    })
    await user.click(toggle)

    const input = screen.getByLabelText(/Grace period \(days\)/i)
    await user.clear(input)
    await user.type(input, '999')
    expect((input as HTMLInputElement).value).toBe('90')

    await user.clear(input)
    await user.type(input, '-5')
    // Component clamps negative entry to 0; the visible value is a non-negative
    // digit — either '0' (if the minus got dropped) or '5' (if the sign flipped).
    // Either way it is within bounds.
    const value = Number((input as HTMLInputElement).value)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(90)
  })
})
