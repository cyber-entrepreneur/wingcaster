# Screen Brief — PA-APR-006 · Recall submission (delta from PA-APR-003)

**Layer-2 Delta Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** Inherits the two-person-rule modal-family patterns from anchor `docs/design/briefs/PA-APR-003-two-person-action-confirmation-brief.md` (page-shell env-badge, elevated step-up policy, immutable-audit invariant, mutually-exclusive action pill, own-record guard, first-writer-wins race handling). Where the anchor is not yet on disk, treat the PA approval-family invariants encoded in `docs/design/SCREEN_MATRIX_PA.md` §PA-APR-003 as the contract. General brief format follows `docs/design/briefs/SHR-AUT-006-signup-brief.md`. Only the CHANGES from PA-APR-003 are enumerated here — every unspecified concern (focus ring, dark mode, RTL treatment, error banner, session expiry, insufficient permission, keyboard shortcuts, environment badge behavior) is IDENTICAL to the anchor.

Ships as part of the two-person-rule cluster (PA-APR-002 / 003 / 005 / 006) as one indivisible unit per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 79. Unblocks the submitter-side abort path for every workflow that consumes `fin.approval_requests` (WF-07/08/09/14/15/17/18/19/20/21/22/23/24/25/27/28) — prevents the "I noticed a mistake in my own submission but it's already in the queue" trap.

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` AND `PA-APR-003-two-person-action-confirmation-brief.md` §Broadcast alignment.** The PA-approval-family invariants (env badge always visible, keyboard-first, immutable audit) apply UNCHANGED. Step-up policy applies IDENTICALLY — recall is a write to `fin.approval_requests` and therefore requires a fresh elevated token per the 15-minute per-env TTL.

**PA-APR-006-specific Broadcast deltas:**

- **Modal chrome is IDENTICAL to PA-APR-003** (same `<Dialog>` primitive at `var(--lc-elevation-lg)` on `var(--lc-surface-raised)`, same `var(--lc-radius-lg)`, same `padding: var(--lc-space-xl)`, same 560px max-width). Only the CONTENT of the modal body changes.
- **Header** shows the icon `Undo2` (lucide-react) at 24px in `--lc-status-danger-fg` next to the title "Withdraw this request" (`var(--lc-type-heading-2)`). Subtitle: "You submitted this request. You can withdraw it before another PA decides." (`var(--lc-type-body-sm)` `var(--lc-text-muted)`).
- **Request-summary panel** sits at the top of the modal body on `--lc-surface-sunken` at `var(--lc-radius-md)`, `padding: var(--lc-space-md)`. Renders a 4-row key/value grid: Request type (e.g., "Package version publish"), Entity (e.g., "Package `growth-tier` v14"), Submitted-at (mono, tabular), Current status (`<Badge>` — usually `Pending approval` in `--lc-status-underOffer-{bg,fg}` with `◐` glyph). Labels in `var(--lc-type-overline)` `--lc-text-muted`; values in `var(--lc-type-body)` `--lc-text-primary`.
- **Why-withdrawing free-text field** — `<Textarea>` primitive at `var(--lc-radius-md)`, min-height 88px, max-length 1000 chars, character count in the field's bottom-right (`var(--lc-type-caption)` `--lc-text-muted`, flips to `--lc-status-danger-fg` at >950). REQUIRED (server audits). Label: "Why are you withdrawing?". Placeholder: "Explain what you'll change before resubmitting. Kept in the audit log — never shown as blame to reviewers."
- **Outcome-preview panel** on `--lc-surface-sunken` at `var(--lc-radius-md)`: renders as a 2-line description. Line 1: "This request will be marked **Withdrawn** and the underlying **{entity-type}** will return to Draft." (`var(--lc-type-body-sm)` `--lc-text-primary` with the bold word in `--lc-text-primary` heavy). Line 2: "Any PA currently reviewing this request will see a 'Withdrawn by submitter' notice on their next action." (`var(--lc-type-body-sm)` `--lc-text-muted`).
- **Withdraw button** label: "Withdraw request" (`<Button variant="destructive">` — Broadcast destructive style; hover DARKENS per `--lc-status-danger` scale). `Undo2` leading icon. Destructive styling per anchor's Reject-button token set.
- **Cancel link** on the left of the footer row, `<Button variant="ghost">`, label "Keep request open" — returns to the parent detail screen with no state change.
- **In-flight-execution warning strip** (only rendered when server race pre-check indicates another approver is actively viewing the request): amber `--lc-status-warning-bg` strip above the outcome-preview panel. Copy: "Another PA is viewing this request right now. If they decide before you withdraw, your withdrawal will fail." No blocking — the strip is informational only.
- **Motion:** modal enter `200ms` `--lc-easing-out`; summary panel + preview panel render immediately (no stagger); no confetti / no celebration — this is a corrective action.

Every other Broadcast token / typography / spacing / focus-ring instruction from PA-APR-003 §Broadcast alignment applies verbatim.

---

## Meta

| | |
|---|---|
| Screen ID | PA-APR-006 |
| Screen name | Recall submission |
| Persona | PA (ORIGINAL SUBMITTER ONLY — server-enforced). UI hides the Withdraw entry-point button on any PA who is not the submitter. Server rejects the endpoint call with 403 if any other PA identity attempts it. |
| Device targets | Desktop 1440px ONLY |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Modal opened from the submitter's own view of their pending request — typically PA-PKG-002 (my draft package with pending submission) / PA-CRD-002 (my credit-grant submission) / any workflow-specific detail screen where I am the submitter. Modal state hoisted to search-param `?action=withdraw` for deep-link recovery. |
| Current state | MISSING (UI + backend). See §Backend contract for the new route. |
| Workflow role | role=Recall. Applies to WF-07/08/09/14/15/17/18/19/20/21/22/23/24/25/27/28. |
| Backend prerequisites | ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context · ✅ `fin.approval_requests` schema · ⏳ `[BE-APR-06]` `POST /api/admin/approvals/:id/withdraw` (see §Backend contract) · ⏳ `[BE-APR-06a]` migration to add `WITHDRAWN` to `fin.approval_requests.status` enum + `withdrawn_at`, `withdrawn_by`, `withdrawal_reason` columns · ⏳ `[BE-APR-06b]` server-side entity revert-to-DRAFT trigger for each workflow's target table (packages / credit_grants / invoices / etc.) · ⏳ `[BE-APR-06c]` optional real-time "another approver viewing" pre-check endpoint for the amber warning strip |
| Cluster | Two-person-rule cluster (PA-APR-002/003/005/006) — indivisible unit |

---

## Purpose

The ORIGINAL SUBMITTER of a pending approval request withdraws it before another approver decides. Prevents the "I noticed a mistake in my own submission but it's already in the queue" trap and reduces embarrassing rejections. Withdraw does NOT decide the request — it aborts the entire review cycle and returns the underlying entity (package version / credit grant / invoice adjustment / etc.) to DRAFT so the submitter can fix and resubmit.

Success outcome: `fin.approval_requests.status` moves to `WITHDRAWN`; the underlying entity's status returns to `DRAFT`; the item disappears from PA-APR-001 for every other approver; any approver who had the detail screen open sees a "This request was withdrawn by the submitter" toast on their next action (approve / reject / escalate); the audit log records who withdrew, when, and why.

---

## Design goals

Deltas from PA-APR-003 §Design goals:

1. **Withdraw is the submitter's escape hatch, not a review action.** Copy and layout emphasize that this is a corrective self-service — never framed as "decline" or "reject". The submitter is aborting their own request, not judging it.
2. **Rationale is required and audit-recorded.** Free-text "why are you withdrawing" is mandatory (≥ 10 chars). The reason lands in `fin.approval_requests.withdrawal_reason` and the audit log. Explicit copy tells the submitter the reason is NEVER shown to reviewers as blame — it exists for future audit context (e.g., "why did the pricing team pull three package-publish requests in one week?").
3. **Blast radius is named plainly.** The outcome-preview panel says which entity type will revert to DRAFT and what will happen to any approver mid-review. No abstract "Are you sure?" placeholders.
4. **Race with a mid-flight approve is handled gracefully.** First-writer-wins on the server. If an approver clicks Approve at the same instant the submitter clicks Withdraw, one succeeds atomically and the other gets a clear, non-scary error banner explaining what happened.
5. **No undo for withdraw itself.** Withdraw is intentionally terminal for the request row — the audit trail requires it. The submitter resubmits from a fresh DRAFT.

---

## Layout

Modal opens over the parent detail screen (typically PA-PKG-002 / PA-CRD-002 / any workflow-specific detail). Backdrop uses `--lc-scrim` at 50% opacity; modal panel is 560px wide, vertically centered, max-height 88vh with body-scroll on overflow.

**Modal header (fixed):**
- Left: `Undo2` icon (24px, `--lc-status-danger-fg`) + title "Withdraw this request".
- Right: `X` close button (44px tap target).

**Subtitle row:** "You submitted this request. You can withdraw it before another PA decides."

**Body (scrollable):**

1. **Request-summary panel** — `--lc-surface-sunken` well, 4-row key/value grid (Request type, Entity, Submitted-at, Current status).
2. **In-flight-execution warning strip** (conditional) — amber `--lc-status-warning-bg` strip when server pre-check indicates another PA is actively viewing.
3. **Why-withdrawing textarea** — `<Textarea>` (required, ≥ 10 chars, ≤ 1000).
4. **Outcome-preview panel** — 2-line description on `--lc-surface-sunken` well.

**Footer (fixed at bottom of modal):**
- Left: `<Button variant="ghost">` "Keep request open".
- Right: `<Button variant="destructive">` "Withdraw request" with `Undo2` leading icon.

---

## Copy (English)

Arabic strings marked `[TRANSLATION-PENDING]` in AR mirror MDX.

| Slot | Copy |
|---|---|
| Modal title | Withdraw this request |
| Modal subtitle | You submitted this request. You can withdraw it before another PA decides. |
| Summary — request type label | Request type |
| Summary — entity label | Entity |
| Summary — submitted-at label | Submitted |
| Summary — current status label | Current status |
| Reason label | Why are you withdrawing? |
| Reason placeholder | Explain what you'll change before resubmitting. Kept in the audit log — never shown as blame to reviewers. |
| Reason helper | Required — minimum 10 characters. Recorded verbatim in the audit trail. Reviewers see only that you withdrew, not why. |
| Preview line 1 | This request will be marked **Withdrawn** and the underlying **{entity-type}** will return to Draft. |
| Preview line 2 | Any PA currently reviewing this request will see a "Withdrawn by submitter" notice on their next action. |
| In-flight warning | Another PA is viewing this request right now. If they decide before you withdraw, your withdrawal will fail. |
| Cancel | Keep request open |
| Confirm | Withdraw request |
| Success toast (on origin screen) | Request withdrawn. **{entity-type}** returned to Draft — edit and resubmit when ready. |
| Race-lost error banner | This request was decided moments ago — your withdrawal was too late. The outcome is now shown below. |
| Own-record guard tooltip (on hidden Withdraw button surface) | Only the original submitter can withdraw this request. |

---

## Component palette

Reuses PA-APR-003's palette — deltas only:

| Element | Primitive |
|---|---|
| Modal shell | `Dialog` from anchor — reused |
| Summary key/value grid | `<dl>` semantic list with CSS grid; no new primitive |
| Warning strip | `Alert` variant="warning" — reused from anchor |
| Reason field | `Textarea` — reused from anchor |
| Preview well | `<div>` on `--lc-surface-sunken`; no new primitive |
| Cancel button | `Button` variant="ghost" |
| Withdraw button | `Button` variant="destructive" — reused from anchor's Reject-button token set |
| Status badge in summary | `Badge` — reused from PA-APR-002 status token vocabulary |

---

## Interactions

**On modal open:** focus lands on the reason `<Textarea>`. Escape closes the modal; Enter on Confirm submits (Ctrl+Enter to be safe when inside textarea).

**On reason typing:** character count updates; helper text stays visible.

**On Confirm click:**
- Validates: reason ≥ 10 chars.
- If step-up token stale (>15 min since last elevation): opens `SHR-MFA-007` step-up modal in front, resumes here on success.
- POST to `/api/admin/approvals/:id/withdraw` per §Backend contract.
- On 200: closes modal; parent detail screen re-fetches and shows the underlying entity in DRAFT; success toast fires on parent.
- On 409 already-decided (race lost): shows the race-lost error banner INSIDE the modal + a "Show outcome" primary action that closes the modal and scrolls the parent detail screen to the decision result. NO destructive toast — the copy handles it.
- On 403 SUBMITTER_ONLY (shouldn't happen from UI since the entry point is hidden, but server enforces): error banner "Only the original submitter can withdraw this request" + auto-closes after 4s.
- On 5xx: destructive toast + Confirm re-enables.

**On Cancel:** modal closes, no state change, focus returns to the parent detail screen's Withdraw entry-point button.

**On approver-side sync (background):** when a withdraw succeeds, the server publishes an event (`approval.withdrawn`) that any other PA session subscribed to this approval's detail screen consumes. Their next action attempt (approve / reject / escalate) returns 409 with `WITHDRAWN` and the client shows the "This request was withdrawn by the submitter" toast at the top of their PA-APR-002 / workflow-specific detail screen.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| Initial | Modal opens | Summary panel populated from parent detail; reason empty; Confirm disabled. |
| Reason valid | ≥ 10 chars typed | Confirm enables. |
| In-flight warning shown | Server pre-check detects other PA viewing | Amber strip renders between summary and reason. Not blocking. |
| Submitting | POST in flight | Confirm shows Loader2 + "Withdrawing…". Modal body disabled. |
| Step-up required | Elevated token stale | SHR-MFA-007 modal opens in front; on success returns here with state preserved. |
| Race lost (409) | Another PA decided mid-flight | Error banner replaces preview panel; "Show outcome" CTA replaces Confirm. Cancel becomes "Close". |
| Server 403 SUBMITTER_ONLY | Non-submitter reached the endpoint | Error banner + auto-close after 4s. Entry point on parent should never allow this — this is a defense-in-depth surface. |
| Server 5xx | Server error | Destructive toast; Confirm re-enables. |
| Success | 200 returned | Modal closes; parent re-fetches; success toast on parent. |
| Already-withdrawn (concurrent submitter double-click) | Server returns 409 with reason=ALREADY_WITHDRAWN | Non-destructive info banner ("This request was already withdrawn."); Confirm hides; footer shows only "Close". |
| RTL | Locale = ar | Modal mirrors; icon flips side. |
| Dark mode | prefers-color-scheme dark | All tokens swap per PA-APR-003. |

---

## Accessibility

Deltas from PA-APR-003 §Accessibility:

- Modal is a focus-trap dialog with `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on the title.
- Warning strip is `role="status"` (not `role="alert"` — non-interruptive).
- Race-lost error banner is `role="alert"` (interruptive — SR announces the outcome immediately).
- Character count on reason updates `aria-live="polite"` when ≥ 950.
- Withdraw button announces `aria-describedby` pointing at the outcome-preview panel so SR users hear the blast-radius description before confirming.
- Every tap target ≥ 44×44 CSS px.
- Reason textarea has visible `<label>` (not just placeholder).

