/**
 * AGT-CMP-003 — Campaign builder single-page (Pro).
 * 3-column layout: goal + audience / content / channels + schedule + inline preview.
 */
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Megaphone, Plus, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { CampaignStepEditor } from './CampaignStepEditor'
import {
  AUDIENCE_FIELDS,
  AUDIENCE_OPERATORS,
  CHANNELS,
  PRESET_TEMPLATES,
  TRIGGERS,
} from './campaign-builder-shared'
import { useCampaignBuilderForm } from './useCampaignBuilderForm'
import { campaignFormFromGoal } from './campaign-goals'

export function CampaignBuilderProView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  usePageTitle('Edit Journey (Pro)')

  // AGT-CMP-001: seed from a goal preset (`?goal=`) on first render.
  const goalParam = searchParams.get('goal')
  const initialForm = useMemo(() => campaignFormFromGoal(goalParam), [goalParam])

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
    canSave,
  } = useCampaignBuilderForm(initialForm)

  const previewStep = form.steps[0]
  const previewTemplate = templates.find((t) => t.id === previewStep?.template_id)
  const previewSubject = previewTemplate?.subject || previewStep?.subject || '(no subject)'
  const previewBody = previewTemplate?.body || previewStep?.body || 'Add message content to see a preview.'

  return (
    <CrmShell>
      <CmdPageHeader
        title="Journey builder"
        subtitle="Pro editor — configure goal, audience, content, and schedule on one screen."
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/journeys')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
        }
      />

      <div
        className="flex-1 overflow-y-auto"
        data-testid="campaign-builder-pro"
      >
        <div className="grid gap-4 p-4 xl:grid-cols-3">
          {/* Column 1 — goal + audience */}
          <section
            className="space-y-4 rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4"
            aria-label="Goal and audience"
          >
            <div>
              <h2 className="text-sm font-semibold">Goal & audience</h2>
              <p className="text-xs text-muted-foreground">Name the campaign and define who gets enrolled.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Campaign name <span className="text-red-500">*</span></Label>
              <Input
                autoFocus
                placeholder="e.g. New lead nurture — Beirut buyers"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <textarea
                rows={2}
                placeholder="What is this campaign for?"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Trigger</Label>
              <div className="space-y-2">
                {TRIGGERS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setField('trigger', t.value)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-colors',
                      form.trigger === t.value
                        ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                        : 'border-[var(--lc-border)] bg-[var(--lc-surface)] hover:border-foreground',
                    )}
                  >
                    <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{t.label}</p>
                      <p
                        className={cn(
                          'text-[10px]',
                          form.trigger === t.value
                            ? 'text-[var(--lc-action-primary-text)]/70'
                            : 'text-muted-foreground',
                        )}
                      >
                        {t.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-[var(--lc-border)] pt-4">
              <Label>Contact tags</Label>
              <p className="text-[10px] text-muted-foreground">Contacts must have ALL tags for auto-enrollment.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  className="h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
              </div>
              {form.tags_filter.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags_filter.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1.5">
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Targeting rules</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRule} className="gap-1.5 h-7 text-xs">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              {form.audience_rules.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--lc-border-strong)] py-4 text-center text-xs text-muted-foreground">
                  No rules — manual enrollment only
                </p>
              ) : (
                <div className="space-y-2">
                  {form.audience_rules.map((rule, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-page)] p-2"
                    >
                      <select
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                        value={rule.field}
                        onChange={(e) =>
                          updateRule(i, { ...rule, field: e.target.value as typeof rule.field })
                        }
                      >
                        {AUDIENCE_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <select
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                        value={rule.operator}
                        onChange={(e) =>
                          updateRule(i, { ...rule, operator: e.target.value as typeof rule.operator })
                        }
                      >
                        {AUDIENCE_OPERATORS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <Input
                        className="h-7 min-w-[6rem] flex-1 text-xs"
                        placeholder="value…"
                        value={rule.value}
                        onChange={(e) => updateRule(i, { ...rule, value: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeRule(i)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Column 2 — content */}
          <section
            className="space-y-4 rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4"
            aria-label="Message content"
          >
            <div>
              <h2 className="text-sm font-semibold">Content</h2>
              <p className="text-xs text-muted-foreground">Build the message sequence for this campaign.</p>
            </div>

            <div className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-page)] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Start from a template
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="rounded-full border border-[var(--lc-border)] bg-[var(--lc-surface)] px-2.5 py-0.5 text-[10px] font-medium transition-colors hover:border-[var(--lc-action-primary)] hover:bg-[var(--lc-action-primary)] hover:text-[var(--lc-action-primary-text)]"
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
          </section>

          {/* Column 3 — channels + schedule + preview */}
          <section
            className="space-y-4 rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4"
            aria-label="Channels schedule and preview"
          >
            <div>
              <h2 className="text-sm font-semibold">Channels & schedule</h2>
              <p className="text-xs text-muted-foreground">Default channel and step timing overview.</p>
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
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors',
                      form.target_channel === value
                        ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                        : 'border-[var(--lc-border)] bg-[var(--lc-surface)] hover:border-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Step schedule</Label>
              <div className="space-y-1.5 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-page)] p-3">
                {form.steps.map((s, i) => {
                  const template = templates.find((t) => t.id === s.template_id)
                  const cumulativeHours = form.steps
                    .slice(0, i + 1)
                    .reduce((sum, step) => sum + step.delay_hours, 0)
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--lc-surface-sunken)] text-[10px] font-bold">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {template ? template.name : s.subject || s.body.slice(0, 40) || 'Untitled'}
                        </p>
                        <p className="text-[10px] capitalize text-muted-foreground">
                          {s.channel}
                          {i === 0 && s.delay_hours === 0
                            ? ' · on enroll'
                            : ` · +${s.delay_hours}h (${cumulativeHours}h total)`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2 border-t border-[var(--lc-border)] pt-4">
              <Label>Inline preview</Label>
              <div
                className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-page)] p-3"
                data-testid="campaign-pro-preview"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step 1 · {previewStep?.channel || 'email'}
                </p>
                {previewStep?.channel === 'email' && (
                  <p className="mt-2 text-xs font-medium">{previewSubject}</p>
                )}
                <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{previewBody}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-[var(--lc-border)] pt-4">
              <Button
                variant="outline"
                disabled={saving || !canSave}
                onClick={() => handleSave('draft')}
                data-testid="campaign-pro-save-draft"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save draft
              </Button>
              <Button
                className="bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
                disabled={saving || !canSave}
                onClick={() => handleSave('active')}
                data-testid="campaign-pro-launch"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Megaphone className="mr-2 h-4 w-4" />
                )}
                Launch campaign
              </Button>
            </div>
          </section>
        </div>
      </div>
    </CrmShell>
  )
}
