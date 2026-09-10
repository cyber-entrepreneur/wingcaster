/**
 * PA queue-family primitives (`web/src/components/queue/`).
 *
 * Anchor brief: PA-MOD-001 (portal moderation queue).
 * Consumers: AGN-MEM-002 (first agency-side consumer), PA-MOD-001, PA-ACR-001,
 * PA-PVA-008, PA-PVA-009, PA-PKG-003 (and PA-APR-001 when wired).
 *
 * ## QUEUE_INVARIANTS (7 — do not weaken in consumers)
 *
 * 1. **env-badge-always-visible + env-scoped data** — Env badge (PA-NAV-001) remains
 *    visible for the lifetime of any PA queue screen. List + action calls are scoped
 *    to the current env (`X-Wingcaster-Env`); LIVE and TEST rows never co-mingle.
 *    Agency consumers may omit the env-badge slot when not on a PA surface.
 *
 * 2. **two-person rule** — Approvals of one's own submissions (or high-value cases
 *    requiring a second approver) are blocked server-side and hidden / disabled in UI.
 *
 * 3. **bulk-reject-requires-reason + bulk-approve-count-confirm** — Bulk reject /
 *    request-info MUST capture a shared reason (vocab + notes). Bulk approve MUST
 *    open a count-confirm dialog before commit.
 *
 * 4. **step-up for high-risk + bulk > 5** — SHR-MFA-007 step-up is required for any
 *    High-risk-tier decision and for bulk actions with more than 5 rows (always for
 *    bulk reject > 5 per PA-MOD-001).
 *
 * 5. **immutable audit** — Every decision writes to immutable audit (PA-AUD-001).
 *    UI does not offer delete / rewrite of audit events.
 *
 * 6. **5s undo grace for single-row only** — Single-row approve/reject may offer a
 *    5-second Undo toast. Bulk decisions commit immediately — no undo affordance.
 *    (PA-ACR-001 may extend single-row grace to 30s on the detail screen; still not bulk.)
 *
 * 7. **keyboard-first** — J/K navigate, A/R/I act, Enter opens detail, X toggles
 *    selection, Shift+A selects visible, `.` refreshes, `?` opens shortcuts, Esc
 *    clears/closes. Pointer-only critical actions are an anti-pattern.
 *
 * ### Bulk omission (family deviation)
 * Set `PAQueueBulkBar` / table `showBulk={false}` / `selectable={false}` for
 * WF-04 (PA-ACR-001), WF-05 (PA-PVA-008), and Wave-1 AGN-MEM-002 (bulk deferred
 * to Phase 2 per CURSOR_SCREEN_WAVE_1_WF02_SIGNUP §8) — PII / market-impact /
 * hiring-wave safety.

 * ### Bulk omission / restriction (family deviations)
 * - WF-04 (PA-ACR-001): set `PAQueueBulkBar` / table `showBulk={false}` /
 *   `selectable={false}` — PII safety (no bulk at all).
 * - WF-05 (PA-PVA-008): keep bulk selectable, but pass
 *   `actions={['reject','request_info']}` — confirm-remove / quarantine are
 *   deliberately omitted because removal re-runs valuations market-wide.

 *
 * Additive filter props (`hideRiskTier`, `withinOptions`, `withinLabel`,
 * `searchPlaceholder`) keep PA-MOD-001 importable verbatim while letting
 * AGN-MEM-002 configure Applied-within + hide risk.
 */

export {
  PAQueueFilterStrip,
  type PAQueueFilterStripProps,
  type PAQueueFilterValues,
  type PAQueueStatusOption,
  type PAQueueRiskTier,
  type PAQueueSubmittedWithin,
} from './PAQueueFilterStrip'

export {
  PAQueueTable,
  type PAQueueTableProps,
  type PAQueueColumn,
  type PAQueueRow,
} from './PAQueueTable'

export {
  PAQueueBulkBar,
  type PAQueueBulkBarProps,
  type PAQueueBulkAction,
} from './PAQueueBulkBar'

export {
  PAQueueBulkApproveDialog,
  type PAQueueBulkApproveDialogProps,
} from './PAQueueBulkApproveDialog'

export {
  PAQueueBulkReasonDialog,
  type PAQueueBulkReasonDialogProps,
  type PAQueueBulkReasonMode,
  type PAQueueReasonOption,
} from './PAQueueBulkReasonDialog'

export {
  PAQueueKeyboardShortcutsPanel,
  PA_QUEUE_DEFAULT_SHORTCUTS,
  type PAQueueKeyboardShortcutsPanelProps,
  type PAQueueKeyboardShortcut,
} from './PAQueueKeyboardShortcutsPanel'
