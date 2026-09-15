/** Single source of truth for the WLB-005 primary-CTA target (AGT-WLB-005). */
export const TOUR_COMPLETION_ROUTE = '/listings/:listingId?tour=complete'

/** 1-based tour steps for AGT-WLB-001…005 (connect → ready). */
export const TOUR_STEPS = {
  connect: 1,
  code: 2,
  waiting: 3,
  drafting: 4,
  ready: 5,
} as const

export type TourStepKey = keyof typeof TOUR_STEPS

export const RESUME_STORAGE_KEY = 'wingcaster.onboarding.whatsapp_deferred_at'
export const RESUME_BANNER_KEY = 'wingcaster.onboarding.whatsapp_resume_banner'

export function buildCompletionPath(listingId: string): string {
  const id = listingId || 'draft'
  return `/listings/${encodeURIComponent(id)}?tour=complete`
}

export function markWhatsAppDeferred(): void {
  try {
    const now = new Date().toISOString()
    localStorage.setItem(RESUME_STORAGE_KEY, now)
    localStorage.setItem(RESUME_BANNER_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function clearWhatsAppResumeBanner(): void {
  try {
    localStorage.removeItem(RESUME_BANNER_KEY)
  } catch {
    /* private mode */
  }
}

export const FIELD_LABELS = {
  address: 'Address',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  price: 'Price',
  area_sqft: 'Area (sqft)',
  description: 'Description',
  photos: 'Photos',
} as const
