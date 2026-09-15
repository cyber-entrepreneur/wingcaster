import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActivationCodeBanner } from '@/components/onboarding'
import { WhatsAppHandshakePanel } from '@/components/onboarding/whatsapp'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Numeric } from '@/components/ui/numeric'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import {
  fetchWhatsAppActivationCode,
  fetchWhatsAppBindingStatus,
  recordOnboardingEvent,
  regenerateWhatsAppActivationCode,
} from './api'
import { ActivationChrome } from './components/ActivationChrome'
import { act, type ActivationLocale } from './copy'
import { completedCaption, maskPhone } from './format'
import type { WhatsAppActivationCode } from './types'
import { useActivationState } from './useActivationState'

type BindPhase = 'waiting' | 'verifying' | 'bound' | 'expired' | 'rejected'

function countdownLabel(expiresAt: string): string {
  const ms = Date.parse(expiresAt) - Date.now()
  if (ms <= 0) return '00:00'
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function ActivationWhatsAppPage() {
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  usePageTitle(act('whatsapp.pageTitle', locale))
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { state, isLoading, complete, defer, completedCount, totalCount } = useActivationState()
  const [code, setCode] = useState<WhatsAppActivationCode | null>(null)
  const [phase, setPhase] = useState<BindPhase>('waiting')
  const [masked, setMasked] = useState('')
  const [tick, setTick] = useState(0)
  const [copied, setCopied] = useState<'code' | 'number' | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const step = state?.steps.find((s) => s.id === 'whatsapp')
  const alreadyComplete = step?.state === 'complete'

  const loadCode = useCallback(async () => {
    try {
      const next = await fetchWhatsAppActivationCode()
      setCode(next)
      setPhase(Date.parse(next.expires_at) <= Date.now() ? 'expired' : 'waiting')
    } catch {
      addToast({ variant: 'error', description: act('whatsapp.loadError', locale) })
    }
  }, [addToast, locale])

  useEffect(() => {
    if (alreadyComplete) return
    void loadCode()
  }, [alreadyComplete, loadCode])

  useEffect(() => {
    if (alreadyComplete || !code) return
    let cancelled = false
    let bound = false
    const poll = async () => {
      if (cancelled || bound) return
      try {
        const status = await fetchWhatsAppBindingStatus()
        if (cancelled || bound) return
        if (status.error_class === 'number_claimed' || status.error === 'number_claimed') {
          setPhase('rejected')
          addToast({
            variant: 'error',
            description: act('whatsapp.numberClaimed', locale),
          })
          return
        }
        if (status.bound) {
          bound = true
          setPhase('verifying')
          window.setTimeout(() => {
            if (cancelled) return
            setPhase('bound')
            setMasked(maskPhone(status.phone_e164))
          }, 400)
        }
      } catch {
        /* keep waiting */
      }
      setTick((n) => n + 1)
      if (code && Date.parse(code.expires_at) <= Date.now() && !bound) setPhase('expired')
    }
    void poll()
    const id = window.setInterval(() => void poll(), 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [addToast, alreadyComplete, code, locale])

  useEffect(() => {
    if (!code) return
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [code])

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
        breadcrumb={{ step: 1, title: act('whatsapp.pageTitle', locale) }}
        completed={0}
        total={0}
        progressSize="sm"
        maxWidthClass="max-w-[640px]"
      >
        <div className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
      </ActivationChrome>
    )
  }

  return (
    <ActivationChrome
      breadcrumb={{ step: 1, title: act('whatsapp.pageTitle', locale) }}
      completed={completedCount}
      total={totalCount}
      progressSize="sm"
      maxWidthClass="max-w-[640px]"
    >
      <h1
        className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)' }}
      >
        {act('whatsapp.h1', locale)}
      </h1>
      <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
        {act('whatsapp.sub', locale)}
      </p>

      {alreadyComplete ? (
        <div className="mb-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
          <p className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {act('whatsapp.already', locale, {
              when: completedCaption(step?.completed_via, step?.completed_at, locale),
            })}
          </p>
          <div className="flex items-center gap-[var(--lc-space-sm)]">
            <ChannelMark channel="whatsapp" className="h-8 w-8" />
            <p style={{ font: 'var(--lc-type-heading-3)' }}>{act('whatsapp.connected', locale)}</p>
          </div>
          <Button type="button" className="mt-[var(--lc-space-lg)]" onClick={() => goBack()}>
            {act('common.returnWizard', locale)}
          </Button>
        </div>
      ) : (
        <>
          {code ? (
            <div className={phase === 'expired' ? 'opacity-60' : undefined}>
              <ActivationCodeBanner
                code={code.display_code}
                shared_number={code.shared_number_e164}
                expires_at={code.expires_at}
                status={phase === 'bound' ? 'connected' : phase === 'expired' ? 'expired' : 'pending'}
                connectedPhoneLabel={masked || undefined}
                countdownLabel={act('whatsapp.expiresIn', locale, { time: countdownLabel(code.expires_at) })}
                copiedTarget={copied}
                onCopy={async (target) => {
                  const value = target === 'code' ? code.display_code : code.shared_number_e164
                  try {
                    await navigator.clipboard.writeText(value)
                    setCopied(target)
                    window.setTimeout(() => setCopied(null), 2000)
                  } catch {
                    /* ignore */
                  }
                }}
                onCheckAgain={
                  phase === 'expired'
                    ? async () => {
                        setRegenerating(true)
                        try {
                          const next = await regenerateWhatsAppActivationCode()
                          setCode(next)
                          setPhase('waiting')
                        } finally {
                          setRegenerating(false)
                        }
                      }
                    : undefined
                }
                checking={regenerating}
              />
              {phase !== 'expired' && phase !== 'bound' ? (
                <div className="mt-[var(--lc-space-md)]">
                  <WhatsAppHandshakePanel
                    displayCode={code.display_code}
                    sharedNumberE164={code.shared_number_e164}
                    expiresAt={code.expires_at}
                    regenerating={regenerating}
                    onRegenerate={async () => {
                      setRegenerating(true)
                      try {
                        const next = await regenerateWhatsAppActivationCode()
                        setCode(next)
                        setPhase('waiting')
                      } finally {
                        setRegenerating(false)
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === 'waiting' || phase === 'verifying' ? (
            <p
              className="mt-[var(--lc-space-md)] inline-flex items-center gap-2 text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
              aria-live="polite"
            >
              <span
                className="inline-block h-2 w-2 rounded-full bg-[var(--lc-accent-bold)] outline outline-1 outline-[var(--lc-accent-bold-edge)] motion-safe:animate-pulse"
                aria-hidden="true"
              />
              {phase === 'waiting' ? act('whatsapp.waiting', locale) : act('whatsapp.verifying', locale)}
            </p>
          ) : null}

          {phase === 'bound' ? (
            <div className="mt-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-status-published-fg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
              <div className="flex items-center gap-[var(--lc-space-sm)]">
                <ChannelMark channel="whatsapp" className="h-8 w-8" />
                <p style={{ font: 'var(--lc-type-heading-3)' }}>
                  {act('whatsapp.connectedMasked', locale, { masked })}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-[var(--lc-space-sm)]"
                onClick={() => {
                  setPhase('waiting')
                  setMasked('')
                  void loadCode()
                }}
              >
                {act('whatsapp.differentNumber', locale)}
              </Button>
            </div>
          ) : null}

          {phase === 'expired' ? (
            <Button
              type="button"
              variant="link"
              className="mt-[var(--lc-space-sm)] text-[var(--lc-text-brand)]"
              onClick={() => void regenerateWhatsAppActivationCode().then((next) => {
                setCode(next)
                setPhase('waiting')
              })}
            >
              {act('whatsapp.expired', locale)}
            </Button>
          ) : null}

          <div className="mt-[var(--lc-space-xl)] flex flex-col gap-[var(--lc-space-sm)]">
            <Button
              type="button"
              disabled={phase !== 'bound'}
              onClick={async () => {
                const next = await complete('whatsapp', 'dashboard_action')
                const done = next.steps.filter((s) => s.state === 'complete').length
                goBack(done)
              }}
            >
              {act('common.markComplete', locale)}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await defer('whatsapp')
                navigate('/activate')
              }}
            >
              {act('common.later', locale)}
            </Button>
            <Button
              type="button"
              variant="link"
              className="text-[var(--lc-text-muted)]"
              onClick={async () => {
                await defer('whatsapp')
                await recordOnboardingEvent({
                  event: 'activation_defer',
                  family: 'activation',
                  step_id: 'whatsapp',
                  reason: 'no_business_whatsapp',
                })
                navigate('/activate')
              }}
            >
              {act('whatsapp.skipTertiary', locale)}
            </Button>
          </div>
        </>
      )}
      <span className="sr-only">{tick}</span>
    </ActivationChrome>
  )
}
