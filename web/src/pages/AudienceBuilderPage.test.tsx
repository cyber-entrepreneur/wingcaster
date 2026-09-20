// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AudienceBuilderPage } from './AudienceBuilderPage'

const apiMocks = vi.hoisted(() => ({
  createAudience: vi.fn(),
  resolveAudience: vi.fn(),
  getAudience: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  setAuthToken: vi.fn(),
  API_BASE: '/api',
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'agt_1', name: 'Sara' },
    loading: false,
    isAdmin: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

function renderAt(path = '/audiences/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/audiences/new" element={<AudienceBuilderPage />} />
        <Route path="/audiences/:id" element={<AudienceBuilderPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMocks.createAudience.mockReset().mockResolvedValue({ id: 'aud_1', name: 'Buyers' })
  apiMocks.resolveAudience.mockReset().mockResolvedValue({
    audienceId: 'aud_1',
    matched: 10,
    contactable: 8,
    frequency_capped: 0,
    opted_out: 2,
    conflicting: 0,
    memberIds: {
      matched: [],
      contactable: [],
      frequency_capped: [],
      opted_out: [],
      conflicting: [],
    },
  })
  apiMocks.getAudience.mockReset().mockResolvedValue({
    id: 'aud_1',
    name: 'Buyers',
    type: 'dynamic',
    tags_filter: [],
    audience_rules: [],
    member_source: 'crm',
    estimated_size: null,
    created_at: '',
    updated_at: '',
    rules: {},
    agency_id: null,
    agent_id: null,
  })
})

afterEach(() => cleanup())

describe('AudienceBuilderPage', () => {
  it('renders audience builder form', () => {
    renderAt('/audiences/new')
    expect(screen.getByTestId('audience-builder-form')).toBeInTheDocument()
    expect(screen.getByTestId('audience-rule-editor')).toBeInTheDocument()
  })

  it('shows breakdown after resolve', async () => {
    const user = userEvent.setup()
    renderAt('/audiences/new')

    await user.type(screen.getByLabelText(/Audience name/i), 'Buyers')
    await user.click(screen.getByRole('button', { name: /Resolve breakdown/i }))

    await waitFor(() => {
      expect(apiMocks.createAudience).toHaveBeenCalled()
      expect(apiMocks.resolveAudience).toHaveBeenCalled()
      expect(screen.getByTestId('audience-breakdown')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })
})
