// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PackageVersionEditor } from './PackageVersionEditor'

const apiMock = vi.hoisted(() => ({
  finGet: vi.fn(),
  finPost: vi.fn(),
  finPatch: vi.fn(),
  finDelete: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: apiMock }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, agent: { id: 'admin-1', platform_role: 'platform_admin' } }),
}))

const seededVersion = {
  id: 'v1', package_id: 'p1', state: 'DRAFT', package_display_name: 'Starter',
  version_number: 1, properties_covered: 1, monthly_price_minor: 100,
  tier: 'starter', target_audience: 'agent', quotas: [], flags: [],
}

const seededFeatures = {
  features: [{
    id: 'f-ig', code: 'publishing.social.instagram', display_name: 'Instagram publish',
    category: 'publishing.social', meter_unit: 'post', credits_per_unit: 100,
  }],
}

beforeEach(() => {
  apiMock.finGet.mockReset()
  apiMock.finPost.mockReset()
  apiMock.finPatch.mockReset()
  apiMock.finDelete.mockReset()
  apiMock.finGet.mockImplementation(async (path: string) => {
    if (path.includes('/metered-features')) return seededFeatures
    if (path.match(/\/packages\/[^/]+\/versions\/[^/]+$/)) return seededVersion
    return {}
  })
  apiMock.finPatch.mockResolvedValue({ id: 'v1', state: 'DRAFT' })
  apiMock.finPost.mockImplementation(async (_path: string, body: unknown) => body || { ok: true })
  apiMock.finDelete.mockResolvedValue({ ok: true })
})

describe('PackageVersionEditor compose + submit', () => {
  it('PA adds a quota and submits the draft for approval', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin/fin/packages/p1/versions/v1']}>
        <Routes>
          <Route path="/admin/fin/packages/:id/versions/:vid" element={<PackageVersionEditor />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: 'Submit for approval' })).toBeTruthy()
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))
    await waitFor(() => {
      const paths = apiMock.finPost.mock.calls.map(([path]) => path as string)
      expect(paths.some((p) => p.includes('/submit-for-approval'))).toBe(true)
      expect(paths.some((p) => p.includes('/quotas'))).toBe(true)
    })
  })
})
