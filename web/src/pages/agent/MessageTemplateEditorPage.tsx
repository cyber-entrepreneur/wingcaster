import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, Loader2, Save, Send, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { AgentMessageTemplateSendTestDialog } from '@/components/message-templates/AgentMessageTemplateSendTestDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { CrmShell } from '@/components/layout/CrmShell'
import { usePageTitle } from '@/lib/usePageTitle'
import {
  DEFAULT_PREVIEW_VARIABLES,
  MESSAGE_TEMPLATE_CATEGORIES,
  MESSAGE_TEMPLATE_CHANNELS,
  type MessageTemplateCategory,
  type MessageTemplateChannel,
  type MessageTemplateRow,
  extractTemplateVariables,
  smsSegmentInfo,
} from '@/lib/messageTemplates/shared'
import { cn } from '@/lib/utils'

type EditorForm = {
  name: string
  channel: MessageTemplateChannel
  category: MessageTemplateCategory
  subject: string
  body: string
  language: string
  owner_type: 'agent' | 'agency'
}

const emptyForm: EditorForm = {
  name: '',
  channel: 'whatsapp',
  category: 'general',
  subject: '',
  body: '',
  language: 'en',
  owner_type: 'agent',
}

/**
 * AGT-TPL-002 — Template editor
 * Routes: `/message-templates/new`, `/message-templates/:id`
 */
