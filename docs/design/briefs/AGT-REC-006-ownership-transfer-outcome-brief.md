# Screen Brief — AGT-REC-006 · Ownership transfer outcome (agent-side) — DELTA from AGT-REC-004 REC-family anchor

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §AGT-REC-006 entry. Week 7 delta per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 33 + §6 Week 7. Closes the WF-31 loop after AGN-SET-005b: **AGN-SET-005 (initiator) → AGN-SET-005b (recipient accept) → AGT-REC-006 (this brief, agent-side outcome for former + new owner)**.

**DELTA NOTICE.** This brief inherits from `AGT-REC-004-application-outcome-brief.md` (REC-family anchor) and from `AGN-SET-005-ownership-transfer-initiator-brief.md` (WF-31 anchor). **Every reference to the four REC-family primitives (`<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>`) is lifted verbatim from AGT-REC-004 and NOT restated here.** Every reference to the WF-31 state model, transfer lifecycle, and reversal-window semantics is lifted from AGN-SET-005 and NOT restated. This file only spells out per-screen deltas: dual-perspective rendering (former owner vs new owner), state-map for both sides, primary-CTA-per-state map for both sides, reversal-window in-app affordance (the ONE new interaction unique to this outcome screen).

---

## 🎨 Broadcast alignment

**Inherits from `AGT-REC-004` §Broadcast alignment verbatim.** No overrides. The `<StatusHero>` state→surface map, timeline pattern, resolver-message card, and `<PrimaryCtaPerState>` composition rules all apply here identically.

**Screen-specific Broadcast deltas:**
- **Dual-perspective banner** (new element) — on load, a compact pill at top of the screen identifies the caller's perspective: `You initiated this transfer` (former owner) or `You accepted this transfer` (new owner). `var(--lc-type-caption)`, `--lc-text-muted`, `--lc-surface-sunken` pill. This is meta — not a status, just orientation.
- **Reversal-window countdown card** (new element, ACCEPTED state only, for former owner only, within 30-day window) — sits between `<ResolverMessage>` and `<PrimaryCtaPerState>`. `--lc-surface-raised` + `border-left: 4px solid var(--lc-status-underOffer-fg)`. Contents:
  - Heading `var(--lc-type-heading-3)`: "You can reverse this transfer for {days_remaining} more days."
  - Body `var(--lc-type-body)`: "If you change your mind before {reversal_deadline}, you can reverse the transfer without contacting support."
  - `<Numeric>`-wrapped countdown `Reversal window closes in {days}d {hours}h`.
  - Ghost link "Reverse the transfer →" (opens confirm-dialog + fires a NEW 3-factor challenge modal — see §Reversal interaction).
- **State-hero for ACCEPTED (both sides)** — same `<StatusHero>` `emphasis='loud'` orange band as AGT-REC-004 APPROVED. Copy differs per perspective.
- **State-hero for DECLINED (former owner)** — same rejected-neutral treatment as AGT-REC-004 REJECTED.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-REC-006 |
| Screen name | Ownership transfer outcome |
| Persona | Former owner (agent — now demoted to admin) OR new owner (agent — freshly promoted to owner). Same route, dual-perspective render. |
| Device targets | Mobile 375px (primary — likely opened from push notification), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/inbox/ownership-transfers/:transferId` — canonical. Deep-link from push: `wingcaster://ownership-transfer/:transferId`. |
| Current state | MISSING — must ship with WF-31 cluster (Week 7). |
| Workflow role | WF-31 role=Recipient (outcome). Both former and new owner land here in their respective sub-states. |
| Backend prerequisites | `GET /api/users/me/ownership-transfers/:transferId` (recipient-scoped fetch, either former or new owner). Same `[BE-BLOCKER-WF31-01]` as AGN-SET-005 covers this endpoint. Also **NEW** `POST /api/agencies/:id/ownership-transfer/:transferId/reverse` (former-owner-only, within 30-day window, requires new 3-factor challenge). |

---

## Purpose

Both parties in a completed (or in-progress) ownership transfer land here to see the outcome. **Dual-perspective:** the server determines whether the caller is the former owner (transfer.initiator_user_id === caller.user_id) or the new owner (transfer.target_user_id === caller.user_id) and returns state accordingly. The screen renders the same layout with perspective-adapted copy and CTAs.

**Emotional stakes** — for the former owner: they've handed over authority and need reassurance that they're still an important admin AND that the reversal-window is real if they change their mind. For the new owner: they've accepted stewardship and need clarity on what changed for them AND what to do next (billing setup, PA-escalation orientation, team briefing).

**Success outcomes per state per side** are spelled out in the state-variant tables below.

---

## Design goals

