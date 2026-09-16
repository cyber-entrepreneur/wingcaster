/**
 * WF-31 ownership-transfer shapes (AGN-SET-005 / AGN-SET-005b / AGT-REC-006).
 *
 * Mirrors the backend serializer in
 * `backend/src/lib/agencies/ownership-transfer.js` (`serializeTransfer` /
 * `enrichTransfer`). Statuses are the raw DB values; `status_display` carries the
 * brief-facing alias (e.g. `pending` → `pending_recipient_accept`).
 */

/** Raw persisted status. */
export type OwnershipTransferStatus =
  | 'pending'
  | 'executed'
  | 'declined'
  | 'cancelled'
  | 'expired'
  | 'reversed'

export interface OwnershipTransferParty {
  user_id: string
  display_name: string | null
  email?: string | null
  avatar_url: string | null
  /** Present on the enriched `target` only. */
  role?: string | null
}

export interface OwnershipTransfer {
  id: string
  agency_id: string
  status: OwnershipTransferStatus
  status_display?: string
  initiator_user_id: string
  target_user_id: string
  rationale: string
  decline_reason: string | null
  initiated_at: string
  expires_at: string
  decided_at: string | null
  executed_at: string | null
  reversed_at: string | null
  reversal_deadline_at: string | null
  acknowledged_by_initiator: boolean
  acknowledged_by_target: boolean
  resolved_at: string | null
  target: OwnershipTransferParty
  initiator: OwnershipTransferParty
}

export type OwnershipTransferBlockReason =
  | 'agency_not_found'
  | 'agency_suspended'
  | 'no_eligible_admins'
  | null

export interface OwnershipTransferEligibility {
  caller_is_owner: boolean
  agency_transferable: boolean
  block_reason: OwnershipTransferBlockReason
  eligible_admin_count: number
}

export interface OwnershipTransferStateResponse {
  transfer: OwnershipTransfer | null
  eligibility: OwnershipTransferEligibility
}

export interface OwnershipTransferOtpResult {
  sent_to: string
  expires_in_seconds: number
  challenge_id: string
  /** Present only in test / soft-fail mode. */
  __test_code?: string
}

export interface OwnershipTransferMutationResult {
  transfer: OwnershipTransfer
  notifications_dispatched?: string[]
}
