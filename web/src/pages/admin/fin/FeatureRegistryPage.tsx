/**
 * PA-PKG-007 — Feature registry admin.
 * Route: /admin/fin/packages/features
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ExternalLink, Plus, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useStepUp } from '@/context/StepUpContext'
import { PackageConsoleFrame } from '@/pages/admin/packages/packageShared'
import { packagesApi } from '@/pages/admin/packages/api'
import type { MeteredFeature } from '@/pages/admin/packages/types'

const CATEGORY_OPTIONS = [
  { value: '', label: 'All modules' },
  { value: 'publishing.social', label: 'Social publishing' },
  { value: 'publishing.realestate', label: 'Portal publishing' },
  { value: 'communication.whatsapp', label: 'WhatsApp' },
  { value: 'communication.sms', label: 'SMS' },
  { value: 'ai.content', label: 'AI content' },
  { value: 'ai.intelligence', label: 'AI intelligence' },
  { value: 'assets.render', label: 'Assets / render' },
  { value: 'other', label: 'Other' },
] as const

function moduleLabel(category: string | null | undefined): string {
  if (!category) return '—'
  if (category.startsWith('publishing.social')) return 'Social'
  if (category.startsWith('publishing.')) return 'Portal'
  if (category.startsWith('ai.')) return 'AI'
  if (category.startsWith('communication.')) return 'Comms'
  if (category.startsWith('assets.')) return 'Assets'
  return 'Other'
}

function featureListQuery(category: string, activeOnly: boolean): string {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (activeOnly) params.set('active', 'true')
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function FeatureRegistryPage() {
  const { addToast } = useToast()
  const { runElevated } = useStepUp()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [rows, setRows] = useState<MeteredFeature[]>([])
  const [category, setCategory] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [search, setSearch] = useState('')

  const [detail, setDetail] = useState<MeteredFeature | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editName, setEditName] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editReason, setEditReason] = useState('')
  const [saving, setSaving] = useState(false)

  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const body = await packagesApi.listFeatures(featureListQuery(category, activeOnly))
      setRows(body.features || [])
    } catch {
      setError(true)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [category, activeOnly])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      (row) =>
        row.code.toLowerCase().includes(term) ||
        row.display_name.toLowerCase().includes(term) ||
        (row.category || '').toLowerCase().includes(term),
    )
  }, [rows, search])

  const openDetail = async (row: MeteredFeature) => {
    setDetail(row)
    setEditName(row.display_name)
    setEditActive(row.active)
    setEditReason('')
    setDetailLoading(true)
    try {
      const fresh = await packagesApi.getFeature(row.id)
      setDetail(fresh)
      setEditName(fresh.display_name)
      setEditActive(fresh.active)
    } catch {
      addToast({ variant: 'error', title: 'Could not load feature detail.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const saveDetail = async () => {
    if (!detail || !editReason.trim()) {
      addToast({ variant: 'error', title: 'A reason is required for registry changes.' })
      return
    }
    const patch: { display_name?: string; active?: boolean; reason: string } = {
      reason: editReason.trim(),
    }
    if (editName.trim() !== detail.display_name) patch.display_name = editName.trim()
    if (editActive !== detail.active) patch.active = editActive
    if (patch.display_name === undefined && patch.active === undefined) {
      addToast({ variant: 'default', title: 'No changes to save.' })
      return
    }

    setSaving(true)
    try {
      await runElevated(async () => {
        await packagesApi.patchFeature(detail.id, patch)
      })
      addToast({ variant: 'success', title: 'Feature registry updated.' })
      setDetail(null)
      await load()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed'
      addToast({ variant: 'error', title: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PackageConsoleFrame>
      <div className="mx-auto max-w-[1200px] px-[var(--lc-space-2xl)] py-[var(--lc-space-2xl)]">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
              PA-PKG-007
            </p>
            <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
              Feature registry
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Master list of metered features used in package composition. Economics (credits per unit) are managed
              on the pricing surface — not inline here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button type="button" onClick={() => setAddOpen(true)}>
              <Plus className="me-2 h-4 w-4" aria-hidden="true" />
              Add feature
            </Button>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem]">
            <Label htmlFor="feature-module-filter">Module</Label>
            <select
              id="feature-module-filter"
              className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-tap items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Active only
          </label>
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="feature-search">Search</Label>
            <Input
              id="feature-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by key or name"
              className="mt-1"
            />
          </div>
        </div>

        {loading ? (
          <p role="status" style={{ font: 'var(--lc-type-body)' }}>
            Loading feature registry…
          </p>
        ) : error ? (
          <div role="alert" className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-4">
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
              Could not load the feature registry.
            </p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : !visibleRows.length ? (
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
            No features match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]">
            <table className="w-full min-w-[720px] text-start" style={{ font: 'var(--lc-type-body-sm)' }}>
              <thead className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Feature key</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Module</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3 font-medium">Credits / unit</th>
                  <th className="px-4 py-3 font-medium">Pricing</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-[var(--lc-border)] hover:bg-[var(--lc-surface-sunken)]"
                    onClick={() => void openDetail(row)}
                  >
                    <td className="px-4 py-3 font-mono text-[var(--lc-text-primary)]">{row.code}</td>
                    <td className="px-4 py-3">{row.display_name}</td>
                    <td className="px-4 py-3">{moduleLabel(row.category)}</td>
                    <td className="px-4 py-3">
                      <Badge status={row.active ? 'published' : 'archived'}>
                        {row.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Numeric>{row.credits_per_unit ?? '—'}</Numeric>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/fin/pricing?feature=${encodeURIComponent(row.code)}`}
                        className="inline-flex items-center gap-1 text-[var(--lc-text-brand)] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View pricing
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          <Link to="/admin/fin/packages" className="text-[var(--lc-text-brand)] hover:underline">
            Back to packages
          </Link>
        </p>
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.display_name ?? 'Feature detail'}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <p role="status">Loading…</p>
          ) : detail ? (
            <div className="space-y-4">
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-[var(--lc-text-muted)]">Feature key</dt>
                  <dd className="font-mono">{detail.code}</dd>
                </div>
                <div>
                  <dt className="text-[var(--lc-text-muted)]">Module</dt>
                  <dd>
                    {moduleLabel(detail.category)}
                    {detail.category ? ` (${detail.category})` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--lc-text-muted)]">Meter unit</dt>
                  <dd>{detail.meter_unit || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--lc-text-muted)]">Credits per unit</dt>
                  <dd>
                    <Numeric>{detail.credits_per_unit ?? '—'}</Numeric>
                  </dd>
                </div>
              </dl>

              <div>
                <Label htmlFor="feature-display-name">Display name</Label>
                <Input
                  id="feature-display-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <label className="flex min-h-tap items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                Active in registry
              </label>

              <div>
                <Label htmlFor="feature-edit-reason">Reason (required)</Label>
                <Input
                  id="feature-edit-reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Why is this registry change needed?"
                  className="mt-1"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetail(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || detailLoading} onClick={() => void saveDetail()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a metered feature</DialogTitle>
          </DialogHeader>
          <div className="flex gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lc-status-warning)]" aria-hidden="true" />
            <div className="space-y-2 text-sm">
              <p>
                Launching a new metered feature is a code and database event — not a self-service registry write.
              </p>
              <p className="text-[var(--lc-text-muted)]">
                Ship a migration seeding <span className="font-mono">public.metered_features</span>, wire the feature
                call site, then return here to verify quotas in package versions.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Close
            </Button>
            <Button type="button" asChild>
              <Link to="/admin/fin/packages">Open package editor</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PackageConsoleFrame>
  )
}

export default FeatureRegistryPage
