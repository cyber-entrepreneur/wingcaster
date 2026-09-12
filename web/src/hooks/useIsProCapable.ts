import { useEffect, useState } from 'react'

/** D-S-06: Pro variants render only at viewport ≥768px. */
export const PRO_VIEWPORT_MQ = '(min-width: 768px)'

/**
 * True when the viewport can render Pro UI (≥768px).
 * Below this breakpoint, Guided renders even if server `ui_mode === 'pro'`.
 */
export function useIsProCapable(forced?: boolean): boolean {
  const [capable, setCapable] = useState(() => {
    if (typeof forced === 'boolean') return forced
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(PRO_VIEWPORT_MQ).matches
  })

  useEffect(() => {
    if (typeof forced === 'boolean') {
      setCapable(forced)
      return
    }
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(PRO_VIEWPORT_MQ)
    const update = () => setCapable(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [forced])

  return capable
}
