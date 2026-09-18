// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { AdminScoringPage } from './AdminScoringPage'

const apiMock = vi.hoisted(() => ({
  listAdminDimensions: vi.fn(),
  listAdminSourceTypes: vi.fn(),
  listAdminAiConfigs: vi.fn(),
  listAdminSignals: vi.fn(),
  getAdminGoogleUsage: vi.fn(),
  listAdminAreas: vi.fn(),
  getAdminAreaCurrentScores: vi.fn(),
  overrideAdminScore: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    runElevated: async (action: () => Promise<unknown>) => action(),
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AdminScoringPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('AdminScoringPage (PA-SCR-004)', () => {
  beforeEach(() => {
    cleanup()
    apiMock.listAdminDimensions.mockResolvedValue({
      items: [{ id: 'dimension-1', name: 'Walkability', slug: 'walkability', is_active: true }],
    })
    apiMock.listAdminSourceTypes.mockResolvedValue({ items: [] })
    apiMock.listAdminAiConfigs.mockResolvedValue({ items: [] })
    apiMock.listAdminSignals.mockResolvedValue({ items: [], total: 0 })
    apiMock.getAdminGoogleUsage.mockResolvedValue({ monthly_spend_usd: 0, budget_usd_monthly: 100 })
    apiMock.listAdminAreas.mockResolvedValue({
      items: [{ id: 'area-1', name: 'Dubai Marina', status: 'scoring_enabled' }],
    })
    apiMock.getAdminAreaCurrentScores.mockResolvedValue({
      area_id: 'area-1',
      scores: [{ dimension_id: 'dimension-1', score_value: 61.2 }],
    })
    apiMock.overrideAdminScore.mockResolvedValue({ id: 'score-1', score_value: 72.5 })
  })

  it('exposes manual override CTA and submits override payload', async () => {
    renderPage()
    const user = userEvent.setup()

    expect(await screen.findByRole('button', { name: 'Manual score override' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Manual score override' }))

    expect(await screen.findByRole('heading', { name: 'Manual score override' })).toBeTruthy()
    expect(await screen.findByText('61.2')).toBeTruthy()

    await user.clear(screen.getByLabelText('New score (0–100)'))
    await user.type(screen.getByLabelText('New score (0–100)'), '72.5')
    await user.type(screen.getByLabelText('Reason'), 'Verified inspection')
    await user.type(screen.getByLabelText('Evidence notes'), 'Site visit on 2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Submit override' }))

    await waitFor(() => {
      expect(apiMock.overrideAdminScore).toHaveBeenCalledWith({
        area_id: 'area-1',
        dimension_id: 'dimension-1',
        score: 72.5,
        reason: 'Verified inspection',
        evidence: { note: 'Site visit on 2026-08-01' },
        rationale: 'Site visit on 2026-08-01',
      })
    })
  })
})
