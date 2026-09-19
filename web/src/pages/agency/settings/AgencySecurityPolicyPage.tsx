import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2, ShieldCheck, X } from 'lucide-react'
import {
  api,
  type AgencyMfaConditionalRule,
  type AgencyMfaPolicy,
} from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * Agency-scoped admin surface for the enforced 2FA policy (issue 190).
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
  // H1 fields
  const [scopedRoles, setScopedRoles] = useState<string[]>([])
  const [bypassIds, setBypassIds] = useState<string[]>([])
  const [ruleUnusualIp, setRuleUnusualIp] = useState(false)
  const [ruleNewDevice, setRuleNewDevice] = useState(false)
  const [ruleGeoHop, setRuleGeoHop] = useState(false)
  const [enforceNextLogin, setEnforceNextLogin] = useState(false)
  const [bypassDraft, setBypassDraft] = useState('')

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
      setScopedRoles(loaded.scoped_roles ?? [])
      setBypassIds(loaded.bypass_user_ids ?? [])
      const rules = loaded.conditional_rules ?? []
      setRuleUnusualIp(rules.some((r) => r.kind === 'unusual_ip'))
      setRuleNewDevice(rules.some((r) => r.kind === 'new_device'))
      setRuleGeoHop(rules.some((r) => r.kind === 'impossible_geo_hop'))
      setEnforceNextLogin(loaded.enforce_on_next_login ?? false)
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
    const currentRules = new Set<string>()
    if (ruleUnusualIp) currentRules.add('unusual_ip')
    if (ruleNewDevice) currentRules.add('new_device')
    if (ruleGeoHop) currentRules.add('impossible_geo_hop')
    const savedRules = new Set<string>(policy.conditional_rules?.map((r) => r.kind) ?? [])
    const rulesDiffer =
      currentRules.size !== savedRules.size ||
      [...currentRules].some((r) => !savedRules.has(r))
    const scopeDiffers =
      scopedRoles.length !== policy.scoped_roles.length ||
      scopedRoles.some((r, i) => policy.scoped_roles[i] !== r)
    const bypassDiffers =
      bypassIds.length !== policy.bypass_user_ids.length ||
      bypassIds.some((u, i) => policy.bypass_user_ids[i] !== u)
    setDirty(
      required !== policy.required ||
        graceDays !== policy.grace_days ||
        enforceNextLogin !== policy.enforce_on_next_login ||
        rulesDiffer ||
        scopeDiffers ||
        bypassDiffers,
    )
  }, [
    required,
    graceDays,
    policy,
    scopedRoles,
    bypassIds,
    ruleUnusualIp,
    ruleNewDevice,
    ruleGeoHop,
    enforceNextLogin,
  ])

  async function save() {
    if (!agencyId || !dirty) return
    setSaving(true)
    try {
      const conditionalRules: AgencyMfaConditionalRule[] = []
      if (ruleUnusualIp) conditionalRules.push({ kind: 'unusual_ip' })
      if (ruleNewDevice) conditionalRules.push({ kind: 'new_device' })
      if (ruleGeoHop) conditionalRules.push({ kind: 'impossible_geo_hop' })
      const { policy: updated } = await api.updateAgencyMfaPolicy(agencyId, {
        required,
        grace_days: graceDays,
        scoped_roles: scopedRoles,
        bypass_user_ids: bypassIds,
        conditional_rules: conditionalRules,
        enforce_on_next_login: enforceNextLogin,
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

        {/* H1 — advanced controls */}
        <details className="mt-[var(--lc-space-md)] border-t border-[var(--lc-border)] pt-[var(--lc-space-md)]">
          <summary className="cursor-pointer text-[length:var(--lc-type-body)] text-[var(--lc-text-heading)]">
            Advanced (H1) — group scoping, bypass list, conditional rules
          </summary>
          <div className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-md)]">
            <div>
              <Label>Apply this policy only to (leave empty for all members):</Label>
              <div className="mt-[var(--lc-space-xs)] flex flex-wrap gap-[var(--lc-space-sm)]">
                {(['owner', 'admin', 'agent'] as const).map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-[var(--lc-space-xs)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-[var(--lc-space-sm)] py-[var(--lc-space-2xs)]"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--lc-action-primary)]"
                      checked={scopedRoles.includes(role)}
                      onChange={(e) => {
                        setScopedRoles((prev) =>
                          e.target.checked
                            ? [...prev, role].sort()
                            : prev.filter((r) => r !== role),
                        )
                      }}
                    />
                    <span className="capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="mfa-bypass">Bypass list (user IDs — service accounts, break-glass admin)</Label>
              <div className="mt-[var(--lc-space-xs)] flex flex-wrap gap-[var(--lc-space-xs)]">
                {bypassIds.map((uid) => (
                  <span
                    key={uid}
                    className="inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] px-2 py-0.5 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-caption)]"
                  >
                    {uid}
                    <button
                      type="button"
                      aria-label={`Remove ${uid}`}
                      className="text-[var(--lc-text-muted)] hover:text-[var(--lc-status-unpublished-fg)]"
                      onClick={() => setBypassIds((prev) => prev.filter((u) => u !== uid))}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-[var(--lc-space-xs)] flex gap-[var(--lc-space-sm)]">
                <Input
                  id="mfa-bypass"
                  value={bypassDraft}
                  onChange={(e) => setBypassDraft(e.target.value)}
                  placeholder="user-…"
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const v = bypassDraft.trim()
                    if (v && !bypassIds.includes(v)) setBypassIds([...bypassIds, v])
                    setBypassDraft('')
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <Label>Conditional rules — extra enforcement when a signal fires</Label>
              <div className="mt-[var(--lc-space-xs)] flex flex-col gap-[var(--lc-space-xs)]">
                <label className="flex items-center gap-[var(--lc-space-sm)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--lc-action-primary)]"
                    checked={ruleUnusualIp}
                    onChange={(e) => setRuleUnusualIp(e.target.checked)}
                  />
                  <span>Unusual IP — require enrollment when signing in from an IP the user has not signed in from before.</span>
                </label>
                <label className="flex items-center gap-[var(--lc-space-sm)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--lc-action-primary)]"
                    checked={ruleNewDevice}
                    onChange={(e) => setRuleNewDevice(e.target.checked)}
                  />
                  <span>New device — require enrollment when the browser fingerprint is unrecognised.</span>
                </label>
                <label className="flex items-center gap-[var(--lc-space-sm)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--lc-action-primary)]"
                    checked={ruleGeoHop}
                    onChange={(e) => setRuleGeoHop(e.target.checked)}
                  />
                  <span>Impossible geo hop — require enrollment when travel between consecutive sign-ins is faster than 500 km/h.</span>
                </label>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-[var(--lc-space-sm)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--lc-action-primary)]"
                  checked={enforceNextLogin}
                  onChange={(e) => setEnforceNextLogin(e.target.checked)}
                />
                <span className="font-medium">Enforce on next login (ignore grace period).</span>
              </label>
              <p className="ms-6 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                Non-enrolled members are blocked at their next sign-in regardless of grace_days. Use for hard cut-overs.
              </p>
            </div>
          </div>
        </details>

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

      {role === 'owner' ? (
        <section className="mt-[var(--lc-space-xl)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
          <h2 className="text-lg font-semibold text-[var(--lc-text-heading)]">Danger zone</h2>
          <p className="mt-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
            Permanently delete this agency after a 30-day cool-down. Members must be offboarded first.
          </p>
          <Button asChild variant="outline" className="mt-4 border-[var(--lc-status-danger-border)] text-[var(--lc-status-danger-fg)]">
            <Link to="/agency/settings/delete-agency">Delete agency</Link>
          </Button>
        </section>
      ) : null}
    </div>
  )
}
