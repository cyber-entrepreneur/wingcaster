import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer } from 'vaul'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import type { OnboardingChecklistItem, OnboardingState } from '@/components/onboarding'
import type {
  OnboardingChecklistFlags,
  OnboardingStatePatch,
} from '@/components/onboarding/useOnboardingState'
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
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { t, type OnboardingLocale } from './copy'
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

function defaultItems(locale: OnboardingLocale): OnboardingChecklistItem[] {
  return [
    {
      key: 'first_listing_published',
      label: t('checklist.step.publish', locale),
      sub: t('checklist.step.publish.sub', locale),
      href: '/onboarding/welcome',
    },
    {
      key: 'channels_connected',
      label: t('checklist.step.channels', locale),
      sub: t('checklist.step.channels.sub', locale),
      href: '/settings/channels',
    },
    {
      key: 'notifications_enabled',
      label: t('checklist.step.notifications', locale),
      sub: t('checklist.step.notifications.sub', locale),
      href: '/notifications',
    },
    {
      key: 'profile_completed',
      label: t('checklist.step.profile', locale),
      sub: t('checklist.step.profile.sub', locale),
      href: '/settings/profile',
    },
    {
      key: 'subscription_active',
      label: t('checklist.step.upgrade', locale),
      sub: t('checklist.step.upgrade.sub', locale),
      optional: true,
      href: '/plans',
    },
  ]
}

export interface OnboardingChecklistWidgetProps {
  /** `card` = guided dashboard Zone 3; `pill` = Pro top-bar compact. */
  variant?: 'card' | 'pill'
  /**
   * Optional state override from a parent that already owns `useOnboardingState`.
   * When `state === undefined`, the widget calls the hook itself.
   */
  state?: OnboardingState
  patch?: (body: OnboardingStatePatch) => Promise<OnboardingState>
  isLoading?: boolean
  isError?: boolean
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

export function OnboardingChecklistWidget(props: OnboardingChecklistWidgetProps) {
  if (props.state !== undefined) {
    return (
      <OnboardingChecklistWidgetView
        {...props}
        state={props.state}
        patch={props.patch}
        isLoading={props.isLoading ?? false}
        isError={props.isError ?? false}
      />
    )
  }
  return <OnboardingChecklistWidgetWithHook {...props} />
}

function OnboardingChecklistWidgetWithHook(props: OnboardingChecklistWidgetProps) {
  const hooked = useOnboardingState()
  return (
    <OnboardingChecklistWidgetView
      {...props}
      state={hooked.state}
      patch={hooked.patch}
      isLoading={hooked.isLoading}
      isError={hooked.isError}
      completedVia={hooked.completedVia}
    />
  )
}

async function missingPatch(): Promise<OnboardingState> {
  throw new Error('OnboardingChecklistWidget: patch() required when state is provided')
}

function OnboardingChecklistWidgetView({
  variant = 'card',
  state,
  patch: patchProp,
  isLoading = false,
  isError = false,
  completedVia,
  className,
}: OnboardingChecklistWidgetProps & {
  state: OnboardingState
  patch?: (body: OnboardingStatePatch) => Promise<OnboardingState>
  isLoading?: boolean
  isError?: boolean
  completedVia?: (stepId: string) => string | null
}) {
  const patch = patchProp ?? missingPatch
  const { isArabic } = useLocale()
  const onbLocale: OnboardingLocale = isArabic ? 'ar' : 'en'
  const navigate = useNavigate()
  const { addToast } = useToast()
  const reducedMotion = usePrefersReducedMotion()

  const [dismissOpen, setDismissOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [fading, setFading] = useState(false)

  const { completed, total } = mainChecklistCounts(state.checklist)
  const allDone = completed >= total
  const remaining = Math.max(0, total - completed)
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  const viaFn = completedVia

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
      defaultItems(onbLocale).map((item) => {
        const source = viaFn?.(item.key) ?? null
        const via = source
          ? `Completed via ${COMPLETED_VIA_LABELS[source] ?? source}`
          : completedViaCaption(state, item.key)
        return via ? { ...item, sub: via } : item
      }),
    [viaFn, onbLocale, state],
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
        description: t('checklist.dismiss.toast', onbLocale),
        duration: 5000,
      })
      setDismissOpen(false)
    } catch (error) {
      if (isPatchConflict(error)) {
        setDismissOpen(false)
        return
      }
      addToast({ variant: 'error', description: t('checklist.error.patch', onbLocale) })
    }
  }

  if (isError) return null
  if (isLoading) {
    return (
      <div
        className={cn(
          'h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]',
          variant === 'pill' && 'h-11 min-h-tap w-16',
          className,
        )}
        aria-busy="true"
        data-onboarding-checklist-skeleton
      />
    )
  }

  if (!shouldRenderOnboardingChecklist(state) && !allDone) return null
  if (state.dismissed_forever || fading) return null

  const title = t('checklist.title', onbLocale)
  const card = (
    <OnboardingChecklistCard
      state={state}
      items={items}
      title={title}
      defaultExpanded={readSessionFlag(ONB_CHECKLIST_EXPANDED_KEY) !== '0'}
      onDismissForever={() => setDismissOpen(true)}
      onStepTap={onStepTap}
      className={className}
    />
  )

  const dialog = (
    <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('checklist.dismiss.title', onbLocale)}</DialogTitle>
          <DialogDescription>{t('checklist.dismiss.body', onbLocale)}</DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setDismissOpen(false)}>
            {t('checklist.dismiss.cancel', onbLocale)}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirmDismiss()}>
            {t('checklist.dismiss.confirm', onbLocale)}
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
          aria-label={t('checklist.pill.aria', onbLocale, { completed, total })}
          className={className}
        />
        <Drawer.Root open={sheetOpen} onOpenChange={setSheetOpen} direction="right">
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-overlay lc-overlay" />
            <Drawer.Content
              role="dialog"
              aria-modal="true"
              aria-label={t('checklist.region', onbLocale)}
              className="fixed inset-y-0 end-0 z-modal flex h-full w-full max-w-[400px] flex-col border-s border-[var(--lc-border)] bg-[var(--lc-surface-raised)] outline-none"
            >
              <Drawer.Title className="sr-only">{title}</Drawer.Title>
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
      aria-label={t('checklist.region', onbLocale)}
      className={cn(reducedMotion ? undefined : 'transition-opacity duration-slow', className)}
      data-checklist-pct={pct}
      data-checklist-remaining={remaining}
    >
      {card}
      {dialog}
    </div>
  )
}
