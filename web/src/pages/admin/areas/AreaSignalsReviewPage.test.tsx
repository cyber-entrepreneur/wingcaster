// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { AreaSignalsReviewPage } from './AreaSignalsReviewPage'

const apiMock = vi.hoisted(() => ({
  getAdminArea: vi.fn(),
  listAdminSignals: vi.fn(),
  verifyAdminSignal: vi.fn(),
  rejectAdminSignal: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true }),
}))

function renderPage(areaId = 'area-1') {
  render(
    <MemoryRouter initialEntries={[`/admin/areas/${areaId}/signals`]}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/areas/:areaId/signals" element={<AreaSignalsReviewPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.getAdminArea.mockResolvedValue({ id: 'area-1', name: 'Downtown', slug: 'downtown' })
  apiMock.listAdminSignals.mockResolvedValue({
    items: [{
      id: 'sig-1',
      signal_type: 'google_places_count',
      status: 'extracted',
      extracted_features: { category: 'school', value: 8, max: 10 },
      fetched_at: '2026-09-19T00:00:00.000Z',
    }],
    total: 1,
  })
  apiMock.verifyAdminSignal.mockResolvedValue({ id: 'sig-1', status: 'verified' })
  apiMock.rejectAdminSignal.mockResolvedValue({ id: 'sig-1', status: 'rejected' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AreaSignalsReviewPage (PA-ARE-003)', () => {
  it('loads area signals and verifies one row', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: /Signals review/i })).toBeTruthy()
    expect(await screen.findByText('school')).toBeTruthy()
    expect(screen.getByText('0.80')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() =>
      expect(apiMock.verifyAdminSignal).toHaveBeenCalledWith('sig-1', 'Verified from area signals review'),
    )
  })
})
