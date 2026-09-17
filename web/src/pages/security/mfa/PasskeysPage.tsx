import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, KeyRound, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { api, type PasskeyCredential } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { formatRelativeTime, formatShortDate } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'
import { MfaSettingsChrome } from './MfaSettingsChrome'

/**
 * Passkey management surface (issue 189).
 *
 * Sits alongside TotpEnrollPage / BackupCodesViewerPage under `/settings/2fa`.
 * Enrollment uses @simplewebauthn/browser to call the platform's authenticator
 * (Touch ID, Face ID, Windows Hello, hardware key). The server never sees
 * the private key; only the public key + credential id + signature counter
 * are stored.
 */

// Types are declared here to avoid a hard dep on @simplewebauthn/browser in
// the file (browser dep listed in package.json — imported lazily below).
type StartRegistration = (opts: unknown) => Promise<unknown>

async function loadStartRegistration(): Promise<StartRegistration> {
  const mod = (await import('@simplewebauthn/browser')) as { startRegistration: StartRegistration }
  return mod.startRegistration
}

export function PasskeysPage() {
  const { addToast } = useToast()
  usePageTitle('Passkeys')

  const [credentials, setCredentials] = useState<PasskeyCredential[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'unsupported'>(
    'loading',
  )
  const [enrolling, setEnrolling] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [name, setName] = useState('')
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Feature-detect the WebAuthn API. If missing (older browsers, some
    // corporate desktops), fall through to an unsupported state.
    if (typeof window !== 'undefined' && !window.PublicKeyCredential) {
      setLoadState('unsupported')
      return
    }
    try {
      const { credentials: rows } = await api.listPasskeys()
      setCredentials(rows)
      setLoadState('ready')
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not load passkeys',
        description: err instanceof Error ? err.message : undefined,
      })
      setLoadState('error')
    }
  }, [addToast])

  useEffect(() => {
    void load()
  }, [load])

  async function enroll() {
    if (!name.trim()) return
    setEnrolling(true)
    try {
      const start = await loadStartRegistration()
      const { options } = await api.webauthnRegisterBegin()
      const attestation = await start(options)
      const { credential } = await api.webauthnRegisterComplete({
        name: name.trim(),
        response: attestation,
      })
      setCredentials((prev) => [credential, ...prev])
      addToast({
        variant: 'success',
        title: 'Passkey added',
        description: `${credential.name} is ready to use for sign-in.`,
      })
      setEnrollOpen(false)
      setName('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add passkey.'
      addToast({ variant: 'error', title: 'Passkey setup failed', description: message })
    } finally {
      setEnrolling(false)
    }
  }

  async function confirmRevoke(id: string) {
    setBusyId(id)
    try {
      await api.revokePasskey(id)
      setCredentials((prev) =>
        prev.map((c) => (c.id === id ? { ...c, revoked_at: new Date().toISOString() } : c)),
      )
      addToast({ variant: 'success', title: 'Passkey removed.' })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not remove passkey',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
      setRevokeId(null)
    }
  }

  const activeCredentials = credentials.filter((c) => !c.revoked_at)

  return (
    <MfaSettingsChrome>
      <div className="mx-auto max-w-[640px] space-y-[var(--lc-space-lg)] pb-[var(--lc-space-3xl)]">
        <nav className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
          <Link to="/settings" className="hover:text-[var(--lc-text-brand)]">
            Settings
          </Link>
          <span aria-hidden> › </span>
          <Link to="/settings/2fa" className="hover:text-[var(--lc-text-brand)]">
            Two-factor authentication
          </Link>
          <span aria-hidden> › </span>
          <span>Passkeys</span>
        </nav>

        <header>
          <h1
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
          >
            Passkeys
          </h1>
          <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
            Sign in without a password using Face ID, Touch ID, Windows Hello, or a hardware
            security key. Passkeys cannot be phished — your browser refuses to hand them to a
            different site.
          </p>
        </header>

        {loadState === 'unsupported' ? (
          <div
            role="status"
            className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-warning-fg)]"
          >
            Your browser does not support passkeys. Try the latest Safari, Chrome, Edge, or
            Firefox.
          </div>
        ) : null}

        {loadState === 'ready' ? (
          <>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setEnrollOpen(true)}>
                <KeyRound className="me-2 h-4 w-4" aria-hidden />
                Add a passkey
              </Button>
            </div>

            {activeCredentials.length === 0 ? (
              <div className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)] text-center">
                <ShieldCheck className="mx-auto h-6 w-6 text-[var(--lc-text-muted)]" aria-hidden />
                <p className="mt-[var(--lc-space-sm)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                  No passkeys yet.
                </p>
                <p className="mt-[var(--lc-space-xs)] text-[var(--lc-text-muted)]">
                  Add one now so you can sign in without typing your password.
                </p>
              </div>
            ) : (
              <ul aria-label="Passkeys" className="divide-y divide-[var(--lc-border)]">
                {activeCredentials.map((cred) => (
                  <li
                    key={cred.id}
                    className="flex flex-col gap-[var(--lc-space-sm)] py-[var(--lc-space-md)] sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p style={{ font: 'var(--lc-type-body)' }}>{cred.name}</p>
                      <p
                        className="text-[var(--lc-text-muted)]"
                        style={{ font: 'var(--lc-type-body-sm)' }}
                      >
                        {cred.backup_eligible ? 'Syncs across your devices' : 'This device only'}
                        {cred.transports.length > 0 ? ` · ${cred.transports.join(', ')}` : ''}
                      </p>
                      <p
                        className="text-[var(--lc-text-muted)]"
                        style={{ font: 'var(--lc-type-caption)' }}
                      >
                        Added {formatShortDate(cred.created_at)} ·{' '}
                        {cred.last_used_at
                          ? `last used ${formatRelativeTime(cred.last_used_at)}`
                          : 'never used'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      type="button"
                      className="text-[var(--lc-status-unpublished-fg)]"
                      aria-label={`Remove passkey ${cred.name}`}
                      onClick={() => setRevokeId(cred.id)}
                      disabled={busyId === cred.id}
                    >
                      <Trash2 className="me-2 h-4 w-4" aria-hidden />
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        <Link
          to="/settings/2fa"
          className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]"
        >
          ← Back to two-factor settings
        </Link>
      </div>

      {/* Enroll dialog */}
      <Dialog
        open={enrollOpen}
        onOpenChange={(open) => {
          setEnrollOpen(open)
          if (!open) setName('')
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a passkey</DialogTitle>
            <DialogDescription>
              Name this passkey so you can identify it later (e.g. "MacBook Touch ID" or "Work
              YubiKey"). Your device will prompt you next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-[var(--lc-space-md)]">
            <div>
              <Label htmlFor="passkey-name">Name</Label>
              <Input
                id="passkey-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="MacBook Touch ID"
                maxLength={60}
              />
            </div>
            <div
              role="note"
              className="flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[length:var(--lc-type-body-sm)]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" aria-hidden />
              <p>Your browser will show a native prompt. Approve it to finish adding the passkey.</p>
            </div>
          </div>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setEnrollOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!name.trim() || enrolling} onClick={() => void enroll()}>
              {enrolling ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  Waiting for device…
                </>
              ) : (
                'Add passkey'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <Dialog open={Boolean(revokeId)} onOpenChange={(open) => !open && setRevokeId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this passkey?</DialogTitle>
            <DialogDescription>
              You will no longer be able to sign in with it. This does not delete the passkey from
              your device — remove it there separately if you want to.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setRevokeId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => revokeId && void confirmRevoke(revokeId)}
            >
              Remove passkey
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MfaSettingsChrome>
  )
}
