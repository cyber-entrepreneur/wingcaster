// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ToastProvider } from '@/components/ui/toast'
import { AiConfigsPage } from './AiConfigsPage'
import type { AiScoringConfig } from './aiConfigTypes'

expect.extend(toHaveNoViolations)

const config: AiScoringConfig = {
  id: 'cfg-1',
  name: 'Area quality synthesis',
  description: 'Scores verified neighborhood signals.',
  provider: 'gemini',
  model: 'gemini-1.5-flash',
  temperature: 0.3,
  max_tokens: 2048,
  system_prompt: 'You are a careful location intelligence analyst.',
  scoring_prompt_template: 'Analyze {{signals_json}} for {{area_name}} and score {{dimension_name}}.',
  output_schema: {},
  is_active: true,
  version: 3,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-18T10:00:00Z',
}

const apiMock = vi.hoisted(() => ({
  listAdminAiConfigs: vi.fn(),
  createAdminAiConfig: vi.fn(),
  updateAdminAiConfig: vi.fn(),
  listAdminAiConfigVersions: vi.fn(),
  previewAdminAiConfig: vi.fn(),
  listAdminAreas: vi.fn(),
  listAdminDimensions: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    runElevated: async (action: () => Promise<unknown>) => action(),
  }),
}))

function renderPage(dir: 'ltr' | 'rtl' = 'ltr') {
  return render(
    <div dir={dir}>
      <MemoryRouter>
        <ToastProvider>
          <AiConfigsPage />
        </ToastProvider>
      </MemoryRouter>
    </div>,
  )
}

beforeEach(() => {
  apiMock.listAdminAiConfigs.mockResolvedValue({ items: [config] })
  apiMock.createAdminAiConfig.mockResolvedValue({ ...config, id: 'cfg-2', version: 1 })
  apiMock.updateAdminAiConfig.mockResolvedValue({ ...config, version: 4 })
  apiMock.listAdminAiConfigVersions.mockResolvedValue({
    items: [
      {
        id: 'version-3',
        config_id: config.id,
        version: 3,
        snapshot: config,
        created_by: 'admin-1',
        created_at: config.updated_at,
      },
    ],
  })
  apiMock.listAdminAreas.mockResolvedValue({
    items: [{ id: 'area-1', name: 'Dubai Marina', status: 'scoring_enabled' }],
  })
  apiMock.listAdminDimensions.mockResolvedValue({
    items: [{ id: 'dimension-1', name: 'Walkability', slug: 'walkability', is_active: true }],
  })
  apiMock.previewAdminAiConfig.mockResolvedValue({
    config_id: config.id,
    config_version: 3,
    area: { id: 'area-1', name: 'Dubai Marina' },
    dimension: { id: 'dimension-1', name: 'Walkability' },
    result: { score: 8.4, confidence: 0.92, rationale: 'Strong transit and amenity coverage.' },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AiConfigsPage (PA-SCR-002)', () => {
  it('renders versioned configs and opens history', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(config.name)).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Versions' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Version/)).toBeTruthy()
    expect(apiMock.listAdminAiConfigVersions).toHaveBeenCalledWith(config.id)
  })

  it('edits a config as a new prompt version', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(config.name)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    const model = within(dialog).getByLabelText('Model')
    await user.clear(model)
    await user.type(model, 'gemini-2.5-flash')
    await user.click(within(dialog).getByRole('button', { name: 'Save new version' }))

    await waitFor(() =>
      expect(apiMock.updateAdminAiConfig).toHaveBeenCalledWith(
        config.id,
        expect.objectContaining({ model: 'gemini-2.5-flash' }),
      ),
    )
  })

  it('runs a metered preview against a sample area and dimension', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(config.name)

    await user.click(screen.getByRole('button', { name: 'Preview' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByLabelText('Sample area')
    await user.click(within(dialog).getByRole('button', { name: 'Run metered preview' }))

    expect(await within(dialog).findByText('8.4')).toBeTruthy()
    expect(within(dialog).getByText('92%')).toBeTruthy()
    expect(apiMock.previewAdminAiConfig).toHaveBeenCalledWith(config.id, {
      area_id: 'area-1',
      dimension_id: 'dimension-1',
    })
  })

  it('supports error recovery and empty state', async () => {
    const user = userEvent.setup()
    apiMock.listAdminAiConfigs.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ items: [] })
    renderPage()

    expect(await screen.findByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No AI configs yet')).toBeTruthy()
  })

  it('has no accessibility violations in RTL', async () => {
    const { container } = renderPage('rtl')
    await screen.findByText(config.name)
    expect(await axe(container)).toHaveNoViolations()
  })
})
