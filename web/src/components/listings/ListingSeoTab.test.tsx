// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ListingSeoTab } from './ListingSeoTab'

vi.mock('@/api/client', () => ({
  api: {
    getListingSeo: vi.fn().mockResolvedValue({
      property_id: 'prop_1',
      seo_page: {
        title: 'Test Villa in Dubai Marina',
        meta_description: 'A beautiful villa with marina views and modern finishes in the heart of Dubai Marina district for discerning buyers.',
        slug: 'test-villa-dubai',
        canonical_url: 'https://example.com/property/prop_1',
        schema_jsonld: { '@type': 'RealEstateListing', name: 'Test Villa' },
        og_tags: { 'og:title': 'Test Villa' },
      },
      target: {
        target_surface: 'agency_white_label',
        can_toggle: false,
        available_surfaces: ['agency_white_label'],
      },
      recommendations: {
        score: 75,
        grade: 'ok',
        recommendations: [
          { id: 'title_length', severity: 'success', message: 'Title length is optimal', field: 'title' },
        ],
      },
      is_external: false,
      is_wingcaster_served: true,
    }),
    getListingSeoExport: vi.fn(),
    updateListingSeo: vi.fn(),
    generateListingSeo: vi.fn(),
    setListingSeoTarget: vi.fn(),
  },
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

describe('ListingSeoTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders SEO panel with metadata fields after load', async () => {
    render(<ListingSeoTab listingId="prop_1" />)
    await waitFor(() => {
      expect(screen.getByText('SEO & Search')).toBeInTheDocument()
      expect(screen.getByLabelText('Title')).toHaveValue('Test Villa in Dubai Marina')
      expect(screen.getByText('JSON-LD preview')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
    })
  })
})
