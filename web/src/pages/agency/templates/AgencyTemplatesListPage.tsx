/**
 * AGN-TPL-001 — Agency templates list.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, LayoutTemplate, Loader2, Plus, Send } from 'lucide-react'
import { api, type AgencyMessageTemplate } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

const CHANNELS = [
  { value: 'all', label: 'All channels' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
]

const CATEGORIES = [
  { value: 'all', label: 'All categories' },
  { value: 'greeting', label: 'Greeting' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'general', label: 'General' },
]

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
]

function formatStatus(status: string) {
  if (status === 'approved') return 'Published'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export function AgencyTemplatesListPage() {
  const navigate = useNavigate()
  const { templateId } = useParams()
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('Agency templates')

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [templates, setTemplates] = useState<AgencyMessageTemplate[]>([])
  const [channelFilter, setChannelFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creating, setCreating] = useState(templateId === 'new')
  const [selected, setSelected] = useState<AgencyMessageTemplate | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    channel: 'whatsapp' as AgencyMessageTemplate['channel'],
    category: 'general' as AgencyMessageTemplate['category'],
    body: '',
  })

  const role = (agent?.affiliation as { role?: string } | undefined)?.role
  const isAdmin = role === 'owner' || role === 'admin'

  const queryParams = useMemo(() => {
    const params: { channel?: string; category?: string; status?: string } = {}
    if (channelFilter !== 'all') params.channel = channelFilter
    if (categoryFilter !== 'all') params.category = categoryFilter
    if (statusFilter !== 'all') params.status = statusFilter
    return params
  }, [channelFilter, categoryFilter, statusFilter])

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const res = await api.listAgencyMessageTemplates(queryParams)
      setTemplates(res.templates)
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({ title: 'Could not load templates', description: (err as Error).message, variant: 'error' })
    }
  }, [addToast, isAdmin, queryParams])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  useEffect(() => {
    setCreating(templateId === 'new')
    if (!templateId || templateId === 'new') {
      setSelected(null)
      return
    }
    const fromList = templates.find((row) => row.id === templateId)
    if (fromList) {
      setSelected(fromList)
      return
    }
    void api.getAgencyMessageTemplate(templateId)
      .then((row) => setSelected(row))
      .catch(() => setSelected(null))
  }, [templateId, templates])

  async function createTemplate() {
    if (!createForm.name.trim() || !createForm.body.trim()) {
      addToast({ title: 'Name and body are required', variant: 'error' })
      return
    }
    try {
      const created = await api.createAgencyMessageTemplate({
        name: createForm.name.trim(),
        channel: createForm.channel,
        category: createForm.category,
        body: createForm.body.trim(),
      })
      addToast({ title: 'Template created', variant: 'success' })
      setCreating(false)
      setCreateForm({ name: '', channel: 'whatsapp', category: 'general', body: '' })
      navigate(`/agency/templates/${created.id}`)
      void load()
    } catch (err) {
      addToast({ title: 'Create failed', description: (err as Error).message, variant: 'error' })
    }
  }

  async function publishTemplate(id: string) {
    setPublishingId(id)
    try {
      await api.publishAgencyMessageTemplate(id)
      addToast({ title: 'Template published to agents', variant: 'success' })
      void load()
    } catch (err) {
      addToast({ title: 'Publish failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setPublishingId(null)
    }
  }

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-screen="AGN-TPL-001" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
      </div>
    )
  }

  if (!agent || loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-TPL-001" dir={dir}>
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-[var(--lc-text-muted)]">Only agency owners and admins can manage agency templates.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]" data-screen="AGN-TPL-001" dir={dir}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to="/agency" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]">
              <ArrowLeft className="h-4 w-4" />
              Agency
            </Link>
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">Agency templates</h1>
            <p className="text-[var(--lc-text-muted)]">Message templates your agents can use across WhatsApp, SMS, and email.</p>
          </div>
          <Button className="gap-2" onClick={() => navigate('/agency/templates/new')}>
            <Plus className="h-4 w-4" />
            Create template
          </Button>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="channel-filter">Channel</Label>
            <select
              id="channel-filter"
              aria-label="Channel filter"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
            >
              {CHANNELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="category-filter">Category</Label>
            <select
              id="category-filter"
              aria-label="Category filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
            >
              {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="status-filter">Status</Label>
            <select
              id="status-filter"
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
            >
              {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>

        {selected && !creating && (
          <Card>
            <CardContent className="space-y-3 py-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--lc-text-heading)]">{selected.name}</h2>
                  <p className="text-sm text-[var(--lc-text-muted)]">
                    {selected.channel} · {selected.category.replace(/_/g, ' ')} · {formatStatus(selected.approval_status)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selected.approval_status !== 'approved' && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1"
                      disabled={publishingId === selected.id}
                      onClick={() => void publishTemplate(selected.id)}
                    >
                      {publishingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Publish to agents
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => navigate('/agency/templates')}>Close</Button>
                </div>
              </div>
              <pre className="overflow-x-auto rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-4 text-sm whitespace-pre-wrap">{selected.body}</pre>
            </CardContent>
          </Card>
        )}

        {creating && (
          <Card>
            <CardContent className="grid gap-4 py-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="template-name">Template name</Label>
                <Input
                  id="template-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="template-channel">Channel</Label>
                <select
                  id="template-channel"
                  aria-label="Channel"
                  value={createForm.channel}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, channel: e.target.value as AgencyMessageTemplate['channel'] }))}
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                >
                  {CHANNELS.filter((item) => item.value !== 'all').map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="template-category">Category</Label>
                <select
                  id="template-category"
                  aria-label="Category"
                  value={createForm.category}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value as AgencyMessageTemplate['category'] }))}
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                >
                  {CATEGORIES.filter((item) => item.value !== 'all').map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="template-body">Body</Label>
                <textarea
                  id="template-body"
                  value={createForm.body}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={() => void createTemplate()}>Save draft</Button>
                <Button variant="outline" onClick={() => navigate('/agency/templates')}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loadState === 'error' && (
          <Card><CardContent className="py-8 text-center text-[var(--lc-text-muted)]">Could not load templates.</CardContent></Card>
        )}

        {loadState === 'ready' && templates.length === 0 && !creating && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <LayoutTemplate className="h-10 w-10 text-[var(--lc-text-muted)]" />
              <p className="text-[var(--lc-text-muted)]">No agency templates yet. Create one for your agents to use.</p>
              <Button onClick={() => navigate('/agency/templates/new')}>Create template</Button>
            </CardContent>
          </Card>
        )}

        {templates.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[var(--lc-border)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">Name</th>
                  <th className="px-4 py-3 text-start font-medium">Category</th>
                  <th className="px-4 py-3 text-start font-medium">Channel</th>
                  <th className="px-4 py-3 text-start font-medium">Agents using</th>
                  <th className="px-4 py-3 text-start font-medium">Last modified</th>
                  <th className="px-4 py-3 text-start font-medium">Status</th>
                  <th className="px-4 py-3 text-start font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-t border-[var(--lc-border)] hover:bg-[var(--lc-surface-sunken)]">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-[var(--lc-text-brand)] hover:underline"
                        onClick={() => navigate(`/agency/templates/${template.id}`)}
                      >
                        {template.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 capitalize">{template.category.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 capitalize">{template.channel}</td>
                    <td className="px-4 py-3"><Numeric>{template.agents_using_count}</Numeric></td>
                    <td className="px-4 py-3">{formatDate(template.updated_at)}</td>
                    <td className="px-4 py-3">{formatStatus(template.approval_status)}</td>
                    <td className="px-4 py-3">
                      {template.approval_status !== 'approved' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={publishingId === template.id}
                          onClick={() => void publishTemplate(template.id)}
                        >
                          {publishingId === template.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Publish
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
