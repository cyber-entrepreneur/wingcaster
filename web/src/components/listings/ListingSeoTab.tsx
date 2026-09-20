import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, Loader2, RefreshCw, Search } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface SeoRecommendation {
  id: string
  severity: 'success' | 'warning' | 'error' | 'info'
  message: string
  field: string
}

interface SeoTarget {
  target_surface: string
  can_toggle: boolean
  available_surfaces: string[]
  external_site_url?: string | null
}

interface ListingSeoData {
  property_id: string
  seo_page: {
    title?: string
    meta_description?: string
    slug?: string
    canonical_url?: string
    og_tags?: Record<string, string>
    schema_jsonld?: Record<string, unknown>
    status?: string
  } | null
  target: SeoTarget
  recommendations: {
    score: number
    grade: string
    recommendations: SeoRecommendation[]
  }
  is_external: boolean
  is_wingcaster_served: boolean
}

const SURFACE_LABELS: Record<string, string> = {
  agency_white_label: 'Agency white-label site',
  own_white_label: 'Your white-label site',
  external_site: 'Your external website',
  bazaar: 'Bazaar marketplace',
}

const SEVERITY_STYLES: Record<string, string> = {
  success: 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]',
  warning: 'bg-[var(--lc-status-underOffer-bg)] text-[var(--lc-status-underOffer-fg)]',
  error: 'bg-[var(--lc-status-unpublished-bg)] text-[var(--lc-status-unpublished-fg)]',
  info: 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]',
}

