import { useState } from 'react'
import { ChevronDown, ChevronUp, Mail, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CHANNELS, CampaignStep, CampaignTemplate } from './campaign-builder-shared'

export function CampaignStepEditor({
  step,
  index,
  onUpdate,
  onRemove,
  canRemove,
  templates,
  templatesLoading,
}: {
  step: CampaignStep
  index: number
  onUpdate: (s: CampaignStep) => void
  onRemove: () => void
  canRemove: boolean
  templates: CampaignTemplate[]
  templatesLoading: boolean
}) {
  const [open, setOpen] = useState(true)
  const ChannelIcon = CHANNELS.find((c) => c.value === step.channel)?.icon ?? Mail
  const selectedTemplate = templates.find((t) => t.id === step.template_id)
  const channelTemplates = templates.filter((t) => t.channel === step.channel)
  const isUsingTemplate = Boolean(selectedTemplate)

  return (
    <div className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface)]">
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--lc-surface-sunken)] text-xs font-semibold">
          {index + 1}
        </div>
        <ChannelIcon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium">
          {selectedTemplate ? selectedTemplate.name : step.subject || step.body.slice(0, 60) || 'Untitled step'}
        </span>
        {selectedTemplate && <Badge variant="secondary" className="text-[10px]">Template</Badge>}
        {step.delay_hours > 0 && (
          <Badge variant="outline" className="text-[10px]">+{step.delay_hours}h</Badge>
        )}
        <button
          type="button"
          className="text-muted-foreground hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation()
            if (canRemove) onRemove()
          }}
          disabled={!canRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="space-y-3 border-t border-[var(--lc-border)] p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Template</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
              value={step.template_id || ''}
              disabled={templatesLoading}
              onChange={(e) => {
                const id = e.target.value
                if (!id) {
                  onUpdate({ ...step, template_id: null })
                  return
                }
                const template = templates.find((t) => t.id === id)
                if (!template) return
                onUpdate({
                  ...step,
                  template_id: template.id,
                  channel: template.channel,
                  subject: template.subject || step.subject,
                  body: template.body,
                })
              }}
            >
              <option value="">— Manual message —</option>
              {channelTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
            {templatesLoading && <p className="text-[10px] text-muted-foreground">Loading templates…</p>}
            {isUsingTemplate && (
              <p className="text-[10px] text-muted-foreground">
                Subject and body are previewed from the template. Select “Manual message” to edit.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Delay (hours after previous step)</Label>
              <Input
                type="number"
                min="0"
                value={step.delay_hours}
                onChange={(e) => onUpdate({ ...step, delay_hours: Number(e.target.value) })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Channel</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                value={step.channel}
                disabled={isUsingTemplate}
                onChange={(e) => {
                  const channel = e.target.value
                  const next = { ...step, channel }
                  if (selectedTemplate && selectedTemplate.channel !== channel) {
                    next.template_id = null
                    next.subject = ''
                    next.body = ''
                  }
                  onUpdate(next)
                }}
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          {step.channel === 'email' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Subject line</Label>
              <Input
                value={step.subject}
                placeholder="e.g. We received your inquiry"
                disabled={isUsingTemplate}
                onChange={(e) => onUpdate({ ...step, subject: e.target.value })}
                className="h-9 disabled:opacity-60"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Message body
              <span className="ml-2 text-muted-foreground">
                {'  '}Available tokens:{' '}
                {['{{client_name}}', '{{property_title}}', '{{agent_name}}', '{{viewing_date}}'].map((t) => (
                  <code key={t} className="ml-1 rounded bg-muted px-1 text-[10px]">{t}</code>
                ))}
              </span>
            </Label>
            <textarea
              rows={4}
              value={step.body}
              placeholder="Write your message…"
              disabled={isUsingTemplate}
              onChange={(e) => onUpdate({ ...step, body: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-60"
            />
          </div>
        </div>
      )}
    </div>
  )
}
