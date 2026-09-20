// @vitest-environment jsdom
/**
 * PA-AUD-002 — Audit retention policy.
 *
 * Covers: load + populate the form, error state, financial-floor + min-bound
 * validation (disables Save), a successful save round-trip, the export toggle,
 * and RTL rendering.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuditRetentionPolicyPage } from './AuditRetentionPolicyPage'

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const apiMock = vi.hoisted(() => ({
  getAuditRetentionPolicy: vi.fn(),
  updateAuditRetentionPolicy: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

const POLICY = {
  financial_actions_days: 2555,
  pa_actions_days: 365,
  tenant_actions_days: 365,
  system_events_days: 90,
  export_before_purge: true,
  updated_by: 'pa-9',
  updated_at: '2026-01-01T00:00:00Z',
}
const CONSTRAINTS = { financial_floor_days: 2555, min_category_days: 30, max_category_days: 3650 }

function renderPage() {
  return render(
    <MemoryRouter>
      <AuditRetentionPolicyPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  toastMock.addToast.mockReset()
  apiMock.getAuditRetentionPolicy.mockReset()
  apiMock.updateAuditRetentionPolicy.mockReset()
  apiMock.getAuditRetentionPolicy.mockResolvedValue({ policy: POLICY, constraints: CONSTRAINTS })
  apiMock.updateAuditRetentionPolicy.mockResolvedValue({ policy: { ...POLICY, pa_actions_days: 400 } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AuditRetentionPolicyPage', () => {
  it('loads and populates the form', async () => {
    renderPage()
    expect(await screen.findByTestId('retention-policy-page')).toBeTruthy()
    expect((screen.getByLabelText('Financial audit events retention days') as HTMLInputElement).value).toBe('2555')
    expect((screen.getByLabelText('Platform-admin actions retention days') as HTMLInputElement).value).toBe('365')
  })

  it('shows an error state when the load fails', async () => {
    apiMock.getAuditRetentionPolicy.mockRejectedValueOnce(new Error('nope'))
    renderPage()
    expect(await screen.findByTestId('retention-error')).toBeTruthy()
  })

  it('blocks save when the financial floor is violated', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('retention-policy-page')
    const fin = screen.getByLabelText('Financial audit events retention days')
    await user.clear(fin)
    await user.type(fin, '2554')
    expect(screen.getByTestId('retention-save')).toBeDisabled()
    expect(apiMock.updateAuditRetentionPolicy).not.toHaveBeenCalled()
  })

  it('blocks save when a category is below its minimum', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('retention-policy-page')
    const pa = screen.getByLabelText('Platform-admin actions retention days')
    await user.clear(pa)
    await user.type(pa, '10')
    expect(screen.getByTestId('retention-save')).toBeDisabled()
  })

  it('saves a valid policy', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('retention-policy-page')
    const pa = screen.getByLabelText('Platform-admin actions retention days')
    await user.clear(pa)
    await user.type(pa, '400')
    await user.click(screen.getByTestId('retention-save'))
    await waitFor(() => expect(apiMock.updateAuditRetentionPolicy).toHaveBeenCalledTimes(1))
    expect(apiMock.updateAuditRetentionPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ pa_actions_days: 400, financial_actions_days: 2555, export_before_purge: true }),
    )
    expect(toastMock.addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Retention policy saved' }))
  })

  it('toggles export-before-purge into the payload', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('retention-policy-page')
    await user.click(screen.getByTestId('retention-export-toggle'))
    await user.click(screen.getByTestId('retention-save'))
    await waitFor(() => expect(apiMock.updateAuditRetentionPolicy).toHaveBeenCalled())
    expect(apiMock.updateAuditRetentionPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ export_before_purge: false }),
    )
  })

  it('renders under RTL', async () => {
    render(
      <div dir="rtl">
        <MemoryRouter>
          <AuditRetentionPolicyPage />
        </MemoryRouter>
      </div>,
    )
    expect(await screen.findByTestId('retention-policy-page')).toBeTruthy()
  })
})
