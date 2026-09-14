// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TypedConfirmDialog } from '@/components/listings/pro/TypedConfirmDialog'
import { TryProNudgeBanner } from '@/components/dashboard/TryProNudgeBanner'

const toast = vi.hoisted(() => ({ addToast: vi.fn() }))
const uiMode = vi.hoisted(() => ({
  mode: 'guided' as const,
  effectiveMode: 'guided' as const,
  isProCapable: true,
  setMode: vi.fn(async () => ({ ok: true as const, mode: 'pro' as const })),
}))
const api = vi.hoisted(() => ({
  getProNudge: vi.fn(),
  dismissProNudge: vi.fn(async () => ({ pro_nudge_dismissed_at: '2026-09-01T00:00:00.000Z' })),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => toast,
}))

vi.mock('@/hooks/useUiMode', () => ({
  useUiMode: () => uiMode,
}))

vi.mock('@/api/client', () => ({
  api,
  API_BASE: '/api',
}))

describe('TypedConfirmDialog', () => {
  it('keeps confirm disabled until phrase matches', async () => {
    const onConfirm = vi.fn()
    render(
      <TypedConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete 3 listings?"
        confirmPhrase="delete 3"
        onConfirm={onConfirm}
      />,
    )

    const submit = screen.getByTestId('typed-confirm-submit')
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByTestId('typed-confirm-input'), {
      target: { value: 'delete' },
    })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByTestId('typed-confirm-input'), {
      target: { value: 'delete 3' },
    })
    expect(submit).not.toBeDisabled()

    fireEvent.click(submit)
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
  })
})

describe('TryProNudgeBanner', () => {
  it('renders when eligible and dismisses with API call', async () => {
    api.getProNudge.mockResolvedValue({
      eligible: true,
      listing_count: 24,
      days_since_signup: 30,
      pro_nudge_dismissed_at: null,
      days_since_dismiss: null,
    })

    render(
      <MemoryRouter>
        <TryProNudgeBanner forceEligible />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('try-pro-nudge')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Dismiss Pro suggestion'))
    await waitFor(() => expect(api.dismissProNudge).toHaveBeenCalled())
    expect(screen.queryByTestId('try-pro-nudge')).not.toBeInTheDocument()
  })
})
