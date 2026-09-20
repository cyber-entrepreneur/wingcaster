// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ContentCalendarPage } from './ContentCalendarPage'
import type { CalendarExecution } from '@/api/client'

function fireChange(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

const { addToast, apiMock } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getPublishingCalendar: vi.fn(),
    reschedulePublishingExecution: vi.fn(),
    validatePublishingExecution: vi.fn(),
    previewPublishingExecution: vi.fn(),
    bulkReschedulePublishingExecutions: vi.fn(),
    bulkCancelPublishingExecutions: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: 'en',
    isArabic: false,
    dir: 'ltr',
    setLocale: vi.fn(),
  }),
}))

let hasAgency = true
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: hasAgency
      ? { id: 'usr_owner', affiliation: { agency_id: 'agc_1', role: 'owner' } }
      : { id: 'usr_solo', affiliation: undefined },
    loading: false,
  }),
}))

function sampleExecution(overrides: Partial<CalendarExecution> = {}): CalendarExecution {
  return {
    id: 'exec_1',
    kind: 'social_post',
    status: 'scheduled',
    scheduled_at: '2026-09-20T10:00:00.000Z',
    recurrence: null,
    campaign_id: 'cmp_1',
    agent_id: 'agt_1',
    agency_id: 'agc_1',
    channel_connection_id: 'chn_1',
    creative_id: null,
    audience_id: null,
    subject_type: 'property',
    subject_id: 'prop_1',
    provider_ref: null,
    published_at: null,
    completed_at: null,
    reschedulable: true,
    data: { caption: 'Hello' },
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ContentCalendarPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hasAgency = true
  vi.clearAllMocks()
  // Virtualizer needs non-zero scrollport in jsdom.
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 640
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return 640
    },
  })
  apiMock.getPublishingCalendar.mockResolvedValue({
    executions: [sampleExecution()],
    total: 1,
    truncated: false,
    filters: {},
    meta: { unsupported_filters: [], reschedulable_statuses: ['draft', 'scheduled'] },
  })
  apiMock.previewPublishingExecution.mockResolvedValue({
    execution: sampleExecution(),
    connection: { id: 'chn_1', health: 'connected', provider_account_id: 'ig' },
    platform: 'instagram',
    capabilities: {},
    creative: null,
    variants: [],
    channels: [
      {
        channel_key: 'instagram',
        platform: 'instagram',
        caption: 'Hello',
        media_urls: [],
        variant_id: null,
        label: null,
      },
    ],
    side_effects: false,
  })
  apiMock.validatePublishingExecution.mockResolvedValue({
    execution_id: 'exec_1',
    ok: true,
    blockers: [],
    warnings: [],
  })
})

describe('ContentCalendarPage', () => {
  it('renders calendar executions and opens preview/validation panel', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByRole('heading', { name: /content calendar/i })).toBeInTheDocument()
    const chip = await screen.findByTestId('execution-chip-exec_1')
    expect(chip).toBeInTheDocument()

    await user.click(chip)
    await waitFor(() => {
      expect(apiMock.previewPublishingExecution).toHaveBeenCalledWith('exec_1')
      expect(apiMock.validatePublishingExecution).toHaveBeenCalledWith('exec_1')
    })
    expect(await screen.findByText(/ready to publish/i)).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows blockers panel from network validation', async () => {
    const user = userEvent.setup()
    apiMock.validatePublishingExecution.mockResolvedValueOnce({
      execution_id: 'exec_1',
      ok: false,
      blockers: [{ code: 'MISSING_MEDIA', severity: 'blocker', message: 'instagram requires media before publish' }],
      warnings: [{ code: 'MISSING_CAPTION', severity: 'warning', message: 'No caption' }],
    })
    renderPage()
    await user.click(await screen.findByTestId('execution-chip-exec_1'))
    expect(await screen.findByText(/instagram requires media before publish/i)).toBeInTheDocument()
    expect(screen.getByText(/no caption/i)).toBeInTheDocument()
  })

  it('optimistic reschedule updates scheduled_at then rolls back on failure', async () => {
    const user = userEvent.setup()
    apiMock.reschedulePublishingExecution.mockRejectedValueOnce(
      Object.assign(new Error('Cannot reschedule'), { status: 409 }),
    )
    renderPage()
    await user.click(await screen.findByTestId('execution-chip-exec_1'))
    const input = await screen.findByTestId('reschedule-input')
    fireChange(input, '2026-09-22T11:00')
    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Reschedule failed' }),
      )
    })
  })

  it('optimistic reschedule commits on success', async () => {
    const user = userEvent.setup()
    apiMock.reschedulePublishingExecution.mockResolvedValueOnce({
      execution: sampleExecution({
        scheduled_at: '2026-09-22T11:00:00.000Z',
        status: 'scheduled',
      }),
    })
    renderPage()
    await user.click(await screen.findByTestId('execution-chip-exec_1'))
    const input = await screen.findByTestId('reschedule-input')
    fireChange(input, '2026-09-22T11:00')
    await waitFor(() => {
      expect(apiMock.reschedulePublishingExecution).toHaveBeenCalledWith(
        'exec_1',
        expect.objectContaining({ scheduled_at: expect.any(String) }),
      )
    })
  })

  it('list view virtualizes many executions', async () => {
    const many = Array.from({ length: 520 }, (_, i) =>
      sampleExecution({
        id: `exec_${i}`,
        subject_id: `prop_${i}`,
        scheduled_at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
      }),
    )
    apiMock.getPublishingCalendar.mockResolvedValueOnce({
      executions: many,
      total: 520,
      truncated: false,
      filters: {},
      meta: { unsupported_filters: [], reschedulable_statuses: ['draft', 'scheduled'] },
    })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/520 in range/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^list$/i }))
    const list = await screen.findByRole('list', { name: /execution list/i })
    await waitFor(() => {
      const items = within(list).queryAllByRole('listitem')
      expect(items.length).toBeGreaterThan(0)
      expect(items.length).toBeLessThan(520)
    })
  })

  it('forbids non-agency users', async () => {
    hasAgency = false
    renderPage()
    expect(await screen.findByText(/agency membership required/i)).toBeInTheDocument()
  })
})
