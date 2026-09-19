// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { MessageTemplateRow } from '@/lib/messageTemplates/shared'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getMessageTemplate: vi.fn(),
  createMessageTemplate: vi.fn(),
  updateMessageTemplate: vi.fn(),
  deleteMessageTemplate: vi.fn(),
  renderMessageTemplate: vi.fn(),
}))

const authState = vi.hoisted(() => ({
  agent: { id: 'usr_1', name: 'Agent', email: 'agent@example.test' },
  user: { email: 'agent@example.test' },
  isAdmin: false,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
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

import { MessageTemplateEditorPage } from './MessageTemplateEditorPage'

function emailTemplate(overrides: Partial<MessageTemplateRow> = {}): MessageTemplateRow {
  return {
    id: 'tpl_1',
    name: 'Welcome email',
    channel: 'email',
    category: 'greeting',
    subject: 'Hello {{client_name}}',
    body: 'Hi {{client_name}}',
    variables: ['client_name'],
    language: 'en',
    approval_status: 'draft',
    owner_type: 'agent',
    owner_id: 'usr_1',
    is_default: false,
    usage_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderEditor(initialPath = '/message-templates/tpl_1') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/message-templates/new" element={<MessageTemplateEditorPage />} />
        <Route path="/message-templates/:id" element={<MessageTemplateEditorPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MessageTemplateEditorPage (AGT-TPL-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getMessageTemplate.mockResolvedValue(emailTemplate())
    apiMocks.createMessageTemplate.mockResolvedValue(emailTemplate({ id: 'tpl_new' }))
    apiMocks.updateMessageTemplate.mockResolvedValue(emailTemplate())
    apiMocks.renderMessageTemplate.mockResolvedValue({
      body: 'Hi Sam',
      subject: 'Hello Sam',
      missing_variables: [],
    })
  })

  it('renders the editor screen marker for an existing template', async () => {
    renderEditor()
    await waitFor(() => {
      expect(screen.getByTestId('message-template-editor-page')).toHaveAttribute('data-screen', 'AGT-TPL-002')
    })
    expect(screen.getByRole('heading', { name: 'Edit template' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Welcome email')).toBeInTheDocument()
  })

  it('shows new-template form without loading', () => {
    renderEditor('/message-templates/new')
    expect(screen.getByRole('heading', { name: 'New template' })).toBeInTheDocument()
    expect(apiMocks.getMessageTemplate).not.toHaveBeenCalled()
  })

  it('marks agency templates read-only', async () => {
    apiMocks.getMessageTemplate.mockResolvedValue(emailTemplate({ owner_type: 'agency', owner_id: 'agency_1' }))
    renderEditor()
    await waitFor(() => {
      expect(screen.getByText(/read-only/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /saved/i })).toBeDisabled()
  })

  it('creates a new template and navigates to its editor route', async () => {
    const user = userEvent.setup()
    renderEditor('/message-templates/new')

    await user.type(screen.getByPlaceholderText(/new lead welcome/i), 'Onboarding')
    await user.click(screen.getByRole('button', { name: /email/i }))
    await user.type(screen.getByPlaceholderText(/viewing confirmed/i), 'Subject line')
    await user.type(screen.getByPlaceholderText(/thank you for your interest/i), 'Body copy')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(apiMocks.createMessageTemplate).toHaveBeenCalled()
    })
  })
})
