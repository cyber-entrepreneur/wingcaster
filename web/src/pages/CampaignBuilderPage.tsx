/**
 * CampaignBuilderPage — multi-step wizard for creating / editing a campaign.
 * Step 1: Basics (name, trigger, channel)
 * Step 2: Audience (target rules / tags)
 * Step 3: Steps (message sequence editor)
 * Step 4: Review + publish
 *
 * AGT-CMP-003: `?mode=pro` renders the single-page Pro builder.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { CampaignBuilderProView } from '@/components/campaigns/CampaignBuilderProView'
import { CampaignStepEditor } from '@/components/campaigns/CampaignStepEditor'
import {
  AUDIENCE_FIELDS,
  AUDIENCE_OPERATORS,
  CHANNELS,
  PRESET_TEMPLATES,
  TRIGGERS,
  WIZARD_STEPS,
} from '@/components/campaigns/campaign-builder-shared'
import { useCampaignBuilderForm } from '@/components/campaigns/useCampaignBuilderForm'
import { campaignFormFromGoal } from '@/components/campaigns/campaign-goals'

function WizardProgressBar({ current }: { current: number }) {
  return (
    <div className="flex shrink-0 items-center gap-0 border-b border-[var(--lc-border)] bg-[var(--lc-surface)] px-6 py-3">
      {WIZARD_STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                i < current
                  ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                  : i === current
                  ? 'border-2 border-[var(--lc-action-primary)] bg-[var(--lc-surface)] text-[var(--lc-text-primary)]'
                  : 'border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] text-muted-foreground',
              )}
            >
              {i < current ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={cn('text-[10px] font-medium', i === current ? 'text-foreground' : 'text-muted-foreground')}>
              {label}
            </span>
          </div>
          {i < WIZARD_STEPS.length - 1 && (
            <div className={cn('mx-2 mb-4 h-px w-12 sm:w-20', i < current ? 'bg-[var(--lc-action-primary)]' : 'bg-[var(--lc-border)]')} />
          )}
        </div>
      ))}
    </div>
  )
}

function CampaignBuilderWizard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  usePageTitle('New Journey')

  // AGT-CMP-001: seed the wizard from a goal preset (`?goal=`). The hook only
  // reads this on its first render, so it acts as a one-time seed.
  const goalParam = searchParams.get('goal')
  const initialForm = useMemo(() => campaignFormFromGoal(goalParam), [goalParam])

  const [wizardStep, setWizardStep] = useState(0)
  const {
    form,
    setField,
    tagInput,
    setTagInput,
    addTag,
    removeTag,
    addRule,
    updateRule,
    removeRule,
    addStep,
    updateStep,
    removeStep,
    applyTemplate,
    templates,
    templatesLoading,
    saving,
    handleSave,
    stepsAreValid,
  } = useCampaignBuilderForm(initialForm)

  const canAdvance = (): boolean => {
    if (wizardStep === 0) return form.name.trim().length >= 2
    if (wizardStep === 2) return stepsAreValid
    return true
  }

  return (
    <CrmShell>
      <CmdPageHeader
        title="New journey"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/journeys')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        }
      />
      <WizardProgressBar current={wizardStep} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8">

          {wizardStep === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Journey basics</h2>
                <p className="text-sm text-muted-foreground">Give your journey a name and choose how it gets triggered.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Journey name <span className="text-red-500">*</span></Label>
                  <Input
                    autoFocus
                    placeholder="e.g. New lead nurture — Beirut buyers"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <textarea
                    rows={2}
                    placeholder="What is this journey for?"
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TRIGGERS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setField('trigger', t.value)}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                          form.trigger === t.value
                            ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                            : 'border-[var(--lc-border)] bg-[var(--lc-surface)] hover:border-foreground',
                        )}
                      >
                        <Zap className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{t.label}</p>
                          <p className={cn('text-xs', form.trigger === t.value ? 'text-[var(--lc-action-primary-text)]/70' : 'text-muted-foreground')}>
                            {t.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Default send channel</Label>
                  <div className="flex gap-2">
                    {CHANNELS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setField('target_channel', value)}
                        className={cn(
                          'flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors',
                          form.target_channel === value
                            ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                            : 'border-[var(--lc-border)] bg-[var(--lc-surface)] hover:border-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Audience targeting</h2>
                <p className="text-sm text-muted-foreground">Define who gets enrolled. Leave empty to enroll manually.</p>
              </div>

              <div className="space-y-3">
                <Label>Contact tags</Label>
                <p className="text-xs text-muted-foreground">Contacts must have ALL of the specified tags to be auto-enrolled.</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag…"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                    className="h-9"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
                </div>
                {form.tags_filter.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.tags_filter.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1.5">
                        {t}
                        <button type="button" onClick={() => removeTag(t)} className="text-muted-foreground hover:text-foreground">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Targeting rules</Label>
                    <p className="text-xs text-muted-foreground">All rules must match (AND logic).</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addRule} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add rule
                  </Button>
                </div>

                {form.audience_rules.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--lc-border-strong)] py-8 text-center text-sm text-muted-foreground">
                    No rules yet — campaign will run on manual enrollment
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.audience_rules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface)] p-3">
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                          value={rule.field}
                          onChange={(e) => updateRule(i, { ...rule, field: e.target.value as typeof rule.field })}
                        >
                          {AUDIENCE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                          value={rule.operator}
                          onChange={(e) => updateRule(i, { ...rule, operator: e.target.value as typeof rule.operator })}
                        >
                          {AUDIENCE_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <Input
                          className="h-8 flex-1"
                          placeholder="value…"
                          value={rule.value}
                          onChange={(e) => updateRule(i, { ...rule, value: e.target.value })}
                        />
                        <button type="button" onClick={() => removeRule(i)} className="text-muted-foreground hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Message steps</h2>
                  <p className="text-sm text-muted-foreground">Define the sequence. Each step fires after the previous one's delay.</p>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-page)] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start from a template</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="rounded-full border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-1 text-xs font-medium hover:border-[var(--lc-action-primary)] hover:bg-[var(--lc-action-primary)] hover:text-[var(--lc-action-primary-text)] transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {form.steps.map((step, i) => (
                  <CampaignStepEditor
                    key={i}
                    step={step}
                    index={i}
                    onUpdate={(s) => updateStep(i, s)}
                    onRemove={() => removeStep(i)}
                    canRemove={form.steps.length > 1}
                    templates={templates}
                    templatesLoading={templatesLoading}
                  />
                ))}

                <Button type="button" variant="outline" className="w-full gap-2" onClick={addStep}>
                  <Plus className="h-4 w-4" /> Add step
                </Button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Review and launch</h2>
                <p className="text-sm text-muted-foreground">Check your campaign settings before publishing.</p>
              </div>

              <div className="divide-y divide-[var(--lc-border)] rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)]">
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campaign</p>
                  <p className="mt-1 font-semibold">{form.name}</p>
                  {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
                </div>
                <div className="grid grid-cols-3 divide-x divide-[var(--lc-border)] px-0">
                  {[
                    { label: 'Trigger', value: TRIGGERS.find((t) => t.value === form.trigger)?.label },
                    { label: 'Channel', value: CHANNELS.find((c) => c.value === form.target_channel)?.label },
                    { label: 'Steps', value: form.steps.length },
                  ].map((item) => (
                    <div key={item.label} className="px-5 py-4">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-semibold">{item.value}</p>
                    </div>
                  ))}
                </div>
                {(form.tags_filter.length > 0 || form.audience_rules.length > 0) && (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audience</p>
                    {form.tags_filter.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {form.tags_filter.map((t) => (
                          <Badge key={t} variant="secondary">{t}</Badge>
                        ))}
                      </div>
                    )}
                    {form.audience_rules.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {form.audience_rules.map((r, i) => (
                          <p key={i} className="text-sm text-muted-foreground">
                            {AUDIENCE_FIELDS.find((f) => f.value === r.field)?.label}{' '}
                            {r.operator} <strong>{r.value}</strong>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Steps</p>
                  <div className="space-y-2">
                    {form.steps.map((s, i) => {
                      const template = templates.find((t) => t.id === s.template_id)
                      return (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--lc-surface-sunken)] text-[10px] font-bold">
                            {i + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {template ? template.name : (s.subject || s.body.slice(0, 60))}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {s.channel}{s.delay_hours > 0 ? ` · +${s.delay_hours}h` : ' · immediately'}
                              {template && ' · uses template'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={saving}
                  onClick={() => handleSave('draft')}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save as draft
                </Button>
                <Button
                  className="flex-1 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
                  disabled={saving}
                  onClick={() => handleSave('active')}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                  Launch journey
                </Button>
              </div>
            </div>
          )}

          {wizardStep < 3 && (
            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={wizardStep === 0}
                onClick={() => setWizardStep((s) => s - 1)}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              <Button
                size="sm"
                disabled={!canAdvance()}
                onClick={() => setWizardStep((s) => s + 1)}
                className="bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
              >
                Continue <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </CrmShell>
  )
}

export function CampaignBuilderPage() {
  const [searchParams] = useSearchParams()
  const { id: journeyId } = useParams()
  // Wizard = create; Pro single-page = edit (or explicit ?mode=pro).
  if (searchParams.get('mode') === 'pro' || journeyId) {
    return <CampaignBuilderProView />
  }
  return <CampaignBuilderWizard />
}
