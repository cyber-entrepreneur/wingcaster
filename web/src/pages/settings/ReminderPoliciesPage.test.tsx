// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import type { ReminderPolicy } from '@/api/client'

const apiMocks = vi.hoisted(() => ({
  getReminderPolicies: vi.fn(),
  createReminderPolicy: vi.fn(),
  updateReminderPolicy: vi.fn(),
  deleteReminderPolicy: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMocks }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { ReminderPoliciesPage } from './ReminderPoliciesPage'

const samplePolicy: ReminderPolicy = {
  id: 'pol-1',
  name: 'Viewing reminders',
  owner_type: 'agent',
  owner_id: 'agent-1',
  appointment_type: 'viewing',
  rules: [{ offset_minutes: 60, channels: ['inapp'], active: true }],
}

function renderPage() {
  return render(
    <ToastProvider>
      <ReminderPoliciesPage />
    </ToastProvider>,
  )
}

beforeEach(() => {
  apiMocks.getReminderPolicies.mockReset()
  apiMocks.createReminderPolicy.mockReset()
  apiMocks.updateReminderPolicy.mockReset()
  apiMocks.deleteReminderPolicy.mockReset()
  apiMocks.getReminderPolicies.mockResolvedValue([samplePolicy])
  apiMocks.createReminderPolicy.mockResolvedValue(samplePolicy)
  apiMocks.deleteReminderPolicy.mockResolvedValue({ success: true })
})

afterEach(() => cleanup())

describe('ReminderPoliciesPage', () => {
  it('loads and lists policies', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Viewing reminders')).toBeInTheDocument()
    })
  })

  it('shows empty state', async () => {
    apiMocks.getReminderPolicies.mockResolvedValue([])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/No reminder policies yet/i)).toBeInTheDocument()
    })
  })

  it('shows error retry', async () => {
    apiMocks.getReminderPolicies.mockRejectedValue(new Error('Network down'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
    })
  })

  it('opens create dialog and saves', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Viewing reminders')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Add policy/i }))
    await user.type(screen.getByLabelText(/Name/i), 'Call follow-up')
    await user.click(screen.getByRole('button', { name: /Save policy/i }))
    await waitFor(() => {
      expect(apiMocks.createReminderPolicy).toHaveBeenCalled()
    })
  })

  it('deletes a policy', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Viewing reminders')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Delete/i }))
    await waitFor(() => {
      expect(apiMocks.deleteReminderPolicy).toHaveBeenCalledWith('pol-1')
    })
  })
})

describe('ReminderPoliciesPage RTL', () => {
  it('avoids physical left/right utility classes', async () => {
    const { container } = render(
      <ToastProvider>
        <div dir="rtl">
          <ReminderPoliciesPage />
        </div>
      </ToastProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('Reminder policies')).toBeInTheDocument()
    })
    expect(container.innerHTML).not.toMatch(/\bml-\d|\bmr-\d|\bpl-\d|\bpr-\d|\btext-left|\btext-right\b/)
  })
})
