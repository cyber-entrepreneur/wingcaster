import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import type { OnboardingPath } from '@/components/onboarding/useOnboardingState'
import { IntakePathCard, OfflineBanner } from '@/components/onboarding'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { OnboardingChrome } from './OnboardingChrome'
import { getMarketingAgentCount } from './onboardingApi'
import { useOnlineStatus, usePrefersReducedMotion } from './useOnlineStatus'
import {
  firstNameOf,
  formatAgentCount,
  isPatchConflict,
  ONB_SELECTED_PATH_KEY,
  ONB_SKIP_TOAST_KEY,
  readSessionFlag,
  resumeRouteForStep,
  roundAgentCount,
  writeSessionFlag,
} from './helpers'

const VALUE_PROPS = [
  'Draft listings from a voice memo.',
  'Publish once, syndicate everywhere.',
  'Every inquiry, one inbox.',
] as const

const PATHS: Array<{
  id: Exclude<OnboardingPath, null>
  variant: 'whatsapp' | 'manual' | 'import'
  label: string
  description: string
  timeToValue: string
  recommended?: boolean
  step: 'whatsapp_intake_pending' | 'manual_wizard' | 'import_pending'
  href: string
}> = [
  {
    id: 'whatsapp',
    variant: 'whatsapp',
    label: 'WhatsApp voice memo',
    description: 'Send photos + a voice note to our WhatsApp. We draft the listing for you.',
    timeToValue: '~2 min',
    recommended: true,
    step: 'whatsapp_intake_pending',
    href: '/onboarding/whatsapp',
  },
  {
    id: 'manual',
    variant: 'manual',
    label: 'Add manually',
    description: 'Step-by-step wizard. You type; we help.',
    timeToValue: '~5 min',
    step: 'manual_wizard',
    href: '/listings/new',
  },
  {
    id: 'import',
    variant: 'import',
    label: 'Import a spreadsheet',
    description: "Upload existing inventory as CSV or Excel. We'll map the columns.",
    timeToValue: 'Depends on file size',
    step: 'import_pending',
    href: '/imports/new',
  },
]

function RotatingCaption({
  reducedMotion,
  lines,
}: {
  reducedMotion: boolean
  lines: readonly string[]
}) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (reducedMotion) return
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % lines.length)
    }, 4000)
    return () => window.clearInterval(id)
  }, [lines.length, reducedMotion])
  return (
    <p
      className="text-[var(--lc-text-secondary)]"
      style={{ font: 'var(--lc-type-body)' }}
      aria-live="off"
      data-rotating-caption
    >
      {lines[reducedMotion ? 0 : index]}
    </p>
  )
}

