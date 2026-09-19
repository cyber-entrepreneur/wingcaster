// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { SchedulePublishDialog } from './SchedulePublishDialog'

const apiMock = vi.hoisted(() => ({ createScheduledPublication: vi.fn() }))
vi.mock('@/api/client', () => ({ api: apiMock }))

function renderDialog(props: Partial<Parameters<typeof SchedulePublishDialog>[0]> = {}) {
  const onScheduled = vi.fn()
  const onClose = vi.fn()
  render(
    <ToastProvider>
      <SchedulePublishDialog
        propertyId="prop-1"
        portals={['property_finder']}
        onClose={onClose}
        onScheduled={onScheduled}
        {...props}
      />
    </ToastProvider>,
  )
  return { onScheduled, onClose }
}

function isoInLocal(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

beforeEach(() => {
  apiMock.createScheduledPublication.mockReset()
})

afterEach(() => cleanup())

describe('SchedulePublishDialog', () => {
  it('shows the agent timezone, AGT-PUB-007 marker, and defaults to a future time', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: /Schedule publish/i })).toHaveAttribute('data-screen', 'AGT-PUB-007')
    expect(screen.getByText(/Your timezone:/)).toBeInTheDocument()
    // Default is +1h → Schedule is enabled
    expect(screen.getByRole('button', { name: /^Schedule$/ })).not.toBeDisabled()
  })

  it('disables Schedule and warns for a past time', async () => {
    const user = userEvent.setup()
    renderDialog()
    const input = screen.getByLabelText(/Date & time/i)
    await user.clear(input)
    await user.type(input, isoInLocal(-3600_000)) // 1h ago
    expect(screen.getByText(/Pick a time in the future/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Schedule$/ })).toBeDisabled()
  })

  it('schedules a future publish with recurrence', async () => {
    const user = userEvent.setup()
    apiMock.createScheduledPublication.mockResolvedValue({ id: 's1', status: 'pending' })
    const { onScheduled } = renderDialog({ portals: ['pf', 'bayut'], message: 'hi' })

    await user.selectOptions(screen.getByLabelText(/Repeat/i), 'weekly')
    await user.click(screen.getByRole('button', { name: /^Schedule$/ }))

    await waitFor(() =>
      expect(apiMock.createScheduledPublication).toHaveBeenCalledWith(
        'prop-1',
        expect.objectContaining({ portals: ['pf', 'bayut'], recurrence: 'weekly', message: 'hi' }),
      ),
    )
    await waitFor(() => expect(onScheduled).toHaveBeenCalled())
  })
})
