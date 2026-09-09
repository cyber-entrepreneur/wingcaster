// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { ActivationCodePage } from './ActivationCodePage'

vi.mock('@/hooks/useOnboardingState', async () => {
  const { mockUseOnboardingState } = await import('./mockUseOnboardingState')
  return { useOnboardingState: () => mockUseOnboardingState() }
})

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,qr') },
}))

const fetchMock = vi.fn()
const clipboardWrite = vi.fn(async () => undefined)

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

const CODE = {
  display_code: 'WC-A4K9-JAMIL',
  parseable_code: 'A4K9',
  shared_number_e164: '+97141234567',
  expires_at: new Date(Date.now() + 120_000).toISOString(),
}

function renderCode(state?: Record<string, string>) {
  return render(
    <ToastProvider>
      <MemoryRouter
        initialEntries={[
          { pathname: '/onboarding/whatsapp/code', state: state ?? {
            displayCode: CODE.display_code,
            sharedNumberE164: CODE.shared_number_e164,
            expiresAt: CODE.expires_at,
          } },
        ]}
      >
        <Routes>
          <Route path="/onboarding/whatsapp/code" element={<ActivationCodePage />} />
          <Route path="/onboarding/whatsapp/waiting" element={<div>WAITING_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  clipboardWrite.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWrite },
  })
  fetchMock.mockImplementation((url: string) => {
    const u = String(url)
    if (u.includes('binding-status')) return jsonResponse({ bound: false })
    if (u.includes('activation-code')) return jsonResponse(CODE)
    if (u.includes('onboarding-events') || u.includes('activation_state')) {
      return jsonResponse({ accepted: true }, 202)
    }
    return jsonResponse({})
  })
})

describe('ActivationCodePage', () => {
  it('does not auto-copy or open WhatsApp on mount', async () => {
    renderCode()
    expect(await screen.findByText('WC-A4K9-JAMIL')).toBeInTheDocument()
    expect(clipboardWrite).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: /Open WhatsApp/i })).not.toBeInTheDocument()
  })

  it('regenerates via POST and shows the new code', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('activation-code') && init?.method === 'POST') {
        return jsonResponse({
          ...CODE,
          display_code: 'WC-NEW1-JAMIL',
        })
      }
      if (u.includes('binding-status')) return jsonResponse({ bound: false })
      return jsonResponse(CODE)
    })
    renderCode()
    await user.click(screen.getByRole('button', { name: /I didn't get it/i }))
    await waitFor(() => expect(screen.getByText('WC-NEW1-JAMIL')).toBeInTheDocument())
    const posts = fetchMock.mock.calls.filter(
      (c) => String(c[0]).includes('activation-code') && c[1]?.method === 'POST',
    )
    expect(posts.length).toBeGreaterThan(0)
  })

  it('disables the primary CTA when the countdown has expired', async () => {
    renderCode({
      displayCode: CODE.display_code,
      sharedNumberE164: CODE.shared_number_e164,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    const cta = await screen.findByRole('button', { name: /Open WhatsApp with code pre-filled/i })
    expect(cta).toBeDisabled()
  })

  it('navigates to waiting when binding-status reports bound', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('binding-status')) {
        return jsonResponse({ bound: true, phone_e164: '+971501234567' })
      }
      return jsonResponse(CODE)
    })
    renderCode()
    await waitFor(() => expect(screen.getByText('WAITING_PAGE')).toBeInTheDocument())
  })

  it('renders a black-on-white QR block', async () => {
    renderCode()
    const qr = await screen.findAllByTestId('wa-me-qr')
    expect(qr[0]).toHaveAttribute('data-qr-contrast', 'black-on-white')
    expect(qr[0].getAttribute('style') || '').toMatch(/white/i)
  })
})
