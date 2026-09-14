export const COMPOSER_STEPS = 5 as const

export type ComposerStep = 1 | 2 | 3 | 4 | 5

export type ListingOwnerChoice = 'agency' | 'self' | 'review'
export type VisibilityChoice = 'public' | 'private' | 'white-label'
export type ContactChannel = 'whatsapp' | 'call' | 'sms' | 'email' | 'in_app'

export interface ComposerPhoto {
  id: string
  url: string
  alt_text: string
  isHero?: boolean
}

export interface ComposerFormState {
  // Step 1 — Basics
  type: 'sale' | 'rent'
  purpose: string
  territory_id: string
  country: string
  location: string
  neighborhood: string
  address: string
  show_exact_address: boolean
  price: string
  currency: string
  price_unit: string
  title: string
  // Step 2 — Details
  property_type: string
  bedrooms: string
  bathrooms: string
  area: string
  area_unit: string
  year_built: string
  floor: string
  lot_size: string
  amenities: string[]
  description: string
  // Step 3 — Media
  photos: ComposerPhoto[]
  video_url: string
  tour_360_url: string
  // Step 4 — Contact + attribution
  listing_owner: ListingOwnerChoice
  contact_channels: ContactChannel[]
  visibility: VisibilityChoice
  marketplace_syndicated: boolean
  agency_tied: boolean
}

export const FEATURE_CHIPS = [
  'Pool',
  'Gym',
  'Parking',
  'Balcony',
  "Maid's room",
  'Concierge',
  'Sea view',
  'City view',
  'Furnished',
  'Central A/C',
  'Built-in wardrobes',
  'Kitchen appliances',
  'Study',
  'Storage',
  'Pet-friendly',
  'Garden',
  'Private pool',
  'Rooftop terrace',
] as const

export const PROPERTY_TYPES = [
  'apartment',
  'villa',
  'townhouse',
  'duplex',
  'penthouse',
  'studio',
  'land',
  'office',
  'retail',
  'warehouse',
] as const

export const CURRENCIES = ['AED', 'SAR', 'EGP', 'LBP', 'USD'] as const

export const STEP_META: Record<
  ComposerStep,
  { title: string; sub: string; counterLabel: string }
> = {
  1: {
    title: 'The basics',
    sub: 'Type, purpose, where, how much.',
    counterLabel: 'Basics',
  },
  2: {
    title: 'Property details',
    sub: 'The specs a buyer or tenant will ask about first.',
    counterLabel: 'Property details',
  },
  3: {
    title: 'Photos & video',
    sub: 'Great photos are the single biggest conversion lever. Add at least 3.',
    counterLabel: 'Media',
  },
  4: {
    title: 'Who owns this listing?',
    sub: 'Buyers will contact you through the channels you enable here.',
    counterLabel: 'Contact',
  },
  5: {
    title: 'Last look before you publish',
    sub: "Here's how this listing will appear everywhere it goes.",
    counterLabel: 'Publish preview',
  },
}

export function emptyComposerForm(): ComposerFormState {
  return {
    type: 'sale',
    purpose: 'primary',
    territory_id: '',
    country: '',
    location: '',
    neighborhood: '',
    address: '',
    show_exact_address: false,
    price: '',
    currency: 'AED',
    price_unit: 'month',
    title: '',
    property_type: 'apartment',
    bedrooms: '2',
    bathrooms: '2',
    area: '',
    area_unit: 'sqft',
    year_built: '',
    floor: '',
    lot_size: '',
    amenities: [],
    description: '',
    photos: [],
    video_url: '',
    tour_360_url: '',
    listing_owner: 'self',
    contact_channels: ['whatsapp', 'call'],
    visibility: 'public',
    marketplace_syndicated: true,
    agency_tied: false,
  }
}

/** Map composer form → API property payload. */
export function composerToPayload(form: ComposerFormState): Record<string, unknown> {
  const photos = form.photos.map((p) => p.url).filter(Boolean)
  const title =
    form.title.trim() ||
    [form.location || form.neighborhood, form.property_type].filter(Boolean).join(' — ') ||
    'Untitled listing'

  return {
    title,
    description: form.description,
    type: form.type,
    property_type: form.property_type,
    price: Number(form.price) || 0,
    price_unit: form.type === 'rent' ? form.price_unit : form.currency,
    bedrooms: Number(form.bedrooms) || 0,
    bathrooms: Number(form.bathrooms) || 0,
    area: Number(form.area) || 0,
    area_unit: form.area_unit,
    location: form.location || form.neighborhood,
    city: form.country || form.location,
    neighborhood: form.neighborhood,
    address: form.address,
    amenities: form.amenities,
    photos,
    media: form.photos.map((p) => ({
      id: p.id,
      url: p.url,
      media_type: 'image',
      alt_text: p.alt_text,
      classification: p.isHero ? 'Hero' : 'Other',
    })),
    agency_tied: form.listing_owner === 'agency' || form.agency_tied,
    listing_owner_type: form.listing_owner === 'agency' ? 'agency' : 'independent',
    marketplace_syndicated: form.marketplace_syndicated && form.visibility === 'public',
    territory_id: form.territory_id || undefined,
    purpose: form.purpose,
    visibility: form.visibility,
    contact_channels: form.contact_channels,
    video_url: form.video_url || undefined,
    tour_360_url: form.tour_360_url || undefined,
    year_built: form.year_built ? Number(form.year_built) : undefined,
    floor: form.floor ? Number(form.floor) : undefined,
    currency: form.currency,
  }
}

export function validateStep(step: ComposerStep, form: ComposerFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (step === 1) {
    if (!form.location.trim() && !form.neighborhood.trim()) {
      errors.location = 'Area / neighborhood is required'
    }
    if (!form.price.trim() || Number(form.price) <= 0) {
      errors.price = 'Asking price is required'
    }
  }
  if (step === 2) {
    if (!form.property_type) errors.property_type = 'Property type is required'
  }
  if (step === 3) {
    if (form.photos.filter((p) => p.url).length < 3) {
      errors.photos = 'Add at least 3 photos to publish'
    }
  }
  if (step === 4) {
    if (form.contact_channels.length === 0) {
      errors.contact_channels = 'Enable at least one contact channel'
    }
  }
  return errors
}

export type PortalValidatorIssue = {
  portal: string
  severity: 'block' | 'warn' | 'info'
  message: string
  fixStep: ComposerStep
}

/** Client-side portal checks (BE-BLOCKER-17 modules land later). */
export function runPortalValidators(form: ComposerFormState): PortalValidatorIssue[] {
  const issues: PortalValidatorIssue[] = []
  const country = form.country.toLowerCase()
  if ((country.includes('uae') || country.includes('dubai') || country === 'ae') && !form.territory_id) {
    issues.push({
      portal: 'Bayut',
      severity: 'warn',
      message: 'Add Trakheesi number to publish on Bayut UAE.',
      fixStep: 1,
    })
  }
  if (form.photos.filter((p) => p.url).length < 3) {
    issues.push({
      portal: 'Property Finder',
      severity: 'block',
      message: 'At least 3 photos are required.',
      fixStep: 3,
    })
  }
  if (!form.price || Number(form.price) <= 0) {
    issues.push({
      portal: 'Dubizzle',
      severity: 'block',
      message: 'Price is required.',
      fixStep: 1,
    })
  }
  const missingAlt = form.photos.filter((p) => p.url && !p.alt_text.trim()).length
  if (missingAlt > 0) {
    issues.push({
      portal: 'Accessibility',
      severity: 'warn',
      message: `${missingAlt} photo(s) missing alt text.`,
      fixStep: 3,
    })
  }
  return issues
}