export function ListingSeoTab({ listingId }: { listingId: string }) {
  const { addToast } = useToast()
  const [data, setData] = useState<ListingSeoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [exportBundle, setExportBundle] = useState<Record<string, unknown> | null>(null)
  const [form, setForm] = useState({ title: '', meta_description: '', slug: '', canonical_url: '' })
  const [targetChoice, setTargetChoice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.getListingSeo(listingId) as ListingSeoData
      setData(result)
      setForm({
        title: result.seo_page?.title || '',
        meta_description: result.seo_page?.meta_description || '',
        slug: result.seo_page?.slug || '',
        canonical_url: result.seo_page?.canonical_url || '',
      })
      setTargetChoice(result.target.target_surface)
      if (result.is_external) {
        const bundle = await api.getListingSeoExport(listingId)
        setExportBundle(bundle as Record<string, unknown>)
      } else {
        setExportBundle(null)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not load SEO data'
      addToast({ title: 'SEO load failed', description: message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [listingId, addToast])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateListingSeo(listingId, form)
      addToast({ title: 'SEO saved', variant: 'success' })
      await load()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed'
      addToast({ title: 'Save failed', description: message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await api.generateListingSeo(listingId)
      addToast({ title: 'SEO page generated', variant: 'success' })
      await load()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      addToast({ title: 'Generate failed', description: message, variant: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  const handleTargetChange = async (surface: string) => {
    try {
      await api.setListingSeoTarget(listingId, {
        target_surface: surface,
        external_site_url: data?.target.external_site_url,
      })
      setTargetChoice(surface)
      addToast({ title: 'SEO target updated', variant: 'success' })
      await load()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Target update failed'
      addToast({ title: 'Update failed', description: message, variant: 'error' })
    }
  }

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    addToast({ title: `${label} copied`, variant: 'success' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-[var(--lc-text-muted)]">SEO data unavailable.</p>
  }

  const scoreColor = data.recommendations.score >= 80
    ? 'text-[var(--lc-status-published-fg)]'
    : data.recommendations.score >= 50
      ? 'text-[var(--lc-status-underOffer-fg)]'
      : 'text-[var(--lc-status-unpublished-fg)]'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-[var(--lc-action-primary)]" />
          <div>
            <h3 className="text-lg font-semibold text-[var(--lc-text-primary)]">SEO &amp; Search</h3>
            <p className="text-sm text-[var(--lc-text-muted)]">
              Target: {SURFACE_LABELS[data.target.target_surface] || data.target.target_surface}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-[var(--lc-text-muted)]">Content score</p>
            <p className={`text-2xl font-bold ${scoreColor}`}>{data.recommendations.score}</p>
          </div>
          <Button onClick={handleGenerate} disabled={generating} variant="outline">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Generate
          </Button>
        </div>
      </div>

      {data.target.can_toggle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SEO target</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.target.available_surfaces.map((surface) => (
              <Button
                key={surface}
                size="sm"
                variant={targetChoice === surface ? 'default' : 'outline'}
                onClick={() => handleTargetChange(surface)}
              >
                {SURFACE_LABELS[surface] || surface}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {data.is_external ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Embed SEO assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-[var(--lc-text-muted)]">
              WingCaster cannot inject SEO into your external site. Copy or link these assets to embed on your website.
            </p>
            {exportBundle && (
              <div className="space-y-3">
                {Boolean(exportBundle.feed_url) && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <span className="truncate font-mono text-xs">{String(exportBundle.feed_url)}</span>
                    <Button size="sm" variant="ghost" onClick={() => copyText(String(exportBundle.feed_url), 'Feed URL')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {Boolean(exportBundle.sitemap_url) && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <span className="truncate font-mono text-xs">{String(exportBundle.sitemap_url)}</span>
                    <Button size="sm" variant="ghost" onClick={() => copyText(String(exportBundle.sitemap_url), 'Sitemap URL')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {Boolean(exportBundle.embed_snippet) && (
                  <div>
                    <Label>JSON-LD embed snippet</Label>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-[var(--lc-surface-sunken)] p-3 text-xs">
                      {String(exportBundle.embed_snippet)}
                    </pre>
                    <Button
                      size="sm"
                      className="mt-2"
                      variant="outline"
                      onClick={() => copyText(String(exportBundle.embed_snippet), 'JSON-LD snippet')}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy snippet
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Page metadata</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="seo-title">Title</Label>
                <Input
                  id="seo-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <p className="mt-1 text-xs text-[var(--lc-text-muted)]">{form.title.length} / 60 chars</p>
              </div>
              <div>
                <Label htmlFor="seo-meta">Meta description</Label>
                <textarea
                  id="seo-meta"
                  rows={3}
                  value={form.meta_description}
                  onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="mt-1 text-xs text-[var(--lc-text-muted)]">{form.meta_description.length} / 160 chars</p>
              </div>
              <div>
                <Label htmlFor="seo-slug">URL slug</Label>
                <Input
                  id="seo-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="seo-canonical">Canonical URL</Label>
                <Input
                  id="seo-canonical"
                  value={form.canonical_url}
                  onChange={(e) => setForm({ ...form, canonical_url: e.target.value })}
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Recommendations</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.recommendations.recommendations.map((rec) => (
                  <div key={rec.id} className="flex items-start gap-2">
                    <Badge className={SEVERITY_STYLES[rec.severity] || SEVERITY_STYLES.info}>
                      {rec.severity}
                    </Badge>
                    <span className="text-sm text-[var(--lc-text-primary)]">{rec.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {data.seo_page?.schema_jsonld && (
              <Card>
                <CardHeader><CardTitle className="text-base">JSON-LD preview</CardTitle></CardHeader>
                <CardContent>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--lc-surface-sunken)] p-3 text-xs">
                    {JSON.stringify(data.seo_page.schema_jsonld, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {data.seo_page?.og_tags && (
              <Card>
                <CardHeader><CardTitle className="text-base">Open Graph preview</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {Object.entries(data.seo_page.og_tags).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-mono text-xs text-[var(--lc-text-muted)]">{key}</span>
                      <span className="truncate">{value}</span>
                    </div>
                  ))}
                  {form.canonical_url && (
                    <a
                      href={form.canonical_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[var(--lc-action-primary)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View page
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
