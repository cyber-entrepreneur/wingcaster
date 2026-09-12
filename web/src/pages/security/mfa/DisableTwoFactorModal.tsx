import { useEffect, useId, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { api, setAuthToken } from '@/api/client'
import { mutateSettingsIndex } from '@/hooks/useSettingsIndex'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiErrorCode, apiStatus } from './mfaShared'

const DISABLE_CONFIRM = 'DISABLE'

const REASONS = [
  'Lost my authenticator',
  'Getting a new device',
  "It's too much friction",
  "I don't need this level of security",
  'Other',
  'Prefer not to say',
] as const

export interface DisableTwoFactorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful disable. Parent refreshes status. */
  onDisabled: () => void
  /** Elevation expired — parent re-runs step-up then reopens. */
  onElevationExpired: () => void
  accountEmail?: string | null
}

export function DisableTwoFactorModal({
  open,
  onOpenChange,
  onDisabled,
  onElevationExpired,
  accountEmail,
}: DisableTwoFactorModalProps) {
  const id = useId()
  const codeId = `${id}-code`
  const typedId = `${id}-typed`
  const reasonId = `${id}-reason`
  const [code, setCode] = useState('')
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setCode('')
      setTyped('')
      setReason('')
      setBusy(false)
      setError('')
    }
  }, [open])

  const typedOk = typed.trim() === DISABLE_CONFIRM
  const codeOk = code.trim().length >= 6
  const canSubmit = codeOk && typedOk && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError('')
    try {
      const result = await api.totpDisable(code.trim())
      if (result.token) setAuthToken(result.token)
      void mutateSettingsIndex()
      onOpenChange(false)
      onDisabled()
    } catch (err: unknown) {
      const status = apiStatus(err)
      const codeName = apiErrorCode(err)
      if (status === 403) {
        onOpenChange(false)
        onElevationExpired()
        return
      }
      if (status === 409 || codeName === 'totp_not_enabled') {
        onOpenChange(false)
        onDisabled()
        return
      }
      setError('That code did not match. Try another.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-[var(--lc-radius-lg)] border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-lg)]">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--lc-font-ui)] text-[length:var(--lc-type-heading-2)]">
            Turn off two-factor authentication?
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirm with a live authenticator or backup code and type DISABLE.
          </DialogDescription>
        </DialogHeader>

        <div
          role="alert"
          className="flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="text-[length:var(--lc-type-body-sm)]">
            <span aria-hidden>⚠ </span>
            This reduces your account security. Your account will be signed out on every other
            device.
          </p>
        </div>

        <p className="text-[length:var(--lc-type-body)] text-[var(--lc-text-muted)]">
          You&apos;ll also lose your backup codes. If you turn two-factor back on later, you&apos;ll
          need to enroll a new authenticator and save a new set of codes.
        </p>

        <div className="space-y-[var(--lc-space-xs)]">
          <Label htmlFor={reasonId}>Why are you turning this off? (Optional)</Label>
          <select
            id={reasonId}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-[var(--lc-space-sm)] text-[var(--lc-text-primary)]"
          >
            <option value="">Prefer not to say</option>
            {REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-[var(--lc-space-xs)]">
          <Label htmlFor={codeId}>
            Enter a current 6-digit code from your authenticator, or a backup code
          </Label>
          <Input
            id={codeId}
            autoFocus
            autoComplete="one-time-code"
            value={code}
            disabled={busy}
            placeholder="123456 or XXXX-XXXX-XXXX"
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
          />
          {error ? (
            <p role="alert" className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-danger-fg)]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="space-y-[var(--lc-space-xs)]">
          <Label htmlFor={typedId}>Type DISABLE to confirm</Label>
          <Input
            id={typedId}
            value={typed}
            disabled={busy}
            placeholder="DISABLE"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
          <p
            className={
              typed.length > 0 && !typedOk
                ? 'text-[length:var(--lc-type-caption)] text-[var(--lc-text-primary)]'
                : 'text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]'
            }
          >
            This helps prevent accidental clicks.
          </p>
        </div>

        <div className="flex flex-col items-end gap-[var(--lc-space-sm)]">
          <div className="flex gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canSubmit}
              aria-label="Turn off two-factor authentication (reduces account security)"
              onClick={() => {
                void submit()
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  Turning off…
                </>
              ) : (
                'Turn off two-factor'
              )}
            </Button>
          </div>
          <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            You&apos;ll be signed out of every other device. This device stays signed in.
            {accountEmail ? ` A confirmation email will be sent to ${accountEmail}.` : ''}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
