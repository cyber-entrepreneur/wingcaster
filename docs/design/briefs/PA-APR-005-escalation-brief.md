# Screen Brief — PA-APR-005 · Escalate approval (delta from PA-APR-003)

**Layer-2 Delta Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** Inherits the two-person-rule modal-family patterns from anchor `docs/design/briefs/PA-APR-003-two-person-action-confirmation-brief.md` (page-shell env-badge, elevated step-up policy, immutable-audit invariant, controlled-vocabulary reason fields, mutually-exclusive action pill, impact-preview panel, own-record guard). Where the anchor is not yet on disk, treat the PA approval-family invariants encoded in `docs/design/SCREEN_MATRIX_PA.md` §PA-APR-003 as the contract. General brief format follows `docs/design/briefs/SHR-AUT-006-signup-brief.md`. Only the CHANGES from PA-APR-003 are enumerated here — every unspecified concern (focus ring, dark mode, RTL treatment, error banner, session expiry, insufficient permission, keyboard shortcuts, elevated-token TTL, environment badge behavior) is IDENTICAL to the anchor.

Ships as part of the two-person-rule cluster (PA-APR-002 / 003 / 005 / 006) as one indivisible unit per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 79. Unblocks WF-08 (credit-grant), WF-09, and every workflow that consumes `fin.approval_requests` (WF-07/08/09/14/15/17/18/19/20/21/22/23/24/25/27/28) where an approver's authority may be insufficient for the individual request.

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` AND `PA-APR-003-two-person-action-confirmation-brief.md` §Broadcast alignment.** The PA-approval-family invariants (env badge always visible, two-person rule, keyboard-first, immutable audit, step-up policy at 15-minute per-env TTL) apply UNCHANGED.

**PA-APR-005-specific Broadcast deltas:**

- **Modal chrome is IDENTICAL to PA-APR-003** (same `<Dialog>` primitive at `var(--lc-elevation-lg)` on `var(--lc-surface-raised)`, same `var(--lc-radius-lg)`, same `padding: var(--lc-space-xl)`, same 560px max-width). The only structural change is the CONTENT of the modal body — the surrounding shell is the same.
- **Header** shows the icon `ArrowUpRight` (lucide-react) at 24px in `--lc-accent-bold-edge` next to the title "Escalate this decision" (`var(--lc-type-heading-2)`). Subtitle: "Defer this request to a delegate or manager with the authority to decide." (`var(--lc-type-body-sm)` `var(--lc-text-muted)`).
- **Escalation-reason field** — `<Select>` primitive from the controlled vocabulary listed in §Copy table. Field label "Why are you escalating?" (`var(--lc-type-overline)` + `--lc-text-muted`). REQUIRED. `--lc-border-strong` outline; focus reveals the two-tone ring.
- **Target-approver picker** — `<Combobox>` (Radix + shadcn/ui pattern) with server-filtered results as the PA types. Each result row renders as: avatar (24×24 `--lc-radius-pill` initials chip on `--lc-surface-sunken`) + display name (`var(--lc-type-body`) + role chip (`<Badge>` `--lc-accent`-tint) + capability-match glyph (check ● in `--lc-status-published-fg` when the target has `capabilities.escalation_target=true` AND is authorized for THIS request type; muted ○ when generic-senior). Selected row lifts into a chip at the top of the combobox with an `X` chip-clear button. Empty state ("No eligible targets available for this request type. Contact your PA lead.") in `--lc-text-muted` inside a `--lc-surface-sunken` well at `var(--lc-radius-md)`.
- **Notify-target-via-channel picker** — a `<CheckboxGroup>` (custom composition of `<Checkbox>` primitives) with Email pre-checked-and-disabled (always sent, non-optional), then optional Slack + Teams checkboxes (each rendered with a `<ChannelMark>` at 20px + label). Slack/Teams checkboxes are disabled with a muted tooltip ("Slack integration not configured for this tenant") when the integration is not enabled — never hidden.
- **Free-text notes field** — `<Textarea>` primitive at `var(--lc-radius-md)`, min-height 88px, max-length 1000 chars, character count in the field's bottom-right (`var(--lc-type-caption)` `--lc-text-muted`, flips to `--lc-status-danger-fg` at >950). REQUIRED (server audits). Label: "Context for the target approver". Placeholder: "Explain what you'd like them to consider. Kept in the audit log."
- **Impact-preview panel** (inherits from PA-APR-003) is REPLACED here with an **escalation-preview panel** on `--lc-surface-sunken` at `var(--lc-radius-md)`: single line "This request will move to <target-display-name>'s queue with a high-priority sort marker. The original submitter is notified. Your review authority is released." (`var(--lc-type-body-sm)` `var(--lc-text-muted)`; target-display-name in `--lc-text-primary` bold).
- **Confirm button** label: "Send escalation" (`<Button variant="default">` — Broadcast orange `--lc-action-primary`; hover DARKENS to `--lc-action-primary-hover`). Disabled until reason + target + notes are all satisfied. `ArrowUpRight` leading icon.
- **Cancel link** on the left of the footer row, `<Button variant="ghost">`, label "Cancel" — returns to the approval-detail screen with no state change.
- **Re-escalation warning strip** (only rendered when this request has been escalated before): amber `--lc-status-warning-bg` strip at the top of the modal body, above the reason field. Copy: "Escalation hop <N> of 3. After 3 hops the request auto-flags for manual review." with the hop counter in mono tabular.
- **Motion:** modal enter `200ms` `--lc-easing-out`; combobox result drop-in `120ms`; notes-field autofocus after target selected (`var(--lc-duration-fast)`).

Every other Broadcast token / typography / spacing / focus-ring instruction from PA-APR-003 §Broadcast alignment applies verbatim.

---

## Meta

| | |
|---|---|
| Screen ID | PA-APR-005 |
| Screen name | Escalate approval |
| Persona | PA (any current approver; elevated capability pack `approvals`). Server-enforces: submitter of the request CANNOT be the escalator (own-record guard) — UI hides the Escalate action button on the parent detail screen when the current PA is the submitter. |
| Device targets | Desktop 1440px ONLY (modal follows anchor) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Modal opened from `PA-APR-002` / `PA-PKG-005` / `PA-CRD-005b` / `PA-INV-004b` / any workflow-specific approval-detail screen. No dedicated URL. Modal state hoisted to search-param `?action=escalate` for deep-link recovery. |
| Current state | MISSING (UI + backend). See §Backend contract for the new route. |
| Workflow role | role=Escalation. Applies to WF-07/08/09/14/15/17/18/19/20/21/22/23/24/25/27/28. |
| Backend prerequisites | ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context · ✅ `fin.approval_requests` schema · ⏳ `[BE-APR-05]` `POST /api/admin/approvals/:id/escalate` (see §Backend contract) · ⏳ `[BE-APR-05a]` `GET /api/admin/approvals/:id/eligible-escalation-targets?request_type=<kind>` for the combobox · ⏳ `[BE-APR-05b]` migration to add `escalated_from`, `escalation_reason`, `escalation_notes`, `escalation_chain` (jsonb array), `escalation_notify_channels` (jsonb) to `fin.approval_requests` |
| Cluster | Two-person-rule cluster (PA-APR-002/003/005/006) — indivisible unit |

---

## Purpose

The current approver defers this decision to a delegate or manager because the request is out-of-scope for their authority (e.g., a credit grant exceeds their per-approver cap), contentious (submitter is a friend / conflict of interest), or requires domain expertise they lack (e.g., a tax-related package change needs legal review). Escalation does NOT decide the request — it re-routes it. The chain (submitter → first approver → escalated to → decided by) is preserved for audit.

Success outcome: request is moved to the target approver's queue with an escalation marker; the target is notified via email (mandatory) + optional Slack / Teams; the escalating PA loses review authority on this request; PA-APR-001 refreshes so this item disappears from the current PA's queue; a toast on PA-APR-001 confirms "Escalated to <target-display-name>". The audit log records the escalator, target, reason, notes, and notify channels.

---

## Design goals

Deltas from PA-APR-003 §Design goals:

1. **Rationale is mandatory and audit-recorded.** Reason (from vocab) + free-text notes (≥ 10 chars) are both required. Empty rationale = the escalation button stays disabled. No exceptions.
2. **Target picker is server-scoped, never client-guessed.** The combobox queries `/eligible-escalation-targets?request_type=<kind>` — the server decides who has the capability pack AND is a different person than the submitter AND is a different person than the current escalator.
3. **Notify-channel picker defaults to email + surfaces integrations.** Email is always sent; Slack + Teams are optional and only enabled when the integration is configured for the tenant. Never hidden when disabled — a muted tooltip explains why.
4. **Re-escalation is allowed but visibly bounded.** Hop counter (this-hop / max-3) is shown when hop ≥ 2. At hop 3, the modal warns that a 4th escalation would auto-flag for manual review; at hop 4, the escalate action is server-refused and the modal shows a permanent-flag notice instead of the picker.
5. **The escalating PA's authority is released atomically with the transfer.** No dual-review window where both queues show the item.

---

## Layout

Modal opens over the parent approval-detail screen. Backdrop uses `--lc-scrim` at 50% opacity; modal panel is 560px wide, vertically centered, max-height 88vh with body-scroll on overflow.

**Modal header (fixed):**
- Left: `ArrowUpRight` icon (24px, `--lc-accent-bold-edge`) + title "Escalate this decision".
- Right: `X` close button (44px tap target).

**Subtitle row:** "Defer this request to a delegate or manager with the authority to decide."

**Re-escalation warning strip** (conditional — only when hop ≥ 2): amber `--lc-status-warning-bg` strip at the top of the modal body.

**Body (scrollable):**

1. **Request context recap** — collapsed by default `<Accordion>` labeled "About this request" (`var(--lc-type-overline)` header). Expanded content mirrors the parent detail's key facts (request type + summary + submitter + amount / scope if applicable + submitted timestamp). One-tap access; PA doesn't need to close the modal to re-check.
2. **Escalation reason** — `<Select>` (required). Vocab per §Copy table.
3. **Target approver picker** — `<Combobox>` (required). Server-filtered results, empty-state well when no eligible targets.
4. **Notify target via** — `<CheckboxGroup>`. Email pre-checked-disabled; Slack + Teams optional (disabled with tooltip when integration off).
5. **Free-text notes for the target** — `<Textarea>` (required, ≥ 10 chars, ≤ 1000).
6. **Escalation-preview panel** — `--lc-surface-sunken` well.

**Footer (fixed at bottom of modal):**
- Left: `<Button variant="ghost">` "Cancel".
- Right: `<Button variant="default">` "Send escalation" with `ArrowUpRight` leading icon.

---

## Copy (English)

Arabic strings marked `[TRANSLATION-PENDING]` in AR mirror MDX.

| Slot | Copy |
|---|---|
| Modal title | Escalate this decision |
| Modal subtitle | Defer this request to a delegate or manager with the authority to decide. |
| Context accordion header | About this request |
| Reason label | Why are you escalating? |
| Reason placeholder | Select a reason |
| Reason vocab | Out-of-scope authority · Conflict of interest · Requires domain expertise · Contentious / needs discussion · Compliance concern · Other (please explain in notes) |
| Target label | Escalate to |
| Target placeholder | Search a delegate or manager… |
| Target empty state | No eligible targets available for this request type. Contact your PA lead. |
| Target result — cap-match glyph tooltip | Authorized for this request type |
| Target result — generic-senior glyph tooltip | Senior PA — may or may not be authorized for this specific request |
| Notify-channel label | Notify target via |
| Email checkbox | Email (always sent) |
| Slack checkbox | Slack |
| Teams checkbox | Microsoft Teams |
| Integration-disabled tooltip | {Slack\|Teams} integration is not configured for this tenant. |
| Notes label | Context for the target approver |
| Notes placeholder | Explain what you'd like them to consider. Kept in the audit log. |
| Notes helper | Required — minimum 10 characters. Recorded verbatim in the audit trail. |
| Preview panel | This request will move to **{target-display-name}**'s queue with a high-priority sort marker. The original submitter is notified. Your review authority is released. |
| Re-escalation warning | Escalation hop **{N}** of 3. After 3 hops the request auto-flags for manual review. |
| Re-escalation refused (hop 4+) | This request has reached the maximum escalation depth (3 hops). It has been flagged for manual review — a PA lead will pick it up. |
| Cancel | Cancel |
| Confirm | Send escalation |
| Success toast (on PA-APR-001) | Escalated to **{target-display-name}**. They've been notified. |

---

## Component palette

Reuses PA-APR-003's palette — deltas only:

| Element | Primitive |
|---|---|
| Modal shell | `Dialog` from anchor — reused |
| Context recap | `Accordion` (Radix) |
| Reason picker | `Select` (Radix) from anchor's reason-vocab pattern — reused with new vocab |
| Target combobox | `Combobox` (shadcn/ui built on `Command` + `Popover`) — NEW to this brief |
| Notify-channel group | `CheckboxGroup` composition of `Checkbox` primitives — NEW to this brief |
| Channel marks | `<ChannelMark>` at 20px |
| Notes | `Textarea` — reused from anchor |
| Warning strip | `Alert` variant="warning" — reused from anchor |
| Buttons | `Button` variant="default" / "ghost" — reused |

---

## Interactions

**On modal open:** focus lands on the reason `<Select>` trigger. Escape closes the modal; Enter on Confirm submits.

**On reason selected:** if "Other" is picked, the notes field grows a red asterisk marker and the notes-required threshold becomes 30 chars (instead of 10) — reflected in the helper text.

**On target combobox typing:** debounce 150ms, then GET `/api/admin/approvals/:id/eligible-escalation-targets?request_type=<kind>&q=<query>`. Show a spinner in the combobox trailing icon while in flight. Results limited to 20; if more, show a "Refine your search" muted line at the bottom of the dropdown.

**On target selected:** target chip appears at the top of the combobox with initials + name + capability glyph. Focus advances to the notes textarea.

**On notify-channel Slack / Teams unchecked (and re-checked):** local state only; server sees the final selection on Confirm.

**On Confirm click:**
- Validates: reason present + target chip present + notes ≥ 10 chars (30 for "Other") + at least one channel (email is always on, so this is automatic).
- If step-up token stale (>15 min since last elevation): opens `SHR-MFA-007` step-up modal in front, resumes here on success.
- POST to `/api/admin/approvals/:id/escalate` per §Backend contract.
- On 201: closes modal, refreshes PA-APR-001, success toast.
- On 409 (already-decided by another approver mid-flight): shows an error banner inside the modal ("Another PA acted on this request while you were escalating. Refresh the queue to see the outcome.") + a "Refresh queue" primary action that closes the modal and reloads PA-APR-001.
- On 422 (target became ineligible, e.g., went OOO): shows an error banner suggesting to pick a different target. Combobox re-enables; target chip is cleared.
- On 5xx: destructive toast + Confirm re-enables.

**On Cancel:** modal closes, no state change, focus returns to the Escalate button on the parent detail screen.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| Initial | Modal opens | Reason unset, target unset, notes empty, email pre-checked-disabled. Confirm disabled. |
| Reason "Other" selected | Vocab match | Notes-required threshold bumps to 30 chars; helper text updates. |
| Target searching | Combobox typing | Spinner in combobox trailing icon. Results list updates as server responds. |
| Target empty state | Server returned 0 results | Muted well: "No eligible targets available for this request type. Contact your PA lead." Confirm disabled. |
| Target selected | Result clicked | Chip renders at top of combobox with capability glyph. Focus advances to notes. |
| Re-escalation hop ≥ 2 | Server returns `escalation_chain` length ≥ 1 | Amber warning strip renders at top of modal body with hop counter. |
| Re-escalation hop 4+ | Server refuses at eligible-targets query | Picker replaced with a permanent-flag notice. Confirm hidden; only Cancel visible. |
| Slack / Teams disabled | Integration not configured | Checkbox disabled with muted tooltip. |
| Submitting | POST in flight | Confirm shows Loader2 + "Sending…". Modal body disabled. |
| Step-up required | Elevated token stale | SHR-MFA-007 modal opens in front; on success returns here with state preserved. |
| Server 409 already-decided | Race with another approver | Error banner + "Refresh queue" CTA. |
| Server 422 target ineligible | Target OOO or changed | Error banner; combobox re-enables. |
| Server 5xx | Server error | Destructive toast; Confirm re-enables. |
| Success | 201 returned | Modal closes; PA-APR-001 refreshes; success toast. |
| RTL | Locale = ar | Modal mirrors; combobox chip icon flips side. |
| Dark mode | prefers-color-scheme dark | All tokens swap per PA-APR-003. |

---

## Accessibility

Deltas from PA-APR-003 §Accessibility:

- Modal is a focus-trap dialog with `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on the title.
- Combobox implements the WAI-ARIA combobox pattern (arrow-key navigation of results, Enter to select, Escape to close dropdown without closing modal).
- Capability-match glyph on target results has `aria-label` "Authorized for this request type" / "Senior PA — capability match uncertain".
- Character count on notes updates `aria-live="polite"` when ≥ 950.
- Re-escalation warning strip is `role="status"` (not `role="alert"` — non-interruptive).
- Every tap target ≥ 44×44 CSS px including combobox result rows on desktop-with-touch.

---

## Backend contract

**NEW endpoint** — MISSING on the backend as of 2026-09-07. File as `[BE-APR-05]` in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5a alongside the two-person-cluster.

**Endpoint:** `POST /api/admin/approvals/:id/escalate`

**Request body:**
```json
{
  "reason_vocab": "out_of_scope_authority" | "conflict_of_interest" | "requires_domain_expertise" | "contentious" | "compliance_concern" | "other",
  "target_approver_id": "uuid",
  "notes": "min 10 chars, min 30 if reason_vocab=other, max 1000",
  "notify_channels": ["email", "slack", "teams"]
}
```

**Response 201:**
```json
{
  "approval_request": {
    "id": "uuid",
    "status": "PENDING_APPROVAL",
    "escalated_from": "uuid-of-current-approver",
    "escalated_to": "uuid-of-target",
    "escalation_reason": "out_of_scope_authority",
    "escalation_chain": [
      { "from": "...", "to": "...", "at": "iso8601", "reason": "..." }
    ]
  },
  "notifications_dispatched": ["email", "slack"]
}
```

**Response 403 own-record / submitter-cannot-escalate:** `{ "error": "SUBMITTER_CANNOT_ESCALATE" }` — server-enforced separate from UI hide.

**Response 409 already-decided:** `{ "error": "ALREADY_DECIDED", "decided_by": "...", "decided_at": "..." }`.

**Response 422 target ineligible:** `{ "error": "TARGET_INELIGIBLE", "reason": "target_out_of_office" | "target_same_as_submitter" | "target_missing_capability" }`.

**Response 429 max hops reached:** `{ "error": "MAX_HOPS_REACHED", "hop": 4 }` — server refuses; UI shows the permanent-flag notice.

**Companion `GET` endpoint** — `GET /api/admin/approvals/:id/eligible-escalation-targets?request_type=<kind>&q=<query>`. Returns `{ targets: [{ id, display_name, initials, role, capability_match: true|false, out_of_office: false }] }`. Server excludes the submitter identity + the current escalator identity from results.

**Migration** — extend `fin.approval_requests` with `escalated_from uuid null`, `escalated_to uuid null`, `escalation_reason text null`, `escalation_notes text null`, `escalation_chain jsonb null default '[]'::jsonb`, `escalation_notify_channels jsonb null default '[]'::jsonb`. Index on `escalated_to` for queue-sort by escalation priority.

**Audit** — every escalation writes a `fin.audit_events` row of kind `approval.escalated` with `actor`, `target`, `reason`, `notes`, `hop`, `notify_channels`.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/fin/components/EscalateApprovalDialog.tsx`. Mounted from any approval-detail screen via a shared `<ApprovalActionsMenu>` component (also new — hosts Approve / Reject / Escalate / Recall triggers).
- **API helpers:** extend `web/src/lib/api.ts` (or equivalent) with `escalateApproval(id, body)` and `getEligibleEscalationTargets(id, requestType, q)`.
- **Test discipline:**
  - Unit: modal renders, reason vocab enforced, target picker debounces, "Other" bumps notes threshold.
  - Integration: full escalate flow with a mocked target list; race-condition test for 409 already-decided.
  - Server-enforced own-record guard: submitter's escalate button hidden; server-side reject returns 403.
  - Real-Postgres: escalation writes `escalation_chain` + `escalation_notify_channels` correctly; audit event lands; escalated request appears in target's PA-APR-001 with priority sort marker.
- **Broadcast tokens:** `no-raw-hex.test.ts` stays green.
- **RTL:** verified via `screens.rtl.test.tsx` extension for the modal's mirrored layout.

---

## Broadcast alignment callouts (short — anchor governs)

- Modal chrome tokens identical to PA-APR-003 — do NOT invent new elevation, radius, or padding scales.
- Combobox result rows: `--lc-surface-raised` default, `--lc-surface-sunken` on hover, `--lc-action-primary` background at 8% opacity when keyboard-focused.
- Capability-match glyph `●` in `--lc-status-published-fg`; muted `○` in `--lc-text-muted`.
- Confirm button ALWAYS `--lc-action-primary` (Broadcast orange). Hover DARKENS to `--lc-action-primary-hover` — never lightens.
- Amber warning strip uses `--lc-status-warning-bg` + `--lc-status-warning-fg` per token kit.
- Focus rings: two-tone via base CSS — do not override.

---

## Handoff to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster PA escalation modal (PA-APR-005) — MENA real-estate B2B SaaS admin console. Two-person approval rule cluster. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This is a DELTA brief — the modal chrome is identical to PA-APR-003 (approval-action confirmation). Focus on the escalation-specific content: reason vocab, target-approver combobox with capability glyph, notify-channel checkbox group, notes textarea, escalation-preview panel.

First pass: render the desktop 1440px modal in its "target selected + reason chosen + notes typed" state, ready to Send escalation. Show the combobox chip with target initials + name + authorized-check glyph. Reason = "Out-of-scope authority". Notes populated with 2 sentences.

LTR English only for this pass — I'll ask for RTL Arabic, dark mode, re-escalation warning state, and empty-target state as separate follow-ups.

Follow the copy table exactly. Do not invent target-approver names — use "Layla H." / "Ahmed K." placeholders.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now show the re-escalation state at hop 2 of 3 — amber warning strip visible at top of modal body.`
2. `Now the empty-eligible-targets state — muted well replaces the results dropdown.`
3. `Now the hop 4+ permanent-flag state — picker replaced with the flag notice, Confirm hidden.`
4. `Now RTL Arabic at desktop 1440px.`
5. `Now dark mode.`

Save outputs to `web/src/pages/admin/fin/components/EscalateApprovalDialog/mockups/` + screenshots to `docs/design/mockups/PA-APR-005-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 5 iteration states (initial, re-escalation hop 2, empty-targets, hop 4+ permanent flag, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Wave-2 dispatch prompt references this brief + the mockup paths + the anchor PA-APR-003 brief.
- [ ] `[BE-APR-05]`, `[BE-APR-05a]`, `[BE-APR-05b]` filed in kickoff §5a — POST /escalate route, GET /eligible-escalation-targets, and the `fin.approval_requests` column migration.
