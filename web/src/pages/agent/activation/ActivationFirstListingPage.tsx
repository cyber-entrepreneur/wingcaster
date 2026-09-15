import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Keyboard, Lock } from 'lucide-react'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { ActivationChrome } from './components/ActivationChrome'
import { act, completedViaPhrase, type ActivationLocale } from './copy'
import { completedCaption } from './format'
import { useActivationState } from './useActivationState'

export function ActivationFirstListingPage() {
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  usePageTitle(act('listing.pageTitle', locale))
  const navigate = useNavigate()
  const { state, isLoading, complete, defer, completedCount, totalCount } = useActivationState()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const listingStep = state?.steps.find((s) => s.id === 'first_listing')
  const whatsappStep = state?.steps.find((s) => s.id === 'whatsapp')
  const alreadyComplete = listingStep?.state === 'complete'
  const whatsappBound = whatsappStep?.state === 'complete'

  const goBack = (nextCompleted?: number) => {
    const total = totalCount
    const prev = completedCount
    const done = nextCompleted ?? completedCount
    const celebrate = total > 0 && prev === total - 1 && done === total
    navigate(celebrate ? '/activate?celebrate=1' : '/activate')
  }

  if (isLoading || !state) {
    return (
      <ActivationChrome
        breadcrumb={{ step: 2, title: act('listing.breadcrumb', locale) }}
        completed={0}
        total={0}
        progressSize="sm"
        maxWidthClass="max-w-[720px]"
      >
        <div className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
      </ActivationChrome>
    )
  }

  return (
    <ActivationChrome
      breadcrumb={{ step: 2, title: act('listing.breadcrumb', locale) }}
      completed={completedCount}
      total={totalCount}
      progressSize="sm"
      maxWidthClass="max-w-[720px]"
    >
      {alreadyComplete ? (
        <>
          <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {listingStep?.completed_via
              ? act('listing.alreadyVia', locale, {
                  when: completedCaption(listingStep?.completed_via, listingStep?.completed_at, locale),
                  source: completedViaPhrase(listingStep.completed_via, locale),
                })
              : act('listing.already', locale, {
                  when: completedCaption(listingStep?.completed_via, listingStep?.completed_at, locale),
                })}
          </p>
          <div className="flex flex-col gap-[var(--lc-space-sm)] sm:flex-row">
            <Button type="button" onClick={() => goBack()}>
              {act('common.returnWizard', locale)}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link to="/listings">{act('listing.seeListings', locale)}</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <h1
            className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)' }}
          >
            {act('listing.h1', locale)}
          </h1>
          <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
            {act('listing.sub', locale)}
          </p>

          <div className="grid grid-cols-1 gap-[var(--lc-space-lg)] sm:grid-cols-2">
            <div className="flex flex-col rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]">
              <Keyboard className="mb-[var(--lc-space-md)] h-10 w-10 text-[var(--lc-text-heading)]" aria-hidden="true" />
              <h2 className="mb-[var(--lc-space-xs)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                {act('listing.typeTitle', locale)}
              </h2>
              <p className="mb-[var(--lc-space-sm)] flex-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                {act('listing.typeDesc', locale)}
              </p>
              <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                ~<Numeric>5</Numeric> {locale === 'ar' ? 'دقائق' : 'minutes'}
              </p>
              <Button type="button" onClick={() => navigate('/listings/new?source=activation')}>
                {act('listing.typeCta', locale)}
              </Button>
            </div>

            <div
              className={
                whatsappBound
                  ? 'flex flex-col rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]'
                  : 'flex flex-col rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] opacity-60 shadow-[var(--lc-elevation-sm)]'
              }
              data-voice-locked={!whatsappBound ? 'true' : undefined}
            >
              {whatsappBound ? (
                <ChannelMark channel="whatsapp" className="mb-[var(--lc-space-md)] h-10 w-10" />
              ) : (
                <Lock className="mb-[var(--lc-space-md)] h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
              )}
              <h2 className="mb-[var(--lc-space-xs)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                {act('listing.voiceTitle', locale)}
              </h2>
              <p className="mb-[var(--lc-space-sm)] flex-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                {act('listing.voiceDesc', locale)}
              </p>
              <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                ~
                <Numeric>90</Numeric>
                {locale === 'ar' ? ' ثانية' : ' seconds'}
              </p>
              {whatsappBound ? (
                <Button
                  type="button"
                  onClick={() => navigate('/whatsapp/onboarding/voice-intake?source=activation')}
                >
                  {act('listing.voiceCta', locale)}
                </Button>
              ) : (
                <p style={{ font: 'var(--lc-type-caption)' }} className="text-[var(--lc-text-muted)]">
                  {act('listing.voiceLocked', locale)}{' '}
                  <Link to="/activate/whatsapp" className="text-[var(--lc-text-brand)] hover:underline">
                    {act('listing.voiceLockedLink', locale)}
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="mt-[var(--lc-space-xl)] space-y-[var(--lc-space-sm)]">
            <button
              type="button"
              className="min-h-tap text-start text-[var(--lc-text-muted)] hover:text-[var(--lc-text-brand)]"
              style={{ font: 'var(--lc-type-caption)' }}
              onClick={() => setConfirmOpen(true)}
            >
              {act('listing.altMark', locale)}{' '}
              <span className="text-[var(--lc-text-brand)]">{act('listing.altMarkCta', locale)}</span>
            </button>
            <div>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await defer('first_listing')
                  navigate('/activate')
                }}
              >
                {act('common.later', locale)}
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{act('listing.confirmTitle', locale)}</DialogTitle>
            <DialogDescription>{act('listing.confirmBody', locale)}</DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-lg)] flex flex-col-reverse gap-[var(--lc-space-sm)] sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              {act('common.cancel', locale)}
            </Button>
            <Button
              type="button"
              autoFocus
              onClick={async () => {
                const next = await complete('first_listing', 'direct')
                const done = next.steps.filter((s) => s.state === 'complete').length
                setConfirmOpen(false)
                goBack(done)
              }}
            >
              {act('listing.confirmYes', locale)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ActivationChrome>
  )
}
