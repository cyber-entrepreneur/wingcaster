// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CanonicalResolutionQueuePage } from './CanonicalResolutionQueuePage'
import { CanonicalResolutionDetailPage } from './CanonicalResolutionDetailPage'

const apiMock = vi.hoisted(() => ({
  getAdminCanonicalResolutionQueue: vi.fn(async () => ({
    items: [{
      id: 'c1',
      address: '123 Main',
      sibling_count: 2,
      dispute_count: 1,
      on_hold: false,
      primary_agency_name: 'Elite',
    }],
  })),
  getAdminCanonicalResolution: vi.fn(async () => ({
    canonical: {
      id: 'c1',
      location: '123 Main',
      on_hold: false,
      dispute_count: 1,
      siblings: [{ id: 'p1', title: 'Listing A', is_primary: true, agency_name: 'Elite' }],
    },
  })),
  postAdminCanonicalChangePrimary: vi.fn(async () => ({})),
  postAdminCanonicalSplit: vi.fn(async () => ({})),
  postAdminCanonicalMerge: vi.fn(async () => ({})),
  postAdminCanonicalHold: vi.fn(async () => ({})),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, agent: { id: 'admin-1', platform_role: 'platform_admin' } }),
}))

describe('PA-PVA-011 canonical resolution pages', () => {
  beforeEach(() => {
    cleanup()
    apiMock.getAdminCanonicalResolutionQueue.mockClear()
    apiMock.getAdminCanonicalResolution.mockClear()
  })

  it('queue page renders for platform admin', async () => {
    render(
      <MemoryRouter>
        <CanonicalResolutionQueuePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })?.textContent).toBe('Canonical property resolution')
    expect(await screen.findByText('123 Main')).toBeTruthy()
  })

  it('detail page renders decision panel', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/pricing/canonical/c1']}>
        <Routes>
          <Route path="/admin/pricing/canonical/:id" element={<CanonicalResolutionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Decision panel')).toBeTruthy()
    expect(await screen.findByText('Listing A')).toBeTruthy()
  })
})
