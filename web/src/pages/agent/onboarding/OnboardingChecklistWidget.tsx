import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer } from 'vaul'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import type { OnboardingChecklistItem, OnboardingState } from '@/components/onboarding'
import type { OnboardingChecklistFlags } from '@/components/onboarding/useOnboardingState'
import { OnboardingChecklistCard, OnboardingPill } from '@/components/onboarding'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { trackOnboardingEvent } from './onboardingApi'
import { usePrefersReducedMotion } from './useOnlineStatus'
import {
  completedViaCaption,
  COMPLETED_VIA_LABELS,
  isPatchConflict,
  mainChecklistCounts,
  ONB_CHECKLIST_EXPANDED_KEY,
  readSessionFlag,
  shouldRenderOnboardingChecklist,
} from './helpers'

export { shouldRenderOnboardingChecklist } from './helpers'

const STEP_HREFS: Record<keyof OnboardingChecklistFlags, string> = {
  welcome_seen: '/onboarding/welcome',
  first_listing_drafted: '/onboarding/welcome',
  first_listing_published: '/onboarding/welcome',
  channels_connected: '/settings/channels',
  notifications_enabled: '/notifications',
  profile_completed: '/settings/profile',
  subscription_active: '/plans',
}

const DEFAULT_ITEMS: OnboardingChecklistItem[] = [
  {
    key: 'first_listing_published',
    label: 'Publish your first listing',
    sub: '2 min via WhatsApp',
    href: '/onboarding/welcome',
  },
  {
    key: 'channels_connected',
    label: 'Connect a publishing channel',
    sub: 'Instagram, Facebook, Messenger, portals',
    href: '/settings/channels',
  },
  {
    key: 'notifications_enabled',
    label: 'Turn on notifications',
    sub: 'Never miss a new lead',
    href: '/notifications',
  },
  {
    key: 'profile_completed',
    label: 'Complete your public profile',
    sub: 'Photo, bio, contact — for your Bazaar profile',
    href: '/settings/profile',
  },
  {
    key: 'subscription_active',
    label: 'Upgrade to paid',
    sub: 'Unlock unlimited listings and portal integrations',
    optional: true,
    href: '/plans',
  },
]

export interface OnboardingChecklistWidgetProps {
  /** `card` = guided dashboard Zone 3; `pill` = Pro top-bar compact. */
  variant?: 'card' | 'pill'
  /** Optional state override (tests / Phase B). Defaults to hook state. */
  state?: OnboardingState
  className?: string
}

function hrefForStep(state: OnboardingState, key: keyof OnboardingChecklistFlags): string {
  if (key === 'first_listing_published') {
    if (state.step === 'whatsapp_intake_pending') return '/onboarding/whatsapp'
    if (state.step === 'draft_review') return '/onboarding/welcome'
    return '/onboarding/welcome'
  }
  return STEP_HREFS[key]
}

export function OnboardingChecklistWidget({
  variant = 'card',
  state: stateProp,
  className,
}: OnboardingChecklistWidgetProps) {
  const hooked = useOnboardingState()
  const state = stateProp ?? hooked.state
  const { patch, isLoading, isError, completedVia } = hooked as typeof hooked & {
    completedVia?: (stepId: string) => string | null
  }
  const navigate = useNavigate()
  const { addToast } = useToast()
  const reducedMotion = usePrefersReducedMotion()

  const [dismissOpen, setDismissOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [fading, setFading] = useState(false)

  const { completed, total } = mainChecklistCounts(state.checklist)
  const allDone = completed >= total

  useEffect(() => {
    if (isLoading || isError) return
    if (!shouldRenderOnboardingChecklist(state) && !allDone) return
    trackOnboardingEvent('onboarding.checklist_rendered', { variant, completed, total })
  }, [allDone, completed, isError, isLoading, state, total, variant])

  useEffect(() => {
    if (!allDone || state.dismissed_forever) return
    const delay = reducedMotion ? 0 : 800
    const id = window.setTimeout(() => {
      setFading(true)
      void patch({ dismissed_forever: true }).catch(() => {
        setFading(false)
      })
    }, delay)
    return () => window.clearTimeout(id)
  }, [allDone, patch, reducedMotion, state.dismissed_forever])

  const items = useMemo(
    () =>
      DEFAULT_ITEMS.map((item) => {
        const source = completedVia?.(item.key) ?? null
        const via = source
          ? `Completed via ${COMPLETED_VIA_LABELS[source] ?? source}`
          : completedViaCaption(state, item.key)
        return via ? { ...item, sub: via } : item
      }),
    [completedVia, state],
  )

  const onStepTap = (key: keyof OnboardingChecklistFlags) => {
    trackOnboardingEvent('onboarding.checklist_step_tapped', { key })
    navigate(hrefForStep(state, key))
  }

  const confirmDismiss = async () => {
    try {
      await patch({ dismissed_forever: true })
      trackOnboardingEvent('onboarding.checklist_dismissed')
      addToast({
        description: 'Checklist dismissed. Bring it back from Settings → Onboarding progress.',
        duration: 5000,
      })
      setDismissOpen(false)
    } catch (error) {
      if (isPatchConflict(error)) {
        setDismissOpen(false)
        return
      }
      addToast({ variant: 'error', description: "We couldn't save that. Try again?" })
    }
  }

  if (isError) return null
  if (isLoading && !stateProp) {
    return (
      <div
        className={cn(
          'h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]',
          variant === 'pill' && 'h-8 w-16',
          className,
        )}
        aria-busy="true"
        data-onboarding-checklist-skeleton
      />
    )
  }

  if (!shouldRenderOnboardingChecklist(state) && !allDone) return null
  if (state.dismissed_forever || fading) return null

  const card = (
    <OnboardingChecklistCard
      state={state}
      items={items}
      defaultExpanded={readSessionFlag(ONB_CHECKLIST_EXPANDED_KEY) !== '0'}
      // Expand/collapse persistence is owned by the card; Phase B may wrap.
      onDismissForever={() => setDismissOpen(true)}
      onStepTap={onStepTap}
      className={className}
    />
  )

  const dialog = (
    <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dismiss this checklist?</DialogTitle>
          <DialogDescription>
            You can bring it back from Settings → Onboarding progress.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setDismissOpen(false)}>
            Keep it
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirmDismiss()}>
            Yes, dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  if (variant === 'pill') {
    return (
      <>
        <OnboardingPill
          completed={completed}
          total={total}
          onClick={() => setSheetOpen(true)}
          aria-label={`Onboarding progress: ${completed} of ${total} steps complete. Open checklist.`}
          className={className}
        />
        <Drawer.Root open={sheetOpen} onOpenChange={setSheetOpen} direction="right">
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-overlay lc-overlay" />
            <Drawer.Content
              role="dialog"
              aria-modal="true"
              aria-label="Onboarding progress"
              className="fixed inset-y-0 end-0 z-modal flex h-full w-full max-w-[400px] flex-col border-s border-[var(--lc-border)] bg-[var(--lc-surface-raised)] outline-none"
            >
              <Drawer.Title className="sr-only">Finish setting up</Drawer.Title>
              <div className="overflow-y-auto p-[var(--lc-space-lg)]">{card}</div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
        {dialog}
      </>
    )
  }

  return (
    <div
      role="region"
      aria-label="Onboarding progress"
      className={cn(reducedMotion ? undefined : 'transition-opacity duration-slow', className)}
    >
      {card}
      {dialog}
    </div>
  )
}
