// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ExperimentsPage } from './ExperimentsPage'
import { ExperimentBuilderPage } from './ExperimentBuilderPage'
import { ExperimentResultsPage } from './ExperimentResultsPage'

const apiMocks = vi.hoisted(() => ({
  getExperiments: vi.fn(),
  getExperiment: vi.fn(),
  createExperiment: vi.fn(),
  updateExperiment: vi.fn(),
  startExperiment: vi.fn(),
  getExperimentResults: vi.fn(),
  concludeExperiment: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  setAuthToken: vi.fn(),
  API_BASE: '/api',
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

const sampleExperiment = {
  id: 'exp_1',
  campaign_id: null,
  dimension: 'copy' as const,
  variants: [
    { key: 'A', label: 'A', is_control: true },
    { key: 'B', label: 'B', is_control: false },
  ],
  allocation: 'even' as const,
  holdout_pct: 10,
  goal_event: 'lead.created',
  status: 'draft' as const,
  result: {},
  agency_id: 'agy_1',
  agent_id: null,
  data: {},
  created_at: '',
  updated_at: '',
}

beforeEach(() => {
  apiMocks.getExperiments.mockReset().mockResolvedValue({ experiments: [sampleExperiment] })
  apiMocks.getExperiment.mockReset().mockResolvedValue(sampleExperiment)
  apiMocks.createExperiment.mockReset().mockResolvedValue({ ...sampleExperiment, id: 'exp_new' })
  apiMocks.updateExperiment.mockReset().mockResolvedValue(sampleExperiment)
  apiMocks.startExperiment.mockReset().mockResolvedValue({ ...sampleExperiment, status: 'running' })
  apiMocks.getExperimentResults.mockReset().mockResolvedValue({
    computed_at: new Date().toISOString(),
    method: 'frequentist_two_proportion_z',
    goal_event: 'lead.created',
    to_stage: 'lead',
    control_variant: 'A',
    assignment_count: 100,
    matched_conversions: 20,
    variants: [
      {
        variant: 'A',
        assigned: 50,
        conversions: 5,
        conversion_rate: 0.1,
        is_control: true,
        vs_control: null,
      },
      {
        variant: 'B',
        assigned: 50,
        conversions: 15,
        conversion_rate: 0.3,
        is_control: false,
        vs_control: {
          rate_a: 0.3,
          rate_b: 0.1,
          lift: 2,
          z: 2.5,
          p_value: 0.012,
          significant_at_95: true,
          confidence: 0.988,
          reason: 'two_proportion_z',
        },
      },
    ],
    sequential: { code: 'NOT_CONFIGURED' },
    bandit: { code: 'NOT_CONFIGURED' },
  })
  apiMocks.concludeExperiment.mockReset().mockResolvedValue({
    experiment: { ...sampleExperiment, status: 'concluded' },
    results: {
      computed_at: new Date().toISOString(),
      method: 'frequentist_two_proportion_z',
      goal_event: 'lead.created',
      to_stage: 'lead',
      control_variant: 'A',
      assignment_count: 100,
      matched_conversions: 20,
      variants: [],
      sequential: { code: 'NOT_CONFIGURED' },
      bandit: { code: 'NOT_CONFIGURED' },
      winner_variant: 'B',
      promotion: { promoted: true, variant: 'B' },
    },
  })
})

afterEach(() => cleanup())

describe('ExperimentsPage', () => {
  it('lists experiments with links to edit and results', async () => {
    render(
      <MemoryRouter initialEntries={['/experiments']}>
        <Routes>
          <Route path="/experiments" element={<ExperimentsPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText(/copy · lead\.created/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /results/i })).toHaveAttribute(
      'href',
      '/experiments/exp_1/results',
    )
  })
})

describe('ExperimentBuilderPage', () => {
  it('creates an experiment from the builder form', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/experiments/new']}>
        <Routes>
          <Route path="/experiments/new" element={<ExperimentBuilderPage />} />
          <Route path="/experiments/:id" element={<ExperimentBuilderPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText(/dimension/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/goal event/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/holdout/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create experiment/i }))
    await waitFor(() => {
      expect(apiMocks.createExperiment).toHaveBeenCalled()
    })
    const payload = apiMocks.createExperiment.mock.calls[0][0]
    expect(payload.dimension).toBe('copy')
    expect(payload.goal_event).toBe('lead.created')
    expect(payload.variants.length).toBeGreaterThanOrEqual(2)
  })
})

describe('ExperimentResultsPage', () => {
  it('renders per-variant funnel, lift, and confidence', async () => {
    render(
      <MemoryRouter initialEntries={['/experiments/exp_1/results']}>
        <Routes>
          <Route path="/experiments/:id/results" element={<ExperimentResultsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Assignments')).toBeInTheDocument()
    })
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText(/\+200\.0%/)).toBeInTheDocument()
    expect(screen.getByText(/98\.8%/)).toBeInTheDocument()
    expect(screen.getByText(/NOT_CONFIGURED/)).toBeInTheDocument()
  })
})
