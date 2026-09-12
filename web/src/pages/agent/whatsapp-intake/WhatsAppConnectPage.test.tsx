// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { WhatsAppConnectPage } from './WhatsAppConnectPage'

vi.mock('./useOnboardingState', () => ({
  useOnboardingState: () => ({
    state: { checklist: {} },
    patch: vi.fn(async () => ({})),
    isLoading: false,
    isError: false,
  }),
  markWhatsAppIntakeProgress: vi.fn(async () => undefined),
  completedViaCaption: () => null,
}))

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function renderConnect(path = '/onboarding/whatsapp/connect') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/onboarding/whatsapp/connect" element={<WhatsAppConnectPage />} />
          <Route path="/onboarding/whatsapp/code" element={<div>CODE_PAGE</div>} />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(() => jsonResponse({}))
})

describe('WhatsAppConnectPage', () => {
  it('renders value-first copy and official channel mark, not a Lucide message-circle', () => {
    renderConnect()
    expect(
      screen.getByRole('heading', { name: /Draft listings by chatting to WingCaster on WhatsApp/i }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /Set up WhatsApp intake/i }).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Not now, remind me later/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/whatsapp/i).length).toBeGreaterThan(0)
    expect(document.querySelector('.lucide-message-circle')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses resume title when ?resume=1', () => {
    renderConnect('/onboarding/whatsapp/connect?resume=1')
    expect(screen.getByText('Resume WhatsApp setup')).toBeInTheDocument()
  })

  it('issues a GET activation-code on CTA and navigates to the code step', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('activation-code')) {
        return jsonResponse({
          display_code: 'WC-A4K9-JAMIL',
          parseable_code: 'A4K9',
          shared_number_e164: '+97141234567',
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        })
      }
      return jsonResponse({})
    })
    renderConnect()
    await user.click(screen.getAllByRole('button', { name: /Set up WhatsApp intake/i })[0])
    await waitFor(() => expect(screen.getByText('CODE_PAGE')).toBeInTheDocument())
    const activationCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('activation-code'))
    expect(activationCalls.length).toBeGreaterThan(0)
    expect(String(activationCalls[0][1]?.method || 'GET').toUpperCase()).not.toBe('DELETE')
  })

  it('still navigates on 429', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('activation-code')) {
        return jsonResponse(
          {
            error: 'RATE_LIMITED',
            display_code: 'WC-EXISTING',
            shared_number_e164: '+97141234567',
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          },
          429,
        )
      }
      return jsonResponse({})
    })
    renderConnect()
    await user.click(screen.getAllByRole('button', { name: /Set up WhatsApp intake/i })[0])
    await waitFor(() => expect(screen.getByText('CODE_PAGE')).toBeInTheDocument())
  })

  it('defers to dashboard without a destructive CTA', async () => {
    const user = userEvent.setup()
    renderConnect()
    await user.click(screen.getAllByRole('button', { name: /Not now, remind me later/i })[0])
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument())
  })
})
