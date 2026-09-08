// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { EnvWarningStrip } from './EnvWarningStrip'
import { ENV_SWITCHER_COPY } from './EnvBadge'

expect.extend(toHaveNoViolations)

describe('EnvWarningStrip', () => {
  it('announces TEST warning via status + aria-live polite', () => {
    render(<EnvWarningStrip onSwitchToLive={vi.fn()} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(ENV_SWITCHER_COPY['strip.warning.text'].en)
  })

  it('Switch to LIVE link calls onSwitchToLive (confirm path), never switches directly', async () => {
    const user = userEvent.setup()
    const onSwitchToLive = vi.fn()
    render(<EnvWarningStrip onSwitchToLive={onSwitchToLive} />)

    await user.click(screen.getByRole('button', { name: ENV_SWITCHER_COPY['strip.warning.link'].en }))
    expect(onSwitchToLive).toHaveBeenCalledTimes(1)
  })

  it('uses warning fill token class', () => {
    const { container } = render(<EnvWarningStrip onSwitchToLive={vi.fn()} />)
    expect(container.firstChild).toHaveClass('bg-[var(--lc-status-underOffer-dot)]')
  })

  it('meets a11y smoke', async () => {
    const { container } = render(<EnvWarningStrip onSwitchToLive={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
