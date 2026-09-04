import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_BRAND, type BrandConfig } from '@/config/brand'
import {
  applyLcMode,
  persistLcMode,
  readStoredLcMode,
  type LcColorMode,
} from '@/theme/mode'

interface BrandContextValue {
  brand: BrandConfig
  setBrand: (next: Partial<BrandConfig>) => void
  loading: boolean
  colorMode: LcColorMode
  setColorMode: (mode: LcColorMode) => void
}

const BrandContext = createContext<BrandContextValue>({
  brand: DEFAULT_BRAND,
  setBrand: () => {},
  loading: false,
  colorMode: 'light',
  setColorMode: () => {},
})

const STORAGE_KEY = 'wingcaster.brand'

function loadCached(): BrandConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_BRAND
    return { ...DEFAULT_BRAND, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_BRAND
  }
}

function syncDocument(brand: BrandConfig) {
  if (typeof document === 'undefined') return
  document.title = brand.name
  const link = document.getElementById('brand-favicon') as HTMLLinkElement | null
  if (link && brand.iconUrl) link.href = brand.iconUrl
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrandState] = useState<BrandConfig>(() => loadCached())
  const [loading, setLoading] = useState(true)
  const [colorMode, setColorModeState] = useState<LcColorMode>(() => readStoredLcMode())

  useEffect(() => {
    applyLcMode(colorMode)
  }, [colorMode])

  useEffect(() => {
    if (colorMode !== 'system' || typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyLcMode('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [colorMode])

  useEffect(() => {
    let cancelled = false
    async function fetchBrand() {
      try {
        const res = await fetch('/api/brand', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const next = { ...DEFAULT_BRAND, ...data }
        setBrandState(next)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* offline / not yet available — keep cached or defaults */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchBrand()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    syncDocument(brand)
  }, [brand])

  const setBrand = (next: Partial<BrandConfig>) => {
    setBrandState((prev) => {
      const merged = { ...prev, ...next }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      return merged
    })
  }

  const setColorMode = (mode: LcColorMode) => {
    persistLcMode(mode)
    setColorModeState(mode)
  }

  const value = useMemo(
    () => ({ brand, setBrand, loading, colorMode, setColorMode }),
    [brand, loading, colorMode],
  )

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function useBrand() {
  return useContext(BrandContext)
}
