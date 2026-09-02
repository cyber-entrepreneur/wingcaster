// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PackageVersionEditor } from './PackageVersionEditor'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, agent: { id: 'admin-1', platform_role: 'platform_admin' } }),
}))

const posts: string[] = []

const server = setupServer(
  http.get('/api/admin/fin/metered-features', () => HttpResponse.json({
    features: [{
      id: 'f-ig', code: 'publishing.social.instagram', display_name: 'Instagram publish',
      category: 'publishing.social', meter_unit: 'post', credits_per_unit: 100,
    }],
  })),
  http.get('/api/admin/fin/packages/:id/versions/:vid', () => HttpResponse.json({
    id: 'v1', package_id: 'p1', state: 'DRAFT', package_display_name: 'Starter',
    version_number: 1, properties_covered: 1, monthly_price_minor: 100,
    tier: 'starter', target_audience: 'agent', quotas: [], flags: [],
  })),
  http.patch('/api/admin/fin/packages/:id/versions/:vid', async ({ request }) => {
    posts.push(`PATCH ${new URL(request.url).pathname}`)
    return HttpResponse.json({ id: 'v1', state: 'DRAFT' })
  }),
  http.post('/api/admin/fin/packages/:id/versions/:vid/quotas', async ({ request }) => {
    posts.push(`POST quotas`)
    return HttpResponse.json(await request.json())
  }),
  http.post('/api/admin/fin/packages/:id/versions/:vid/flags', async () => {
    posts.push('POST flags')
    return HttpResponse.json({ enabled: true })
  }),
  http.delete('/api/admin/fin/packages/:id/versions/:vid/flags/:code', () => HttpResponse.json({ ok: true })),
  http.post('/api/admin/fin/packages/:id/versions/:vid/submit-for-approval', async () => {
    posts.push('submit-for-approval')
    return HttpResponse.json({ version: { state: 'PENDING_APPROVAL' } })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  posts.length = 0
  server.resetHandlers()
})
afterAll(() => server.close())

describe('PackageVersionEditor compose + submit (MSW)', () => {
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
    await waitFor(() => expect(posts).toContain('submit-for-approval'))
    expect(posts).toContain('POST quotas')
  })
})
