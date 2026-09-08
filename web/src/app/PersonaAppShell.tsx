import type { ReactNode } from 'react'
import { AgentAppShell } from '@/app/AgentAppShell'
import { AgencyAppShell } from '@/app/AgencyAppShell'
import { PaAppShell } from '@/app/PaAppShell'
import { resolvePersona } from '@/app/resolvePersona'
import { useAuth } from '@/context/AuthContext'
import type { NavPersona } from '@/components/nav/GlobalSearch'

export interface PersonaAppShellProps {
  children: ReactNode
  /** Test override — skips AuthContext persona resolution. */
  persona?: NavPersona
  className?: string
  viewport?: 'mobile' | 'tablet' | 'desktop'
}

/**
 * Selects Agent / Agency / PA chrome from `useAuth()` (AuthContext).
 * Equivalent to the brief's `useSession().persona` — this app exposes persona
 * via `agent` + `isAdmin` rather than a dedicated session hook.
 */
export function PersonaAppShell({
  children,
  persona: personaProp,
  className,
  viewport,
}: PersonaAppShellProps) {
  const { agent, isAdmin, loading } = useAuth()
  const persona = personaProp ?? resolvePersona(agent, isAdmin)

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--lc-bg-page)] text-sm text-[var(--lc-text-muted)]"
        role="status"
        aria-live="polite"
      >
        Loading…
      </div>
    )
  }

  if (!persona) {
    return <>{children}</>
  }

  if (persona === 'pa') {
    return (
      <PaAppShell className={className} viewport={viewport}>
        {children}
      </PaAppShell>
    )
  }

  if (persona === 'agency') {
    return (
      <AgencyAppShell className={className} viewport={viewport}>
        {children}
      </AgencyAppShell>
    )
  }

  return (
    <AgentAppShell className={className} viewport={viewport}>
      {children}
    </AgentAppShell>
  )
}
