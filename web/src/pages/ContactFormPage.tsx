import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { Field, FormSelect } from '@/components/contacts/form-controls'
import { ContactPicker } from '@/components/contacts/ContactPicker'
import {
  CONTACT_ROLE_OPTIONS,
  STATUS_OPTIONS,
  PHONE_LABEL_OPTIONS,
  EMAIL_LABEL_OPTIONS,
  emptyContactFormState,
  formStateFromContact,
  formStateToPayload,
  numberedLabels,
  type ContactFormState,
  type ContactRecord,
  type LabeledPhone,
  type LabeledEmail,
} from '@/components/contacts/contactForm'

/** Seed passed from the quick-add dialog's "Go to Full Form" action. */
export type ContactFormSeed = Partial<
  Pick<ContactFormState, 'first_name' | 'last_name' | 'contact_role'>
> & { email?: string; phone?: string }

function seededState(seed?: ContactFormSeed): ContactFormState {
  const base = emptyContactFormState()
  if (!seed) return base
  return {
    ...base,
    first_name: seed.first_name || '',
    last_name: seed.last_name || '',
    contact_role: seed.contact_role || '',
    emails: [{ label: 'personal', address: seed.email || '' }],
    phones: [{ label: 'mobile', number: seed.phone || '' }],
  }
}

/**
 * AGT-CTC — Full CRM contact form. Serves both `/contacts/new/full` (create) and
 * `/contacts/:id/edit` (edit). Sections are rendered incrementally; the state and
 * payload models (contactForm.ts) already cover every section.
 */
