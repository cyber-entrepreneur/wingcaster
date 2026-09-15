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
import { copyText } from './copyText'
import { maskPhoneE164 } from './maskPhone'
import { markWhatsAppIntakeProgress, useOnboardingState } from './useOnboardingState'
import { getBindingStatus } from './intakeApi'
import { useInboundStatusPoll } from './useInboundStatusPoll'
import { useOnlineStatus } from './useOnlineStatus'
import { StickyCtaBar, WhatsAppTourShell } from './WhatsAppTourShell'

export interface WaitingLocationState {
  phone_e164?: string
  bindingId?: string
}

export function FirstMessageWaitingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()
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
        title: 'Your phone was disconnected. Get a fresh code to reconnect.',
        variant: 'default',
      })
      navigate('/onboarding/whatsapp/code')
    }
  }, [bindingLost, addToast, navigate])

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
  }, [inbound, navigate, routeState.phone_e164])

  const lampState = !online
    ? 'offline'
    : pollError
      ? 'reconnecting'
      : 'listening'

  if (capReached) {
    return (
      <WhatsAppTourShell step={4} title="Listening on WhatsApp" offline={!online}>
        <div className="mx-auto max-w-lg px-[var(--lc-space-md)] py-[var(--lc-space-xl)] text-center">
          <StepHero
            glyph="whatsapp-mark"
            title="It's been a while"
            body="We haven't seen a message yet. Get a fresh code if you want to reconnect."
          />
          <Button
            type="button"
            size="lg"
            className="mt-[var(--lc-space-lg)]"
            onClick={() => navigate('/onboarding/whatsapp/code')}
          >
            Get a fresh code
          </Button>
        </div>
      </WhatsAppTourShell>
    )
  }

  return (
    <WhatsAppTourShell
      step={4}
      title="Listening on WhatsApp"
      offline={!online}
      offlineMessage="You're offline — we'll keep listening when you're back."
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-stretch gap-[var(--lc-space-md)] px-[var(--lc-space-md)] py-[var(--lc-space-md)]">
        <StepHero
          glyph="whatsapp-mark"
          title="Listening on WhatsApp"
          body="Send photos, a voice note, and a pin to any listing you want to draft first. I'll turn them into a draft you can review."
        />

        <div className="flex justify-center">
          <SignalLampBadge
            state={lampState}
            label={!online ? 'Offline' : pollError ? 'Reconnecting…' : 'Live — connected to'}
            phoneE164Masked={!online || pollError ? undefined : masked || undefined}
          />
        </div>

        {masked ? (
          <div className="flex items-center gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-sm text-[var(--lc-text-secondary)]">
            <Check className="h-4 w-4 text-[var(--lc-accent-bold)]" aria-hidden />
            Bound to <Numeric className="ms-1">{masked}</Numeric>
          </div>
        ) : null}

        <section className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-sm)]">
          <p className="mb-[var(--lc-space-md)] text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">
            What to send
          </p>
          <ul className="flex flex-col gap-[var(--lc-space-md)]">
            <TipRow icon={Camera} text="3-8 photos of the unit — wide shots, kitchen, bathroom, view." />
            <TipRow icon={Mic} text="A voice note with the address, beds, baths, and price." />
            <TipRow icon={MapPin} text="A location pin so we can auto-fill the neighborhood." />
          </ul>
        </section>

        {hint ? (
          <p className="text-center text-sm text-[var(--lc-text-muted)]">
            Not seeing a reply?{' '}
            <button
              type="button"
              className="min-h-[var(--lc-tap-target-min)] text-[var(--lc-text-brand)] underline-offset-4 hover:underline"
              onClick={() => setListOpen(true)}
            >
              Send WC-LIST to check your bindings
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
            Change WhatsApp number
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
            I'll come back later
          </Button>
        </div>
      </StickyCtaBar>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check your WhatsApp bindings</DialogTitle>
            <DialogDescription>
              Send <Numeric>WC-LIST</Numeric> from your bound phone. WingCaster will reply with all the
              accounts currently linked to it.
            </DialogDescription>
          </DialogHeader>
          <Button type="button" variant="default" onClick={() => setListOpen(false)}>
            Got it
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={unbindOpen} onOpenChange={setUnbindOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change your WhatsApp number</DialogTitle>
            <DialogDescription>
              Send <Numeric>WC-UNBIND</Numeric> from your current phone. Then come back and restart
              WhatsApp setup from a new phone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setUnbindOpen(false)}>
              Not yet
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
                  Copied
                </>
              ) : (
                'Copy WC-UNBIND to clipboard'
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
