import { Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { AgencyTaskCard } from '@/components/agency/onboarding/AgencyTaskCard'
import { ProgressRing } from '@/components/onboarding/ProgressRing'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import {
  AGENCY_TASKS,
  isTaskDone,
  tOnboarding,
} from './onboardingCopy'

type LoadState = 'loading' | 'ready' | 'error'

interface OnboardingState {
  checklist: Record<string, unknown>
  dismissed_forever: boolean
}

const TOTAL = AGENCY_TASKS.length

export function AgencyOnboardingPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { locale, isArabic } = useLocale()
  const uiLocale = isArabic ? 'ar' : 'en'
  usePageTitle(tOnboarding('section.overline', uiLocale))

  const [status, setStatus] = useState<LoadState>('loading')
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [agencyName, setAgencyName] = useState<string | null>(null)
  const [state, setState] = useState<OnboardingState | null>(null)
  const [confirmingDismiss, setConfirmingDismiss] = useState(false)
  const lastCompleted = useRef<number | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const agency = (await api.getMyAgency()) as { id?: string; name?: string }
      if (!agency?.id) {
        setStatus('error')
        return
      }
      setAgencyId(agency.id)
      setAgencyName(agency.name || null)
      const onboarding = (await api.getAgencyOnboardingState(agency.id)) as OnboardingState
      setState({
        checklist: onboarding.checklist || {},
        dismissed_forever: Boolean(onboarding.dismissed_forever),
      })
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const completed = state
    ? AGENCY_TASKS.filter((t) => isTaskDone(state.checklist[t.key])).length
    : 0
  const allDone = completed >= TOTAL

  // Fire the celebration toast once, on the transition into 7/7.
  useEffect(() => {
    if (status !== 'ready') return
    const prev = lastCompleted.current
    if (prev !== null && prev < TOTAL && completed >= TOTAL) {
      addToast({ description: tOnboarding('celebration', uiLocale), variant: 'success' })
    }
    lastCompleted.current = completed
  }, [status, completed, uiLocale, addToast])

  const patchDismiss = useCallback(
    async (dismissed: boolean) => {
      if (!agencyId) return
      const previous = state
      setState((s) => (s ? { ...s, dismissed_forever: dismissed } : s))
      try {
        await api.patchAgencyOnboardingState(agencyId, { dismissed_forever: dismissed })
      } catch {
        setState(previous)
        addToast({ description: tOnboarding('error.save', uiLocale), variant: 'error' })
      }
    },
    [agencyId, state, uiLocale, addToast],
  )

  if (status === 'loading') {
    return (
      <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-DSH-002">
        <div className="mx-auto max-w-[960px] px-[var(--lc-space-xl)] py-[var(--lc-space-xl)]">
          <div className="flex flex-col gap-4">
            <div
              className="h-24 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
              aria-hidden="true"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[180px] animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
                  aria-hidden="true"
                />
              ))}
            </div>
            <span className="sr-only">{tOnboarding('loading', uiLocale)}</span>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error' || !state) {
    return (
      <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-DSH-002">
        <div className="mx-auto flex max-w-[960px] flex-col items-start gap-3 px-[var(--lc-space-xl)] py-[var(--lc-space-xl)]">
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            {tOnboarding('error.load', uiLocale)}
          </h1>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {tOnboarding('action.retry', uiLocale)}
          </Button>
        </div>
      </div>
    )
  }

  const greeting = agencyName
    ? tOnboarding('hero.greeting', uiLocale, { agency: agencyName })
    : tOnboarding('hero.greetingFallback', uiLocale)

  return (
    <div
      className="min-h-full bg-[var(--lc-bg-page)]"
      data-screen="AGN-DSH-002"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-[960px] px-[var(--lc-space-xl)] py-[var(--lc-space-xl)]">
        {state.dismissed_forever ? (
          <div
            role="status"
            className="mb-[var(--lc-space-md)] flex items-center justify-between gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-[var(--lc-text-secondary)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            <span>{tOnboarding('dismiss.banner', uiLocale)}</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => void patchDismiss(false)}
            >
              {tOnboarding('dismiss.undo', uiLocale)}
            </Button>
          </div>
        ) : null}

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-display)' }}
            >
              {greeting}
            </h1>
            <p
              className="mt-2 text-[var(--lc-text-secondary)]"
              style={{ font: 'var(--lc-type-body-lg)' }}
            >
              {tOnboarding('hero.sub', uiLocale)}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProgressRing
              size={96}
              strokeWidth={8}
              completed={completed}
              total={TOTAL}
              aria-label={tOnboarding('progress.aria', uiLocale, { n: completed, total: TOTAL })}
            />
            <span
              className="text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
            >
              <Numeric>{completed}</Numeric> / <Numeric>{TOTAL}</Numeric>{' '}
              {tOnboarding('progress.caption', uiLocale)}
            </span>
          </div>
        </header>

        <h2
          className="mt-[var(--lc-space-lg)] text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-overline)' }}
        >
          {tOnboarding('section.overline', uiLocale)}
        </h2>

        <div className="mt-[var(--lc-space-md)] grid grid-cols-1 gap-4 md:grid-cols-2">
          {AGENCY_TASKS.map((task, i) => (
            <AgencyTaskCard
              key={task.key}
              task={task}
              done={isTaskDone(state.checklist[task.key])}
              locale={uiLocale}
              index={i + 1}
              total={TOTAL}
            />
          ))}

          <div
            className="flex min-h-[180px] flex-col items-start justify-center gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-4"
            data-placeholder
          >
            <Sparkles className="h-6 w-6 text-[var(--lc-text-brand)]" aria-hidden="true" />
            {allDone ? (
              <>
                <p
                  className="text-[var(--lc-text-heading)]"
                  style={{ font: 'var(--lc-type-heading-3)' }}
                >
                  {tOnboarding('celebration', uiLocale)}
                </p>
                <Button type="button" variant="default" onClick={() => navigate('/agency')}>
                  {tOnboarding('placeholder.done', uiLocale)}
                </Button>
              </>
            ) : (
              <p
                className="text-[var(--lc-text-secondary)]"
                style={{ font: 'var(--lc-type-body)' }}
              >
                {tOnboarding('placeholder.partial', uiLocale, { n: completed })}
              </p>
            )}
          </div>
        </div>

        {!state.dismissed_forever ? (
          <div className="mt-[var(--lc-space-lg)] flex justify-end">
            {confirmingDismiss ? (
              <div
                role="dialog"
                aria-label={tOnboarding('dismiss.confirm.title', uiLocale)}
                className="flex max-w-sm flex-col gap-2 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 shadow-[var(--lc-elevation-md)]"
              >
                <p
                  className="text-[var(--lc-text-heading)]"
                  style={{ font: 'var(--lc-type-heading-3)' }}
                >
                  {tOnboarding('dismiss.confirm.title', uiLocale)}
                </p>
                <p
                  className="text-[var(--lc-text-secondary)]"
                  style={{ font: 'var(--lc-type-body-sm)' }}
                >
                  {tOnboarding('dismiss.confirm.body', uiLocale)}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmingDismiss(false)}
                  >
                    {tOnboarding('dismiss.confirm.keep', uiLocale)}
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setConfirmingDismiss(false)
                      void patchDismiss(true)
                    }}
                  >
                    {tOnboarding('dismiss.confirm.dismiss', uiLocale)}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => setConfirmingDismiss(true)}
              >
                {tOnboarding('dismiss.link', uiLocale)}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default AgencyOnboardingPage
