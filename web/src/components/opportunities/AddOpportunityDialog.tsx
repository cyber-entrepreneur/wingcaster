import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Loader2, Search, User } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

/**
 * AGT-OPP-003 — Add opportunity.
 *
 * Modal from the pipeline list with searchable contact picker, optional listing
 * picker, stage default, value, expected close, and notes. On save, exits to
 * AGT-OPP-002 (`/opportunities/:id`).
 */

const STAGES = ['new', 'qualification', 'viewing', 'offer', 'negotiation', 'closed_won', 'closed_lost']

function stageLabel(stage: string) {
  return stage.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

type ContactOption = {
  id: string
  name?: string
  email?: string
  phone?: string
}

type PropertyOption = {
  id: string
  title?: string
  address_display?: string
  price?: number | null
  currency?: string | null
}

export type AddOpportunityDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (opportunityId: string) => void
  /** Preselect a contact (e.g. opened from a contact row) to skip the picker. */
  initialContact?: ContactOption | null
}

export function AddOpportunityDialog({ open, onOpenChange, onCreated, initialContact }: AddOpportunityDialogProps) {
  const { addToast } = useToast()
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [contactQuery, setContactQuery] = useState('')
  const [propertyQuery, setPropertyQuery] = useState('')
  const [contactsLoading, setContactsLoading] = useState(false)
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [contactId, setContactId] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [stage, setStage] = useState('new')
  const [dealValue, setDealValue] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [notes, setNotes] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    setContactQuery('')
    setPropertyQuery('')
    setContactId('')
    setPropertyId('')
    setStage('new')
    setDealValue('')
    setCurrency('USD')
    setExpectedCloseDate('')
    setNotes('')
  }, [])

  const loadContacts = useCallback(async (query: string) => {
    setContactsLoading(true)
    try {
      const rows = await api.getContacts(query.trim() ? { q: query.trim() } : undefined)
      setContacts(Array.isArray(rows) ? (rows as ContactOption[]) : [])
    } catch (error) {
      addToast({
        title: 'Could not load contacts',
        description: error instanceof Error ? error.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setContactsLoading(false)
    }
  }, [addToast])

  const loadProperties = useCallback(async () => {
    setPropertiesLoading(true)
    try {
      const rows = await api.getProperties()
      setProperties(Array.isArray(rows) ? (rows as PropertyOption[]) : [])
    } catch (error) {
      addToast({
        title: 'Could not load listings',
        description: error instanceof Error ? error.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setPropertiesLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (!open) return
    reset()
    if (initialContact) {
      setContactId(initialContact.id)
      setContactQuery(initialContact.name || initialContact.email || initialContact.phone || '')
      setContacts((prev) => (prev.some((c) => c.id === initialContact.id) ? prev : [initialContact, ...prev]))
    }
    void loadContacts('')
    void loadProperties()
  }, [open, reset, loadContacts, loadProperties, initialContact])

  useEffect(() => {
    if (!open) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      void loadContacts(contactQuery)
    }, 250)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [contactQuery, loadContacts, open])

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === contactId),
    [contacts, contactId],
  )

  const filteredProperties = useMemo(() => {
    const query = propertyQuery.trim().toLowerCase()
    if (!query) return properties.slice(0, 12)
    return properties
      .filter((property) => {
        const title = (property.title || '').toLowerCase()
        const address = (property.address_display || '').toLowerCase()
        return title.includes(query) || address.includes(query)
      })
      .slice(0, 12)
  }, [properties, propertyQuery])

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === propertyId),
    [properties, propertyId],
  )

  async function handleSubmit() {
    if (!contactId) {
      addToast({ title: 'Select a contact', description: 'Every deal needs a linked contact.', variant: 'error' })
      return
    }
    setSubmitting(true)
    try {
      const created = (await api.createOpportunity({
        contact_id: contactId,
        property_id: propertyId || null,
        stage,
        deal_value: dealValue ? Number(dealValue) : null,
        currency,
        expected_close_date: expectedCloseDate
          ? new Date(`${expectedCloseDate}T12:00:00.000Z`).toISOString()
          : null,
        notes: notes.trim(),
      })) as { id: string }
      addToast({ title: 'Opportunity created', variant: 'success' })
      onOpenChange(false)
      onCreated?.(created.id)
    } catch (error) {
      addToast({
        title: 'Could not create opportunity',
        description: error instanceof Error ? error.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(92vh,760px)] overflow-y-auto sm:max-w-lg"
        data-testid="add-opportunity-dialog"
        data-screen="AGT-OPP-003"
      >
        <DialogHeader>
          <DialogTitle>New opportunity</DialogTitle>
          <DialogDescription>
            Link a contact and optional listing, then save to open the deal detail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label htmlFor="opp-contact-search">Contact</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="opp-contact-search"
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
                placeholder="Search contacts by name, email, or phone"
                className="ps-9"
                autoComplete="off"
              />
            </div>
            {selectedContact ? (
              <div className="flex items-center justify-between rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{selectedContact.name || 'Unnamed contact'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedContact.email || selectedContact.phone || selectedContact.id}
                    </p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setContactId('')}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-md border border-[var(--lc-border)]">
                {contactsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading contacts…
                  </div>
                ) : contacts.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No contacts match your search.</p>
                ) : (
                  contacts.slice(0, 8).map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => {
                        setContactId(contact.id)
                        setContactQuery(contact.name || contact.email || contact.phone || '')
                      }}
                      className="flex w-full items-center gap-2 border-b border-[var(--lc-border)] px-3 py-2.5 text-start last:border-b-0 hover:bg-[var(--lc-action-secondary)]"
                    >
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{contact.name || 'Unnamed contact'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.email || contact.phone || 'No contact method'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="opp-property-search">Listing (optional)</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="opp-property-search"
                value={propertyQuery}
                onChange={(event) => setPropertyQuery(event.target.value)}
                placeholder="Search listings to attach"
                className="ps-9"
                autoComplete="off"
              />
            </div>
            {selectedProperty ? (
              <div className="flex items-center justify-between rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selectedProperty.title || 'Listing'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedProperty.address_display || selectedProperty.id}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPropertyId('')}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="max-h-32 overflow-y-auto rounded-md border border-[var(--lc-border)]">
                {propertiesLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading listings…
                  </div>
                ) : filteredProperties.length === 0 ? (
                  <p className="px-3 py-5 text-center text-sm text-muted-foreground">No listings match your search.</p>
                ) : (
                  filteredProperties.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => {
                        setPropertyId(property.id)
                        setPropertyQuery(property.title || property.address_display || '')
                      }}
                      className="flex w-full items-center justify-between gap-2 border-b border-[var(--lc-border)] px-3 py-2 text-start last:border-b-0 hover:bg-[var(--lc-action-secondary)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{property.title || 'Untitled listing'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {property.address_display || property.id}
                        </p>
                      </div>
                      {property.price != null && (
                        <Numeric className="shrink-0 text-xs font-medium text-muted-foreground">
                          {property.price.toLocaleString()} {property.currency || currency}
                        </Numeric>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="opp-stage">Stage</Label>
              <select
                id="opp-stage"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={stage}
                onChange={(event) => setStage(event.target.value)}
              >
                {STAGES.map((value) => (
                  <option key={value} value={value}>{stageLabel(value)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opp-currency">Currency</Label>
              <Input
                id="opp-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="opp-value">Deal value</Label>
              <Input
                id="opp-value"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Optional"
                value={dealValue}
                onChange={(event) => setDealValue(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opp-close">Expected close</Label>
              <Input
                id="opp-close"
                type="date"
                value={expectedCloseDate}
                onChange={(event) => setExpectedCloseDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opp-notes">Notes</Label>
            <textarea
              id="opp-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Context, next steps, or buyer preferences"
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || !contactId}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save opportunity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
