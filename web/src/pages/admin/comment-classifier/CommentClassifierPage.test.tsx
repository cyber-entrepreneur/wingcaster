// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { CommentClassifierPage } from './CommentClassifierPage'

const apiMock = vi.hoisted(() => ({
  getCommentClassifierConfig: vi.fn(),
  listCommentClassifierRuns: vi.fn(),
  runCommentClassifierBatch: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true }),
}))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    runElevated: async (action: () => Promise<unknown>) => action(),
  }),
}))

beforeEach(() => {
  apiMock.getCommentClassifierConfig.mockResolvedValue({
    categories: ['hot_lead', 'general'],
    sentiments: ['positive', 'neutral', 'negative'],
    meta: {
      hot_lead: { label: 'Hot lead', emoji: '🔥', description: 'Buy intent', route: 'crm_hot' },
      general: { label: 'General', emoji: '💭', description: 'Catch-all', route: 'ai_thread' },
    },
    operational: { batch_size: 10, ai_enabled: true, ai_provider: 'gemini' },
  })
  apiMock.listCommentClassifierRuns.mockResolvedValue({
    runs: [{
      id: 'run-1',
      batched: 4,
      updated_count: 3,
      created_at: '2026-09-19T00:00:00.000Z',
    }],
    total: 1,
  })
  apiMock.runCommentClassifierBatch.mockResolvedValue({ batched: 2, updated: 2 })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CommentClassifierPage (PA-CLS-001)', () => {
  it('loads config and triggers an elevated classifier run', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ToastProvider>
          <CommentClassifierPage />
        </ToastProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Comment classifier' })).toBeTruthy()
    expect(await screen.findByText('Buy intent')).toBeTruthy()
    expect(await screen.findByText('Completed')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Run now' }))

    await waitFor(() => expect(apiMock.runCommentClassifierBatch).toHaveBeenCalled())
  })
})