export function WelcomePage() {
  const { agent } = useAuth()
  const { locale } = useLocale()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { state, patch, isLoading, isError } = useOnboardingState()
  const online = useOnlineStatus()
  const reducedMotion = usePrefersReducedMotion()
  const sectionId = useId()
  const descIds = [useId(), useId(), useId()]
  const groupRef = useRef<HTMLDivElement>(null)
  const queuedSkip = useRef(false)

  const [selected, setSelected] = useState<Exclude<OnboardingPath, null> | null>(() => {
    const stored = readSessionFlag(ONB_SELECTED_PATH_KEY)
    if (stored === 'whatsapp' || stored === 'manual' || stored === 'import') return stored
    return null
  })
  const [submitting, setSubmitting] = useState(false)
  const [agentCount, setAgentCount] = useState<number | null>(null)
  const [skipQueued, setSkipQueued] = useState(false)

  usePageTitle('Welcome')

  const firstName = firstNameOf(agent?.name)
  const heading = firstName ? `Welcome to WingCaster, ${firstName}` : 'Welcome to WingCaster'

  useEffect(() => {
    if (isLoading) return
    const next = resumeRouteForStep(state.step)
    if (next && state.step !== 'welcome' && state.step !== 'welcome_skipped') {
      navigate(next, { replace: true })
    }
  }, [isLoading, navigate, state.step])

  useEffect(() => {
    let cancelled = false
    void getMarketingAgentCount().then((count) => {
      if (cancelled || count == null) return
      const rounded = roundAgentCount(count)
      if (rounded > 0) setAgentCount(rounded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (online && queuedSkip.current) {
      queuedSkip.current = false
      void handleSkip()
    }
    // handleSkip is stable enough via patch; re-run only on reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const persistSelection = useCallback((path: Exclude<OnboardingPath, null>) => {
    setSelected(path)
    writeSessionFlag(ONB_SELECTED_PATH_KEY, path)
  }, [])

  const handleCta = async () => {
    const path = PATHS.find((item) => item.id === selected)
    if (!path || submitting) return
    setSubmitting(true)
    try {
      await patch({
        step: path.step,
        path: path.id,
        checklist_delta: { welcome_seen: true },
      })
      navigate(path.href)
    } catch (error) {
      if (isPatchConflict(error)) {
        navigate('/dashboard', { replace: true })
        return
      }
      addToast({
        variant: 'error',
        description: "We couldn't save your choice. Try again?",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = async () => {
    if (!online) {
      queuedSkip.current = true
      setSkipQueued(true)
      writeSessionFlag(ONB_SKIP_TOAST_KEY, '1')
      navigate('/dashboard')
      return
    }
    try {
      await patch({ step: 'welcome_skipped', path: null, checklist_delta: { welcome_seen: true } })
    } catch (error) {
      if (!isPatchConflict(error)) {
        addToast({
          variant: 'error',
          description: "We couldn't save your choice. Try again?",
        })
        return
      }
    }
    writeSessionFlag(ONB_SKIP_TOAST_KEY, '1')
    navigate('/dashboard')
  }

  const onGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const idx = Math.max(0, PATHS.findIndex((p) => p.id === selected))
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
    const next = PATHS[(idx + delta + PATHS.length) % PATHS.length]
    persistSelection(next.id)
    const radios = groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')
    radios?.[PATHS.indexOf(next)]?.focus()
  }

  const roundedLabel = useMemo(() => {
    if (agentCount == null) return null
    return `Joining ${formatAgentCount(agentCount, locale)}+ MENA agents on WingCaster`
  }, [agentCount, locale])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
        <OnboardingChrome step={1} label="Welcome" />
        <div className="grid gap-[var(--lc-space-lg)] px-[var(--lc-space-md)] py-[var(--lc-space-lg)] md:grid-cols-[3fr_2fr] md:px-[var(--lc-space-xl)]">
          <div className="grid grid-cols-1 gap-[var(--lc-space-md)] md:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[144px] animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] md:h-[260px]"
              />
            ))}
          </div>
          <div className="hidden h-[480px] animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] md:block" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]',
        'transition-opacity duration-deliberate ease-out',
        reducedMotion && 'duration-instant',
      )}
    >
      <OfflineBanner
        show={!online}
        message="You're offline. Reconnect to continue setup — your progress is saved."
      />
      <OnboardingChrome step={1} label="Welcome" />

      {isError ? (
        <div
          role="status"
          className="mx-[var(--lc-space-md)] mb-[var(--lc-space-sm)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-text-secondary)] md:mx-[var(--lc-space-xl)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          We couldn&apos;t check your progress. Continue anyway?
        </div>
      ) : null}

      <div className="flex flex-col md:grid md:min-h-[calc(100vh-4rem)] md:grid-cols-[3fr_2fr]">
        <div className="order-2 flex flex-1 flex-col px-[var(--lc-space-md)] pb-[var(--lc-space-xl)] md:order-1 md:px-[var(--lc-space-xl)]">
          <h1
            className="mt-[var(--lc-space-md)] text-[var(--lc-text-heading)] max-md:[&_span]:block max-md:[font:var(--lc-type-heading-1)] md:[font:var(--lc-type-display)]"
            style={{ letterSpacing: 'var(--lc-tracking-display)' }}
          >
            {firstName ? (
              <>
                Welcome to WingCaster, <span>{firstName}</span>
              </>
            ) : (
              heading
            )}
          </h1>
          <p
            className="mt-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]"
            style={{ font: 'var(--lc-type-body-lg)' }}
          >
            Let&apos;s get your first listing on WhatsApp — under 3 minutes.
          </p>

          <p
            id={sectionId}
            className="mt-[var(--lc-space-lg)] text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-overline)' }}
          >
            How would you like to start?
          </p>

          <div
            ref={groupRef}
            role="radiogroup"
            aria-labelledby={sectionId}
            onKeyDown={onGroupKeyDown}
            className="mt-[var(--lc-space-md)] grid grid-cols-1 gap-[var(--lc-space-md)] md:grid-cols-3"
          >
            {PATHS.map((path, index) => (
              <IntakePathCard
                key={path.id}
                variant={path.variant}
                label={path.label}
                description={path.description}
                timeToValue={path.timeToValue}
                recommended={path.recommended}
                recommendedLabel="Recommended · fastest to your first listing"
                selected={selected === path.id}
                ctaLabel={submitting && selected === path.id ? 'Saving…' : 'Get started →'}
                disabled={submitting || (!online && selected === path.id)}
                onSelect={() => persistSelection(path.id)}
                onCta={() => void handleCta()}
                className="md:min-h-[260px]"
              />
            ))}
          </div>
          {/* Hidden description ids for CTA aria-describedby — IntakePathCard owns the CTA button. */}
          {PATHS.map((path, index) => (
            <span key={path.id} id={descIds[index]} className="sr-only">
              {path.description}
            </span>
          ))}

          {submitting ? (
            <p className="sr-only" role="status">
              Saving…
            </p>
          ) : null}

          <div className="mt-[var(--lc-space-lg)] flex justify-center md:justify-end">
            <Button
              type="button"
              variant="link"
              className="text-[var(--lc-text-muted)]"
              onClick={() => void handleSkip()}
            >
              Skip for now, take me to the dashboard
            </Button>
          </div>
          {skipQueued ? (
            <p className="sr-only" role="status">
              Skip queued until you reconnect.
            </p>
          ) : null}
        </div>

        <aside className="order-1 md:order-2">
          <div
            className="relative flex h-[200px] items-center justify-center overflow-hidden md:h-full md:min-h-[480px]"
            style={{
              background:
                'linear-gradient(160deg, var(--lc-action-primary) 0%, var(--lc-text-heading) 55%, var(--lc-accent-bold) 100%)',
            }}
          >
            <div
              role="img"
              aria-label="MENA agent listing a property on WhatsApp"
              className="flex h-16 w-16 items-center justify-center rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)]/20 md:h-24 md:w-24"
            >
              <span
                className="text-[var(--lc-action-primary-text)]"
                style={{ font: 'var(--lc-type-display)' }}
              >
                WC
              </span>
            </div>
          </div>
          <div className="hidden flex-col gap-2 px-[var(--lc-space-lg)] py-[var(--lc-space-md)] md:flex">
            <RotatingCaption reducedMotion={reducedMotion} lines={VALUE_PROPS} />
            {roundedLabel ? (
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                {roundedLabel}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <div className="px-[var(--lc-space-md)] pb-[calc(var(--lc-space-lg)+env(safe-area-inset-bottom,0px))] md:hidden">
        <RotatingCaption reducedMotion={reducedMotion} lines={VALUE_PROPS} />
        {roundedLabel ? (
          <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {roundedLabel}
          </p>
        ) : null}
      </div>

      {submitting ? (
        <span className="sr-only">
          <Loader2 className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  )
}
