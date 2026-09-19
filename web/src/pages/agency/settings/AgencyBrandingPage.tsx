import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ImageUp,
  Loader2,
  Palette,
  RefreshCcw,
  Save,
  Upload,
} from 'lucide-react'
import { api } from '@/api/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import { readLcColor } from '@/theme/css'
import type {
  AgencyBrandFont,
  AgencyBranding,
  AgencyBrandingUpdate,
} from '@/types/agencyBranding'

type AssetKind = 'logo' | 'favicon'

interface AgencySummary {
  id: string
  name: string
}

const COLOR_PATTERN = /^#[\da-fA-F]{6}$/
const MAX_ASSET_BYTES = 5 * 1024 * 1024
const FONT_OPTIONS: Array<{ value: AgencyBrandFont; label: string; description: string }> = [
  { value: 'system', label: 'System sans', description: 'Fast, neutral, and native on every device.' },
  { value: 'ibm-plex-sans', label: 'IBM Plex Sans', description: 'Structured and highly readable for property data.' },
  { value: 'archivo', label: 'Archivo', description: 'Bold display character for a confident agency voice.' },
  { value: 'playfair-display', label: 'Playfair Display', description: 'Editorial contrast for luxury positioning.' },
]

function tokenColor(token: `--lc-${string}`) {
  const value = readLcColor(token)
  return COLOR_PATTERN.test(value) ? value : ''
}

function toForm(branding: AgencyBranding): AgencyBrandingUpdate {
  return {
    name: branding.name,
    description: branding.description,
    logo_url: branding.logo_url,
    favicon_url: branding.favicon_url,
    primary_color: branding.primary_color || tokenColor('--lc-action-primary'),
    accent_color: branding.accent_color || tokenColor('--lc-accent'),
    font_family: branding.font_family,
  }
}

