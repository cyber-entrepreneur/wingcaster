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
  recalculateAdminScores: vi.fn(),
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

describe('AdminScoringPage (PA-SCR-003)', () => {
  beforeEach(() => {
    cleanup()
    apiMock.listAdminDimensions.mockResolvedValue({
      items: [{
        id: 'dimension-1',
        name: 'Walkability',
        slug: 'walkability',
        is_active: true,
        scoring_logic_config: { logic: 'ai_synthesis' },
      }],
    })
    apiMock.listAdminSourceTypes.mockResolvedValue({ items: [] })
    apiMock.listAdminAiConfigs.mockResolvedValue({ items: [] })
    apiMock.listAdminSignals.mockResolvedValue({ items: [], total: 0 })
    apiMock.getAdminGoogleUsage.mockResolvedValue({ monthly_spend_usd: 0, budget_usd_monthly: 100 })
    apiMock.listAdminAreas.mockResolvedValue({
      items: [{ id: 'area-1', name: 'Dubai Marina', status: 'scoring_enabled' }],
    })
    apiMock.recalculateAdminScores.mockResolvedValue({ scope: 'one_area', calculated: 1 })
  })

  it('exposes recalculate scores CTA and submits one-area scope', async () => {
    renderPage()
    const user = userEvent.setup()

    expect(await screen.findByRole('button', { name: 'Recalculate scores' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Recalculate scores' }))

    expect(await screen.findByRole('heading', { name: 'Recalculate scores' })).toBeTruthy()
    expect(screen.getByText(/Cost preview:/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Start recalculation' }))

    await waitFor(() => {
      expect(apiMock.recalculateAdminScores).toHaveBeenCalledWith({
        scope: 'one_area',
        area_id: 'area-1',
      })
    })
  })
})