1. **Same anchor primitives as AGT-REC-004, no new patterns invented.** `<StatusHero>` + `<OutcomeTimeline>` + `<ResolverMessage>` + `<PrimaryCtaPerState>` are lifted verbatim. Only the state-map, timeline events, and per-state CTA table differ.
2. **Dual-perspective is server-driven, not client-inferred.** Client just renders what the endpoint returns. Never conditionally render based on inferred role — server returns a `perspective` field that maps 1:1 to the copy set.
3. **Reversal-window is a first-class in-app affordance, not a support ticket.** Within the 30-day window, the former owner can reverse the transfer from this screen (with a new 3-factor challenge). This is the ONE new interaction unique to this outcome screen; everything else composes anchor primitives.
4. **New owner sees clear "what's now yours" orientation.** ACCEPTED state for the new owner includes an inline card of next-actions (link to billing, PA-escalation intro, team-notification suggestion).
5. **Former owner is not shamed.** ACCEPTED state for the former owner is a warm-but-not-gushing acknowledgment. "You transferred ownership of {Agency}. You're now an Admin." — factual, respectful, forward-looking with the reversal-window callout.
6. **Anchor discipline.** Both REC-family (AGT-REC-004) primitives AND WF-31 (AGN-SET-005) state model are inherited. Any change to REC primitives lands in AGT-REC-004; any change to WF-31 state semantics lands in AGN-SET-005; this brief only spells out compositional deltas.

---

## Layout

Same layout skeleton as AGT-REC-004 (mobile-first single column, tablet+ two-column 65/35 split with sticky right-sidebar CTA on desktop). Deltas:

1. **Perspective pill** at the very top, above the `<StatusHero>` band, `var(--lc-space-md)` padding. Left-aligned.
2. **`<StatusHero>` band** — same anchor primitive. State-map + copy per §Dual-perspective state map.
3. **Party identity card** — mirrors AGT-REC-004's agency-identity card but scoped to the OTHER party:
   - Former-owner perspective: card shows NEW OWNER's avatar + name + role chip (`Owner`) + "Accepted {relative}".
   - New-owner perspective: card shows FORMER OWNER's avatar + name + role chip (`Admin`, was Owner) + "Initiated {relative}".
   - Chevron opens the other party's user-profile bottom sheet (SHR-USR-001 or fallback).
4. **`<OutcomeTimeline>`** — same anchor. WF-31 timeline events (see §Timeline events).
5. **`<ResolverMessage>`** — same anchor. Message body is the initiator's `rationale` from the transfer row (verbatim). Attribution shows the initiator (former owner) even when the caller IS the initiator — the message describes why THEY did this, for their own record.
6. **State-specific detail block** — perspective-adapted (see §State-specific detail).
7. **Reversal-window countdown card** — ONLY when state = ACCEPTED AND perspective = former_owner AND `NOW() < reversal_deadline`. Positioned between `<ResolverMessage>` and the CTA block.
8. **`<PrimaryCtaPerState>`** — same anchor. Per-state action map per §Dual-perspective CTA map.
9. **Contact-support link** — same as AGT-REC-004.

---

## Dual-perspective state map

The server returns `perspective: 'former_owner' | 'new_owner'` alongside the transfer state. State-hero copy is a Cartesian of {perspective} × {status}:

| status × perspective | Status hero copy | State-hero surface |
|---|---|---|
| pending_recipient_accept × former_owner | "Waiting on {new_owner_name} to accept ownership of {Agency}" | pending sunken |
| pending_recipient_accept × new_owner | "{former_owner_name} offered you ownership of {Agency}" | more_info (needs your action) — top-border warning |
| recipient_accepted × former_owner | "You transferred ownership of {Agency}. You're now an Admin." | approved loud orange |
| recipient_accepted × new_owner | "You're now the owner of {Agency}." | approved loud orange |
| target_declined × former_owner | "{new_owner_name} declined the ownership transfer" | rejected neutral |
| target_declined × new_owner | "You declined the ownership transfer" | withdrawn muted |
| cancelled_by_initiator × former_owner | "You cancelled the ownership transfer to {new_owner_name}" | withdrawn muted |
| cancelled_by_initiator × new_owner | "{former_owner_name} cancelled the ownership transfer" | withdrawn muted |
| expired × former_owner | "The ownership transfer to {new_owner_name} expired" | expired hourglass |
| expired × new_owner | "The ownership transfer offer from {former_owner_name} expired" | expired hourglass |
| reversed × former_owner | "You reversed the ownership transfer. You're the owner again." | approved loud orange (reversal is a positive outcome for the former-turned-back-owner) |
| reversed × new_owner | "{former_owner_name} reversed the ownership transfer. You're an Admin again." | more_info neutral |

All `<StatusHero>` glyphs come from the anchor state→glyph map in AGT-REC-004 §Reusable REC-family patterns.

---

## Timeline events (WF-31 cluster)

Same `<OutcomeTimeline>` shape, WF-31 event set:

- **Initiated** — always present, timestamp = transfer.initiated_at.
- **Sent to {new_owner_name}** — always present, same timestamp (dispatched immediately with the initiate call).
- **Reviewed by {new_owner_name}** — timestamp when new owner first opened AGN-SET-005b (server tracks `first_viewed_at`); "Not yet reviewed" muted for pending state.
- **Decided** — timestamp of accept/decline/cancel/expire event; "Awaiting decision" pending for the pending-recipient-accept state.
- **Ownership flipped** — ONLY for `recipient_accepted` states; timestamp of the atomic role flip on the backend. Same as decided-timestamp in the same transaction.
- **Reversed** — ONLY for `reversed` state; timestamp of the reversal.

Timeline uses the anchor's dot-state conventions (complete / current / pending / skipped). The current-node pulse (only legal signal-lamp use on this screen per AGT-REC-004) fires only when perspective = former_owner AND status = pending_recipient_accept — the former owner watching their transfer wait.

---

## State-specific detail block (per state, per perspective)

Mirrors AGT-REC-004's detail-block pattern. Contents:

**pending_recipient_accept × former_owner:** "We'll notify you the moment {new_owner_name} decides. Sent {relative} · Expires {expires_at}." + reassurance line.

**pending_recipient_accept × new_owner:** Call-to-action-styled: "Review the transfer and decide. This request expires on {expires_at}." + prominent link "Open review page →" (deep-links to AGN-SET-005b).

**recipient_accepted × former_owner:** "You're now an Admin of {Agency}. You keep all admin capabilities. Ownership responsibility (billing, contracts, PA escalation, legal representation) is now with {new_owner_name}." Followed by "What changed for you:" bullet list:
- Billing invoices no longer route to you.
- You can no longer escalate to WingCaster PA support.
- You can no longer initiate another ownership transfer without {new_owner_name} starting a new one to you.
- Your listings, contacts, and role permissions are unchanged.

**recipient_accepted × new_owner:** "Welcome to the responsibility. Here's what's now yours." Followed by next-actions inline cards:
- Card 1 (link): "Review billing address & payment method" → `/agency/settings/billing` (AGN-SET-003).
- Card 2 (link): "See your PA escalation options" → SHR-SUP-001.
- Card 3 (link): "Notify your team" → `/agency/members` (AGN-MEM-001) with a suggested one-liner in a copy-to-clipboard pill.

**target_declined × former_owner:** "The transfer didn't happen. You're still the owner. Reason from {new_owner_name}: '{decline_reason}'." + link "Start a new transfer" → AGN-SET-005.

**target_declined × new_owner:** "You declined the transfer on {resolved_at}. Reason: '{decline_reason}'." + "You can still be offered ownership in future — no reapplication needed on your end."

**cancelled_by_initiator × former_owner:** "You cancelled the transfer on {resolved_at}. You're still the owner. You can start a new transfer any time." + link "Start a new transfer" → AGN-SET-005.

**cancelled_by_initiator × new_owner:** "{former_owner_name} cancelled before you decided. No action needed."

**expired × both:** "The transfer request expired after 14 days without a response from {new_owner_name}. The offer is no longer valid." + (former only) link "Start a new transfer".

**reversed × former_owner:** "You reversed the ownership transfer on {reversed_at}. You're back to being the owner of {Agency}. {new_owner_turned_admin} is back to being an Admin." + "The 30-day reversal window has now closed for this transfer."

**reversed × new_owner (now demoted back to admin):** "{former_owner_name} reversed the ownership transfer on {reversed_at}. You're an Admin of {Agency} again. Your role permissions and access are unchanged from before the transfer."

---

## Reversal-window countdown card + interaction

ONLY renders when:
- `perspective === 'former_owner'`
- `status === 'recipient_accepted'`
- `NOW() < transfer.reversal_deadline` (30-day window)

Card layout:
- Amber border-left `--lc-status-underOffer-fg`.
- Heading "You can reverse this transfer for {days_remaining} more days."
- Countdown `<Numeric>` `{days}d {hours}h remaining · closes {reversal_deadline}`.
- Body: "If you change your mind, reverse the transfer here without contacting support. After {reversal_deadline}, only PA support can reverse it."
- Ghost link "Reverse the transfer →".

**On "Reverse the transfer" click:**
- Open confirm dialog: "Reverse the ownership transfer?" body "You'll become the owner again. {new_owner_name} will become an Admin. They'll be notified. This action requires the same 3-factor verification as the original transfer."
- On confirm: opens `<OwnershipTransferChallenge>` modal (SAME anchor component as AGN-SET-005 — passed with the current agency name). On all 3 factors complete: `POST /api/agencies/:id/ownership-transfer/:transferId/reverse` with the 3 proofs.
- On success: JWT reissued to former owner (role back to `owner`), page re-fetches and renders as `reversed` × `former_owner` state (loud orange hero).
- Dispatch notification `ownership_transfer.reversed` to the (now-demoted) new-owner → they land on `reversed` × `new_owner` state.

**Reversal endpoint contract:**
- `POST /api/agencies/:id/ownership-transfer/:transferId/reverse`
- Server validates: caller === original initiator, `NOW() < reversal_deadline`, transfer.status === 'recipient_accepted', 3 factors valid.
- Atomic transaction flips ownership back, updates transfer row to `status='reversed'` + `reversed_at=NOW()`.
- Response 201 on success, 410 Gone if past deadline ("Reversal window closed. Contact WingCaster support."), 401 with same challenge-error-codes as AGN-SET-005 initiate.