---

## Backend contract

**NEW endpoint** — MISSING on the backend as of 2026-09-07. File as `[BE-APR-06]` in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5a alongside the two-person-cluster.

**Endpoint:** `POST /api/admin/approvals/:id/withdraw`

**Request body:**
```json
{
  "reason": "min 10 chars, max 1000"
}
```

**Server behavior (atomic transaction):**
1. Assert the caller is the `submitted_by` identity on the approval_requests row. On mismatch → 403 `SUBMITTER_ONLY`.
2. Assert the row's current status is `REQUESTED` or `PENDING_APPROVAL`. On any other status (APPROVED / REJECTED / WITHDRAWN / EXPIRED) → 409 with the specific error code.
3. UPDATE the approval_requests row: `status = 'WITHDRAWN'`, `withdrawn_at = now()`, `withdrawn_by = caller`, `withdrawal_reason = body.reason`.
4. UPDATE the underlying entity row (via a workflow-specific handler map — packages, credit_grants, invoice_adjustments, etc.): set its status back to `DRAFT`. If the entity is missing / already-deleted → 409 `ENTITY_NOT_RECOVERABLE`.
5. INSERT `fin.audit_events` row of kind `approval.withdrawn` with `actor`, `reason`, `entity_type`, `entity_id`.
6. PUBLISH `approval.withdrawn` event (server-sent / websocket / poll-based — depends on existing infra) for approver-side sync.
7. Return 200 with the updated row + entity-revert confirmation.

