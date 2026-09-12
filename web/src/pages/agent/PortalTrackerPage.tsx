import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PortalTrackerScreen } from '@/components/publishing/PortalTrackerScreen'
import {
  filtersFromSearchParams,
  filtersToSearchParams,
} from '@/components/publishing/PortalTrackerScreen/api'
import type { TrackerFilters } from '@/components/publishing/PortalTrackerScreen/types'

/**
 * AGT-PUB-006 — Portal submission tracker (cross-listing ledger).
 * Route: /publish/tracker
 */
export function PortalTrackerPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<TrackerFilters>(() =>
    filtersFromSearchParams(searchParams),
  )
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Hydrate filters when the URL changes (back/forward / shareable links).
  useEffect(() => {
    setFilters(filtersFromSearchParams(searchParams))
  }, [searchParams])

  const onFiltersChange = useCallback(
    (next: TrackerFilters) => {
      setFilters(next)
      setSearchParams(filtersToSearchParams(next), { replace: true })
    },
    [setSearchParams],
  )

  const onNavigate = useCallback(
    (path: string) => {
      navigate(path)
    },
    [navigate],
  )

  return (
    <PortalTrackerScreen
      filters={filters}
      onFiltersChange={onFiltersChange}
      onNavigate={onNavigate}
      online={online}
    />
  )
}

export default PortalTrackerPage
