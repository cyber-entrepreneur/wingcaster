/**
 * PII + audit primitives (Shared Components Prep §3.10).
 *
 * Used by: PA-ACR-001/002, PA-APR-003 (TwoPersonProgress), PA-AUD-001 (Timeline),
 * PA-USR / PA-SUP / PA-KYC (PIIMask), and WF-07/08/17–25/27–28 two-person surfaces.
 *
 * Stub visual + typed props only — no real audit / vote / timeline APIs.
 */

export {
  PIIMask,
  type PIIMaskProps,
  type PIIMaskKind,
  type PIIMaskAuditContext,
} from './PIIMask'

export {
  TwoPersonProgress,
  type TwoPersonProgressProps,
  type TwoPersonApprover,
  type TwoPersonVote,
  type TwoPersonPendingTone,
} from './TwoPersonProgress'

export {
  Timeline,
  type TimelineProps,
  type TimelineEntry,
  type TimelineEntryStatus,
} from './Timeline'
