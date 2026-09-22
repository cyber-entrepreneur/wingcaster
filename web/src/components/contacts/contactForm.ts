/**
 * Shared model for the full CRM contact form (AGT-CTC).
 *
 * One canonical form-state shape covers every section of the full form. The
 * form page renders sections incrementally (shipped PR by PR), but the state and
 * the state→payload conversion are complete from the start so later sections
 * only add rendering — never reshape state or the API contract.
 *
 * Option value strings mirror the backend Zod enums in
 * `backend/src/lib/validation.js` (CONTACT_ROLES, QUALIFICATION_STATUSES, …).
 */

export type Option = { value: string; label: string }

export const CONTACT_ROLE_OPTIONS: Option[] = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'renter', label: 'Renter' },
  { value: 'co_broker', label: 'Co-Broker' },
  { value: 'agent', label: 'Agent' },
  { value: 'investor', label: 'Investor' },
  { value: 'attorney', label: 'Attorney' },
  { value: 'referral_partner', label: 'Referral Partner' },
]

export const STATUS_OPTIONS: Option[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'client', label: 'Client' },
  { value: 'archived', label: 'Archived' },
]

export const QUALIFICATION_OPTIONS: Option[] = [
  { value: 'unverified', label: 'Unverified' },
  { value: 'pre_qualified', label: 'Pre-Qualified' },
  { value: 'pre_approved', label: 'Pre-Approved' },
  { value: 'cash_verified', label: 'Cash Verified' },
  { value: 'institutional_fund', label: 'Institutional Fund' },
]

export const SOURCE_OF_FUNDS_OPTIONS: Option[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'conventional_mortgage', label: 'Conventional Mortgage' },
  { value: 'fha_va_loan', label: 'FHA/VA Loan' },
  { value: 'institutional_capital', label: 'Institutional Capital' },
  { value: 'crypto_conversion', label: 'Crypto Conversion' },
]

export const PHONE_LABEL_OPTIONS: Option[] = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'business', label: 'Business' },
  { value: 'home', label: 'Home' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'pager', label: 'Pager' },
  { value: 'other', label: 'Other' },
]

export const EMAIL_LABEL_OPTIONS: Option[] = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'other', label: 'Other' },
]

export type LabeledPhone = { label: string; number: string }
export type LabeledEmail = { label: string; address: string }

export type ContactAddress = {
  line1: string
  line2: string
  area: string
  city: string
  province: string
  postal_code: string
  country: string
}

export type ContactSocials = {
  whatsapp: string
  telegram: string
  discord: string
  instagram: string
  facebook: string
  twitter: string
  linkedin: string
  tiktok: string
  snapchat: string
}

