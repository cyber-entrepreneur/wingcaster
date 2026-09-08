/**
 * Property Finder per-portal validator.
 *
 * PORTAL_LIST_RESEARCH_2026-09-04.md §C (verbatim):
 *   Property Finder UAE (`AE`) — required: `agency_license`, `broker_id`.
 *     Image: min 1200px, JPG/PNG.
 *   Property Finder other countries (SA/EG/LB/JO/QA/KW/BH/OM) — country-variant
 *     of UAE spec (agency_license + broker_id or documented aliases).
 *     Image: same 1200px JPG/PNG.
 *
 * Documented aliases (non-AE):
 *   agency_license → agency_licence, license_number, commercial_license, fal_license
 *   broker_id      → brokerId, broker_number, agent_id, broker_orn
 *
 * Distinct from `lib/notifications/portals/property_finder.js` (publisher adapter).
 */

import { getCountryCode, requiredFieldCheck } from './fields.js'
import { PROPERTY_FINDER_IMAGE_SPEC, checkImageSpec } from './image-spec.js'

export const PF_COUNTRY_VARIANTS = Object.freeze(['SA', 'EG', 'LB', 'JO', 'QA', 'KW', 'BH', 'OM'])

const UAE_AGENCY_LICENSE = ['agency_license', 'agencyLicense']
const UAE_BROKER_ID = ['broker_id', 'brokerId']

const VARIANT_AGENCY_LICENSE = [
  ...UAE_AGENCY_LICENSE,
  'agency_licence',
  'license_number',
  'licence_number',
  'commercial_license',
  'fal_license',
  'advertiser_license',
]

const VARIANT_BROKER_ID = [
  ...UAE_BROKER_ID,
  'broker_number',
  'agent_id',
  'agentId',
  'broker_orn',
]

export function validate(listing, portalContext = {}) {
  const country = getCountryCode(portalContext, listing)
  const variant = country && country !== 'AE' && PF_COUNTRY_VARIANTS.includes(country)
  const agencyNames = variant ? VARIANT_AGENCY_LICENSE : UAE_AGENCY_LICENSE
  const brokerNames = variant ? VARIANT_BROKER_ID : UAE_BROKER_ID

  const checks = [
    requiredFieldCheck(listing, {
      code: 'required_agency_license',
      names: agencyNames,
      label: 'agency_license',
      expected: variant ? 'agency_license (or country alias)' : 'agency_license',
    }),
    requiredFieldCheck(listing, {
      code: 'required_broker_id',
      names: brokerNames,
      label: 'broker_id',
      expected: variant ? 'broker_id (or country alias)' : 'broker_id',
    }),
    ...checkImageSpec(listing, PROPERTY_FINDER_IMAGE_SPEC),
  ]
  return { checks }
}
