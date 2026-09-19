// @vitest-environment jsdom
/**
 * PA-INS-002 — Inspection submit form.
 *
 * Covers: loads assignment metadata + dimensions, submits a scored inspection
 * (happy path → toast + navigate back), leak-safe not-found state, offline
 * queueing to localStorage, and RTL rendering.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { InspectorSubmitPage, readInspectionQueue } from './InspectorSubmitPage'

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const apiMock = vi.hoisted(() => ({
  getInspectorAssignment: vi.fn(),
  createInspectorSubmission: vi.fn(),
  uploadMedia: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

const DETAIL = {
  assignment: {
    id: 'as-1',
    agent_id: 'agent-1',
    area_id: 'area-1',
    assigned_at: '2026-01-01T00:00:00Z',
    status: 'in_progress' as const,
  },
  area: { id: 'area-1', name: 'Downtown Dubai' },
  dimensions: [
    { id: 'd1', slug: 'safety_security', name: 'Safety & Security' },
    { id: 'd2', slug: 'power_grid_stability', name: 'Power Grid' },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/inspector/as-1/submit']}>
      <Routes>
        <Route path="/inspector/:id/submit" element={<InspectorSubmitPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigateMock.mockReset()
  toastMock.addToast.mockReset()
  apiMock.getInspectorAssignment.mockReset()
  apiMock.createInspectorSubmission.mockReset()
  apiMock.uploadMedia.mockReset()
  localStorage.clear()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('InspectorSubmitPage', () => {
  it('renders assignment metadata and active dimensions', async () => {
    apiMock.getInspectorAssignment.mockResolvedValue(DETAIL)
    renderPage()
    expect(await screen.findByTestId('inspection-submit-page')).toBeTruthy()
    expect(screen.getAllByText('Downtown Dubai').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Score for Safety & Security')).toBeTruthy()
    expect(screen.getByLabelText('Score for Power Grid')).toBeTruthy()
  })

  it('shows a leak-safe not-found state', async () => {
    apiMock.getInspectorAssignment.mockRejectedValue(new Error('Assignment not found'))
    renderPage()
    expect(await screen.findByTestId('inspection-submit-notfound')).toBeTruthy()
    expect(apiMock.createInspectorSubmission).not.toHaveBeenCalled()
  })

  it('submits a scored inspection and returns to the queue', async () => {
    apiMock.getInspectorAssignment.mockResolvedValue(DETAIL)
    apiMock.createInspectorSubmission.mockResolvedValue({ id: 'sub-1' })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('inspection-submit-page')

    await user.type(screen.getByLabelText('Score for Safety & Security'), '8')
    await user.click(screen.getByTestId('inspection-submit-cta'))

    await waitFor(() => expect(apiMock.createInspectorSubmission).toHaveBeenCalledTimes(1))
    const payload = apiMock.createInspectorSubmission.mock.calls[0][0]
    expect(payload.assignment_id).toBe('as-1')
    expect(payload.area_id).toBe('area-1')
    expect(payload.dimension_scores).toEqual({ safety_security: 8 })
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/inspector'))
    expect(toastMock.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Inspection submitted' }),
    )
  })

  it('queues the submission offline when the device is offline', async () => {
    apiMock.getInspectorAssignment.mockResolvedValue(DETAIL)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('inspection-submit-page')

    await user.click(screen.getByTestId('inspection-submit-cta'))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/inspector'))
    expect(apiMock.createInspectorSubmission).not.toHaveBeenCalled()
    const queue = readInspectionQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].assignment_id).toBe('as-1')
    expect(toastMock.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Saved offline' }),
    )
  })

  it('renders correctly under RTL', async () => {
    apiMock.getInspectorAssignment.mockResolvedValue(DETAIL)
    render(
      <div dir="rtl">
        <MemoryRouter initialEntries={['/inspector/as-1/submit']}>
          <Routes>
            <Route path="/inspector/:id/submit" element={<InspectorSubmitPage />} />
          </Routes>
        </MemoryRouter>
      </div>,
    )
    expect(await screen.findByTestId('inspection-submit-page')).toBeTruthy()
    expect(screen.getByTestId('inspection-submit-cta')).toBeTruthy()
  })
})
