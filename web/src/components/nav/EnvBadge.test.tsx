// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { EnvBadge, ENV_SWITCHER_COPY, envCopy } from './EnvBadge'

expect.extend(toHaveNoViolations)

describe('EnvBadge', () => {
  it('renders LIVE label + published styling', () => {
    render(<EnvBadge env="live" />)
    const btn = screen.getByRole('button', { name: ENV_SWITCHER_COPY['badge.aria.live'].en })
    expect(btn).toHaveTextContent('LIVE')
    expect(btn.className).toMatch(/--lc-status-published-dot/)
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('renders TEST label + underOffer styling', () => {
    render(<EnvBadge env="test" />)
    const btn = screen.getByRole('button', { name: ENV_SWITCHER_COPY['badge.aria.test'].en })
    expect(btn).toHaveTextContent('TEST')
    expect(btn.className).toMatch(/--lc-status-underOffer-dot/)
  })

  it('uses Arabic badge copy when locale=ar', () => {
    render(<EnvBadge env="live" locale="ar" />)
    expect(screen.getByRole('button')).toHaveTextContent(envCopy('badge.live', 'ar'))
  })

  it('keeps safety token untranslated in copy table', () => {
    expect(ENV_SWITCHER_COPY['confirm.type.value'].en).toBe('SWITCH TO LIVE')
    expect(ENV_SWITCHER_COPY['confirm.type.value'].ar).toBe('SWITCH TO LIVE')
  })

  it('meets a11y smoke', async () => {
    const { container } = render(<EnvBadge env="test" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
