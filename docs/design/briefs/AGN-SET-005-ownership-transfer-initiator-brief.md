# Screen Brief — AGN-SET-005 · Ownership transfer initiator (agency-side) — ANCHOR for WF-31 cluster

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENCY.md` §AGN-SET-005 entry. Week 7 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 31 + §6 Week 7. First screen of the WF-31 (Ownership transfer) 3-screen deadlock-resolution cluster: **AGN-SET-005 (this brief, initiator) → AGN-SET-005b (recipient accept) → AGT-REC-006 (agent outcome for former + new owner)**.

**ANCHOR NOTICE.** This brief is the pattern anchor for the WF-31 cluster. AGN-SET-005b re-uses this brief's 3-factor challenge composition (SHR-MFA-007 step-up + email OTP + typed agency-name confirmation) and the reversal-window language verbatim. AGT-REC-006 inherits the AGT-REC-004 REC-family primitives (`<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>`) and only spells out state-map deltas.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii / elevation references below are governed by that reference. Never introduce raw hex, never introduce a `--lc-orange-*` primitive alias, never use a Tailwind palette class that isn't already remapped to a Broadcast semantic in `web/tailwind.config.js`.

**Screen-specific Broadcast callouts:**

- **Warning tone throughout.** Ownership transfer is high-risk but reversible for 30 days after the recipient accepts (per §Backend contract). Use `--lc-status-underOffer-*` amber tones for cautionary banners — NEVER `--lc-status-unpublished-*` (red) except on the final "Transfer ownership" submit button, which pairs `--lc-status-unpublished-fg` fill with `--lc-text-inverse` ink to signal the irreversibility of *starting* the workflow (the recipient can still decline).
- **Impact banner (top of form)** — `--lc-surface-raised` card + `border-left: 4px solid var(--lc-status-underOffer-fg)`, glyph `AlertTriangle` 32×32 in `--lc-status-underOffer-fg`, heading `var(--lc-type-heading-2)`, body `var(--lc-type-body)`.
- **Target-admin picker** — `<Select>` primitive listing only current agency members whose `role IN ('admin', 'senior_admin')` AND `status = 'active'` AND `user_id != current_owner.user_id`. Each option renders as avatar 24×24 + display name + role chip + tenure (`Admin · 2y 4mo`). Uses `<Numeric>` for tenure.
- **Rationale textarea** — `<Textarea>` 4-row minimum, `var(--lc-type-body)`, character counter `<Numeric>` bottom-right (`0 / 500`). Placeholder muted per token. Rationale is audit-recorded and shown verbatim on AGN-SET-005b + AGT-REC-006.
- **Reversal-window notice card** — `--lc-surface-sunken` card, glyph `RotateCcw` 20×20 in `--lc-text-brand`, `var(--lc-type-body-sm)` body. Explains the 30-day post-accept reversal window.
- **3-factor challenge block** — three vertically stacked mini-cards inside a bordered container (`--lc-surface-raised` + `--lc-elevation-sm`). Each mini-card shows a step number badge (1/2/3), label, current state (Pending / Complete), and inline control. Steps advance sequentially — step 2 disabled until 1 completes, etc.
  - Step 1: Password re-prompt (SHR-MFA-007 modal step-up). Complete-state icon `ShieldCheck` in `--lc-accent-bold` on `--lc-accent-bold-edge` outline.
  - Step 2: Email OTP (6-digit input, sent to owner's account email). Same OTP input pattern as SHR-SET-005c: 6 boxes, `var(--lc-type-data)` mono, auto-advance, paste-fills-all.
  - Step 3: Typed agency-name confirmation. Case-insensitive, whitespace-trimmed. Placeholder shows the exact agency name to type.
- **Consent checkbox** — `<Checkbox>` primitive. Label reads "I understand ownership will transfer to {target} once they accept, and I will become an Admin." Required to enable submit.
- **Submit button ("Transfer ownership")** — full-width on mobile, right-aligned max-width 320px desktop. Fill `--lc-status-unpublished-fg` (red primary — this is the ONE red button on the screen). Hover DARKER. Disabled until all 3 challenge steps complete + consent checked + rationale ≥ 20 chars + target selected.
- **Cancel link** — `<Button variant="ghost">` label "Cancel and stay owner", `--lc-text-muted`, always visible.
- **Motion** — challenge-step transitions cross-fade at `--lc-duration-base` (180ms). Submit button loading spinner `Loader2` at `--lc-duration-fast`. NO emphasis easing anywhere. Ownership transfer is a governance action, not a broadcast moment.
- **Focus rings + 44px tap floor** — automatic via base CSS.

---

## Meta

| | |
|---|---|
| Screen ID | AGN-SET-005 |
| Screen name | Ownership transfer initiator |
| Persona | Agency owner ONLY (cannot delegate — server enforces `caller.role === 'owner' AND caller.user_id === agency_tenant.owner_user_id`) |
| Device targets | Desktop 1440px (primary — this is a governance action performed at a workstation), tablet 768px, mobile 375px (functional but discouraged via a soft top-of-form advisory) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/agency/settings/ownership-transfer` — top-level settings subroute; NOT a modal from AGN-SET-001 (per feedback 2026-09-08 the matrix's "modal from AGN-SET-001" note is superseded — dedicated route enables deep-linking from the transfer-in-progress banner and from PA support tooling) |
| Current state | MISSING — must ship with WF-31 cluster (Week 7). |
| Workflow role | WF-31 role=Initiator. Emits an `ownership_transfer_request` that surfaces on AGN-SET-005b for the target admin. |
| Backend prerequisites | ⏳ **NEW** `ownership_transfer_requests` table (migration) · ⏳ **NEW** `POST /api/agencies/:id/ownership-transfer/initiate` · ⏳ **NEW** `POST /api/agencies/:id/ownership-transfer/:transferId/cancel` · ⏳ **NEW** email-OTP dispatch for owner-initiated transfer (reuse existing Microsoft Graph transport per memory) · ✅ SHR-MFA-007 step-up (already exists — `backend/src/server.js` step-up elevation tokens) · ✅ Notifications infra (WF-01/02/03 dispatcher — new template rows only) · ⏳ **NEW** 30-day reversal-window enforcement in `tenant_memberships` write logic |

---

## Purpose

The agency owner opens `/agency/settings/ownership-transfer` to transfer ownership of the agency to another admin within the same agency. Ownership transfer is a **high-risk governance action** with the same failure mode as `SHR-SET-005` (account delete): once completed, the initiator loses irrevocable control over the agency's billing address, contract signer, PA escalation privileges, and legal-representative designation. Unlike SHR-SET-005, however, the recipient must actively accept — so this screen creates a *request*, not an atomic flip. The flip happens server-side after the recipient completes AGN-SET-005b's own 3-factor challenge.

**Emotional stakes:** high. The owner is handing over the keys to their business. Copy must be sober (see SHR-SET-005 anti-patterns) — no gimmicks, no confetti, no "we'll miss you". Framing is "you're delegating leadership", not "you're leaving".

Success outcome: `ownership_transfer_request` row created with status `pending_recipient_accept`. Target admin receives email + push notification with deep-link to AGN-SET-005b. Owner remains owner until target accepts (or 14-day request-expiry cron flips it to `expired`). Owner can cancel the pending request at any time from this same route (renders in a different state variant — see §State variants: PENDING-RECIPIENT-ACCEPT).

---

## Design goals

1. **The consequence is legible before the first form field.** Impact banner at top explains what changes when the target accepts. Owner should be able to abandon the flow in the first 200ms if they weren't ready for that consequence.
2. **The 3 factors are visibly a sequence, not a wall of inputs.** Presented as three numbered steps, sequentially enabled. Owner completes step 1 before seeing step 2. Reduces error rate + reduces the feeling of being interrogated by a form.
3. **Rationale is a first-class input, not a footnote.** The rationale text is shown verbatim on the recipient's accept screen (AGN-SET-005b) and on the AGT-REC-006 outcome page for the former owner's audit trail. Placeholder copy nudges toward a real reason ("e.g. I'm stepping back from operations; Ahmad has been leading the team for the past year.").
4. **Reversal-window is discoverable, not hidden.** The 30-day post-accept reversal is called out on this screen, on AGN-SET-005b, and on AGT-REC-006. Owner should never feel they've made an irreversible decision when they haven't.
5. **Anti-patterns strictly enforced (see §Anti-patterns).** No self-transfer. No transfer to non-admin. No "delete the agency" fallback wired to this screen. No pre-selected target.
6. **RTL-first for MENA.** Arabic mirrors the whole layout; the 3-factor challenge steps flow right-to-left; typed agency-name confirmation input stays LTR when the agency name is Latin, RTL when Arabic.
7. **Anchor discipline for WF-31.** AGN-SET-005b re-uses this brief's 3-factor challenge composition verbatim. Any change lands here first.

---

## Layout

### Desktop 1440px (primary)

Single-column centered layout, max-width `720px`, top-padding `var(--lc-space-4xl)`:

1. **Breadcrumb + back** — `Agency settings › Ownership transfer` breadcrumb top-left. Back arrow chevron to AGN-SET-001.
2. **H1** — "Transfer ownership of {Agency Name}" (`var(--lc-type-display)`, `--lc-text-heading`).
3. **Sub** — "Hand leadership of this agency to another admin. You'll stay as an Admin after they accept." (`var(--lc-type-body-lg)`, `--lc-text-secondary`).
4. **Impact banner** — full-width amber-bordered card. Heading "When {target} accepts:" then a bulleted impact list (see §Impact list content).
5. **Reversal-window notice card** — small sunken card immediately below impact banner. Copy: "You have **30 days** after the transfer completes to reverse it. After 30 days, this cannot be undone from within the app — you'd need PA support to intervene." Icon `RotateCcw`.
6. **Section: Choose the new owner** — heading `var(--lc-type-heading-2)`.
   - Target-admin picker (Select). Placeholder: "Select an admin from your agency".
   - Helper: "Only current agency admins can receive ownership. To transfer to someone outside your admins, promote them first (Members → Change role)."
   - If the picker returns zero eligible targets, replace picker with an inline empty-state card: "No eligible admins. Promote a member to Admin first, then return here." + link to AGN-MEM-001.
7. **Section: Rationale (audit-recorded)** — heading `var(--lc-type-heading-2)`.
   - Textarea, 4 rows min, 500 char max.
   - Placeholder: "e.g. I'm stepping back from operations. Ahmad has been leading the team for the past year and is ready to sign contracts on the agency's behalf."
   - Helper: "This message is shown to {target} when they review the transfer, and stays in the agency's audit log. Minimum 20 characters."
8. **Section: Confirm identity (3 factors)** — heading `var(--lc-type-heading-2)` + subheading "For safety, we ask for three separate confirmations before starting the transfer."
   - **Step 1** card: "Password re-check". Button "Verify password" opens SHR-MFA-007 modal. On success, card flips to complete state (green checkmark + timestamp "Verified just now").
   - **Step 2** card (disabled until 1 complete): "Email code". Button "Send code to {maskedOwnerEmail}" fires OTP dispatch. On dispatch, card expands to show 6-box input + resend link (60s cool-down) + link "Not this email? Update in account settings" (opens SHR-SET-002 in new tab). On correct code entry, card flips to complete state.
   - **Step 3** card (disabled until 2 complete): "Type the agency name". Card shows the exact agency name as a large mono pill (e.g. `Elite Real Estate`) with a copy icon that shows a "Type it, don't paste" warning tooltip. Below the pill: input `Type "{Agency Name}" to confirm`. Case-insensitive, whitespace-trimmed. On match, card flips to complete state.
9. **Consent** — checkbox: "I understand ownership will transfer to {target} once they accept my request, and I will become an Admin of {Agency Name}."
10. **Actions row** — right-aligned on desktop:
    - `Cancel and stay owner` (ghost, `--lc-text-muted`) on the left of the row (or above submit on mobile).
    - `Transfer ownership` (destructive-red primary, `--lc-status-unpublished-fg` fill) on the right. Disabled until all validations pass.
11. **Contact-support link** — footer, `--lc-text-brand` link "Something not right? Contact WingCaster support" → routes to `SHR-SUP-001` with pre-filled context.

### Mobile 375px

Same content, single column, stacked. Advisory banner at top (`--lc-surface-sunken`): "Ownership transfer is a governance action. Consider completing this from a desktop." (dismissible but non-blocking).

Sticky bottom action bar with `Transfer ownership` (full-width, `--lc-status-unpublished-fg`) + `Cancel and stay owner` (text link above).

### RTL

Full mirror. 3-factor challenge cards flow right-to-left (step 1 rightmost, step 3 leftmost). Numeric OTP boxes stay LTR-embedded. Typed agency-name confirmation input follows the agency name's script (Latin → LTR, Arabic → RTL).

---

## Impact list content

Impact banner body — every bullet begins with a specific noun so the owner scans consequences fast:

- **Billing address & payment method** move to {target}. Paddle records will re-attribute to {target}'s email for future invoices.
- **Contract signer** on all agency vendor contracts (portal accounts, brand assets) transitions to {target}.
- **PA escalation privileges** — only the current owner can escalate to WingCaster Platform Administrators. This moves to {target}.
- **Legal-representative designation** for compliance filings (GDPR, KSA PDPL, UAE DP Law) moves to {target}.
- **Your role** flips from Owner to Admin. You keep every admin capability, but you cannot re-transfer ownership back without {target} initiating a new transfer.

Followed by a small "What doesn't change" section:
- Your listings and contacts remain owned by you within the agency.
- Your capability pack and permissions remain the same as any Admin.
- The agency name, branding, and public profile are unchanged.

---

## Reusable challenge composition — the 3-factor pattern (WF-31 anchor)

**This composition is lifted verbatim by AGN-SET-005b.** Any change to the pattern lands here first. It layers on top of SHR-SET-005's proven approach but is a **WF-31-specific variant** (see §Backend contract) — SHR-SET-005 delete-account uses random-liveness-word + email-link-with-token + TOTP; WF-31 uses password step-up + email-OTP-code + typed-agency-name. The three factors are not interchangeable across flows.

**Component:** `<OwnershipTransferChallenge>` at `web/src/components/agency/OwnershipTransferChallenge.tsx`.

**Props:**
```ts
type OwnershipTransferChallengeProps = {
  agencyName: string;                      // exact text the user must type in step 3
  ownerEmailMasked: string;                // e.g. "s•••@elite.ae"
  onAllComplete: (proofs: {
    stepUpToken: string;                   // from SHR-MFA-007 modal
    otpCode: string;                       // 6-digit
    typedAgencyName: string;               // for audit — server re-validates
  }) => void;
  onReset: () => void;                     // reset from a resend or a wrong code
};
```

**Step contract:**
- Step 1 (password step-up) issues an elevated-session token via SHR-MFA-007 (existing backend). Token TTL 5 minutes. If TTL elapses before submit, the card auto-reverts to pending and requires re-verification.
- Step 2 (email OTP) requests a fresh 6-digit code via `POST /api/agencies/:id/ownership-transfer/otp/send`. Code TTL 10 minutes. Rate-limited (60s between sends, max 5 sends per hour per owner).
- Step 3 (typed agency name) is client-side validated (case-insensitive, whitespace-trimmed) AND server-re-validated on submit — the server compares against the current agency `display_name` at submit time (defends against a race where the owner renamed the agency between load and submit).

**Server-side final validation on `POST /api/agencies/:id/ownership-transfer/initiate` requires ALL THREE proofs.** Any missing or expired proof → 401 with a specific error code so the frontend can reset the exact step (see §Backend contract).

**A11y:** step cards are `<ol>` with `<li>` per step; current step has `aria-current="step"`; complete steps have `aria-label="Step {n} complete"`. Live-region announcement on step advance.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Breadcrumb | Agency settings › Ownership transfer |
| H1 | Transfer ownership of {Agency Name} |
| Sub | Hand leadership of this agency to another admin. You'll stay as an Admin after they accept. |
| Impact banner heading | When {target} accepts: |
| Impact bullet — billing | **Billing address & payment method** move to {target}. Paddle records will re-attribute to {target}'s email for future invoices. |
| Impact bullet — contract signer | **Contract signer** on all agency vendor contracts transitions to {target}. |
| Impact bullet — PA escalation | **PA escalation privileges** move to {target}. Only the current owner can escalate to WingCaster support. |
| Impact bullet — legal | **Legal-representative designation** for compliance filings (GDPR, KSA PDPL, UAE DP Law) moves to {target}. |
| Impact bullet — your role | **Your role** flips from Owner to Admin. You keep every admin capability, but you cannot re-transfer ownership back without {target} initiating a new transfer. |
| What doesn't change — heading | What doesn't change: |
| What doesn't change — listings | Your listings and contacts remain owned by you within the agency. |
| What doesn't change — capabilities | Your capability pack and permissions remain the same as any Admin. |
| What doesn't change — brand | The agency name, branding, and public profile are unchanged. |
| Reversal-window notice | You have **30 days** after the transfer completes to reverse it. After 30 days, this cannot be undone from within the app — you'd need WingCaster support to intervene. |
| Section 1 heading | Choose the new owner |
| Target picker placeholder | Select an admin from your agency |
| Target picker helper | Only current agency admins can receive ownership. To transfer to someone outside your admins, promote them first (Members → Change role). |
| Target picker empty state | No eligible admins. [Promote a member to Admin] first, then return here. |
| Section 2 heading | Rationale (audit-recorded) |
| Rationale placeholder | e.g. I'm stepping back from operations. Ahmad has been leading the team for the past year and is ready to sign contracts on the agency's behalf. |
| Rationale helper | This message is shown to {target} when they review the transfer, and stays in the agency's audit log. Minimum 20 characters. |
| Rationale counter | {n} / 500 |
| Section 3 heading | Confirm identity (3 factors) |
| Section 3 subheading | For safety, we ask for three separate confirmations before starting the transfer. |
| Step 1 label | Password re-check |
| Step 1 button (pending) | Verify password |
| Step 1 complete | Password verified · {relative time} |
| Step 2 label | Email code |
| Step 2 button (pending) | Send code to {ownerEmailMasked} |
| Step 2 code label | Enter the 6-digit code |
| Step 2 resend (ready) | Resend code |
| Step 2 resend (wait) | Resend in {seconds}s |
| Step 2 change-email link | Not this email? Update in account settings |
| Step 2 error — wrong | That code doesn't match. Try again or resend. |
| Step 2 error — expired | Code expired. Send a new one. |
| Step 2 complete | Email code verified · {relative time} |
| Step 3 label | Type the agency name |
| Step 3 pill copy-warning tooltip | Type it, don't paste — this is a liveness check. |
| Step 3 input placeholder | Type "{Agency Name}" to confirm |
| Step 3 error | That doesn't match "{Agency Name}". Check for extra spaces or a typo. |
| Step 3 complete | Agency name confirmed |
| Consent checkbox | I understand ownership will transfer to {target} once they accept my request, and I will become an Admin of {Agency Name}. |
| Submit CTA | Transfer ownership |
| Submit CTA (submitting) | Sending request… |
| Cancel CTA | Cancel and stay owner |
| Cancel dialog title | Cancel ownership transfer? |
| Cancel dialog body | You'll stay as owner. You can start a new transfer any time. |
| Cancel dialog confirm | Yes, cancel |
| Cancel dialog reject | Keep going |
| Success toast (after submit) | Request sent to {target}. You'll be notified when they respond. |
| Contact support link | Something not right? Contact WingCaster support |
| Mobile advisory | Ownership transfer is a governance action. Consider completing this from a desktop. |
| Blocked — target refused (returning to this screen after 005b decline) | {target} declined the transfer on {date}. Reason: "{decline_reason}". You can start a new transfer to a different admin or contact {target} directly. |
| Blocked — no eligible admins | Your agency has no eligible admins for ownership transfer. Promote a member to Admin first. |
| Blocked — request already pending | You already have a pending transfer to {existing_target} sent {relative}. Cancel that request before starting a new one. |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:
- **Agency name:** "Elite Real Estate"
- **Owner:** Sara Al Mansoori (`sara.almansoori@elite.ae` → masked `s•••@elite.ae`)
- **Target selected:** Ahmad Khoury (Admin · 2y 4mo)
- **Rationale:** "Stepping back from day-to-day ops. Ahmad has been running the operations side for the past year, signed our last three portal renewals with me, and is the right person to represent Elite going forward."
- **Step 1:** complete (Password verified · just now)
- **Step 2:** complete (Email code verified · just now)
- **Step 3:** input filled with `Elite Real Estate` — complete
- **Consent checkbox:** ticked
- **Transfer ownership button:** enabled, red, hover state

Iteration order for v0 after first pass:
1. Desktop 1440px, INITIAL state — no target selected, all 3 steps in pending state, submit disabled.
2. Desktop 1440px, PARTIAL state — target selected, rationale being typed (250 / 500 chars), step 1 complete, step 2 in progress (OTP dispatched, 6-box input empty), step 3 disabled.
3. Desktop 1440px, PENDING-RECIPIENT-ACCEPT state — screen replaces the form with a status card: "Waiting on {target} to accept. Sent {relative}. Expires {date}." + `<OutcomeTimeline>`-like mini rail + Cancel-request button.
4. Desktop 1440px, TARGET-REFUSED state — form replaced with a card explaining the decline + rationale from target + "Start a new transfer" primary.
5. Mobile 375px, INITIAL state (with advisory banner).
6. RTL Arabic mirror at desktop 1440px, PARTIAL state.
7. Dark mode desktop, PARTIAL state.
8. Cancel-request confirm dialog open over PENDING-RECIPIENT-ACCEPT.

Save each output's JSX to `web/src/components/agency/OwnershipTransferInitiator/` and screenshot to `docs/design/mockups/AGN-SET-005-<state>.png`.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Breadcrumb | Custom `<nav>` reusing SHR-NAV-002 breadcrumb pattern |
| Impact banner | `Alert` variant custom (amber-bordered card) |
| Reversal-window notice | `Card` with `--lc-surface-sunken` |
| Target-admin picker | `Select` from shadcn, options rendered with `Avatar` + name + role chip + `<Numeric>` tenure |
| Rationale textarea | `Textarea` |
| Rationale counter | `<Numeric>` |
| 3-factor challenge container | Custom `<OwnershipTransferChallenge>` — see §Reusable challenge composition |
| Step cards | Custom composed of `Card` + step-number `Badge` + inline control |
| Password step-up modal | Existing `SHR-MFA-007` modal (do not re-implement) |
| OTP input | 6-box custom OTP input (same pattern as SHR-SET-005c) |
| Typed-name pill | Custom `<div>` with `var(--lc-type-data)` mono + `Copy` icon that fires a tooltip warning |
| Consent | `Checkbox` + label |
| Submit CTA | `Button` custom class binding `--lc-status-unpublished-fg` fill |
| Cancel ghost | `Button variant="ghost"` |
| Cancel confirm dialog | `AlertDialog` |
| Success toast | `Sonner` |
| Loading skeleton | `Skeleton` mirroring form shape |

---

## Interactions

**On page load:**
- Fetch `GET /api/agencies/:id/ownership-transfer/state` (see §Backend contract). Response shape drives which state variant renders:
  - `null` transfer → render initial form.
  - `pending_recipient_accept` → render PENDING-RECIPIENT-ACCEPT status view.
  - `target_declined` (recent, unacknowledged) → render TARGET-REFUSED view with dismissible CTA "Start a new transfer".
  - `expired` (recent, unacknowledged) → same as target_declined shape with different copy.
- On 403 (caller is not the owner): full-screen "Only the agency owner can transfer ownership" fallback with "Return to agency settings" link.

**On target-picker open:**
- Fetch `GET /api/agencies/:id/members?role_in=admin,senior_admin&status=active&exclude_self=true` to populate options.
- If empty, render inline empty-state card + link to AGN-MEM-001.

**On step 1 click "Verify password":**
- Open SHR-MFA-007 modal. On success, receive `stepUpToken` (TTL 5min). Card flips to complete. Store token in component state (not localStorage).
- On modal cancel: no state change. On modal failure: destructive toast.
- If `stepUpToken` expires while owner still on the page, card auto-reverts to pending state with a small helper "Verification expired — re-verify to continue".

**On step 2 click "Send code":**
- POST `/api/agencies/:id/ownership-transfer/otp/send`. Server sends 6-digit code to owner's account email via Microsoft Graph transport (per memory).
- On success: card expands to show 6-box input + starts a 60s resend cool-down.
- On rate-limit (429): show inline error "You've requested too many codes. Try again in {N} minutes."
- On code entry: validate client-side (6 digits, numeric). Server-side validation happens at final submit.
- Correct-code detection: client just checks length; server validates. On final submit, if code wrong or expired, response returns 401 with `INVALID_OTP` or `EXPIRED_OTP` and the client marks step 2 incomplete.

**On step 3 input change:**
- Client-side compare (case-insensitive, whitespace-trimmed) to `agencyName` prop.
- On match: card flips to complete.
- On mismatch after typing: show inline error under the input.

**On consent checkbox tick:**
- If all other validations pass, submit button enables.

**On Transfer-ownership click:**
- Open confirm dialog "Send transfer request to {target}?" body "{target} will get an email + push notification. Ownership doesn't change until they accept. You have 30 days to reverse the transfer after acceptance." Confirm / Cancel buttons.
- On confirm: POST `/api/agencies/:id/ownership-transfer/initiate` with body:
  ```json
  {
    "target_user_id": "usr_ahmad",
    "rationale": "Stepping back from day-to-day ops. ...",
    "step_up_token": "elev_...",
    "otp_code": "482913",
    "typed_agency_name": "Elite Real Estate"
  }
  ```
- On success (201): success toast, screen re-renders to PENDING-RECIPIENT-ACCEPT variant.
- On 401 `INVALID_STEP_UP` / `INVALID_OTP` / `INVALID_TYPED_NAME`: marks that specific step incomplete, shows helper "Verification failed — please re-verify step {n}".
- On 409 `TARGET_NOT_ELIGIBLE` (target lost admin role between load and submit): destructive toast + resets target picker.
- On 409 `TRANSFER_ALREADY_PENDING` (race with another owner action): re-fetches state, renders PENDING variant.
- On 500: destructive toast, form re-enables.

**On Cancel-and-stay-owner click:**
- Open confirm dialog. On confirm: no server call (nothing was submitted yet), navigate back to AGN-SET-001.

**On PENDING-RECIPIENT-ACCEPT — Cancel-request click:**
- POST `/api/agencies/:id/ownership-transfer/:transferId/cancel`. Notification sent to target ("Owner cancelled the transfer request"). Screen re-renders to initial form.

**On TARGET-REFUSED — "Start a new transfer" click:**
- POST `/api/agencies/:id/ownership-transfer/:transferId/acknowledge`. Screen re-renders to initial form.

**Live update (push arrived while page open):**
- If backend notifies "target accepted" or "target declined" while owner is looking at the PENDING view, page re-fetches state and cross-fades to the new variant at `--lc-duration-base`.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Initial state fetch in flight | Skeleton mirror of the form. |
| **Not-owner (403)** | Caller is admin, not owner | Full-screen "Only the agency owner can transfer ownership" + Return to settings. |
| **Initial** | No pending transfer | Form as described. Submit disabled until all validations pass. |
| **Target-picker empty** | Zero eligible admins | Picker replaced with empty-state card + link to AGN-MEM-001. Rest of form hidden. |
| **Partial (target selected, some steps pending)** | Owner mid-flow | Steps enable sequentially. Submit stays disabled. |
| **All-verified** | Target + rationale + all 3 steps complete + consent | Submit enabled, red, hover DARKER. |
| **Submitting** | POST in flight | Submit button shows `Loader2` + "Sending request…". Entire form inert. |
| **PENDING-RECIPIENT-ACCEPT** | Backend has pending transfer | Form replaced with a status card: "Waiting on {target}. Sent {relative}. Expires {date}." Mini timeline (Initiated → Sent → Awaiting accept). Cancel-request ghost + View-audit-log link. |
| **TARGET-REFUSED** | Backend transfer status = target_declined AND !acknowledged | Card: "{target} declined on {date}. Reason: '{reason}'." Primary "Start a new transfer" + secondary "Contact {target}". |
| **EXPIRED** | Backend transfer status = expired (14-day request TTL) AND !acknowledged | Card: "The transfer request expired without a response from {target}." Primary "Start a new transfer" + secondary "Contact {target}". |
| **Step 1 expired** | Step-up token TTL elapsed while form open | Step 1 card auto-reverts to pending with helper. Steps 2 + 3 disable. |
| **OTP resend rate-limited** | 429 on send | Resend button shows "Resend in {mm:ss}". |
| **OTP invalid at submit** | 401 INVALID_OTP | Step 2 flips to incomplete, helper "Code was wrong or expired. Send a new one." |
| **Typed name mismatch at submit** | 401 INVALID_TYPED_NAME (agency renamed mid-flow race) | Step 3 flips to incomplete, helper "The agency name changed. Refresh and try again." |
| **Target ineligible at submit** | 409 TARGET_NOT_ELIGIBLE | Destructive toast, picker reset. |
| **Transfer already pending** | 409 TRANSFER_ALREADY_PENDING | Re-fetch state, PENDING variant. |
| **Server error** | 500 | Destructive toast, form re-enables. |
| **Offline** | Network unreachable | Top-of-form banner "You're offline — submit disabled." Submit disabled. |
| **RTL** | Locale = ar | Full mirror per §Layout. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap. Red submit stays red (`--lc-status-unpublished-fg` in dark). Amber banner shifts per token dark values. |

---

## Accessibility

- H1 is the accessible name of the page; screen readers hit it first.
- Impact banner is a `<section role="region" aria-labelledby="impact-heading">` — read together as one block, not scattered.
- Rationale character counter is `aria-live="polite"` — announces "480 characters used, 20 remaining" every 50 chars typed (throttled).
- 3-factor challenge is an `<ol>` with `<li>` per step. Current step has `aria-current="step"`. Complete steps have `aria-label="Step {n} of 3 complete"`. Disabled steps have `aria-disabled="true"`.
- OTP input: each of the 6 boxes has `aria-label="Digit {n} of 6"` and `inputmode="numeric"` + `autocomplete="one-time-code"` so mobile OS autofills from SMS/email correctly.
- Typed-name pill has a `Copy` icon but the tooltip on hover/focus says "Type it, don't paste — this is a liveness check." Server also rejects a value that arrives with `content-clipboard-hint` header (backend defense; client-side is UX only).
- Confirm dialogs (Transfer, Cancel) use `AlertDialog` (focus trap, Escape closes, focus returns to invoker).
- Submit button in disabled state has `aria-disabled="true"` and `aria-describedby` pointing to a hidden helper listing what's still missing ("Target admin, rationale (20+ chars), password verification, email code, agency-name confirmation, consent").
- Live-region announcement on state transitions ("Password verified", "Email code sent", "Agency name confirmed", "Transfer request sent").
- Motion: `prefers-reduced-motion` skips card cross-fades and OTP box auto-advance animation.
- Every tap target ≥ 44×44 CSS px. OTP boxes are 44×44 min. Ghost cancel link has padding-Y to meet floor.
- Focus rings visible on every interactive element — two-tone Broadcast focus ring, do not override.
- No color-only status differentiation — every state uses glyph + label + surface tint together (step-complete shows green checkmark + "Verified" text + green ring).

---

## Anti-patterns (do not do these)

- ❌ Do NOT allow self-transfer (`target_user_id === owner.user_id`). Client hides self from picker AND server rejects with 400 `SELF_TRANSFER_FORBIDDEN`.
- ❌ Do NOT allow transferring to a non-admin. Picker only surfaces admins; server rejects with 400 `TARGET_NOT_ADMIN` if a stale-cache client submits a non-admin ID.
- ❌ Do NOT expose "Delete agency" as an alternative on this screen. That's WF-32 (`AGN-SET-006`, deferred). Owner cannot cancel/delete the agency from the ownership-transfer flow.
- ❌ Do NOT pre-select a target admin (e.g. "most recently active"). Owner must pick deliberately.
- ❌ Do NOT hide the reversal-window notice. It's the single most important reassurance on the screen.
- ❌ Do NOT skip step 3 for "trusted networks" or IP-verified admins. All three factors run every time.
- ❌ Do NOT use `variant="destructive"` red for the Cancel button. Cancel is ghost `--lc-text-muted`. Only the Submit button is red.
- ❌ Do NOT use confetti, "🎉", "Congrats, you're passing the torch!" copy. Sober tone per SHR-SET-005 pattern.
- ❌ Do NOT auto-advance to the next screen on success — success toast + re-render to PENDING view lets the owner see the state change on the same URL. Do not yank them.
- ❌ Do NOT fabricate "typical response time" numbers for the target admin. The PENDING view shows real elapsed time + real expiry, nothing invented.
- ❌ Do NOT allow rationale to be empty. Minimum 20 characters is enforced client + server. The rationale is the record for future PA dispute-resolution.
- ❌ Do NOT store the step-up token, OTP code, or typed name in localStorage. Component state only. All three are single-use, server-invalidated on submit.
- ❌ Do NOT show the raw `stepUpToken` value anywhere in the UI. It's an opaque credential.
- ❌ Do NOT allow submit when the agency has past-due invoices OR is in a suspension state. Server rejects with 409 `AGENCY_NOT_TRANSFERABLE`; client shows a block card similar to SHR-SET-005's block-agency-owner pattern with links to invoices / support.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Stripe transfer-account-ownership flow** — sober 3-factor challenge, clear impact list, sequential steps.
- **GitHub transfer-repository-ownership** — the "type the exact name" liveness pattern.
- **AWS account-owner-change** — the reversal-window disclosure treatment.
- **Notion transfer-workspace-ownership** — the recipient-must-accept model with a pending state on the initiator side.
- **SHR-SET-005 (WingCaster delete-account)** — the 3-factor + sober-tone + block-state patterns.

Do NOT match:
- Google Workspace admin-transfer (too enterprise-heavy; hides consequences behind expanders).
- Slack workspace-owner-transfer (single-tap after typed confirmation; too lenient for our persona's stakes).

---

## Backend contract

**New endpoints (all NEW; backend team must build for Week 7):**

### `GET /api/agencies/:id/ownership-transfer/state`
Returns current transfer state for the caller's agency. Scoped strictly to caller = owner.

Response 200:
```json
{
  "transfer": null | {
    "id": "ot_01H9...",
    "status": "pending_recipient_accept" | "recipient_accepted" | "target_declined" | "cancelled_by_initiator" | "expired",
    "target": {
      "user_id": "usr_ahmad",
      "display_name": "Ahmad Khoury",
      "role": "admin",
      "avatar_url": "..."
    },
    "rationale": "...",
    "decline_reason": null | "...",
    "initiated_at": "2026-09-08T09:14:22Z",
    "expires_at": "2026-09-22T09:14:22Z",
    "resolved_at": null | "...",
    "acknowledged_by_initiator": false
  },
  "eligibility": {
    "caller_is_owner": true,
    "agency_transferable": true,
    "block_reason": null | "past_due_invoices" | "agency_suspended" | "no_eligible_admins"
  }
}
```
On 403: caller is not the owner.

### `POST /api/agencies/:id/ownership-transfer/otp/send`
Sends a 6-digit OTP to the owner's account email via Microsoft Graph. Rate-limited: 60s between sends, max 5 per hour per owner.

Response 200: `{ "sent_to": "s•••@elite.ae", "expires_in_seconds": 600 }`
Response 429: rate-limited.

### `POST /api/agencies/:id/ownership-transfer/initiate`
Creates the transfer request. Requires all 3 factors.

Request body:
```json
{
  "target_user_id": "usr_ahmad",
  "rationale": "...",
  "step_up_token": "elev_...",
  "otp_code": "482913",
  "typed_agency_name": "Elite Real Estate"
}
```

Server validates:
- caller.role === 'owner' AND caller.user_id === agency_tenant.owner_user_id
- target.role IN ('admin', 'senior_admin') AND target.status = 'active' AND target.user_id != caller.user_id
- step_up_token is valid + unexpired + issued to this user
- otp_code matches current unexpired OTP for this user + purpose='ownership_transfer_initiate'
- typed_agency_name (trimmed, case-insensitive) === agency.display_name (trimmed, case-insensitive) AT SUBMIT TIME
- agency has no past-due invoices, is not suspended
- no other pending transfer for this agency

Response 201:
```json
{
  "transfer": { ...same shape as GET state... },
  "notifications_dispatched": ["push_to_target", "email_to_target"]
}
```

Response 401 with specific `error` codes: `INVALID_STEP_UP` | `INVALID_OTP` | `EXPIRED_OTP` | `INVALID_TYPED_NAME`
Response 400: `SELF_TRANSFER_FORBIDDEN` | `TARGET_NOT_ADMIN` | `RATIONALE_TOO_SHORT`
Response 409: `TARGET_NOT_ELIGIBLE` | `TRANSFER_ALREADY_PENDING` | `AGENCY_NOT_TRANSFERABLE`

### `POST /api/agencies/:id/ownership-transfer/:transferId/cancel`
Owner cancels a pending transfer. Requires caller = original initiator + status = pending_recipient_accept.

Response 200: transfer state now `cancelled_by_initiator`; notification dispatched to target.

### `POST /api/agencies/:id/ownership-transfer/:transferId/acknowledge`
Owner acknowledges a decline / expiry so the screen returns to initial form on next load.

Response 200.

### Migration
New table `ownership_transfer_requests`:
```sql
CREATE TABLE ownership_transfer_requests (
  id TEXT PRIMARY KEY,
  agency_tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  initiator_user_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id),
  rationale TEXT NOT NULL CHECK (char_length(rationale) >= 20),
  status TEXT NOT NULL CHECK (status IN (
    'pending_recipient_accept',
    'recipient_accepted',
    'target_declined',
    'cancelled_by_initiator',
    'expired'
  )),
  decline_reason TEXT,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  resolved_at TIMESTAMPTZ,
  acknowledged_by_initiator BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by_new_owner BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (agency_tenant_id) WHERE status = 'pending_recipient_accept'  -- one pending per agency
);
```

Also extends `tenant_memberships` write-logic wrapper to enforce the 30-day reversal window:
- On `recipient_accepted` transition: set `agency_tenant.owner_user_id = target_user_id`, flip initiator role to `admin`, flip target role to `owner`. Record `reversal_deadline = NOW() + INTERVAL '30 days'` in transfer row.
- Within reversal window: former owner can call `POST /api/agencies/:id/ownership-transfer/:transferId/reverse` (separate endpoint, requires new 3-factor challenge). Post-deadline: reversal endpoint 410 Gone with "Contact PA support".

### Cron: request expiry
Runs every 6h. Flips `pending_recipient_accept` requests past `expires_at` to `expired`, emits `ownership_transfer.expired` notification to both initiator and target.

### Notification templates (piggyback on existing dispatcher)
- `ownership_transfer.initiated` (to target) — "You've been offered ownership of {Agency Name}" → deep-links to AGN-SET-005b.
- `ownership_transfer.accepted` (to former owner) — "Ahmad accepted ownership of Elite" → deep-links to AGT-REC-006.
- `ownership_transfer.declined` (to former owner) — "Ahmad declined ownership" → deep-links to this screen's TARGET-REFUSED variant.
- `ownership_transfer.cancelled_by_initiator` (to target) — "Sara cancelled the ownership transfer request".
- `ownership_transfer.expired` (to both) — "The ownership transfer to Ahmad expired without a response".

**Backend blocker filed as `[BE-BLOCKER-WF31-01]`** — all four endpoints + migration + cron + notification templates. Week 7 dependency.

**Answer to caller's question:** `POST /api/agencies/:id/ownership-transfer/initiate` + `/accept` + `/decline` **do NOT exist yet** — all three (plus `/state`, `/otp/send`, `/cancel`, `/acknowledge`, `/reverse`) must be built as part of the WF-31 cluster. Backend has NO ownership-transfer routes today (verified against `backend/src/server.js` — only two `role === 'owner'` guards that reject role changes with an error "Ownership requires the ownership transfer workflow"). The 3-factor rule **shares SHR-SET-005's step-up + OTP infrastructure** but is a **WF-31-specific variant** with different factors (password step-up + email OTP + typed agency-name vs SHR-SET-005's random word + email link + TOTP). The SHR-MFA-007 step-up service is reused as-is; the OTP endpoint is a new purpose-tag on the existing OTP infrastructure (`purpose='ownership_transfer_initiate'`); the typed-agency-name check is new and lives inside the initiate endpoint's validation layer. No shared React component with SHR-SET-005 — the challenge composition here is `<OwnershipTransferChallenge>`, a distinct primitive.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/AgencyOwnershipTransferInitiatorPage.tsx`.
- **Route:** add to `web/src/App.tsx` — `<Route path="/agency/settings/ownership-transfer" element={<AgencyOwnershipTransferInitiatorPage />} />`.
- **Component decomposition:**
  - `web/src/components/agency/OwnershipTransferInitiator/InitiatorForm.tsx` — initial form composition.
  - `web/src/components/agency/OwnershipTransferInitiator/ImpactBanner.tsx` — amber-bordered impact banner.
  - `web/src/components/agency/OwnershipTransferInitiator/ReversalWindowNotice.tsx` — 30-day reversal card.
  - `web/src/components/agency/OwnershipTransferInitiator/TargetPicker.tsx` — Select + eligible-admin fetch.
  - `web/src/components/agency/OwnershipTransferChallenge.tsx` — the 3-factor challenge (ANCHOR — lifted verbatim by AGN-SET-005b).
  - `web/src/components/agency/OwnershipTransferInitiator/PendingStatusView.tsx` — post-submit "waiting on target" state.
  - `web/src/components/agency/OwnershipTransferInitiator/TargetRefusedView.tsx` — declined state.
- **Data hooks:**
  - `web/src/hooks/useOwnershipTransferState.ts` — GET state + polls every 60s + revalidates on focus.
  - `web/src/hooks/useOwnershipTransferOtp.ts` — send OTP + resend cool-down + rate-limit handling.
- **Test discipline:**
  - Unit: each of the 6 sub-components renders + state transitions. `<OwnershipTransferChallenge>` unit tests cover all 3 step advance/fail/reset paths + step-up TTL expiry.
  - Integration: full happy-path (target select → rationale → all 3 steps → submit → PENDING view). Full failure paths (each of the 401/400/409 codes).
  - Cross-flow: PENDING view + push notification arrives with `ownership_transfer.declined` → cross-fades to TARGET-REFUSED.
  - Real-Postgres: full end-to-end (initiator submits → recipient accepts on 005b → both users hit AGT-REC-006 with correct former/new-owner state).
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green. New `--lc-status-unpublished-fg` primary button uses a shared `<Button variant="danger">` class; add to `web/src/components/ui/button.tsx` if not present.
- **Anchor guard:** an assertion test that verifies `<OwnershipTransferChallenge>` is imported by BOTH `OwnershipTransferInitiator/InitiatorForm.tsx` AND `OwnershipTransferRecipientAcceptPage.tsx` (AGN-SET-005b) — enforces the anchor discipline for the WF-31 cluster.
- **RTL:** verified via `screens.rtl.test.tsx` extension with an ownership-transfer scenario.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction. Non-negotiable.

- Impact banner: `--lc-surface-raised` + `border-left: 4px solid var(--lc-status-underOffer-fg)`. Never use `--lc-status-danger` as banner background.
- Reversal-window notice: `--lc-surface-sunken` card. Icon `--lc-text-brand`.
- 3-factor challenge container: `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)`. Step cards inside `--lc-surface-sunken` + `var(--lc-radius-md)`.
- Step complete state: green checkmark + `--lc-accent-bold` ring (with `--lc-accent-bold-edge` outline — accent bold ALWAYS needs a boundary).
- OTP boxes: 44×44, `var(--lc-radius-md)`, `--lc-border-strong` border, `var(--lc-type-data)` mono content.
- Typed-name pill: `--lc-surface-inverse` background with `--lc-text-inverse` mono text. Copy icon `--lc-text-inverse`.
- Submit button (Transfer ownership): `--lc-status-unpublished-fg` fill, `--lc-text-inverse` ink, `var(--lc-radius-md)`. Hover DARKER. Never lighter.
- Cancel ghost: `--lc-text-muted` label. No fill.
- Focus rings two-tone via base CSS. Do not override.
- Motion: challenge-step cross-fades `var(--lc-duration-base)`; submit spinner `var(--lc-duration-fast)`; NO emphasis easing; skip cross-fades under `prefers-reduced-motion`.
- Radii: cards `var(--lc-radius-lg)`; step cards + inputs `var(--lc-radius-md)`; step-number badge `var(--lc-radius-pill)`.
- Sticky mobile action bar `--lc-surface-raised` + top-border `--lc-border` + upward `--lc-elevation-md`. Safe-area padding.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster "Ownership transfer initiator" screen (AGN-SET-005) — MENA real-estate B2B SaaS agency settings. Agency owner passes ownership to another admin within the same agency. HIGH-RISK governance action, sober tone, 3-factor challenge (password step-up + email OTP + typed agency-name confirmation). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen is the ANCHOR for the WF-31 ownership-transfer cluster — the 3-factor challenge composition here (<OwnershipTransferChallenge>) will be lifted verbatim by AGN-SET-005b (recipient accept side). Design it as a reusable primitive.

First pass: render the DESKTOP 1440px layout in the PARTIAL state. Target "Ahmad Khoury (Admin · 2y 4mo)" selected. Rationale filled (~300 chars). Step 1 (password) complete with green check + "Verified just now". Step 2 (email code) IN PROGRESS with 6-box OTP input empty and resend cool-down "Resend in 47s". Step 3 (typed agency name) DISABLED. Consent checkbox unticked. Submit button disabled, styled red.

LTR English only for this pass — I'll ask for RTL Arabic, other states, mobile, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Sober tone: no confetti, no "🎉", no "congrats you're passing the torch".

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. Desktop 1440px, ALL-VERIFIED state — all 3 steps complete, consent ticked, submit enabled with red hover state.
2. Desktop 1440px, INITIAL state — no target selected, all steps pending, submit disabled.
3. Desktop 1440px, PENDING-RECIPIENT-ACCEPT state — form replaced with status card, mini timeline, Cancel-request ghost.
4. Desktop 1440px, TARGET-REFUSED state — form replaced with decline explanation + "Start a new transfer" primary.
5. Mobile 375px, INITIAL state (with advisory banner at top).
6. RTL Arabic mirror at desktop 1440px, PARTIAL state.
7. Dark mode desktop, PARTIAL state.
8. Cancel-request confirm dialog open over PENDING-RECIPIENT-ACCEPT.

Save each output's JSX to `web/src/components/agency/OwnershipTransferInitiator/` + screenshot to `docs/design/mockups/AGN-SET-005-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 8 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-7 dispatch prompt references this brief + AGN-SET-005b + AGT-REC-006 briefs + the mockup paths + the `<OwnershipTransferChallenge>` anchor component.
- [ ] `[BE-BLOCKER-WF31-01]` filed in kickoff §5a — ownership-transfer routes + migration + cron + notification templates.
- [ ] AGN-SET-005b brief references this brief's §Reusable challenge composition section by name and only spells out per-screen deltas.
- [ ] AGT-REC-006 brief references AGT-REC-004's REC-family primitives + this brief's initiator-side state model.