---

## Dual-perspective CTA map (per state × per perspective)

Extends AGT-REC-004's `<PrimaryCtaPerState>` state → action map:

| status × perspective | primary | secondary | tertiary |
|---|---|---|---|
| pending × former_owner | (disabled chip) "Awaiting {new_owner_name}'s response" | View agency profile | Cancel transfer (opens confirm) |
| pending × new_owner | Open review page (deep-link AGN-SET-005b) | View former owner's profile | — |
| accepted × former_owner (within 30d) | Reverse transfer (opens challenge) | Go to {Agency} dashboard | View agency profile |
| accepted × former_owner (past 30d) | Go to {Agency} dashboard | View agency profile | Contact support (for post-window reversal) |
| accepted × new_owner | Go to {Agency} dashboard as owner | Review billing (AGN-SET-003) | Notify team (AGN-MEM-001) |
| declined × former_owner | Start a new transfer | View {Agency} settings | — |
| declined × new_owner | Go to {Agency} dashboard | — | — |
| cancelled × former_owner | Start a new transfer | View {Agency} settings | — |
| cancelled × new_owner | Go to {Agency} dashboard | — | — |
| expired × former_owner | Start a new transfer | View {Agency} settings | — |
| expired × new_owner | Go to {Agency} dashboard | — | — |
| reversed × former_owner | Go to {Agency} dashboard as owner | View audit log | — |
| reversed × new_owner | Go to {Agency} dashboard | View audit log | — |

Same rules from AGT-REC-004: exactly ONE primary per state; no `variant="destructive"` red on any REC screen; tertiary is ghost. The Reverse-transfer primary is styled the same as AGT-REC-004's Switch-workspace primary — orange `<Button variant="default">` — with the destructive confirmation happening inside the challenge modal.

**Cancel transfer tertiary (pending × former_owner)** — confirm dialog: "Cancel your transfer request to {new_owner_name}?" On confirm: POST `/api/agencies/:id/ownership-transfer/:transferId/cancel` → status flips to `cancelled_by_initiator` → page re-renders.

---

## Explicit copy (English) — delta table

Only slots that differ from AGT-REC-004 or are new. All Broadcast tokens, timeline event labels, confirm-dialog conventions inherited.

| Slot | Copy |
|---|---|
| Perspective pill (former owner) | You initiated this transfer |
| Perspective pill (new owner) | You accepted this transfer |
| Perspective pill (new owner, still pending) | You were offered this ownership |
| Timeline — event 1 | Initiated |
| Timeline — event 2 | Sent to {new_owner_name} |
| Timeline — event 3 | Reviewed by {new_owner_name} |
| Timeline — event 3 pending | Not yet reviewed |
| Timeline — event 4 | Decided |
| Timeline — event 4 pending | Awaiting decision |
| Timeline — event 5 (accepted) | Ownership flipped |
| Timeline — event 6 (reversed) | Reversed |
| Reversal card heading | You can reverse this transfer for {days_remaining} more days. |
| Reversal card body | If you change your mind, reverse the transfer here without contacting support. After {reversal_deadline}, only WingCaster support can reverse it. |
| Reversal card countdown | {days}d {hours}h remaining · closes {reversal_deadline} |
| Reversal card link | Reverse the transfer → |
| Reversal dialog title | Reverse the ownership transfer? |
| Reversal dialog body | You'll become the owner again. {new_owner_name} will become an Admin. They'll be notified. This action requires the same 3-factor verification as the original transfer. |
| Reversal dialog confirm | Yes, reverse |
| Reversal dialog cancel | Keep it as is |
| Reversal success toast | You're back to being the owner of {Agency}. |
| Post-reversal-window support note | The 30-day reversal window has closed. To reverse this transfer, contact WingCaster support. |
| Accepted × former_owner detail — heading | What changed for you |
| Accepted × former_owner detail — bullet billing | Billing invoices no longer route to you. |
| Accepted × former_owner detail — bullet PA | You can no longer escalate to WingCaster PA support. |
| Accepted × former_owner detail — bullet transfer | You can no longer initiate another ownership transfer without {new_owner_name} starting a new one to you. |
| Accepted × former_owner detail — bullet unchanged | Your listings, contacts, and role permissions are unchanged. |
| Accepted × new_owner detail — heading | Welcome to the responsibility. Here's what's now yours. |
| Accepted × new_owner card 1 | Review billing address & payment method |
| Accepted × new_owner card 2 | See your PA escalation options |
| Accepted × new_owner card 3 | Notify your team |
| Accepted × new_owner clipboard suggestion | I've just taken over as owner of {Agency}. Sara stays as an Admin and continues to lead her book. If anything's blocking you, come to me for billing, contract, or PA-support decisions. |
| Pending × new_owner CTA prompt | This request expires on {expires_at}. Open the review page to accept or decline. |
| CTA — pending × former_owner (disabled chip) | Awaiting {new_owner_name}'s response |
| CTA — pending × former_owner tertiary | Cancel transfer |
| CTA — pending × new_owner primary | Open review page |
| CTA — accepted × former_owner (within 30d) primary | Reverse transfer |
| CTA — accepted × former_owner (past 30d) primary | Go to {Agency} dashboard |
| CTA — accepted × former_owner (past 30d) tertiary | Contact support |
| CTA — accepted × new_owner primary | Go to {Agency} dashboard as owner |
| CTA — accepted × new_owner secondary | Review billing |
| CTA — accepted × new_owner tertiary | Notify team |
| CTA — declined/cancelled/expired × former_owner primary | Start a new transfer |
| CTA — reversed × both primary | Go to {Agency} dashboard |
| CTA — reversed × both secondary | View audit log |

