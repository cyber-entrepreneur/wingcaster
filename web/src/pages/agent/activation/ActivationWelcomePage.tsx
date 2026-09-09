import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/usePageTitle'
import { ActivationChrome, ActivationFooterHelper } from './components/ActivationChrome'
import { LockedInfoDialog } from './components/LockedInfoDialog'
import { StepCard } from './components/StepCard'
import { stepLockHelper } from './copy'
import type { ActivationStep } from './types'
import { useActivationState } from './useActivationState'

function featureHref(step: ActivationStep): string {
  switch (step.id) {
    case 'whatsapp':
      return '/settings/channels'
    case 'first_listing':
      return '/listings'
    case 'portal_credentials':
      return '/settings/channels'
    case 'working_hours':
      return '/notifications'
    case 'invite_team':
      return '/agency'
    default:
      return step.sub_route || '/activate'
  }
}

export function ActivationWelcomePage() {
  usePageTitle('Activation wizard')
  const navigate = useNavigate()
  const location = useLocation()
  const { state, isLoading, isError, refresh, defer, completedCount, totalCount } =
    useActivationState()
  const [locked, setLocked] = useState<{ title: string; helper: string } | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const prevCompleted = useRef<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const fromQuery = params.get('celebrate') === '1'
    const fromState = Boolean(
      (location.state as { celebrate?: boolean } | null)?.celebrate,
    )
    if (!state) return
    const prev = prevCompleted.current
    const crossed =
      prev !== null && prev === totalCount - 1 && completedCount === totalCount && totalCount > 0
    if (fromQuery || fromState || crossed) {
      setCelebrate(true)
    }
    prevCompleted.current = completedCount
  }, [completedCount, location.search, location.state, state, totalCount])

  if (isLoading) {
    return (
      <ActivationChrome completed={0} total={0}>
        <div className="mb-[var(--lc-space-lg)] h-8 w-2/3 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
        <div className="mb-[var(--lc-space-xl)] h-[6px] animate-pulse rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)]" />
        <div className="grid grid-cols-1 gap-[var(--lc-space-lg)] md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[200px] animate-pulse rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]"
            />
          ))}
        </div>
      </ActivationChrome>
    )
  }

  if (isError || !state) {
    return (
      <ActivationChrome completed={0} total={0}>
        <div
          role="alert"
          className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-sm)]"
        >
          <h1 className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            We couldn&apos;t load your activation progress. Try again in a moment.
          </h1>
          <Button type="button" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </ActivationChrome>
    )
  }

  const allComplete = completedCount === totalCount && totalCount > 0

  const handlePrimary = (step: ActivationStep) => {
    if (step.state === 'locked') {
      setLocked({
        title: step.id === 'invite_team' ? 'Invite team' : 'Not available yet',
        helper: stepLockHelper(step, state.signup_path) || 'Available soon',
      })
      return
    }
    if (step.state === 'complete') {
      navigate(featureHref(step))
      return
    }
    navigate(step.sub_route)
  }

  return (
    <ActivationChrome
      completed={completedCount}
      total={totalCount}
      celebrate={celebrate}
      hero={
        <>
          <h1
            className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-display)' }}
          >
            Unlock every WingCaster feature
          </h1>
          <p
            className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-lg)' }}
          >
            Five short steps get you from account-created to fully activated. Do them in any order — your
            progress saves automatically.
          </p>
        </>
      }
      footer={<ActivationFooterHelper promoteDashboard={allComplete} />}
    >
      <div className="grid grid-cols-1 gap-[var(--lc-space-lg)] md:grid-cols-2 lg:grid-cols-3">
        {state.steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            signupPath={state.signup_path}
            onPrimary={() => handlePrimary(step)}
            onDefer={
              step.state === 'not_started' || step.state === 'in_progress'
                ? () => void defer(step.id)
                : undefined
            }
            onResume={() => navigate(step.sub_route)}
          />
        ))}
      </div>

      <LockedInfoDialog
        open={Boolean(locked)}
        onOpenChange={(open) => {
          if (!open) setLocked(null)
        }}
        title={locked?.title || ''}
        helper={locked?.helper || ''}
      />
    </ActivationChrome>
  )
}
