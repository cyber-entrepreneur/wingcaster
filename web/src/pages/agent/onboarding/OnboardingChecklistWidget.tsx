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
  first_listing_drafted: '/listings/new',
  first_listing_published: '/onboarding/welcome',
  markets_set: '/onboarding/markets',
  channels_connected: '/settings/channels',
  comms_connected: '/settings/channels',
  // TODO: point at the dedicated post composer once the Creative surface is routed.
  first_post_designed: '/marketing',
  notifications_enabled: '/notification-preferences',
  profile_completed: '/settings/profile',
  subscription_active: '/plans',
}

function defaultItems(locale: OnboardingLocale): OnboardingChecklistItem[] {
  // Full flow: who you are → cast (social) → reply (comms) → notifications →
  // list a property (manual / bulk / integrate) → design a post → publish → upgrade.
  return [
    {
      key: 'profile_completed',
      label: t('checklist.step.profile', locale),
      sub: t('checklist.step.profile.sub', locale),
      href: '/settings/profile',
    },
    {
      key: 'markets_set',
      label: t('checklist.step.markets', locale),
      sub: t('checklist.step.markets.sub', locale),
      href: '/onboarding/markets',
    },
    {
      key: 'channels_connected',
      label: t('checklist.step.channels', locale),
      sub: t('checklist.step.channels.sub', locale),
      href: '/settings/channels',
    },
    {
      key: 'comms_connected',
      label: t('checklist.step.comms', locale),
      sub: t('checklist.step.comms.sub', locale),
      href: '/settings/channels',
    },
    {
      key: 'notifications_enabled',
      label: t('checklist.step.notifications', locale),
      sub: t('checklist.step.notifications.sub', locale),
      href: '/notification-preferences',
    },
    {
      key: 'first_listing_drafted',
      label: t('checklist.step.listing', locale),
      sub: t('checklist.step.listing.sub', locale),
      href: '/listings/new',
    },
    {
      key: 'first_post_designed',
      label: t('checklist.step.designpost', locale),
      sub: t('checklist.step.designpost.sub', locale),
      href: '/marketing',
    },
    {
      key: 'first_listing_published',
      label: t('checklist.step.publish', locale),
      sub: t('checklist.step.publish.sub', locale),
      href: '/onboarding/welcome',
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
  const [listingChooserOpen, setListingChooserOpen] = useState(false)
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
    // "List your property" opens a chooser: manual / bulk / integrate.
    if (key === 'first_listing_drafted') {
      setListingChooserOpen(true)
      return
    }
    navigate(hrefForStep(state, key))
  }

  const chooseListingMethod = (method: 'manual' | 'bulk' | 'integrate', href: string) => {
    trackOnboardingEvent('onboarding.listing_method_chosen', { method })
    setListingChooserOpen(false)
    navigate(href)
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

  const listingChooser = (
    <Dialog open={listingChooserOpen} onOpenChange={setListingChooserOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('checklist.listing.chooser.title', onbLocale)}</DialogTitle>
          <DialogDescription>{t('checklist.listing.chooser.sub', onbLocale)}</DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--lc-space-md)] flex flex-col gap-[var(--lc-space-sm)]">
          {(
            [
              {
                method: 'manual',
                href: '/listings/new',
                label: t('checklist.listing.manual', onbLocale),
                desc: t('checklist.listing.manual.desc', onbLocale),
              },
              {
                method: 'bulk',
                // TODO: dedicated bulk-import route; onboarding welcome hosts CSV/Excel import today.
                href: '/onboarding/welcome',
                label: t('checklist.listing.bulk', onbLocale),
                desc: t('checklist.listing.bulk.desc', onbLocale),
              },
              {
                method: 'integrate',
                href: '/integrations',
                label: t('checklist.listing.integrate', onbLocale),
                desc: t('checklist.listing.integrate.desc', onbLocale),
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.method}
              type="button"
              onClick={() => chooseListingMethod(opt.method, opt.href)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-[var(--lc-space-md)] text-start',
                'bg-[var(--lc-surface-raised)] transition-colors duration-[var(--lc-duration-fast)] ease-out',
                'hover:border-[var(--lc-action-primary)] hover:bg-[color-mix(in_srgb,var(--lc-action-primary)_6%,var(--lc-surface-raised))]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-action-primary)]',
              )}
            >
              <span
                className="text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-body-lg)', fontWeight: 600 }}
              >
                {opt.label}
              </span>
              <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                {opt.desc}
              </span>
            </button>
          ))}
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
        {listingChooser}
      </>
    )
  }

  // Card already exposes role="region" aria-label="Onboarding progress" (AGT-ONB-005).
  return (
    <div
      className={cn(reducedMotion ? undefined : 'transition-opacity duration-slow', className)}
      data-checklist-pct={pct}
      data-checklist-remaining={remaining}
    >
      {card}
      {dialog}
      {listingChooser}
    </div>
  )
}
