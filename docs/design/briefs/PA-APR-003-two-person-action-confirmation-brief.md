# Screen Brief — PA-APR-003 · Two-person action confirmation (WF-20 execute surface — ANCHOR)

**Layer-2 Anchor Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Anchor brief for the WF-20 two-person execute family.** This is the terminal action-commit surface behind every workflow that routes through `fin.approval_requests` — WF-07 package publishing, WF-08 credit grant, WF-09 rate-card change, WF-14/15/17/18/19/20/21/22/23/24/25/27/28 (see `SCREEN_MATRIX_PA.md` §Cross-cutting families "Two-person rule cluster"). Every workflow-specific approval-detail screen (`PA-PKG-005`, `PA-CRD-005b`, `PA-INV-004b`, etc.) hands off to THIS modal to physically commit the action after both approvers have signed off — and every server-side execute is atomic behind this one endpoint.

Wave 2 (Week 6 — two-person-rule UI cluster) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 51 + §6 Week 6. Pairs with `PA-APR-005` (escalation) + `PA-APR-006` (recall). Downstream: on Confirm, PA returns to `PA-APR-001` (approvals queue) with a success toast whose CTA deep-links to the workflow's outcome screen (`PA-CRD-006` for credit grants, `PA-PKG-002` for packages, `PA-INV-004` for invoice adjustments, etc.).

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts (referenced by PA-APR-005 escalation and PA-APR-006 recall):**

- **Modal shell.** `<AlertDialog>` at `var(--lc-elevation-lg)`, `background: var(--lc-surface-raised)`, `border-radius: var(--lc-radius-xl)`, `padding: var(--lc-space-2xl)`, max-width `640px` (desktop only — this surface never renders under 1024px viewport). Backdrop `--lc-z-modal` with a `--lc-surface-inverse` scrim at 60% opacity.
- **Environment badge (PA-NAV-001).** ALWAYS visible in the top bar behind the modal; when env=TEST the persistent warning strip stays visible above the backdrop and the modal itself carries a small inline `TEST` chip (`--lc-status-warning-{bg,fg}` + ▲) beside the title — a two-person execute in TEST must feel unambiguously distinct from LIVE. On LIVE, the modal carries a small `LIVE` chip (`--lc-status-published-{bg,fg}` + ● dot) beside the title so a screenshot from this modal can never be mistaken for the wrong env.
- **Modal title.** "Confirm and execute" — `var(--lc-type-heading-2)` (600 21/28 IBM Plex Sans). Sub-title beneath in `var(--lc-type-body-sm)` `var(--lc-text-muted)`: "Workflow {WF-code} · Request #{last6}". The `#{last6}` renders as `<Numeric>` (mono + tabular).
- **Request summary block.** Sits directly under the title. `<Card>` on `var(--lc-surface-sunken)`, `var(--lc-radius-lg)`, `padding: var(--lc-space-lg)`, no elevation. Contains four fields laid out as a 2×2 `<dl>` grid: **Action** (e.g. "Grant 50,000 credits to Elite Real Estate Dubai") · **Value tier** (badge — Standard / Elevated / High-value) · **Submitted by** (avatar + display name + submission timestamp — mono, tabular; full ISO on hover) · **Assigned approvers** (chip stack of avatars with initials).
- **Two-person progress indicator** — REUSE the `<TwoPersonProgress>` primitive shipped by PA-ACR-002 at `web/src/components/ui/two-person-progress.tsx`. Horizontal 2-step bar: step 1 "First approver" (filled with first approver's initials + ● + timestamp of first sign-off); step 2 "Second approver" (filled with current PA's initials + ○ pulsing while pending, ● + timestamp once cast). Colors: completed step `--lc-status-published-{bg,fg,dot}` + ● glyph; pending step `--lc-status-warning-{bg,fg,dot}` + ○ glyph. Non-clickable — informational only. Sits between the summary block and the diff panel.
- **Diff panel.** `<Card>` on `var(--lc-surface-raised)`, `var(--lc-elevation-sm)`, `var(--lc-radius-lg)`, `padding: var(--lc-space-lg)`. Section title "What will change" (`var(--lc-type-heading-3)`). Body: a `<table>`-shaped list of changed fields, one row per field: `field name` (`var(--lc-type-overline)`, `--lc-text-muted`) · `before` (mono, `--lc-text-secondary`, strikethrough via `text-decoration-line: line-through` with `--lc-text-muted` strike color) · `→` arrow glyph · `after` (mono, `--lc-status-published-fg`, bolded via `font-weight: 600`). Numeric before/after values via `<Numeric>` (money in explicit currency: `AED 50,000.00`). Diff panel scrolls internally at `max-height: 240px` if more than 6 changed fields.
- **Risk-signals section** (conditional — appears only when server returns `risk_signals[]`). `<Card>` on `--lc-surface-raised`, `--lc-elevation-sm`, `--lc-radius-lg`, `padding: var(--lc-space-lg)`. Section title "Risk signals" (`var(--lc-type-heading-3)`) with a `--lc-status-warning-fg` ▲ prefix glyph. Body: unordered list of signals, each row = signal glyph (● info / ▲ warn / ◆ danger per severity) + signal label + tooltip on hover for the full derivation payload. Never color-alone.
- **Ledger-impact preview** (conditional — appears only when `ledger_impact != null`, i.e. financial actions: credit grants, invoice adjustments, rate-card changes, refund executions, vendor payouts). `<Card>` on `--lc-surface-sunken`, `--lc-radius-lg`, `padding: var(--lc-space-lg)`. Section title "Ledger impact" (`var(--lc-type-heading-3)`). Body: a tiny debit/credit table — `Account` · `Debit` · `Credit` — with columns totaled at the bottom (totals must balance to zero — surface a destructive banner if the server preview does not balance). Every amount via `<Numeric>` with explicit currency. Below the table a plain line "Posts to {env} ledger on confirm." with the env chip inline.
- **Consent-to-proceed checkbox.** ALWAYS present. `<Checkbox>` + label "I have reviewed the diff, risk signals, and ledger impact — proceed." Label uses `var(--lc-type-body)`. Confirm button remains disabled until checked.
- **Type-to-confirm text field** (conditional — appears only for `value_tier=high_value`). Below the consent checkbox. Label: "Type **{phrase}** to confirm" where `{phrase}` renders as `<code>` inline in `var(--lc-font-mono)` with `--lc-status-warning-bg` background. `<Input>` beneath the label, `var(--lc-font-mono)`, `tabular-nums`, `autocomplete="off"`, `spellcheck="false"`, `autofocus` when the field mounts. Confirm button additionally requires exact-match (case-sensitive; whitespace-trimmed only at the outer ends) between input value and phrase. Mismatch → inline error `--lc-status-danger-fg` "Doesn't match. Type the phrase exactly."
- **Confirmation phrase generation.** Server-generated per request, 4-word Diceware-style token drawn from a stable wordlist — e.g. `"quiet-copper-lantern-drift"`. Bound to the specific request-id + attempt-number so re-opening the modal after a failed step-up regenerates the phrase (prevents a stale copy-paste from resurrecting a stale intent).
- **Action buttons.** Bottom-right of the modal, right-aligned, `var(--lc-space-md)` gap. Left: `Cancel` (`<Button variant="ghost">`). Right: `Confirm and execute` (`<Button variant="destructive">` — destructive palette because this button crosses from decision to physical mutation). Confirm label swaps dynamically per workflow token — see §Explicit copy. Confirm respects the disabled-until-consent-and-phrase-match invariant. Buttons are 44px tall via base CSS (no override).
- **Buttons vertical stack on narrow modal widths?** No — this modal is desktop-only and the min-width guarantees horizontal room. Do NOT stack vertically.
- **In-flight state.** Confirm button swaps to a `Loader2` spinner + label "Executing…" (spinner via `--lc-easing-in-out`, respect `prefers-reduced-motion`). Whole modal becomes non-interactive (backdrop click no-op; Esc no-op; every input `aria-disabled="true"`). Cancel is also disabled during the flight — a two-person execute is atomic and cannot be aborted client-side once dispatched.
- **Post-success behavior.** Modal fades out at `--lc-duration-base` `--lc-easing-out`; caller screen refetches; success toast (`Sonner`) appears at bottom-center: "Executed — {short action summary}. See outcome →" where the CTA deep-links to the workflow-specific outcome screen (see §Backend contract). Toast persists for 6 seconds; the CTA remains keyboard-focusable via `Tab` from the toast landmark.
- **Post-self-approval-reject behavior (403).** Modal swaps its body to a destructive block — see §State variants — with `Assign to another approver via Escalate` primary CTA (deep-link to `PA-APR-005`).
- **Post-mismatch-execution (409 STALE / PRECONDITION_FAILED).** Modal swaps to a warning block explaining the underlying request changed since the modal opened; forces the PA back to the source approval-detail screen for a fresh review.
- **Focus rings.** Two-tone via base CSS — do NOT override. Focus trap on the modal — Tab cycles Consent → (Type-to-confirm) → Cancel → Confirm → back to close-X. Esc closes the modal (unless in-flight). Backdrop click closes with a confirmation prompt IF the type-to-confirm has any keystrokes ("Discard your confirmation phrase? Your typed text will be lost.").
- **Radii.** Modal `var(--lc-radius-xl)`; summary/diff/risk/ledger cards `var(--lc-radius-lg)`; inputs `var(--lc-radius-md)`; buttons `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`.
- **Motion.** Modal enter `--lc-duration-slow` `--lc-easing-out`; exit `--lc-duration-base` `--lc-easing-in-out`; two-person progress step 2 pulse `--lc-duration-slow` at `--lc-accent-bold-edge` while awaiting the current PA vote; NO signal-lamp motif (reserved for "listing went live").
- **Numeric fields — every numeral** (request id, credit amount, currency amount, count, timestamp, phrase length) via `<Numeric>` or `.lc-data`.

