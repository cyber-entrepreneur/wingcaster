import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import {
  CelebrationHeader,
  IntakePathCard,
  OfflineBanner,
  SignalLampDot,
  SparkleBurst,
} from '@/components/onboarding'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { OnboardingChrome } from './OnboardingChrome'
import { fireOnboardingConfetti, prefersReducedMotion } from './confetti'
import { getPublishedListing, trackOnboardingEvent, type PublishedListingThumb } from './onboardingApi'
import { useOnlineStatus, usePrefersReducedMotion } from './useOnlineStatus'
import {
  elapsedMinutesSince,
  firstNameOf,
  isPatchConflict,
  ONB_CELEBRATION_LISTING_KEY,
  ONB_CONFETTI_KEY,
  readSessionFlag,
  writeSessionFlag,
} from './helpers'

function loadStoredListing(): PublishedListingThumb | null {
  const raw = readSessionFlag(ONB_CELEBRATION_LISTING_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PublishedListingThumb
  } catch {
    return null
  }
}

export function CelebrationPage() {
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { addToast } = useToast()
  const { state, patch } = useOnboardingState()
  const online = useOnlineStatus()
  const reducedMotion = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)

  const [listing, setListing] = useState<PublishedListingThumb | null>(() => loadStoredListing())
  const [thumbLoading, setThumbLoading] = useState(() => Boolean(loadStoredListing()?.id))
  const [hideThumb, setHideThumb] = useState(false)

  usePageTitle("You're set")

  const firstName = firstNameOf(agent?.name)
  const elapsed = elapsedMinutesSince(state.started_at)

  let sub: string
  if (firstName && elapsed != null) {
    sub = `${firstName} — you turned a voice memo into a live listing in ${elapsed} minutes.`
  } else if (firstName) {
    sub = `${firstName} — you just turned a voice memo into a live listing.`
  } else if (elapsed != null) {
    sub = `You turned a voice memo into a live listing in ${elapsed} minutes.`
  } else {
    sub = 'You just turned a voice memo into a live listing.'
  }

  useEffect(() => {
    let cancelled = false
    void patch({
      step: 'complete',
      checklist_delta: { first_listing_published: true },
    }).catch((error) => {
      if (cancelled || isPatchConflict(error)) return
      addToast({
        variant: 'error',
        description: "Nice work — but we couldn't save your progress. Your listing is still live.",
      })
    })
    trackOnboardingEvent('onboarding.completed')
    return () => {
      cancelled = true
    }
  }, [addToast, patch])

  useEffect(() => {
    if (readSessionFlag(ONB_CONFETTI_KEY) === 'true') return undefined
    writeSessionFlag(ONB_CONFETTI_KEY, 'true')
    if (prefersReducedMotion() || !rootRef.current) return undefined
    return fireOnboardingConfetti(rootRef.current)
  }, [])

  useEffect(() => {
    const id = listing?.id
    if (!id) {
      setThumbLoading(false)
      return
    }
    let cancelled = false
    void getPublishedListing(id)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setHideThumb(true)
          trackOnboardingEvent('onboarding.celebration_thumbnail_missing', { property_id: id })
          return
        }
        setListing(data)
      })
      .catch(() => {
        if (!cancelled) setHideThumb(true)
      })
      .finally(() => {
        if (!cancelled) setThumbLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [listing?.id])

  const goListing = () => {
    if (!listing?.id) return
    const href = `/listings/${listing.id}`
    if (window.matchMedia('(min-width: 768px)').matches) {
      window.open(href, '_blank', 'noopener,noreferrer')
    } else {
      navigate(href)
    }
  }

  const goDashboard = (deferred: boolean) => {
    if (deferred) trackOnboardingEvent('onboarding.next_action_deferred')
    else trackOnboardingEvent('onboarding.next_action_selected', { action_id: 'dashboard' })
    navigate('/dashboard')
  }

  const goInstagram = async () => {
    trackOnboardingEvent('onboarding.next_action_selected', { action_id: 'instagram' })
    try {
      await patch({ checklist_delta: { channels_connected: true } })
    } catch {
      /* non-blocking */
    }
    navigate('/settings/channels')
  }

  const goChannels = async () => {
    trackOnboardingEvent('onboarding.next_action_selected', { action_id: 'channels' })
    navigate('/settings/channels')
  }

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]"
    >
      <OfflineBanner
        show={!online}
        message="You're offline. Your listing is live; next actions will work once you reconnect."
      />
      <OnboardingChrome step={4} label="You're set" complete />

      <div className="mx-auto flex max-w-[720px] flex-col gap-[var(--lc-space-lg)] px-[var(--lc-space-md)] py-[var(--lc-space-lg)] md:px-[var(--lc-space-xl)]">
        <div role="status" aria-live="polite">
          <CelebrationHeader
            tone="loud"
            title="Your first listing is live!"
            body={sub}
            illustration={
              reducedMotion ? <SparkleBurst active reducedMotion /> : undefined
            }
          />
        </div>

        {!hideThumb ? (
          thumbLoading ? (
            <div
              className="h-24 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
              aria-busy="true"
            />
          ) : listing ? (
            <button
              type="button"
              onClick={goListing}
              className={cn(
                'flex w-full items-center gap-[var(--lc-space-md)] rounded-[var(--lc-radius-lg)]',
                'border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-sm)]',
                'text-start shadow-[var(--lc-elevation-sm)]',
              )}
              data-published-listing-card
            >
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]">
                {listing.photoUrl ? (
                  <img src={listing.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <Numeric
                  as="p"
                  className="text-[var(--lc-text-heading)]"
                  style={{ font: 'var(--lc-type-heading-3)' }}
                >
                  {listing.priceLabel ?? 'Live listing'}
                </Numeric>
                <p
                  className="truncate text-[var(--lc-text-secondary)]"
                  style={{ font: 'var(--lc-type-body-sm)' }}
                >
                  {listing.address ?? listing.title}
                </p>
                <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                  Tap to view your listing →
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 pe-2">
                <SignalLampDot
                  pulsing={!reducedMotion}
                  aria-label="Live now"
                  size={10}
                />
                <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                  Live now
                </span>
              </div>
            </button>
          ) : null
        ) : null}

        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
          What&apos;s next
        </p>

        <div className="grid grid-cols-1 gap-[var(--lc-space-md)] md:grid-cols-3">
          <IntakePathCard
            variant="nextAction"
            label="Share on your Instagram"
            description="We'll turn your listing into a shareable post — you approve before it goes out."
            ctaLabel="Connect Instagram →"
            icon={<ChannelMark channel="instagram" className="h-5 w-5" />}
            onCta={() => void goInstagram()}
            onSelect={() => void goInstagram()}
            className="min-h-[120px]"
          />
          <IntakePathCard
            variant="nextAction"
            label="Connect your other channels"
            description="Publish once, syndicate everywhere. Facebook, Messenger, TikTok, LinkedIn."
            ctaLabel="Set up channels →"
            icon={
              <span className="flex -space-x-1">
                <ChannelMark channel="facebook" className="h-5 w-5" />
                <ChannelMark channel="messenger" className="h-5 w-5" />
                <ChannelMark channel="whatsapp" className="h-5 w-5" />
              </span>
            }
            onCta={() => void goChannels()}
            onSelect={() => void goChannels()}
            className="min-h-[120px]"
          />
          <IntakePathCard
            variant="nextAction"
            label="Explore your dashboard"
            description="See leads, quotas, and what's next — one screen, one tap each."
            ctaLabel="Go to dashboard →"
            icon={<LayoutDashboard className="h-5 w-5 text-[var(--lc-text-heading)]" aria-hidden="true" />}
            onCta={() => goDashboard(false)}
            onSelect={() => goDashboard(false)}
            className="min-h-[120px]"
          />
        </div>

        <div className="flex justify-center md:justify-end">
          <Button
            type="button"
            variant="link"
            className="text-[var(--lc-text-muted)]"
            onClick={() => goDashboard(true)}
          >
            Skip for now — take me to the dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
