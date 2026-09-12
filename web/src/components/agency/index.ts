/**
 * Agency identity primitives — shared across AGN-MEM-005, AGN-SET-005/005b,
 * AGT-REC-006, SHR-PUB-003, and agency dashboard attention cards.
 *
 * Shared Components Prep (CURSOR_SHARED_COMPONENTS_PREP §3.7) + AGN-MEM-005 flesh-out.
 */

export {
  AgencyIdentityCard,
  type AgencyIdentityCardProps,
} from './AgencyIdentityCard'

export {
  PersonaChip,
  type AgencyPersonaRole,
  type PersonaChipProps,
  type RolePersonaChipProps,
  type ApplyPersonaChipProps,
} from './PersonaChip'

export {
  OwnershipTransferChallenge,
  type OwnershipTransferChallengeProps,
  type OwnershipTransferProofs,
} from './OwnershipTransferChallenge'

export {
  OwnerNoteCallout,
  type OwnerNoteCalloutProps,
} from './OwnerNoteCallout'

export {
  AgencyEmptyState,
  type AgencyEmptyStateProps,
  type AgencyEmptyStateVariant,
} from './AgencyEmptyState'

export {
  ApplicationSuccessPanel,
  type ApplicationSuccessPanelProps,
} from './ApplicationSuccessPanel'

export {
  GuestSignupCollapsible,
  isGuestSignupValid,
  EMPTY_IDENTITY_FORM_VALUES as GUEST_EMPTY_IDENTITY_FORM_VALUES,
  type GuestSignupCollapsibleProps,
} from './GuestSignupCollapsible'

export {
  AgencyApplicationForm,
  AVAILABILITY_OPTIONS,
  REFERRAL_OPTIONS,
  mapRefQueryToReferral,
  type AgencyApplicationFormProps,
  type ReferralValue,
} from './AgencyApplicationForm'
