import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TourFrame, type TourFrameStep } from '@/components/onboarding/whatsapp'
import { OfflineBanner } from '@/components/onboarding'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { markWhatsAppDeferred } from './tour'
import { markWhatsAppIntakeProgress } from './useOnboardingState'

interface WhatsAppTourShellProps {
  step: TourFrameStep
  title: string
  children: ReactNode
  hideFrame?: boolean
  offline?: boolean
  offlineMessage?: string
}

export function WhatsAppTourShell({
  step,
  title,
  children,
  hideFrame,
  offline = false,
  offlineMessage = "You're offline — connect to set up WhatsApp.",
}: WhatsAppTourShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const onboarding = useOnboardingState()
  const settings = hideFrame ?? location.pathname.startsWith('/settings/')

  const onExit = () => {
    markWhatsAppDeferred()
    void markWhatsAppIntakeProgress(onboarding, { kind: 'deferred' })
    navigate('/dashboard')
  }

  const body = (
    <>
      <OfflineBanner show={offline} message={offlineMessage} />
      {children}
    </>
  )

  if (settings) {
    return <div className="min-h-full bg-[var(--lc-surface)] text-[var(--lc-text-primary)]">{body}</div>
  }

  return (
    <TourFrame step={step} totalSteps={5} title={title} onExit={onExit}>
      {body}
    </TourFrame>
  )
}

export function StickyCtaBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-10 border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] pt-[var(--lc-space-sm)] shadow-[var(--lc-elevation-md)] md:static md:border-0 md:bg-transparent md:px-0 md:pt-0 md:shadow-none"
      style={{ paddingBottom: 'max(var(--lc-space-md), env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  )
}
