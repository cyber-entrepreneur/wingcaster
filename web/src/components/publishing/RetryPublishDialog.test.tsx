// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { RetryPublishDialog, type RetryPublishDialogTarget } from './RetryPublishDialog'
import type { PublishingDestination } from '@/api/client'

const apiMock = vi.hoisted(() => ({
  getProperty: vi.fn(),
  updateProperty: vi.fn(),
  retryPublishingDestination: vi.fn(),
  retryDistribution: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

function destination(over: Partial<PublishingDestination> = {}): PublishingDestination {
  return {
    id: 'dest-1',
    portal: { code: 'bayut', display_name: 'Bayut', logo_url: null, country_code: 'AE', all_country_codes: ['AE'] },
    status: 'failed',
    error_class: 'PORTAL_RULES_VIOLATION',
    portal_message: 'At least 3 photos required',
    credit_charged: 0,
    credit_reserved: 0,
    event_at: '2026-09-18T12:00:00Z',
    live_url: null,
    retry_available: true,
    fix_deep_link: null,
    moderation_queue_deep_link: null,
    correlation_id: null,
    timeline: [],
    ...over,
  }
}

function renderDialog(
  target: RetryPublishDialogTarget | null,
  props: Partial<Parameters<typeof RetryPublishDialog>[0]> = {},
) {
  const onClose = vi.fn()
  const onRetried = vi.fn()
  render(
    <ToastProvider>
      <RetryPublishDialog open={Boolean(target)} target={target} onClose={onClose} onRetried={onRetried} {...props} />
    </ToastProvider>,
  )
  return { onClose, onRetried }
}

beforeEach(() => {
  apiMock.getProperty.mockReset().mockResolvedValue({ title: 'Villa', description: 'Sea view' })
  apiMock.updateProperty.mockReset().mockResolvedValue({})
  apiMock.retryPublishingDestination.mockReset().mockResolvedValue({
    destination: destination({ status: 'in_review' }),
    job: null,
    destinations: [],
  })
  apiMock.retryDistribution.mockReset().mockResolvedValue({ id: 'dist-1', status: 'published' })
})

afterEach(() => cleanup())

describe('RetryPublishDialog (AGT-PUB-004)', () => {
  it('renders failure banner for a portal destination', async () => {
    renderDialog({
      kind: 'destination',
      jobId: 'job-1',
      listingId: 'prop-1',
      destination: destination(),
    })
    expect(screen.getByTestId('retry-publish-dialog')).toBeInTheDocument()
    expect(screen.getByText(/At least 3 photos required/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/Listing title/i)).toHaveValue('Villa'))
  })

  it('saves listing edits then retries the destination', async () => {
    const user = userEvent.setup()
    const { onRetried, onClose } = renderDialog({
      kind: 'destination',
      jobId: 'job-1',
      listingId: 'prop-1',
      destination: destination(),
    })

    await waitFor(() => expect(screen.getByLabelText(/Listing title/i)).toBeInTheDocument())
    const titleInput = screen.getByLabelText(/Listing title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated villa')
    await user.click(screen.getByTestId('retry-publish-submit'))

    await waitFor(() =>
      expect(apiMock.updateProperty).toHaveBeenCalledWith('prop-1', {
        title: 'Updated villa',
        description: 'Sea view',
      }),
    )
    expect(apiMock.retryPublishingDestination).toHaveBeenCalledWith('job-1', 'dest-1')
    expect(onRetried).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('retries a failed social distribution', async () => {
    const user = userEvent.setup()
    renderDialog({
      kind: 'distribution',
      listingId: 'prop-1',
      distributionId: 'dist-9',
      platform: 'instagram',
      errorMessage: 'Token expired',
    })

    expect(screen.getByText(/Token expired/)).toBeInTheDocument()
    await user.click(screen.getByTestId('retry-publish-submit'))
    await waitFor(() => expect(apiMock.retryDistribution).toHaveBeenCalledWith('dist-9'))
  })
})
