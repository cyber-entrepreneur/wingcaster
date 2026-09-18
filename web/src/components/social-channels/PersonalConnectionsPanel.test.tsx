// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { PersonalChannelConnection } from '@/api/client'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  listPersonalChannelConnections: vi.fn(),
  createPersonalChannelConnection: vi.fn(),
  updatePersonalChannelConnection: vi.fn(),
  removePersonalChannelConnection: vi.fn(),
}))
const stepUpMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/components/mfa', () => ({
  useStepUp: () => ({ requireStepUp: stepUpMock }),
}))

import { PersonalConnectionsPanel } from './PersonalConnectionsPanel'

const CONNECTIONS: PersonalChannelConnection[] = [
  {
    id: 'ig-business',
    platform: 'instagram',
    account_name: 'Business profile',
    handle: '@business',
    is_primary: true,
    status: 'connected',
    health: 'healthy',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ig-personal',
    platform: 'instagram',
    account_name: 'Personal profile',
    handle: '@personal',
    is_primary: false,
    status: 'connected',
    health: 'healthy',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'x-personal',
    platform: 'x',
    account_name: 'Personal X',
    handle: '@personalx',
    is_primary: true,
    status: 'connected',
    health: 'healthy',
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
  },
]

function renderPanel({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' } = {}) {
  return render(
    <div dir={dir}>
      <ToastProvider>
        <MemoryRouter>
          <PersonalConnectionsPanel />
        </MemoryRouter>
      </ToastProvider>
    </div>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.listPersonalChannelConnections.mockResolvedValue({ connections: CONNECTIONS })
  apiMock.createPersonalChannelConnection.mockResolvedValue(CONNECTIONS[1])
  apiMock.updatePersonalChannelConnection.mockResolvedValue({
    ...CONNECTIONS[1],
    is_primary: true,
  })
  apiMock.removePersonalChannelConnection.mockResolvedValue({
    success: true,
    new_primary_id: 'ig-personal',
  })
  stepUpMock.mockResolvedValue({ elevatedToken: 'elevated' })
})

afterEach(() => {
  cleanup()
})

describe('PersonalConnectionsPanel', () => {
  it('groups multiple accounts by channel and identifies the primary', async () => {
    renderPanel()

    expect(await screen.findByText('Business profile')).toBeInTheDocument()
    expect(screen.getByText('Personal profile')).toBeInTheDocument()
    expect(screen.getByText('Personal X')).toBeInTheDocument()
    expect(screen.getAllByText('Primary')).toHaveLength(2)
    expect(screen.getByText('3')).toHaveAttribute('data-lc-numeric')
  })

  it('renders the empty state', async () => {
    apiMock.listPersonalChannelConnections.mockResolvedValue({ connections: [] })
    renderPanel()

    expect(await screen.findByText('No personal accounts yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add your first account' })).toBeInTheDocument()
  })

  it('renders an error and retries loading', async () => {
    const user = userEvent.setup()
    apiMock.listPersonalChannelConnections
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ connections: CONNECTIONS })
    renderPanel()

    expect(await screen.findByText('Accounts are unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Business profile')).toBeInTheDocument()
  })

  it('validates and adds an account behind step-up', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Business profile')
    await user.click(screen.getByRole('button', { name: 'Add account' }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add account' }))
    expect(within(dialog).getByText('Enter an account name and handle.')).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText('Channel'), 'linkedin')
    await user.type(within(dialog).getByLabelText('Account name'), 'Founder profile')
    await user.type(within(dialog).getByLabelText('Handle or username'), '@founder')
    await user.click(within(dialog).getByRole('button', { name: 'Add account' }))

    await waitFor(() =>
      expect(apiMock.createPersonalChannelConnection).toHaveBeenCalledWith({
        platform: 'linkedin',
        account_name: 'Founder profile',
        handle: '@founder',
      }),
    )
    expect(stepUpMock).toHaveBeenCalled()
  })

  it('sets a non-primary account as primary', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Personal profile')

    await user.click(screen.getByRole('button', { name: 'Set primary' }))

    await waitFor(() =>
      expect(apiMock.updatePersonalChannelConnection).toHaveBeenCalledWith('ig-personal', {
        is_primary: true,
      }),
    )
    expect(stepUpMock).toHaveBeenCalled()
    expect(screen.getAllByText('Primary')).toHaveLength(2)
  })

  it('removes an account only after confirmation and step-up', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Business profile')

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Remove Business profile?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Remove account' }))

    await waitFor(() => expect(apiMock.removePersonalChannelConnection).toHaveBeenCalledWith('ig-business'))
    expect(stepUpMock).toHaveBeenCalled()
  })

  it('keeps the mobile shell RTL-safe without horizontal overflow', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    renderPanel({ dir: 'rtl' })
    await screen.findByText('Business profile')

    expect(screen.getByTestId('personal-connections-panel')).not.toHaveClass('overflow-x-auto')
    expect(screen.getByRole('button', { name: 'Add account' })).toHaveClass('w-full')
  })
})
