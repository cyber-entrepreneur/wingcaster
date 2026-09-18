import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Loader2, Play, Plus, Search, Trash2 } from 'lucide-react'
import {
  api,
  type SavedSearch,
  type SavedSearchAlertChannel,
  type SavedSearchAlertFrequency,
  type SavedSearchInput,
} from '@/api/client'
import { SettingsPaneHeader } from '@/components/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/http-status'
import { formatRelativeTime } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; search: SavedSearch }

const EMPTY_FORM: SavedSearchInput = {
  name: '',
  filters: { city: '', bedrooms: '', minPrice: '', maxPrice: '', property_type: '' },
  alert_enabled: true,
  alert_channel: 'inapp',
  alert_frequency: 'daily',
}

function toForm(search?: SavedSearch): SavedSearchInput {
  if (!search) return { ...EMPTY_FORM, filters: { ...EMPTY_FORM.filters } }
  return {
    name: search.name,
    filters: {
      city: String(search.filters.city || ''),
      bedrooms: search.filters.bedrooms ? String(search.filters.bedrooms) : '',
      minPrice: search.filters.minPrice ? String(search.filters.minPrice) : '',
      maxPrice: search.filters.maxPrice ? String(search.filters.maxPrice) : '',
      property_type: String(search.filters.property_type || search.filters.propertyType || ''),
    },
    alert_enabled: search.alert_enabled,
    alert_channel: search.alert_channel,
    alert_frequency: search.alert_frequency,
  }
}

function toPayload(form: SavedSearchInput): SavedSearchInput {
  const filters: Record<string, unknown> = {}
  if (form.filters?.city) filters.city = String(form.filters.city).trim()
  if (form.filters?.property_type) filters.property_type = String(form.filters.property_type).trim()
  if (form.filters?.bedrooms) filters.bedrooms = Number(form.filters.bedrooms)
  if (form.filters?.minPrice) filters.minPrice = Number(form.filters.minPrice)
  if (form.filters?.maxPrice) filters.maxPrice = Number(form.filters.maxPrice)
  return {
    name: form.name.trim(),
    filters,
    alert_enabled: form.alert_enabled,
    alert_channel: form.alert_channel,
    alert_frequency: form.alert_frequency,
  }
}

