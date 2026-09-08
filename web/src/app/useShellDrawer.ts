import { useEffect, useState } from 'react'
import {
  readDrawerCollapsedPref,
  type DrawerMode,
} from '@/components/nav/SideDrawer'

export type ShellViewport = 'mobile' | 'tablet' | 'desktop'

export function useShellViewport(): ShellViewport {
  const [bucket, setBucket] = useState<ShellViewport>(() => {
    if (typeof window === 'undefined') return 'desktop'
    if (window.matchMedia('(min-width: 1024px)').matches) return 'desktop'
    if (window.matchMedia('(min-width: 768px)').matches) return 'tablet'
    return 'mobile'
  })

  useEffect(() => {
    const mqDesktop = window.matchMedia('(min-width: 1024px)')
    const mqTablet = window.matchMedia('(min-width: 768px)')
    const update = () => {
      if (mqDesktop.matches) setBucket('desktop')
      else if (mqTablet.matches) setBucket('tablet')
      else setBucket('mobile')
    }
    update()
    mqDesktop.addEventListener('change', update)
    mqTablet.addEventListener('change', update)
    return () => {
      mqDesktop.removeEventListener('change', update)
      mqTablet.removeEventListener('change', update)
    }
  }, [])

  return bucket
}

function defaultModeForViewport(viewport: ShellViewport): DrawerMode {
  if (viewport === 'mobile') return 'closed'
  if (viewport === 'tablet') return 'rail'
  return readDrawerCollapsedPref() ? 'rail' : 'expanded'
}

/**
 * Drawer mode synced to viewport breakpoints (brief defaults).
 * Desktop: expanded (or user rail pref). Tablet: rail. Mobile: closed (overlay on demand).
 */
export function useShellDrawer(options?: { forceDesktop?: boolean }) {
  const viewport = useShellViewport()
  const effectiveViewport: ShellViewport = options?.forceDesktop ? 'desktop' : viewport
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(() =>
    defaultModeForViewport(effectiveViewport),
  )

  useEffect(() => {
    setDrawerMode((prev) => {
      const next = defaultModeForViewport(effectiveViewport)
      // Preserve overlay while open on mobile; otherwise adopt breakpoint default.
      if (effectiveViewport === 'mobile' && prev === 'overlay') return prev
      return next
    })
  }, [effectiveViewport])

  return { viewport: effectiveViewport, drawerMode, setDrawerMode }
}