---

## Sample content (for v0 / mockup)

Show the MOBILE 375px layout with:
- **Perspective:** former_owner
- **State:** recipient_accepted (within 30-day window, 27 days remaining)
- **Perspective pill:** "You initiated this transfer"
- **StatusHero:** loud orange band, `CheckCircle2` glyph in white ring, label "You transferred ownership of Elite Real Estate. You're now an Admin.", timestamp "Accepted 2 hours ago · 08 Sep 2026, 12:32" in white mono.
- **Party identity card:** Ahmad Khoury avatar (initials `AK`), name, role chip "Owner", subline "Accepted 2 hours ago".
- **Timeline:** Initiated (complete, 07 Sep 09:14) → Sent to Ahmad (complete, 07 Sep 09:14) → Reviewed by Ahmad (complete, 08 Sep 10:22) → Decided (complete, 08 Sep 12:32) → Ownership flipped (complete, 08 Sep 12:32).
- **ResolverMessage:** avatar `SA`, name "Sara Al Mansoori", role chip "Admin (was Owner)", timestamp. Body: "Stepping back from day-to-day ops. Ahmad has been running the operations side for the past year, signed our last three portal renewals with me, and is the right person to represent Elite going forward."
- **Reversal-window card:** amber-bordered, heading "You can reverse this transfer for 27 more days.", countdown "27d 21h remaining · closes 08 Oct 2026", link "Reverse the transfer →".
- **State detail:** "What changed for you" heading + 4 bullets.
- **Sticky bottom CTA:** primary "Reverse transfer" (orange), secondary text link "Go to Elite Real Estate dashboard", tertiary text link "View agency profile".

Iteration order for v0 after first pass:
1. Same mobile viewport, state = pending × former_owner (waiting, disabled chip, Cancel tertiary, current-pulse dot at Decided).
2. Same mobile viewport, state = pending × new_owner (call-to-action detail block, "Open review page" primary).
3. Same mobile viewport, state = recipient_accepted × new_owner (loud orange hero "You're now the owner", 3 next-action cards, primary "Go to Elite dashboard as owner").
4. Same mobile viewport, state = recipient_accepted × former_owner PAST 30d (no reversal card; primary "Go to Elite dashboard").
5. Same mobile viewport, state = reversed × former_owner (loud orange "You reversed…", 6-event timeline including Reversed dot).
6. Desktop 1440px, state = recipient_accepted × former_owner within 30d (two-column with sticky right-sidebar CTA + reversal card in main column).
7. Reversal confirm dialog open over the accepted-former-owner state.
8. RTL Arabic mirror at mobile 375px, state = accepted × new_owner.
9. Dark mode desktop, state = recipient_accepted × former_owner within 30d.

Save each output's JSX to `web/src/components/recipient/OwnershipTransferOutcomeScreen/` + screenshot to `docs/design/mockups/AGT-REC-006-<state>.png`.

---

## Component palette (deltas)

Reused verbatim from AGT-REC-004:
- `<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>` — all anchors.
- Party-identity card composition (mirror of agency-identity card).
- Sticky mobile CTA bar.

New for this screen:
| Element | Primitive |
|---|---|
| Perspective pill | Custom `<span>` with `--lc-surface-sunken` background |
| Reversal countdown card | Custom `Card` composition with `<Numeric>` for the countdown ticks (updates every minute, not every second — days-hours resolution) |
| Reversal challenge modal | Reuses `<OwnershipTransferChallenge>` from AGN-SET-005 anchor, wrapped in a `<Dialog>` |
| New-owner next-action cards | 3 `Card` primitives in a stack with `ArrowRight` icons + link semantics |
| Clipboard-copy pill (notify-team suggestion) | Custom `<div>` with `--lc-surface-sunken` + `Copy` icon that toasts on click |

---

## Interactions

**On page load:**
- Fetch `GET /api/users/me/ownership-transfers/:transferId`. Response includes `perspective: 'former_owner' | 'new_owner'`, `transfer` (same shape as AGN-SET-005), and (for former_owner with recipient_accepted state) `reversal_deadline` and `days_remaining`.
- If 404: "This transfer doesn't exist or isn't visible to you." fallback.

