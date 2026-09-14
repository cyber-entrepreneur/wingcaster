import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Loader2, ShieldCheck } from 'lucide-react'
import { api } from '@/api/client'
import { mutateSettingsIndex } from '@/hooks/useSettingsIndex'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
  EnrollmentStepper,
  OtpInput,
  PasswordGateCard,
  RevealableSecret,
  useStepUp,
} from '@/components/mfa'
import { MfaSettingsChrome, SettingsDialogHost } from './MfaSettingsChrome'
import {
  apiErrorCode,
  apiStatus,
  type BackupCodesLocationState,
  type EnrollLocationState,
} from './mfaShared'

export function TotpEnrollPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()
  const { requireStepUp } = useStepUp({ reason: 'Reset authenticator' })
  const isVerify = searchParams.get('stage') === 'verify'
  const isReset = searchParams.get('reset') === '1'
  const state = (location.state ?? {}) as EnrollLocationState

  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState<EnrollLocationState | null>(
    state.secret && state.provisioning_uri ? state : null,
  )
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrFailed, setQrFailed] = useState(false)
  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [successFlash, setSuccessFlash] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cantScanOpen, setCantScanOpen] = useState(false)
  const verifyButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isReset) return
    let cancelled = false
    requireStepUp({ reason: 'Reset authenticator' })
      .then(() => {
        if (!cancelled) addToast({ title: 'Confirm disable before re-enrolling from More options.' })
      })
      .catch(() => {
        if (!cancelled) navigate('/settings/2fa', { replace: true })
      })
    return () => {
      cancelled = true
    }
  }, [isReset, requireStepUp, addToast, navigate])

  useEffect(() => {
    if (isVerify && !setup?.secret) {
      addToast({ title: "Let's start setup again." })
      navigate('/settings/2fa/enroll', { replace: true })
    }
  }, [isVerify, setup?.secret, addToast, navigate])

  useEffect(() => {
    if (!setup?.provisioning_uri) {
      setQrDataUrl('')
      return
    }
    let cancelled = false
    QRCode.toDataURL(setup.provisioning_uri, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (cancelled) return
        setQrDataUrl(url)
        setQrFailed(false)
      })
      .catch(() => {
        if (cancelled) return
        setQrDataUrl('')
        setQrFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [setup?.provisioning_uri])

  const beginSetup = async () => {
    setPasswordError('')
    setBusy(true)
    try {
      const result = await api.totpSetup(password)
      setSetup(result)
      setPassword('')
    } catch (err: unknown) {
      const status = apiStatus(err)
      if (status === 401) setPasswordError('Current password is incorrect.')
      else if (status === 409) {
        addToast({ title: 'Two-factor is already enabled on this account.' })
        navigate('/settings/2fa', { replace: true })
      } else setPasswordError("We couldn't start two-factor setup. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const goVerify = () => {
    navigate('/settings/2fa/enroll?stage=verify', { state: setup })
  }

  const confirmVerify = async () => {
    if (!setup?.secret || code.length < 6) return
    setVerifyError('')
    setVerifying(true)
    try {
      const result = await api.totpVerify(setup.secret, code)
      void mutateSettingsIndex()
      setSuccessFlash(true)
      window.setTimeout(() => {
        const next: BackupCodesLocationState = {
          backupCodes: result.backup_codes,
          accountEmail: setup.account,
        }
        navigate('/settings/2fa/backup-codes?first-view=1', { state: next, replace: true })
      }, 120)
    } catch (err: unknown) {
      const status = apiStatus(err)
      const codeName = apiErrorCode(err)
      if (status === 409 || codeName === 'totp_already_enabled') {
        addToast({ title: 'Two-factor is already enabled on this account.' })
        navigate('/settings/2fa', { replace: true })
        return
      }
      if (status === 503 || codeName === 'credential_encryption_unavailable') {
        setVerifyError(
          'Two-factor authentication cannot be enabled until CREDENTIALS_ENCRYPTION_KEY is configured on the server.',
        )
        return
      }
      if (codeName.toLowerCase().includes('expired')) {
        addToast({ title: 'Setup session expired. Please start again.' })
        navigate('/settings/2fa/enroll', { replace: true })
        return
      }
      setVerifyError('That code did not match. Check your device clock and try the next one.')
      setCode('')
    } finally {
      setVerifying(false)
    }
  }

  const requestLeave = useCallback(() => {
    if (setup?.secret && !isVerify) {
      setCancelOpen(true)
      return
    }
    navigate('/settings/2fa')
  }, [setup?.secret, isVerify, navigate])

  useEffect(() => {
    if (!setup?.secret) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [setup?.secret])

  const qrReady = Boolean(qrDataUrl) && !qrFailed

  return (
    <>
    <MfaSettingsChrome>
      <div className="mx-auto max-w-[640px] space-y-[var(--lc-space-lg)] pb-[var(--lc-space-3xl)]">
        <EnrollmentStepper activeIndex={isVerify ? 1 : 0} />

        {!setup ? (
          <div className="space-y-[var(--lc-space-md)]">
            <PasswordGateCard
              value={password}
              onChange={setPassword}
              error={passwordError}
              loading={busy}
              onSubmit={() => {
                void beginSetup()
              }}
            />
            <Button type="button" variant="ghost" onClick={() => navigate('/settings/2fa')}>
              Cancel
            </Button>
          </div>
        ) : isVerify ? (
          <div className="space-y-[var(--lc-space-lg)]">
            <header>
              <h1
                className="text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
              >
                Enter the code from your app
              </h1>
              <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
                Open your authenticator app and type the 6-digit code you see for WingCaster.
              </p>
            </header>

            {verifyError && codeNameIsEncryption(verifyError) ? (
              <div
                role="alert"
                className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]"
              >
                {verifyError}
              </div>
            ) : null}

            {successFlash ? (
              <div className="flex items-center gap-2 text-[var(--lc-status-published-fg)]" aria-live="polite">
                <ShieldCheck className="h-6 w-6" aria-hidden />
                Two-factor authentication enabled.
              </div>
            ) : (
              <OtpInput
                count={6}
                value={code}
                disabled={verifying}
                error={Boolean(verifyError) && !codeNameIsEncryption(verifyError)}
                autoFocus
                aria-label="6-digit verification code"
                onChange={setCode}
                onComplete={() => verifyButtonRef.current?.focus()}
              />
            )}

            {verifyError && !codeNameIsEncryption(verifyError) ? (
              <p role="alert" className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-danger-fg)]">
                {verifyError}
              </p>
            ) : null}

            <Button
              ref={verifyButtonRef}
              type="button"
              size="lg"
              disabled={code.length < 6 || verifying}
              onClick={() => {
                void confirmVerify()
              }}
            >
              {verifying ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  Verifying…
                </>
              ) : (
                'Verify and enable'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/settings/2fa/enroll', { state: setup })}
            >
              ← Go back to QR
            </Button>
          </div>
        ) : (
          <div className="space-y-[var(--lc-space-lg)]">
            <header>
              <h1
                className="text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
              >
                Scan this with your authenticator app
              </h1>
              <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
                Open Google Authenticator, 1Password, Authy, or another authenticator app, then scan
                the code below.
              </p>
            </header>

            <div className="flex justify-center">
              <div className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-5 shadow-[var(--lc-elevation-sm)]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR code for setting up your authenticator app"
                    width={240}
                    height={240}
                    className="h-[200px] w-[200px] md:h-[240px] md:w-[240px]"
                  />
                ) : (
                  <div
                    aria-busy="true"
                    className="h-[200px] w-[200px] animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] md:h-[240px] md:w-[240px]"
                  />
                )}
              </div>
            </div>

            {qrFailed ? (
              <p role="alert" className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-danger-fg)]">
                Could not display QR. Enter the code manually below.
              </p>
            ) : null}

            <details
              className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]"
              open={cantScanOpen || qrFailed}
              onToggle={(e) => setCantScanOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="min-h-tap cursor-pointer text-[length:var(--lc-type-body)]">
                Can&apos;t scan? Enter this code instead
              </summary>
              <div className="mt-[var(--lc-space-sm)] space-y-[var(--lc-space-sm)]">
                {setup.issuer || setup.account ? (
                  <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                    {setup.issuer}
                    {setup.account ? ` · ${setup.account}` : ''}
                  </p>
                ) : null}
                <RevealableSecret secret={setup.secret ?? ''} initiallyRevealed={qrFailed} />
              </div>
            </details>

            <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              Don&apos;t have an authenticator app? Try{' '}
              <a
                href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--lc-text-brand)] underline-offset-4 hover:underline"
              >
                Google Authenticator ↗
              </a>
              {' · '}
              <a
                href="https://1password.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--lc-text-brand)] underline-offset-4 hover:underline"
              >
                1Password ↗
              </a>
              {' · '}
              <a
                href="https://authy.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--lc-text-brand)] underline-offset-4 hover:underline"
              >
                Authy ↗
              </a>
            </p>

            <div className="flex flex-wrap gap-[var(--lc-space-sm)]">
              <Button type="button" size="lg" disabled={!qrReady} onClick={goVerify}>
                Continue
              </Button>
              <Button type="button" variant="ghost" onClick={requestLeave}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <p>
          <Link to="/settings/2fa" className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
            ← Back to two-factor settings
          </Link>
        </p>
      </div>
    </MfaSettingsChrome>

        <SettingsDialogHost>
        {cancelOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-setup-title"
            className="fixed inset-0 z-modal flex items-center justify-center bg-[color-mix(in_srgb,var(--lc-text-primary)_40%,transparent)] p-[var(--lc-space-md)]"
          >
            <div className="w-full max-w-md rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-lg)]">
              <h2 id="cancel-setup-title" className="text-[length:var(--lc-type-heading-3)]">
                Cancel two-factor setup?
              </h2>
              <p className="mt-[var(--lc-space-sm)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
                Your progress will be lost.
              </p>
              <div className="mt-[var(--lc-space-lg)] flex justify-end gap-[var(--lc-space-sm)]">
                <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>
                  Stay
                </Button>
                <Button type="button" variant="destructive" onClick={() => navigate('/settings/2fa')}>
                  Cancel setup
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        </SettingsDialogHost>
    </>
  )
}

function codeNameIsEncryption(message: string): boolean {
  return message.includes('CREDENTIALS_ENCRYPTION_KEY')
}
