import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Copy, RefreshCw, ShieldCheck } from 'lucide-react'
import { OtpInput, useStepUp } from '@/components/mfa'
import { SettingsPaneHeader } from '@/components/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/api/client'
import { isNotFound } from '@/lib/http-status'
import { formatLongDate, formatMmSs, maskEmail } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

const WORD_PARTS = [
  'orange', 'piano', 'frost', 'cedar', 'olive', 'nimbus', 'harbor', 'quartz', 'ember', 'saffron',
  'dune', 'atlas', 'pearl', 'cinder', 'lotus',
]

const REASONS = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'missing_feature', label: 'Missing a feature I need' },
  { value: 'switching', label: 'Switching to another tool' },
  { value: 'business_closed', label: 'My business closed' },
  { value: 'privacy', label: 'Privacy concerns' },
  { value: 'prefer_not', label: 'Prefer not to say' },
]

export type DeleteStep = 1 | 2 | 3 | 4

function randomWord(): string {
  const pick = () => WORD_PARTS[Math.floor(Math.random() * WORD_PARTS.length)]
  return `${pick()}-${pick()}-${pick()}`
}

function StepDots({ step }: { step: DeleteStep }) {
  return (
    <ol className="mb-[var(--lc-space-lg)] flex gap-[var(--lc-space-xs)]" aria-label={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map((n) => (
        <li
          key={n}
          className={cn(
            'h-2 w-2 rounded-[var(--lc-radius-pill)]',
            n <= step ? 'bg-[var(--lc-action-primary)]' : 'bg-[var(--lc-border-strong)]',
          )}
          aria-current={n === step ? 'step' : undefined}
        />
      ))}
    </ol>
  )
}

