import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Camera, Check, MapPin, Mic } from 'lucide-react'
import { SignalLampBadge, StepHero } from '@/components/onboarding/whatsapp'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLocale } from '@/hooks/useLocale'
import { copyText } from './copyText'
import { maskPhoneE164 } from './maskPhone'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { markWhatsAppIntakeProgress } from './useOnboardingState'
import { getBindingStatus } from './intakeApi'
import { useInboundStatusPoll } from './useInboundStatusPoll'
import { useOnlineStatus } from './useOnlineStatus'
import { StickyCtaBar, WhatsAppTourShell } from './WhatsAppTourShell'
import { TOUR_STEPS } from './tour'
import { waLocale, waT } from './copy'

export interface WaitingLocationState {
  phone_e164?: string
  bindingId?: string
}

export function FirstMessageWaitingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()
  const { isArabic } = useLocale()
  const locale = waLocale(isArabic)
  const onboarding = useOnboardingState()
  const online = useOnlineStatus()
  const routeState = (location.state || {}) as WaitingLocationState

  const [hint, setHint] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [unbindOpen, setUnbindOpen] = useState(false)
  const [copiedUnbind, setCopiedUnbind] = useState(false)
  const [phone, setPhone] = useState(routeState.phone_e164 || '')

  useEffect(() => {
    const id = window.setTimeout(() => setHint(true), 60_000)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (phone) return
    let cancelled = false
    void getBindingStatus().then((res) => {
      if (cancelled) return
      if (res.data?.phone_e164) setPhone(res.data.phone_e164)
    })
    return () => {
      cancelled = true
    }
  }, [phone])

  const { inbound, pollError, capReached, bindingLost } = useInboundStatusPoll({
    enabled: online,
    bindingId: routeState.bindingId,
  })

  const masked = maskPhoneE164(phone)

  useEffect(() => {
    if (bindingLost) {
      addToast({
        title: waT('waiting.toast.bindingLost', locale),
        variant: 'default',
      })
      navigate('/onboarding/whatsapp/code')
    }
  }, [bindingLost, addToast, navigate, locale])

  useEffect(() => {
    if (!inbound?.latest_message_at) return
    const sessionId = inbound.draft_session_id
    if (!sessionId) return
    navigate(`/onboarding/whatsapp/drafting/${encodeURIComponent(sessionId)}`, {
      state: {
        draft_session_id: sessionId,
        received_at: inbound.latest_message_at,
        phone_e164: phone || routeState.phone_e164,
      },
    })
  }, [inbound, navigate, phone, routeState.phone_e164])

  const lampState = !online
    ? 'offline'
    : pollError
      ? 'reconnecting'
      : 'listening'

  if (capReached) {
    return (
      <WhatsAppTourShell
        step={TOUR_STEPS.waiting}
        title={waT('waiting.title', locale)}
        offline={!online}
        offlineMessage={waT('shell.offline.waiting', locale)}
      >
        <div className="mx-auto max-w-lg px-[var(--lc-space-md)] py-[var(--lc-space-xl)] text-center">
          <StepHero
            glyph="whatsapp-mark"
            title={waT('waiting.cap.title', locale)}
            body={waT('waiting.cap.body', locale)}
          />
          <Button
            type="button"
            size="lg"
            className="mt-[var(--lc-space-lg)]"
            onClick={() => navigate('/onboarding/whatsapp/code')}
          >
            {waT('waiting.cap.cta', locale)}
          </Button>
        </div>
      </WhatsAppTourShell>
    )
  }

  return (
    <WhatsAppTourShell
      step={TOUR_STEPS.waiting}
      title={waT('waiting.title', locale)}
      offline={!online}
      offlineMessage={waT('shell.offline.waiting', locale)}
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-stretch gap-[var(--lc-space-md)] px-[var(--lc-space-md)] py-[var(--lc-space-md)]">
        <StepHero
          glyph="whatsapp-mark"
          title={waT('waiting.hero.title', locale)}
          body={waT('waiting.hero.body', locale)}
        />

        <div className="flex justify-center">
          <SignalLampBadge
            state={lampState}
            label={
              !online
                ? waT('waiting.lamp.offline', locale)
                : pollError
                  ? waT('waiting.lamp.reconnecting', locale)
                  : waT('waiting.lamp.live', locale)
            }
            phoneE164Masked={!online || pollError ? undefined : masked || undefined}
          />
        </div>

        {masked ? (
          <div className="flex items-center gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-sm text-[var(--lc-text-secondary)]">
            <Check className="h-4 w-4 text-[var(--lc-accent-bold)]" aria-hidden />
            {waT('waiting.bound', locale)} <Numeric className="ms-1">{masked}</Numeric>
          </div>
        ) : null}

        <section className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-sm)]">
          <p className="mb-[var(--lc-space-md)] text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">
            {waT('waiting.send.title', locale)}
          </p>
          <ul className="flex flex-col gap-[var(--lc-space-md)]">
            <TipRow icon={Camera} text={waT('waiting.tip.photos', locale)} />
            <TipRow icon={Mic} text={waT('waiting.tip.voice', locale)} />
            <TipRow icon={MapPin} text={waT('waiting.tip.pin', locale)} />
          </ul>
        </section>

        {hint ? (
          <p className="text-center text-sm text-[var(--lc-text-muted)]">
            {waT('waiting.hint', locale)}{' '}
            <button
              type="button"
              className="min-h-[var(--lc-tap-target-min)] text-[var(--lc-text-brand)] underline-offset-4 hover:underline"
              onClick={() => setListOpen(true)}
            >
              {waT('waiting.hint.action', locale)}
            </button>
          </p>
        ) : null}
      </div>

      <StickyCtaBar>
        <div className="flex flex-col gap-[var(--lc-space-xs)] md:flex-row md:justify-center">
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--lc-text-muted)]"
            onClick={() => setUnbindOpen(true)}
          >
            {waT('waiting.cta.change', locale)}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--lc-text-muted)]"
            onClick={() => {
              void markWhatsAppIntakeProgress(onboarding, { kind: 'deferred' })
              navigate('/dashboard')
            }}
          >
            {waT('waiting.cta.later', locale)}
          </Button>
        </div>
      </StickyCtaBar>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{waT('waiting.list.title', locale)}</DialogTitle>
            <DialogDescription>{waT('waiting.list.body', locale)}</DialogDescription>
          </DialogHeader>
          <Button type="button" variant="default" onClick={() => setListOpen(false)}>
            {waT('waiting.list.gotIt', locale)}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={unbindOpen} onOpenChange={setUnbindOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{waT('waiting.unbind.title', locale)}</DialogTitle>
            <DialogDescription>{waT('waiting.unbind.body', locale)}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setUnbindOpen(false)}>
              {waT('waiting.unbind.notYet', locale)}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={async () => {
                const ok = await copyText('WC-UNBIND')
                if (ok) {
                  setCopiedUnbind(true)
                  window.setTimeout(() => setCopiedUnbind(false), 2000)
                }
              }}
            >
              {copiedUnbind ? (
                <>
                  <Check className="me-2 h-4 w-4" aria-hidden />
                  {waT('waiting.unbind.copied', locale)}
                </>
              ) : (
                waT('waiting.unbind.copy', locale)
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </WhatsAppTourShell>
  )
}

function TipRow({ icon: Icon, text }: { icon: typeof Camera; text: string }) {
  return (
    <li className="flex items-start gap-[var(--lc-space-md)]">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lc-text-brand)]" aria-hidden />
      <span className="text-sm text-[var(--lc-text-primary)]">{text}</span>
    </li>
  )
}
