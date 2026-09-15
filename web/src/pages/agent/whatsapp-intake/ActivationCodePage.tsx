import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Loader2 } from 'lucide-react'
import { StepHero, WhatsAppHandshakePanel } from '@/components/onboarding/whatsapp'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { completedViaCaption, markWhatsAppIntakeProgress, useOnboardingState } from './useOnboardingState'
import { getCurrentActivationCode, postActivationCode, type ActivationCodePayload } from './intakeApi'
import { useBindingStatusPoll } from './useBindingStatusPoll'
import { useOnlineStatus } from './useOnlineStatus'
import { isExpired } from './countdown'
import { copyText } from './copyText'
import { buildWaMeLink } from './waMeLink'
import { WaMeQrCode } from './WaMeQrCode'
import { StickyCtaBar, WhatsAppTourShell } from './WhatsAppTourShell'
import type { WhatsAppConnectLocationState } from './WhatsAppConnectPage'

export function ActivationCodePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()
  const onboarding = useOnboardingState()
  const online = useOnlineStatus()
  const routeState = (location.state || {}) as WhatsAppConnectLocationState

  const [payload, setPayload] = useState<ActivationCodePayload | null>(() =>
    routeState.displayCode
      ? {
          display_code: routeState.displayCode,
          shared_number_e164: routeState.sharedNumberE164 || '',
          expires_at: routeState.expiresAt || '',
        }
      : null,
  )
  const [loading, setLoading] = useState(!routeState.displayCode)
  const [regenerating, setRegenerating] = useState(false)
  const [passive, setPassive] = useState(false)
  const [desktopHint, setDesktopHint] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const already = completedViaCaption(onboarding.state, 'whatsapp')

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (payload) return
    let cancelled = false
    setLoading(true)
    void getCurrentActivationCode().then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.ok && result.data) setPayload(result.data)
      else {
        addToast({ title: "Couldn't load an activation code. Try again.", variant: 'error' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [payload, addToast])

  const expired = payload ? isExpired(payload.expires_at, now) : false

  useEffect(() => {
    if (!expired || !payload) return
    addToast({
      title: "Your code expired. Tap 'I didn't get it' to get a fresh one.",
      variant: 'default',
    })
    // Intentionally once per expiry — reset when a new code arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast only on transition into expired
  }, [expired])

  const { bound, status, pollError, capReached } = useBindingStatusPoll({
    enabled: Boolean(payload) && online,
  })

  useEffect(() => {
    if (!bound) return
    void markWhatsAppIntakeProgress(onboarding, { kind: 'bound' })
    navigate('/onboarding/whatsapp/waiting', {
      state: { phone_e164: status?.phone_e164 },
    })
  }, [bound, navigate, onboarding, status?.phone_e164])

  const waHref = useMemo(
    () => (payload ? buildWaMeLink(payload.shared_number_e164, payload.display_code) : ''),
    [payload],
  )

  const onRegenerate = async () => {
    setRegenerating(true)
    const result = await postActivationCode()
    setRegenerating(false)
    if (!result.ok || !result.data) {
      addToast({ title: "Couldn't get a new code. Try again in a moment.", variant: 'error' })
      return
    }
    setPayload(result.data)
    addToast({
      title: `New code ready — send ${result.data.display_code} to activate.`,
      variant: 'success',
    })
  }

  const onOpenWhatsApp = async () => {
    if (!payload || expired) return
    setPassive(true)
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) {
      await copyText(payload.display_code)
      setDesktopHint(true)
      return
    }
    window.location.href = waHref
  }

  if (capReached) {
    return (
      <WhatsAppTourShell step={3} title="Activation code" offline={!online}>
        <div className="mx-auto max-w-lg px-[var(--lc-space-md)] py-[var(--lc-space-xl)] text-center">
          <StepHero
            glyph="whatsapp-mark"
            title="It's been 24 hours"
            body="Your previous code is no longer valid. Get a fresh one to keep going."
          />
          <Button
            type="button"
            size="lg"
            className="mt-[var(--lc-space-lg)]"
            onClick={() => void onRegenerate()}
          >
            Get a new code
          </Button>
        </div>
      </WhatsAppTourShell>
    )
  }

  return (
    <WhatsAppTourShell
      step={3}
      title="Activation code"
      offline={!online}
      offlineMessage="You're offline — connect to keep watching for WhatsApp."
    >
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-[var(--lc-space-md)] px-[var(--lc-space-md)] py-[var(--lc-space-md)] md:flex-row md:gap-[var(--lc-space-xl)]">
        <div className="min-w-0 flex-1 md:w-[55%]">
          <StepHero
            glyph="whatsapp-mark"
            title="Send this code to activate"
            body="Copy the code below, open WhatsApp, and send it to the WingCaster number. We'll take it from there."
          />
          {already ? (
            <p className="mt-[var(--lc-space-sm)] text-center text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
              {already}
            </p>
          ) : null}

          {pollError ? (
            <p
              role="status"
              className="mt-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-sm text-[var(--lc-text-secondary)]"
            >
              Checking your WhatsApp… reconnect to keep watching.
            </p>
          ) : null}

          {loading || !payload ? (
            <div
              className="mt-[var(--lc-space-md)] h-48 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
              aria-hidden
            />
          ) : (
            <div className="relative mt-[var(--lc-space-md)] [&_[role=img]]:hidden">
              <WhatsAppHandshakePanel
                displayCode={payload.display_code}
                sharedNumberE164={payload.shared_number_e164}
                expiresAt={payload.expires_at}
                onRegenerate={onRegenerate}
                regenerating={regenerating}
              />
              <div className="mt-[var(--lc-space-md)] md:hidden">
                <WaMeQrCode href={waHref} />
              </div>
            </div>
          )}

          <HowThisWorks />
        </div>

        <aside className="hidden md:flex md:w-[45%] md:flex-col md:items-center md:justify-start md:pt-[var(--lc-space-xl)]">
          {payload ? <WaMeQrCode href={waHref} /> : null}
        </aside>
      </div>

      <StickyCtaBar>
        {passive ? (
          <p className="flex items-center justify-center gap-2 py-[var(--lc-space-sm)] text-sm text-[var(--lc-text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Waiting for your message on WhatsApp…
          </p>
        ) : (
          <div className="flex flex-col gap-[var(--lc-space-xs)] md:flex-row-reverse md:items-center md:justify-start">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-[var(--lc-text-muted)] md:w-auto"
              onClick={() => setPassive(true)}
            >
              I'll send it manually
            </Button>
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full md:w-auto"
              disabled={!payload || expired || !online}
              onClick={() => void onOpenWhatsApp()}
            >
              <span aria-hidden>
                <ChannelMark channel="whatsapp" className="me-2 h-5 w-5" />
              </span>
              Open WhatsApp with code pre-filled
            </Button>
          </div>
        )}
      </StickyCtaBar>

      <Dialog open={desktopHint} onOpenChange={setDesktopHint}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open WhatsApp on your phone</DialogTitle>
            <DialogDescription>
              The code is copied. Or scan the QR.
            </DialogDescription>
          </DialogHeader>
          {payload ? (
            <p className="text-sm text-[var(--lc-text-secondary)]">
              Send <Numeric>{payload.display_code}</Numeric> from your phone.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </WhatsAppTourShell>
  )
}

function HowThisWorks() {
  return (
    <details className="mt-[var(--lc-space-lg)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
      <summary className="flex min-h-[var(--lc-tap-target-min)] cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-[var(--lc-text-primary)]">
        How this works
        <ChevronDown className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden />
      </summary>
      <ul className="mt-[var(--lc-space-sm)] list-disc space-y-1 ps-5 pb-[var(--lc-space-sm)] text-sm text-[var(--lc-text-secondary)]">
        <li>WingCaster uses one shared WhatsApp number to keep intake fast and free.</li>
        <li>Your listings, leads, and conversations stay tied to your account.</li>
        <li>You can disconnect anytime from Settings → Channels.</li>
      </ul>
    </details>
  )
}
