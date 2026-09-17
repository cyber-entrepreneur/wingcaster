import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { api, type AgencyMfaPolicy } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * Agency-scoped admin surface for the enforced 2FA policy (issue #190).
 *
 * Owner / admin members see a toggle to require 2FA for every member of
 * this agency, plus a grace-days control (0–90) and read-only fields
 * showing who last changed the policy and when. The policy row is a
 * SOC 2 CC6.1 / ISO 27001 A.9.4.2 control — the whole point is that a
 * single admin toggle raises the account's security floor for every
 * member.
 *
 * Enforcement happens on the backend: (1) sign-in returns
 * `mfa_enrollment_required` when a member is past grace; (2) the
 * `mfaEnforcementGate` middleware blocks every non-safe write with
 * `403 MFA_ENROLLMENT_REQUIRED` until the member enrolls.
 */
export function AgencySecurityPolicyPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Security policy')

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const agencyId = affiliation?.agency_id || null
  const role = affiliation?.role || null
  const isAdmin = role === 'owner' || role === 'admin'

  const [policy, setPolicy] = useState<AgencyMfaPolicy | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'forbidden'>(
    isAdmin ? 'loading' : 'forbidden',
  )
  const [required, setRequired] = useState(false)
  const [graceDays, setGraceDays] = useState(14)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    if (!agencyId) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const { policy: loaded } = await api.getAgencyMfaPolicy(agencyId)
      setPolicy(loaded)
      setRequired(loaded.required)
      setGraceDays(loaded.grace_days)
      setDirty(false)
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) setLoadState('forbidden')
      else setLoadState('error')
    }
  }, [agencyId])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  useEffect(() => {
    if (!policy) return
    setDirty(required !== policy.required || graceDays !== policy.grace_days)
  }, [required, graceDays, policy])

  async function save() {
    if (!agencyId || !dirty) return
    setSaving(true)
    try {
      const { policy: updated } = await api.updateAgencyMfaPolicy(agencyId, {
        required,
        grace_days: graceDays,
      })
      setPolicy(updated)
      setDirty(false)
      addToast({
        variant: 'success',
        title: required
          ? 'Two-factor authentication is now required for this agency.'
          : 'Two-factor authentication is no longer required for this agency.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the policy. Try again.'
      addToast({ variant: 'error', title: 'Could not update security policy', description: message })
    } finally {
      setSaving(false)
    }
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-[640px] p-[var(--lc-space-lg)]">
        <h1
          className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-2)' }}
        >
          Security policy
        </h1>
        <p className="text-[var(--lc-text-secondary)]">
          Only agency owners and admins can view or change the security policy for this agency.
        </p>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div className="mx-auto max-w-[640px] p-[var(--lc-space-lg)]">
        <div
          aria-busy="true"
          className="h-32 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
        />
        <p className="sr-only">Loading security policy…</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-[640px] p-[var(--lc-space-lg)]">
        <div
          role="alert"
          className="mb-[var(--lc-space-md)] flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Could not load the security policy. Try again.</p>
        </div>
        <Button type="button" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  const graceLabel =
    graceDays === 0
      ? 'Members must enroll before their next sign-in (no grace period).'
      : `Members have ${graceDays} day${graceDays === 1 ? '' : 's'} to enroll after this policy is set.`

  return (
    <div className="mx-auto max-w-[640px] space-y-[var(--lc-space-lg)] p-[var(--lc-space-lg)] pb-[var(--lc-space-3xl)]">
      <header>
        <h1
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
        >
          Security policy
        </h1>
        <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
          Enterprise controls for every member of this agency. Changes here are audited.
        </p>
      </header>

      <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
        <div className="mb-[var(--lc-space-md)] flex items-start gap-[var(--lc-space-md)]">
          <ShieldCheck
            className={required ? 'h-6 w-6 text-[var(--lc-status-published-fg)]' : 'h-6 w-6 text-[var(--lc-text-muted)]'}
            aria-hidden
          />
          <div className="flex-1">
            <h2
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-3)' }}
            >
              Require two-factor authentication
            </h2>
            <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
              When on, every member of this agency must enroll in 2FA within the grace period. After
              the grace period expires, sign-in is blocked for any member who has not enrolled.
            </p>
          </div>
          <label
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] transition-colors data-[on=true]:bg-[var(--lc-status-published-fg)]"
            data-on={required}
          >
            <input
              type="checkbox"
              className="sr-only"
              aria-label="Require two-factor authentication for all members"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            <span
              className="absolute h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: required ? 'translateX(1.25rem)' : 'translateX(0.125rem)' }}
              aria-hidden
            />
          </label>
        </div>

        <div className="mb-[var(--lc-space-md)] border-t border-[var(--lc-border)] pt-[var(--lc-space-md)]">
          <Label htmlFor="mfa-grace-days">Grace period (days)</Label>
          <div className="mt-[var(--lc-space-xs)] flex items-center gap-[var(--lc-space-sm)]">
            <Input
              id="mfa-grace-days"
              type="number"
              min={0}
              max={90}
              value={graceDays}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10)
                if (Number.isFinite(v)) setGraceDays(Math.min(90, Math.max(0, v)))
              }}
              className="w-24"
              disabled={!required}
              aria-describedby="mfa-grace-days-help"
            />
            <span
              id="mfa-grace-days-help"
              className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]"
            >
              {graceLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-[var(--lc-space-sm)] border-t border-[var(--lc-border)] pt-[var(--lc-space-md)]">
          <div className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            {policy?.is_default
              ? 'Default policy — not yet customised for this agency.'
              : policy?.updated_by
                ? `Last changed by ${policy.updated_by} on ${policy?.updated_at ? new Date(policy.updated_at).toLocaleString() : ''}.`
                : null}
          </div>
          <Button
            type="button"
            size="lg"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save policy'
            )}
          </Button>
        </div>
      </section>

      <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
        Members who do not enroll after the grace period will see a{' '}
        <code>MFA_ENROLLMENT_REQUIRED</code> block on any write action until they turn 2FA on. This
        matches the SOC 2 CC6.1 and ISO 27001 A.9.4.2 requirements for organisation-mandated
        strong-auth.
      </p>
    </div>
  )
}
