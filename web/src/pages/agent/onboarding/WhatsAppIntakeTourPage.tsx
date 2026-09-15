import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Button } from '@/components/ui/button'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import {
  ActivationCodeBanner,
  OnboardingStepper,
  OfflineBanner,
  type ActivationCodeStatus,
} from '@/components/onboarding'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { OnboardingChrome } from './OnboardingChrome'
import { LivePollIndicator } from './LivePollIndicator'
import {
  getBindingStatus,
  listWhatsAppDrafts,
  postActivationCode,
  trackOnboardingEvent,
  type ActivationCodePayload,
  type WhatsAppDraft,
} from './onboardingApi'
import { useOnlineStatus, usePrefersReducedMotion } from './useOnlineStatus'
import {
  formatCountdown,
  formatSharedNumber,
  isPatchConflict,
  maskPhone,
  resumeRouteForStep,
  speakCode,
  waMeUrl,
} from './helpers'

const STEPPER = [
  { id: 'get-code', label: 'Get code' },
  { id: 'send-code', label: 'Send code to WingCaster' },
  { id: 'send-photos', label: 'Send photos + voice memo' },
  { id: 'draft', label: 'We draft your listing' },
] as const

const BIND_POLL_MS = 3000
const DRAFT_POLL_MS = 5000
const NUDGE_AFTER_MS = 5 * 60 * 1000

function isCollecting(status: string): boolean {
  return status === 'collecting'
}

function isAwaiting(status: string): boolean {
  return status === 'awaiting_approval'
}

export function WhatsAppIntakeTourPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { state, patch, isLoading } = useOnboardingState()
  const online = useOnlineStatus()
  const reducedMotion = usePrefersReducedMotion()

  const [code, setCode] = useState<ActivationCodePayload | null>(null)
  const [codeError, setCodeError] = useState(false)
  const [codeLoading, setCodeLoading] = useState(true)
  const [bound, setBound] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'number' | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [checking, setChecking] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [draftPhase, setDraftPhase] = useState<'none' | 'collecting' | 'ready'>('none')
  const [pollFailed, setPollFailed] = useState(0)
  const [showNudge, setShowNudge] = useState(false)
  const [pollRetryIn, setPollRetryIn] = useState<number | null>(null)

  const boundAtRef = useRef<number | null>(null)
  const bindTimer = useRef<number | null>(null)
  const draftTimer = useRef<number | null>(null)
  const backoffRef = useRef(BIND_POLL_MS)
  const lastCountdownAnnounce = useRef(0)

  usePageTitle('WhatsApp intake')

  const remainingMs = code ? Date.parse(code.expires_at) - now : 0
  const expired = Boolean(code) && remainingMs <= 0 && !bound
  const status: ActivationCodeStatus = bound ? 'connected' : expired ? 'expired' : 'pending'

  const activeIndex = bound
    ? draftPhase === 'collecting' || draftPhase === 'ready'
      ? 3
      : 2
    : 1

  const pollLabel =
    draftPhase === 'collecting'
      ? "We're drafting your listing… almost there."
      : bound
        ? 'Waiting for your first listing message…'
        : 'Listening for your message…'

  const fetchCode = useCallback(async () => {
    setCodeLoading(true)
    setChecking(true)
    setCodeError(false)
    try {
      const payload = await postActivationCode()
      setCode(payload)
      setBound(false)
      setDraftPhase('none')
      trackOnboardingEvent('onboarding.whatsapp_code_generated')
    } catch {
      setCodeError(true)
      addToast({ variant: 'error', description: "We couldn't generate a code. Try again?" })
    } finally {
      setCodeLoading(false)
      setChecking(false)
    }
  }, [addToast])

  useEffect(() => {
    if (isLoading) return
    if (state.step === 'whatsapp_intake_pending') return
    const next = resumeRouteForStep(state.step)
    navigate(next ?? '/onboarding/welcome', { replace: true })
  }, [isLoading, navigate, state.step])

  useEffect(() => {
    void fetchCode()
  }, [fetchCode])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!code || bound || expired || remainingMs <= 0) return
    if (now - lastCountdownAnnounce.current < 60_000) return
    lastCountdownAnnounce.current = now
  }, [bound, code, expired, now, remainingMs])

  useEffect(() => {
    if (!code) return
    const href = waMeUrl(code.shared_number_e164, code.display_code)
    let cancelled = false
    QRCode.toDataURL(href, { width: 200, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [code])

  const stopPolls = useCallback(() => {
    if (bindTimer.current) window.clearTimeout(bindTimer.current)
    if (draftTimer.current) window.clearTimeout(draftTimer.current)
    bindTimer.current = null
    draftTimer.current = null
  }, [])

  const onDrafts = useCallback(
    async (drafts: WhatsAppDraft[]) => {
      const ready = drafts.find((d) => isAwaiting(d.status))
      if (ready) {
        setDraftPhase('ready')
        trackOnboardingEvent('onboarding.first_draft_appeared', { draft_id: ready.id })
        try {
          await patch({ step: 'draft_review', path: 'whatsapp' })
        } catch (error) {
          if (!isPatchConflict(error)) {
            addToast({ variant: 'error', description: "We couldn't save your progress. Try again?" })
            return
          }
        }
        navigate(`/onboarding/first-listing/${ready.id}`)
        return
      }
      if (drafts.some((d) => isCollecting(d.status))) {
        setDraftPhase('collecting')
      }
    },
    [addToast, navigate, patch],
  )

  useEffect(() => {
    stopPolls()
    if (!online || !code || expired) return undefined

    const scheduleBind = (delay: number) => {
      bindTimer.current = window.setTimeout(async () => {
        try {
          const statusRes = await getBindingStatus()
          backoffRef.current = BIND_POLL_MS
          setPollFailed(0)
          setPollRetryIn(null)
          if (statusRes.bound) {
            if (!bound) {
              setBound(true)
              boundAtRef.current = Date.now()
              if (statusRes.phone_e164) setMaskedPhone(maskPhone(statusRes.phone_e164))
              trackOnboardingEvent('onboarding.whatsapp_bound')
              addToast({
                variant: 'success',
                description:
                  'WhatsApp connected. Now send us photos and a voice memo about the property.',
              })
            }
            return
          }
        } catch {
          const next = Math.min(backoffRef.current * 2, 30_000)
          backoffRef.current = next
          setPollFailed((n) => n + 1)
          setPollRetryIn(Math.round(next / 1000))
          scheduleBind(next)
          return
        }
        scheduleBind(BIND_POLL_MS)
      }, delay)
    }

    if (!bound) scheduleBind(0)

    const scheduleDrafts = (delay: number) => {
      draftTimer.current = window.setTimeout(async () => {
        try {
          const drafts = await listWhatsAppDrafts()
          await onDrafts(drafts)
        } catch {
          /* binding backoff covers user-visible retry */
        }
        scheduleDrafts(DRAFT_POLL_MS)
      }, delay)
    }

    if (bound) scheduleDrafts(0)

    return () => stopPolls()
  }, [addToast, bound, code, expired, onDrafts, online, stopPolls])

  useEffect(() => {
    if (!bound || draftPhase !== 'none' || !boundAtRef.current) return
    const id = window.setInterval(() => {
      if (Date.now() - (boundAtRef.current ?? 0) >= NUDGE_AFTER_MS) setShowNudge(true)
    }, 15_000)
    return () => window.clearInterval(id)
  }, [bound, draftPhase])

  const handleCopy = async (target: 'code' | 'number') => {
    if (!code) return
    const value = target === 'code' ? code.display_code : code.shared_number_e164
    try {
      await navigator.clipboard.writeText(value)
      setCopied(target)
      addToast({ description: 'Copied to clipboard.', duration: 2000 })
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      addToast({ variant: 'error', description: "We couldn't copy that. Try again?" })
    }
  }

  const handleEscape = async () => {
    try {
      await patch({ step: 'manual_wizard', path: 'manual' })
    } catch (error) {
      if (!isPatchConflict(error)) {
        addToast({ variant: 'error', description: "We couldn't save your choice. Try again?" })
        return
      }
    }
    navigate('/listings/new')
  }

  const countdownLabel = expired
    ? 'This code expired. Get a new one →'
    : `Code expires in ${formatCountdown(remainingMs)}`

  const countdownAria =
    !bound && code && Math.floor(remainingMs / 60_000) !== Math.floor((remainingMs + 1000) / 60_000)
      ? countdownLabel
      : undefined

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--lc-bg-page)]">
        <OnboardingChrome step={2} label="WhatsApp intake" />
        <div className="mx-auto max-w-xl animate-pulse p-[var(--lc-space-lg)]">
          <div className="h-48 rounded-[var(--lc-radius-xl)] bg-[var(--lc-surface-sunken)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      <OfflineBanner
        show={!online}
        message="You're offline. We can't check for new messages until you reconnect."
      />
      <OnboardingChrome step={2} label="WhatsApp intake" />

      <div className="mx-auto grid max-w-6xl gap-[var(--lc-space-xl)] px-[var(--lc-space-md)] py-[var(--lc-space-lg)] md:grid-cols-[3fr_2fr] md:px-[var(--lc-space-xl)]">
        <div className="flex flex-col gap-[var(--lc-space-lg)]">
          <div>
            <h1
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-1)' }}
            >
              Bind your WhatsApp to WingCaster.
            </h1>
            <p
              className="mt-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]"
              style={{ font: 'var(--lc-type-body-lg)' }}
            >
              {bound
                ? 'Now send photos + a voice memo of the property.'
                : 'Send the code below to our WhatsApp. Then send photos + a voice memo of the property.'}
            </p>
          </div>

          {codeLoading ? (
            <div
              className="h-56 animate-pulse rounded-[var(--lc-radius-xl)] bg-[var(--lc-surface-sunken)]"
              aria-busy="true"
            />
          ) : codeError || !code ? (
            <div className="rounded-[var(--lc-radius-xl)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
              <p className="text-[var(--lc-text-secondary)]">We couldn&apos;t generate a code. Try again?</p>
              <Button className="mt-[var(--lc-space-md)]" onClick={() => void fetchCode()}>
                Try again
              </Button>
            </div>
          ) : (
            <ActivationCodeBanner
              code={code.display_code}
              shared_number={formatSharedNumber(code.shared_number_e164)}
              expires_at={code.expires_at}
              status={status}
              connectedPhoneLabel={maskedPhone ?? undefined}
              countdownLabel={countdownLabel}
              onCopy={handleCopy}
              onCheckAgain={expired ? () => void fetchCode() : undefined}
              checking={checking}
              copiedTarget={copied}
            />
          )}

          {code && !expired ? (
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full"
              onClick={() => {
                window.open(waMeUrl(code.shared_number_e164, code.display_code), '_blank', 'noopener,noreferrer')
              }}
            >
              <ChannelMark channel="whatsapp" className="me-2 h-5 w-5" />
              Open WhatsApp with the code
            </Button>
          ) : null}

          {code ? (
            <span className="sr-only">
              <code aria-label={`Your WingCaster activation code, ${speakCode(code.display_code)}`}>
                {code.display_code}
              </code>
            </span>
          ) : null}

          {countdownAria ? (
            <span className="sr-only" aria-live="polite">
              {countdownAria}
            </span>
          ) : null}

          {copied ? (
            <span className="sr-only" aria-live="polite">
              Copied to clipboard.
            </span>
          ) : null}

          <OnboardingStepper steps={[...STEPPER]} activeIndex={activeIndex} />

          <LivePollIndicator label={pollLabel} reducedMotion={reducedMotion} />

          {pollFailed >= 3 && pollRetryIn != null ? (
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              We&apos;re having trouble checking status. Refreshing in {pollRetryIn}s…
              <Button
                type="button"
                variant="link"
                className="ms-2 h-auto p-0"
                onClick={() => {
                  backoffRef.current = BIND_POLL_MS
                  setPollFailed(0)
                  void getBindingStatus()
                }}
              >
                Retry now
              </Button>
            </p>
          ) : null}

          {showNudge ? (
            <p
              className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)] text-[var(--lc-text-secondary)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              Still no message? Make sure you saved the number correctly, and send a photo to start.
            </p>
          ) : null}

          <Button
            type="button"
            variant="link"
            className="h-auto justify-start p-0 text-[var(--lc-text-brand)]"
            onClick={() => void handleEscape()}
          >
            Prefer to type it yourself? Add manually →
          </Button>
        </div>

        <aside className="hidden flex-col gap-[var(--lc-space-md)] md:flex">
          {[
            `Save ${code ? formatSharedNumber(code.shared_number_e164) : '+971 4 555 0199'} as "WingCaster" in your contacts.`,
            'Send us the code above.',
            'Send photos and a voice note about the property.',
          ].map((text) => (
            <div
              key={text}
              className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] shadow-[var(--lc-elevation-sm)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {text}
            </div>
          ))}
          {qrUrl && code && !expired ? (
            <figure className="flex flex-col items-center gap-2 py-[var(--lc-space-md)]">
              <img
                src={qrUrl}
                alt="QR code that opens WhatsApp with your WingCaster activation code"
                width={200}
                height={200}
                className="rounded-[var(--lc-radius-md)]"
              />
              <figcaption className="text-center text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                Or scan on your phone → opens WhatsApp with the code.
              </figcaption>
            </figure>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
