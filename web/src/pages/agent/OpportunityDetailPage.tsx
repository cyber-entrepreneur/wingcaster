import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Loader2, User } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * AGT-OPP-002 — Opportunity detail.
 *
 * Routed detail for a single pipeline opportunity (`/opportunities/:id`).
 * Backend GET/PATCH already exist; this is the missing UI. Shows the deal,
 * its linked contact + property, an editable field set (stage, value,
 * probability, expected close, notes), and the stage-change history.
 */

const STAGES = ['new', 'qualification', 'viewing', 'offer', 'negotiation', 'closed_won', 'closed_lost']

const STAGE_PILL: Record<string, string> = {
  new: 'border-slate-200 bg-slate-50 text-slate-600',
  qualification: 'border-blue-200 bg-blue-50 text-blue-700',
  viewing: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  offer: 'border-amber-200 bg-amber-50 text-amber-700',
  negotiation: 'border-orange-200 bg-orange-50 text-orange-700',
  closed_won: 'border-green-200 bg-green-50 text-green-700',
  closed_lost: 'border-red-200 bg-red-50 text-red-700',
}

function stageLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

interface Opportunity {
  id: string
  contact_id: string
  property_id: string | null
  stage: string
  deal_value: number | null
  currency: string
  probability: number
  expected_close_date: string | null
  lost_reason: string
  closed_at: string | null
  notes: string
  created_at: string
  updated_at: string
  stage_history?: Array<{ stage: string; changed_at: string; changed_by?: string }>
}

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  usePageTitle('Opportunity')

  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [contactName, setContactName] = useState<string>('')
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'notfound'>('loading')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    stage: 'new',
    deal_value: '',
    currency: 'USD',
    probability: '',
    expected_close_date: '',
    lost_reason: '',
    notes: '',
  })

  const load = useCallback(async () => {
    if (!id) return
    setLoadState('loading')
    try {
      const data = (await api.getOpportunity(id)) as Opportunity
      setOpp(data)
      setForm({
        stage: data.stage,
        deal_value: data.deal_value != null ? String(data.deal_value) : '',
        currency: data.currency || 'USD',
        probability: data.probability != null ? String(data.probability) : '',
        expected_close_date: data.expected_close_date ?? '',
        lost_reason: data.lost_reason ?? '',
        notes: data.notes ?? '',
      })
      setLoadState('ready')
      if (data.contact_id) {
        try {
          const c = (await api.getContact(data.contact_id)) as { name?: string }
          setContactName(c?.name || '')
        } catch {
          /* name is a nicety; ignore */
        }
      }
    } catch (err) {
      const status = (err as { status?: number }).status
      setLoadState(status === 404 ? 'notfound' : 'error')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const dirty = useMemo(() => {
    if (!opp) return false
    return (
      form.stage !== opp.stage ||
      form.deal_value !== (opp.deal_value != null ? String(opp.deal_value) : '') ||
      form.currency !== (opp.currency || 'USD') ||
      form.probability !== (opp.probability != null ? String(opp.probability) : '') ||
      form.expected_close_date !== (opp.expected_close_date ?? '') ||
      form.lost_reason !== (opp.lost_reason ?? '') ||
      form.notes !== (opp.notes ?? '')
    )
  }, [form, opp])

  const save = async () => {
    if (!id || !dirty || saving) return
    setSaving(true)
    try {
      const patch: Record<string, unknown> = {
        stage: form.stage,
        deal_value: form.deal_value === '' ? null : Number(form.deal_value),
        currency: form.currency.trim() || 'USD',
        probability: form.probability === '' ? 0 : Number(form.probability),
        expected_close_date: form.expected_close_date || null,
        lost_reason: form.lost_reason,
        notes: form.notes,
      }
      const updated = (await api.updateOpportunity(id, patch)) as Opportunity
      setOpp((prev) => ({ ...(prev as Opportunity), ...updated }))
      addToast({ title: 'Opportunity updated', variant: 'success' })
      void load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save'
      addToast({ title: 'Could not save', description: msg, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center py-16" data-testid="opp-detail-loading">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" />
      </div>
    )
  }
  if (loadState === 'notfound') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-[var(--lc-text-secondary)]">This opportunity doesn’t exist or you don’t have access to it.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/opportunities')}>
          Back to pipeline
        </Button>
      </div>
    )
  }
  if (loadState === 'error' || !opp) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-[var(--lc-status-danger-fg)]">Couldn’t load this opportunity.</p>
        <Button className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6" data-testid="opportunity-detail-page">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/opportunities">
            <ArrowLeft className="me-1 h-4 w-4" /> Pipeline
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-[var(--lc-text-primary)]">
              {contactName || 'Opportunity'}
            </h1>
            <Badge variant="outline" className={STAGE_PILL[opp.stage] || STAGE_PILL.new}>
              {stageLabel(opp.stage)}
            </Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-[var(--lc-text-muted)]">
            <Link to={`/contacts/${opp.contact_id}`} className="inline-flex items-center gap-1 hover:underline">
              <User className="h-3.5 w-3.5" /> {contactName || 'View contact'}
            </Link>
            {opp.property_id ? (
              <Link to={`/listings/${opp.property_id}`} className="inline-flex items-center gap-1 hover:underline">
                <Building2 className="h-3.5 w-3.5" /> View listing
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <Label className="text-xs">Stage</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.stage}
                onChange={(e) => setField('stage', e.target.value)}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {stageLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <Label className="text-xs">Probability (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.probability}
                onChange={(e) => setField('probability', e.target.value)}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <Label className="text-xs">Deal value</Label>
              <Input
                type="number"
                min={0}
                value={form.deal_value}
                onChange={(e) => setField('deal_value', e.target.value)}
                placeholder="e.g. 500000"
              />
            </label>
            <label className="block">
              <Label className="text-xs">Currency</Label>
              <Input value={form.currency} onChange={(e) => setField('currency', e.target.value)} maxLength={5} />
            </label>
          </div>
          <label className="block sm:w-1/2">
            <Label className="text-xs">Expected close date</Label>
            <Input
              type="date"
              value={form.expected_close_date}
              onChange={(e) => setField('expected_close_date', e.target.value)}
            />
          </label>
          {form.stage === 'closed_lost' ? (
            <label className="block">
              <Label className="text-xs">Lost reason</Label>
              <Input value={form.lost_reason} onChange={(e) => setField('lost_reason', e.target.value)} />
            </label>
          ) : null}
          <label className="block">
            <Label className="text-xs">Notes</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={4}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </label>
          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={!dirty || saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {opp.stage_history && opp.stage_history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stage history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {opp.stage_history.map((h, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className={STAGE_PILL[h.stage] || STAGE_PILL.new}>
                    {stageLabel(h.stage)}
                  </Badge>
                  <span className="text-[var(--lc-text-muted)]">{new Date(h.changed_at).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export default OpportunityDetailPage