export function SavedSearchesPage() {
  usePageTitle('Saved searches')
  const { addToast } = useToast()
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [form, setForm] = useState<SavedSearchInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.getSavedSearches()
      setSearches(response.saved_searches || [])
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load saved searches.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setForm(toForm())
    setEditor({ mode: 'create' })
  }

  function openEdit(search: SavedSearch) {
    setForm(toForm(search))
    setEditor({ mode: 'edit', search })
  }

  async function saveSearch() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const payload = toPayload(form)
      if (editor.mode === 'edit') {
        const updated = await api.updateSavedSearch(editor.search.id, payload)
        setSearches((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
        addToast({ title: 'Saved search updated', variant: 'success' })
      } else {
        const created = await api.createSavedSearchWithAlerts(payload)
        setSearches((prev) => [created, ...prev])
        addToast({ title: 'Saved search created', variant: 'success' })
      }
      setEditor({ mode: 'closed' })
    } catch (err) {
      addToast({
        title: 'Could not save search',
        description: apiErrorMessage(err, 'Please try again.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  async function toggleAlerts(search: SavedSearch) {
    try {
      const updated = await api.updateSavedSearch(search.id, { alert_enabled: !search.alert_enabled })
      setSearches((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
    } catch (err) {
      addToast({
        title: 'Could not update alerts',
        description: apiErrorMessage(err, 'Please try again.'),
        variant: 'error',
      })
    }
  }

  async function deleteSearch(search: SavedSearch) {
    if (!window.confirm(`Delete "${search.name}"?`)) return
    try {
      await api.deleteSavedSearch(search.id)
      setSearches((prev) => prev.filter((row) => row.id !== search.id))
      addToast({ title: 'Saved search deleted', variant: 'success' })
    } catch (err) {
      addToast({
        title: 'Could not delete search',
        description: apiErrorMessage(err, 'Please try again.'),
        variant: 'error',
      })
    }
  }

  async function runNow() {
    if (running) return
    setRunning(true)
    try {
      const result = await api.runSavedSearchAlerts()
      await load()
      addToast({
        title: 'Alert run complete',
        description: `${result.total_matches} matches across ${result.searches_processed} searches.`,
        variant: 'success',
      })
    } catch (err) {
      addToast({
        title: 'Could not run alerts',
        description: apiErrorMessage(err, 'Please try again.'),
        variant: 'error',
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsPaneHeader
        title="Saved searches"
        sub="Audience filters for campaigns and alert-on-new listing matches across agency inventory."
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={runNow} disabled={running || searches.length === 0}>
          {running ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Play className="me-2 h-4 w-4" />}
          Run now
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" />
          Add search
        </Button>
      </div>

      <p className="text-sm text-[var(--lc-text-muted)]">
        Use these filters as campaign audiences or alert triggers.{' '}
        <Link to="/campaigns" className="text-[var(--lc-text-brand)] hover:underline">Back to campaigns</Link>
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : searches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Search className="h-8 w-8 text-[var(--lc-text-muted)]" />
            <div>
              <p className="font-medium text-[var(--lc-text-primary)]">No saved searches yet</p>
              <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
                Save a filter once and reuse it for nurture campaigns or seller alerts.
              </p>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              Create your first search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {searches.map((search) => (
            <Card key={search.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--lc-text-primary)]">{search.name}</p>
                  <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
                    {search.filter_summary || 'All listings'}
                  </p>
                  <p className="mt-2 text-xs text-[var(--lc-text-muted)]">
                    Last run {search.last_alert_run_at ? formatRelativeTime(search.last_alert_run_at) : 'never'}
                    {' · '}
                    <Numeric>{search.last_match_count}</Numeric> matches
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAlerts(search)}
                    aria-pressed={search.alert_enabled}
                  >
                    <Bell className="me-1 h-4 w-4" />
                    {search.alert_enabled ? 'Alerts on' : 'Alerts off'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(search)}>
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteSearch(search)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editor.mode !== 'closed' && (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <h2 className="text-lg font-semibold">
              {editor.mode === 'edit' ? 'Edit saved search' : 'New saved search'}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="saved-search-name">Name</Label>
                <Input
                  id="saved-search-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Marina 2-bed buyers"
                />
              </div>
              <div>
                <Label htmlFor="saved-search-city">City contains</Label>
                <Input
                  id="saved-search-city"
                  value={String(form.filters?.city || '')}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    filters: { ...prev.filters, city: event.target.value },
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="saved-search-type">Property type</Label>
                <Input
                  id="saved-search-type"
                  value={String(form.filters?.property_type || '')}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    filters: { ...prev.filters, property_type: event.target.value },
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="saved-search-bedrooms">Minimum bedrooms</Label>
                <Input
                  id="saved-search-bedrooms"
                  type="number"
                  min={0}
                  value={String(form.filters?.bedrooms || '')}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    filters: { ...prev.filters, bedrooms: event.target.value },
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="saved-search-min">Min price</Label>
                <Input
                  id="saved-search-min"
                  type="number"
                  min={0}
                  value={String(form.filters?.minPrice || '')}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    filters: { ...prev.filters, minPrice: event.target.value },
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="saved-search-max">Max price</Label>
                <Input
                  id="saved-search-max"
                  type="number"
                  min={0}
                  value={String(form.filters?.maxPrice || '')}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    filters: { ...prev.filters, maxPrice: event.target.value },
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="saved-search-channel">Alert channel</Label>
                <select
                  id="saved-search-channel"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.alert_channel}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    alert_channel: event.target.value as SavedSearchAlertChannel,
                  }))}
                >
                  <option value="inapp">In-app</option>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div>
                <Label htmlFor="saved-search-frequency">Alert frequency</Label>
                <select
                  id="saved-search-frequency"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.alert_frequency}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    alert_frequency: event.target.value as SavedSearchAlertFrequency,
                  }))}
                >
                  <option value="instant">Instant</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.alert_enabled)}
                onChange={(event) => setForm((prev) => ({ ...prev, alert_enabled: event.target.checked }))}
              />
              Alert me when new listings match
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveSearch} disabled={saving || !form.name.trim()}>
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
              <Button variant="outline" onClick={() => setEditor({ mode: 'closed' })}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