**On "Reverse the transfer" click (former_owner, accepted, within window):**
- Open confirm dialog → on confirm, open `<OwnershipTransferChallenge>` modal.
- On all 3 factors complete: POST `/api/agencies/:id/ownership-transfer/:transferId/reverse`.
- On 201: JWT reissue (role back to owner), page re-fetches, cross-fades to reversed × former_owner state.
- On 410 (window closed): dialog closes, screen refetches, reversal card disappears, tertiary CTA becomes "Contact support".

**On "Cancel transfer" tertiary (former_owner, pending):**
- Confirm dialog → POST `/api/agencies/:id/ownership-transfer/:transferId/cancel` → status flips → page re-renders.

**On "Open review page" primary (new_owner, pending):**
- Navigate to `/agency/ownership-transfer/incoming/:transferId` (AGN-SET-005b).

**On next-action card clicks (new_owner, accepted):**
- Card 1 → navigate to `/agency/settings/billing` (AGN-SET-003).
- Card 2 → navigate to `/support` (SHR-SUP-001) with pre-filled context "New agency owner PA escalation orientation".
- Card 3 → navigate to `/agency/members` (AGN-MEM-001). Clipboard pill's Copy button fires `navigator.clipboard.writeText(suggestionText)` + toast "Copied".

**On tapping Go to {Agency} dashboard (new_owner, accepted):**
- Ensure active tenant is the agency tenant (should already be from the JWT reissue on accept). Navigate to `AGT-DSH-001` in agency tenant context.

**Live update (push arrived while page open):**
- If former_owner is viewing pending state and new_owner accepts/declines/expires: page cross-fades hero + refreshes data at `--lc-duration-base`. Toast confirms "Transfer accepted" / "Transfer declined" / "Transfer expired".
- If new_owner is viewing accepted state and former_owner reverses: page cross-fades to `reversed` × `new_owner` state.

**Timeline live-updating:**
- "Reviewed by {new_owner_name}" event flips from muted to complete-dot the moment new_owner opens AGN-SET-005b. Pulse advance per anchor conventions.

---

## State variants (delta from AGT-REC-004)

Twelve states (6 statuses × 2 perspectives) plus loading/error/offline/RTL/dark — all rendered on top of AGT-REC-004's structural pattern. See §Dual-perspective state map for the mapping.

**Reversal-window-closed sub-state:** if the page loads with state = accepted × former_owner AND `NOW() >= reversal_deadline`, the reversal card is NOT rendered and the primary CTA falls back to "Go to {Agency} dashboard" per the CTA map.

**Reversal-in-flight sub-state:** while the reverse POST is in flight, the reversal card's link shows a spinner and disables. Rest of the page stays interactive (user can still tap "Go to dashboard" as a bail-out).

**Race conditions:**
- New_owner reverses their own role via a NEW ownership transfer to yet another admin, while former_owner is viewing their accepted-outcome page. The former_owner's page shows a small info banner "Ownership has moved on. Ahmad is no longer the owner." with a link to see the current agency state.
- Former_owner attempts reversal but window closed mid-click: 410 response → screen refetches, banner "Reversal window closed while you were reading. Contact support to reverse."

All variants use anchor `<StatusHero>` state map — no new hero surfaces invented.

---

## Accessibility

Same as AGT-REC-004 plus:
- Perspective pill has `role="note"` — not a status, just orientation.
- Reversal countdown card has `aria-live="polite"` — announces on days-remaining rollover (once per day, not per hour).
- Reversal challenge modal traps focus per `<OwnershipTransferChallenge>` anchor a11y contract.
- Dual-perspective copy set is server-driven; the same H1 element gets the correct accessible name based on returned `perspective` — screen readers don't need to conditionally re-announce.
- Next-action cards for new_owner are `<a>` elements (link semantics), not buttons — they navigate.
- Clipboard-copy pill has `aria-label="Copy suggested team notification message"`; after copy, live-region announces "Copied to clipboard".

---

## Anti-patterns (do not do these)

All AGT-REC-004 anti-patterns apply, plus:

