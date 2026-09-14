import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import type { DashboardDensity } from '@/pages/agent/dashboard/pro/ProDashboardParts'

export type LayoutItem = {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export const DEFAULT_PRO_LAYOUT: LayoutItem[] = [
  { i: 'kpi-active', x: 0, y: 0, w: 3, h: 2, minW: 3, minH: 2 },
  { i: 'kpi-views', x: 3, y: 0, w: 3, h: 2, minW: 3, minH: 2 },
  { i: 'kpi-inquiries', x: 6, y: 0, w: 3, h: 2, minW: 3, minH: 2 },
  { i: 'kpi-pipeline', x: 9, y: 0, w: 3, h: 2, minW: 3, minH: 2 },
  { i: 'urgent', x: 0, y: 2, w: 8, h: 3, minW: 4, minH: 2 },
  { i: 'quota', x: 8, y: 2, w: 4, h: 3, minW: 3, minH: 2 },
  { i: 'recent-listings', x: 0, y: 5, w: 6, h: 3, minW: 4, minH: 2 },
  { i: 'inbox-preview', x: 6, y: 5, w: 6, h: 3, minW: 4, minH: 2 },
  { i: 'tasks', x: 0, y: 8, w: 6, h: 3, minW: 4, minH: 2 },
  { i: 'funnel', x: 6, y: 8, w: 6, h: 3, minW: 4, minH: 2 },
  { i: 'activity', x: 0, y: 11, w: 12, h: 3, minW: 6, minH: 2 },
]

export type SaveState = 'idle' | 'saving' | 'saved'

export interface UseDashboardLayoutResult {
  layout: LayoutItem[]
  density: DashboardDensity
  saveState: SaveState
  loading: boolean
  setLayout: (next: LayoutItem[]) => void
  setDensity: (next: DashboardDensity) => void
  resetLayout: () => void
  removeWidget: (id: string) => void
  addWidget: (id: string, defaults?: Partial<LayoutItem>) => void
  reload: () => Promise<void>
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const wrapped = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer)
  }
  return wrapped
}

/**
 * AGT-DSH-002 — reads/writes dashboard layout via PATCH /api/users/me/dashboard-layout.
 * Debounces saves 300ms after drop/resize; retries up to 3× on failure.
 */
export function useDashboardLayout(tenantId?: string | null): UseDashboardLayoutResult {
  const { addToast } = useToast()
  const [layout, setLayoutState] = useState<LayoutItem[]>(DEFAULT_PRO_LAYOUT)
  const [density, setDensityState] = useState<DashboardDensity>('comfortable')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [loading, setLoading] = useState(true)
  const knownUpdatedAt = useRef<string | null>(null)
  const retryCount = useRef(0)

  const persist = useCallback(
    async (nextLayout: LayoutItem[], nextDensity: DashboardDensity) => {
      setSaveState('saving')
      try {
        const res = await api.patchDashboardLayout({
          tenant_id: tenantId || undefined,
          layout: nextLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
          density: nextDensity,
        })
        knownUpdatedAt.current = res.updated_at
        retryCount.current = 0
        setSaveState('saved')
        window.setTimeout(() => setSaveState('idle'), 1000)
      } catch {
        retryCount.current += 1
        if (retryCount.current <= 3) {
          addToast({
            title: "Layout couldn't save. Retrying…",
            variant: 'error',
          })
          window.setTimeout(() => {
            void persist(nextLayout, nextDensity)
          }, 500 * retryCount.current)
        } else {
          setSaveState('idle')
          addToast({
            title: 'Layout not saved. Try again?',
            description: 'Your arrangement may not sync across devices.',
            variant: 'error',
          })
        }
      }
    },
    [addToast, tenantId],
  )

  const debouncedPersist = useRef(
    debounce((nextLayout: LayoutItem[], nextDensity: DashboardDensity) => {
      void persist(nextLayout, nextDensity)
    }, 300),
  )

  useEffect(() => {
    debouncedPersist.current = debounce((nextLayout: LayoutItem[], nextDensity: DashboardDensity) => {
      void persist(nextLayout, nextDensity)
    }, 300)
    return () => debouncedPersist.current.cancel()
  }, [persist])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getDashboardLayout(tenantId || undefined)
      if (Array.isArray(res.layout) && res.layout.length > 0) {
        setLayoutState(res.layout as LayoutItem[])
      } else {
        setLayoutState(DEFAULT_PRO_LAYOUT)
      }
      setDensityState(res.density || 'comfortable')
      if (
        knownUpdatedAt.current &&
        res.updated_at &&
        knownUpdatedAt.current !== res.updated_at
      ) {
        addToast({
          title: 'Your layout changed on another device. Refresh to see the latest.',
          variant: 'default',
        })
      }
      knownUpdatedAt.current = res.updated_at
    } catch {
      setLayoutState(DEFAULT_PRO_LAYOUT)
    } finally {
      setLoading(false)
    }
  }, [addToast, tenantId])

  useEffect(() => {
    void reload()
  }, [reload])

  const setLayout = useCallback(
    (next: LayoutItem[]) => {
      setLayoutState(next)
      debouncedPersist.current(next, density)
    },
    [density],
  )

  const setDensity = useCallback(
    (next: DashboardDensity) => {
      setDensityState(next)
      debouncedPersist.current(layout, next)
    },
    [layout],
  )

  const resetLayout = useCallback(() => {
    setLayoutState(DEFAULT_PRO_LAYOUT)
    void persist(DEFAULT_PRO_LAYOUT, density)
  }, [density, persist])

  const removeWidget = useCallback(
    (id: string) => {
      const next = layout.filter((item) => item.i !== id)
      setLayout(next)
    },
    [layout, setLayout],
  )

  const addWidget = useCallback(
    (id: string, defaults?: Partial<LayoutItem>) => {
      if (layout.some((item) => item.i === id)) return
      const maxY = layout.reduce((m, item) => Math.max(m, item.y + item.h), 0)
      const next: LayoutItem[] = [
        ...layout,
        {
          i: id,
          x: 0,
          y: maxY,
          w: defaults?.w ?? 6,
          h: defaults?.h ?? 3,
          minW: defaults?.minW ?? 3,
          minH: defaults?.minH ?? 2,
        },
      ]
      setLayout(next)
    },
    [layout, setLayout],
  )

  return {
    layout,
    density,
    saveState,
    loading,
    setLayout,
    setDensity,
    resetLayout,
    removeWidget,
    addWidget,
    reload,
  }
}
