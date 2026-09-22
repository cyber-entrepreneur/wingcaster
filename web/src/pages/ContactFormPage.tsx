import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
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
import {
  CONTACT_ROLE_OPTIONS,
  STATUS_OPTIONS,
  emptyContactFormState,
  formStateFromContact,
  formStateToPayload,
  type ContactFormState,
  type ContactRecord,
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

  const primaryEmail = form.emails[0]?.address ?? ''
  const primaryPhone = form.phones[0]?.number ?? ''

  const hasIdentity = useMemo(
    () =>
      Boolean(
        form.first_name.trim() || form.last_name.trim() ||
        primaryEmail.trim() || primaryPhone.trim(),
      ),
    [form.first_name, form.last_name, primaryEmail, primaryPhone],
  )

  function set<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }
  function setPrimaryEmail(address: string) {
    setForm((prev) => {
      const emails = prev.emails.length ? [...prev.emails] : [{ label: 'personal', address: '' }]
      emails[0] = { label: emails[0]?.label || 'personal', address }
      return { ...prev, emails }
    })
  }
  function setPrimaryPhone(number: string) {
    setForm((prev) => {
      const phones = prev.phones.length ? [...prev.phones] : [{ label: 'mobile', number: '' }]
      phones[0] = { label: phones[0]?.label || 'mobile', number }
      return { ...prev, phones }
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

          {/* Section: Name & primary contact */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Name &amp; primary contact</CardTitle>
              <CardDescription>At least a name, email, or phone is required.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="first-name" label="First name">
                <Input id="first-name" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} autoComplete="given-name" />
              </Field>
              <Field id="last-name" label="Last name">
                <Input id="last-name" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} autoComplete="family-name" />
              </Field>
              <Field id="primary-email" label="Email">
                <Input id="primary-email" type="email" value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} autoComplete="email" placeholder="name@example.com" />
              </Field>
              <Field id="primary-phone" label="Phone">
                <Input id="primary-phone" type="tel" value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} autoComplete="tel" placeholder="+1 555 123 4567" />
              </Field>
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
