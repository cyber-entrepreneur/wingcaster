import { useEffect, useState } from 'react'

/**
 * Soft-keyboard visibility via the Visual Viewport API.
 * True when the visible viewport is meaningfully shorter than the layout
 * viewport (threshold: 100px), so the agent bottom tab bar can hide.
 */
export function useVisualViewportKeyboardVisible(): boolean {
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const update = () => {
      const vv = window.visualViewport
      if (!vv) {
        setKeyboardVisible(false)
        return
      }
      setKeyboardVisible(vv.height < window.innerHeight - 100)
    }

    update()

    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return keyboardVisible
}
