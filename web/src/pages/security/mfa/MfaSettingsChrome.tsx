import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * SettingsPage already wraps `/settings/*` in `<SettingsShell>`.
 * MFA pages must not mount a second shell when nested in that Outlet.
 */
export function MfaSettingsChrome({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/**
 * SettingsShell mounts `{children}` twice (desktop pane + mobile pane).
 * Render dialogs only from the desktop copy so Radix does not stack two modals.
 */
export function SettingsDialogHost({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [allow, setAllow] = useState(true)
  useLayoutEffect(() => {
    if (ref.current?.closest('[data-settings-pane-mobile]')) {
      setAllow(false)
    }
  }, [])
  return (
    <div ref={ref} className="contents">
      {allow ? children : null}
    </div>
  )
}
