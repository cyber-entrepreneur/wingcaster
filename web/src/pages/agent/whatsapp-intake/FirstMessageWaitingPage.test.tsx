// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { FirstMessageWaitingPage } from './FirstMessageWaitingPage'

vi.mock('@/hooks/useOnboardingState', async () => {
  const { mockUseOnboardingState } = await import('./mockUseOnboardingState')
  return { useOnboardingState: () => mockUseOnboardingState() }
})

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function renderWaiting() {
  return render(
    <ToastProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/onboarding/whatsapp/waiting',
            state: { phone_e164: '+971501234567', bindingId: 'bind-1' },
          },
        ]}
      >
        <Routes>
          <Route path="/onboarding/whatsapp/waiting" element={<FirstMessageWaitingPage />} />
          <Route path="/onboarding/whatsapp/drafting/:sessionId" element={<div>DRAFTING_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation((url: string) => {
    const u = String(url)
    if (u.includes('inbound-status')) {
      return jsonResponse({
        bound: true,
        binding_id: 'bind-1',
        latest_message_at: null,
        draft_session_id: null,
      })
    }
    if (u.includes('bindings')) return jsonResponse([{ id: 'bind-1', phone_e164: '+971501234567' }])
    if (u.includes('binding-status')) return jsonResponse({ bound: true, phone_e164: '+971501234567' })
    return jsonResponse({})
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FirstMessageWaitingPage', () => {
  it('masks the bound number and keeps the signal lamp unique', async () => {
    renderWaiting()
    expect(await screen.findAllByText(/\+971 5X XXX XX67/)).not.toHaveLength(0)
    expect(screen.getAllByText(/Listening on WhatsApp/i).length).toBeGreaterThan(0)
    expect(document.querySelectorAll('[data-signal-lamp-state]').length).toBe(1)
  })

  it('reveals the WC-LIST hint after 60s', async () => {
    vi.useFakeTimers()
    renderWaiting()
    expect(screen.queryByText(/Send WC-LIST to check your bindings/i)).not.toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(screen.getByText(/Send WC-LIST to check your bindings/i)).toBeInTheDocument()
  })

  it('navigates to drafting when inbound-status reports a message', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url)
      if (u.includes('inbound-status')) {
        return jsonResponse({
          bound: true,
          binding_id: 'bind-1',
          latest_message_at: new Date().toISOString(),
          draft_session_id: 'sess-42',
        })
      }
      return jsonResponse({})
    })
    renderWaiting()
    await waitFor(() => expect(screen.getByText('DRAFTING_PAGE')).toBeInTheDocument())
  })
})
