import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Car, Image, Loader2, MapPin, Mic, Zap } from 'lucide-react'
import { BenefitList, StepHero } from '@/components/onboarding/whatsapp'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import { useToast } from '@/components/ui/toast'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useLocale } from '@/hooks/useLocale'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { issueActivationCode, type ActivationCodePayload } from './intakeApi'
import { completedViaCaption, markWhatsAppIntakeProgress } from './useOnboardingState'
import { useOnlineStatus } from './useOnlineStatus'
import { StickyCtaBar, WhatsAppTourShell } from './WhatsAppTourShell'
import { TOUR_STEPS } from './tour'
import { waLocale, waT } from './copy'

export interface WhatsAppConnectLocationState {
  displayCode?: string
  sharedNumberE164?: string
  expiresAt?: string
}

export function WhatsAppConnectPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { addToast } = useToast()
  const { isArabic } = useLocale()
  const locale = waLocale(isArabic)
  const onboarding = useOnboardingState()
  const online = useOnlineStatus()
  const [busy, setBusy] = useState(false)

  const resume = params.get('resume') === '1'
  const title = resume ? waT('connect.title.resume', locale) : waT('connect.title', locale)
  const already = completedViaCaption(onboarding, 'whatsapp')

  const benefits = useMemo(
    () =>
      [
        {
          icon: Zap,
          label: waT('connect.benefit.speed.label', locale),
          sub: waT('connect.benefit.speed.sub', locale),
        },
        {
          icon: Mic,
          label: waT('connect.benefit.media.label', locale),
          sub: waT('connect.benefit.media.sub', locale),
        },
        {
          icon: Car,
          label: waT('connect.benefit.road.label', locale),
          sub: waT('connect.benefit.road.sub', locale),
        },
      ] as const,
    [locale],
  )

  const goCode = (payload: ActivationCodePayload) => {
    const state: WhatsAppConnectLocationState = {
      displayCode: payload.display_code,
      sharedNumberE164: payload.shared_number_e164,
      expiresAt: payload.expires_at,
    }
    const settings = location.pathname.startsWith('/settings/')
    navigate(settings ? '/settings/channels/whatsapp/code' : '/onboarding/whatsapp/code', { state })
  }

  const onPrimary = async () => {
    if (busy || !online) return
    setBusy(true)
    const result = await issueActivationCode()
    if (result.status === 429) {
      addToast({
        title: waT('connect.toast.rateLimited', locale),
        variant: 'default',
      })
      const retry = result.data?.display_code
        ? result
        : await issueActivationCode()
      if (retry.data?.display_code) {
        void markWhatsAppIntakeProgress(onboarding, { kind: 'code_issued' })
        goCode(retry.data)
        return
      }
      addToast({
        title: waT('connect.toast.rateLimited.empty', locale),
        variant: 'error',
      })
      setBusy(false)
      return
    }
    if (!result.ok || !result.data?.display_code) {
      addToast({
        title: waT('connect.toast.error', locale),
        variant: 'error',
      })
      setBusy(false)
      return
    }
    void markWhatsAppIntakeProgress(onboarding, { kind: 'code_issued' })
    goCode(result.data)
  }

  const onDefer = () => {
    void markWhatsAppIntakeProgress(onboarding, { kind: 'deferred' })
    navigate('/dashboard')
  }

  return (
    <WhatsAppTourShell
      step={TOUR_STEPS.connect}
      title={title}
      offline={!online}
      offlineMessage={waT('shell.offline.connect', locale)}
    >
      <div
        className="mx-auto flex w-full max-w-[1080px] flex-col gap-[var(--lc-space-md)] px-[var(--lc-space-md)] py-[var(--lc-space-md)] md:min-h-[640px] md:flex-row md:gap-[var(--lc-space-xl)] md:px-[var(--lc-space-xl)]"
        aria-busy={busy || undefined}
      >
        <div className="flex min-w-0 flex-1 flex-col md:w-[60%]">
          <StepHero
            glyph="whatsapp-mark"
            title={waT('connect.hero.title', locale)}
            body={waT('connect.hero.body', locale)}
          />

          {already ? (
            <p className="mt-[var(--lc-space-sm)] text-center text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
              {already}
            </p>
          ) : null}

          <BenefitList items={[benefits[0], benefits[1], benefits[2]]} className="mt-[var(--lc-space-md)]" />

          <p className="mt-[var(--lc-space-lg)] text-center text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            {waT('connect.trust', locale)}
          </p>

          <div className="hidden md:mt-[var(--lc-space-xl)] md:flex md:items-center md:justify-between md:gap-[var(--lc-space-md)]">
            <Button
              type="button"
              variant="ghost"
              className="text-[var(--lc-text-muted)]"
              onClick={onDefer}
            >
              {waT('connect.cta.defer', locale)}
            </Button>
            <Button
              type="button"
              variant="default"
              size="lg"
              className="max-w-[360px]"
              disabled={!online || busy}
              onClick={() => void onPrimary()}
            >
              {busy ? (
                <>
                  <Loader2 className="me-2 h-5 w-5 animate-spin" aria-hidden />
                  {waT('connect.cta.busy', locale)}
                </>
              ) : (
                <>
                  <span aria-hidden>
                    <ChannelMark channel="whatsapp" className="me-2 h-5 w-5" />
                  </span>
                  {waT('connect.cta.primary', locale)}
                </>
              )}
            </Button>
          </div>
        </div>

        <aside className="hidden md:block md:w-[40%]">
          <IllustrationPanel locale={locale} />
        </aside>
      </div>

      <StickyCtaBar>
        <div className="flex flex-col gap-[var(--lc-space-xs)] md:hidden">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-[var(--lc-text-muted)]"
            onClick={onDefer}
          >
            {waT('connect.cta.defer', locale)}
          </Button>
          <Button
            type="button"
            variant="default"
            size="lg"
            className="w-full"
            disabled={!online || busy}
            onClick={() => void onPrimary()}
          >
            {busy ? (
              <>
                <Loader2 className="me-2 h-5 w-5 animate-spin" aria-hidden />
                {waT('connect.cta.busy', locale)}
              </>
            ) : (
              <>
                <span aria-hidden>
                  <ChannelMark channel="whatsapp" className="me-2 h-5 w-5" />
                </span>
                {waT('connect.cta.primary', locale)}
              </>
            )}
          </Button>
        </div>
      </StickyCtaBar>
    </WhatsAppTourShell>
  )
}

