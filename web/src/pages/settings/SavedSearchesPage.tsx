import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  BellOff,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import {
  api,
  type SavedSearch,
  type SavedSearchAlertChannel,
  type SavedSearchAlertFrequency,
  type SavedSearchInput,
} from '@/api/client'
import { SettingsPaneHeader } from '@/components/settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { formatRelativeTime } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'

type LoadState = 'loading' | 'ready' | 'error'

const LISTING_TYPES = [
  { value: '', label: 'Any type' },
  { value: 'sale', label: 'For sale' },
  { value: 'rent', label: 'For rent' },
]

const ALERT_CHANNELS: Array<{ value: SavedSearchAlertChannel; label: string }> = [
  { value: 'inapp', label: 'In-app' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const ALERT_FREQUENCIES: Array<{ value: SavedSearchAlertFrequency; label: string }> = [
  { value: 'instant', label: 'Instant' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

function summarizeFilters(filters: Record<string, unknown> | null | undefined): string {
  const f = filters || {}
  const parts: string[] = []
  if (f.type) parts.push(String(f.type))
  if (f.city) parts.push(String(f.city))
  if (f.minPrice || f.maxPrice) {
    const min = f.minPrice ? `from ${f.minPrice}` : ''
    const max = f.maxPrice ? `to ${f.maxPrice}` : ''
    parts.push([min, max].filter(Boolean).join(' '))
  }
  if (f.bedrooms) parts.push(`${f.bedrooms}+ beds`)
  return parts.length > 0 ? parts.join(' · ') : 'All listings'
}

function emptyForm(): SavedSearchInput {
  return {
    name: '',
    filters: {},
    alert_enabled: true,
    alert_channel: 'inapp',
    alert_frequency: 'daily',
  }
}

export function SavedSearchesPage() {
  const { addToast } = useToast()
  usePageTitle('Saved searches')

  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SavedSearch | null>(null)
  const [form, setForm] = useState<SavedSearchInput>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [runningAlerts, setRunningAlerts] = useState(false)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const rows = await api.getSavedSearches()
      setSearches(rows)
      setLoadState('ready')
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not load saved searches',
        description: err instanceof Error ? err.message : undefined,
      })
      setLoadState('error')
    }
  }, [addToast])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(row: SavedSearch) {
    setEditing(row)
    setForm({
      name: row.name,
      filters: row.filters || {},
      alert_enabled: row.alert_enabled,
      alert_channel: row.alert_channel,
      alert_frequency: row.alert_frequency,
    })
    setDialogOpen(true)
  }

  async function submitForm() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload: SavedSearchInput = {
        ...form,
        name: form.name.trim(),
        filters: {
          ...(form.filters?.type ? { type: form.filters.type } : {}),
          ...(form.filters?.city ? { city: String(form.filters.city).trim() } : {}),
          ...(form.filters?.minPrice ? { minPrice: Number(form.filters.minPrice) } : {}),
          ...(form.filters?.maxPrice ? { maxPrice: Number(form.filters.maxPrice) } : {}),
          ...(form.filters?.bedrooms ? { bedrooms: Number(form.filters.bedrooms) } : {}),
        },
      }
      if (editing) {
        const updated = await api.updateSavedSearch(editing.id, payload)
        setSearches((prev) => prev.map((s) => (s.id === editing.id ? updated : s)))
        addToast({ variant: 'success', title: 'Saved search updated' })
      } else {
        const created = await api.createSavedSearchWithAlerts(payload)
        setSearches((prev) => [created, ...prev])
        addToast({ variant: 'success', title: 'Saved search created' })
      }
      setDialogOpen(false)
    } catch (err) {
      addToast({
        variant: 'error',
        title: editing ? 'Could not update saved search' : 'Could not create saved search',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  async function toggleAlert(row: SavedSearch) {
    setBusyId(row.id)
    try {
      const updated = await api.updateSavedSearch(row.id, { alert_enabled: !row.alert_enabled })
      setSearches((prev) => prev.map((s) => (s.id === row.id ? updated : s)))
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not update alert setting',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  async function deleteSearch(id: string) {
    if (!confirm('Delete this saved search?')) return
    setBusyId(id)
    try {
      await api.deleteSavedSearch(id)
      setSearches((prev) => prev.filter((s) => s.id !== id))
      addToast({ variant: 'success', title: 'Saved search deleted' })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not delete saved search',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  async function runAlertsNow() {
    setRunningAlerts(true)
    try {
      const result = await api.runSavedSearchAlerts()
      await load()
      addToast({
        variant: 'success',
        title: 'Alert run complete',
        description: `Processed ${result.searches_processed} search${result.searches_processed === 1 ? '' : 'es'} · ${result.total_matches} match${result.total_matches === 1 ? '' : 'es'}`,
      })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not run alerts',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setRunningAlerts(false)
    }
  }

  return (
    <div>
      <SettingsPaneHeader
        title="Saved searches"
        sub="Filter presets for campaign audiences and new-listing alerts across agency inventory."
      />

      <div className="mb-[var(--lc-space-lg)] flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={runningAlerts || loadState !== 'ready'}
          onClick={() => void runAlertsNow()}
        >
          {runningAlerts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run now
        </Button>
        <Button type="button" size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add search
        </Button>
      </div>

      {loadState === 'loading' ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" aria-label="Loading" />
        </div>
      ) : loadState === 'error' ? (
        <div className="rounded-[var(--lc-radius-lg)] border border-red-200 bg-red-50 p-[var(--lc-space-lg)]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" aria-hidden />
            <div>
              <p className="text-red-800" style={{ font: 'var(--lc-type-body-strong)' }}>
                Could not load saved searches
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      ) : searches.length === 0 ? (
        <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] text-center">
          <Search className="mx-auto h-8 w-8 text-[var(--lc-text-muted)]" aria-hidden />
          <p className="mt-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
            No saved searches yet
          </p>
          <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
            Save filter presets to reuse as campaign audiences and get notified when new listings match.
          </p>
          <Button type="button" size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add your first search
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--lc-border)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
          {searches.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 p-[var(--lc-space-lg)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-body-strong)' }}>
                    {row.name}
                  </span>
                  {row.alert_enabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] text-green-700">
                      <Bell className="h-3 w-3" aria-hidden />
                      Alerts on
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                      <BellOff className="h-3 w-3" aria-hidden />
                      Alerts off
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                  {summarizeFilters(row.filters)}
                </p>
                <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                  Last run{' '}
                  {row.last_alert_run_at ? formatRelativeTime(row.last_alert_run_at) : 'never'}
                  {' · '}
                  <Numeric>{row.last_match_count ?? 0}</Numeric> matches
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => void toggleAlert(row)}
                  title={row.alert_enabled ? 'Disable alerts' : 'Enable alerts'}
                >
                  {row.alert_enabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => void deleteSearch(row.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit saved search' : 'Add saved search'}</DialogTitle>
            <DialogDescription>
              Filters match listings in agency-wide inventory. Alerts fire when new listings appear.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="ss-name">Name</Label>
              <Input
                id="ss-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Beirut buyers under 500k"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ss-type">Listing type</Label>
                <select
                  id="ss-type"
                  className="mt-1 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  value={String(form.filters?.type || '')}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      filters: { ...prev.filters, type: e.target.value || undefined },
                    }))
                  }
                >
                  {LISTING_TYPES.map((opt) => (
                    <option key={opt.value || 'any'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="ss-city">City</Label>
                <Input
                  id="ss-city"
                  value={String(form.filters?.city || '')}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      filters: { ...prev.filters, city: e.target.value || undefined },
                    }))
                  }
                  placeholder="Beirut"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="ss-min-price">Min price</Label>
                <Input
                  id="ss-min-price"
                  type="number"
                  min={0}
                  value={form.filters?.minPrice != null ? String(form.filters.minPrice) : ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      filters: {
                        ...prev.filters,
                        minPrice: e.target.value ? Number(e.target.value) : undefined,
                      },
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="ss-max-price">Max price</Label>
                <Input
                  id="ss-max-price"
                  type="number"
                  min={0}
                  value={form.filters?.maxPrice != null ? String(form.filters.maxPrice) : ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      filters: {
                        ...prev.filters,
                        maxPrice: e.target.value ? Number(e.target.value) : undefined,
                      },
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="ss-bedrooms">Min bedrooms</Label>
                <Input
                  id="ss-bedrooms"
                  type="number"
                  min={0}
                  value={form.filters?.bedrooms != null ? String(form.filters.bedrooms) : ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      filters: {
                        ...prev.filters,
                        bedrooms: e.target.value ? Number(e.target.value) : undefined,
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-2 sm:col-span-3">
                <input
                  id="ss-alert-enabled"
                  type="checkbox"
                  checked={form.alert_enabled ?? true}
                  onChange={(e) => setForm((prev) => ({ ...prev, alert_enabled: e.target.checked }))}
                />
                <Label htmlFor="ss-alert-enabled">Alert on new matches</Label>
              </div>
              <div>
                <Label htmlFor="ss-channel">Alert channel</Label>
                <select
                  id="ss-channel"
                  className="mt-1 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  value={form.alert_channel || 'inapp'}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      alert_channel: e.target.value as SavedSearchAlertChannel,
                    }))
                  }
                >
                  {ALERT_CHANNELS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="ss-frequency">Alert frequency</Label>
                <select
                  id="ss-frequency"
                  className="mt-1 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  value={form.alert_frequency || 'daily'}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      alert_frequency: e.target.value as SavedSearchAlertFrequency,
                    }))
                  }
                >
                  {ALERT_FREQUENCIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !form.name.trim()} onClick={() => void submitForm()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Save changes' : 'Create search'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