export function AgencyBrandingPage() {
  const { agent, loading: authLoading } = useAuth()
  const agentId = agent?.id
  const { addToast } = useToast()
  const [agencyId, setAgencyId] = useState('')
  const [branding, setBranding] = useState<AgencyBranding | null>(null)
  const [form, setForm] = useState<AgencyBrandingUpdate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<AssetKind | null>(null)
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)
  const faviconInput = useRef<HTMLInputElement>(null)
  usePageTitle('Agency identity and branding')

  const load = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    setError('')
    try {
      const agency = await api.getMyAgency() as AgencySummary | null
      if (!agency?.id) {
        setAgencyId('')
        setBranding(null)
        setForm(null)
        return
      }
      setAgencyId(agency.id)
      const response = await api.getAgencyBranding(agency.id)
      setBranding(response.branding)
      setForm(toForm(response.branding))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Brand settings could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(
    () => Boolean(form && branding && JSON.stringify(form) !== JSON.stringify(toForm(branding))),
    [branding, form],
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const updateField = <Key extends keyof AgencyBrandingUpdate>(
    key: Key,
    value: AgencyBrandingUpdate[Key],
  ) => {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  const uploadAsset = async (kind: AssetKind, file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      addToast({ title: 'Choose an image file', description: 'Logo and favicon uploads must be images.', variant: 'error' })
      return
    }
    if (file.size > MAX_ASSET_BYTES) {
      addToast({ title: 'Image is too large', description: 'Use an image no larger than 5 MB.', variant: 'error' })
      return
    }
    setUploading(kind)
    try {
      const response = await api.uploadMedia([file])
      const url = response.items[0]?.url
      if (!url) throw new Error('Upload returned no image URL')
      updateField(kind === 'logo' ? 'logo_url' : 'favicon_url', url)
      addToast({
        title: kind === 'logo' ? 'Logo uploaded' : 'Favicon uploaded',
        description: 'Save changes to publish this asset across agency surfaces.',
        variant: 'success',
      })
    } catch (uploadError) {
      addToast({
        title: 'Upload failed',
        description: uploadError instanceof Error ? uploadError.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setUploading(null)
      if (kind === 'logo' && logoInput.current) logoInput.current.value = ''
      if (kind === 'favicon' && faviconInput.current) faviconInput.current.value = ''
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form || !agencyId) return
    if (!COLOR_PATTERN.test(form.primary_color) || !COLOR_PATTERN.test(form.accent_color)) {
      addToast({
        title: 'Enter valid brand colors',
        description: 'Use six-digit color values for both primary and accent colors.',
        variant: 'error',
      })
      return
    }
    setSaving(true)
    try {
      const response = await api.updateAgencyBranding(agencyId, form)
      setBranding(response.branding)
      setForm(toForm(response.branding))
      addToast({
        title: 'Agency brand published',
        description: 'Identity changes are now available to public sites and widgets.',
        variant: 'success',
      })
    } catch (saveError) {
      addToast({
        title: 'Brand settings not saved',
        description: saveError instanceof Error ? saveError.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const resetBrand = async () => {
    if (!agencyId) return
    setSaving(true)
    try {
      const response = await api.resetAgencyBranding(agencyId)
      setBranding(response.branding)
      setForm(toForm(response.branding))
      setResetOpen(false)
      addToast({
        title: 'Visual brand reset',
        description: 'Agency name and description were preserved.',
        variant: 'success',
      })
    } catch (resetError) {
      addToast({
        title: 'Brand could not be reset',
        description: resetError instanceof Error ? resetError.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading agency branding</span>
      </main>
    )
  }

  if (!agent) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">Sign in to manage agency branding</h1>
        <Button asChild className="mt-5">
          <Link to="/login?returnTo=%2Fagency%2Fsettings%2Fbranding">Sign in</Link>
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
              <h1 className="font-semibold">Brand settings unavailable</h1>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button type="button" onClick={() => void load()}>Try again</Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!agencyId || !form || !branding) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">No active agency</h1>
        <p className="mt-2 text-muted-foreground">Join or create an agency before configuring its identity.</p>
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
              to="/agency/settings"
              className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              Agency settings
            </Link>
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">Identity and branding</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Set the agency identity shared by your public profile, white-label site, and embedded widgets.
            </p>
          </div>
          <Badge variant={dirty ? 'secondary' : 'outline'}>
            {dirty ? '● Unsaved changes' : '○ All changes saved'}
          </Badge>
        </header>

        <form onSubmit={save} className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agency identity</CardTitle>
                <CardDescription>Public-facing name and agency description.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agency-brand-name">Agency name</Label>
                  <Input
                    id="agency-brand-name"
                    value={form.name}
                    maxLength={120}
                    onChange={(event) => updateField('name', event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="agency-brand-description">Description</Label>
                    <Numeric className="text-xs text-muted-foreground">{form.description.length.toLocaleString()} / 2,000</Numeric>
                  </div>
                  <textarea
                    id="agency-brand-description"
                    value={form.description}
                    maxLength={2000}
                    rows={6}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    onChange={(event) => updateField('description', event.target.value)}
                    placeholder="Describe your markets, specialties, and client promise."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Brand assets</CardTitle>
                <CardDescription>Upload image assets up to <Numeric>5 MB</Numeric>. Transparent files work best.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <AssetUploader
                  kind="logo"
                  label="Agency logo"
                  description="Recommended: wide logo with transparent background."
                  value={form.logo_url}
                  inputRef={logoInput}
                  uploading={uploading === 'logo'}
                  onUpload={(file) => void uploadAsset('logo', file)}
                  onRemove={() => updateField('logo_url', null)}
                />
                <AssetUploader
                  kind="favicon"
                  label="Favicon"
                  description="Recommended: square icon for browser tabs."
                  value={form.favicon_url}
                  inputRef={faviconInput}
                  uploading={uploading === 'favicon'}
                  onUpload={(file) => void uploadAsset('favicon', file)}
                  onRemove={() => updateField('favicon_url', null)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colors and typography</CardTitle>
                <CardDescription>Use six-digit color values and a curated brand font.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    id="agency-primary-color"
                    label="Primary color"
                    value={form.primary_color}
                    fallbackToken="--lc-action-primary"
                    onChange={(value) => updateField('primary_color', value)}
                  />
                  <ColorField
                    id="agency-accent-color"
                    label="Accent color"
                    value={form.accent_color}
                    fallbackToken="--lc-accent"
                    onChange={(value) => updateField('accent_color', value)}
                  />
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">Brand font</legend>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {FONT_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex min-h-11 cursor-pointer gap-3 rounded-md border bg-[var(--lc-surface-raised)] p-3"
                      >
                        <input
                          type="radio"
                          name="agency-brand-font"
                          value={option.value}
                          checked={form.font_family === option.value}
                          onChange={() => updateField('font_family', option.value)}
                        />
                        <span>
                          <span className="block font-medium">{option.label}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </CardContent>
            </Card>

            <div className="sticky bottom-0 z-sticky flex flex-col-reverse gap-2 border-t bg-[var(--lc-bg-page)] py-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setResetOpen(true)} disabled={saving || uploading !== null}>
                <RefreshCcw className="me-2 h-4 w-4" aria-hidden="true" />
                Reset visual brand
              </Button>
              <Button type="submit" disabled={!dirty || saving || uploading !== null || form.name.trim().length < 2}>
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="me-2 h-4 w-4" aria-hidden="true" />}
                Save changes
              </Button>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <BrandPreview form={form} updatedAt={branding.updated_at} />
          </aside>
        </form>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset visual brand?</DialogTitle>
            <DialogDescription>
              Logo, favicon, colors, and font will return to WingCaster defaults. Agency name and description stay unchanged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setResetOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => void resetBrand()} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Reset visual brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function AssetUploader({
  kind,
  label,
  description,
  value,
  inputRef,
  uploading,
  onUpload,
  onRemove,
}: {
  kind: AssetKind
  label: string
  description: string
  value: string | null
  inputRef: React.RefObject<HTMLInputElement>
  uploading: boolean
  onUpload: (file?: File) => void
  onRemove: () => void
}) {
  return (
    <section className="rounded-md border bg-[var(--lc-surface-sunken)] p-4">
      <div className="flex items-center gap-3">
        <Avatar className={kind === 'favicon' ? 'h-12 w-12' : 'h-16 w-16'}>
          <AvatarImage src={value || undefined} alt="" className="object-contain" />
          <AvatarFallback><ImageUp className="h-5 w-5" aria-hidden="true" /></AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-medium">{label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
        className="sr-only"
        aria-label={`Choose ${label.toLowerCase()}`}
        onChange={(event) => onUpload(event.target.files?.[0])}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="me-2 h-4 w-4" aria-hidden="true" />}
          {value ? 'Replace' : 'Upload'}
        </Button>
        {value && <Button type="button" variant="ghost" onClick={onRemove}>Remove</Button>}
      </div>
    </section>
  )
}

function ColorField({
  id,
  label,
  value,
  fallbackToken,
  onChange,
}: {
  id: string
  label: string
  value: string
  fallbackToken: '--lc-action-primary' | '--lc-accent'
  onChange: (value: string) => void
}) {
  const pickerValue = COLOR_PATTERN.test(value) ? value : tokenColor(fallbackToken)
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          aria-label={`${label} picker`}
          type="color"
          value={pickerValue}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-11 w-14 rounded-md border border-input bg-background p-1"
        />
        <Input
          id={id}
          value={value}
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(value) && !COLOR_PATTERN.test(value)}
          className="lc-data uppercase"
        />
      </div>
      {value && !COLOR_PATTERN.test(value) && (
        <p className="text-xs text-destructive">Enter a six-digit color value.</p>
      )}
    </div>
  )
}

function BrandPreview({ form, updatedAt }: { form: AgencyBrandingUpdate; updatedAt: string | null }) {
  const selectedFont = FONT_OPTIONS.find((option) => option.value === form.font_family)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" aria-hidden="true" />
          Live preview
        </CardTitle>
        <CardDescription>Representative public-profile header.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="overflow-hidden rounded-lg border bg-[var(--lc-surface-raised)]"
          style={{ fontFamily: previewFont(form.font_family) }}
        >
          <div className="h-3" style={{ backgroundColor: form.primary_color || 'var(--lc-action-primary)' }} />
          <div className="p-5">
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="h-14 w-14 rounded-md border object-contain" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-[var(--lc-surface-sunken)]">
                  <Building2 className="h-6 w-6" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{form.name || 'Agency name'}</h2>
                <span
                  className="mt-1 inline-flex rounded-full border px-2 py-1 text-xs"
                  style={{ borderColor: form.accent_color || 'var(--lc-accent)', color: form.accent_color || 'var(--lc-accent)' }}
                >
                  Verified agency
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {form.description || 'Your agency description will appear here.'}
            </p>
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Font</dt>
            <dd>{selectedFont?.label || 'System sans'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Last published</dt>
            <Numeric as="dd">{updatedAt ? new Date(updatedAt).toLocaleString() : 'Not published yet'}</Numeric>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function previewFont(font: AgencyBrandFont) {
  if (font === 'archivo') return 'var(--lc-font-display)'
  if (font === 'playfair-display') return 'Playfair Display, serif'
  return 'var(--lc-font-ui)'
}
