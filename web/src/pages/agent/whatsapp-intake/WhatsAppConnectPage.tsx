import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Car, Image, Loader2, MapPin, Mic, Zap } from 'lucide-react'
import { BenefitList, StepHero } from '@/components/onboarding/whatsapp'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import { useToast } from '@/components/ui/toast'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { issueActivationCode, type ActivationCodePayload } from './intakeApi'
import { completedViaCaption, markWhatsAppIntakeProgress } from './useOnboardingState'
import { useOnlineStatus } from './useOnlineStatus'
import { StickyCtaBar, WhatsAppTourShell } from './WhatsAppTourShell'

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
  const onboarding = useOnboardingState()
  const online = useOnlineStatus()
  const [busy, setBusy] = useState(false)

  const resume = params.get('resume') === '1'
  const title = resume ? 'Resume WhatsApp setup' : 'Set up WhatsApp intake'
  const already = completedViaCaption(onboarding, 'whatsapp')

  const benefits = useMemo(
    () =>
      [
        {
          icon: Zap,
          label: 'Drafts in under 60 seconds',
          sub: 'From voice note to filled fields — no forms while you work.',
        },
        {
          icon: Mic,
          label: 'Voice, photos, and pin work together',
          sub: 'Send everything as you normally would on WhatsApp.',
        },
        {
          icon: Car,
          label: 'Built for the road',
          sub: 'Reply on WhatsApp the same way you already do — WingCaster reads it.',
        },
      ] as const,
    [],
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
        title: "You just requested a code — check WhatsApp or tap 'I didn't get it' on the next screen.",
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
      goCode({
        display_code: '',
        shared_number_e164: '',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      })
      return
    }
    if (!result.ok || !result.data?.display_code) {
      addToast({
        title: "Couldn't reach WingCaster. Try again in a moment.",
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
    <WhatsAppTourShell step={2} title={title} offline={!online}>
      <div
        className="mx-auto flex w-full max-w-[1080px] flex-col gap-[var(--lc-space-md)] px-[var(--lc-space-md)] py-[var(--lc-space-md)] md:min-h-[640px] md:flex-row md:gap-[var(--lc-space-xl)] md:px-[var(--lc-space-xl)]"
        aria-busy={busy || undefined}
      >
        <div className="flex min-w-0 flex-1 flex-col md:w-[60%]">
          <StepHero
            glyph="whatsapp-mark"
            title="Draft listings by chatting to WingCaster on WhatsApp"
            body="Send photos, a voice note, and a location pin. We'll turn them into a listing you can review and publish."
          />

          {already ? (
            <p className="mt-[var(--lc-space-sm)] text-center text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
              {already}
            </p>
          ) : null}

          <BenefitList items={[benefits[0], benefits[1], benefits[2]]} className="mt-[var(--lc-space-md)]" />

          <p className="mt-[var(--lc-space-lg)] text-center text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            You'll share the same WingCaster number as other agents. Your listings stay yours.
          </p>

          <div className="hidden md:mt-[var(--lc-space-xl)] md:flex md:items-center md:justify-between md:gap-[var(--lc-space-md)]">
            <Button
              type="button"
              variant="ghost"
              className="text-[var(--lc-text-muted)]"
              onClick={onDefer}
            >
              Not now, remind me later
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
                  Setting up…
                </>
              ) : (
                <>
                  <span aria-hidden>
                    <ChannelMark channel="whatsapp" className="me-2 h-5 w-5" />
                  </span>
                  Set up WhatsApp intake
                </>
              )}
            </Button>
          </div>
        </div>

        <aside className="hidden md:block md:w-[40%]">
          <IllustrationPanel />
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
            Not now, remind me later
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
                Setting up…
              </>
            ) : (
              <>
                <span aria-hidden>
                  <ChannelMark channel="whatsapp" className="me-2 h-5 w-5" />
                </span>
                Set up WhatsApp intake
              </>
            )}
          </Button>
        </div>
      </StickyCtaBar>
    </WhatsAppTourShell>
  )
}

function IllustrationPanel() {
  return (
    <Card className="rounded-[var(--lc-radius-lg)] border-0 bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]">
      <ol className="flex flex-col gap-[var(--lc-space-md)]">
        <li className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
          <p className="mb-2 text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">
            You send
          </p>
          <div className="flex items-center gap-2 text-[var(--lc-text-secondary)]">
            <Mic className="h-4 w-4" aria-hidden />
            <Image className="h-4 w-4" aria-hidden />
            <MapPin className="h-4 w-4" aria-hidden />
            <span className="text-sm">Voice + photos + pin</span>
          </div>
        </li>
        <li className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
          <p className={cn('flex items-center gap-2 text-sm text-[var(--lc-text-secondary)]')}>
            <Loader2 className="h-4 w-4" aria-hidden />
            WingCaster is drafting…
          </p>
        </li>
        <li className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
          <p className="text-[length:var(--lc-type-heading-3)] text-[var(--lc-text-primary)]">Marina Walk listing</p>
          <p className="text-sm text-[var(--lc-text-muted)]">Bed 3 · Bath 2 · AED 2,450,000</p>
          <span className="mt-2 inline-flex rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-published-bg)] px-2 py-0.5 text-[length:var(--lc-type-caption)] text-[var(--lc-status-published-fg)]">
            Ready to publish
          </span>
        </li>
      </ol>
    </Card>
  )
}
