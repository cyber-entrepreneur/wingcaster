// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

const authMock = vi.hoisted(() => ({
  agent: null as null | { id: string; preferred_locale?: string },
  loading: false,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
}))

const addToast = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

import { LanguageSelector, LANGUAGE_SELECTOR_COPY } from './LanguageSelector'
import { LOCALE_STORAGE_KEY } from '@/hooks/useLocale'

describe('LanguageSelector', () => {
  beforeEach(() => {
    localStorage.clear()
    authMock.agent = null
    authMock.loading = false
    addToast.mockClear()
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    class MockBroadcastChannel {
      name: string
      constructor(name: string) {
        this.name = name
      }
      postMessage() {}
      addEventListener() {}
      removeEventListener() {}
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('renders fixed EN | العربية labels that never translate', async () => {
    const user = userEvent.setup()
    render(<LanguageSelector />)

    const group = screen.getByRole('radiogroup')
    expect(group).toHaveAttribute('dir', 'ltr')

    expect(screen.getByRole('radio', { name: LANGUAGE_SELECTOR_COPY['aria.selected.en'].en })).toHaveTextContent(
      'EN',
    )
    expect(screen.getByRole('radio', { name: LANGUAGE_SELECTOR_COPY['aria.selected.ar'].en })).toHaveTextContent(
      'العربية',
    )

    await user.click(screen.getByRole('radio', { name: LANGUAGE_SELECTOR_COPY['aria.selected.ar'].en }))

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('ar')
      expect(document.documentElement.dir).toBe('rtl')
    })

    // Labels stay EN / العربية after switch
    expect(screen.getByText('EN')).toBeInTheDocument()
    expect(screen.getByText('العربية')).toBeInTheDocument()
    expect(group).toHaveAttribute('dir', 'ltr')
  })

  it('announces switch via aria-live polite', async () => {
    const user = userEvent.setup()
    render(<LanguageSelector />)

    await user.click(screen.getByRole('radio', { name: LANGUAGE_SELECTOR_COPY['aria.selected.ar'].en }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        LANGUAGE_SELECTOR_COPY['announce.switched.ar'].ar,
      )
    })
  })

  it('persists anon choice to localStorage and updates html attrs', async () => {
    const user = userEvent.setup()
    render(<LanguageSelector />)

    await user.click(screen.getByRole('radio', { name: LANGUAGE_SELECTOR_COPY['aria.selected.ar'].en }))

    await waitFor(() => {
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar')
      expect(document.documentElement.getAttribute('lang')).toBe('ar')
      expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    })
  })

  it('toasts when signed-in persistence fails', async () => {
    authMock.agent = { id: 'a1' }
    localStorage.setItem('fi_token', 'tok')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const user = userEvent.setup()
    render(<LanguageSelector />)

    await user.click(screen.getByRole('radio', { name: LANGUAGE_SELECTOR_COPY['aria.selected.ar'].en }))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          description: LANGUAGE_SELECTOR_COPY['error.switchFailed'].ar,
        }),
      )
    })
    // Visual switch still applied
    expect(document.documentElement.lang).toBe('ar')
  })

  it('exposes radiogroup semantics and meets a11y smoke', async () => {
    const { container } = render(<LanguageSelector />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByRole('radio', { checked: true })).toHaveAccessibleName(
      LANGUAGE_SELECTOR_COPY['aria.selected.en'].en,
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('keeps 44px tap floor classes on each pill', () => {
    render(<LanguageSelector />)
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.className).toMatch(/min-h-\[var\(--lc-tap-target-min\)\]/)
      expect(radio.className).toMatch(/min-w-\[var\(--lc-tap-target-min\)\]/)
    }
  })
})
