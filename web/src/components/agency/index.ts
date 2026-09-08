/**
 * Agency identity primitives — shared across AGN-MEM-005, AGN-SET-005/005b,
 * AGT-REC-006, SHR-PUB-003, and agency dashboard attention cards.
 *
 * Stub extract for Shared Components Prep (CURSOR_SHARED_COMPONENTS_PREP section 3.7).
 * Full business logic lands in consumer-screen waves.
 */

export {
  AgencyIdentityCard,
  type AgencyIdentityCardProps,
} from './AgencyIdentityCard'

export {
  PersonaChip,
  type AgencyPersonaRole,
  type PersonaChipProps,
} from './PersonaChip'

export {
  OwnershipTransferChallenge,
  type OwnershipTransferChallengeProps,
  type OwnershipTransferProofs,
} from './OwnershipTransferChallenge'
