import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_BRAND, type BrandConfig } from '@/config/brand'
import {
  applyLcMode,
  persistLcMode,
  readStoredLcMode,
  LC_BRAND_STORAGE_KEY,
  type LcColorMode,
} from '@/theme/mode'

interface BrandContextValue {
  brand: BrandConfig
  setBrand: (next: Partial<BrandConfig>) => void
  loading: boolean
  mode: LcColorMode
  setMode: (mode: LcColorMode) => void
}

const BrandContext = createContext<BrandContextValue>({
  brand: DEFAULT_BRAND,
  setBrand: () => {},
  loading: false,
  mode: 'system',
  setMode: () => {},
})

function loadCachedBrand(): BrandConfig {
  try {
    const raw = localStorage.getItem(LC_BRAND_STORAGE_KEY)
    if (!raw) return DEFAULT_BRAND
    const parsed = JSON.parse(raw) as Partial<BrandConfig> & { mode?: unknown }
    const { mode: _mode, ...rest } = parsed
    return { ...DEFAULT_BRAND, ...rest }
  } catch {
    return DEFAULT_BRAND
  }
}

function writeCache(brand: BrandConfig, mode: LcColorMode) {
  try {
    localStorage.setItem(LC_BRAND_STORAGE_KEY, JSON.stringify({ ...brand, mode }))
  } catch {
    /* private mode / blocked storage */
  }
}

function syncDocument(brand: BrandConfig) {
  if (typeof document === 'undefined') return
  document.title = brand.name
  const link = document.getElementById('brand-favicon') as HTMLLinkElement | null
  if (link && brand.iconUrl) link.href = brand.iconUrl
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrandState] = useState<BrandConfig>(() => loadCachedBrand())
  const [loading, setLoading] = useState(true)
  const [mode, setModeState] = useState<LcColorMode>(() => readStoredLcMode())

  useEffect(() => {
    applyLcMode(mode)
  }, [mode])

  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyLcMode('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

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
        writeCache(next, readStoredLcMode())
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
      writeCache(merged, mode)
      return merged
    })
  }

  const setMode = (next: LcColorMode) => {
    persistLcMode(next)
    writeCache(brand, next)
    setModeState(next)
  }

  const value = useMemo(
    () => ({ brand, setBrand, loading, mode, setMode }),
    [brand, loading, mode],
  )

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function useBrand() {
  return useContext(BrandContext)
}

/** Colour-mode tuple used by chrome (navbar toggle, settings). */
export function useMode(): [LcColorMode, (mode: LcColorMode) => void] {
  const { mode, setMode } = useBrand()
  return [mode, setMode]
}
