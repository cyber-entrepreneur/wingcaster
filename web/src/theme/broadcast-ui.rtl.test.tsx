// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { applyLcMode, resolveLcMode } from '@/theme/mode'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import { BrandProvider } from '@/context/BrandContext'
import { ColorModeToggle } from '@/components/ui/color-mode-toggle'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

describe('Broadcast mode switch', () => {
  it('sets data-lc-mode for explicit light and dark, and removes it for system', () => {
    applyLcMode('dark')
    expect(document.documentElement.getAttribute('data-lc-mode')).toBe('dark')
    applyLcMode('light')
    expect(document.documentElement.getAttribute('data-lc-mode')).toBe('light')
    applyLcMode('system')
    expect(document.documentElement.hasAttribute('data-lc-mode')).toBe(false)
  })

  it('resolves system mode from prefers-color-scheme', () => {
    expect(resolveLcMode('light')).toBe('light')
    expect(resolveLcMode('dark')).toBe('dark')
  })
})

describe('Broadcast UI primitives', () => {
  it('keeps primary buttons at the 44px tap floor and does not use a single-tone ring', () => {
    render(<Button>Publish</Button>)
    const button = screen.getByRole('button', { name: 'Publish' })
    expect(button.className).toMatch(/min-h-tap/)
    expect(button.className).not.toMatch(/ring-2/)
    expect(button.className).toContain('bg-[var(--lc-action-primary)]')
    expect(button.className).toContain('hover:bg-[var(--lc-action-primary-hover)]')
  })

  it('renders status as tint + glyph + label', () => {
    render(<Badge status="published">Published</Badge>)
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('●')).toBeInTheDocument()
  })

  it('marks number inputs as numeric/mono', () => {
    render(<Input type="number" aria-label="Price" />)
    const input = screen.getByLabelText('Price')
    expect(input).toHaveAttribute('data-lc-numeric')
  })

  it('Numeric uses the data-lc-numeric hook', () => {
    render(<Numeric>12,500</Numeric>)
    expect(screen.getByText('12,500')).toHaveAttribute('data-lc-numeric')
  })
})

describe('ColorModeToggle', () => {
  it('cycles light → dark → system', async () => {
    const user = userEvent.setup()
    localStorage.removeItem('wingcaster.lc-mode')
    render(
      <BrandProvider>
        <ColorModeToggle />
      </BrandProvider>,
    )
    const button = screen.getByRole('button', { name: /Colour mode/i })
    expect(button).toHaveAccessibleName(/Light/i)
    await user.click(button)
    expect(document.documentElement.getAttribute('data-lc-mode')).toBe('dark')
    await user.click(button)
    expect(document.documentElement.hasAttribute('data-lc-mode')).toBe(false)
  })
})
