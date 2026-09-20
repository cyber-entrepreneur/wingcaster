import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, ShieldAlert, Sparkles } from 'lucide-react'
import { api, type CreativeBundle, type CreativeVariant } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Property } from '@/types'

interface Props {
  property: Property
}

type SelectionKey = string

function selectionKey(variantId: string, channelKey: string): SelectionKey {
  return `${variantId}:${channelKey}`
}

export function AiAdaptiveComposer({ property }: Props) {
  const { addToast } = useToast()
  const [platforms, setPlatforms] = useState<Array<{ key: string; label: string; width: number; height: number }>>([])
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set(['instagram_feed', 'instagram_story']))
  const [description, setDescription] = useState(property.description || property.title || '')
  const [bundle, setBundle] = useState<CreativeBundle | null>(null)
  const [selected, setSelected] = useState<Set<SelectionKey>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [editingCopy, setEditingCopy] = useState<Record<string, string>>({})

  useEffect(() => {
    api.getSocialCardPlatforms().then((r) => setPlatforms(r.platforms)).catch(() => {})
  }, [])

  const approvalBlocked = bundle?.creative?.approval_state === 'pending'
  const approvalLabel = bundle?.creative?.approval_state === 'approved'
    ? 'Approved'
    : bundle?.creative?.approval_state === 'rejected'
      ? 'Rejected'
      : bundle?.creative?.approval_state === 'pending'
        ? 'Pending approval'
        : null

  const toggleChannel = (key: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelect = (variantId: string, channelKey: string) => {
    const k = selectionKey(variantId, channelKey)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const handleGenerate = useCallback(async () => {
    if (generating || !selectedChannels.size || !description.trim()) return
    setGenerating(true)
    try {
      const result = await api.generateListingCreative(property.id, {
        description: description.trim(),
        channel_keys: Array.from(selectedChannels),
        template_id: 'platform_editorial_v1',
      })
      setBundle(result)
      setSelected(new Set())
      setEditingCopy({})
      addToast({ title: `Generated ${result.variants.length} variants`, variant: 'success' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      addToast({ title: 'AI composer failed', description: message, variant: 'error' })
    } finally {
      setGenerating(false)
    }
  }, [generating, selectedChannels, description, property.id, addToast])

  const handleEditSave = async (variant: CreativeVariant, channelKey: string) => {
    const key = `${variant.id}:${channelKey}`
    const value = editingCopy[key]
    if (value == null) return
    try {
      const { variant: updated } = await api.updateCreativeVariant(variant.id, {
        copy: { [channelKey]: value },
      })
      setBundle((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          variants: prev.variants.map((v) => (v.id === updated.id ? { ...v, copy: updated.copy } : v)),
        }
      })
      addToast({ title: 'Caption updated', variant: 'success' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed'
      addToast({ title: 'Edit failed', description: message, variant: 'error' })
    }
  }

  const handleApprove = async () => {
    if (!bundle) return
    try {
      const updated = await api.approveCreative(bundle.creative.id, { decision: 'approved' })
      setBundle(updated)
      addToast({ title: 'Creative approved for publish', variant: 'success' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Approval failed'
      addToast({ title: 'Approval failed', description: message, variant: 'error' })
    }
  }

  const handlePublish = async () => {
    if (!bundle || publishing || approvalBlocked || !selected.size) return
    setPublishing(true)
    try {
      const selections = Array.from(selected).map((k) => {
        const [variant_id, channel_key] = k.split(':')
        return { variant_id, channel_key }
      })
      const result = await api.publishCreative(bundle.creative.id, { selections })
      const ok = result.results.filter((r) => r.status === 'published').length
      addToast({
        title: `Published ${ok} of ${result.results.length}`,
        variant: ok ? 'success' : 'warning',
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Publish failed'
      addToast({ title: 'Publish blocked', description: message, variant: 'error' })
    } finally {
      setPublishing(false)
    }
  }

  const gallery = useMemo(() => {
    if (!bundle) return []
    return bundle.variants.flatMap((variant) =>
      (variant.renditions || []).map((rendition) => ({ variant, rendition })),
    )
  }, [bundle])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" style={{ color: 'var(--lc-accent)' }} />
          AI Adaptive Composer
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          One input → four platform-native variants per channel. Edit captions, multi-select, then publish.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="composer-description">Listing pitch</Label>
          <textarea
            id="composer-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </div>

        <div>
          <Label className="text-xs">Channels</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {platforms.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => toggleChannel(p.key)}
                className="rounded-md border px-2 py-1 text-xs transition-colors"
                style={{
                  borderColor: selectedChannels.has(p.key) ? 'var(--lc-accent)' : 'var(--lc-border)',
                  background: selectedChannels.has(p.key) ? 'var(--lc-accent-subtle)' : 'transparent',
                }}
                aria-pressed={selectedChannels.has(p.key)}
              >
                {p.label} ({p.width}×{p.height})
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || !selectedChannels.size || !description.trim()}
          className="gap-1.5"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate variants
        </Button>

        {approvalLabel && (
          <div
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: approvalBlocked ? 'var(--lc-warning)' : 'var(--lc-border)',
              background: approvalBlocked ? 'var(--lc-warning-subtle)' : 'var(--lc-surface-subtle)',
            }}
            role="status"
          >
            {approvalBlocked && <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />}
            <span>{approvalLabel}</span>
            {approvalBlocked && (
              <Button size="sm" variant="outline" className="ms-auto" onClick={handleApprove}>
                Approve
              </Button>
            )}
          </div>
        )}

        {gallery.length > 0 && (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
            aria-label="Variant gallery"
          >
            {gallery.map(({ variant, rendition }) => {
              const k = selectionKey(variant.id, rendition.channel_key)
              const isSelected = selected.has(k)
              const editKey = `${variant.id}:${rendition.channel_key}`
              const caption = editingCopy[editKey] ?? variant.copy?.[rendition.channel_key] ?? ''
              const aspect = rendition.width / rendition.height
              return (
                <article
                  key={rendition.id}
                  role="listitem"
                  className="rounded-lg border p-3 space-y-2"
                  style={{ borderColor: 'var(--lc-border)', background: 'var(--lc-surface)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">{variant.label}</Badge>
                    <button
                      type="button"
                      onClick={() => toggleSelect(variant.id, rendition.channel_key)}
                      className="flex h-8 w-8 items-center justify-center rounded border"
                      style={{
                        borderColor: isSelected ? 'var(--lc-accent)' : 'var(--lc-border)',
                        background: isSelected ? 'var(--lc-accent-subtle)' : 'transparent',
                      }}
                      aria-label={isSelected ? 'Deselect variant' : 'Select variant'}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <Check className="h-4 w-4" />}
                    </button>
                  </div>
                  <div
                    className="relative w-full overflow-hidden rounded bg-muted"
                    style={{ aspectRatio: String(aspect) }}
                  >
                    {rendition.asset_url ? (
                      <img
                        src={rendition.asset_url}
                        alt={`${variant.label} for ${rendition.channel_key}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        {rendition.width}×{rendition.height}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{rendition.channel_key}</p>
                  <Input
                    value={caption}
                    onChange={(e) => setEditingCopy((prev) => ({ ...prev, [editKey]: e.target.value }))}
                    onBlur={() => handleEditSave(variant, rendition.channel_key)}
                    aria-label={`Caption for ${rendition.channel_key}`}
                  />
                </article>
              )
            })}
          </div>
        )}

        {bundle && (
          <Button
            onClick={handlePublish}
            disabled={publishing || approvalBlocked || selected.size === 0}
            variant="default"
            className="gap-1.5"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Publish selected ({selected.size})
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
