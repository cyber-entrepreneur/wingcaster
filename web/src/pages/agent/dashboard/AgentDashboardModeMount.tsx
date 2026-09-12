import { lazy, Suspense, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useUiMode } from '@/hooks/useUiMode'

/** Stable path for Agent 1 (`feat/wave-8-pro`) — lazy so Guided stays the default chunk. */
const ProDashboard = lazy(() =>
  import('@/pages/agent/dashboard/ProDashboard').then((m) => ({ default: m.ProDashboard })),
)

export interface AgentDashboardModeMountProps {
  /** When true, mount Pro; otherwise render `guided`. */
  shouldRenderPro: boolean
  agentName?: string
  guided: ReactNode
}

/**
 * D-S-06 mount branch: Pro only when caller passes shouldRenderPro
 * (ui_mode=pro AND viewport ≥768px). Server ui_mode is not mutated here.
 */
export function AgentDashboardModeMount({
  shouldRenderPro,
  agentName,
  guided,
}: AgentDashboardModeMountProps) {
  if (shouldRenderPro) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center" data-dashboard-mode="pro-loading">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <ProDashboard greetingName={agentName} />
      </Suspense>
    )
  }

  return <>{guided}</>
}

/**
 * Wired mount used by `AgentDashboardPage` — kept separate so mount tests
 * do not need to import the Guided dashboard module graph.
 */
export function AgentDashboardProGate({ guided }: { guided: ReactNode }) {
  const { agent } = useAuth()
  const { shouldRenderPro } = useUiMode()
  const agentName = typeof agent?.name === 'string' ? agent.name : undefined

  return (
    <AgentDashboardModeMount
      shouldRenderPro={shouldRenderPro}
      agentName={agentName}
      guided={guided}
    />
  )
}