- ❌ Do NOT infer the caller's perspective client-side from JWT or localStorage. Server returns `perspective` — client renders accordingly.
- ❌ Do NOT hide the reversal-window card behind a "more options" expander. If it's active, it's a first-class element.
- ❌ Do NOT show the reversal-window card to the new owner. Only the former owner can reverse.
- ❌ Do NOT auto-reverse or auto-cancel on any signal. Every state change requires an explicit user action (or the server-side expiry cron).
- ❌ Do NOT show "You made a mistake, we're saving you" copy in the reversal card. Reversal is a legitimate deliberate action; frame it neutrally.
- ❌ Do NOT show the raw transfer ID in the main body — same sidebar-small-print treatment as AGT-REC-004.
- ❌ Do NOT redirect the new owner to `AGT-DSH-001` automatically on landing. They land here first, they decide when to move.
- ❌ Do NOT gate the "Go to dashboard as owner" primary behind extra confirmation. They already confirmed 3 factors on AGN-SET-005b; that's enough.
- ❌ Do NOT show the challenge modal's OTP dispatch as sending to the initiator's email — for reversal, OTP goes to the FORMER owner (who is the caller here). Same server-side wiring rule as AGN-SET-005.
- ❌ Do NOT compose the reversal state's timeline event "Reversed" using the emphasis pulse. The reversal is a completed event by the time the page renders — no pulse.
- ❌ Do NOT fabricate the countdown ticks. `<Numeric>` reads the real reversal_deadline from the server; if the deadline is missing or malformed, render "Reversal window: contact support to check remaining time" fallback.

---

## Reference designs

Same as AGT-REC-004 plus:
- **Notion transfer-workspace-ownership acknowledgment** — the both-sides-see-outcome pattern.
- **GitHub organization-ownership-transferred email + landing** — the "here's what's now yours" next-actions pattern for new owner.
- **Stripe account-owner-changed dashboard banner** — the perspective-pill orientation model.

---

## Backend contract (deltas from AGN-SET-005)

**Endpoint:** `GET /api/users/me/ownership-transfers/:transferId`

Recipient-scoped fetch. Server validates caller.user_id === transfer.initiator_user_id OR caller.user_id === transfer.target_user_id. If mismatched, returns 404 (existence-leak defense).

Response 200:
```json
{
  "perspective": "former_owner" | "new_owner",
  "transfer": {
    "id": "ot_01H9...",
    "status": "pending_recipient_accept" | "recipient_accepted" | "target_declined" | "cancelled_by_initiator" | "expired" | "reversed",
    "initiator": { "user_id": "...", "display_name": "Sara Al Mansoori", "role_label": "Admin (was Owner)", "avatar_url": "..." },
    "target": { "user_id": "...", "display_name": "Ahmad Khoury", "role_label": "Owner", "avatar_url": "..." },
    "agency": { "tenant_id": "...", "display_name": "Elite Real Estate", "logo_url": "..." },
    "rationale": "Stepping back from day-to-day ops...",
    "decline_reason": null | "...",
    "initiated_at": "...",
    "first_viewed_at": "..." | null,
    "resolved_at": "..." | null,
    "expires_at": "...",
    "reversal_deadline": "..." | null,
    "reversed_at": "..." | null
  },
  "reversal_available": true | false,
  "days_remaining_in_reversal_window": 27 | null
}
```

**Endpoint:** `POST /api/agencies/:id/ownership-transfer/:transferId/reverse`

Request body: same 3-factor shape as AGN-SET-005 initiate. OTP is sent to and validated against the CALLER's email (former owner).

Server validates:
- caller.user_id === transfer.initiator_user_id (original initiator)
- transfer.status === 'recipient_accepted'
- `NOW() < transfer.reversal_deadline`
- 3 factors valid

On success (atomic):
- Update `agency_tenant.owner_user_id = caller.user_id` (former owner reclaims)
- Update `tenant_memberships`: caller.role = 'owner', current_owner.role = 'admin'
- Update `ownership_transfer_requests.status = 'reversed'`, `reversed_at = NOW()`
- Reissue caller's JWT with role='owner'
- Dispatch `ownership_transfer.reversed` notification to the (now-demoted) new_owner

Response 201.
Response 410: `REVERSAL_WINDOW_CLOSED` — "Contact WingCaster support to reverse."
Response 401 with same codes as initiate.
Response 409: `TRANSFER_NOT_ACCEPTED` (edge case where status changed mid-flow).

**Cron:** none new. The existing 14-day expiry cron from AGN-SET-005 covers pending states. Reversal-window expiry is checked at write-time (on any reverse attempt) — no cron needed; expired windows just fall through the 410 path.

**Filed under `[BE-BLOCKER-WF31-01]`** — same cluster blocker.

---

## Downstream implementation (deltas from AGT-REC-004)

- **File to create:** `web/src/pages/OwnershipTransferOutcomePage.tsx`.
- **Route:** add to `web/src/App.tsx` — `<Route path="/inbox/ownership-transfers/:transferId" element={<OwnershipTransferOutcomePage />} />`.
- **Component decomposition (composes AGT-REC-004 anchors):**
  - `web/src/components/recipient/OwnershipTransferOutcomeScreen/index.tsx` — orchestrator; renders anchors + WF-31 deltas.
  - `web/src/components/recipient/OwnershipTransferOutcomeScreen/PerspectivePill.tsx` — the top orientation pill.
  - `web/src/components/recipient/OwnershipTransferOutcomeScreen/PartyIdentityCard.tsx` — other-party card.
  - `web/src/components/recipient/OwnershipTransferOutcomeScreen/ReversalWindowCard.tsx` — the countdown + reverse-link card.
  - `web/src/components/recipient/OwnershipTransferOutcomeScreen/NewOwnerNextActions.tsx` — 3 next-action cards + clipboard pill.
  - `web/src/components/recipient/OwnershipTransferOutcomeScreen/StateDetail.tsx` — perspective × state map.
