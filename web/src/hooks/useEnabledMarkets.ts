import { useEffect, useState } from 'react'
import { api } from '@/api/client'

/**
 * Enabled market codes (PA-controlled, migration 804). Returns `null` until
 * loaded — and stays `null` if the endpoint is unavailable — so callers treat
 * `null` as "no filter" (show all supported markets) and degrade gracefully.
 */
export function useEnabledMarkets(): string[] | null {
  const [codes, setCodes] = useState<string[] | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.getEnabledMarkets?.()
        if (!cancelled && res && Array.isArray(res.codes)) setCodes(res.codes)
      } catch {
        /* leave null → callers show all markets */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return codes
}
