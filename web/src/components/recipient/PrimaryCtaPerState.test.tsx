// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrimaryCtaPerState } from './PrimaryCtaPerState'

describe('PrimaryCtaPerState', () => {
  it('renders exactly one primary and opens confirm dialog for tertiary', async () => {
    const user = userEvent.setup()
    const onWithdraw = vi.fn()

    render(
      <PrimaryCtaPerState
        layout="stacked"
        primary={{ key: 'awaiting', label: 'Awaiting agency response', variant: 'default', disabled: true }}
        secondary={{ key: 'profile', label: 'View agency profile', variant: 'outline', onClick: vi.fn() }}
        tertiary={{
          key: 'withdraw',
          label: 'Withdraw application',
          variant: 'ghost',
          onClick: onWithdraw,
          confirm: {
            title: 'Withdraw your application?',
            body: 'You can re-apply anytime.',
            confirm_label: 'Withdraw',
            cancel_label: 'Keep application open',
          },
        }}
      />,
    )

    expect(screen.getByRole('button', { name: /Awaiting agency response/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Withdraw application/i }))
    expect(screen.getByRole('heading', { name: /Withdraw your application/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Withdraw$/i }))
    expect(onWithdraw).toHaveBeenCalledTimes(1)
  })

  it('never exposes a destructive variant', () => {
    const { container } = render(
      <PrimaryCtaPerState
        layout="inline"
        primary={{ key: 'p', label: 'Browse other agencies', variant: 'default', href: '/agencies' }}
        secondary={{ key: 's', label: 'Continue as solo agent', variant: 'outline', onClick: vi.fn() }}
      />,
    )
    expect(container.innerHTML).not.toMatch(/destructive/)
  })
})