- **Reused verbatim:**
  - `<StatusHero>` from `web/src/components/recipient/StatusHero.tsx` (REC-family anchor).
  - `<OutcomeTimeline>` from `web/src/components/recipient/OutcomeTimeline.tsx`.
  - `<ResolverMessage>` from `web/src/components/recipient/ResolverMessage.tsx`.
  - `<PrimaryCtaPerState>` from `web/src/components/recipient/PrimaryCtaPerState.tsx`.
  - `<OwnershipTransferChallenge>` from `web/src/components/agency/OwnershipTransferChallenge.tsx` (WF-31 anchor).
- **Data hook:** `web/src/hooks/useOwnershipTransferOutcome.ts` — GET + poll 60s + focus revalidation.
- **Test discipline:**
  - Unit: each WF-31 delta component renders per state × perspective.
  - Integration: all 12 state × perspective combos render correctly. Reversal happy path (3-factor challenge → success → cross-fade to reversed state). Reversal-window-closed path (410 → banner + refetch).
  - Cross-flow: former_owner reverses while new_owner has page open → new_owner's page cross-fades to reversed × new_owner state.
  - Real-Postgres: full end-to-end from AGN-SET-005 initiate → AGN-SET-005b accept → both users open AGT-REC-006 and see correct sides.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **Anchor guards:**
  - Assertion that `<StatusHero>` is imported from REC anchor path (`@/components/recipient/StatusHero`), NOT re-implemented locally.
  - Assertion that `<OwnershipTransferChallenge>` is imported from the WF-31 anchor path (`@/components/agency/OwnershipTransferChallenge`).
- **RTL:** verified via `screens.rtl.test.tsx` extension.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat, AFTER the AGT-REC-004 brief has been used (v0 needs the REC-family anchor patterns in its context). Framing prompt:

```
I'm designing the WingCaster "Ownership transfer outcome" screen (AGT-REC-006) — the agent-side outcome screen for the WF-31 cluster. Both the former owner AND the new owner land on this same route (dual-perspective, server-driven). Six statuses × 2 perspectives = 12 state combinations. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen is a DELTA from AGT-REC-004 — the four REC-family anchor components (StatusHero, OutcomeTimeline, ResolverMessage, PrimaryCtaPerState) are lifted verbatim. It also reuses <OwnershipTransferChallenge> from AGN-SET-005 for the in-app reversal flow. Only the state map, timeline events, and per-state CTA table are new here.

First pass: render MOBILE 375px for state = recipient_accepted × former_owner within the 30-day reversal window (27 days remaining). Loud orange StatusHero "You transferred ownership of Elite Real Estate. You're now an Admin." Party identity card showing Ahmad (new owner). Timeline with 5 completed events including "Ownership flipped". ResolverMessage with Sara's original rationale. Amber-bordered reversal-window card in the middle: "You can reverse this transfer for 27 more days." with countdown and "Reverse the transfer →" link. "What changed for you" bullet list. Sticky bottom CTA: primary "Reverse transfer" (orange) + secondary "Go to Elite Real Estate dashboard" + tertiary "View agency profile".

LTR English only for this pass — I'll ask for other combinations as follow-ups.

Sober tone throughout. NO "Congratulations!" NO celebratory copy.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. Mobile 375px, state = pending × former_owner (waiting, disabled chip, Cancel tertiary).
2. Mobile 375px, state = pending × new_owner (call-to-action detail, "Open review page" primary).
3. Mobile 375px, state = recipient_accepted × new_owner (loud orange "You're now the owner", 3 next-action cards).
4. Mobile 375px, state = recipient_accepted × former_owner PAST 30d (no reversal card, "Go to dashboard" primary).
5. Mobile 375px, state = reversed × former_owner (loud orange, 6-event timeline).
6. Desktop 1440px, state = recipient_accepted × former_owner within 30d.
7. Reversal confirm dialog open over the accepted-former-owner state.
8. RTL Arabic mirror at mobile 375px, state = accepted × new_owner.
9. Dark mode desktop, state = recipient_accepted × former_owner within 30d.

Save each output's JSX to `web/src/components/recipient/OwnershipTransferOutcomeScreen/` + screenshot to `docs/design/mockups/AGT-REC-006-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 9 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-7 dispatch prompt references this brief + AGT-REC-004 REC-family anchor + AGN-SET-005 WF-31 anchor + the mockup paths.
- [ ] Anchor-import assertion tests pass (StatusHero/OutcomeTimeline/ResolverMessage/PrimaryCtaPerState from REC anchor; OwnershipTransferChallenge from WF-31 anchor).
- [ ] Reversal endpoint `POST /api/agencies/:id/ownership-transfer/:transferId/reverse` filed under `[BE-BLOCKER-WF31-01]`.