export function MessageTemplateEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle(isNew ? 'New template' : 'Edit template')

  const [template, setTemplate] = useState<MessageTemplateRow | null>(null)
  const [form, setForm] = useState<EditorForm>(emptyForm)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [previewVariables, setPreviewVariables] = useState(DEFAULT_PREVIEW_VARIABLES)
  const [renderedPreview, setRenderedPreview] = useState<{
    body: string
    subject: string | null
    missing_variables: string[]
  } | null>(null)
  const [rendering, setRendering] = useState(false)
  const [sendTestOpen, setSendTestOpen] = useState(false)

  const readOnly = template?.owner_type === 'agency' || template?.owner_type === 'platform'

  useEffect(() => {
    if (!agent || isNew) return
    setLoading(true)
    setError(null)
    void api
      .getMessageTemplate(id!)
      .then((row) => {
        const tpl = row as MessageTemplateRow
        setTemplate(tpl)
        setForm({
          name: tpl.name,
          channel: tpl.channel,
          category: tpl.category,
          subject: tpl.subject || '',
          body: tpl.body,
          language: tpl.language,
          owner_type: tpl.owner_type === 'agency' ? 'agency' : 'agent',
        })
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load template')
      })
      .finally(() => setLoading(false))
  }, [agent, id, isNew])

  const derivedVariables = useMemo(
    () => extractTemplateVariables(form.body, form.channel === 'email' ? form.subject : null),
    [form.body, form.subject, form.channel],
  )

  const smsInfo = useMemo(() => (form.channel === 'sms' ? smsSegmentInfo(form.body) : null), [form.channel, form.body])

  const patchForm = (patch: Partial<EditorForm>) => {
    setDirty(true)
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      addToast({ title: 'Name and body are required', variant: 'error' })
      return
    }
    if (form.channel === 'email' && !form.subject.trim()) {
      addToast({ title: 'Email templates require a subject', variant: 'error' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        subject: form.channel === 'email' ? form.subject : null,
        owner_type: isNew ? form.owner_type : undefined,
      }
      if (isNew) {
        const created = (await api.createMessageTemplate(payload)) as MessageTemplateRow
        addToast({ title: 'Template created', variant: 'success' })
        navigate(`/message-templates/${created.id}`, { replace: true })
      } else {
        await api.updateMessageTemplate(id!, payload)
        addToast({ title: 'Template saved', variant: 'success' })
        setDirty(false)
        const refreshed = (await api.getMessageTemplate(id!)) as MessageTemplateRow
        setTemplate(refreshed)
      }
    } catch (err: unknown) {
      addToast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!template || !confirm(`Delete template "${template.name}"?`)) return
    try {
      await api.deleteMessageTemplate(template.id)
      addToast({ title: 'Template deleted', variant: 'success' })
      navigate('/message-templates')
    } catch (err: unknown) {
      addToast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    }
  }

  const runPreview = async () => {
    if (!form.body.trim()) return
    setRendering(true)
    try {
      if (!isNew && id) {
        const result = await api.renderMessageTemplate(id, previewVariables)
        setRenderedPreview(result)
      } else {
        const missing: string[] = []
        const replace = (text: string) =>
          text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
            if (previewVariables[key] === undefined || previewVariables[key] === null) {
              missing.push(key)
              return match
            }
            return String(previewVariables[key])
          })
        setRenderedPreview({
          body: replace(form.body),
          subject: form.channel === 'email' ? replace(form.subject) : null,
          missing_variables: Array.from(new Set(missing)),
        })
      }
    } catch (err: unknown) {
      addToast({
        title: 'Preview failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setRendering(false)
    }
  }

  if (!agent) {
    return (
      <div data-screen="AGT-TPL-002" className="p-6 text-sm text-[var(--lc-text-muted)]">
        <Link to="/login" className="text-[var(--lc-text-brand)] hover:underline">Sign in</Link> to edit templates.
      </div>
    )
  }

  return (
    <CrmShell>
      <div data-screen="AGT-TPL-002" data-testid="message-template-editor-page" className="p-[var(--lc-space-md)] md:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/message-templates"
              className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
              aria-label="Back to templates"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            <div>
              <h1 style={{ font: 'var(--lc-type-heading-1)' }}>{isNew ? 'New template' : 'Edit template'}</h1>
              <p className="text-sm text-[var(--lc-text-muted)]">
                Compose reusable WhatsApp, SMS, and email messages with variables.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isNew && template && !readOnly ? (
              <Button type="button" variant="outline" className="min-h-tap" onClick={() => setSendTestOpen(true)}>
                <Send className="me-2 h-4 w-4" aria-hidden="true" />
                Send test
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="min-h-tap" onClick={() => void runPreview()} disabled={rendering}>
              <Eye className="me-2 h-4 w-4" aria-hidden="true" />
              Preview
            </Button>
            <Button type="button" className="min-h-tap" onClick={() => void handleSave()} disabled={saving || readOnly}>
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="me-2 h-4 w-4" aria-hidden="true" />}
              {isNew ? 'Create' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-[var(--lc-text-muted)]" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading template…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
            <p className="text-sm text-[var(--lc-status-error-text)]">{error}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3 min-h-tap" onClick={() => navigate('/message-templates')}>
              Back to list
            </Button>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 md:p-5">
              {readOnly ? (
                <p className="text-sm text-[var(--lc-text-muted)]">
                  This template is read-only. Copy it to your own templates from the list to customize.
                </p>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--lc-text-primary)]">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => patchForm({ name: e.target.value })}
                  disabled={readOnly}
                  placeholder="e.g. New lead welcome"
                />
              </div>

              <fieldset disabled={readOnly}>
                <legend className="mb-2 text-sm font-medium text-[var(--lc-text-primary)]">Channel</legend>
                <div className="flex flex-wrap gap-2">
                  {MESSAGE_TEMPLATE_CHANNELS.map((channel) => (
                    <button
                      key={channel.value}
                      type="button"
                      className={cn(
                        'inline-flex min-h-tap items-center gap-2 rounded-pill border px-3 py-1.5 text-sm transition-colors',
                        form.channel === channel.value
                          ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                          : 'border-[var(--lc-border)] text-[var(--lc-text-muted)] hover:border-[var(--lc-border-strong)]',
                      )}
                      aria-pressed={form.channel === channel.value}
                      onClick={() => patchForm({ channel: channel.value })}
                    >
                      <channel.icon className="h-4 w-4" aria-hidden="true" />
                      {channel.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => patchForm({ category: e.target.value as MessageTemplateCategory })}
                    disabled={readOnly}
                    className="h-10 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                  >
                    {MESSAGE_TEMPLATE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {isNew ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Owner</label>
                    <select
                      value={form.owner_type}
                      onChange={(e) => patchForm({ owner_type: e.target.value as 'agent' | 'agency' })}
                      className="h-10 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                    >
                      <option value="agent">Just me</option>
                      <option value="agency">My agency</option>
                    </select>
                  </div>
                ) : null}
              </div>

              {form.channel === 'email' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Subject</label>
                  <Input
                    value={form.subject}
                    onChange={(e) => patchForm({ subject: e.target.value })}
                    disabled={readOnly}
                    placeholder="Viewing confirmed for {{property_title}}"
                  />
                </div>
              ) : null}

              <div>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <label className="text-sm font-medium">Body</label>
                  {smsInfo ? (
                    <span className="text-xs text-[var(--lc-text-muted)]">
                      <Numeric>{smsInfo.chars}</Numeric> chars · <Numeric>{smsInfo.segments}</Numeric> segment{smsInfo.segments === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
                <textarea
                  value={form.body}
                  onChange={(e) => patchForm({ body: e.target.value })}
                  disabled={readOnly}
                  rows={8}
                  dir="auto"
                  className="w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm outline-none"
                  placeholder="Hi {{client_name}}, thank you for your interest in {{property_title}}."
                />
              </div>

              {!isNew && !readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-[var(--lc-status-error-text)] hover:bg-[var(--lc-status-error-bg)]"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="me-2 h-4 w-4" aria-hidden="true" />
                  Delete template
                </Button>
              ) : null}
            </div>

            <aside className="space-y-4">
              <section className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
                <h2 className="text-sm font-semibold text-[var(--lc-text-primary)]">Variables</h2>
                <p className="mt-1 text-xs text-[var(--lc-text-muted)]">Use {'{{variable_name}}'} in the body.</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {derivedVariables.length === 0 ? (
                    <span className="text-xs text-[var(--lc-text-muted)]">None detected yet.</span>
                  ) : (
                    derivedVariables.map((v) => (
                      <span key={v} className="rounded bg-[var(--lc-surface-sunken)] px-2 py-1 font-mono text-xs">
                        {v}
                      </span>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
                <h2 className="text-sm font-semibold">Preview values</h2>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {derivedVariables.map((v) => (
                    <div key={v}>
                      <label className="text-xs text-[var(--lc-text-muted)]">{v}</label>
                      <Input
                        value={previewVariables[v] || ''}
                        onChange={(e) => setPreviewVariables((prev) => ({ ...prev, [v]: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {renderedPreview ? (
                <section className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-4">
                  <h2 className="text-sm font-semibold">Preview</h2>
                  {renderedPreview.subject ? (
                    <p className="mt-2 text-sm font-medium">{renderedPreview.subject}</p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--lc-text-muted)]">{renderedPreview.body}</p>
                  {renderedPreview.missing_variables?.length ? (
                    <p className="mt-2 text-xs text-[var(--lc-status-warning-text)]">
                      Missing: {renderedPreview.missing_variables.join(', ')}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </aside>
          </div>
        ) : null}

        <AgentMessageTemplateSendTestDialog
          template={template}
          open={sendTestOpen}
          onOpenChange={setSendTestOpen}
          callerEmail={typeof agent?.email === 'string' ? agent.email : ''}
        />
      </div>
    </CrmShell>
  )
}