export const SOCIAL_FIELDS: { key: keyof ContactSocials; label: string; placeholder: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'Number or link (only if different from phone)' },
  { key: 'telegram', label: 'Telegram', placeholder: '@handle' },
  { key: 'discord', label: 'Discord', placeholder: 'username' },
  { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
  { key: 'facebook', label: 'Facebook', placeholder: 'Profile URL or handle' },
  { key: 'twitter', label: 'Twitter / X', placeholder: '@handle' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'Profile URL' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@handle' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'username' },
]

export type FamilyMember = { name: string; dob: string }
export type FinancialInstitution = { name: string; relationship: string }
export type DndHours = { start: string; end: string; timezone: string }

export type PropertyInterests = {
  preferred_area: string
  preferred_property_type: string
  preferred_sub_category: string
  budget: string
  required_features: string[]
}

export type ContactFormState = {
  // Identity
  contact_role: string
  source: string
  first_name: string
  last_name: string
  status: string
  // Work
  title: string
  department: string
  organization_name: string
  reports_to_contact_id: string
  reports_to_name: string
  assistant_name: string
  assistant_phone: string
  // Omnichannel
  phones: LabeledPhone[]
  emails: LabeledEmail[]
  // Address
  address: ContactAddress
  // Socials
  socials: ContactSocials
  // Personal
  date_of_birth: string
  spouse: FamilyMember
  children: FamilyMember[]
  // Preferences / policy
  email_opt_out: boolean
  do_not_call: boolean
  dnd_hours: DndHours
  notify_owner: boolean
  // Qualification
  qualification_status: string
  budget_amount: string
  budget_currency: string
  source_of_funds: string
  financial_institutions: FinancialInstitution[]
  // Property interests
  property_interests: PropertyInterests
}

export function emptyAddress(): ContactAddress {
  return { line1: '', line2: '', area: '', city: '', province: '', postal_code: '', country: '' }
}

export function emptySocials(): ContactSocials {
  return {
    whatsapp: '', telegram: '', discord: '', instagram: '', facebook: '',
    twitter: '', linkedin: '', tiktok: '', snapchat: '',
  }
}

export function emptyPropertyInterests(): PropertyInterests {
  return {
    preferred_area: '', preferred_property_type: '', preferred_sub_category: '',
    budget: '', required_features: [],
  }
}

/**
 * Duplicate auto-numbering for labeled channels: when the same label repeats,
 * suffix each occurrence in order — "Business" → "Business 1", "Business 2".
 * A label used once keeps its plain text. Returns one display string per row.
 */
export function numberedLabels(values: string[], options: Option[]): string[] {
  const text = (v: string) => options.find((o) => o.value === v)?.label || v || 'Other'
  const totals: Record<string, number> = {}
  for (const v of values) totals[v] = (totals[v] || 0) + 1
  const seen: Record<string, number> = {}
  return values.map((v) => {
    if (totals[v] > 1) {
      seen[v] = (seen[v] || 0) + 1
      return `${text(v)} ${seen[v]}`
    }
    return text(v)
  })
}

export function emptyContactFormState(): ContactFormState {
  return {
    contact_role: '',
    source: '',
    first_name: '',
    last_name: '',
    status: 'lead',
    title: '',
    department: '',
    organization_name: '',
    reports_to_contact_id: '',
    reports_to_name: '',
    assistant_name: '',
    assistant_phone: '',
    phones: [{ label: 'mobile', number: '' }],
    emails: [{ label: 'personal', address: '' }],
    address: emptyAddress(),
    socials: emptySocials(),
    date_of_birth: '',
    spouse: { name: '', dob: '' },
    children: [],
    email_opt_out: false,
    do_not_call: false,
    dnd_hours: { start: '', end: '', timezone: '' },
    notify_owner: false,
    qualification_status: '',
    budget_amount: '',
    budget_currency: '',
    source_of_funds: '',
    financial_institutions: [],
    property_interests: emptyPropertyInterests(),
  }
}

/** A contact record as returned by the API (loose — only the fields we read). */
export type ContactRecord = Record<string, unknown> & { id?: string }

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

/** Build editable form state from a loaded contact (edit mode). */
export function formStateFromContact(contact: ContactRecord): ContactFormState {
  const base = emptyContactFormState()
  const phones = Array.isArray(contact.phones) ? (contact.phones as LabeledPhone[]) : []
  const emails = Array.isArray(contact.emails) ? (contact.emails as LabeledEmail[]) : []
  // Fall back to the scalar email/phone columns when no labeled arrays are stored.
  const phoneRows = phones.length
    ? phones.map((p) => ({ label: str(p.label) || 'mobile', number: str(p.number) }))
    : [{ label: 'mobile', number: str(contact.phone) }]
  const emailRows = emails.length
    ? emails.map((e) => ({ label: str(e.label) || 'personal', address: str(e.address) }))
    : [{ label: 'personal', address: str(contact.email) }]
  const address = (contact.address as Partial<ContactAddress> | undefined) || {}
  const socials = (contact.socials as Partial<ContactSocials> | undefined) || {}
  const spouse = (contact.spouse as Partial<FamilyMember> | undefined) || {}
  const dnd = (contact.dnd_hours as Partial<DndHours> | undefined) || {}
  const pi = (contact.property_interests as Partial<PropertyInterests> | undefined) || {}
  return {
    ...base,
    contact_role: str(contact.contact_role),
    source: str(contact.source),
    first_name: str(contact.first_name),
    last_name: str(contact.last_name),
    status: str(contact.status) || 'lead',
    title: str(contact.title),
    department: str(contact.department),
    organization_name: str(contact.organization_name),
    reports_to_contact_id: str(contact.reports_to_contact_id),
    reports_to_name: str(contact.reports_to_name),
    assistant_name: str(contact.assistant_name),
    assistant_phone: str(contact.assistant_phone),
    phones: phoneRows.length ? phoneRows : base.phones,
    emails: emailRows.length ? emailRows : base.emails,
    address: { ...base.address, ...address } as ContactAddress,
    socials: { ...base.socials, ...socials } as ContactSocials,
    date_of_birth: str(contact.date_of_birth),
    spouse: { name: str(spouse.name), dob: str(spouse.dob) },
    children: Array.isArray(contact.children)
      ? (contact.children as FamilyMember[]).map((c) => ({ name: str(c.name), dob: str(c.dob) }))
      : [],
    email_opt_out: Boolean(contact.email_opt_out),
    do_not_call: Boolean(contact.do_not_call),
    dnd_hours: { start: str(dnd.start), end: str(dnd.end), timezone: str(dnd.timezone) },
    notify_owner: Boolean(contact.notify_owner),
    qualification_status: str(contact.qualification_status),
    budget_amount: contact.budget_amount == null ? '' : String(contact.budget_amount),
    budget_currency: str(contact.budget_currency),
    source_of_funds: str(contact.source_of_funds),
    financial_institutions: Array.isArray(contact.financial_institutions)
      ? (contact.financial_institutions as FinancialInstitution[]).map((f) => ({
          name: str(f.name), relationship: str(f.relationship),
        }))
      : [],
    property_interests: { ...base.property_interests, ...pi } as PropertyInterests,
  }
}

function trimmedPhones(rows: LabeledPhone[]): LabeledPhone[] {
  return rows.map((p) => ({ label: p.label || 'mobile', number: p.number.trim() })).filter((p) => p.number)
}
function trimmedEmails(rows: LabeledEmail[]): LabeledEmail[] {
  return rows.map((e) => ({ label: e.label || 'personal', address: e.address.trim() })).filter((e) => e.address)
}
function hasAnyValue(obj: Record<string, string>): boolean {
  return Object.values(obj).some((v) => typeof v === 'string' && v.trim())
}

/**
 * Convert form state to the API payload. Empty sections are omitted so a
 * PATCH never clobbers stored data with blanks the current UI didn't render.
 */
export function formStateToPayload(state: ContactFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const put = (key: string, value: string) => {
    if (value.trim()) payload[key] = value.trim()
  }
  put('first_name', state.first_name)
  put('last_name', state.last_name)
  put('contact_role', state.contact_role)
  put('source', state.source)
  put('status', state.status)
  put('title', state.title)
  put('department', state.department)
  put('organization_name', state.organization_name)
  put('reports_to_contact_id', state.reports_to_contact_id)
  put('reports_to_name', state.reports_to_name)
  put('assistant_name', state.assistant_name)
  put('assistant_phone', state.assistant_phone)
  put('date_of_birth', state.date_of_birth)
  put('qualification_status', state.qualification_status)
  put('budget_currency', state.budget_currency)
  put('source_of_funds', state.source_of_funds)

  const phones = trimmedPhones(state.phones)
  if (phones.length) payload.phones = phones
  const emails = trimmedEmails(state.emails)
  if (emails.length) payload.emails = emails

  if (hasAnyValue(state.address as unknown as Record<string, string>)) payload.address = state.address
  if (hasAnyValue(state.socials as unknown as Record<string, string>)) payload.socials = state.socials

  if (state.spouse.name.trim() || state.spouse.dob.trim()) payload.spouse = state.spouse
  const children = state.children
    .map((c) => ({ name: c.name.trim(), dob: c.dob.trim() }))
    .filter((c) => c.name || c.dob)
  if (children.length) payload.children = children

  if (state.email_opt_out) payload.email_opt_out = true
  if (state.do_not_call) payload.do_not_call = true
  if (state.notify_owner) payload.notify_owner = true
  if (state.dnd_hours.start.trim() || state.dnd_hours.end.trim()) payload.dnd_hours = state.dnd_hours

  if (state.budget_amount.trim()) {
    const n = Number(state.budget_amount)
    if (Number.isFinite(n)) payload.budget_amount = n
  }

  const institutions = state.financial_institutions
    .map((f) => ({ name: f.name.trim(), relationship: f.relationship.trim() }))
    .filter((f) => f.name)
  if (institutions.length) payload.financial_institutions = institutions

  const pi = state.property_interests
  const features = pi.required_features.map((f) => f.trim()).filter(Boolean)
  if (
    pi.preferred_area.trim() || pi.preferred_property_type.trim() ||
    pi.preferred_sub_category.trim() || pi.budget.trim() || features.length
  ) {
    payload.property_interests = { ...pi, required_features: features }
  }

  return payload
}