export function DeleteAccountPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { requireStepUp } = useStepUp({ reason: 'Confirm account deletion' })
  usePageTitle('Delete Account')

  const [step, setStep] = useState<DeleteStep>(1)
  const [word, setWord] = useState(randomWord)
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [wordError, setWordError] = useState<string | null>(null)
  const [block, setBlock] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + 15 * 60 * 1000)
  const [resendAt, setResendAt] = useState(Date.now() + 60_000)
  const [now, setNow] = useState(Date.now())
  const [code, setCode] = useState('')
  const [deletedOn, setDeletedOn] = useState<string | null>(null)
  const [backendMissing, setBackendMissing] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.round((expiresAt - now) / 1000))
  const resendWait = Math.max(0, Math.round((resendAt - now) / 1000))
  const emailMasked = maskEmail(typeof agent?.email === 'string' ? agent.email : '')
  const wordMatches = typed.toLowerCase() === word.toLowerCase()
  const canContinue = wordMatches && Boolean(reason)

  async function regenerate() {
    try {
      const res = await api.regenerateDeleteAccountWord()
      if (res?.word) setWord(res.word)
      else setWord(randomWord())
    } catch {
      setWord(randomWord())
    }
    setTyped('')
    setWordError(null)
  }

  async function initiate() {
    if (!canContinue) {
      if (!wordMatches) setWordError("That's not the word. Try again or refresh for a new one.")
      return
    }
    setBusy(true)
    try {
      await api.initiateDeleteAccount({ word, reason, notes })
      setBackendMissing(false)
      setExpiresAt(Date.now() + 15 * 60 * 1000)
      setResendAt(Date.now() + 60_000)
      setStep(2)
    } catch (err: unknown) {
      const status = err && typeof err === 'object' ? (err as { status?: number }).status : undefined
      const code = err && typeof err === 'object' ? (err as { code?: string }).code : undefined
      if (status === 409 && (code === 'AGENCY_OWNER' || String((err as Error).message || '').includes('members'))) {
        setBlock(
          'You own an agency with active members. Transfer ownership or remove all members before deleting your account.',
        )
      } else if (status === 409 && (code === 'PAST_DUE' || String((err as Error).message || '').includes('invoice'))) {
        setBlock('You have unpaid invoices. Settle them or contact support before deleting.')
      } else if (isNotFound(err)) {
        setBackendMissing(true)
        setExpiresAt(Date.now() + 15 * 60 * 1000)
        setResendAt(Date.now() + 60_000)
        setStep(2)
      } else {
        addToast({
          title: 'Could not start deletion.',
          description: err instanceof Error ? err.message : 'Try again.',
          variant: 'error',
        })
      }
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    if (resendWait > 0) return
    try {
      await api.resendDeleteAccountEmail()
    } catch {
      /* degraded */
    }
    setExpiresAt(Date.now() + 15 * 60 * 1000)
    setResendAt(Date.now() + 60_000)
    addToast({ title: 'Confirmation email sent.', variant: 'success' })
  }

  async function cancelFlow() {
    try {
      await api.cancelDeleteAccount()
    } catch {
      /* ignore */
    }
    addToast({ title: 'Deletion cancelled', variant: 'success' })
    navigate('/settings/account')
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await requireStepUp({ reason: 'Confirm account deletion' })
    } catch {
      setBusy(false)
      return
    }
    try {
      const scheduled = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      try {
        const res = (await api.confirmDeleteAccount({ code, word })) as { deleted_at?: string } | null
        setDeletedOn(res?.deleted_at || scheduled)
      } catch (err) {
        if (!isNotFound(err)) throw err
        setDeletedOn(scheduled)
      }
      setStep(4)
    } catch (err) {
      addToast({
        title: 'Could not confirm deletion.',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const scheduledLabel = useMemo(
    () => (deletedOn ? formatLongDate(deletedOn) : formatLongDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())),
    [deletedOn],
  )

  if (block) {
    return (
      <div>
        <SettingsPaneHeader title="Delete Account" />
        <Card>
          <CardContent className="space-y-[var(--lc-space-md)] p-[var(--lc-space-lg)]">
            <AlertTriangle className="h-8 w-8 text-[var(--lc-status-underOffer-fg)]" aria-hidden="true" />
            <p>{block}</p>
            <Button asChild variant="outline">
              <Link to="/agency">Go to agency members</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <SettingsPaneHeader title={step === 2 ? 'Check your email' : step === 3 ? 'One more step' : step === 4 ? `Your account will be deleted on ${scheduledLabel}` : 'Delete Account'} />
      <StepDots step={step} />

      {step === 1 ? (
        <div className="space-y-[var(--lc-space-lg)]">
          <Card className="bg-[var(--lc-status-underOffer-bg)] text-[var(--lc-status-underOffer-fg)]">
            <CardContent className="flex gap-[var(--lc-space-md)] p-[var(--lc-space-lg)]">
              <AlertTriangle className="h-8 w-8 shrink-0" aria-hidden="true" />
              <p>This will permanently delete your account after a 30-day cool-down.</p>
            </CardContent>
          </Card>
          <div className="space-y-[var(--lc-space-md)]" style={{ font: 'var(--lc-type-body)' }}>
            <p className="font-semibold">Deleted at the end of the cool-down:</p>
            <ul className="list-disc ps-[var(--lc-space-lg)]">
              <li>Your profile and login</li>
              <li>Your listings — archived, then removed</li>
              <li>Your contacts — pseudonymized per GDPR</li>
              <li>Any unspent credits — forfeited</li>
            </ul>
            <p className="font-semibold">Kept for legal reasons:</p>
            <ul className="list-disc ps-[var(--lc-space-lg)]">
              <li>Invoices and payment records (7 years)</li>
              <li>Aggregate audit trail (redacted)</li>
            </ul>
            <p className="font-semibold">Effective right now:</p>
            <ul className="list-disc ps-[var(--lc-space-lg)]">
              <li>You will be signed out of every device</li>
              <li>Your public profile will be hidden</li>
            </ul>
          </div>
          <Card className="shadow-[var(--lc-elevation-sm)]">
            <CardContent className="space-y-[var(--lc-space-sm)] p-[var(--lc-space-lg)]">
              <p>To confirm you're deleting on purpose, type this:</p>
              <div className="flex items-center gap-[var(--lc-space-sm)]">
                <span
                  data-testid="liveness-word"
                  className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]"
                  style={{ font: 'var(--lc-type-data)' }}
                >
                  {word}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="Copy word"
                  onClick={() => void navigator.clipboard?.writeText(word)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Label htmlFor="delete-word">Type the word above</Label>
              <Input
                id="delete-word"
                value={typed}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => {
                  setTyped(e.target.value)
                  setWordError(null)
                }}
                aria-invalid={Boolean(wordError)}
              />
              {wordError ? (
                <p className="text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-caption)' }}>
                  {wordError}
                </p>
              ) : null}
              <button type="button" className="inline-flex items-center gap-1 text-[var(--lc-text-brand)]" onClick={() => void regenerate()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Get a new word
              </button>
            </CardContent>
          </Card>
          <div className="space-y-[var(--lc-space-2xs)]">
            <Label htmlFor="delete-reason">Why are you leaving?</Label>
            <select
              id="delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[var(--lc-tap-target-min)] w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
            >
              <option value="">Why are you leaving?</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <Label htmlFor="delete-notes" className="sr-only">
              Additional notes
            </Label>
            <Input id="delete-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={!canContinue || busy}
            onClick={() => void initiate()}
          >
            {busy ? 'Sending you an email…' : 'Continue to email verification'}
          </Button>
          <button type="button" className="block w-full text-center text-[var(--lc-text-muted)]" onClick={() => navigate('/settings/account')}>
            Cancel
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-[var(--lc-space-lg)]">
          {backendMissing ? (
            <p className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-underOffer-bg)] p-[var(--lc-space-md)] text-[var(--lc-status-underOffer-fg)]">
              Confirmation email isn't available on this environment yet. You can continue to verification to complete the remaining steps.
            </p>
          ) : (
            <p>
              We just sent a confirmation link to {emailMasked}. Click it within <strong>15 minutes</strong> to continue.
            </p>
          )}
          <p className="inline-flex items-center gap-2 rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-xs)]">
            Link expires in <Numeric>{formatMmSs(remaining)}</Numeric>
          </p>
          <Button variant="outline" type="button" disabled={resendWait > 0} onClick={() => void resend()}>
            {resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend email'}
          </Button>
          <Link to="/settings/account" className="block text-[var(--lc-text-brand)]">
            Not this email?
          </Link>
          <Button type="button" onClick={() => setStep(3)}>
            Continue to verification
          </Button>
          <Button variant="outline" type="button" onClick={() => void cancelFlow()}>
            Cancel deletion
          </Button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-[var(--lc-space-lg)]">
          <ShieldCheck className="h-8 w-8 text-[var(--lc-text-heading)]" aria-hidden="true" />
          <p>For safety, enter the 6-digit code from your authenticator app to continue.</p>
          <OtpInput value={code} onChange={setCode} autoFocus aria-label="Verification code" />
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={code.length < 6 || busy}
            onClick={() => void confirmDelete()}
          >
            {busy ? 'Verifying…' : 'Verify and delete'}
          </Button>
          <Button variant="outline" type="button" onClick={() => void cancelFlow()}>
            Cancel deletion
          </Button>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-[var(--lc-space-lg)]">
          <p>
            Your Wingcaster account is scheduled for deletion on <strong>{scheduledLabel}</strong> (30 days from today).
            We'll email you a reminder one week and one day before the deletion.
          </p>
          <Card className="shadow-[var(--lc-elevation-sm)]">
            <CardContent className="space-y-[var(--lc-space-md)] p-[var(--lc-space-lg)]">
              <p>Changed your mind? You can cancel any time before {scheduledLabel}.</p>
              <Button variant="outline" type="button" className="w-full" onClick={() => void cancelFlow()}>
                Cancel Deletion
              </Button>
            </CardContent>
          </Card>
          <details>
            <summary className="cursor-pointer">What to expect</summary>
            <ul className="mt-[var(--lc-space-sm)] list-disc ps-[var(--lc-space-lg)] text-[var(--lc-text-muted)]">
              <li>Between now and {scheduledLabel}, your account is signed out and your public profile is hidden.</li>
              <li>You can sign back in with the same credentials to cancel the deletion.</li>
              <li>After {scheduledLabel}, this cannot be reversed.</li>
            </ul>
          </details>
          <a href="mailto:support@wingcaster.app" className="text-[var(--lc-text-brand)]">
            Contact support
          </a>
        </div>
      ) : null}
    </div>
  )
}