**Response 200:**
```json
{
  "approval_request": {
    "id": "uuid",
    "status": "WITHDRAWN",
    "withdrawn_at": "iso8601",
    "withdrawn_by": "uuid",
    "withdrawal_reason": "..."
  },
  "entity": {
    "type": "package_version" | "credit_grant" | "invoice_adjustment" | ...,
    "id": "uuid",
    "status": "DRAFT"
  }
}
```

**Response 403 `SUBMITTER_ONLY`:** `{ "error": "SUBMITTER_ONLY" }` — server-enforced separate from UI hide.

**Response 409 `ALREADY_DECIDED`:** `{ "error": "ALREADY_DECIDED", "decided_by": "...", "decided_at": "...", "decision": "APPROVED" | "REJECTED" }`.

**Response 409 `ALREADY_WITHDRAWN`:** `{ "error": "ALREADY_WITHDRAWN", "withdrawn_at": "..." }`.

**Response 409 `ENTITY_NOT_RECOVERABLE`:** `{ "error": "ENTITY_NOT_RECOVERABLE", "entity_type": "...", "entity_id": "..." }` — should be rare; indicates a data-integrity concern.

**Migration** — extend `fin.approval_requests.status` enum with `WITHDRAWN`. Add columns `withdrawn_at timestamptz null`, `withdrawn_by uuid null`, `withdrawal_reason text null`. Add a partial index on `status='WITHDRAWN'` for audit queries.

