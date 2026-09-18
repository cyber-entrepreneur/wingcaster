// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { GenerateDescriptionModal } from './GenerateDescriptionModal'

const apiMock = vi.hoisted(() => ({
  describeListingFromPhotos: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

const baseInput = {
  photoUrls: ['https://example.com/photo.jpg'],
  hints: { city: 'Dubai', type: 'sale' as const },
}

function renderModal(onApply = vi.fn()) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <GenerateDescriptionModal open input={baseInput} onClose={vi.fn()} onApply={onApply} />
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.describeListingFromPhotos.mockReset()
  apiMock.describeListingFromPhotos.mockResolvedValue({
    property: {
      title: 'Marina Gate 1',
      description: 'Stunning apartment with marina views.',
      confidence: 0.9,
      amenities: [],
      features: [],
      type: 'sale',
      property_type: 'apartment',
      price: null,
      price_unit: null,
      bedrooms: 2,
      bathrooms: 2,
      area: 1200,
      area_unit: 'sqft',
      location: null,
      city: 'Dubai',
      neighborhood: null,
      address: null,
      furnished: null,
    },
    provider: 'claude',
    change_summary: null,
  })
})

afterEach(() => cleanup())

describe('GenerateDescriptionModal (AGT-LAI-001)', () => {
  it('renders tone options, credit preview, and AGT-LAI-001 marker', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toHaveAttribute('data-screen', 'AGT-LAI-001')
    expect(screen.getByText(/1 AI credit/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Warm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Luxury/i })).toBeInTheDocument()
  })

  it('generates with agent notes and shows Apply', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Pool/i }))
    await user.click(screen.getByTestId('generate-description-submit'))

    await waitFor(() => {
      expect(apiMock.describeListingFromPhotos).toHaveBeenCalledWith(
        expect.objectContaining({
          photo_urls: baseInput.photoUrls,
          hints: expect.objectContaining({
            notes: expect.stringMatching(/Tone: professional.*Pool/i),
          }),
        }),
      )
    })
    expect(await screen.findByTestId('generate-description-apply')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Marina Gate 1')).toBeInTheDocument()
  })

  it('shows insufficient-credits state', async () => {
    const user = userEvent.setup()
    apiMock.describeListingFromPhotos.mockRejectedValue({ code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' })
    renderModal()
    await user.click(screen.getByTestId('generate-description-submit'))
    expect(await screen.findByText(/need more AI credits/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Top up credits/i })).toHaveAttribute('href', '/my-credits')
  })
})