**PA queue-family invariants (inherited from PA-MOD-001 §Broadcast alignment):**
1. Env badge always visible; env-scoped data (X-Wingcaster-Env header on every execute call).
2. Server-enforced self-approval reject (caller ≠ submitter) — UI mirrors with a graceful 403 handler.
3. Every execute writes to immutable audit (PA-AUD-001) — audit note visible below the buttons.
4. Step-up (SHR-MFA-007) is required BEFORE this modal opens for any high-value execute — the approval-detail screen handles the step-up; this modal assumes step-up already passed. If server returns 401 STEP_UP_REQUIRED anyway (session expired mid-flow), the modal handles it inline and retries.

---

## Meta

| | |
|---|---|
| Screen ID | PA-APR-003 |
| Screen name | Two-person action confirmation |
| Persona | PA (second approver — server rejects if caller identity == submitter identity). Requires capability pack matching the workflow (`fin-approvals` / `credit-grants` / `packages` / etc.) AND `two-person-approver` role bit. |
| Device targets | Desktop 1440px ONLY (modal). Below 1024px viewport → the parent screen already renders the "PA console requires a desktop screen" info block and this modal never mounts. |
| Locale | English + Arabic (RTL) — both mandatory. |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Modal — no dedicated route. Opened from `PA-APR-002` (generic approval detail) or `PA-PKG-005` / `PA-CRD-005b` / `PA-INV-004b` / any workflow-specific approval-detail screen via a `Confirm & execute` button. Modal state is URL-hash-driven `#confirm-execute` for shareable-link deep opens within the parent detail route. |
| Current state | MISSING (UI). Backend approve/reject stubs at `backend/src/fin/admin/routes.js:282-288` return `notImplemented('DL-166')` — see §Backend contract. |
| Workflow role | WF-20 role = Execute (the terminal commit for every two-person workflow). |
| Backend prerequisites | ⏳ `[BE-APR-EXEC-01]` `POST /api/admin/approvals/:id/execute` route + service (unified execute surface consolidating today's `/approve` and `/reject` stubs at `backend/src/fin/admin/routes.js:282-288`; those stubs currently NEITHER accept a confirmation phrase NOR emit a ledger-impact preview — this endpoint replaces both) · ⏳ `[BE-APR-EXEC-02]` `GET /api/admin/approvals/:id/execute-preview` — returns the diff panel + risk signals + ledger impact preview + confirmation phrase seed (called on modal mount) · ⏳ `[BE-APR-EXEC-03]` server-side self-approval reject (caller identity == submitter identity → 403 SELF_APPROVAL_FORBIDDEN) · ⏳ `[BE-APR-EXEC-04]` optimistic-concurrency guard (If-Match on the request version — 409 STALE if the underlying request mutated) · ⏳ `[BE-APR-EXEC-05]` per-workflow executor dispatcher (dispatch by `workflow_code` to the right service — grantCredits / publishPackage / adjustInvoice / etc.) · ✅ SHR-MFA-007 step-up (handled by the parent detail screen; this modal only handles 401 STEP_UP_REQUIRED as a recovery) · ✅ PA-NAV-001 env context |
| Cluster | Wave 2 (Week 6 — two-person-rule UI cluster) alongside PA-APR-005 (escalation) + PA-APR-006 (recall). |

---

## Purpose

The physical commit surface for every WingCaster two-person approval. When a PA has reviewed a request on the workflow-specific approval-detail screen (`PA-APR-002` / `PA-PKG-005` / `PA-CRD-005b` / `PA-INV-004b` / any) AND is qualified as the second approver AND has cleared any required step-up, they press "Confirm & execute" on the parent screen and THIS modal opens.

The modal exists because a PA reviewing an approval-detail screen sees the request in its "about to happen" shape — but the moment of physical commit is a distinct decision that deserves its own frame. Between reviewing "here is what will happen" and pressing the button that makes it happen, the PA must:

1. **Re-confirm the exact diff.** The diff panel restates the before/after values in the same modal frame as the button. No scrolling, no split attention.
2. **See the ledger impact for financial actions.** Money movements (credit grants, invoice adjustments, refunds, vendor payouts) get an inline debit/credit preview that MUST balance to zero before the button enables.
3. **Acknowledge the consent-to-proceed line.** A physical checkbox that says "I have reviewed the diff, risk signals, and ledger impact — proceed." — cannot be bypassed.
4. **Type the confirmation phrase for high-value tier.** A 4-word Diceware token generated per request that the PA must type exactly. Prevents muscle-memory approvals on a stale tab or drag-clicked buttons in a crowded queue day.
5. **Trust that the server will reject a self-approval attempt.** If the caller identity == submitter identity (per `fin.approval_requests.submitted_by`), server returns 403 SELF_APPROVAL_FORBIDDEN and the modal swaps its body to a destructive block routing the PA to Escalate.

On confirm, the server executes the action atomically inside a database transaction — the approve state, the audit event, the ledger posting, and the downstream workflow (portal publisher enqueue, WhatsApp notification, package publish, credit balance update, etc.) all commit together or roll back together. The response is `{ ok: true, outcome_url }` where `outcome_url` deep-links to the workflow's outcome screen (`PA-CRD-006` for credit grants, `PA-PKG-002` for packages, `PA-INV-004` for invoices, etc.).

Success outcome: PA reaches the physical commit within 30 seconds of opening the modal (typical high-value case). Server enforces every guard; UI mirrors gracefully; audit is complete; the caller PA lands back on `PA-APR-001` (approvals queue) with a success toast and a one-click path to the outcome screen.

---

## Design goals

1. **The modal is a fresh frame, not a step in a wizard.** PA has already reviewed the request on the parent detail screen — this modal exists to make the commit itself feel distinct from the review. No pagination inside the modal; no accordion sections; every field visible without scrolling for the common case (≤6 changed fields, no more than 4 risk signals).
2. **Ledger-impact preview MUST balance to zero.** Financial actions surface debit/credit rows with column totals; if the server preview does not balance, the modal opens in an error state and the Confirm button never enables. Prevents a class of production incident where a partial executor half-posts a ledger entry.
3. **The confirmation phrase is a physical throttle, not a captcha.** It exists to defeat muscle-memory approvals — the PA who reflexively hits Enter on a stale tab must actually retype four words. Phrase is human-readable so PAs on the phone with a submitter can read it back out loud to confirm intent.
4. **Self-approval is a UI dead-end, not a permission error page.** The 403 branch swaps the modal body into a friendly "Assign to another approver" flow — the PA never gets the impression they made a mistake; the tool made a routing decision on their behalf.
5. **Stale-request handling routes back to detail.** If the underlying request changed since the modal opened (409 STALE), the modal closes and the parent detail screen refetches — never let a PA execute against a version of the request they haven't seen.
6. **Env context is unambiguous inside the modal frame.** The PA-NAV-001 badge remains visible in the top bar behind the modal AND the modal itself carries an inline env chip beside the title. A screenshot of this modal can never be mistaken for the wrong env.
7. **The modal is the anchor for PA-APR-005 (escalate) and PA-APR-006 (recall).** Every visual pattern here — the summary card, the two-person progress, the diff panel, the ledger preview, the consent + type-to-confirm — is re-usable in those two follow-on screens. Design once; inherit twice.
8. **Keyboard-first.** Tab cycle strictly ordered; Enter on the Confirm button only enables when both consent + phrase (if required) validate; Esc closes with a discard prompt if the phrase field has content.

---

## Layout

### Desktop 1440px modal (600-640px width, centered)

The modal opens over the parent approval-detail screen; parent screen dims behind a `--lc-surface-inverse` 60% scrim.

**Modal header row:**
- Left: title "Confirm and execute" (`var(--lc-type-heading-2)`) + env chip inline (`LIVE` green ● / `TEST` amber ▲) + workflow code chip (`WF-08` mono).
- Right: close X button (`<Button variant="ghost" size="icon">` + `X` lucide icon).
- Sub-title beneath: "Request #{last6} · submitted {relTime}" (`var(--lc-type-body-sm)` `--lc-text-muted`; `#{last6}` in `<Numeric>`).

**Request summary block** (sunken card, no elevation):
- 2×2 `<dl>` grid:
  - **Action** — verbatim short summary from server (e.g. "Grant 50,000 credits to Elite Real Estate Dubai" / "Publish package: Enterprise-Yearly-2027" / "Adjust invoice INV-2026-4471: -AED 1,250.00 refund").
  - **Value tier** — badge (Standard / Elevated / High-value); tier drives whether type-to-confirm renders + whether step-up was required upstream.
  - **Submitted by** — avatar + display name + relative-time; full ISO in tooltip.
  - **Assigned approvers** — chip stack: first approver avatar (with ● overlay indicating cast) + current PA avatar (with ○ indicating pending — you).

**Two-person progress indicator** (below summary block, spans full modal width):
- 2-step horizontal bar: step 1 filled ("First approver · SM · signed off 12m ago"); step 2 pulsing ("You · pending").
- Labels above each step in `var(--lc-type-overline)` `--lc-text-muted`.

**Diff panel** (raised card with elevation-sm):
- Section title "What will change" (`var(--lc-type-heading-3)`).
- Per-field row: label + before + `→` + after. Numeric before/after via `<Numeric>` with explicit currency where applicable.
- Empty state (no changed fields — e.g. a pure state-transition action like "Publish package"): a single row with label "State" + before "Draft" + `→` + after "Published".
- Scrolls internally at `max-height: 240px` if >6 rows.

**Risk-signals section** (conditional; raised card):
- Section title "Risk signals" (`var(--lc-type-heading-3)`) with ▲ prefix glyph.
- Unordered list — glyph + label + tooltip for derivation.
- Examples: "▲ Amount exceeds submitter's 90-day average by 3.2×" · "◆ Recipient tenant has 2 rejected requests in the last 30 days" · "● Recipient is on Enterprise plan (high account value)".

**Ledger-impact preview** (conditional; sunken card):
- Section title "Ledger impact" (`var(--lc-type-heading-3)`).
- Tiny table: `Account` · `Debit` · `Credit`. Bottom row shows column totals; totals MUST balance (server-preview) or the whole modal opens in an error state.
- Footer line: "Posts to {env} ledger on confirm." with inline env chip.

**Consent + type-to-confirm row:**
- Consent `<Checkbox>` + label "I have reviewed the diff, risk signals, and ledger impact — proceed."
- If `value_tier=high_value`: labeled `<Input>` beneath — "Type **{phrase}** to confirm" (mono phrase in inline `<code>` on `--lc-status-warning-bg`).

**Action buttons row** (bottom-right):
- `Cancel` ghost button (left of the pair).
- `Confirm and execute` destructive button. Label variants per workflow:
  - Credit grant: "Grant credits and post to ledger"
  - Package publish: "Publish package"
  - Invoice adjustment: "Post adjustment"
  - Rate-card change: "Apply rate change"
  - Vendor payout: "Release payout"
  - Generic fallback: "Confirm and execute"

**Audit note** (footer strip inside modal, above buttons):
- Small `var(--lc-type-caption)` `--lc-text-muted`: "This action will be recorded to the immutable audit log. See PA-AUD-001 → request #{last6}."

### Loading state (modal opening)

Skeleton inside the modal frame: shimmer blocks for summary (2×2 grid), two-person progress (2 steps), diff panel (4 shimmer rows), ledger preview (3 shimmer rows), consent row, buttons stubbed. `--lc-duration-base ease-in-out infinite alternate`. Respect `prefers-reduced-motion`.

### In-flight state (Confirm clicked)

- Modal contents dim slightly (`opacity: 0.65`).
- Confirm button swaps to `Loader2` spinner + label "Executing…".
- All inputs `aria-disabled="true"`.
- Cancel button `disabled`.
- Backdrop click no-op; Esc no-op.

### Self-approval-reject state (403 SELF_APPROVAL_FORBIDDEN)

- Modal body swaps to a destructive block:
  - Icon: `AlertTriangle` in `--lc-status-danger-fg`.
  - Title (`var(--lc-type-heading-3)`): "You can't approve your own request."
  - Body (`var(--lc-type-body)`): "This request was submitted by you. WingCaster requires a second approver from another Platform Admin. Assign it via Escalate."
  - Primary CTA `Assign to another approver via Escalate` → deep-links to `PA-APR-005` for THIS request-id.
  - Secondary CTA `Close`.

### Stale-request state (409 STALE / PRECONDITION_FAILED)

- Modal body swaps to a warning block:
  - Icon: `RefreshCw` in `--lc-status-warning-fg`.
  - Title: "This request has changed."
  - Body: "Since you opened this confirmation, the underlying request was modified (by the submitter or another approver). Review the latest version before executing."
  - Primary CTA `Reload request → PA-APR-002` (or the appropriate detail screen).
  - Secondary CTA `Close`.

### Vote-mismatch escalation state (409 VOTE_MISMATCH — first approver rejected; second approver attempting approve)

- Modal body swaps to an info block:
  - Icon: `Users` in `--lc-status-warning-fg`.
  - Title: "Votes do not match."
  - Body: "The first approver rejected this request; your matching approve vote conflicts. This case is being escalated to PA-APR-005 for third-approver resolution."
  - Primary CTA `Open escalation → PA-APR-005`.

### Step-up-required state (401 STEP_UP_REQUIRED — session drifted mid-flow)

- Inline SHR-MFA-007 slot renders inside the modal (does NOT open a nested modal). On success, the pending execute retries automatically. On cancel, the modal returns to the ready state without dispatching.

### Ledger-doesn't-balance error state (503 LEDGER_PREVIEW_UNBALANCED — server preview returned a non-zero net)

- Modal opens with the ledger card showing red banner "Ledger preview does not balance — cannot execute. Contact backend on-call." + a total-line delta in `--lc-status-danger-fg`.
- Confirm button never enables.
- Cancel closes the modal; the parent detail screen shows a persistent banner.

### Below-min-viewport state

- Not applicable — parent screen already blocks < 1024px viewports at the console shell level.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Modal title | Confirm and execute |
| Env chip — LIVE | LIVE |
| Env chip — TEST | TEST |
| Workflow code chip template | {WFcode} |
| Sub-title template | Request #{last6} · submitted {relTime} |
| Summary — Action label | Action |
| Summary — Value tier label | Value tier |
| Summary — Value tier options | Standard · Elevated · High-value |
| Summary — Submitted by label | Submitted by |
| Summary — Assigned approvers label | Assigned approvers |
| Two-person — step 1 label | First approver |
| Two-person — step 2 label | Second approver (you) |
| Two-person — first cast template | Signed off {relTime} |
| Two-person — second pending | Pending — your confirmation |
| Diff panel title | What will change |
| Diff panel — no changes empty | No field-level changes; this is a state transition. |
| Diff row template | {field} · {before} → {after} |
| Risk signals title | Risk signals |
| Risk signals — no signals empty | (Section hidden when no signals returned.) |
| Ledger impact title | Ledger impact |
| Ledger footer template | Posts to {env} ledger on confirm. |
| Ledger unbalanced banner | Ledger preview does not balance ({delta} off). This request cannot execute — contact backend on-call. |
| Consent checkbox label | I have reviewed the diff, risk signals, and ledger impact — proceed. |
| Type-to-confirm label template | Type **{phrase}** to confirm |
| Type-to-confirm input placeholder | Type the phrase above |
| Type-to-confirm helper | Case-sensitive. This phrase is generated per request. |
| Type-to-confirm mismatch error | Doesn't match. Type the phrase exactly. |
| Confirm button — generic | Confirm and execute |
| Confirm button — credit grant | Grant credits and post to ledger |
| Confirm button — package publish | Publish package |
| Confirm button — invoice adjustment | Post adjustment |
| Confirm button — rate-card change | Apply rate change |
| Confirm button — vendor payout | Release payout |
| Confirm button — in-flight | Executing… |
| Cancel button | Cancel |
| Close X aria-label | Close confirmation |
| Audit note template | This action will be recorded to the immutable audit log. See PA-AUD-001 → request #{last6}. |
| Self-approval — title | You can't approve your own request. |
| Self-approval — body | This request was submitted by you. WingCaster requires a second approver from another Platform Admin. Assign it via Escalate. |
| Self-approval — primary CTA | Assign to another approver via Escalate |
| Self-approval — secondary CTA | Close |
| Stale — title | This request has changed. |
| Stale — body | Since you opened this confirmation, the underlying request was modified (by the submitter or another approver). Review the latest version before executing. |
| Stale — primary CTA | Reload request |
| Stale — secondary CTA | Close |
| Vote-mismatch — title | Votes do not match. |
| Vote-mismatch — body | The first approver rejected this request; your matching approve vote conflicts. This case is being escalated to PA-APR-005 for third-approver resolution. |
| Vote-mismatch — CTA | Open escalation |
| Step-up — inline title | Confirm your identity to proceed. |
| Backdrop-dismiss-with-phrase-typed prompt | Discard your confirmation phrase? Your typed text will be lost. |
| Backdrop-dismiss confirm | Discard and close |
| Backdrop-dismiss cancel | Keep typing |
| Success toast template | Executed — {shortActionSummary}. |
| Success toast CTA | See outcome → |
| Execute failure toast (generic 500) | Something went wrong executing this action. The request is unchanged. Try again. |
| Execute failure toast (network timeout) | The server did not respond in time. Refresh the request to confirm whether it executed. |
| Loading | Loading confirmation preview… |
| Loading error | Couldn't load the preview. Retry. |
| Loading retry | Retry |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Modal shell | `AlertDialog` |
| Modal title | plain `<h2>` with `--lc-type-heading-2` |
| Env chip | `<Badge>` variant per LIVE / TEST |
| Workflow code chip | `<Badge>` variant="outline" + mono font |
| Sub-title | plain `<p>` with `--lc-type-body-sm` `--lc-text-muted` |
| Summary block | `<Card>` on `--lc-surface-sunken` + `<dl>` grid |
| Avatar | `Avatar` + `AvatarImage` + `AvatarFallback` |
| Two-person progress | Reused `<TwoPersonProgress>` from PA-ACR-002 (`web/src/components/ui/two-person-progress.tsx`) |
| Diff panel | `<Card>` on `--lc-surface-raised` + custom diff-row list |
| Diff row | Custom `<div>` with grid — label / before / arrow glyph / after |
| Risk signals section | `<Card>` on `--lc-surface-raised` + `<ul>` of signal rows |
| Signal row | `<li>` with glyph prefix + label + tooltip |
| Ledger preview section | `<Card>` on `--lc-surface-sunken` + `<Table>` |
| Ledger table | `Table` + `TableHeader` + `TableRow` + `TableCell` — 3 columns |
| Consent checkbox | `Checkbox` + `<Label>` |
| Type-to-confirm input | `Input` with mono font + tabular-nums + autofocus |
| Type-to-confirm inline phrase | `<code>` on `--lc-status-warning-bg` inline |
| Confirm button | `Button variant="destructive"` |
| Cancel button | `Button variant="ghost"` |
| Close X | `Button variant="ghost" size="icon"` + `X` icon |
| Loader in Confirm button | `Loader2` (lucide) with spin animation |
| Self-approval body block | `<div>` with `AlertTriangle` icon + heading + body + CTAs |
| Stale body block | `<div>` with `RefreshCw` icon + heading + body + CTAs |
| Vote-mismatch body block | `<div>` with `Users` icon + heading + body + CTA |
| Step-up inline slot | Embedded `SHR-MFA-007` component |
| Success toast | `Sonner` toast + `See outcome →` action |
| Failure toast | `Sonner` toast (destructive variant) |
| Backdrop-dismiss confirm | `AlertDialog` (nested is OK for this exact prompt) |
| Numeric renders | `<Numeric>` primitive |
| Icons | `lucide-react` — `X`, `AlertTriangle`, `RefreshCw`, `Users`, `Loader2`, `Check`, `ArrowRight`, `HelpCircle` |
| Env badge in top bar | Embedded `PA-NAV-001` component (unchanged) |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px modal open over `PA-CRD-005b` (credit grant approval-detail screen) with:

- **Env:** LIVE — top-bar env badge green ●; modal header carries green `LIVE ●` chip beside the title.
- **Modal title:** "Confirm and execute" with chips `LIVE ●` + `WF-08` beside it.
- **Sub-title:** "Request #B7F3A2 · submitted 14m ago"
- **Summary block (2×2):**
  - Action: "Grant 50,000 credits to Elite Real Estate Dubai"
  - Value tier: `<Badge>` **High-value** (danger tint + ◆ glyph)
  - Submitted by: avatar "SM" **Sara Al Mansouri** (Platform Admin) · 14m ago
  - Assigned approvers: avatar cluster — `SM ●` (first, signed off 12m ago) + `AK ○` (you, pending)
- **Two-person progress:** step 1 "First approver · SM · signed off 12m ago" filled green ●; step 2 "Second approver (you) · Pending — your confirmation" pulsing amber ○.
- **Diff panel** — "What will change":
  - Field: **Available credit balance** — before `AED 12,000.00` → after `AED 62,000.00` (`<Numeric>` mono, before strikethrough, after green bold)
  - Field: **Lifetime credit granted** — before `AED 84,000.00` → after `AED 134,000.00`
  - Field: **Package tier** — before "Free trial" → after "Free trial" (no change; shown for context)
  - Field: **Credit expiry** — before "—" → after "2027-09-08" (mono date)
- **Risk signals** — "Risk signals" (with ▲):
  - `▲` Amount exceeds submitter's 90-day average grant size by 3.2× (tooltip: "Submitter avg $15,600; this request $50,000.")
  - `●` Recipient tenant on Enterprise plan (high account value)
  - `●` First approver signed off within SLA
- **Ledger impact preview** — "Ledger impact":
  - `2110 · Credit reserve (liability)` — Debit `—` · Credit `AED 50,000.00`
  - `5310 · Promotional credit expense` — Debit `AED 50,000.00` · Credit `—`
  - Totals: Debit `AED 50,000.00` · Credit `AED 50,000.00` — **balances ✓**
  - Footer: "Posts to LIVE ledger on confirm." with green `LIVE ●` chip.
- **Consent checkbox:** unchecked. Label "I have reviewed the diff, risk signals, and ledger impact — proceed."
- **Type-to-confirm input:** label "Type **quiet-copper-lantern-drift** to confirm" (phrase inline in mono `<code>` on amber `--lc-status-warning-bg`). Input empty. Helper "Case-sensitive. This phrase is generated per request."
- **Buttons:** `Cancel` (ghost, left of pair); `Grant credits and post to ledger` (destructive orange, disabled because consent+phrase incomplete).
- **Audit note:** "This action will be recorded to the immutable audit log. See PA-AUD-001 → request #B7F3A2."

**Side variants to screenshot as separate v0 iterations:**

- **Ready-to-fire:** consent checked, phrase typed correctly ("quiet-copper-lantern-drift"), destructive Confirm button enabled with hover state.
- **Wrong phrase:** consent checked, phrase typed with typo ("quiet-copper-lantern-drift**t**"), inline red error "Doesn't match. Type the phrase exactly." Confirm still disabled.
- **In-flight:** Confirm button showing `Loader2` + "Executing…"; whole modal dimmed; Cancel disabled.
- **Standard tier (no type-to-confirm):** same modal shell, consent checkbox only, Value tier badge shows Standard, no phrase input renders; Confirm button label "Confirm and execute" (generic fallback).
- **Non-financial workflow (package publish):** Value tier Elevated, no ledger-impact card, diff panel shows state transition Draft → Published + a package name change field; Confirm label "Publish package".
- **Self-approval reject (403):** modal body swapped to destructive block with `AlertTriangle` + copy + Escalate CTA.
- **Stale request (409):** modal body swapped to warning block with `RefreshCw` + copy + Reload CTA.
- **Vote-mismatch (409):** modal body swapped to info block with `Users` + copy + Open escalation CTA.
- **Ledger unbalanced (503):** modal opens with red banner in the ledger card; Confirm never enables.
- **Step-up inline (401):** SHR-MFA-007 slot renders inside modal body; the request context remains visible above it.
- **TEST env:** top-bar badge amber ▲; modal header carries amber `TEST ▲` chip; TEST persistent warning strip visible above the backdrop; ledger footer reads "Posts to TEST ledger on confirm.".
- **RTL Arabic** at desktop 1440px with `[TRANSLATION-PENDING]`; two-person progress bar mirrors; type-to-confirm input stays LTR via bidi isolation (phrase is Latin ASCII).
- **Dark mode** of the primary pass.

Do NOT fabricate risk-signal scores, ledger accounts, or ledger amounts not returned by the backend contract. Every value above corresponds to a real payload attribute from §Backend contract.

---

## Interactions

**On modal open:**
- Fetch `GET /api/admin/approvals/:id/execute-preview` scoped to current env. Response includes: summary, two-person state, diff, risk signals (nullable), ledger impact (nullable), value tier, confirmation phrase (if high_value), self-approval flag, workflow code.
- If `self_approval=true`: immediately render the 403 body block (do not render the normal modal body).
- If `ledger_impact != null` and totals do not balance: render the ledger unbalanced error state; Confirm never enables.
- Else: render the standard modal body. Autofocus lands on the consent checkbox (or on the type-to-confirm input if high_value tier).

**On consent checkbox change:**
- Confirm button enables IFF `consent=true` AND (`value_tier != high_value` OR phrase matches exactly).

**On type-to-confirm input change:**
- Compare input value to `confirmation_phrase` on every keystroke.
- Inline validation state: neutral while empty, red "Doesn't match" if non-empty and non-match, green ✓ + Confirm button enables when exact match.

**On Confirm click:**
- Fire `POST /api/admin/approvals/:id/execute` with `{ workflow_code, if_match_version, confirmation_phrase (if high_value) }` and `If-Match` header carrying the version returned by execute-preview.
- Enter in-flight state.
- On 200: play success animation (Confirm button check-glyph 200ms then fade); modal closes at `--lc-duration-base`; success toast bottom-center with `See outcome →` CTA linking to `outcome_url` from response; parent screen refetches and navigates to `PA-APR-001` queue (`?highlight=<request-id>`).
- On 403 SELF_APPROVAL_FORBIDDEN: swap body to self-approval block.
- On 401 STEP_UP_REQUIRED: swap in inline SHR-MFA-007; on step-up success, re-fire the execute POST with the new session token.
- On 409 STALE / PRECONDITION_FAILED: swap body to stale block; primary CTA reloads the parent detail screen.
- On 409 VOTE_MISMATCH: swap body to vote-mismatch block; CTA opens escalation.
- On 503 LEDGER_PREVIEW_UNBALANCED (returned late — server side re-checked at execute): swap ledger card into unbalanced state; Confirm disabled.
- On 500 / other 5xx: destructive toast "Something went wrong executing this action. The request is unchanged. Try again." Modal returns to ready state. NO optimistic UI on this endpoint — never signal success before the server confirms.
- On network timeout (30s): destructive toast "The server did not respond in time. Refresh the request to confirm whether it executed." Modal closes; parent refetches.

**On Cancel click / Esc / backdrop click:**
- If type-to-confirm has any characters: nested `AlertDialog` "Discard your confirmation phrase?" — user chooses Discard-and-close or Keep-typing.
- Else: modal closes immediately at `--lc-duration-base`; parent detail screen stays put.

**On close-X click:** same as Cancel.

**On env-switch mid-flow (PA-NAV-001 change):**
- If modal is in-flight: block env switch with an inline warning ("An execute is in flight — wait for it to complete before switching env.").
- Else: close modal with a confirm prompt ("Switching env will close this confirmation. Continue?"); on confirm, parent screen refetches in new env; if the request does not exist in the new env, redirect to `PA-APR-001`.

**On tab-visibility change (browser tab backgrounds):**
- Freeze phrase-match state (do not clear typed phrase); on refocus, do NOT re-fetch execute-preview (the phrase would regenerate and invalidate typed input). Instead, show a subtle refresh chip near the phrase input "Refresh phrase" that the PA can opt into.

**Keyboard shortcuts:**
- `Tab` cycles: consent → (type-to-confirm) → Cancel → Confirm → close-X → back to consent.
- `Enter` when Confirm has focus AND is enabled: fires Confirm.
- `Enter` when Confirm is disabled: no-op (never accidentally fires).
- `Esc`: Cancel (with discard prompt if phrase typed).
- `Ctrl/Cmd+Enter` from any focus: fires Confirm if enabled.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Opening — loading** | Modal mount | Skeleton inside modal frame; execute-preview fetch in flight. |
| **Ready — standard tier, no ledger** | Load complete, tier=standard, ledger_impact=null | Summary + two-person + diff (+ risk signals if any); consent checkbox only; Confirm enables on consent. |
| **Ready — standard tier, with ledger** | tier=standard, ledger_impact!=null balanced | Same + ledger-impact card. |
| **Ready — elevated tier** | tier=elevated | Same layout as standard; step-up was required upstream. |
| **Ready — high-value tier** | tier=high_value | All cards + type-to-confirm input; Confirm requires both consent AND exact phrase match. |
| **Consent-not-checked** | Consent unchecked | Confirm disabled; no error text (passive state). |
| **Phrase-empty** | High-value + empty phrase input | Confirm disabled; phrase input neutral (no error). |
| **Phrase-mismatch** | High-value + non-empty non-matching phrase | Inline red "Doesn't match" error; Confirm disabled. |
| **Phrase-match** | High-value + exact match | Green ✓ chip in the input; Confirm enables (if consent also checked). |
| **In-flight** | Confirm clicked, POST in progress | Modal dimmed; Loader2 in Confirm; all inputs aria-disabled; Cancel disabled; Esc/backdrop no-op. |
| **Success** | POST 200 | Modal closes at `--lc-duration-base`; success toast bottom-center with `See outcome →` CTA; parent refetches. |
| **Self-approval reject** | POST 403 SELF_APPROVAL_FORBIDDEN | Modal body swapped to destructive block with Escalate CTA. |
| **Stale request** | POST 409 STALE / PRECONDITION_FAILED | Modal body swapped to warning block with Reload CTA. |
| **Vote-mismatch** | POST 409 VOTE_MISMATCH | Modal body swapped to info block with Open-escalation CTA. |
| **Step-up mid-flow** | POST 401 STEP_UP_REQUIRED | Inline SHR-MFA-007 slot renders inside modal body; retries on success. |
| **Ledger unbalanced (preview)** | execute-preview returns net!=0 | Modal opens with red banner in ledger card; Confirm never enables. |
| **Ledger unbalanced (execute)** | POST 503 LEDGER_PREVIEW_UNBALANCED | Same — swap ledger card into unbalanced state; toast; Confirm disabled. |
| **Server error 500** | POST 5xx | Destructive toast; modal returns to ready state. |
| **Network timeout** | POST no response in 30s | Destructive toast advising to refresh request; modal closes. |
| **Env-switch mid-flow (idle)** | PA-NAV-001 change | Confirm prompt to close modal; on confirm, parent refetches in new env. |
| **Env-switch mid-flow (in-flight)** | PA-NAV-001 change during POST | Env switch blocked with inline warning; modal completes or errors first. |
| **Tab visibility restore** | Browser tab foregrounded | Phrase state preserved; opt-in `Refresh phrase` chip visible. |
| **TEST env** | env=TEST | Amber TEST chip beside modal title; TEST warning strip visible above backdrop; ledger footer reads "Posts to TEST ledger on confirm."; ledger amounts shown but no real posting. |
| **RTL** | Locale = ar | Modal mirrors; two-person progress bar mirrors; type-to-confirm input stays LTR via bidi isolation. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; destructive Confirm button remains distinctly non-primary. |
| **Reduced motion** | prefers-reduced-motion | Modal enter/exit swap to opacity-only; Loader2 spin swaps to a dot-pulse; two-person step 2 pulse becomes static. |

---

## Accessibility

- Modal is a `role="alertdialog"` (per Radix `AlertDialog`) with `aria-labelledby` on the title and `aria-describedby` on the sub-title + summary block.
- Focus trap while open; initial focus lands on consent checkbox (or type-to-confirm input for high-value).
- Esc closes (with the discard-phrase prompt if phrase field has content).
- Every icon-only button (close X) has an `aria-label` ("Close confirmation").
- Type-to-confirm input `<label>` is bound via `htmlFor`; helper + error text tied via `aria-describedby`.
- Phrase mismatch error uses `aria-live="polite"` (not assertive — the PA is typing; assertive would fight with keystroke).
- Success toast uses `aria-live="polite"`; failure toast uses `aria-live="assertive"`; the `See outcome →` CTA is keyboard-focusable via `Tab` from the toast landmark.
- Every state-change (self-approval, stale, vote-mismatch, step-up, in-flight) announced via `aria-live="polite"` on the modal body region.
- Two-person progress bar has `role="progressbar"` with `aria-valuenow="1"` `aria-valuemin="0"` `aria-valuemax="2"` `aria-label="Two-person approval progress"` + screen-reader-only description ("First approver signed off 12 minutes ago; you are pending").
- Ledger table has proper `<caption>` "Ledger impact preview" (visually hidden but SR-available) + `scope="col"` headers.
- Diff panel rows use semantic markup — either a `<dl>` (field / before-after pair) or a `<table>` with `<caption>` "Changes to be committed on execute".
- Confirm button while disabled has `aria-disabled="true"` (not the `disabled` attribute alone) so SR announces "dimmed" state + reason text via `aria-describedby` (linking to consent + phrase requirements).
- Every numeric rendered in mono + tabular-nums via `<Numeric>` — screen readers announce the raw digits, not the display formatting.
- Sanity: no interactive control below 44×44 CSS pixel tap target.
- Skip-to-content and the modal focus trap coexist — Tab past the last focusable inside the modal wraps to the first, never escapes.

---

## Anti-patterns (do not do these)

- Do NOT render this modal as a route (`/admin/approvals/:id/execute`). It is a modal that opens from an already-loaded approval-detail screen — the request context and step-up are already established.
- Do NOT open this modal from `PA-APR-001` (queue) directly — the queue does not carry enough context (no diff, no ledger preview) to render the modal. Always route via the approval-detail screen first.
- Do NOT skip the consent checkbox for standard tier "because it's low value." Every physical execute requires consent — it is the one universal invariant of this modal.
- Do NOT render type-to-confirm for standard/elevated tier "because it's more careful." The phrase is a deliberate throttle scoped to high-value; over-applying it trains PAs to type-past it on every request and destroys the signal.
- Do NOT pre-fill the type-to-confirm input, and do NOT allow autocomplete / password-manager fill (`autocomplete="off"` + `spellcheck="false"` mandatory).
- Do NOT reuse the same confirmation phrase across attempts — if the modal closes and reopens, or step-up interrupts, the server regenerates the phrase and the PA must retype.
- Do NOT allow Confirm on a ledger preview that does not balance to zero. Server enforces; UI must never let the button enable.
- Do NOT show optimistic success. This modal is the physical mutation surface — the button must not signal success until the server confirms 200. Optimism here would be a lie.
- Do NOT allow backdrop-click dismiss without confirmation when the type-to-confirm has content. Losing a typed phrase to a misclick is user-hostile.
- Do NOT allow Esc dismiss during in-flight. The action is atomic server-side; letting the PA press Esc suggests they can abort — they can't.
- Do NOT hide the env chip inside the modal. The modal frame carries its own env chip beside the title AND the top-bar env badge stays visible behind the backdrop. Both, always.
- Do NOT show raw request UUIDs anywhere prominently. `#{last6}` is the human handle.
- Do NOT co-mingle LIVE and TEST — every execute POST carries the `X-Wingcaster-Env` header and the server verifies against session. A LIVE session firing a TEST-env request is a 403.
- Do NOT reuse this modal shell for single-approver actions (WF-04 recovery approve, WF-03 portal moderation). Those workflows use their own detail-screen inline dialogs — this modal is exclusively for `fin.approval_requests` two-person executes.
- Do NOT display fabricated risk-tier scores or "PA confidence percentages." Every visible signal here is a defined backend payload attribute.
- Do NOT allow the Confirm-and-execute button to become a primary orange button. It stays `variant="destructive"` — this is a mutation surface, and the visual palette must warn.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Stripe Radar → send bank transfer confirmation** — high-value action modal with a typed-phrase throttle and an inline ledger preview.
- **GitHub → delete repository confirmation** — the type-to-confirm pattern executed cleanly; the phrase is scoped to the specific artifact being mutated.
- **Vercel → team billing action confirmation** — inline ledger delta preview + destructive CTA + step-up.
- **AWS Console → cost-impacting action confirmation** — env chip surfacing in the modal frame itself (Production vs Staging).
- **Notion admin → destructive team action** — clean two-approver progress indicator + consent-to-proceed checkbox.
- **PA-ACR-002 (WingCaster peer)** — the two-person progress primitive shipped here; reuse verbatim.

Do NOT match:

- Salesforce "Are you sure?" modals (too vague; no diff, no ledger, no phrase — a template for accidental mutation).
- Slack workspace-delete confirmation (too destructive-heavy; overuses the type-to-confirm pattern for actions that don't merit it).
- Any modal that renders a full workflow inside itself (this is a commit surface, not a workflow surface).

---

## Backend contract

**Preview endpoint — NEW `[BE-APR-EXEC-02]`:** `GET /api/admin/approvals/:id/execute-preview`

Response 200:
```json
{
  "request": {
    "id": "apr_b7f3a2",
    "last6": "B7F3A2",
    "version": 3,
    "workflow_code": "WF-08",
    "workflow_label": "Credit grant",
    "submitted_at": "2026-09-08T09:14:11Z",
    "submitted_by": {
      "id": "usr_sara_al_mansouri",
      "display_name": "Sara Al Mansouri",
      "avatar_url": "https://…"
    },
    "value_tier": "high_value"
  },
  "action_summary": "Grant 50,000 credits to Elite Real Estate Dubai",
  "two_person": {
    "requires_two_person": true,
    "first_approver": {
      "id": "usr_sara_al_mansouri",
      "display_name": "Sara Al Mansouri",
      "initials": "SM",
      "signed_off_at": "2026-09-08T09:16:03Z"
    },
    "second_approver_slot": {
      "candidate_id": "usr_current_pa",
      "initials": "AK"
    }
  },
  "diff": [
    { "field": "Available credit balance", "before": "AED 12,000.00", "after": "AED 62,000.00", "kind": "money" },
    { "field": "Lifetime credit granted", "before": "AED 84,000.00", "after": "AED 134,000.00", "kind": "money" },
    { "field": "Package tier", "before": "Free trial", "after": "Free trial", "kind": "string" },
    { "field": "Credit expiry", "before": null, "after": "2027-09-08", "kind": "date" }
  ],
  "risk_signals": [
    { "severity": "warn", "label": "Amount exceeds submitter's 90-day average grant size by 3.2×", "detail": "Submitter avg AED 15,600; this request AED 50,000." },
    { "severity": "info", "label": "Recipient tenant on Enterprise plan (high account value)", "detail": null },
    { "severity": "info", "label": "First approver signed off within SLA", "detail": null }
  ],
  "ledger_impact": {
    "currency": "AED",
    "rows": [
      { "account_code": "2110", "account_label": "Credit reserve (liability)", "debit": null, "credit": "50000.00" },
      { "account_code": "5310", "account_label": "Promotional credit expense", "debit": "50000.00", "credit": null }
    ],
    "totals": { "debit": "50000.00", "credit": "50000.00" },
    "balanced": true
  },
  "confirmation_phrase": "quiet-copper-lantern-drift",
  "self_approval": false,
  "step_up_required": false,
  "outcome_url_template": "/admin/credits/tenants/agy_dubai_elite?highlight=grant_b7f3a2",
  "env": "live"
}
```

Response 403 SELF_APPROVAL_FORBIDDEN (returned instead of the preview payload when caller = submitter):
```json
{ "error": "SELF_APPROVAL_FORBIDDEN", "message": "You submitted this request; a different Platform Admin must be the second approver." }
```

**Execute endpoint — NEW `[BE-APR-EXEC-01]`:** `POST /api/admin/approvals/:id/execute`

**Consolidates + supersedes** the existing stub pair at `backend/src/fin/admin/routes.js:282-288`:
- `POST /api/admin/fin/approvals/:id/approve` — currently returns `notImplemented('DL-166')`
- `POST /api/admin/fin/approvals/:id/reject` — currently returns `notImplemented('DL-166')`

Neither today accepts a confirmation phrase, an If-Match version, nor emits a ledger-impact preview. The new `/execute` endpoint replaces both by dispatching the caller's already-cast vote (recorded when they signed off on the approval-detail screen) via a per-workflow executor.

Request body:
```json
{
  "workflow_code": "WF-08",
  "confirmation_phrase": "quiet-copper-lantern-drift"
}
```

Headers: `If-Match: <request.version>` (mandatory), `X-Wingcaster-Env: live|test` (from session).

Response 200:
```json
{
  "ok": true,
  "request_id": "apr_b7f3a2",
  "executed_at": "2026-09-08T09:31:44Z",
  "outcome_url": "/admin/credits/tenants/agy_dubai_elite?highlight=grant_b7f3a2",
  "ledger_journal_id": "jrn_2026_09_08_00147",
  "short_action_summary": "Granted 50,000 AED credits to Elite Real Estate Dubai"
}
```

Response 400 CONFIRMATION_PHRASE_MISMATCH (client-side validation should prevent this; server double-checks):
```json
{ "error": "CONFIRMATION_PHRASE_MISMATCH", "message": "The confirmation phrase does not match the current request-attempt seed." }
```

Response 401 STEP_UP_REQUIRED (session drifted below the required assurance level):
```json
{ "error": "STEP_UP_REQUIRED", "message": "Re-verify your identity to execute this action.", "step_up_url": "/api/auth/step-up/init?return_to=<encoded>" }
```

Response 403 SELF_APPROVAL_FORBIDDEN — same shape as preview endpoint.

Response 409 PRECONDITION_FAILED (If-Match mismatch — the request mutated since preview):
```json
{ "error": "PRECONDITION_FAILED", "message": "The approval request has changed since you opened this confirmation.", "current_version": 4 }
```

Response 409 VOTE_MISMATCH (first approver rejected; second approver attempted approve, or vice-versa):
```json
{ "error": "VOTE_MISMATCH", "message": "Votes do not match — case escalated to PA-APR-005.", "escalation_case_id": "esc_c4a1f2" }
```

Response 503 LEDGER_PREVIEW_UNBALANCED (late server-side re-check on execute):
```json
{ "error": "LEDGER_PREVIEW_UNBALANCED", "message": "Ledger preview does not balance; execution refused.", "delta": "0.03" }
```

Response 500 (generic):
```json
{ "error": "EXECUTE_FAILED", "message": "The action could not be executed. The request is unchanged." }
```

**Server invariants (per `[BE-APR-EXEC-03/04/05]`):**
- `caller.id != request.submitted_by` — else 403.
- `If-Match: request.version` matches current stored version — else 409 PRECONDITION_FAILED.
- Caller has cast the second vote on the approval-detail screen already (via `POST /:id/cast-vote` reusing the PA-ACR-002 pattern) — the `/execute` endpoint is the terminal commit, not the vote itself.
- If `value_tier=high_value`: `confirmation_phrase` in body matches the server's per-request-per-attempt phrase seed — else 400 CONFIRMATION_PHRASE_MISMATCH.
- Ledger preview re-runs server-side on execute; if it does not balance, 503 LEDGER_PREVIEW_UNBALANCED (never commit an unbalanced entry).
- Dispatcher: `workflow_code` routes to the right executor service (`grantCredits` / `publishPackage` / `adjustInvoice` / `changeRateCard` / `releaseVendorPayout` / etc.). Each executor is atomic — either every side-effect commits (ledger + downstream notification + state flip) or nothing commits.
- Audit event written to `fin.approval_audit` on both success and every failure branch — including the self-approval reject, the mismatch, and the ledger-unbalanced refusal.
- Rate limit: max 10 execute attempts per PA per 60 seconds (defense in depth against a malicious script bypassing the client throttle).

**Prerequisites tracked / to file (kickoff §5a):**

- **`[BE-APR-EXEC-01]` Execute endpoint** — ~5 days backend (dispatcher + first-workflow executor + audit + tests). Replaces the existing `/approve` + `/reject` stubs at `backend/src/fin/admin/routes.js:282-288`.
- **`[BE-APR-EXEC-02]` Preview endpoint** — ~4 days backend (compose preview from request + diff + risk service + ledger preview + phrase seed).
- **`[BE-APR-EXEC-03]` Self-approval reject** — server-side identity check + audit trail; small — ~1 day.
- **`[BE-APR-EXEC-04]` If-Match optimistic-concurrency guard** — needs `request.version` column bumped on every mutation; ~2 days including migrations.
- **`[BE-APR-EXEC-05]` Per-workflow executor dispatcher** — ~3 days for the dispatcher scaffold + one executor pilot (`grantCredits` — WF-08); each additional workflow's executor is ~2 days.
- **`[BE-APR-EXEC-06]` Confirmation phrase seed service** — wordlist + generator + per-attempt seeding + retirement on execute or expiry; ~2 days.
- **`[BE-APR-EXEC-07]` Ledger preview service (double-entry)** — feeds `ledger_impact` in the preview payload; ~4 days including account-code table + per-workflow ledger rules + balance verifier.
- **`[BE-APR-EXEC-08]` Vote-mismatch escalation wiring** — reuses PA-ACR-002 `[BE-ACR-10]` escalation-case pattern in `fin.approval_requests`; ~2 days.

Combined new backend surface for the WF-20 execute cluster (PA-APR-003 + escalation + recall): ~20-25 days backend + tests.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/components/admin/approvals/TwoPersonExecuteModal.tsx`.
- **Modal invocation:** exposed via `useTwoPersonExecuteModal()` hook so any approval-detail screen (`PA-APR-002` / `PA-PKG-005` / `PA-CRD-005b` / `PA-INV-004b` / any) can open it with a single call: `openExecuteModal({ requestId, workflowCode })`.
- **URL-hash sync:** modal state written to URL as `#confirm-execute`; on hash removal (via navigation, back button, or manual URL edit), the modal closes cleanly.
- **Component reuse:**
  - `<TwoPersonProgress>` — reused from PA-ACR-002 (`web/src/components/ui/two-person-progress.tsx`).
  - `<Numeric>` — reused.
  - `<PIIMask>` — not needed here (execute preview never exposes PII fields beyond the submitter's display name, which is not masked in the PA admin context).
  - `PA-NAV-001` env badge + persistent TEST strip — reused; do NOT hide even while modal is open.
- **New components:**
  - `TwoPersonExecuteModal.tsx` — the modal shell + state machine (loading / ready / in-flight / self-approval / stale / vote-mismatch / step-up / ledger-unbalanced / success).
  - `ExecuteRequestSummary.tsx` — the 2×2 summary card.
  - `ExecuteDiffPanel.tsx` — the diff-row list with strikethrough-before + green-after formatting.
  - `ExecuteRiskSignals.tsx` — the risk-signals card (only renders when `risk_signals[]` non-empty).
  - `ExecuteLedgerPreview.tsx` — the 3-column ledger table with column totals + balance guard.
  - `TypeToConfirmInput.tsx` — the mono-input + inline phrase + validation state — **REUSABLE across every high-value confirmation surface elsewhere in the app.** File: `web/src/components/ui/type-to-confirm-input.tsx`.
  - `SelfApprovalRejectBlock.tsx` / `StaleRequestBlock.tsx` / `VoteMismatchBlock.tsx` — the body-swap error states.
- **Data layer:**
  - Hook: `useExecutePreview(requestId)` — env-scoped GET; refetched only on modal reopen (do NOT auto-refetch on tab visibility change — that would regenerate the phrase and invalidate typed input).
  - Hook: `useExecuteRequest(requestId)` — wraps `POST /execute` with If-Match header + phrase body + optimistic ban (no premature success signaling).
  - Hook: `useOutcomeNavigator(outcomeUrl)` — deep-link helper for the success toast CTA.
- **Test discipline:**
  - Unit: each sub-component; `TypeToConfirmInput` state machine (empty / typing / mismatch / match / disabled-during-flight).
  - Integration: full modal lifecycle × every state variant × workflow-code dispatch (WF-07 package publish; WF-08 credit grant; WF-09 rate change — pilot three).
  - Contract: mock the preview + execute endpoints and assert request headers (X-Wingcaster-Env + If-Match) + body shape (confirmation_phrase only present for high_value).
  - Self-approval branch: seed a request where caller = submitter and assert the destructive body renders + Escalate CTA links correctly.
  - Stale branch: seed a version-mismatch and assert the warning body + Reload CTA.
  - Vote-mismatch branch: seed a rejected first vote + attempt approve second vote and assert the escalation link.
  - Ledger unbalanced: seed a preview with non-zero net and assert Confirm never enables.
  - Step-up mid-flow: seed a 401 STEP_UP_REQUIRED response and assert the inline SHR-MFA-007 slot renders + retry succeeds.
  - Real-Postgres: at least one path that transitions a WF-08 credit grant through first-vote → second-vote → open modal → execute → ledger posts → audit written → outcome screen reachable.
  - Accessibility: axe-core scan of loaded + in-flight + self-approval + stale + vote-mismatch states.
  - RTL: modal mirrors; type-to-confirm input stays LTR via bidi isolation.
  - Broadcast: `no-raw-hex.test.ts` green.
- **Perf:**
  - Preview fetch within 250ms (server-side pre-computes for pending requests).
  - Confirm-click → success toast within 800ms typical (executor + ledger post + downstream enqueue).
  - Skeleton within 100ms.
- **Copy/i18n:** all strings in `web/src/locales/en/paTwoPersonExecute.json` + `ar/paTwoPersonExecute.json`.

---

## Broadcast alignment callouts (short)

**Refer to PA-MOD-001 §Broadcast alignment callouts as the family anchor + PA-ACR-002 §Broadcast alignment callouts for the `<TwoPersonProgress>` primitive.** All page-shell, top-bar, env-badge, focus-ring, radii, elevation, motion, no-raw-hex rules apply UNCHANGED.

PA-APR-003-specific overlays:
- Modal shell `--lc-radius-xl`; internal cards `--lc-radius-lg`; inputs `--lc-radius-md`; buttons `--lc-radius-md`; badges `--lc-radius-pill`.
- Modal padding `var(--lc-space-2xl)`; card padding `var(--lc-space-lg)`; row gap inside modal `var(--lc-space-md)`; button pair gap `var(--lc-space-md)`.
- Modal enter `--lc-duration-slow` `--lc-easing-out`; exit `--lc-duration-base` `--lc-easing-in-out`; two-person step-2 pulse `--lc-duration-slow` at `--lc-accent-bold-edge`; Loader2 spin standard.
- Confirm button ALWAYS `variant="destructive"` — never primary orange. Cancel `variant="ghost"`. Close X `variant="ghost" size="icon"`.
- Type-to-confirm input mono + tabular-nums via `--lc-font-mono`; inline phrase in `<code>` on `--lc-status-warning-bg` background with `--lc-status-warning-fg` ink.
- Diff row `before` value strikethrough via `text-decoration-line: line-through` with `text-decoration-color: --lc-text-muted`; `after` value `--lc-status-published-fg` + `font-weight: 600`; arrow glyph `→` in `--lc-text-muted`.
- Ledger table headers `var(--lc-type-overline)` `--lc-text-muted`; body cells `.lc-data`; totals row `font-weight: 600` `--lc-text-primary`; balanced indicator `✓` in `--lc-status-published-fg`.
- Env chip inside modal: LIVE `--lc-status-published-{bg,fg,dot}` + ●; TEST `--lc-status-warning-{bg,fg,dot}` + ▲. Workflow code chip: `variant="outline"` + mono.
- Every numeric — request-id last-6, money amounts, timestamps, wordlist phrase length, ledger totals — via `<Numeric>` or `.lc-data`.
- Two-tone focus ring on every interactive control via base CSS; do NOT override.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) two-person action confirmation modal (PA-APR-003) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is the WF-20 EXECUTE surface — the terminal commit point for every two-person approval in the platform (credit grants, package publishes, invoice adjustments, rate-card changes, vendor payouts). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

This modal opens over an already-loaded workflow-specific approval-detail screen (PA-APR-002 / PA-PKG-005 / PA-CRD-005b / PA-INV-004b). Critical patterns: environment badge (LIVE ● / TEST ▲) visible in the top bar AND inside the modal header; two-person progress bar reused from PA-ACR-002; diff panel with strikethrough-before + green-bold-after values; ledger-impact preview (debit/credit table that must balance to zero); consent-to-proceed checkbox (always); type-to-confirm text field with a server-generated 4-word Diceware phrase (ONLY for value_tier=high_value); destructive-orange Confirm button that is disabled until every guard passes; server rejects self-approval attempts (caller = submitter → 403 → modal swaps to a friendly Escalate flow).

First pass: render the modal open over a PA-CRD-005b credit-grant approval-detail screen in LIVE env, HIGH-VALUE tier. Top-bar env badge green LIVE ●. Modal 640px wide, centered, elevation-lg over a 60% inverse scrim. Modal header carries LIVE ● + WF-08 chips beside "Confirm and execute" title. Sub-title "Request #B7F3A2 · submitted 14m ago". Sunken summary card 2×2: Action "Grant 50,000 credits to Elite Real Estate Dubai" / Value tier High-value danger badge ◆ / Submitted by SM avatar + 14m ago / Assigned approvers SM ● + AK ○ chip cluster. Two-person progress: step 1 filled green (First approver SM signed off 12m ago), step 2 amber pulsing (Second approver you — pending). Raised diff panel "What will change" with 4 rows including AED before/after values (before strikethrough gray, after green bold, mono). Raised risk-signals panel with 3 signals (1 warn + 2 info). Sunken ledger-impact panel with 3-column table (Account / Debit / Credit) totaling AED 50,000.00 both sides, "Posts to LIVE ledger on confirm." footer. Unchecked consent checkbox. Type-to-confirm input "Type quiet-copper-lantern-drift to confirm" (phrase in inline mono <code> on amber bg). Bottom-right: Cancel ghost + destructive-orange "Grant credits and post to ledger" DISABLED. Audit note at footer.

LTR English only for this pass — I'll ask for ready-to-fire, wrong-phrase, in-flight, standard tier, non-financial workflow, self-approval, stale, vote-mismatch, ledger-unbalanced, step-up, TEST env, RTL, dark as follow-ups.

Follow the copy table exactly. Do NOT invent risk-signal scores, ledger accounts, or ledger amounts. Every visible signal is a defined backend payload attribute. Confirm button is ALWAYS destructive-variant (never primary orange).

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:

1. `Ready-to-fire — consent checked; phrase typed correctly "quiet-copper-lantern-drift"; Confirm button ENABLED with hover state on destructive-orange.`
2. `Wrong phrase — consent checked; phrase typed with typo "quiet-copper-lantern-driftt"; inline red "Doesn't match. Type the phrase exactly." Confirm still DISABLED.`
3. `In-flight — Confirm button shows Loader2 spinner + "Executing…"; whole modal dimmed to 0.65 opacity; Cancel disabled.`
4. `Standard tier — same shell, no type-to-confirm input, Value tier badge shows Standard, consent checkbox only; Confirm label "Confirm and execute" generic fallback.`
5. `Non-financial workflow (WF-07 package publish) — no ledger-impact card; diff shows Draft → Published state transition; Confirm label "Publish package".`
6. `Self-approval reject (403) — modal body swapped to destructive block with AlertTriangle icon + "You can't approve your own request." + Escalate CTA.`
7. `Stale request (409) — modal body swapped to warning block with RefreshCw + "This request has changed." + Reload CTA.`
8. `Vote-mismatch (409) — info block with Users icon + "Votes do not match." + Open-escalation CTA.`
9. `Ledger-unbalanced (503) — modal opens with red banner in ledger card showing delta 0.03 off; Confirm never enables.`
10. `Step-up inline (401) — SHR-MFA-007 slot renders inside the modal body; request context (summary + progress) remains visible above it.`
11. `TEST env — top-bar badge amber ▲; TEST persistent warning strip visible above the backdrop; modal header carries amber TEST ▲ chip; ledger footer reads "Posts to TEST ledger on confirm.".`
12. `RTL Arabic at desktop 1440px with [TRANSLATION-PENDING] where copy has no Arabic; MIRROR the modal layout; two-person progress bar mirrors; type-to-confirm input stays LTR via bidi isolation (phrase is Latin ASCII).`
13. `Dark mode version of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-APR-003/` + screenshot to `docs/design/mockups/PA-APR-003-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 13 iteration states (ready-loading LIVE high-value, ready-to-fire, wrong-phrase, in-flight, standard tier, non-financial workflow, self-approval, stale, vote-mismatch, ledger-unbalanced, step-up inline, TEST env, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-APR-003/`.
- [ ] Cursor Wave-2 Week-6 dispatch prompt references this brief + the mockup paths + the sibling PA-APR-005 (escalate) + PA-APR-006 (recall) briefs.
- [ ] `[BE-APR-EXEC-01..08]` filed in kickoff §5a — combined ~20-25 days backend for the WF-20 execute cluster.
- [ ] `<TypeToConfirmInput>` primitive shipped as reusable at `web/src/components/ui/type-to-confirm-input.tsx` — documented for reuse in future high-value confirmation surfaces (destructive tenant deletion, workspace teardown, rate-card wipe, etc.).
- [ ] `<TwoPersonProgress>` primitive (already shipped by PA-ACR-002) reused verbatim — do NOT fork.
- [ ] Backend note filed: the existing stubs at `backend/src/fin/admin/routes.js:282-288` (`/api/admin/fin/approvals/:id/approve` + `:id/reject`, both returning `notImplemented('DL-166')`) MUST be replaced by the unified `POST /api/admin/approvals/:id/execute` route per `[BE-APR-EXEC-01]` before this UI ships. The `/execute` route is the terminal commit; per-approver vote-casting continues to route through the approval-detail screen's cast-vote endpoint (reusing the PA-ACR-002 `[BE-ACR-10]` pattern).
- [ ] Broadcast `no-raw-hex.test.ts` and RTL screens tests updated to include PA-APR-003.
- [ ] Anchor status confirmed: PA-APR-005 (escalation) and PA-APR-006 (recall) briefs reference this file as their layout + primitive + backend-family anchor.
