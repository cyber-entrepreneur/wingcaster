// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { DEFAULT_PRO_LAYOUT } from '@/hooks/useDashboardLayout'

const toast = vi.hoisted(() => ({ addToast: vi.fn() }))
const api = vi.hoisted(() => ({
  getDashboardLayout: vi.fn(),
  patchDashboardLayout: vi.fn(),
  getListPrefs: vi.fn(),
  patchListPrefs: vi.fn(),
  getProNudge: vi.fn(),
  dismissProNudge: vi.fn(),
  getSavedViews: vi.fn(),
  createSavedView: vi.fn(),
  updateSavedView: vi.fn(),
  deleteSavedView: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => toast,
}))

vi.mock('@/api/client', () => ({
  api,
  API_BASE: '/api',
}))

describe('useDashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getDashboardLayout.mockResolvedValue({
      layout: [{ i: 'urgent', x: 0, y: 0, w: 8, h: 3 }],
      density: 'comfortable',
      updated_at: '2026-09-01T00:00:00.000Z',
      tenant_id: 'personal:u1',
    })
    api.patchDashboardLayout.mockResolvedValue({
      layout: [{ i: 'urgent', x: 1, y: 0, w: 8, h: 3 }],
      density: 'compact',
      updated_at: '2026-09-01T00:01:00.000Z',
      tenant_id: 'personal:u1',
    })
  })

  it('loads layout from server and persists on setLayout (debounced)', async () => {
    const { useDashboardLayout } = await import('@/hooks/useDashboardLayout')
    const { result } = renderHook(() => useDashboardLayout('personal:u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.layout[0].i).toBe('urgent')

    act(() => {
      result.current.setLayout([{ i: 'urgent', x: 2, y: 0, w: 8, h: 3 }])
      result.current.setDensity('compact')
    })

    await waitFor(() => expect(api.patchDashboardLayout).toHaveBeenCalled(), { timeout: 2000 })
    expect(api.patchDashboardLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'personal:u1',
        density: 'compact',
      }),
    )
  })

  it('resetLayout restores defaults', async () => {
    const { useDashboardLayout } = await import('@/hooks/useDashboardLayout')
    const { result } = renderHook(() => useDashboardLayout('personal:u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.resetLayout()
    })

    await waitFor(() =>
      expect(api.patchDashboardLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: expect.arrayContaining([
            expect.objectContaining({ i: DEFAULT_PRO_LAYOUT[0].i }),
          ]),
        }),
      ),
    )
  })
})

describe('useListPrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getListPrefs.mockResolvedValue({
      listings: { columns: ['hrid', 'title', 'price'], density: 'compact', widths: { title: 240 } },
      updated_at: null,
      tenant_id: 't1',
    })
    api.patchListPrefs.mockResolvedValue({
      listings: { columns: ['hrid', 'title'], density: 'compact', widths: { title: 240 } },
      updated_at: 'now',
      tenant_id: 't1',
    })
  })

  it('loads and saves list prefs', async () => {
    const { useListPrefs } = await import('@/hooks/useListPrefs')
    const { result } = renderHook(() => useListPrefs('t1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.prefs.columns).toEqual(['hrid', 'title', 'price'])

    await act(async () => {
      await result.current.savePrefs({ columns: ['hrid', 'title'] })
    })
    expect(api.patchListPrefs).toHaveBeenCalledWith(
      expect.objectContaining({ columns: ['hrid', 'title'] }),
    )
  })
})

describe('useSavedViews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getSavedViews.mockResolvedValue({ views: [] })
    api.createSavedView.mockResolvedValue({
      id: 'sv_abc',
      name: 'My view',
      resource: 'listings',
      owner_user_id: 'u1',
      shared_with_tenant: false,
      filter: {},
      sort: [],
      column_prefs: {},
    })
    api.updateSavedView.mockResolvedValue({
      id: 'sv_abc',
      name: 'Renamed',
      resource: 'listings',
      owner_user_id: 'u1',
      shared_with_tenant: true,
      filter: {},
      sort: [],
      column_prefs: {},
    })
    api.deleteSavedView.mockResolvedValue({ success: true })
  })

  it('creates renames and deletes views', async () => {
    const { useSavedViews } = await import('@/hooks/useSavedViews')
    const { result } = renderHook(() => useSavedViews('t1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createView({ name: 'My view' })
    })
    expect(result.current.views.some((v) => v.id === 'sv_abc')).toBe(true)

    await act(async () => {
      await result.current.renameView('sv_abc', 'Renamed')
    })
    expect(api.updateSavedView).toHaveBeenCalledWith('t1', 'sv_abc', { name: 'Renamed' })

    await act(async () => {
      await result.current.deleteView('sv_abc')
    })
    expect(api.deleteSavedView).toHaveBeenCalledWith('t1', 'sv_abc')
  })
})
