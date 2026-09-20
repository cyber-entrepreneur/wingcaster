/**
 * Wave 2A — Paid campaign builder: objective → budget → audience → creative → review.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Megaphone,
} from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { lcStatusClasses } from '@/theme/status'
import type { Audience } from '@/types/audience'

const STEPS = ['Objective', 'Budget', 'Audience', 'Creative', 'Review'] as const

const OBJECTIVES = [
  { id: 'awareness', label: 'Awareness', hint: 'Reach people likely to notice your listing' },
  { id: 'traffic', label: 'Traffic', hint: 'Send people to a landing page or listing URL' },
  { id: 'engagement', label: 'Engagement', hint: 'Drive post interactions and saves' },
  { id: 'leads', label: 'Leads', hint: 'Collect inquiries and form fills' },
  { id: 'conversions', label: 'Conversions', hint: 'Optimize for viewings and deals' },
] as const

type Objective = (typeof OBJECTIVES)[number]['id']

type PaidChannelRow = {
  platform: string
  honest_state: string
  approval: { approved: boolean; state: string; message: string }
  connection: { id: string } | null
  message: string
}

function WizardProgress({ current }: { current: number }) {
  return (
    <div className="flex shrink-0 items-center gap-0 border-b border-[var(--lc-border)] bg-[var(--lc-surface)] px-6 py-3">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
                i < current && lcStatusClasses('published'),
                i === current && 'bg-[var(--lc-accent)] text-[var(--lc-text-inverse)]',
                i > current && 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]',
              )}
              aria-current={i === current ? 'step' : undefined}
            >
              {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className="hidden text-[10px] text-[var(--lc-text-muted)] sm:block">{label}</span>
          </div>
          {i < STEPS.length - 1 ? (
            <div className="mx-2 h-px w-6 bg-[var(--lc-border)] sm:w-10" aria-hidden />
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function PaidCampaignBuilderPage() {
  usePageTitle('Paid campaign')
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [step, setStep] = useState(0)
  const [channels, setChannels] = useState<PaidChannelRow[]>([])
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [platform, setPlatform] = useState<'meta_ads' | 'google_ads'>('meta_ads')
  const [objective, setObjective] = useState<Objective>('traffic')
  const [budgetMajor, setBudgetMajor] = useState('50')
  const [currency, setCurrency] = useState('USD')
  const [audienceId, setAudienceId] = useState('')
  const [creativeId, setCreativeId] = useState('')
  const [name, setName] = useState('')
  const [format, setFormat] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ch, aud] = await Promise.all([
        api.getPaidAdsChannels(),
        api.getAudiences(),
      ])
      setChannels(ch.channels || [])
      setAudiences((aud as Audience[]) || [])
    } catch (err: any) {
      addToast({ title: 'Failed to load paid builder', description: err?.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    load()
  }, [load])

  const selectedChannel = useMemo(
    () => channels.find((c) => c.platform === platform) || null,
    [channels, platform],
  )

  const budgetMicros = Math.round(Number(budgetMajor || 0) * 1_000_000)

  async function submit() {
    if (!selectedChannel?.connection?.id) {
      addToast({
        title: 'Connect an ad account first',
        description: 'Settings → Channels → Paid ad accounts',
        variant: 'error',
      })
      return
    }
    if (!Number.isFinite(budgetMicros) || budgetMicros <= 0) {
      addToast({ title: 'Enter a positive budget', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      const targeting: Record<string, unknown> = {}
      if (audienceId) targeting.audience_ref = audienceId
      if (format) targeting.format = format
      const execution = await api.createPaidAdExecution({
        channel_connection_id: selectedChannel.connection.id,
        objective,
        budget_micros: budgetMicros,
        currency,
        audience_id: audienceId || null,
        creative_id: creativeId || null,
        targeting,
        format: format || null,
        name: name || `Paid ${objective}`,
      })
      setCreatedId((execution as { id: string }).id)
      addToast({
        title: 'Paid execution saved as draft',
        description: selectedChannel.approval.approved
          ? 'You can launch when ready.'
          : 'Launch stays blocked until Meta/Google approval — no fake publish.',
        variant: 'success',
      })
      setStep(4)
    } catch (err: any) {
      addToast({ title: 'Could not create paid execution', description: err?.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <CrmShell>
        <div className="flex min-h-[40vh] items-center justify-center text-[var(--lc-text-muted)]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </CrmShell>
    )
  }

  return (
    <CrmShell>
      <CmdPageHeader
        title="Paid campaign"
        subtitle="Objective → budget → audience → creative → review. Distinct from nurture journeys."
        actions={
          <Button asChild variant="ghost">
            <Link to="/journeys">
              <ArrowLeft className="mr-2 h-4 w-4" /> Campaigns
            </Link>
          </Button>
        }
      />
      <WizardProgress current={step} />

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {selectedChannel && !selectedChannel.approval.approved ? (
          <div
            role="status"
            className={cn(
              'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-3 text-sm',
              lcStatusClasses('underOffer'),
            )}
          >
            <strong className="font-medium">Connect + pending approval.</strong>{' '}
            {selectedChannel.message} Launch returns <code className="text-xs">PROVIDER_NOT_APPROVED</code> —
            nothing is faked.
          </div>
        ) : null}

        {step === 0 ? (
          <section className="space-y-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <div className="flex flex-wrap gap-2">
                {(['meta_ads', 'google_ads'] as const).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={platform === p ? 'default' : 'outline'}
                    onClick={() => setPlatform(p)}
                  >
                    {p === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Objective</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {OBJECTIVES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setObjective(o.id)}
                    className={cn(
                      'rounded-[var(--lc-radius-md)] border p-3 text-left transition',
                      objective === o.id
                        ? 'border-[var(--lc-accent)] bg-[var(--lc-surface-sunken)]'
                        : 'border-[var(--lc-border)] bg-[var(--lc-surface)]',
                    )}
                  >
                    <div className="font-medium text-[var(--lc-text-primary)]">{o.label}</div>
                    <div className="mt-0.5 text-xs text-[var(--lc-text-muted)]">{o.hint}</div>
                  </button>
                ))}
              </div>
            </div>
            {platform === 'google_ads' ? (
              <div className="space-y-1.5">
                <Label htmlFor="paid-format">Google format (optional)</Label>
                <select
                  id="paid-format"
                  className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="">Default (Search)</option>
                  <option value="demand_gen">Demand Gen</option>
                  <option value="demand_gen_gmail">Demand Gen — Gmail</option>
                  <option value="demand_gen_youtube">Demand Gen — YouTube</option>
                  <option value="display">Display</option>
                </select>
                <p className="text-xs text-[var(--lc-text-muted)]">
                  Gmail reach is a Demand Gen placement, not an owned-email send.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 1 ? (
          <section className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="paid-name">Campaign name</Label>
              <Input
                id="paid-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Spring Dubai launch"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="paid-budget">Daily budget</Label>
                <Input
                  id="paid-budget"
                  inputMode="decimal"
                  value={budgetMajor}
                  onChange={(e) => setBudgetMajor(e.target.value)}
                />
                <p className="text-xs text-[var(--lc-text-muted)]">
                  Stored as {Number.isFinite(budgetMicros) ? budgetMicros.toLocaleString() : '—'} micros
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paid-currency">Currency</Label>
                <Input
                  id="paid-currency"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-3">
            <Label htmlFor="paid-audience">Audience (Wave 1D)</Label>
            <select
              id="paid-audience"
              className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
            >
              <option value="">Select audience…</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <Button asChild variant="outline" size="sm">
              <Link to="/audiences/new?embedded=1" target="_blank">Create audience</Link>
            </Button>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-3">
            <Label htmlFor="paid-creative">Creative id (Wave 1C)</Label>
            <Input
              id="paid-creative"
              value={creativeId}
              onChange={(e) => setCreativeId(e.target.value)}
              placeholder="cre_…"
            />
            <p className="text-sm text-[var(--lc-text-muted)]">
              Paste a creative id from the listing AI Adaptive Composer. Renditions stay on the Creative Asset Service.
            </p>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              <h2 className="font-medium">Review</h2>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-[var(--lc-text-muted)]">Platform</dt><dd>{platform}</dd></div>
              <div><dt className="text-[var(--lc-text-muted)]">Objective</dt><dd>{objective}</dd></div>
              <div><dt className="text-[var(--lc-text-muted)]">Budget</dt><dd>{budgetMajor} {currency}</dd></div>
              <div><dt className="text-[var(--lc-text-muted)]">Audience</dt><dd>{audienceId || '—'}</dd></div>
              <div><dt className="text-[var(--lc-text-muted)]">Creative</dt><dd>{creativeId || '—'}</dd></div>
              <div>
                <dt className="text-[var(--lc-text-muted)]">Approval</dt>
                <dd>
                  <Badge className={lcStatusClasses('underOffer')}>
                    {selectedChannel?.honest_state || 'connect_pending_approval'}
                  </Badge>
                </dd>
              </div>
            </dl>
            {createdId ? (
              <p className="text-sm text-[var(--lc-text-primary)]">
                Draft execution <code className="text-xs">{createdId}</code> created.
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-[var(--lc-border)] pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || saving}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {step < 4 ? (
            <Button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" disabled={saving || Boolean(createdId)} onClick={submit}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {createdId ? 'Saved' : 'Create paid execution'}
            </Button>
          )}
        </div>

        {createdId ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/journeys')}>
              Back to campaigns
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings/channels?tab=paid">Manage paid channels</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </CrmShell>
  )
}
