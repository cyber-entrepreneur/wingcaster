// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ApprovalAuditPanel } from './ApprovalAuditPanel'
import type { ApprovalAuditTrail } from './approvalTypes'

expect.extend(toHaveNoViolations)

const apiMock = vi.hoisted(() => ({
  getApprovalAuditTrail: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

const trail: ApprovalAuditTrail = {
  request: {
    id: '00000000-0000-0000-0000-000000000123',
    tenant_id: null,
    action_kind: 'PACKAGE_PUBLISH',
    status: 'REQUESTED',
    workflow_code: 'WF-07',
    value_tier: 'elevated',
    min_distinct_approvers: 2,
    created_at: '2026-09-18T10:00:00.000Z',
    updated_at: '2026-09-18T10:05:00.000Z',
    payload_hash: 'abc123def456abc123def456',
    payload: { package: 'Growth' },
  },
  events: [
    {
      id: 'submitted',
      type: 'SUBMITTED',
      status: 'info',
      occurred_at: '2026-09-18T10:00:00.000Z',
      actor: { type: 'USER', id: '00000000-0000-0000-0000-000000000321', email: null },
      reason_code: null,
      target_type: 'approval_request',
      target_id: '00000000-0000-0000-0000-000000000123',
      before_state: null,
      after_state: null,
      payload_snapshot: { package: 'Growth', monthly_price_minor: 24900 },
      integrity_hash: 'abc123def456abc123def456',
    },
    {
      id: 'approved',
      type: 'APPROVED',
      status: 'success',
      occurred_at: '2026-09-18T10:05:00.000Z',
      actor: { type: 'USER', id: null, email: 'reviewer@example.test' },
      reason_code: 'PEER_REVIEW',
      target_type: 'approval_request',
      target_id: '00000000-0000-0000-0000-000000000123',
      before_state: { status: 'REQUESTED' },
      after_state: { status: 'APPROVED' },
      payload_snapshot: null,
      integrity_hash: 'def456abc123def456abc123',
    },
  ],
}

beforeEach(() => {
  apiMock.getApprovalAuditTrail.mockResolvedValue(trail)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('ApprovalAuditPanel (PA-APR-004)', () => {
  it('renders immutable events, actors, payload snapshots, and integrity metadata', async () => {
    render(<ApprovalAuditPanel requestId={trail.request.id} />)

    expect(await screen.findByText('Approval audit trail')).toBeTruthy()
    expect(screen.getByText('Submitted')).toBeTruthy()
    expect(screen.getByText('Approved')).toBeTruthy()
    expect(screen.getByText('Submitted payload')).toBeTruthy()
    expect(screen.getByText(/Reason: Peer Review/i)).toBeTruthy()
    expect(document.querySelectorAll('[data-lc-numeric]').length).toBeGreaterThan(0)
  })

  it('shows an empty state when no immutable events exist', async () => {
    apiMock.getApprovalAuditTrail.mockResolvedValueOnce({ ...trail, events: [] })
    render(<ApprovalAuditPanel requestId={trail.request.id} />)

    expect(await screen.findByText('No audit events have been recorded.')).toBeTruthy()
  })

  it('surfaces load failure and retries', async () => {
    apiMock.getApprovalAuditTrail.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(trail)
    render(<ApprovalAuditPanel requestId={trail.request.id} />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }))
    expect(await screen.findByText('Submitted')).toBeTruthy()
    expect(apiMock.getApprovalAuditTrail).toHaveBeenCalledTimes(2)
  })

  it('opens the browser print dialog for PDF export', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<ApprovalAuditPanel requestId={trail.request.id} />)

    fireEvent.click(await screen.findByRole('button', { name: /Export PDF/i }))
    expect(print).toHaveBeenCalledOnce()
  })

  it('is accessible and RTL-safe at the component boundary', async () => {
    const { container } = render(
      <div dir="rtl">
        <ApprovalAuditPanel requestId={trail.request.id} />
      </div>,
    )

    await screen.findByText('Submitted')
    expect(await axe(container)).toHaveNoViolations()
  })
})
