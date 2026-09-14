import type { ReactNode } from 'react'

/**
 * SettingsPage already wraps `/settings/*` in `<SettingsShell>`.
 * MFA pages must not mount a second shell when nested in that Outlet.
 */
export function MfaSettingsChrome({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/**
 * SettingsShell mounts children once inside `<main data-settings-pane="desktop"|"mobile">`.
 * Dialogs can render unconditionally from this host.
 */
export function SettingsDialogHost({ children }: { children: ReactNode }) {
  return <>{children}</>
}
