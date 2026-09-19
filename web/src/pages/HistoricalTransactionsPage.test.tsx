// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { HistoricalTransactionsPage } from './HistoricalTransactionsPage'

const apiMock = vi.hoisted(() => ({
  listClosedTransactions: vi.fn(),
}))
const authMock = vi.hoisted(() => ({
  agent: { id: 'agent-1', name: 'Test Agent' },
  loading: false,
}))
const uiModeMock = vi.hoisted(() => ({
  effectiveMode: 'pro' as 'guided' | 'pro',
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('@/hooks/useUiMode', () => ({ useUiMode: () => uiModeMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: vi.fn() }))
vi.mock('@/components/closed-transactions/RecordClosureModal', () => ({
  RecordClosureModal: () => null,
}))
vi.mock('@/components/closed-transactions/ImportClosedTransactionsModal', () => ({
  ImportClosedTransactionsModal: () => <div data-testid="import-modal" />,
}))

function renderPage() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <HistoricalTransactionsPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.listClosedTransactions.mockReset().mockResolvedValue({ transactions: [] })
  uiModeMock.effectiveMode = 'pro'
})

afterEach(() => cleanup())

describe('HistoricalTransactionsPage', () => {
  it('shows Import CSV in Pro mode', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: /Import CSV/i })).toBeInTheDocument()
  })

  it('hides Import CSV in Guided mode', async () => {
    uiModeMock.effectiveMode = 'guided'
    renderPage()
    expect(await screen.findByRole('button', { name: /Add manually/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Import CSV/i })).not.toBeInTheDocument()
  })
})