function IllustrationPanel({ locale }: { locale: ReturnType<typeof waLocale> }) {
  return (
    <Card className="rounded-[var(--lc-radius-lg)] border-0 bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]">
      <ol className="flex flex-col gap-[var(--lc-space-md)]">
        <li className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
          <p className="mb-2 text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">
            {waT('connect.illus.send', locale)}
          </p>
          <div className="flex items-center gap-2 text-[var(--lc-text-secondary)]">
            <Mic className="h-4 w-4" aria-hidden />
            <Image className="h-4 w-4" aria-hidden />
            <MapPin className="h-4 w-4" aria-hidden />
            <span className="text-sm">{waT('connect.illus.sendDetail', locale)}</span>
          </div>
        </li>
        <li className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
          <p className={cn('flex items-center gap-2 text-sm text-[var(--lc-text-secondary)]')}>
            <Loader2 className="h-4 w-4" aria-hidden />
            {waT('connect.illus.drafting', locale)}
          </p>
        </li>
        <li className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
          <p className="text-[length:var(--lc-type-heading-3)] text-[var(--lc-text-primary)]">Marina Walk listing</p>
          <p className="text-sm text-[var(--lc-text-muted)]">Bed 3 · Bath 2 · AED 2,450,000</p>
          <span className="mt-2 inline-flex rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-published-bg)] px-2 py-0.5 text-[length:var(--lc-type-caption)] text-[var(--lc-status-published-fg)]">
            {waT('connect.illus.ready', locale)}
          </span>
        </li>
      </ol>
    </Card>
  )
}