export function ContactFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const location = useLocation()
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle(isEdit ? 'Edit contact' : 'New contact')

  const seed = (location.state as { seed?: ContactFormSeed } | null)?.seed
  const [form, setForm] = useState<ContactFormState>(() => seededState(seed))
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  // Gate on a stable primitive, not the `agent` object identity — a context (or
  // a test mock) that returns a fresh object each render would otherwise re-fire
  // this effect on every load and loop.
  const authReady = Boolean(agent)
  useEffect(() => {
    if (!isEdit || !authReady) return
    let cancelled = false
    setLoading(true)
    api.getContact(id!)
      .then((row) => {
        if (!cancelled) setForm(formStateFromContact(row as ContactRecord))
      })
      .catch((e: unknown) =>
        addToast({
          title: 'Failed to load contact',
          description: e instanceof Error ? e.message : 'Try again',
          variant: 'error',
        }),
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id, isEdit, authReady])

  const hasIdentity = useMemo(
    () =>
      Boolean(
        form.first_name.trim() || form.last_name.trim() ||
        form.emails.some((e) => e.address.trim()) ||
        form.phones.some((p) => p.number.trim()),
      ),
    [form.first_name, form.last_name, form.emails, form.phones],
  )

  // Display labels with duplicate auto-numbering ("Business 1", "Business 2").
  const phoneLabels = useMemo(() => numberedLabels(form.phones.map((p) => p.label), PHONE_LABEL_OPTIONS), [form.phones])
  const emailLabels = useMemo(() => numberedLabels(form.emails.map((e) => e.label), EMAIL_LABEL_OPTIONS), [form.emails])

  function set<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Omnichannel: labeled phone/email lists with add/remove. At least one row of
  // each is kept so there is always a primary to sync to the typed columns.
  function updatePhone(i: number, patch: Partial<LabeledPhone>) {
    setForm((prev) => ({ ...prev, phones: prev.phones.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }))
  }
  function addPhone() {
    setForm((prev) => ({ ...prev, phones: [...prev.phones, { label: 'mobile', number: '' }] }))
  }
  function removePhone(i: number) {
    setForm((prev) => {
      const phones = prev.phones.filter((_, idx) => idx !== i)
      return { ...prev, phones: phones.length ? phones : [{ label: 'mobile', number: '' }] }
    })
  }
  function updateEmail(i: number, patch: Partial<LabeledEmail>) {
    setForm((prev) => ({ ...prev, emails: prev.emails.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) }))
  }
  function addEmail() {
    setForm((prev) => ({ ...prev, emails: [...prev.emails, { label: 'personal', address: '' }] }))
  }
  function removeEmail(i: number) {
    setForm((prev) => {
      const emails = prev.emails.filter((_, idx) => idx !== i)
      return { ...prev, emails: emails.length ? emails : [{ label: 'personal', address: '' }] }
    })
  }

  async function handleSave() {
    if (!hasIdentity) {
      addToast({
        title: 'Add a name or contact method',
        description: 'A contact needs at least a first/last name, email, or phone.',
        variant: 'error',
      })
      return
    }
    setSaving(true)
    try {
      const payload = formStateToPayload(form)
      const saved = isEdit
        ? ((await api.updateContact(id!, payload)) as ContactRecord)
        : ((await api.createContact(payload)) as ContactRecord)
      addToast({ title: isEdit ? 'Contact updated' : 'Contact created', variant: 'success' })
      const savedId = (saved?.id as string) || id
      navigate(savedId ? `/contacts/${savedId}` : '/contacts')
    } catch (e: unknown) {
      addToast({
        title: isEdit ? 'Could not update contact' : 'Could not create contact',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmShell>
      <CmdPageHeader
        title={isEdit ? 'Edit contact' : 'New contact'}
        subtitle={
          <Link to={isEdit && id ? `/contacts/${id}` : '/contacts'} className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
          </Link>
        }
        actions={
          <Button onClick={() => void handleSave()} disabled={saving || loading} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {isEdit ? 'Save changes' : 'Create contact'}
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" aria-hidden="true" />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
          {/* Section: Role & source */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Role &amp; source</CardTitle>
              <CardDescription>How this contact relates to you and how they were discovered.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="contact-role" label="Contact role">
                <FormSelect
                  id="contact-role"
                  options={CONTACT_ROLE_OPTIONS}
                  placeholder="Select a role…"
                  value={form.contact_role}
                  onChange={(e) => set('contact_role', e.target.value)}
                />
              </Field>
              <Field id="contact-status" label="Status">
                <FormSelect
                  id="contact-status"
                  options={STATUS_OPTIONS}
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                />
              </Field>
              <Field id="contact-source" label="Lead source" className="sm:col-span-2" hint="How this contact was discovered (e.g. Referral, Portal, Walk-in).">
                <Input
                  id="contact-source"
                  value={form.source}
                  onChange={(e) => set('source', e.target.value)}
                  placeholder="Referral, Bazaar, PF Group…"
                  autoComplete="off"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Section: Name */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Name</CardTitle>
              <CardDescription>At least a name, email, or phone is required.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="first-name" label="First name">
                <Input id="first-name" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} autoComplete="given-name" />
              </Field>
              <Field id="last-name" label="Last name">
                <Input id="last-name" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} autoComplete="family-name" />
              </Field>
            </CardContent>
          </Card>

          {/* Section: Work */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Work</CardTitle>
              <CardDescription>Role at their organization and who they report to.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="work-title" label="Title">
                <Input id="work-title" value={form.title} onChange={(e) => set('title', e.target.value)} autoComplete="organization-title" />
              </Field>
              <Field id="work-department" label="Department">
                <Input id="work-department" value={form.department} onChange={(e) => set('department', e.target.value)} />
              </Field>
              <Field id="work-org" label="Organization name" className="sm:col-span-2">
                <Input id="work-org" value={form.organization_name} onChange={(e) => set('organization_name', e.target.value)} autoComplete="organization" />
              </Field>
              <Field id="work-reports-to" label="Reports to" className="sm:col-span-2" hint="Link to another contact this person reports to.">
                <ContactPicker
                  inputId="work-reports-to"
                  value={form.reports_to_contact_id}
                  displayName={form.reports_to_name}
                  excludeId={id}
                  onChange={(rid, rname) => setForm((prev) => ({ ...prev, reports_to_contact_id: rid, reports_to_name: rname }))}
                />
              </Field>
              <Field id="work-assistant-name" label="Assistant name">
                <Input id="work-assistant-name" value={form.assistant_name} onChange={(e) => set('assistant_name', e.target.value)} />
              </Field>
              <Field id="work-assistant-phone" label="Assistant phone">
                <Input id="work-assistant-phone" type="tel" value={form.assistant_phone} onChange={(e) => set('assistant_phone', e.target.value)} autoComplete="tel" />
              </Field>
            </CardContent>
          </Card>

          {/* Section: Phone & email (omnichannel) */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Phone &amp; email</CardTitle>
              <CardDescription>Add as many as you need; the first of each is the primary. Repeated labels are numbered automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--lc-text-primary)]">Phone numbers</span>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addPhone}>
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add phone
                  </Button>
                </div>
                {form.phones.map((row, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="w-32 shrink-0 sm:w-40">
                      <FormSelect
                        aria-label={`Phone ${i + 1} label`}
                        options={PHONE_LABEL_OPTIONS}
                        value={row.label}
                        onChange={(e) => updatePhone(i, { label: e.target.value })}
                      />
                    </div>
                    <Input
                      type="tel"
                      aria-label={`${phoneLabels[i]} phone`}
                      value={row.number}
                      onChange={(e) => updatePhone(i, { number: e.target.value })}
                      autoComplete="tel"
                      placeholder="+1 555 123 4567"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${phoneLabels[i]} phone`}
                      onClick={() => removePhone(i)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--lc-text-primary)]">Emails</span>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addEmail}>
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add email
                  </Button>
                </div>
                {form.emails.map((row, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="w-32 shrink-0 sm:w-40">
                      <FormSelect
                        aria-label={`Email ${i + 1} label`}
                        options={EMAIL_LABEL_OPTIONS}
                        value={row.label}
                        onChange={(e) => updateEmail(i, { label: e.target.value })}
                      />
                    </div>
                    <Input
                      type="email"
                      aria-label={`${emailLabels[i]} email`}
                      value={row.address}
                      onChange={(e) => updateEmail(i, { address: e.target.value })}
                      autoComplete="email"
                      placeholder="name@example.com"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${emailLabels[i]} email`}
                      onClick={() => removeEmail(i)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pb-8">
            <Button variant="ghost" asChild>
              <Link to={isEdit && id ? `/contacts/${id}` : '/contacts'}>Cancel</Link>
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {isEdit ? 'Save changes' : 'Create contact'}
            </Button>
          </div>
        </div>
      )}
    </CrmShell>
  )
}
