// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromoteDistributeModal } from './PromoteDistributeModal'

const apiMock = vi.hoisted(() => ({
  distributeOwn: vi.fn(),
  submitToFi: vi.fn(),
  createScheduledPublication: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

const property = {
  id: 'prop-1',
  title: 'Marina Gate 1',
  city: 'Dubai',
  price: 1200000,
}

const platforms = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'facebook', name: 'Facebook' },
]

const myConnections = [
  { platform: 'instagram', status: 'connected', account_name: '@agency' },
]

function renderModal(mode: 'promote' | 'distribute' = 'promote') {
  const onClose = vi.fn()
  const onDone = vi.fn()
  render(
    <PromoteDistributeModal
      open
      mode={mode}
      property={property}
      platforms={platforms}
      myConnections={myConnections}
      fiAccounts={[]}
      whatsappRecipient=""
      onClose={onClose}
      onDone={onDone}
    />,
  )
  return { onClose, onDone }
}

beforeEach(() => {
  for (const fn of Object.values(apiMock)) fn.mockReset()
  apiMock.distributeOwn.mockResolvedValue([{ platform: 'instagram', status: 'published' }])
  apiMock.createScheduledPublication.mockResolvedValue({ id: 'sched-1', status: 'pending' })
})

afterEach(() => cleanup())

describe('PromoteDistributeModal (AGT-PUB-002 / AGT-PUB-007)', () => {
  it('shows Schedule for later when own social channels are selected', async () => {
    const user = userEvent.setup()
    renderModal()
    expect(screen.queryByTestId('promote-schedule-cta')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Instagram/i }))
    expect(screen.getByTestId('promote-schedule-cta')).toBeInTheDocument()
  })

  it('opens AGT-PUB-007 schedule dialog and schedules selected channels', async () => {
    const user = userEvent.setup()
    const { onClose, onDone } = renderModal()
    await user.click(screen.getByRole('button', { name: /Instagram/i }))
    await user.click(screen.getByTestId('promote-schedule-cta'))

    expect(screen.getByRole('dialog', { name: /Schedule publish/i })).toHaveAttribute('data-screen', 'AGT-PUB-007')
    await user.click(screen.getByRole('button', { name: /^Schedule$/ }))

    await waitFor(() => {
      expect(apiMock.createScheduledPublication).toHaveBeenCalledWith(
        'prop-1',
        expect.objectContaining({ portals: ['instagram'] }),
      )
    })
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
