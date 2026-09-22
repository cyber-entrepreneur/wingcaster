import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
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
import { useToast } from '@/components/ui/toast'
import { Field, FormSelect } from '@/components/contacts/form-controls'
import { CONTACT_ROLE_OPTIONS } from '@/components/contacts/contactForm'
import type { ContactFormSeed } from '@/pages/ContactFormPage'

export type AddContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful quick-save with the new contact id. */
  onCreated?: (contactId: string) => void
}

/**
 * AGT-CTC — Quick-add contact. A shallow capture (name / email / phone / role)
 * for fast entry, with a "Go to Full Form" escape hatch that carries whatever
 * was typed into the full form at /contacts/new/full.
 */
export function AddContactDialog({ open, onOpenChange, onCreated }: AddContactDialogProps) {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setRole('')
      setSaving(false)
    }
  }, [open])

  const hasIdentity = Boolean(firstName.trim() || lastName.trim() || email.trim() || phone.trim())

  function currentSeed(): ContactFormSeed {
    return {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      contact_role: role,
      email: email.trim(),
      phone: phone.trim(),
    }
  }

  function goToFullForm() {
    onOpenChange(false)
    navigate('/contacts/new/full', { state: { seed: currentSeed() } })
  }

  async function handleSave() {
    if (!hasIdentity) {
      addToast({
        title: 'Add a name or contact method',
        description: 'Enter at least a name, email, or phone.',
        variant: 'error',
      })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      if (firstName.trim()) payload.first_name = firstName.trim()
      if (lastName.trim()) payload.last_name = lastName.trim()
      if (role) payload.contact_role = role
      if (email.trim()) payload.emails = [{ label: 'personal', address: email.trim() }]
      if (phone.trim()) payload.phones = [{ label: 'mobile', number: phone.trim() }]
      const created = (await api.createContact(payload)) as { id: string }
      addToast({ title: 'Contact created', variant: 'success' })
      onOpenChange(false)
      if (onCreated) onCreated(created.id)
      else navigate(`/contacts/${created.id}`)
    } catch (e: unknown) {
      addToast({
        title: 'Could not create contact',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="add-contact-dialog" data-screen="AGT-CTC-QUICK">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>Quick capture — or open the full form for every detail.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="qa-first-name" label="First name">
              <Input id="qa-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </Field>
            <Field id="qa-last-name" label="Last name">
              <Input id="qa-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </Field>
          </div>
          <Field id="qa-email" label="Email">
            <Input id="qa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@example.com" />
          </Field>
          <Field id="qa-phone" label="Phone">
            <Input id="qa-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+1 555 123 4567" />
          </Field>
          <Field id="qa-role" label="Contact role">
            <FormSelect id="qa-role" options={CONTACT_ROLE_OPTIONS} placeholder="Select a role…" value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" className="gap-1.5 sm:me-auto" onClick={goToFullForm}>
            Go to full form <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving || !hasIdentity}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
