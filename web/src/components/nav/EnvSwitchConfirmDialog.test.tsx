// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import {
  EnvSwitchConfirmDialog,
  isLiveSwitchConfirmReady,
} from './EnvSwitchConfirmDialog'
import { ENV_SWITCHER_COPY } from './EnvBadge'
import { LIVE_SWITCH_CONFIRM_TOKEN } from '@/hooks/useEnv'

expect.extend(toHaveNoViolations)

describe('isLiveSwitchConfirmReady', () => {
  it('requires both checkboxes and exact SWITCH TO LIVE token', () => {
    expect(
      isLiveSwitchConfirmReady({ check1: true, check2: true, typed: LIVE_SWITCH_CONFIRM_TOKEN }),
    ).toBe(true)
    expect(
      isLiveSwitchConfirmReady({ check1: false, check2: true, typed: LIVE_SWITCH_CONFIRM_TOKEN }),
    ).toBe(false)
    expect(
      isLiveSwitchConfirmReady({ check1: true, check2: false, typed: LIVE_SWITCH_CONFIRM_TOKEN }),
    ).toBe(false)
    expect(isLiveSwitchConfirmReady({ check1: true, check2: true, typed: 'switch to live' })).toBe(
      false,
    )
    expect(isLiveSwitchConfirmReady({ check1: true, check2: true, typed: 'SWITCH TO LIVE ' })).toBe(
      false,
    )
    expect(isLiveSwitchConfirmReady({ check1: true, check2: true, typed: 'SWITCH TO LIVE' })).toBe(
      true,
    )
  })
})

describe('EnvSwitchConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps CTA disabled until both checks and exact type-to-confirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <EnvSwitchConfirmDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} />,
    )

    const cta = screen.getByRole('button', { name: ENV_SWITCHER_COPY['confirm.cta'].en })
    expect(cta).toBeDisabled()

    await user.click(screen.getByLabelText(ENV_SWITCHER_COPY['confirm.check1'].en))
    expect(cta).toBeDisabled()

    await user.click(screen.getByLabelText(ENV_SWITCHER_COPY['confirm.check2'].en))
    expect(cta).toBeDisabled()

    await user.type(
      screen.getByLabelText(ENV_SWITCHER_COPY['confirm.type.label'].en),
      'switch to live',
    )
    expect(cta).toBeDisabled()

    await user.clear(screen.getByLabelText(ENV_SWITCHER_COPY['confirm.type.label'].en))
    await user.type(
      screen.getByLabelText(ENV_SWITCHER_COPY['confirm.type.label'].en),
      LIVE_SWITCH_CONFIRM_TOKEN,
    )
    expect(cta).toBeEnabled()

    await user.click(cta)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm when token mismatches', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <EnvSwitchConfirmDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} />,
    )

    await user.click(screen.getByLabelText(ENV_SWITCHER_COPY['confirm.check1'].en))
    await user.click(screen.getByLabelText(ENV_SWITCHER_COPY['confirm.check2'].en))
    await user.type(
      screen.getByLabelText(ENV_SWITCHER_COPY['confirm.type.label'].en),
      'SWITCH TO TEST',
    )

    const cta = screen.getByRole('button', { name: ENV_SWITCHER_COPY['confirm.cta'].en })
    expect(cta).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Escape closes without confirming when not switching', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()
    render(
      <EnvSwitchConfirmDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />,
    )

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('blocks Escape close while switching', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <EnvSwitchConfirmDialog
        open
        switching
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />,
    )

    await user.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('uses alertdialog role and visible type label', () => {
    render(<EnvSwitchConfirmDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(
      screen.getByLabelText(ENV_SWITCHER_COPY['confirm.type.label'].en),
    ).toBeInTheDocument()
  })

  it('shows session-changed message and keeps CTA disabled', () => {
    render(
      <EnvSwitchConfirmDialog
        open
        sessionChangedElsewhere
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      ENV_SWITCHER_COPY['confirm.sessionChanged'].en,
    )
    expect(screen.getByRole('button', { name: ENV_SWITCHER_COPY['confirm.cta'].en })).toBeDisabled()
  })

  it('meets a11y smoke', async () => {
    const { container } = render(
      <EnvSwitchConfirmDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
