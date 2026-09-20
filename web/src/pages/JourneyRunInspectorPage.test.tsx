// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { JourneyRunInspectorPage } from '@/pages/JourneyRunInspectorPage'

vi.mock('@/api/client', () => ({
  api: {
    getJourneyRun: vi.fn(),
  },
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => {},
}))

vi.mock('@/components/layout/CrmShell', () => ({
  CrmShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { api } from '@/api/client'

describe('JourneyRunInspectorPage', () => {
  beforeEach(() => {
    vi.mocked(api.getJourneyRun).mockResolvedValue({
      id: 'jrun_1',
      contact_id: 'cnt_1',
      status: 'exited',
      node_runs: [
        { id: 'jnr_1', journey_run_id: 'jrun_1', node_id: 'n_send', node_type: 'send', result: { outcome: 'execution_created' } },
      ],
      transitions: [
        { id: 'jtr_1', journey_run_id: 'jrun_1', from_node: 'n_send', to_node: 'n_exit', reason: { type: 'send_completed' } },
      ],
    })
  })

  it('reconstructs causal path from node runs and transitions', async () => {
    render(
      <MemoryRouter initialEntries={['/journeys/runs/jrun_1']}>
        <Routes>
          <Route path="/journeys/runs/:runId" element={<JourneyRunInspectorPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('jrun_1')).toBeInTheDocument()
    })
    expect(screen.getAllByText(/n_send/).length).toBeGreaterThan(0)
    expect(screen.getByText(/send_completed/)).toBeInTheDocument()
  })
})
