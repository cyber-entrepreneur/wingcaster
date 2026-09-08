// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EnvSwitcherPopover } from './EnvSwitcherPopover'
import { ENV_SWITCHER_COPY } from './EnvBadge'

describe('EnvSwitcherPopover', () => {
  it('opens on badge click and lists LIVE + TEST options', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<EnvSwitcherPopover env="live" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: ENV_SWITCHER_COPY['badge.aria.live'].en }))

    expect(await screen.findByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /LIVE/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /TEST/i })).toBeInTheDocument()
    expect(screen.getByText(ENV_SWITCHER_COPY['popover.footer.note'].en)).toBeInTheDocument()
  })

  it('selecting TEST calls onSelect(test) without requiring confirm', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<EnvSwitcherPopover env="live" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: ENV_SWITCHER_COPY['badge.aria.live'].en }))
    await user.click(screen.getByRole('radio', { name: /TEST/i }))

    expect(onSelect).toHaveBeenCalledWith('test')
  })

  it('selecting LIVE from TEST calls onSelect(live) for parent to open confirm', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<EnvSwitcherPopover env="test" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: ENV_SWITCHER_COPY['badge.aria.test'].en }))
    await user.click(screen.getByRole('radio', { name: /LIVE/i }))

    expect(onSelect).toHaveBeenCalledWith('live')
  })

  it('marks the active env with aria-checked', async () => {
    const user = userEvent.setup()
    render(<EnvSwitcherPopover env="test" onSelect={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: ENV_SWITCHER_COPY['badge.aria.test'].en }))

    const live = screen.getByRole('radio', { name: /LIVE/i })
    const test = screen.getByRole('radio', { name: /TEST/i })
    expect(live).toHaveAttribute('aria-checked', 'false')
    expect(test).toHaveAttribute('aria-checked', 'true')
  })
})
