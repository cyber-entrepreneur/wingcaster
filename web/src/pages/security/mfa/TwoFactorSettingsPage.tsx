import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronDown,
  Shield,
  Smartphone,
} from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  BackupCodesRow,
  MethodRow,
  TwoFactorStatusHero,
  useStepUp,
} from '@/components/mfa'
import type { TwoFactorStatus } from '@/types/twoFactor'
import { DisableTwoFactorModal } from './DisableTwoFactorModal'
import { MfaSettingsChrome, SettingsDialogHost } from './MfaSettingsChrome'
import { apiStatus, formatEnrolledDate } from './mfaShared'

export function TwoFactorSettingsPage() {
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { addToast } = useToast()
  const { requireStepUp } = useStepUp({ reason: 'Turn off two-factor authentication' })
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<'network' | 'forbidden' | 'offline' | null>(null)
  const [disableOpen, setDisableOpen] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  const loadStatus = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      const next = await api.twoFactorStatus()
      setStatus(next)
    } catch (err: unknown) {
      const statusCode = apiStatus(err)
      if (statusCode === 403) setLoadError('forbidden')
      else if (typeof navigator !== 'undefined' && !navigator.onLine) setLoadError('offline')
      else setLoadError('network')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const beginDisable = async () => {
    if (!online) return
    try {
      await requireStepUp({ reason: 'Turn off two-factor authentication' })
      setDisableOpen(true)
    } catch {
      /* user cancelled step-up */
    }
  }

  const enabled = Boolean(status?.totp_enabled)
  const remaining = status?.backup_codes_remaining ?? 0
  const enrolledLabel = status?.totp_enrolled_at
    ? `Authenticator app · enrolled ${formatEnrolledDate(status.totp_enrolled_at)}`
    : 'Not set up'

  return (
    <>
    <MfaSettingsChrome>
      <div className="mx-auto max-w-[640px] space-y-[var(--lc-space-lg)] pb-24 md:pb-[var(--lc-space-3xl)]">
        <nav className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
          <Link to="/settings" className="hover:text-[var(--lc-text-brand)]">
            Settings
          </Link>
          <span aria-hidden> › </span>
          <span>Two-factor authentication</span>
        </nav>

        <header>
          <h1
            className="text-[var(--lc-text-heading)] md:text-[length:var(--lc-type-heading-1)]"
            style={{ font: 'var(--lc-type-heading-2)', letterSpacing: 'var(--lc-tracking-heading-2)' }}
          >
            Two-factor authentication
          </h1>
          <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
            Extra protection for your account. When on, you&apos;ll enter a 6-digit code from your
            authenticator app after your password.
          </p>
        </header>

        {!online || loadError === 'offline' ? (
          <div
            role="status"
            className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-warning-fg)]"
          >
            You&apos;re offline. Two-factor changes are unavailable until you reconnect.
          </div>
        ) : null}

        {loadError === 'forbidden' ? (
          <p className="text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
            This account cannot manage two-factor settings from this session.
          </p>
        ) : null}

        {loadError === 'network' ? (
          <div
            role="alert"
            className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]"
          >
            <p>Could not load your two-factor settings. Try again.</p>
            <Button type="button" className="mt-[var(--lc-space-sm)]" onClick={() => void loadStatus()}>
              Try again
            </Button>
          </div>
        ) : null}

        {loading ? (
          <TwoFactorStatusHero status="loading" />
        ) : null}

        {!loading && !loadError && status ? (
          <>
            <TwoFactorStatusHero
              status={enabled ? 'on' : 'off'}
              title={enabled ? 'On' : 'Off'}
              subtitle={enabled ? enrolledLabel : 'Not set up'}
            />

            {enabled && remaining <= 0 ? (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  You have no backup codes left. If you lose your authenticator, you won&apos;t be
                  able to sign in.{' '}
                  <Link to="/settings/2fa/backup-codes" className="underline underline-offset-4">
                    Regenerate now →
                  </Link>
                </p>
              </div>
            ) : null}

            {enabled ? (
              <section>
                <h2 className="mb-[var(--lc-space-sm)] font-[family-name:var(--lc-font-ui)] text-[length:var(--lc-type-heading-3)] text-[var(--lc-text-heading)]">
                  Your methods
                </h2>
                <div className="overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
                  <MethodRow
                    icon={<Smartphone className="h-5 w-5" />}
                    label="Authenticator app"
                    meta="Active"
                    action={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" aria-label="Manage authenticator app">
                            Manage
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => navigate('/settings/2fa/enroll?reset=1')}>
                            Reset authenticator
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void beginDisable()}>
                            Turn off
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                  <BackupCodesRow
                    remaining={remaining}
                    onManage={() => navigate('/settings/2fa/backup-codes')}
                  />
                </div>
              </section>
            ) : (
              <div className="space-y-[var(--lc-space-xs)] max-md:hidden">
                <Button
                  type="button"
                  size="lg"
                  disabled={!online}
                  onClick={() => navigate('/settings/2fa/enroll')}
                >
                  <Shield className="me-2 h-4 w-4" aria-hidden />
                  Enable two-factor authentication
                </Button>
                <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                  Takes about 2 minutes. You&apos;ll need an authenticator app like Google
                  Authenticator, 1Password, or Authy.
                </p>
              </div>
            )}

            <details className="group rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
              <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between text-[length:var(--lc-type-body)] text-[var(--lc-text-primary)]">
                How does two-factor authentication work?
                <ChevronDown
                  className="h-4 w-4 text-[var(--lc-text-muted)] transition-transform duration-[var(--lc-duration-base)] ease-[var(--lc-easing-out)] group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <ul className="mt-[var(--lc-space-sm)] list-disc space-y-1 ps-[var(--lc-space-lg)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
                <li>You&apos;ll scan a QR code into an authenticator app.</li>
                <li>Each time you sign in, you&apos;ll enter a 6-digit code the app generates.</li>
                <li>If you lose your device, you can sign in with a one-time backup code.</li>
              </ul>
            </details>

            {enabled ? (
              <div>
                <Separator className="mb-[var(--lc-space-lg)]" />
                <p
                  className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]"
                  style={{
                    font: 'var(--lc-type-overline)',
                    letterSpacing: 'var(--lc-tracking-overline)',
                  }}
                >
                  More options
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!online}
                  aria-label="Turn off two-factor authentication (reduces account security)"
                  onClick={() => void beginDisable()}
                >
                  Turn off two-factor authentication
                </Button>
                <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                  Reduces your account security. You&apos;ll be asked to confirm.
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        {loading ? <p className="sr-only">Loading your two-factor settings…</p> : null}
      </div>

      {!enabled && !loading && !loadError ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] pb-[max(var(--lc-space-sm),env(safe-area-inset-bottom))] md:hidden">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!online}
            onClick={() => navigate('/settings/2fa/enroll')}
          >
            <Shield className="me-2 h-4 w-4" aria-hidden />
            Enable two-factor authentication
          </Button>
        </div>
      ) : null}
    </MfaSettingsChrome>
      <SettingsDialogHost>
      <DisableTwoFactorModal
        open={disableOpen}
        onOpenChange={setDisableOpen}
        accountEmail={typeof agent?.email === 'string' ? agent.email : null}
        onDisabled={() => {
          addToast({
            variant: 'success',
            title: 'Two-factor authentication is off.',
            description: agent?.email
              ? `A confirmation email has been sent to ${agent.email}.`
              : 'A confirmation email has been sent.',
          })
          void loadStatus()
        }}
        onElevationExpired={() => {
          addToast({
            variant: 'warning',
            title: 'Your verification session expired. Please try again.',
          })
          void beginDisable()
        }}
      />
      </SettingsDialogHost>
    </>
  )
}
