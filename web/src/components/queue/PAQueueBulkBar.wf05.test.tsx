// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PAQueueBulkBar } from '@/components/queue'

describe('PAQueueBulkBar actions filter (WF-05)', () => {
  it('hides Approve when actions omit approve (confirm-remove filtered out)', () => {
    render(
      <PAQueueBulkBar
        selectedCount={3}
        actions={['reject', 'request_info']}
        rejectLabel="Reject as invalid"
        requestInfoLabel="Request more info"
      />,
    )
    const bar = document.querySelector('[data-pa-queue-bulk-actions="reject,request_info"]')
    expect(bar).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Approve/i })).toBeNull()
    expect(screen.getByRole('button', { name: /Reject as invalid/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Request more info/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Confirm and remove/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Confirm and quarantine/i })).toBeNull()
  })

  it('still shows Approve by default for other PA queues', () => {
    render(<PAQueueBulkBar selectedCount={2} />)
    expect(screen.getByRole('button', { name: /Approve/i })).toBeTruthy()
  })
})
