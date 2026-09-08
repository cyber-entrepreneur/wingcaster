# Screen Brief — AGN-SET-005b · Accept ownership transfer (recipient side) — DELTA from AGN-SET-005 anchor

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENCY.md` §AGN-SET-005b entry. Week 7 delta per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 32 + §6 Week 7. Recipient-side of the WF-31 (Ownership transfer) 3-screen cluster: AGN-SET-005 (initiator) → **AGN-SET-005b (this brief, recipient accept)** → AGT-REC-006 (agent outcome).

**DELTA NOTICE.** This brief inherits from `AGN-SET-005-ownership-transfer-initiator-brief.md`. **Every reference to Broadcast alignment, the reusable `<OwnershipTransferChallenge>` 3-factor composition, the reversal-window language, and the sober-tone principles is lifted verbatim from AGN-SET-005 and NOT restated here** — reader must have that brief open. This file only spells out per-screen deltas: recipient-perspective copy, implications block, Accept/Decline dual-CTA pattern, decline-with-required-reason flow, and the invalid/expired token states.

---

## 🎨 Broadcast alignment

**Inherits from `AGN-SET-005` §Broadcast alignment verbatim.** No overrides. The 3-factor challenge steps, impact-banner treatment, reversal-window notice, red primary-submit-button styling all apply here identically.

**Recipient-specific Broadcast deltas:**
- **Initiator identity card** (new element for recipient side) — mirrors AGT-REC-004's `<StatusHero>`+agency-card pattern but scoped to the initiator (a person, not the agency). Card `--lc-surface-raised` + `--lc-elevation-sm`. Avatar 48×48 `var(--lc-radius-md)`. Name `var(--lc-type-heading-3)`. Sub `Owner of {Agency Name} · Sent {relative}`. Rationale rendered below as a `<blockquote>` styled with `border-left: 3px solid var(--lc-border-strong)` + `--lc-text-secondary` italic body.
- **Dual-CTA pattern** — recipient sees Accept (red primary — same treatment as AGN-SET-005 submit) AND Decline (`Button variant="outline"` — NOT ghost like the initiator's Cancel; recipient's Decline is a first-class decision that emits a notification back to the initiator).
- **Decline dialog** — `AlertDialog` with a required `<Textarea>` for `decline_reason` (min 20 chars, max 500). Submit disabled until threshold. Confirm button label "Decline transfer" — outline styled, NOT red.

---

## Meta

| | |
|---|---|
| Screen ID | AGN-SET-005b |
| Screen name | Accept ownership transfer (agency-side recipient) |
| Persona | Target admin (agency member selected by AGN-SET-005 initiator) — role IN ('admin', 'senior_admin') at time of transfer creation |
| Device targets | Desktop 1440px (primary), tablet 768px, mobile 375px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/agency/ownership-transfer/incoming/:transferId` — canonical route. Email deep-link: signed link resolves here. Push notification deep-link: `wingcaster://ownership-transfer/incoming/:transferId` → maps to route. |
| Current state | MISSING — must ship with WF-31 cluster (Week 7). |
| Workflow role | WF-31 role=Recipient. Consumes `ownership_transfer_request` created by AGN-SET-005; emits accept (flips ownership) or decline (returns to initiator's TARGET-REFUSED view). |
| Backend prerequisites | Same as AGN-SET-005 §Backend contract, plus **NEW** `POST /api/agencies/:id/ownership-transfer/:transferId/accept` and `POST /api/agencies/:id/ownership-transfer/:transferId/decline`. |

---

## Purpose

The target admin opens `/agency/ownership-transfer/incoming/:transferId` (usually landing from a push notification or email deep-link) to review a pending ownership transfer and either accept or decline it. Accepting flips ownership atomically server-side: initiator role becomes `admin`, target role becomes `owner`, agency `owner_user_id` updates, notifications dispatch to both users, and both surface on AGT-REC-006 in their respective side-states.

**Emotional stakes:** high — receiving ownership of an agency carries as much weight as giving it up. Copy must respect this: no "Congratulations!" framing, no confetti; treat it like a signed agreement being handed over.

Success outcomes:
- **Accept** → server flips ownership (see §Backend contract accept endpoint). New owner lands on AGT-REC-006 (accepted state) with a one-time celebratory-but-restrained banner. Former owner lands on their AGT-REC-006 (accepted state, former-owner variant) via push notification.
- **Decline** → transfer status flips to `target_declined` with the required reason. Initiator's AGN-SET-005 route re-renders to TARGET-REFUSED. Target lands on `AGT-DSH-001` (their agent dashboard) with a toast "Transfer declined".

---

## Design goals

1. **Recipient understands what they are accepting BEFORE they accept.** Implications block (see §Implications block content) is directly above the Accept CTA — cannot miss it.
2. **Decline is a first-class action, not a hidden escape.** Same visual weight as Accept (outline vs red-primary — same button size), same tap-target minimum, same 3-factor challenge waived (Decline doesn't need the challenge — see anti-patterns).
3. **The initiator's rationale is quoted verbatim.** Recipient sees exactly what the initiator wrote, no summarization, no paraphrase.
4. **Same 3-factor challenge as initiator.** Recipient must complete password step-up + email OTP (sent to recipient's account email) + typed agency-name before Accept enables. Decline does NOT require the challenge — declining is not a governance-level commitment.
5. **Invalid / expired states are unambiguous.** If the transfer was cancelled, expired, or already resolved, the recipient sees a clear terminal state, not a broken form.
6. **Anchor discipline.** The 3-factor challenge composition, reversal-window language, and impact-list phrasing are lifted from AGN-SET-005 verbatim. Any change to those patterns lands in the AGN-SET-005 brief first.

---

## Layout

### Desktop 1440px (primary)

Single-column centered layout, max-width `720px`, same shell as AGN-SET-005:

1. **Breadcrumb + back** — `Inbox › Ownership transfer` breadcrumb. Back arrow to `/inbox`.
2. **H1** — "{Initiator} wants to transfer ownership of {Agency Name} to you" (`var(--lc-type-display)`).
3. **Sub** — "Review the details below. If you accept, you'll become the owner as soon as your identity is verified." (`var(--lc-type-body-lg)`).
4. **Initiator identity card** — avatar + initiator display name + `Owner of {Agency Name} · Sent {relative}` + rationale blockquote.
5. **Implications block** — mirrors AGN-SET-005 impact banner but from the recipient's perspective (see §Implications block content). Amber-bordered card.
6. **Reversal-window notice** — same `--lc-surface-sunken` card as AGN-SET-005. Copy is recipient-framed: "You'll have 30 days after accepting to reverse the transfer if you change your mind. After 30 days, this cannot be undone from within the app."
7. **Section: Confirm identity (3 factors)** — same `<OwnershipTransferChallenge>` composition as AGN-SET-005. Steps 1/2/3 identical semantics; step 2's email OTP goes to the RECIPIENT's account email (not the initiator's). Step 3's typed name is the agency name (same target as initiator).
8. **Consent checkbox** — "I understand I will become the owner of {Agency Name} with full billing, contract, and legal responsibility."
9. **Actions row** — right-aligned on desktop:
   - `Decline transfer` (outline) on the left.
   - `Accept and become owner` (red primary — same style as AGN-SET-005 submit) on the right. Disabled until 3 factors + consent complete.
10. **Contact-support link** — footer, same as AGN-SET-005.

### Mobile 375px

Same content, single column, stacked. Same advisory banner as AGN-SET-005 ("Ownership transfer is a governance action. Consider completing this from a desktop.").

Sticky bottom action bar: `Accept and become owner` (full-width red) + `Decline transfer` (outline, above accept).

### RTL

Full mirror. Rationale blockquote flips border to right side. Initiator display name stays LTR-embedded if Latin script.

---

## Implications block content

Amber-bordered card, heading "When you accept:", identical bullet structure to AGN-SET-005 but recipient-framed:

- **You** take on billing address & payment method attribution. All future invoices route to your email + payment record.
- **You** become the signer on all agency vendor contracts (portal accounts, brand assets).
- **You** hold PA escalation privileges — only you can escalate to WingCaster Platform Administrators.
- **You** are the legal-representative designation for compliance filings (GDPR, KSA PDPL, UAE DP Law).
- **{Initiator}'s role** flips from Owner to Admin. They keep every admin capability but cannot re-transfer ownership back without you initiating a new transfer.

"What doesn't change" section (same three bullets as AGN-SET-005 but from recipient perspective):
- All existing listings and contacts remain with their current owners.
- Every member's capability pack and permissions stay the same.
- The agency name, branding, and public profile are unchanged.

---

## Reusable challenge composition

**Uses `<OwnershipTransferChallenge>` verbatim from AGN-SET-005 §Reusable challenge composition.** No deltas to the component's contract. The only difference is the wiring:
- Step 2's OTP is sent to the RECIPIENT's account email (server-side determines this from the authenticated caller, not from the transfer row).
- Step 3's `agencyName` prop is the agency's current `display_name` at load time (server re-validates at submit).
- On success, `onAllComplete` fires `POST /api/agencies/:id/ownership-transfer/:transferId/accept` with the 3 proofs.

---

## Explicit copy (English)

Only slots that differ from AGN-SET-005 are listed. All Broadcast tokens, all step-1/2/3 labels, all error strings, all resend/expire strings are inherited verbatim.

| Slot | Copy |
|---|---|
| Breadcrumb | Inbox › Ownership transfer |
| H1 | {Initiator} wants to transfer ownership of {Agency Name} to you |
| Sub | Review the details below. If you accept, you'll become the owner as soon as your identity is verified. |
| Initiator identity subheader | Owner of {Agency Name} · Sent {relative} |
| Rationale blockquote header | Why {Initiator} wants to transfer: |
| Implications heading | When you accept: |
| Implications bullet — billing | **You** take on billing address & payment method attribution. All future invoices route to your email + payment record. |
| Implications bullet — contract signer | **You** become the signer on all agency vendor contracts. |
| Implications bullet — PA escalation | **You** hold PA escalation privileges. |
| Implications bullet — legal | **You** are the legal-representative designation for compliance filings. |
| Implications bullet — initiator role | **{Initiator}'s role** flips from Owner to Admin. They keep every admin capability but cannot re-transfer ownership back without you initiating a new transfer. |
| Reversal notice (recipient-framed) | You'll have **30 days** after accepting to reverse the transfer if you change your mind. After 30 days, this cannot be undone from within the app — you'd need WingCaster support to intervene. |
| Consent checkbox | I understand I will become the owner of {Agency Name} with full billing, contract, and legal responsibility. |
| Accept CTA | Accept and become owner |
| Accept CTA (submitting) | Verifying and accepting… |
| Decline CTA | Decline transfer |
| Decline dialog title | Decline this ownership transfer? |
| Decline dialog body | {Initiator} will be notified with the reason you provide. They'll stay as owner and can start a new transfer to a different admin. |
| Decline dialog reason label | Reason (required — visible to {Initiator}) |
| Decline dialog reason placeholder | e.g. I'm not ready to take on billing responsibility right now. Consider transferring to someone else on the team. |
| Decline dialog confirm | Decline transfer |
| Decline dialog cancel | Keep reviewing |
| Success toast — accept | You're now the owner of {Agency Name}. Redirecting… |
| Success toast — decline | Transfer declined. {Initiator} has been notified. |
| Invalid token state | This transfer link is no longer valid. |
| Invalid token — sub | It may have been cancelled, expired, or already resolved. Check your inbox for the latest status. |
| Cancelled-by-initiator state | {Initiator} cancelled this transfer request on {date}. |
| Expired state | This transfer request expired on {date} without a response. |
| Already-accepted state | You already accepted this transfer on {date}. You're the owner of {Agency Name}. |
| Already-declined state | You already declined this transfer on {date}. |
| Not-target-403 state | This transfer request wasn't sent to you. |
| Contact support link | Something not right? Contact WingCaster support |

---

## Sample content (for v0 / mockup)

Same shape as AGN-SET-005 sample content but from Ahmad Khoury's perspective:

- **Agency name:** "Elite Real Estate"
- **Initiator:** Sara Al Mansoori (avatar with initials `SA`)
- **Recipient (you):** Ahmad Khoury (`ahmad@elite.ae` → masked `a•••@elite.ae`)
- **Rationale (quoted from initiator):** "Stepping back from day-to-day ops. Ahmad has been running the operations side for the past year, signed our last three portal renewals with me, and is the right person to represent Elite going forward."
- **Sent:** 2 hours ago (07 Sep 2026, 12:20)
- **Expires:** 22 Sep 2026, 12:20 (14-day request TTL)
- **Step 1:** complete
- **Step 2:** complete
- **Step 3:** `Elite Real Estate` — complete
- **Consent:** ticked
- **Accept button:** enabled, red, hover state
- **Decline button:** outline, enabled always (regardless of challenge state)

Iteration order for v0 after first pass (all deltas from AGN-SET-005 iterations):
1. Desktop 1440px, ALL-VERIFIED state (as above).
2. Desktop 1440px, INITIAL state — all steps pending, Accept disabled, Decline enabled.
3. Desktop 1440px, INVALID-TOKEN state — form replaced with fallback card.
4. Desktop 1440px, CANCELLED-BY-INITIATOR state.
5. Mobile 375px, ALL-VERIFIED state.
6. RTL Arabic mirror at desktop 1440px, INITIAL state.
7. Decline confirm dialog open (reason textarea empty, confirm disabled).
8. Decline confirm dialog with reason filled and enabled.

Save each output's JSX to `web/src/components/agency/OwnershipTransferAccept/` + screenshot to `docs/design/mockups/AGN-SET-005b-<state>.png`.

---

## Component palette

Same as AGN-SET-005 plus:

| Element | Primitive |
|---|---|
| Initiator identity card | `Card` + `Avatar` + custom composition |
| Rationale blockquote | `<blockquote>` with custom border styling |
| Decline dialog | `AlertDialog` with `Textarea` inside |
| Decline reason character counter | `<Numeric>` |

---

## Interactions

**On page load:**
- Fetch `GET /api/users/me/ownership-transfers/incoming/:transferId` (recipient-scoped endpoint; see §Backend contract).
- Response drives state variant (initial, cancelled, expired, already-resolved, invalid-token, wrong-recipient).

**On Accept click (only enabled after 3-factor + consent):**
- Open confirm dialog "Accept ownership of {Agency Name}?" body "You'll become the owner immediately. {Initiator} will be notified. You have 30 days to reverse this." Confirm / Cancel.
- On confirm: POST `/api/agencies/:id/ownership-transfer/:transferId/accept` with 3 proofs (same body shape as AGN-SET-005 initiate).
- On 201 success: server flips ownership atomically, reissues JWT with updated role='owner'. Client shows success toast, navigates to `AGT-REC-006` (accepted state, new-owner variant).
- On 401 (challenge invalid): same reset-step behavior as AGN-SET-005.
- On 409 `TRANSFER_ALREADY_RESOLVED`: re-render appropriate terminal state.

**On Decline click (always enabled):**
- Open Decline dialog. Reason `<Textarea>` starts empty. Confirm disabled until reason ≥ 20 chars.
- On confirm: POST `/api/agencies/:id/ownership-transfer/:transferId/decline` with `{ reason: "..." }`. NO challenge required.
- On 200 success: toast "Transfer declined. {Initiator} has been notified." Navigate to `AGT-DSH-001`.
- On 409 `TRANSFER_ALREADY_RESOLVED`: re-render terminal state.

**On step-up expiry / OTP expiry / typed-name mismatch:**
- Same behavior as AGN-SET-005 — reset the failing step, show helper.

**Live update (push arrived while page open):**
- If initiator cancels the transfer while recipient has the page open, cross-fade to CANCELLED-BY-INITIATOR terminal state at `--lc-duration-base`.

---

## State variants

Only variants that differ from AGN-SET-005 or are recipient-specific:

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Initial fetch in flight | Skeleton mirror. |
| **Wrong-recipient (403)** | Caller is not the transfer's target_user_id | Full-screen "This transfer request wasn't sent to you." + Back to inbox. Return 404 not 403 to avoid existence leak (per PA-ACR-001 pattern). |
| **Initial** | Transfer status = pending_recipient_accept | Full form. Accept disabled until challenge complete. Decline always enabled. |
| **All-verified** | 3 factors + consent | Accept enabled, red. |
| **Submitting-accept** | POST in flight | Accept spinner + "Verifying and accepting…". Both buttons disabled. |
| **Submitting-decline** | Decline POST in flight | Decline dialog confirm spinner. |
| **Cancelled-by-initiator** | Status = cancelled_by_initiator | Terminal card: "{Initiator} cancelled this transfer request on {date}." Primary "Back to inbox". |
| **Expired** | Status = expired (14-day TTL) | Terminal card: "This transfer request expired on {date} without a response." Primary "Back to inbox". |
| **Already-accepted** | Status = recipient_accepted AND caller is target | Terminal card: "You already accepted this transfer on {date}. You're the owner of {Agency Name}." Primary "Go to agency dashboard". |
| **Already-declined** | Status = target_declined AND caller is target | Terminal card: "You already declined this transfer on {date}." Primary "Back to inbox". |
| **Invalid token** | 404 on GET (bad transferId, or expired signed link from email) | Terminal card: "This transfer link is no longer valid." + "Check your inbox for the latest status." Primary "Back to inbox". |
| **RTL** | Locale = ar | Full mirror. |
| **Dark mode** | prefers-color-scheme dark | Same token swap behavior as AGN-SET-005. |

All other variants (step-1 expired, OTP resend rate-limited, OTP invalid at submit, typed-name mismatch, server error, offline) inherit AGN-SET-005's behavior.

---

## Accessibility

Same as AGN-SET-005 plus:
- Rationale blockquote is `<blockquote cite="{initiator_display_name}">` with an `aria-label="Rationale from {initiator}"`.
- Accept and Decline buttons are equally tabbable; do NOT reorder tab index to favor Accept.
- Decline dialog focus lands on the reason textarea (not the confirm button — user hasn't typed a reason yet).
- Terminal-state cards have `role="status"` so screen readers announce them on load.
- 3-factor challenge live-region announcements are recipient-framed ("Password verified", "Email code sent to a•••@elite.ae").

---

## Anti-patterns (do not do these)

All AGN-SET-005 anti-patterns apply, plus:

- ❌ Do NOT require the 3-factor challenge for Decline. Declining is not a governance-level commitment — it's opting out. A reason is required, but not identity verification.
- ❌ Do NOT auto-accept on load, even if URL params say "auto=1". Deep-linked emails / notifications land on this screen and require the recipient's explicit action.
- ❌ Do NOT let the recipient bulk-accept multiple pending transfers. One transfer per screen.
- ❌ Do NOT show the initiator's masked email. Show their display name + role. Email is not needed for recipient's decision.
- ❌ Do NOT hide the Decline button behind an "advanced actions" expander. First-class action, first-class placement.
- ❌ Do NOT pre-fill the decline reason. Recipient must write it.
- ❌ Do NOT allow decline reason to be < 20 chars. This message goes back to the initiator; a shrug isn't respectful.
- ❌ Do NOT show terminal-state cards with color-only differentiation (cancelled vs expired vs already-resolved). Each uses a distinct glyph + label + surface tint.
- ❌ Do NOT rewrite the initiator's rationale for grammar or tone. Render verbatim (as-is, with newlines preserved and links inert).
- ❌ Do NOT show "Congratulations!" or "Welcome to leadership!" copy on this screen or the AGT-REC-006 accepted state. Sober tone throughout.

---

## Reference designs

Same as AGN-SET-005 plus:
- **GitHub accept-repository-transfer** — the recipient-side counterpart pattern.
- **Google Workspace accept-admin-transfer** — the required-reason-on-decline treatment.

---

## Backend contract (deltas from AGN-SET-005)

**New endpoints:**

### `GET /api/users/me/ownership-transfers/incoming/:transferId`
Recipient-scoped fetch. Server validates caller.user_id === transfer.target_user_id; returns 404 (not 403) if mismatched (existence-leak defense).

Response 200:
```json
{
  "transfer": {
    "id": "ot_01H9...",
    "status": "pending_recipient_accept" | ...,
    "initiator": {
      "user_id": "usr_sara",
      "display_name": "Sara Al Mansoori",
      "role_label": "Owner",
      "avatar_url": "..."
    },
    "agency": {
      "tenant_id": "ten_01H8...",
      "display_name": "Elite Real Estate",
      "logo_url": "..."
    },
    "rationale": "Stepping back from day-to-day ops...",
    "initiated_at": "...",
    "expires_at": "...",
    "resolved_at": null | "..."
  },
  "recipient_email_masked": "a•••@elite.ae"
}
```

### `POST /api/agencies/:id/ownership-transfer/:transferId/accept`
Request body: same 3-factor shape as AGN-SET-005 initiate.

Server validates:
- caller.user_id === transfer.target_user_id
- transfer.status === 'pending_recipient_accept'
- transfer not expired
- 3 factors valid (step-up token, OTP for CALLER, typed agency name)
- agency still transferable (no past-due invoices, not suspended)

On success (atomic transaction):
- Update `agency_tenant.owner_user_id = caller.user_id`
- Update `tenant_memberships`: initiator.role = 'admin', caller.role = 'owner'
- Update `ownership_transfer_requests.status = 'recipient_accepted'`, `resolved_at = NOW()`, `reversal_deadline = NOW() + INTERVAL '30 days'`
- Reissue caller's JWT with updated tenant role
- Dispatch notifications: `ownership_transfer.accepted` to initiator (→ AGT-REC-006 former-owner) + `ownership_transfer.you_are_now_owner` to caller (→ AGT-REC-006 new-owner)

Response 201: same shape as GET; JWT set in response header.

Response 401 with error codes: `INVALID_STEP_UP` | `INVALID_OTP` | `EXPIRED_OTP` | `INVALID_TYPED_NAME`
Response 409: `TRANSFER_ALREADY_RESOLVED` | `AGENCY_NOT_TRANSFERABLE`
Response 404: transfer not found OR caller is not the target.

### `POST /api/agencies/:id/ownership-transfer/:transferId/decline`
Request body:
```json
{ "reason": "I'm not ready to take on billing responsibility right now. Consider transferring to someone else on the team." }
```

Server validates:
- caller.user_id === transfer.target_user_id
- transfer.status === 'pending_recipient_accept'
- reason length ≥ 20, ≤ 500
- (no challenge required)

On success:
- Update `ownership_transfer_requests.status = 'target_declined'`, `decline_reason = reason`, `resolved_at = NOW()`
- Dispatch notification `ownership_transfer.declined` to initiator (→ AGN-SET-005 TARGET-REFUSED variant)

Response 200: transfer state.
Response 409: `TRANSFER_ALREADY_RESOLVED`.
Response 404: same as accept.
Response 400: `REASON_TOO_SHORT`.

**Filed under `[BE-BLOCKER-WF31-01]`** (same blocker as AGN-SET-005 — one cohesive backend PR).

---

## Downstream implementation (deltas from AGN-SET-005)

- **File to create:** `web/src/pages/AgencyOwnershipTransferAcceptPage.tsx`.
- **Route:** add to `web/src/App.tsx` — `<Route path="/agency/ownership-transfer/incoming/:transferId" element={<AgencyOwnershipTransferAcceptPage />} />`.
- **Component decomposition:**
  - `web/src/components/agency/OwnershipTransferAccept/AcceptForm.tsx` — main form composition.
  - `web/src/components/agency/OwnershipTransferAccept/InitiatorIdentityCard.tsx` — avatar + name + rationale blockquote.
  - `web/src/components/agency/OwnershipTransferAccept/ImplicationsBlock.tsx` — recipient-framed impact banner (mirror of AGN-SET-005's `ImpactBanner` but with different copy — could parametrize the AGN-SET-005 component with a `perspective: 'initiator' | 'recipient'` prop instead of duplicating).
  - `web/src/components/agency/OwnershipTransferAccept/DeclineDialog.tsx` — AlertDialog + Textarea + counter.
  - `web/src/components/agency/OwnershipTransferAccept/TerminalStateCard.tsx` — shared card for cancelled / expired / already-resolved / invalid-token variants.
- **Reused verbatim from AGN-SET-005 anchor:**
  - `<OwnershipTransferChallenge>` — the 3-factor challenge component.
  - `<ReversalWindowNotice>` — parametrized with `perspective: 'recipient'` for the recipient-framed copy.
- **Data hook:** `web/src/hooks/useIncomingOwnershipTransfer.ts` — GET + poll 60s + focus revalidation.
- **Test discipline:**
  - Unit: each sub-component + terminal-state card renders all variants.
  - Integration: accept happy path (3 factors → accept → JWT reissue → navigate to AGT-REC-006). Decline happy path (dialog → reason → decline → navigate to AGT-DSH-001).
  - Cross-flow: race condition where initiator cancels while recipient has page open → cross-fades to terminal state.
  - Real-Postgres: full end-to-end paired with AGN-SET-005 and AGT-REC-006.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **Anchor guard:** the same assertion test that AGN-SET-005 requires — `<OwnershipTransferChallenge>` imported by BOTH AGN-SET-005's initiator form AND this accept form.
- **RTL:** verified via `screens.rtl.test.tsx` extension.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat, AFTER the AGN-SET-005 brief has been used (v0 needs context on the shared `<OwnershipTransferChallenge>` composition). Framing prompt:

```
I'm designing the WingCaster "Accept ownership transfer" screen (AGN-SET-005b) — the RECIPIENT side of the WF-31 ownership-transfer cluster (target admin accepts or declines a transfer initiated on AGN-SET-005). Same stack, same tokens, same 3-factor challenge composition — this brief is a DELTA from AGN-SET-005.

First pass: render DESKTOP 1440px, ALL-VERIFIED state. Ahmad Khoury is the recipient viewing Sara Al Mansoori's transfer of "Elite Real Estate". Sara's rationale is quoted in a blockquote. Implications block below (recipient-framed — "You take on billing address…"). 3-factor challenge with all 3 steps complete. Consent checkbox ticked. Right-aligned actions row: Decline (outline) on the left, Accept (red primary) on the right, both enabled.

LTR English only for this pass — I'll ask for other states as follow-ups.

Sober tone. NO "Congratulations!" NO "Welcome to leadership!"

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. Desktop 1440px, INITIAL state — 3 factors all pending, Accept disabled, Decline enabled.
2. Desktop 1440px, CANCELLED-BY-INITIATOR terminal state.
3. Desktop 1440px, EXPIRED terminal state.
4. Mobile 375px, ALL-VERIFIED state.
5. RTL Arabic mirror desktop, INITIAL state.
6. Decline dialog open (reason empty, confirm disabled).
7. Decline dialog with reason filled (confirm enabled).
8. Dark mode desktop, ALL-VERIFIED state.

Save each output's JSX to `web/src/components/agency/OwnershipTransferAccept/` + screenshot to `docs/design/mockups/AGN-SET-005b-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 8 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-7 dispatch prompt references this brief + AGN-SET-005 + AGT-REC-006 briefs + the `<OwnershipTransferChallenge>` anchor.
- [ ] Reused-anchor assertion test passes (challenge component imported by both initiator and accept forms).
