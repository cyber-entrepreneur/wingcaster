// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublishOutcomePage } from './PublishOutcomePage'

vi.mock('@/api/client', () => ({
  api: {
    getProperty: vi.fn().mockResolvedValue({
      id: 'prop_1',
      title: 'Marina Gate 1 — 2BR',
      type: 'sale',
      price: 2400000,
      location: 'Dubai Marina',
      neighborhood: 'Marina',
      photos: ['https://cdn.example/1.jpg'],
      status: 'active',
      syndications: [{ channel: 'bayut', status: 'published' }],
    }),
    getPublishingTracker: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'att_1',
          portal_code: 'bayut',
          portal_display_name: 'Bayut',
          status: 'succeeded',
          credit_charged: 1,
          published_at: '2026-09-12T10:00:00.000Z',
        },
      ],
    }),
  },
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

describe('PublishOutcomePage', () => {
  it('renders the WF-03 receipt for /publish/outcome/:id', async () => {
    render(
      <MemoryRouter initialEntries={['/publish/outcome/prop_1']}>
        <Routes>
          <Route path="/publish/outcome/:id" element={<PublishOutcomePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('publish-outcome-hero')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: /published/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Marina Gate 1/).length).toBeGreaterThan(0)
  })
})
