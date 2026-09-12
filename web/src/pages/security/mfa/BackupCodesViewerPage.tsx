import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Copy, Download, KeySquare, Loader2, Printer } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BackupCodeGrid,
  EnrollmentStepper,
  useStepUp,
} from '@/components/mfa'
import { MfaSettingsChrome, SettingsDialogHost } from './MfaSettingsChrome'
import { useRouteLeaveGuard } from './useRouteLeaveGuard'
import type { TwoFactorStatus } from '@/types/twoFactor'
import type { BackupCodesLocationState } from './mfaShared'
import '../../../print.css'

export function BackupCodesViewerPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { agent } = useAuth()
  const { addToast } = useToast()
  const { requireStepUp } = useStepUp({ reason: 'Regenerate backup codes' })
  const firstView = searchParams.get('first-view') === '1'
  const state = (location.state ?? {}) as BackupCodesLocationState
  const [codes, setCodes] = useState<string[]>(state.backupCodes ?? [])
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [loading, setLoading] = useState(!firstView)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false)
  const [regenBusy, setRegenBusy] = useState(false)
  const accountEmail =
    state.accountEmail || (typeof agent?.email === 'string' ? agent.email : '')

  const modeA = firstView && codes.length > 0

  useEffect(() => {
    if (firstView && codes.length === 0) {
      navigate('/settings/2fa/backup-codes', { replace: true })
    }
  }, [firstView, codes.length, navigate])

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await api.twoFactorStatus())
    } catch {
      addToast({ variant: 'error', title: 'Could not load backup code status.' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (!modeA) void loadStatus()
  }, [modeA, loadStatus])

  const shouldGuard = Boolean(modeA && !saved)
  const leaveGuard = useRouteLeaveGuard(shouldGuard, () => setLeaveOpen(true))

  useEffect(() => {
    if (!shouldGuard) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [shouldGuard])

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      addToast({ variant: 'error', title: 'Could not copy. Try download instead.' })
    }
  }

  const downloadTxt = () => {
    const generated = new Date().toISOString()
    const body = [
      'WingCaster two-factor backup codes',
      `Generated: ${generated}`,
      `Account: ${accountEmail || 'unknown'}`,
      '',
      ...codes,
      '',
    ].join('\n')
    const blob = new Blob([body], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wingcaster-backup-codes-${generated.slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const beginRegenerate = async () => {
    try {
      await requireStepUp({ reason: 'Regenerate backup codes' })
      setRegenConfirmOpen(true)
    } catch {
      /* cancelled */
    }
  }

  const confirmRegenerate = async () => {
    setRegenBusy(true)
    try {
      const result = await api.regenerateBackupCodes()
      setCodes(result.backup_codes)
      setSaved(false)
      setRegenConfirmOpen(false)
      setSearchParams({ 'first-view': '1' })
    } catch {
      addToast({ variant: 'error', title: 'Could not regenerate. Try again.' })
    } finally {
      setRegenBusy(false)
    }
  }

  const remaining = status?.backup_codes_remaining ?? 0
  const warning = remaining > 0 && remaining <= 2
  const empty = remaining <= 0

  return (
    <>
    <MfaSettingsChrome>
      <div className="mx-auto max-w-[640px] space-y-[var(--lc-space-lg)] pb-[var(--lc-space-3xl)]">
        {modeA ? (
          <>
            <div data-print-hide>
              <EnrollmentStepper activeIndex={2} />
              <header className="mt-[var(--lc-space-lg)]">
                <h1
                  className="text-[var(--lc-text-heading)]"
                  style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
                >
                  Save your backup codes
                </h1>
                <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
                  These 10 codes let you sign in if you lose your authenticator. Each one works only
                  once. Save them somewhere safe now — you won&apos;t see them again.
                </p>
              </header>
              <div
                role="alert"
                className="mt-[var(--lc-space-md)] flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-warning-fg)]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>⚠ You&apos;ll only see these codes once. Save them before continuing.</p>
              </div>
            </div>

            <div data-backup-codes-print-meta className="hidden print:block">
              <p>WingCaster two-factor backup codes</p>
              <p>Generated: {new Date().toISOString()}</p>
              {accountEmail ? <p>Account: {accountEmail}</p> : null}
            </div>

            <BackupCodeGrid codes={codes} />

            <div data-print-hide className="flex flex-col gap-[var(--lc-space-sm)] sm:flex-row">
              <Button type="button" variant="outline" onClick={() => void copyAll()}>
                <Copy className="me-2 h-4 w-4" aria-hidden />
                {copied ? 'Copied ✓' : 'Copy all'}
              </Button>
              <Button type="button" variant="outline" onClick={downloadTxt}>
                <Download className="me-2 h-4 w-4" aria-hidden />
                Download .txt
              </Button>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer className="me-2 h-4 w-4" aria-hidden />
                Print
              </Button>
              <span className="sr-only" aria-live="polite">
                {copied ? 'Copied to clipboard' : ''}
              </span>
            </div>

            <div
              data-print-hide
              className="flex min-h-tap items-start gap-[var(--lc-space-sm)] text-[length:var(--lc-type-body)]"
            >
              <Checkbox
                id="backup-codes-saved"
                checked={saved}
                onCheckedChange={(value) => setSaved(value === true)}
              />
              <label htmlFor="backup-codes-saved" className="cursor-pointer leading-5">
                I&apos;ve saved my backup codes somewhere safe.
              </label>
            </div>

            <div data-print-hide className="flex flex-wrap gap-[var(--lc-space-sm)]">
              <Button
                type="button"
                size="lg"
                disabled={!saved}
                onClick={() => {
                  leaveGuard.allowNext()
                  navigate('/settings/2fa')
                }}
              >
                Done — back to two-factor settings
              </Button>
              <Button type="button" variant="ghost" onClick={() => {
                leaveGuard.reset()
                setLeaveOpen(true)
              }}>
                Leave
              </Button>
            </div>
          </>
        ) : (
          <div data-print-hide className="space-y-[var(--lc-space-lg)]">
            <nav className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              <Link to="/settings" className="hover:text-[var(--lc-text-brand)]">
                Settings
              </Link>
              <span aria-hidden> › </span>
              <Link to="/settings/2fa" className="hover:text-[var(--lc-text-brand)]">
                Two-factor authentication
              </Link>
              <span aria-hidden> › </span>
              <span>Backup codes</span>
            </nav>
            <header>
              <h1
                className="text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
              >
                Backup codes
              </h1>
              <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
                For security, WingCaster cannot show you the codes you already saved. To get a new
                set of 10, regenerate below — this replaces your old set.
              </p>
            </header>

            {loading ? (
              <div
                aria-busy="true"
                className="h-24 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
              />
            ) : (
              <div
                className={
                  empty
                    ? 'rounded-[var(--lc-radius-lg)] bg-[var(--lc-status-danger-bg)] p-[var(--lc-space-lg)] text-[var(--lc-status-danger-fg)] shadow-[var(--lc-elevation-sm)]'
                    : warning
                      ? 'rounded-[var(--lc-radius-lg)] bg-[var(--lc-status-warning-bg)] p-[var(--lc-space-lg)] text-[var(--lc-status-warning-fg)] shadow-[var(--lc-elevation-sm)]'
                      : 'rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]'
                }
              >
                <div className="flex items-center gap-[var(--lc-space-md)]">
                  <KeySquare className="h-6 w-5 shrink-0" aria-hidden />
                  <p>
                    {empty ? (
                      'You have no unused codes left. Regenerate now to restore access.'
                    ) : warning ? (
                      <>
                        Only <Numeric>{remaining}</Numeric> codes left. Consider regenerating soon.
                      </>
                    ) : (
                      <>
                        You have <Numeric>{remaining}</Numeric> unused codes.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            <section>
              <h2 className="text-[length:var(--lc-type-heading-3)] text-[var(--lc-text-heading)]">
                Get a new set of codes
              </h2>
              <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
                Regenerating creates 10 fresh codes and invalidates all your current codes. Use this
                if you&apos;ve lost your saved codes, or if you&apos;ve used most of them.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="mt-[var(--lc-space-md)]"
                disabled={regenBusy}
                onClick={() => {
                  void beginRegenerate()
                }}
              >
                {regenBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Regenerate backup codes
              </Button>
            </section>

            <Link to="/settings/2fa" className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              ← Back to two-factor settings
            </Link>
          </div>
        )}
      </div>
    </MfaSettingsChrome>

      <SettingsDialogHost>
      <Dialog
        open={leaveOpen}
        onOpenChange={(open) => {
          setLeaveOpen(open)
          if (!open) leaveGuard.reset()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              You won&apos;t be able to see these codes again. WingCaster cannot show them a second
              time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setLeaveOpen(false)}>
              Stay and save
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                leaveGuard.proceed('/settings/2fa')
              }}
            >
              Leave anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate backup codes?</DialogTitle>
            <DialogDescription>
              This invalidates all your current backup codes. You&apos;ll get 10 fresh codes to
              save. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setRegenConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={regenBusy}
              onClick={() => {
                void confirmRegenerate()
              }}
            >
              Yes, regenerate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </SettingsDialogHost>
    </>
  )
}
