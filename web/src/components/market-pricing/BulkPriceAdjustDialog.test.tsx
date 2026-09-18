// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { BulkPriceAdjustDialog } from './BulkPriceAdjustDialog'
import type { BulkAdjustmentPreview } from '@/types/marketPricing'

const apiMock = vi.hoisted(() => ({
  previewBulkPriceAdjustment: vi.fn(),
  applyBulkPriceAdjustment: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

const SELECTION = [
  { id: 'p1', title: 'Marina Villa', price: 100000, currency: 'USD', agent_name: 'Agent One' },
  { id: 'p2', title: 'Downtown Flat', price: 200000, currency: 'USD', agent_name: 'Agent Two' },
]

function previewFixture(overrides: Partial<BulkAdjustmentPreview> = {}): BulkAdjustmentPreview {
  return {
    items: [
      { property_id: 'p1', title: 'Marina Villa', agent_id: 'a1', agent_name: 'Agent One', currency: 'USD', old_price: 100000, new_price: 95000, delta: -5000, delta_percent: -5, skipped: false, skip_reason: null },
      { property_id: 'p2', title: 'Downtown Flat', agent_id: 'a2', agent_name: 'Agent Two', currency: 'USD', old_price: 200000, new_price: 190000, delta: -10000, delta_percent: -5, skipped: false, skip_reason: null },
    ],
    summary: { selected_count: 2, changing_count: 2, skipped_count: 0, total_value_before: 300000, total_value_after: 285000, aggregate_delta_percent: 5 },
    safety: { exceeds_cap: false, cap_reasons: [], max_listings: 100, max_aggregate_change_percent: 50 },
    confirm_phrase: 'I have reviewed all 2 changes',
    ...overrides,
  }
}

function renderDialog(props: Partial<Parameters<typeof BulkPriceAdjustDialog>[0]> = {}, dir: 'ltr' | 'rtl' = 'ltr') {
  const onApplied = vi.fn()
  const onOpenChange = vi.fn()
  const utils = render(
    <div dir={dir}>
      <ToastProvider>
        <BulkPriceAdjustDialog open onOpenChange={onOpenChange} selection={SELECTION} onApplied={onApplied} {...props} />
      </ToastProvider>
    </div>,
  )
  return { onApplied, onOpenChange, ...utils }
}

beforeEach(() => {
  apiMock.previewBulkPriceAdjustment.mockReset()
  apiMock.applyBulkPriceAdjustment.mockReset()
})

afterEach(() => cleanup())

describe('BulkPriceAdjustDialog', () => {
  it('shows the selection summary before previewing', () => {
    renderDialog()
    expect(screen.getByText('Selected listings')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Preview changes/i })).toBeInTheDocument()
  })

  it('previews then requires the exact confirmation phrase to apply', async () => {
    const user = userEvent.setup()
    apiMock.previewBulkPriceAdjustment.mockResolvedValue(previewFixture())
    apiMock.applyBulkPriceAdjustment.mockResolvedValue({ batch: { id: 'b1', listing_count: 2 }, preview: previewFixture() })
    const { onApplied } = renderDialog()

    await user.click(screen.getByRole('button', { name: /Preview changes/i }))

    await waitFor(() => expect(screen.getByTestId('bulk-confirm-input')).toBeInTheDocument())
    expect(screen.getByText('Marina Villa')).toBeInTheDocument()

    const applyBtn = screen.getByTestId('bulk-apply-submit')
    expect(applyBtn).toBeDisabled()

    await user.type(screen.getByTestId('bulk-confirm-input'), 'I have reviewed all 2 changes')
    expect(applyBtn).not.toBeDisabled()

    await user.click(applyBtn)
    await waitFor(() => expect(apiMock.applyBulkPriceAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        property_ids: ['p1', 'p2'],
        strategy: 'percent_down',
        confirm_phrase: 'I have reviewed all 2 changes',
        reversal_window_hours: 24,
      }),
    ))
    await waitFor(() => expect(onApplied).toHaveBeenCalled())
  })

  it('blocks apply when the batch exceeds safety limits', async () => {
    const user = userEvent.setup()
    apiMock.previewBulkPriceAdjustment.mockResolvedValue(previewFixture({
      safety: { exceeds_cap: true, cap_reasons: ['aggregate_change_too_large'], max_listings: 100, max_aggregate_change_percent: 50 },
    }))
    renderDialog()

    await user.click(screen.getByRole('button', { name: /Preview changes/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/needs a second approver/i)).toBeInTheDocument()
    expect(screen.getByTestId('bulk-apply-submit')).toBeDisabled()
    expect(screen.queryByTestId('bulk-confirm-input')).not.toBeInTheDocument()
  })

  it('surfaces a no-changes state', async () => {
    const user = userEvent.setup()
    apiMock.previewBulkPriceAdjustment.mockResolvedValue(previewFixture({
      items: [{ property_id: 'p1', title: 'Marina Villa', agent_id: 'a1', agent_name: 'Agent One', currency: 'USD', old_price: 100000, new_price: null, delta: null, delta_percent: null, skipped: true, skip_reason: 'no_change' }],
      summary: { selected_count: 1, changing_count: 0, skipped_count: 1, total_value_before: 0, total_value_after: 0, aggregate_delta_percent: 0 },
      confirm_phrase: 'I have reviewed all 0 changes',
    }))
    renderDialog()

    await user.click(screen.getByRole('button', { name: /Preview changes/i }))
    await waitFor(() => expect(screen.getByText(/No listings would change/i)).toBeInTheDocument())
    expect(screen.getByTestId('bulk-apply-submit')).toBeDisabled()
  })

  it('renders correctly under RTL', async () => {
    const user = userEvent.setup()
    apiMock.previewBulkPriceAdjustment.mockResolvedValue(previewFixture())
    renderDialog({}, 'rtl')
    await user.click(screen.getByRole('button', { name: /Preview changes/i }))
    await waitFor(() => expect(screen.getByTestId('bulk-price-adjust-dialog')).toBeInTheDocument())
    const table = within(screen.getByTestId('bulk-price-adjust-dialog')).getByRole('table')
    expect(table).toBeInTheDocument()
  })
})
