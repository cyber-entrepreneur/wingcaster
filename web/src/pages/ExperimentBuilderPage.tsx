/**
 * Wave 2D — Experiment builder (dimension → variants → allocation + holdout + goal).
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { usePageTitle } from '@/lib/usePageTitle'
import {
  api,
  type Experiment,
  type ExperimentAllocation,
  type ExperimentDimension,
  type ExperimentVariant,
} from '@/api/client'

const DIMENSIONS: ExperimentDimension[] = [
  'creative',
  'copy',
  'cta',
  'channel',
  'timing',
  'journey_path',
]

const GOAL_EVENTS = [
  'lead.created',
  'lead.qualified',
  'viewing.booked',
  'offer.made',
  'reservation.created',
  'transaction.closed',
]

const inputClass =
  'w-full rounded-[var(--lc-radius-sm)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lc-focus-ring)]'

const labelClass = 'mb-1 block text-sm font-medium text-[var(--lc-text-primary)]'

function emptyVariant(key: string): ExperimentVariant {
  return { key, label: key, is_control: key === 'A' }
}

export function ExperimentBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  usePageTitle(isNew ? 'New experiment' : 'Edit experiment')

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [experiment, setExperiment] = useState<Experiment | null>(null)

  const [dimension, setDimension] = useState<ExperimentDimension>('copy')
  const [allocation, setAllocation] = useState<ExperimentAllocation>('even')
  const [holdoutPct, setHoldoutPct] = useState(10)
  const [goalEvent, setGoalEvent] = useState('lead.created')
  const [campaignId, setCampaignId] = useState('')
  const [variants, setVariants] = useState<ExperimentVariant[]>([
    emptyVariant('A'),
    emptyVariant('B'),
  ])

  useEffect(() => {
    if (!id) return
    api
      .getExperiment(id)
      .then((row) => {
        setExperiment(row)
        setDimension(row.dimension)
        setAllocation(row.allocation)
        setHoldoutPct(row.holdout_pct)
        setGoalEvent(row.goal_event)
        setCampaignId(row.campaign_id || '')
        setVariants(row.variants?.length ? row.variants : [emptyVariant('A'), emptyVariant('B')])
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [id])

  const updateVariant = (index: number, patch: Partial<ExperimentVariant>) => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  const addVariant = () => {
    const nextKey = String.fromCharCode(65 + variants.length)
    setVariants((prev) => [...prev, emptyVariant(nextKey || `V${prev.length + 1}`)])
  }

  const removeVariant = (index: number) => {
    if (variants.length <= 1) return
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  const onSave = async () => {
    setSaving(true)
    setError(null)
    const payload = {
      dimension,
      allocation,
      holdout_pct: Number(holdoutPct) || 0,
      goal_event: goalEvent,
      campaign_id: campaignId.trim() || null,
      variants: variants.map((v) => ({
        key: v.key.trim(),
        label: (v.label || v.key).trim(),
        is_control: Boolean(v.is_control),
        creative_variant_id: v.creative_variant_id || null,
        journey_path: v.journey_path || null,
        next: v.next || null,
      })),
    }
    try {
      if (isNew) {
        const created = await api.createExperiment(payload)
        navigate(`/experiments/${created.id}`)
      } else if (id) {
        const updated = await api.updateExperiment(id, payload)
        setExperiment(updated)
      }
    } catch (err) {
      setError((err as Error).message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onStart = async () => {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const updated = await api.startExperiment(id)
      setExperiment(updated)
    } catch (err) {
      setError((err as Error).message || 'Start failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <CrmShell>
        <p className="p-6 text-sm text-[var(--lc-text-secondary)]">Loading experiment…</p>
      </CrmShell>
    )
  }

  return (
    <CrmShell>
      <CmdPageHeader
        title={isNew ? 'New experiment' : 'Edit experiment'}
        subtitle="Pick a dimension, define variants, set allocation and holdout, choose a funnel goal event."
        actions={
          <Button asChild variant="ghost">
            <Link to="/experiments">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {error && (
          <p className="rounded-[var(--lc-radius-sm)] border border-[var(--lc-status-danger-fg)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-status-danger-fg)]" role="alert">
            {error}
          </p>
        )}

        <section className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="exp-dimension">
              Dimension
            </label>
            <select
              id="exp-dimension"
              className={inputClass}
              value={dimension}
              onChange={(e) => setDimension(e.target.value as ExperimentDimension)}
              disabled={experiment?.status === 'concluded'}
            >
              {DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="exp-goal">
              Goal event
            </label>
            <select
              id="exp-goal"
              className={inputClass}
              value={goalEvent}
              onChange={(e) => setGoalEvent(e.target.value)}
              disabled={experiment?.status === 'concluded'}
            >
              {GOAL_EVENTS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="exp-allocation">
                Allocation
              </label>
              <select
                id="exp-allocation"
                className={inputClass}
                value={allocation}
                onChange={(e) => setAllocation(e.target.value as ExperimentAllocation)}
                disabled={experiment?.status === 'concluded'}
              >
                <option value="even">Even (deterministic)</option>
                <option value="bandit">Bandit (not configured)</option>
              </select>
              {allocation === 'bandit' && (
                <p className="mt-1 text-xs text-[var(--lc-text-secondary)]">
                  Bandit optimisation returns NOT_CONFIGURED — use even allocation for launch.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="exp-holdout">
                Holdout %
              </label>
              <input
                id="exp-holdout"
                type="number"
                min={0}
                max={100}
                step={1}
                className={inputClass}
                value={holdoutPct}
                onChange={(e) => setHoldoutPct(Number(e.target.value))}
                disabled={experiment?.status === 'concluded'}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="exp-campaign">
              Campaign id (optional)
            </label>
            <input
              id="exp-campaign"
              className={inputClass}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              placeholder="cmp_…"
              disabled={experiment?.status === 'concluded'}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[var(--lc-text-primary)]">Variants</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addVariant}
              disabled={experiment?.status === 'concluded'}
            >
              <Plus className="mr-1 h-4 w-4" /> Add variant
            </Button>
          </div>
          {variants.map((variant, index) => (
            <div
              key={`${variant.key}-${index}`}
              className="grid gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4 sm:grid-cols-2"
            >
              <div>
                <label className={labelClass} htmlFor={`var-key-${index}`}>
                  Key
                </label>
                <input
                  id={`var-key-${index}`}
                  className={inputClass}
                  value={variant.key}
                  onChange={(e) => updateVariant(index, { key: e.target.value })}
                  disabled={experiment?.status === 'concluded'}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`var-label-${index}`}>
                  Label
                </label>
                <input
                  id={`var-label-${index}`}
                  className={inputClass}
                  value={variant.label || ''}
                  onChange={(e) => updateVariant(index, { label: e.target.value })}
                  disabled={experiment?.status === 'concluded'}
                />
              </div>
              {(dimension === 'creative' || dimension === 'copy' || dimension === 'cta') && (
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor={`var-crv-${index}`}>
                    Creative variant id
                  </label>
                  <input
                    id={`var-crv-${index}`}
                    className={inputClass}
                    value={variant.creative_variant_id || ''}
                    onChange={(e) => updateVariant(index, { creative_variant_id: e.target.value || null })}
                    placeholder="crv_…"
                    disabled={experiment?.status === 'concluded'}
                  />
                </div>
              )}
              {dimension === 'journey_path' && (
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor={`var-path-${index}`}>
                    Journey path / next node
                  </label>
                  <input
                    id={`var-path-${index}`}
                    className={inputClass}
                    value={variant.journey_path || variant.next || ''}
                    onChange={(e) =>
                      updateVariant(index, {
                        journey_path: e.target.value || null,
                        next: e.target.value || null,
                      })
                    }
                    placeholder="node id"
                    disabled={experiment?.status === 'concluded'}
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-[var(--lc-text-primary)]">
                  <input
                    type="checkbox"
                    checked={Boolean(variant.is_control)}
                    onChange={(e) => updateVariant(index, { is_control: e.target.checked })}
                    disabled={experiment?.status === 'concluded'}
                  />
                  Control variant
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVariant(index)}
                  disabled={variants.length <= 1 || experiment?.status === 'concluded'}
                  aria-label={`Remove variant ${variant.key}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-2 border-t border-[var(--lc-border)] pt-4">
          <Button type="button" onClick={onSave} disabled={saving || experiment?.status === 'concluded'}>
            {saving ? 'Saving…' : isNew ? 'Create experiment' : 'Save changes'}
          </Button>
          {!isNew && experiment?.status === 'draft' && (
            <Button type="button" variant="outline" onClick={onStart} disabled={saving}>
              Start experiment
            </Button>
          )}
          {!isNew && (
            <Button asChild variant="outline">
              <Link to={`/experiments/${id}/results`}>View results</Link>
            </Button>
          )}
          {experiment?.status && (
            <span className="self-center text-xs text-[var(--lc-text-secondary)]">
              Status: {experiment.status}
            </span>
          )}
        </div>
      </div>
    </CrmShell>
  )
}
