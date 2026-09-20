import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AudienceRuleEditor } from '@/components/audiences/AudienceRuleEditor'
import { AudienceBreakdown } from '@/components/audiences/AudienceBreakdown'
import { api } from '@/api/client'
import type { Audience, AudienceResolveResult } from '@/types/audience'
import type { AudienceRule } from '@/components/campaigns/campaign-builder-shared'

export interface AudienceBuilderFormProps {
  initial?: Partial<Audience>
  audienceId?: string
  embedded?: boolean
  onSaved?: (audience: Audience) => void
}

export function AudienceBuilderForm({ initial, audienceId, embedded = false, onSaved }: AudienceBuilderFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<'static' | 'dynamic'>(initial?.type ?? 'dynamic')
  const [tagsFilter, setTagsFilter] = useState<string[]>(initial?.tags_filter ?? [])
  const [audienceRules, setAudienceRules] = useState<AudienceRule[]>(initial?.audience_rules ?? [])
  const [tagInput, setTagInput] = useState('')
  const [channel, setChannel] = useState<'email' | 'sms' | 'whatsapp'>('email')
  const [breakdown, setBreakdown] = useState<AudienceResolveResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initial) {
      setName(initial.name ?? '')
      setType(initial.type ?? 'dynamic')
      setTagsFilter(initial.tags_filter ?? [])
      setAudienceRules(initial.audience_rules ?? [])
    }
  }, [initial])

  const rulesPayload = {
    tags_filter: tagsFilter,
    audience_rules: audienceRules,
  }

  const handleSave = async (notify = true) => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name,
        type,
        rules: rulesPayload,
        member_source: 'crm',
      }
      const saved = audienceId
        ? await api.updateAudience(audienceId, payload)
        : await api.createAudience(payload)
      if (notify) onSaved?.(saved as Audience)
      return saved as Audience
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save audience')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleResolve = async () => {
    setResolving(true)
    setError(null)
    try {
      let id = audienceId
      if (!id) {
        const saved = await handleSave(false)
        if (!saved) return
        id = saved.id
      }
      const result = await api.resolveAudience(id, { channel, purpose: 'marketing' })
      setBreakdown(result as AudienceResolveResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve audience')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="space-y-6" data-testid={embedded ? 'audience-builder-embedded' : 'audience-builder-form'}>
      {!embedded && (
        <div className="space-y-2">
          <Label htmlFor="audience-name">Audience name</Label>
          <Input
            id="audience-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Active buyers in Dubai"
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="audience-type">Type</Label>
          <select
            id="audience-type"
            className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as 'static' | 'dynamic')}
          >
            <option value="dynamic">Dynamic (rules)</option>
            <option value="static">Static (explicit list via rules)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audience-channel">Resolve channel</Label>
          <select
            id="audience-channel"
            className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
            value={channel}
            onChange={(e) => setChannel(e.target.value as 'email' | 'sms' | 'whatsapp')}
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
      </div>

      <AudienceRuleEditor
        tagsFilter={tagsFilter}
        audienceRules={audienceRules}
        onTagsChange={setTagsFilter}
        onRulesChange={setAudienceRules}
        tagInput={tagInput}
        onTagInputChange={setTagInput}
      />

      <AudienceBreakdown result={breakdown} />

      {error && <p className="text-sm text-[var(--lc-status-danger)]" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => handleSave()} disabled={saving || name.trim().length < 2}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save audience
        </Button>
        <Button type="button" variant="outline" onClick={handleResolve} disabled={resolving || name.trim().length < 2}>
          {resolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Resolve breakdown
        </Button>
      </div>
    </div>
  )
}
