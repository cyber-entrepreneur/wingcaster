/**
 * AGN-TPL-002 — Agency template editor.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Eye, Loader2, Save, Send, Trash2 } from 'lucide-react'
import { api, type AgencyMessageTemplate } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
]

const CATEGORIES = [
  { value: 'greeting', label: 'Greeting' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'general', label: 'General' },
]

const AGENCY_VARIABLES = [
  'agency_name',
  'agency_logo_url',
  'primary_color',
  'client_name',
  'agent_name',
  'property_title',
  'property_address',
  'viewing_date',
  'price',
]

function emptyForm(): Partial<AgencyMessageTemplate> {
  return {
    name: '',
    channel: 'whatsapp',
    category: 'general',
    subject: null,
    body: '',
    language: 'en',
    approval_status: 'draft',
  }
}

export function AgencyTemplateEditorPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const isNew = templateId === 'new'
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle(isNew ? 'New agency template' : 'Edit agency template')

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [form, setForm] = useState<Partial<AgencyMessageTemplate>>(emptyForm())
  const [preview, setPreview] = useState<{ body: string; subject: string | null; missing_variables: string[] } | null>(null)
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({
    agency_name: 'Elite Realty',
    agency_logo_url: 'https://example.com/logo.png',
    primary_color: '#1d4ed8',
    client_name: 'Sara Ahmed',
    agent_name: agent?.name || 'Agent',
    property_title: 'Marina apartment',
    property_address: 'Dubai Marina',
    viewing_date: new Date().toLocaleString(),
    price: 'AED 1,200,000',
  })

  const role = (agent?.affiliation as { role?: string } | undefined)?.role
  const isAdmin = role === 'owner' || role === 'admin'

  const derivedVariables = useMemo(() => {
    const text = [form.body || '', form.channel === 'email' ? form.subject || '' : ''].join('\n')
    const matches = text.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g) || []
    return Array.from(new Set(matches.map((match) => match.replace(/\{\{\s*|\s*\}\}/g, ''))))
  }, [form.body, form.subject, form.channel])

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoadState('forbidden')
      return
    }
    if (isNew) {
      setForm(emptyForm())
      setLoadState('ready')
      return
    }
    setLoadState('loading')
    try {
      const [template, agency] = await Promise.all([
        api.getAgencyMessageTemplate(templateId!),
        api.getMyAgency().catch(() => null),
      ])
      setForm(template)
      const agencyName = (agency as { name?: string } | null)?.name
      if (agencyName) {
        setPreviewVariables((prev) => ({ ...prev, agency_name: agencyName }))
      }
      setDirty(false)
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({ title: 'Could not load template', description: (err as Error).message, variant: 'error' })
    }
  }, [addToast, isAdmin, isNew, templateId])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  function updateField<K extends keyof AgencyMessageTemplate>(key: K, value: AgencyMessageTemplate[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
    setPreview(null)
  }

  async function saveDraft() {
    if (!form.name?.trim() || !form.body?.trim()) {
      addToast({ title: 'Name and body are required', variant: 'error' })
      return
    }
    if (form.channel === 'email' && !form.subject?.trim()) {
      addToast({ title: 'Email templates require a subject', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<AgencyMessageTemplate> = {
        name: form.name.trim(),
        channel: form.channel,
        category: form.category,
        subject: form.channel === 'email' ? form.subject : null,
        body: form.body.trim(),
        language: form.language,
        approval_status: 'draft',
      }
      if (isNew) {
        const created = await api.createAgencyMessageTemplate(payload)
        addToast({ title: 'Draft saved', variant: 'success' })
        navigate(`/agency/templates/${created.id}`)
      } else {
        const updated = await api.updateAgencyMessageTemplate(templateId!, payload)
        setForm(updated)
        setDirty(false)
        addToast({ title: 'Draft saved', variant: 'success' })
      }
    } catch (err) {
      addToast({ title: 'Save failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (isNew) {
      await saveDraft()
      return
    }
    setPublishing(true)
    try {
      if (dirty) await saveDraft()
      const published = await api.publishAgencyMessageTemplate(templateId!)
      setForm(published)
      addToast({ title: 'Template published to agents', variant: 'success' })
    } catch (err) {
      addToast({ title: 'Publish failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setPublishing(false)
    }
  }

  async function sendTest() {
    if (isNew || !templateId) {
      addToast({ title: 'Save the draft before sending a test', variant: 'error' })
      return
    }
    setTesting(true)
    try {
      const rendered = await api.renderAgencyMessageTemplate(templateId, previewVariables)
      setPreview(rendered)
      addToast({ title: 'Test preview ready', variant: 'success' })
    } catch (err) {
      addToast({ title: 'Test failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setTesting(false)
    }
  }

  async function destroy() {
    if (isNew || !templateId) return
    if (!window.confirm('Delete this agency template?')) return
    try {
      await api.deleteAgencyMessageTemplate(templateId)
      addToast({ title: 'Template deleted', variant: 'success' })
      navigate('/agency/templates')
    } catch (err) {
      addToast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    }
  }

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-screen="AGN-TPL-002" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
      </div>
    )
  }

  if (!agent || loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-TPL-002" dir={dir}>
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold">Admin access required</h1>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-TPL-002" dir={dir}>
        <h1 className="text-2xl font-bold">Template not found</h1>
        <Link to="/agency/templates" className="mt-4 inline-block"><Button>Back to templates</Button></Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]" data-screen="AGN-TPL-002" dir={dir}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to="/agency/templates" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]">
              <ArrowLeft className="h-4 w-4" />
              Agency templates
            </Link>
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">
              {isNew ? 'New agency template' : 'Edit agency template'}
            </h1>
            {dirty && <p className="text-sm text-amber-700">Unsaved changes</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {!isNew && (
              <Button variant="outline" className="gap-2 text-red-700" onClick={() => void destroy()}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={() => void sendTest()} disabled={testing || isNew}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Send test
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => void saveDraft()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </Button>
            <Button className="gap-2" onClick={() => void publish()} disabled={publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Template content</CardTitle>
              <CardDescription>Use {'{{variable}}'} placeholders. Agency branding variables are available to every agent.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <Label htmlFor="template-name">Name</Label>
                <Input id="template-name" value={form.name || ''} onChange={(e) => updateField('name', e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="template-channel">Channel</Label>
                  <select
                    id="template-channel"
                    aria-label="Channel"
                    value={form.channel || 'whatsapp'}
                    onChange={(e) => updateField('channel', e.target.value as AgencyMessageTemplate['channel'])}
                    className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  >
                    {CHANNELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="template-category">Category</Label>
                  <select
                    id="template-category"
                    aria-label="Category"
                    value={form.category || 'general'}
                    onChange={(e) => updateField('category', e.target.value as AgencyMessageTemplate['category'])}
                    className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
              </div>
              {form.channel === 'email' && (
                <div>
                  <Label htmlFor="template-subject">Subject</Label>
                  <Input
                    id="template-subject"
                    value={form.subject || ''}
                    onChange={(e) => updateField('subject', e.target.value)}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="template-body">Body</Label>
                <textarea
                  id="template-body"
                  value={form.body || ''}
                  onChange={(e) => updateField('body', e.target.value)}
                  rows={10}
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agency variables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {AGENCY_VARIABLES.map((variable) => (
                  <div key={variable}>
                    <Label htmlFor={`var-${variable}`}>{`{{${variable}}}`}</Label>
                    <Input
                      id={`var-${variable}`}
                      value={previewVariables[variable] || ''}
                      onChange={(e) => setPreviewVariables((prev) => ({ ...prev, [variable]: e.target.value }))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detected variables</CardTitle>
              </CardHeader>
              <CardContent>
                {derivedVariables.length === 0 ? (
                  <p className="text-sm text-[var(--lc-text-muted)]">No placeholders detected yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {derivedVariables.map((variable) => (
                      <li key={variable}><code>{`{{${variable}}}`}</code></li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {preview && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Test preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {preview.subject && <p className="text-sm font-medium">{preview.subject}</p>}
                  <pre className="overflow-x-auto rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-3 text-sm whitespace-pre-wrap">{preview.body}</pre>
                  {preview.missing_variables.length > 0 && (
                    <p className="text-sm text-amber-700">Missing: {preview.missing_variables.join(', ')}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
