import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ExternalLink,
  Eye,
  Loader2,
  Save,
  Settings2,
  Users,
} from 'lucide-react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import type {
  AgencyPublicProfileSettings,
  AgencyPublicProfileUpdate,
} from '@/types/agencyPublicProfile'

interface AgencySummary {
  id: string
  name: string
}

const VISIBILITY_OPTIONS: Array<{
  key: keyof Pick<
    AgencyPublicProfileUpdate,
    'show_team' | 'show_listings' | 'show_reviews' | 'show_closed_transactions' | 'show_contact_form'
  >
  label: string
  description: string
}> = [
  { key: 'show_team', label: 'Team', description: 'Show active agency members and links to their profiles.' },
  { key: 'show_listings', label: 'Listings', description: 'Show active agency inventory on the public profile.' },
  { key: 'show_reviews', label: 'Reviews', description: 'Show approved reviews from the agency team.' },
  { key: 'show_closed_transactions', label: 'Closed transactions', description: 'Show recent completed transaction activity without private deal values.' },
  { key: 'show_contact_form', label: 'Contact form', description: 'Allow visitors to send a new inquiry to the agency.' },
]

function editable(settings: AgencyPublicProfileSettings): AgencyPublicProfileUpdate {
  return {
    show_team: settings.show_team,
    show_listings: settings.show_listings,
    show_reviews: settings.show_reviews,
    show_closed_transactions: settings.show_closed_transactions,
    show_contact_form: settings.show_contact_form,
    hero_title: settings.hero_title,
    hero_body: settings.hero_body,
    meta_description: settings.meta_description,
  }
}

export function AgencyPublicProfileSettingsPage() {
  const { agent, loading: authLoading } = useAuth()
  const agentId = agent?.id
  const { addToast } = useToast()
  const [agency, setAgency] = useState<AgencySummary | null>(null)
  const [settings, setSettings] = useState<AgencyPublicProfileSettings | null>(null)
  const [form, setForm] = useState<AgencyPublicProfileUpdate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  usePageTitle('Agency public profile settings')

  const load = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    setError('')
    try {
      const myAgency = await api.getMyAgency() as AgencySummary | null
      setAgency(myAgency)
      if (!myAgency?.id) {
        setSettings(null)
        setForm(null)
        return
      }
      const response = await api.getAgencyPublicProfileSettings(myAgency.id)
      setSettings(response.settings)
      setForm(editable(response.settings))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Public profile settings could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(
    () => Boolean(settings && form && JSON.stringify(editable(settings)) !== JSON.stringify(form)),
    [form, settings],
  )

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!agency?.id || !form) return
    setSaving(true)
    try {
      const response = await api.updateAgencyPublicProfileSettings(agency.id, form)
      setSettings(response.settings)
      setForm(editable(response.settings))
      addToast({
        title: 'Public profile published',
        description: 'Visibility and hero changes are live now.',
        variant: 'success',
      })
    } catch (saveError) {
      addToast({
        title: 'Public profile not saved',
        description: saveError instanceof Error ? saveError.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const preview = () => {
    if (!agency?.id) return
    window.open(`/public/agency/${encodeURIComponent(agency.id)}`, '_blank', 'noopener,noreferrer')
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading public profile settings</span>
      </main>
    )
  }

  if (!agent) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">Sign in to manage the public profile</h1>
        <Button asChild className="mt-5">
          <Link to="/login?returnTo=%2Fagency%2Fpublic-profile">Sign in</Link>
        </Button>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Card role="alert">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
            <div>
              <h1 className="font-semibold">Public profile settings unavailable</h1>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button type="button" onClick={() => void load()}>Try again</Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!agency || !settings || !form) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">No active agency</h1>
        <p className="mt-2 text-muted-foreground">Join or create an agency before publishing a public profile.</p>
        <Button asChild className="mt-5"><Link to="/agency">Agency management</Link></Button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-6 sm:px-6 lg:px-8" dir="auto">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              to="/agency"
              className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              Agency management
            </Link>
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">Public profile settings</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Control the agency story and which proof points visitors can see.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={dirty ? 'secondary' : 'outline'}>{dirty ? '● Unsaved changes' : '○ Published'}</Badge>
            <Button type="button" variant="outline" onClick={preview}>
              <ExternalLink className="me-2 h-4 w-4" aria-hidden="true" />
              Preview
            </Button>
          </div>
        </header>

        <form onSubmit={save} className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile visibility</CardTitle>
                <CardDescription>Choose the public sections that support your agency positioning.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {VISIBILITY_OPTIONS.map((option) => (
                  <label
                    key={option.key}
                    className="flex min-h-11 cursor-pointer items-start justify-between gap-4 rounded-md border bg-[var(--lc-surface-raised)] p-4"
                  >
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{option.description}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-[var(--lc-action-primary)]"
                      checked={form[option.key]}
                      onChange={(event) => setForm((current) => current ? {
                        ...current,
                        [option.key]: event.target.checked,
                      } : current)}
                    />
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hero content</CardTitle>
                <CardDescription>Lead with a specific promise instead of generic agency copy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="profile-hero-title">Hero title</Label>
                    <Numeric className="text-xs text-muted-foreground">{form.hero_title.length.toLocaleString()} / 120</Numeric>
                  </div>
                  <Input
                    id="profile-hero-title"
                    value={form.hero_title}
                    maxLength={120}
                    onChange={(event) => setForm({ ...form, hero_title: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="profile-hero-body">Hero description</Label>
                    <Numeric className="text-xs text-muted-foreground">{form.hero_body.length.toLocaleString()} / 600</Numeric>
                  </div>
                  <textarea
                    id="profile-hero-body"
                    value={form.hero_body}
                    maxLength={600}
                    rows={5}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    onChange={(event) => setForm({ ...form, hero_body: event.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Search appearance</CardTitle>
                <CardDescription>A concise description for search engines and shared links.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="profile-meta-description">Meta description</Label>
                  <Numeric className="text-xs text-muted-foreground">{form.meta_description.length.toLocaleString()} / 160</Numeric>
                </div>
                <textarea
                  id="profile-meta-description"
                  value={form.meta_description}
                  maxLength={160}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  onChange={(event) => setForm({ ...form, meta_description: event.target.value })}
                />
              </CardContent>
            </Card>

            <div className="sticky bottom-0 z-sticky flex justify-end border-t bg-[var(--lc-bg-page)] py-4">
              <Button type="submit" disabled={!dirty || saving || !form.hero_title.trim()}>
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="me-2 h-4 w-4" aria-hidden="true" />}
                Save and publish
              </Button>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" aria-hidden="true" />
                  Profile preview
                </CardTitle>
                <CardDescription>Updates as you edit.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border bg-[var(--lc-surface-raised)]">
                  <div className="bg-[var(--lc-action-primary)] p-5 text-[var(--lc-action-primary-text)]">
                    <Building2 className="h-8 w-8" aria-hidden="true" />
                    <h2 className="mt-4 text-xl font-bold">{form.hero_title || agency.name}</h2>
                    <p className="mt-2 text-sm">{form.hero_body || 'Agency profile description'}</p>
                  </div>
                  <div className="space-y-3 p-4">
                    {VISIBILITY_OPTIONS.map((option) => (
                      <div key={option.key} className="flex items-center justify-between gap-3 text-sm">
                        <span>{option.label}</span>
                        <Badge variant={form[option.key] ? 'default' : 'outline'}>
                          {form[option.key] ? '● Visible' : '○ Hidden'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                  <Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>Changes affect the public agency page immediately after publish.</p>
                </div>
                {form.show_team && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Active team members only
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </form>
      </div>
    </main>
  )
}
