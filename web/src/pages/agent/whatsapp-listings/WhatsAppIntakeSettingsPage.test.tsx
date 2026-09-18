// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { WhatsAppIntakeAgentSettings } from '@/api/client'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getWhatsAppListingsAgentSettings: vi.fn(),
  updateWhatsAppListingsAgentSettings: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

const authState = vi.hoisted(() => ({
  agent: { id: 'agent-1', name: 'Agent' },
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  API_BASE: '/api',
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { WhatsAppIntakeSettingsPage } from './WhatsAppIntakeSettingsPage'

function baseSettings(overrides: Partial<WhatsAppIntakeAgentSettings> = {}): WhatsAppIntakeAgentSettings {
  return {
    intake_enabled: true,
    notification_cadence: 'immediately',
    auto_approve_high_confidence: false,
    ai_provider_preference: 'gemini',
    default_template_variant: 'modern',
    auto_publish_social: false,
    ai_providers_allowed: ['gemini'],
    thumbnail_variants_allowed: ['modern'],
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WhatsAppIntakeSettingsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMocks.getWhatsAppListingsAgentSettings.mockReset()
  apiMocks.updateWhatsAppListingsAgentSettings.mockReset()
  addToast.mockReset()
  authState.agent = { id: 'agent-1', name: 'Agent' }
  authState.loading = false
})

afterEach(() => cleanup())

describe('WhatsAppIntakeSettingsPage', () => {
  it('loads and shows intake settings', async () => {
    apiMocks.getWhatsAppListingsAgentSettings.mockResolvedValue(baseSettings())
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /WhatsApp intake settings/i })).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/Enable WhatsApp intake/i)).toBeChecked()
    expect(screen.getByRole('radio', { name: /Immediately/i })).toBeChecked()
  })

  it('shows error state with retry', async () => {
    apiMocks.getWhatsAppListingsAgentSettings.mockRejectedValue(new Error('Network down'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Network down/i)).toBeInTheDocument()
    })
    apiMocks.getWhatsAppListingsAgentSettings.mockResolvedValue(baseSettings())
    await userEvent.click(screen.getByRole('button', { name: /Try again/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /WhatsApp intake settings/i })).toBeInTheDocument()
    })
  })

  it('warns when auto-approve is enabled', async () => {
    apiMocks.getWhatsAppListingsAgentSettings.mockResolvedValue(baseSettings())
    renderPage()
    await waitFor(() => {
      expect(screen.getByLabelText(/Auto-approve when all fields/i)).toBeInTheDocument()
    })
    await userEvent.click(screen.getByLabelText(/Auto-approve when all fields/i))
    expect(screen.getByRole('alert')).toHaveTextContent(/skips your review/i)
    expect(screen.getByRole('button', { name: /Save settings/i })).not.toBeDisabled()
  })

  it('saves updated cadence', async () => {
    apiMocks.getWhatsAppListingsAgentSettings.mockResolvedValue(baseSettings())
    apiMocks.updateWhatsAppListingsAgentSettings.mockResolvedValue(
      baseSettings({ notification_cadence: 'daily' }),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByLabelText(/Enable WhatsApp intake/i)).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('radio', { name: /Daily digest/i }))
    await userEvent.click(screen.getByRole('button', { name: /Save settings/i }))
    await waitFor(() => {
      expect(apiMocks.updateWhatsAppListingsAgentSettings).toHaveBeenCalledWith({
        whatsapp_intake_enabled: true,
        whatsapp_intake_notification_cadence: 'daily',
        whatsapp_intake_auto_approve_high_confidence: false,
      })
    })
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Settings saved' }))
  })
})

describe('WhatsAppIntakeSettingsPage RTL', () => {
  it('renders with dir=rtl without horizontal overflow classes', async () => {
    apiMocks.getWhatsAppListingsAgentSettings.mockResolvedValue(baseSettings())
    const { container } = render(
      <MemoryRouter>
        <div dir="rtl">
          <WhatsAppIntakeSettingsPage />
        </div>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /WhatsApp intake settings/i })).toBeInTheDocument()
    })
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy()
    expect(container.innerHTML).not.toMatch(/\bml-\d|\bmr-\d|\bpl-\d|\bpr-\d|\btext-left|\btext-right\b/)
  })
})
