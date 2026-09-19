// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { FeatureRegistryPage } from './FeatureRegistryPage'
import type { MeteredFeature } from '@/pages/admin/packages/types'

const sampleFeature: MeteredFeature = {
  id: 'f1',
  code: 'publishing.social.instagram',
  display_name: 'Instagram publish',
  category: 'publishing.social',
  meter_unit: 'post',
  active: true,
  credits_per_unit: 120,
}

const apiMock = vi.hoisted(() => ({
  listFeatures: vi.fn(),
  getFeature: vi.fn(),
  patchFeature: vi.fn(),
}))

vi.mock('@/pages/admin/packages/api', () => ({
  packagesApi: apiMock,
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    runElevated: async (action: () => Promise<unknown>) => action(),
  }),
}))
vi.mock('@/hooks/useEnv', () => ({ useEnv: () => ({ env: 'live' as const }) }))

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <FeatureRegistryPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.listFeatures.mockResolvedValue({ features: [sampleFeature] })
  apiMock.getFeature.mockResolvedValue(sampleFeature)
  apiMock.patchFeature.mockResolvedValue({ ...sampleFeature, display_name: 'Instagram (updated)' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('FeatureRegistryPage (PA-PKG-007)', () => {
  it('loads and renders the feature registry table', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /Feature registry/i })).toBeInTheDocument()
    expect(await screen.findByText('publishing.social.instagram')).toBeInTheDocument()
    expect(screen.getByText('Instagram publish')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View pricing/i })).toHaveAttribute(
      'href',
      '/admin/fin/pricing?feature=publishing.social.instagram',
    )
  })

  it('opens detail modal and patches display name with reason', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Instagram publish')
    await user.click(screen.getByText('Instagram publish'))

    const dialog = await screen.findByRole('dialog')
    await user.clear(within(dialog).getByLabelText(/Display name/i))
    await user.type(within(dialog).getByLabelText(/Display name/i), 'Instagram (updated)')
    await user.type(within(dialog).getByLabelText(/Reason/i), 'Copy refresh')
    await user.click(within(dialog).getByRole('button', { name: /Save changes/i }))

    await waitFor(() =>
      expect(apiMock.patchFeature).toHaveBeenCalledWith('f1', {
        display_name: 'Instagram (updated)',
        reason: 'Copy refresh',
      }),
    )
  })

  it('shows backend wiring guidance in Add feature dialog', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: /Feature registry/i })
    await user.click(screen.getByRole('button', { name: /Add feature/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/code and database event/i)).toBeInTheDocument()
  })
})
