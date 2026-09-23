import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MarketMultiSelect } from '@/components/auth/MarketMultiSelect'
import { countryLabel } from '@/lib/countries'
import { agentLicenceFor, marketplacesForMarkets } from '@/lib/marketRegistry'

type StoredCredentials = {
  fields?: Record<string, string>
}

/**
 * "Set your base market(s)" — onboarding action (AGT-ONB-005 step).
 * Captures the market(s) where the agent/agency is BASED / licensed as a broker,
 * plus that market's own broker-licence details. Being based in a market opens
 * its portals.
 *
 * Not here (they live at the listing/publish level): the per-listing role
 * (principal vs referral) and the per-property verification the property's
 * jurisdiction requires (e.g. Trakheesi) — that's driven by where the property
 * is, not where the agent is based.
 */
export function MarketsOnboardingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAgencyContext = searchParams.get('ctx') === 'agency'
  const { addToast } = useToast()
  const { agent, updateProfile } = useAuth()
  const { patch } = useOnboardingState()

  const seeded = (agent ?? {}) as Record<string, unknown>
  const seededCreds = (seeded.market_credentials as StoredCredentials | undefined) ?? {}

  const [markets, setMarkets] = useState<string[]>(
    Array.isArray(seeded.based_markets) ? (seeded.based_markets as string[]) : [],
  )
  const [fields, setFields] = useState<Record<string, string>>(seededCreds.fields ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const licenceFields = useMemo(() => agentLicenceFor(markets), [markets])
  const marketplaces = useMemo(() => marketplacesForMarkets(markets), [markets])

  const missingRequired = licenceFields.filter((c) => c.required && !fields[c.key]?.trim())
  const canSave = markets.length > 0 && missingRequired.length === 0 && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await updateProfile({
        based_markets: markets,
        market_credentials: { fields } satisfies StoredCredentials,
      })
      await patch({ checklist_delta: { markets_set: true } }).catch(() => undefined)
      if (isAgencyContext) {
        // Also complete the agency onboarding checklist's markets task.
        try {
          const agency = (await api.getMyAgency()) as { id?: string }
          if (agency?.id) {
            await api.patchAgencyOnboardingState(agency.id, {
              checklist_delta: { markets: true },
            })
          }
        } catch {
          /* non-fatal: agent markets still saved */
        }
      }
      addToast({ description: 'Markets saved.', duration: 4000 })
      navigate(isAgencyContext ? '/agency/onboarding' : '/dashboard')
    } catch {
      setError("We couldn't save your markets. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]">
      <div className="mx-auto flex max-w-2xl flex-col gap-[var(--lc-space-lg)] px-4 py-[var(--lc-space-xl)] sm:px-6">
        <header className="flex flex-col gap-2">
          <h1
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
          >
            The market(s) you&apos;re based in
          </h1>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
            Where you&apos;re licensed as a broker. We&apos;ll ask for that market&apos;s licence
            details and open its portals. You can still sell properties in other markets — the
            property&apos;s own verification is handled per listing.
          </p>
        </header>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="based-markets">Based market(s)</Label>
          <MarketMultiSelect
            id="based-markets"
            values={markets}
            onChange={setMarkets}
            disabled={saving}
            placeholder="Select the countries you're licensed in"
          />
          <p className="text-xs text-[var(--lc-text-muted)]">
            A Netherlands-based agent selling a Dubai unit picks Netherlands here — no UAE licence
            needed; the Dubai property&apos;s permit is captured when you list it.
          </p>
        </div>

        {/* Agent licence for the based markets */}
        {licenceFields.length > 0 ? (
          <div className="flex flex-col gap-[var(--lc-space-sm)]">
            <span className="text-sm font-medium text-[var(--lc-text-primary)]">
              Your licence in{' '}
              {licenceFields
                .flatMap((c) => c.markets)
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((c) => countryLabel(c))
                .join(', ')}
            </span>
            {licenceFields.map((c) => (
              <div key={c.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`cred-${c.key}`}>
                  {c.label}
                  {c.required ? <span className="ms-1 text-[var(--lc-status-unpublished-fg)]">*</span> : null}
                </Label>
                <Input
                  id={`cred-${c.key}`}
                  placeholder={c.placeholder}
                  value={fields[c.key] ?? ''}
                  disabled={saving}
                  aria-invalid={Boolean(c.required && !fields[c.key]?.trim())}
                  onChange={(e) => setFields((p) => ({ ...p, [c.key]: e.target.value }))}
                />
                {c.help ? <p className="text-xs text-[var(--lc-text-muted)]">{c.help}</p> : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Marketplace preview */}
        {markets.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
            <span className="text-sm font-medium text-[var(--lc-text-heading)]">
              Marketplaces these markets open
            </span>
            <ul className="flex flex-col gap-1.5">
              {marketplaces.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-[var(--lc-action-primary)]" aria-hidden />
                  <span className="text-[var(--lc-text-primary)]">{m.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-[var(--lc-status-unpublished-fg)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => navigate(isAgencyContext ? '/agency/onboarding' : '/dashboard')}
          >
            Skip for now
          </Button>
          <Button disabled={!canSave} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save markets'}
          </Button>
        </div>
        {markets.length > 0 && missingRequired.length > 0 ? (
          <p className="text-end text-xs text-[var(--lc-text-muted)]">
            Fill the required licence details to finish.
          </p>
        ) : null}
      </div>
    </div>
  )
}
