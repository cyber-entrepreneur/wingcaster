// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { ExecutePreview } from './approvalTypes'

expect.extend(toHaveNoViolations)

const { apiMock, addToast } = vi.hoisted(() => ({
  apiMock: {
    getApprovalExecutePreview: vi.fn(),
    executeApproval: vi.fn(),
  },
  addToast: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock, API_BASE: '/api' }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en', isArabic: false, dir: 'ltr', setLocale: () => {} }),
}))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ addToast }) }))

import { TwoPersonExecuteModal } from './TwoPersonExecuteModal'

function standardPreview(overrides: Partial<ExecutePreview> = {}): ExecutePreview {
  return {
    request: {
      id: 'apr_1',
      last6: 'B7F3A2',
      version: 3,
      workflow_code: 'WF-08',
      workflow_label: 'Credit grant',
      submitted_at: '2026-09-08T09:14:11Z',
      submitted_by: { id: 'usr_sara', display_name: 'Sara Al Mansouri', initials: 'SM' },
      value_tier: 'standard',
      status: 'PENDING_APPROVAL',
      action_kind: 'CREDIT_GRANT',
    },
    action_summary: 'Grant 50,000 credits to Elite Real Estate Dubai',
    two_person: {
      requires_two_person: true,
      first_approver: {
        id: 'usr_sara',
        display_name: 'Sara Al Mansouri',
        initials: 'SM',
        signed_off_at: '2026-09-08T09:16:03Z',
      },
      second_approver_slot: { candidate_id: 'usr_pa', initials: 'AK' },
    },
    diff: [
      { field: 'Available credit balance', before: 'AED 12,000.00', after: 'AED 62,000.00', kind: 'money' },
    ],
    risk_signals: [{ severity: 'warn', label: 'Amount exceeds 90-day average by 3.2×', detail: null }],
    ledger_impact: {
      currency: 'AED',
      rows: [
        { account_code: '2110', account_label: 'Credit reserve', debit: null, credit: '50000.00' },
        { account_code: '5310', account_label: 'Promotional credit expense', debit: '50000.00', credit: null },
      ],
      totals: { debit: '50000.00', credit: '50000.00' },
      balanced: true,
    },
    confirmation_phrase: null,
    self_approval: false,
    step_up_required: false,
    outcome_url_template: '/admin/credits/tenants/x',
    env: 'live',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TwoPersonExecuteModal', () => {
  it('standard tier: consent gates the Confirm button; execute succeeds', async () => {
    apiMock.getApprovalExecutePreview.mockResolvedValue(standardPreview())
    apiMock.executeApproval.mockResolvedValue({
      ok: true,
      request_id: 'apr_1',
      executed_at: '2026-09-08T09:31:44Z',
      outcome_url: '/admin/credits/tenants/x',
      short_action_summary: 'Granted 50,000 AED credits',
    })
    const onExecuted = vi.fn()
    render(<TwoPersonExecuteModal requestId="apr_1" open onClose={() => {}} onExecuted={onExecuted} />)

    await screen.findByText('Grant 50,000 credits to Elite Real Estate Dubai')
    const confirm = screen.getByRole('button', { name: /confirm and execute/i })
    expect(confirm).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirm).toBeEnabled()

    fireEvent.click(confirm)
    await waitFor(() => expect(apiMock.executeApproval).toHaveBeenCalledTimes(1))
    expect(apiMock.executeApproval).toHaveBeenCalledWith(
      'apr_1',
      expect.objectContaining({ workflowCode: 'WF-08', version: 3, confirmationPhrase: undefined }),
    )
    expect(onExecuted).toHaveBeenCalled()
  })

  it('high-value tier: Confirm stays disabled until the phrase matches exactly', async () => {
    apiMock.getApprovalExecutePreview.mockResolvedValue(
      standardPreview({
        request: { ...standardPreview().request, value_tier: 'high_value' },
        confirmation_phrase: 'quiet-copper-lantern-drift',
      }),
    )
    render(<TwoPersonExecuteModal requestId="apr_1" open onClose={() => {}} />)

    await screen.findByText('Grant 50,000 credits to Elite Real Estate Dubai')
    fireEvent.click(screen.getByRole('checkbox'))
    const confirm = screen.getByRole('button', { name: /confirm and execute/i })
    expect(confirm).toBeDisabled()

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'wrong' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(input, { target: { value: 'quiet-copper-lantern-drift' } })
    expect(confirm).toBeEnabled()
  })

  it('renders the self-approval dead-end when the preview flags self_approval', async () => {
    apiMock.getApprovalExecutePreview.mockResolvedValue(standardPreview({ self_approval: true }))
    const onEscalate = vi.fn()
    render(<TwoPersonExecuteModal requestId="apr_1" open onClose={() => {}} onEscalate={onEscalate} />)

    await screen.findByText(/can't approve your own request/i)
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /assign to another approver/i }))
    expect(onEscalate).toHaveBeenCalledWith('apr_1')
  })

  it('swaps to the stale block on 409 PRECONDITION_FAILED', async () => {
    apiMock.getApprovalExecutePreview.mockResolvedValue(standardPreview())
    apiMock.executeApproval.mockRejectedValue(Object.assign(new Error('stale'), { error: 'PRECONDITION_FAILED' }))
    render(<TwoPersonExecuteModal requestId="apr_1" open onClose={() => {}} />)

    await screen.findByText('Grant 50,000 credits to Elite Real Estate Dubai')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /confirm and execute/i }))
    await screen.findByText(/this request has changed/i)
  })

  it('passes axe in the ready high-value state', async () => {
    apiMock.getApprovalExecutePreview.mockResolvedValue(
      standardPreview({
        request: { ...standardPreview().request, value_tier: 'high_value' },
        confirmation_phrase: 'quiet-copper-lantern-drift',
      }),
    )
    const { baseElement } = render(<TwoPersonExecuteModal requestId="apr_1" open onClose={() => {}} />)
    await screen.findByText('Grant 50,000 credits to Elite Real Estate Dubai')
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