**Audit** — every withdraw writes a `fin.audit_events` row of kind `approval.withdrawn` with `actor`, `reason`, `entity_type`, `entity_id`. The reason is NEVER surfaced to reviewers — only to auditors via PA-AUD-001.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/fin/components/WithdrawApprovalDialog.tsx`. Mounted from the shared `<ApprovalActionsMenu>` component (introduced alongside PA-APR-005) — but ONLY visible when `currentUser.id === approval.submitted_by`. The menu itself filters entries by capability; the Withdraw entry is gated on submitter identity match.
- **Entry-point placement:** every workflow-specific detail screen that shows a pending approval request MUST render the `<ApprovalActionsMenu>` in its header actions row. Existing screens to update: PA-PKG-002, PA-CRD-002, PA-INV-004b, and any others introduced with the two-person-rule cluster.
- **Approver-side sync:** extend the existing detail-screen data fetcher to react to the `approval.withdrawn` event (or fall back to a polling refresh every 30s). On next action attempt post-withdraw, catch 409 and show a top-of-screen `<Toast>` "This request was withdrawn by the submitter." with a "Back to queue" link.
- **API helpers:** extend `web/src/lib/api.ts` with `withdrawApproval(id, body)`.
- **Test discipline:**
  - Unit: modal renders, reason min-length enforced, entry-point button hidden for non-submitters.
  - Integration: full withdraw flow — approval row moves to WITHDRAWN, underlying entity to DRAFT, item disappears from PA-APR-001.
  - Race: submitter withdraws while another PA is mid-approve — first-writer-wins asserted; loser sees the correct 409 error path.
  - Server-enforced submitter-only guard: non-submitter API call returns 403 even if UI is spoofed.
  - Real-Postgres: audit event lands; entity revert-to-DRAFT is atomic with the status change.
- **Broadcast tokens:** `no-raw-hex.test.ts` stays green.
- **RTL:** verified via `screens.rtl.test.tsx` extension for the modal's mirrored layout.

---

## Broadcast alignment callouts (short — anchor governs)

- Modal chrome tokens identical to PA-APR-003 — do NOT invent new elevation, radius, or padding scales.
- Header icon `Undo2` in `--lc-status-danger-fg` (destructive-hued but small; the icon is signal, not surface color).
- Summary-panel labels use `var(--lc-type-overline)` + `--lc-text-muted`; values `var(--lc-type-body)` + `--lc-text-primary`.
- Status badge in summary uses the `--lc-status-*` token family per PA-APR-002 vocabulary (`draft`, `published`, `underOffer`, etc.). Always tint + glyph + label — never color alone.
- Withdraw button uses `<Button variant="destructive">` — hover DARKENS per `--lc-status-danger` scale. Never lightens.
- Amber warning strip uses `--lc-status-warning-bg` + `--lc-status-warning-fg` per token kit.
- Focus rings: two-tone via base CSS — do not override.

---

## Handoff to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster PA "withdraw my submission" modal (PA-APR-006) — MENA real-estate B2B SaaS admin console. Two-person approval rule cluster. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This is a DELTA brief — the modal chrome is identical to PA-APR-003 (approval-action confirmation). Focus on the withdraw-specific content: request-summary key/value grid, why-withdrawing textarea, outcome-preview panel, destructive Withdraw button.

First pass: render the desktop 1440px modal in its "reason typed, ready to withdraw" state. Summary shows: Request type = "Package version publish", Entity = "growth-tier v14", Submitted = "Sep 6, 2026 · 14:32", Current status = "Pending approval" (underOffer badge with ◐ glyph). Reason populated with 2 sentences.

LTR English only for this pass — I'll ask for RTL Arabic, dark mode, in-flight-warning state, and race-lost state as separate follow-ups.

Follow the copy table exactly. Do not fabricate PA identities in the summary.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now show the in-flight-warning state — amber strip visible between summary and reason.`
2. `Now the race-lost state — error banner replaces the outcome-preview; footer shows only "Show outcome" and "Close".`
3. `Now the already-withdrawn state — info banner, Confirm hidden.`
4. `Now RTL Arabic at desktop 1440px.`
5. `Now dark mode.`

Save outputs to `web/src/pages/admin/fin/components/WithdrawApprovalDialog/mockups/` + screenshots to `docs/design/mockups/PA-APR-006-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 5 iteration states (initial, in-flight-warning, race-lost, already-withdrawn, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Wave-2 dispatch prompt references this brief + the mockup paths + the anchor PA-APR-003 brief.
- [ ] `[BE-APR-06]`, `[BE-APR-06a]`, `[BE-APR-06b]`, `[BE-APR-06c]` filed in kickoff §5a — POST /withdraw route, WITHDRAWN enum + columns migration, per-workflow entity revert-to-DRAFT handler map, optional real-time "other approver viewing" pre-check.
