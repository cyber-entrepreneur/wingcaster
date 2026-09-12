import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * In-app leave guard for `<BrowserRouter>` (RR `useBlocker` needs a data router).
 * Catches sidebar NavLinks, back/forward, and in-app `<Link>`s. Tab close /
 * refresh still uses `beforeunload`.
 */
export function useRouteLeaveGuard(enabled: boolean, onBlock: () => void) {
  const navigate = useNavigate()
  const pendingHref = useRef<string | null>(null)
  const popped = useRef(false)
  const bypassRef = useRef(false)
  const onBlockRef = useRef(onBlock)
  onBlockRef.current = onBlock

  useEffect(() => {
    if (!enabled) return

    const onClick = (event: MouseEvent) => {
      if (bypassRef.current) return
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const next = `${url.pathname}${url.search}`
      const current = `${window.location.pathname}${window.location.search}`
      if (next === current) return
      event.preventDefault()
      event.stopPropagation()
      pendingHref.current = next
      onBlockRef.current()
    }

    const onPopState = () => {
      if (bypassRef.current) return
      popped.current = true
      window.history.pushState(null, '', window.location.href)
      onBlockRef.current()
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [enabled])

  return {
    proceed: (fallback?: string) => {
      bypassRef.current = true
      if (pendingHref.current) {
        const href = pendingHref.current
        pendingHref.current = null
        navigate(href)
        return
      }
      if (popped.current) {
        popped.current = false
        window.history.back()
        return
      }
      if (fallback) navigate(fallback)
    },
    reset: () => {
      pendingHref.current = null
      popped.current = false
    },
    allowNext: () => {
      bypassRef.current = true
    },
  }
}
