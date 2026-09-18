// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AgencyManagementPage } from './AgencyManagementPage'

const { apiMock, addToast } = vi.hoisted(() => ({
  apiMock: {
    getMyAgency: vi.fn(),
    pauseMember: vi.fn(),
    resumeMember: vi.fn(),
    updateMember: vi.fn(),
    getTiedListings: vi.fn(),
  },
  addToast: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }) }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'me' }, loading: false }),
}))

function agencyFixture() {
  return {
    id: 'ag-1',
    name: 'Acme Realty',
    myRole: 'owner',
    members: [
      { id: 'm-owner', role: 'owner', status: 'active', user_id: 'me', user: { name: 'Me Owner', email: 'me@x.com' } },
      { id: 'm2', role: 'member', status: 'active', user_id: 'u2', user: { name: 'Active Ann', email: 'ann@x.com' } },
      { id: 'm3', role: 'agent', status: 'paused', pause_reason: 'On leave until August', user_id: 'u3', user: { name: 'Paused Pat', email: 'pat@x.com' } },
    ],
  }
}

async function openMembersTab() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AgencyManagementPage />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getByRole('tab', { name: /Members/i })).toBeInTheDocument())
  await user.click(screen.getByRole('tab', { name: /Members/i }))
  return user
}

beforeEach(() => {
  apiMock.getMyAgency.mockResolvedValue(agencyFixture())
  apiMock.pauseMember.mockResolvedValue({ ok: true })
  apiMock.resumeMember.mockResolvedValue({ ok: true })
})

afterEach(() => cleanup())

describe('AgencyManagementPage — pause / resume (AGN-MEM-008)', () => {
  it('shows a Paused badge and reason for a paused member', async () => {
    await openMembersTab()
    await waitFor(() => expect(screen.getByText('Paused Pat')).toBeInTheDocument())
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText(/Paused: On leave until August/i)).toBeInTheDocument()
  })

  it('does not offer a pause control for the owner or for yourself', async () => {
    await openMembersTab()
    await waitFor(() => expect(screen.getByText('Me Owner')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Pause Me Owner/i })).not.toBeInTheDocument()
  })

  it('resumes a paused member', async () => {
    const user = await openMembersTab()
    await waitFor(() => expect(screen.getByText('Paused Pat')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^Resume$/i }))
    await waitFor(() => expect(apiMock.resumeMember).toHaveBeenCalledWith('ag-1', 'm3'))
  })

  it('pauses an active member with a required reason', async () => {
    const user = await openMembersTab()
    await waitFor(() => expect(screen.getByText('Active Ann')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Pause Active Ann/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /Pause member/i })).toBeDisabled()

    const reason = within(dialog).getByPlaceholderText(/On leave until August|under review/i)
    fireEvent.change(reason, { target: { value: 'Vacation cover' } })
    await waitFor(() => expect(screen.getByRole('button', { name: /Pause member/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /Pause member/i }))

    await waitFor(() => expect(apiMock.pauseMember).toHaveBeenCalledWith('ag-1', 'm2', 'Vacation cover'))
  })
})
