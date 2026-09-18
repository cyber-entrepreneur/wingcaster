/**
 * AGN-WLB-003 — White-label copy fields editor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBeforeUnload } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Eye, Loader2, Save, Send } from 'lucide-react'
import { api, type AgencySiteCopyFields, type AgencySiteConfig } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

const FEATURED_FILTERS = [
  { value: 'all', label: 'All listings' },
  { value: 'by_area', label: 'By area' },
  { value: 'by_property_type', label: 'By property type' },
  { value: 'by_price_range', label: 'By price range' },
]

const FEATURED_SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_viewed', label: 'Most viewed' },
  { value: 'manual', label: 'Manual order' },
]

function emptyCopyFields(): AgencySiteCopyFields {
  return {
    header: { tagline: '' },
    about: { paragraph: '', mission: '' },
    featured_listings: {
      filter: 'all',
      area: '',
      property_type: '',
      price_min: null,
      price_max: null,
      sort: 'newest',
    },
    team: { intro: '' },
    contact: { phone: '', email: '', address: '', hours: '' },
    footer: { disclaimer: '' },
  }
}

export function AgencyWhiteLabelCopyPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('White-label copy')

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [agencyName, setAgencyName] = useState('')
  const [config, setConfig] = useState<AgencySiteConfig | null>(null)
  const [copyFields, setCopyFields] = useState<AgencySiteCopyFields>(emptyCopyFields())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const role = (agent?.affiliation as { role?: string } | undefined)?.role
  const isAdmin = role === 'owner' || role === 'admin'

  const previewSnippet = useMemo(() => ({
    header: copyFields.header.tagline || `${agencyName || 'Your agency'} — find your next home`,
    about: copyFields.about.paragraph || 'Tell visitors what makes your agency different.',
    mission: copyFields.about.mission || 'Your mission statement appears here.',
    team: copyFields.team.intro || 'Meet the team behind your listings.',
    contact: [
      copyFields.contact.phone,
      copyFields.contact.email,
      copyFields.contact.address,
      copyFields.contact.hours,
    ].filter(Boolean).join(' · ') || 'Add contact details for your public site.',
    footer: copyFields.footer.disclaimer || 'Legal disclaimer and licensing notes.',
    featured: `${FEATURED_FILTERS.find((item) => item.value === copyFields.featured_listings.filter)?.label || 'All listings'} · sorted by ${FEATURED_SORTS.find((item) => item.value === copyFields.featured_listings.sort)?.label || 'newest'}`,
  }), [agencyName, copyFields])

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const res = await api.getAgencyWhiteLabelCopy()
      setConfig(res.config)
      setAgencyName(res.agency_name)
      setCopyFields(res.config.copy_fields)
      setDirty(false)
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({ title: 'Could not load copy fields', description: (err as Error).message, variant: 'error' })
    }
  }, [addToast, isAdmin])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  useBeforeUnload(useCallback((event) => {
    if (!dirty) return
    event.preventDefault()
    event.returnValue = ''
  }, [dirty]))

  const persist = useCallback(async (silent = false) => {
    setSaving(true)
    try {
      const res = await api.updateAgencyWhiteLabelCopy({ copy_fields: copyFields })
      setConfig(res.config)
      setDirty(false)
      if (!silent) addToast({ title: 'Copy saved', variant: 'success' })
    } catch (err) {
      addToast({ title: 'Save failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [addToast, copyFields])

  useEffect(() => {
    if (!dirty || loadState !== 'ready') return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persist(true)
    }, 1200)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [copyFields, dirty, loadState, persist])

  function updateSection<K extends keyof AgencySiteCopyFields>(
    section: K,
    patch: Partial<AgencySiteCopyFields[K]>,
  ) {
    setCopyFields((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...patch },
    }))
    setDirty(true)
  }

  async function publish() {
    setPublishing(true)
    try {
      if (dirty) await persist(true)
      const res = await api.publishAgencyWhiteLabelCopy()
      setConfig(res.config)
      addToast({ title: 'Site copy published', variant: 'success' })
    } catch (err) {
      addToast({ title: 'Publish failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setPublishing(false)
    }
  }

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-screen="AGN-WLB-003" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
      </div>
    )
  }

  if (!agent || loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-WLB-003" dir={dir}>
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold">Admin access required</h1>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-WLB-003" dir={dir}>
        <h1 className="text-2xl font-bold">Could not load copy editor</h1>
        <Button className="mt-4" onClick={() => void load()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]" data-screen="AGN-WLB-003" dir={dir}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to="/white-label" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]">
              <ArrowLeft className="h-4 w-4" />
              White-label site
            </Link>
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">Copy fields</h1>
            <p className="text-[var(--lc-text-muted)]">Edit the text visitors see on your agency site.</p>
            {dirty && <p className="text-sm text-amber-700">Unsaved changes — autosaving…</p>}
            {config?.published_at && (
              <p className="text-sm text-[var(--lc-text-muted)]">
                Last published {new Date(config.published_at).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => document.getElementById('copy-preview')?.scrollIntoView({ behavior: 'smooth' })}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => void persist()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button className="gap-2" onClick={() => void publish()} disabled={publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Header</CardTitle></CardHeader>
            <CardContent>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={copyFields.header.tagline}
                onChange={(e) => updateSection('header', { tagline: e.target.value })}
              />
              <p className="mt-2 rounded-md bg-[var(--lc-surface-sunken)] p-3 text-sm">{previewSnippet.header}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">About</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="about-paragraph">About paragraph</Label>
                <textarea
                  id="about-paragraph"
                  value={copyFields.about.paragraph}
                  onChange={(e) => updateSection('about', { paragraph: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                />
                <p className="mt-2 rounded-md bg-[var(--lc-surface-sunken)] p-3 text-sm">{previewSnippet.about}</p>
              </div>
              <div>
                <Label htmlFor="about-mission">Mission statement</Label>
                <textarea
                  id="about-mission"
                  value={copyFields.about.mission}
                  onChange={(e) => updateSection('about', { mission: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                />
                <p className="mt-2 rounded-md bg-[var(--lc-surface-sunken)] p-3 text-sm">{previewSnippet.mission}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Featured listings rule</CardTitle>
              <CardDescription>Controls which listings appear in the homepage grid.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="featured-filter">Filter</Label>
                <select
                  id="featured-filter"
                  aria-label="Featured listings filter"
                  value={copyFields.featured_listings.filter}
                  onChange={(e) => updateSection('featured_listings', { filter: e.target.value as AgencySiteCopyFields['featured_listings']['filter'] })}
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                >
                  {FEATURED_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              {copyFields.featured_listings.filter === 'by_area' && (
                <div className="sm:col-span-2">
                  <Label htmlFor="featured-area">Area</Label>
                  <Input
                    id="featured-area"
                    value={copyFields.featured_listings.area || ''}
                    onChange={(e) => updateSection('featured_listings', { area: e.target.value })}
                  />
                </div>
              )}
              {copyFields.featured_listings.filter === 'by_property_type' && (
                <div className="sm:col-span-2">
                  <Label htmlFor="featured-type">Property type</Label>
                  <Input
                    id="featured-type"
                    value={copyFields.featured_listings.property_type || ''}
                    onChange={(e) => updateSection('featured_listings', { property_type: e.target.value })}
                  />
                </div>
              )}
              {copyFields.featured_listings.filter === 'by_price_range' && (
                <>
                  <div>
                    <Label htmlFor="featured-min">Min price</Label>
                    <Input
                      id="featured-min"
                      type="number"
                      value={copyFields.featured_listings.price_min ?? ''}
                      onChange={(e) => updateSection('featured_listings', { price_min: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="featured-max">Max price</Label>
                    <Input
                      id="featured-max"
                      type="number"
                      value={copyFields.featured_listings.price_max ?? ''}
                      onChange={(e) => updateSection('featured_listings', { price_max: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Label htmlFor="featured-sort">Sort</Label>
                <select
                  id="featured-sort"
                  aria-label="Featured listings sort"
                  value={copyFields.featured_listings.sort}
                  onChange={(e) => updateSection('featured_listings', { sort: e.target.value as AgencySiteCopyFields['featured_listings']['sort'] })}
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                >
                  {FEATURED_SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <p className="mt-2 rounded-md bg-[var(--lc-surface-sunken)] p-3 text-sm">{previewSnippet.featured}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Team</CardTitle></CardHeader>
            <CardContent>
              <Label htmlFor="team-intro">Team intro</Label>
              <textarea
                id="team-intro"
                value={copyFields.team.intro}
                onChange={(e) => updateSection('team', { intro: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              />
              <p className="mt-2 rounded-md bg-[var(--lc-surface-sunken)] p-3 text-sm">{previewSnippet.team}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="contact-phone">Phone</Label>
                <Input id="contact-phone" value={copyFields.contact.phone} onChange={(e) => updateSection('contact', { phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="contact-email">Email</Label>
                <Input id="contact-email" value={copyFields.contact.email} onChange={(e) => updateSection('contact', { email: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="contact-address">Address</Label>
                <Input id="contact-address" value={copyFields.contact.address} onChange={(e) => updateSection('contact', { address: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="contact-hours">Business hours</Label>
                <Input id="contact-hours" value={copyFields.contact.hours} onChange={(e) => updateSection('contact', { hours: e.target.value })} />
              </div>
              <p className="sm:col-span-2 rounded-md bg-[var(--lc-surface-sunken)] p-3 text-sm">{previewSnippet.contact}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Footer</CardTitle></CardHeader>
            <CardContent>
              <Label htmlFor="footer-disclaimer">Disclaimer</Label>
              <textarea
                id="footer-disclaimer"
                value={copyFields.footer.disclaimer}
                onChange={(e) => updateSection('footer', { disclaimer: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              />
              <p className="mt-2 rounded-md bg-[var(--lc-surface-sunken)] p-3 text-sm">{previewSnippet.footer}</p>
            </CardContent>
          </Card>
        </div>

        <Card id="copy-preview">
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
            <CardDescription>How your homepage copy will read to visitors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <section>
              <h2 className="text-xl font-semibold text-[var(--lc-text-heading)]">{previewSnippet.header}</h2>
            </section>
            <section>
              <h3 className="font-medium text-[var(--lc-text-heading)]">About</h3>
              <p className="text-sm text-[var(--lc-text-primary)]">{previewSnippet.about}</p>
              <p className="mt-2 text-sm text-[var(--lc-text-muted)]">{previewSnippet.mission}</p>
            </section>
            <section>
              <h3 className="font-medium text-[var(--lc-text-heading)]">Featured listings</h3>
              <p className="text-sm text-[var(--lc-text-muted)]">{previewSnippet.featured}</p>
            </section>
            <section>
              <h3 className="font-medium text-[var(--lc-text-heading)]">Team</h3>
              <p className="text-sm text-[var(--lc-text-primary)]">{previewSnippet.team}</p>
            </section>
            <section>
              <h3 className="font-medium text-[var(--lc-text-heading)]">Contact</h3>
              <p className="text-sm text-[var(--lc-text-primary)]">{previewSnippet.contact}</p>
            </section>
            <section>
              <h3 className="font-medium text-[var(--lc-text-heading)]">Footer</h3>
              <p className="text-sm text-[var(--lc-text-muted)]">{previewSnippet.footer}</p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
