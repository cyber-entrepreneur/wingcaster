import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  AUDIENCE_FIELDS,
  AUDIENCE_OPERATORS,
  EMPTY_RULE,
  type AudienceRule,
} from '@/components/campaigns/campaign-builder-shared'

export interface AudienceRuleEditorProps {
  tagsFilter: string[]
  audienceRules: AudienceRule[]
  onTagsChange: (tags: string[]) => void
  onRulesChange: (rules: AudienceRule[]) => void
  tagInput?: string
  onTagInputChange?: (value: string) => void
}

export function AudienceRuleEditor({
  tagsFilter,
  audienceRules,
  onTagsChange,
  onRulesChange,
  tagInput = '',
  onTagInputChange,
}: AudienceRuleEditorProps) {
  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tagsFilter.includes(t)) onTagsChange([...tagsFilter, t])
    onTagInputChange?.('')
  }

  const addRule = () => onRulesChange([...audienceRules, { ...EMPTY_RULE }])
  const updateRule = (index: number, rule: AudienceRule) => {
    onRulesChange(audienceRules.map((r, i) => (i === index ? rule : r)))
  }
  const removeRule = (index: number) => {
    onRulesChange(audienceRules.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6" data-testid="audience-rule-editor">
      <div className="space-y-2">
        <Label>Tags filter</Label>
        <div className="flex flex-wrap gap-2">
          {tagsFilter.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer bg-[var(--lc-surface-sunken)] text-[var(--lc-text-primary)]"
              onClick={() => onTagsChange(tagsFilter.filter((t) => t !== tag))}
            >
              {tag} ×
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => onTagInputChange?.(e.target.value)}
            placeholder="Add tag filter"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <Button type="button" variant="outline" onClick={addTag}>Add</Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Audience rules</Label>
          <Button type="button" variant="outline" size="sm" onClick={addRule}>
            <Plus className="mr-1 h-4 w-4" /> Rule
          </Button>
        </div>
        {audienceRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules — all contacts in scope match.</p>
        ) : (
          audienceRules.map((rule, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <select
                className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-2 py-2 text-sm"
                value={rule.field}
                onChange={(e) => updateRule(index, { ...rule, field: e.target.value as AudienceRule['field'] })}
              >
                {AUDIENCE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-2 py-2 text-sm"
                value={rule.operator}
                onChange={(e) => updateRule(index, { ...rule, operator: e.target.value as AudienceRule['operator'] })}
              >
                {AUDIENCE_OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <Input
                value={rule.value}
                onChange={(e) => updateRule(index, { ...rule, value: e.target.value })}
                placeholder="Value"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRule(index)} aria-label="Remove rule">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
