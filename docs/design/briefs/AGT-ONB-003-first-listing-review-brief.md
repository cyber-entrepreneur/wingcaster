# Screen Brief — AGT-ONB-003 · First-Listing Review (celebration-framed)

**Layer-2 Brief — DELTA screen. References anchor AGT-ONB-001.**

Companion to `SCREEN_MATRIX_AGENT.md` §1 entry `AGT-ONB-003`. Ships in the AGT-ONB PR bundle (Week 4).

Upstream: `AGT-ONB-002` — auto-routes here when a draft flips to `awaiting_approval`.
Downstream: on Approve → `AGT-ONB-004` (celebration, fires WF-03 publish). On Edit → `AGT-LST-005` (full editor, stays in onboarding scope). On Discard → back to `AGT-ONB-001` with a soft "start over" toast.

Companion for the recurring (non-onboarding) version: `AGT-WLA-002`. This brief wraps the same content in a celebration frame; the two share `<DraftListingPreview>`.

---

## 🎨 Broadcast alignment

**Inherits Broadcast callouts A1-A12 from `AGT-ONB-001` (anchor).** This delta adds:

- **C1 · Celebration frame header** — subdued celebration (the big confetti moment is reserved for AGT-ONB-004 after publish). H1: `We drafted your first listing from your voice memo.` in `--lc-type-heading-1` + `--lc-text-heading`. Sub: `Look it over. Change anything. Then publish when you're ready.` in `--lc-type-body-lg` + `--lc-text-secondary`. A single `Sparkles` icon 20px in `--lc-text-brand` sits to the left of H1 (RTL: to the right).
- **C2 · Draft preview card** — the star of the screen. `<Card>` on `--lc-surface-raised` + `--lc-elevation-md`. Radius `--lc-radius-xl`. Interior top-to-bottom:
  1. **Photo gallery** — horizontal swipe of the photos the agent sent via WhatsApp. Snap-scroll. Photo corners `--lc-radius-md`. If < 3 photos, show a "Send more photos on WhatsApp →" nudge as the last slide.
  2. **Price + area strip** — big price via `<Numeric>` in `--lc-type-data` bumped to 24px. Beds / baths / area chips.
  3. **Address block** — `--lc-type-heading-3`. If AI parsed a partial address, missing pieces render as inline `<Chip variant="editable">` with a placeholder like "Add area" / "Add building name".
  4. **Description** — AI-drafted text in `--lc-type-body-lg`. Behind a "Show more" fold if > 6 lines.
- **C3 · Per-field Edit affordance** — every editable region of the preview has a subtle `Pencil` icon that appears on hover (desktop) or is always visible (mobile). Tap → opens a section-specific inline editor:
  - Photos: opens native photo picker → adds to gallery.
  - Price: opens numeric keypad sheet on mobile, inline input on desktop.
  - Address: opens a mini map picker.
  - Description: opens a full-screen editor with an AI-rewrite button.
  Each inline edit PATCHes the draft and refreshes the preview.
- **C4 · Primary CTA — Publish** — big, full-width on mobile. Fill `--lc-action-primary`. Icon leading: `Rocket` from lucide. Label: `Publish my first listing`. On tap: POST `/api/agent/whatsapp-listings/drafts/:id/approve` with `{ publish_social: false }` (the celebration screen offers the social-connect nudge instead of forcing it here).
- **C5 · Secondary CTA — Edit in full editor** — `<Button variant="outline">`. Label: `Open full editor`. Routes to `/listings/:id/edit` (AGT-LST-005) with a returnUrl back into onboarding so the user isn't dumped out of the funnel.
- **C6 · Tertiary — Discard** — `<Button variant="ghost">`, `--lc-text-muted`. Label: `Discard and start over`. Triggers a confirm dialog (`<Dialog>`) with `--lc-elevation-lg` — Broadcast rule: destructive actions never proceed on first tap.
- **C7 · AI-source attribution** — small caption below the description: `Drafted by WingCaster AI from your voice memo · you can edit anything before publishing.` in `--lc-type-caption` + `--lc-text-muted`. Honesty guardrail — never hide that AI wrote this.
- **C8 · Progress marker** (anchor A9) shows `Step 3 of 4 · Review your listing`.
- **C9 · Publishing state** — the moment after CTA click, the draft card gets a semi-opaque `--lc-surface-inverse` overlay at 40% opacity + a centered progress ring with the copy "Publishing to WingCaster… syndicating to your channels…". This is the ONLY place the emphasis easing (`--lc-easing-emphasis`) is legal within the onboarding family — it's the publish moment.

All other tokens inherit anchor A1-A12.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ONB-003 |
| Screen name | Onboarding — First-Listing Review |
| Persona | Agent, `onboarding_state.step = 'draft_review'` AND has ≥ 1 draft in `awaiting_approval` |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/onboarding/first-listing/:draftId` |
| Current state | MISSING (dedicated onboarding version). Recurring version AGT-WLA-002 also missing. |
| Workflow role | WF-01 (Onboarding) → WF-03 (Publish) trigger. AI-draft review, onboarding variant. |
| Backend prerequisites | ✅ `GET /api/agent/whatsapp-listings/drafts/:id` · ✅ `POST /api/agent/whatsapp-listings/drafts/:id/approve` · ✅ `POST .../discard` · ✅ `POST .../reprocess` · ⏳ PATCH endpoints per field (see §Backend contract) |

---

## Purpose

The AI-drafted listing appears; the agent reviews. This is where the magic they were promised on -001 either delivers or doesn't. Copy leans into the surprise ("we drafted this from your voice memo") without over-selling it. Editing is easy. Publishing is one big button. Discarding is possible but requires confirmation.

Metering note: the `WA_LISTING_INTAKE` credit was already consumed when the draft was created — no re-consumption on approval.

---

## Design goals

1. **The draft is a real object, not a mockup.** Show every piece of AI-generated content in situ; don't hide behind teasers.
2. **Edit anything without leaving the screen.** Per-field inline editors — the escape to the full editor (AGT-LST-005) is present but not the first choice.
3. **Publish is one big button.** No modal, no pre-flight checklist, no channel-picker in the way — that's AGT-ONB-004's next-action set.
4. **AI-source is disclosed.** The agent should never wonder later "did I write this?" C7 is non-negotiable.
5. **Discard is safe.** Confirm dialog + soft "start over" toast on AGT-ONB-001 landing — never a dead-end.
6. **Publishing feels like a moment.** C9's easing-emphasis + progress ring turn 2-3 seconds of latency into the anticipation of AGT-ONB-004's celebration.

---

## Layout

### Mobile 375px (primary)

- Top bar: progress marker `Step 3 of 4 · Review your listing` (left) + language + color mode (right).
- Celebration frame header (C1) — 2 lines.
- **Draft preview card (C2)** — full-width, all sections stacked.
- **Publish CTA (C4)** — sticky bottom above safe-area, full-width primary. Height 56px (above the 44px floor for prominence).
- Above the sticky CTA: Edit-in-full-editor (C5) + Discard (C6) as an inline row.
- AI-source attribution (C7) sits below the description inside the card, not below the CTAs.

### Desktop / tablet ≥768px

Two-column split, 55/45:
- **Left column (55%)** — celebration header + Draft preview card.
- **Right column (45%)** — a smaller "What we'll do when you publish" summary card listing:
  - "Your listing goes live on your WingCaster public page."
  - "We'll suggest which social channels to post to next."
  - "You keep control — edit or unpublish anytime."
  Below this: the Publish CTA (C4) as a large primary button, then Edit (C5), then Discard (C6).

The right column is not decorative — it's the pre-publish trust panel. On mobile it collapses into the description area of the draft card.

---

## Explicit copy (English — Arabic mirror pending)

| Slot | Copy |
|---|---|
| Progress marker | Step 3 of 4 · Review your listing |
| H1 | We drafted your first listing from your voice memo. |
| Sub | Look it over. Change anything. Then publish when you're ready. |
| Section label — photos | Photos ({n}) |
| Photo nudge (< 3) | Send more photos on WhatsApp → |
| Section label — price | Price |
| Section label — details | Beds · baths · area |
| Section label — address | Address |
| Section label — description | Description |
| Address chip placeholder | Add area · Add building name · Add floor |
| Description "Show more" | Show more ↓ |
| AI attribution (C7) | Drafted by WingCaster AI from your voice memo · you can edit anything before publishing. |
| Right column heading (desktop) | What happens when you publish |
| Right column bullet 1 | Your listing goes live on your WingCaster public page. |
| Right column bullet 2 | We'll suggest which social channels to post to next. |
| Right column bullet 3 | You keep control — edit or unpublish anytime. |
| Primary CTA (C4) | Publish my first listing |
| Secondary CTA (C5) | Open full editor |
| Tertiary — Discard (C6) | Discard and start over |
| Discard dialog title | Discard this draft? |
| Discard dialog body | Your photos and voice memo will be removed. You can start a new listing from WhatsApp anytime. |
| Discard dialog confirm | Yes, discard |
| Discard dialog cancel | Keep the draft |
| Publishing overlay | Publishing to WingCaster… syndicating to your channels… |
| Error — publish failed | Publishing didn't go through. Try again? |
| Error — load failed | We couldn't load your draft. Refresh? |
| Reprocess CTA (recovery) | Send updated info on WhatsApp → |
| Offline banner | You're offline. Editing is paused until you reconnect. |

---

## Component palette

| Element | Primitive |
|---|---|
| Celebration frame header | `<CelebrationHeader tone="subdued">` (shared with -004; -004 uses tone="loud") |
| Draft preview card | `<DraftListingPreview draftId>` (shared component — see anchor §Shared) |
| Photo gallery | `<PhotoSwipeGallery>` — reuses `AGT-LST-003`'s hero gallery, mobile variant |
| Price editor | Sheet on mobile, inline input on desktop. Uses `<Numeric>` for display. |
| Address chip | `<Chip variant="editable">` — custom, opens map picker on tap |
| Description editor | Full-screen `<Sheet>` with AI-rewrite button |
| Publish CTA | `<Button variant="default" size="lg">` |
| Edit CTA | `<Button variant="outline">` |
| Discard CTA + dialog | `<Button variant="ghost">` + `<Dialog>` (Radix) |
| Publishing overlay | Custom `<PublishingOverlay>` with progress ring |
| Progress marker | `<OnboardingProgressMarker step={3}>` (shared) |

---

## Sample content (for v0 / mockup)

Show mobile 375px in the "loaded, ready to publish" state:
- Progress: "Step 3 of 4 · Review your listing"
- H1 + sub as per copy table
- Draft preview card with:
  - 4 photos in the gallery (first shows a Downtown Dubai 2BR interior)
  - Price: AED 2.4M (big mono)
  - Chips: 2 beds · 2 baths · 1,200 sqft
  - Address: "Downtown Dubai, Burj Vista Tower 1" (parsed OK, no editable placeholders)
  - Description: 4-line AI draft ("Bright 2-bedroom apartment on the 32nd floor with Burj Khalifa view. Fully furnished, ready for immediate move-in…")
  - AI attribution caption visible
- Sticky bottom: Publish CTA (primary), Edit + Discard row above it

Also show:
- **Publishing state** — same layout with C9 overlay + progress ring copy "Publishing to WingCaster…"
- **Discard confirm dialog** — modal open over the same screen
- **Missing-fields state** — address chips showing "Add building name", "Add floor" placeholders

---

## Interactions

**On page load:**
- Read `useOnboardingState()`. If step is not `draft_review`, redirect.
- `GET /api/agent/whatsapp-listings/drafts/:draftId`. If 404 (draft was deleted), redirect to `/onboarding/welcome` with a toast.
- If draft is in `collecting` (rare — user opened deep-link before draft finalized), redirect to `/onboarding/whatsapp` to keep waiting.

**On per-field edit:**
- Open the section's inline editor.
- On save: PATCH `/api/agent/whatsapp-listings/drafts/:draftId` with only the changed field.
- Optimistic update the preview; roll back on error with a destructive toast.

**On Publish CTA click:**
- Disable all CTAs immediately.
- Render C9 overlay with emphasis-easing entry.
- POST `/api/agent/whatsapp-listings/drafts/:draftId/approve` with `{ publish_social: false }`.
- On 200: PATCH `onboarding_state` with `{ step: 'first_published', checklist_delta: { first_listing_published: true } }` then navigate to `/onboarding/first-listing/published` (AGT-ONB-004).
- On error: dismiss overlay, destructive toast, CTAs re-enable.

**On Edit-in-full-editor click:**
- Navigate to `/listings/:propertyId/edit?returnUrl=/onboarding/first-listing/:draftId`.
- AGT-LST-005 must honor `returnUrl` on save.

**On Discard click:**
- Open confirm dialog. On confirm: POST `.../discard`. On 200: PATCH `onboarding_state` back to `whatsapp_intake_pending`, then navigate to `/onboarding/welcome` (which will read state and route to `/onboarding/whatsapp` — the user gets a chance to restart).
- Toast on welcome landing: "Draft discarded. Send us new photos + a voice memo on WhatsApp whenever you're ready."

**On offline:**
- Banner appears. Per-field editors disable. Publish CTA disables. Discard CTA stays enabled (queues the discard).

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loaded** | Draft is `awaiting_approval` | Preview rendered, CTAs enabled. |
| **AI-processing** | Draft is `collecting` (edge case — user deep-linked early) | Redirect to `/onboarding/whatsapp`. |
| **Field edited** | User PATCHes a field | Preview updates optimistically. Toast on error. |
| **Publishing** | CTA clicked, POST in flight | C9 overlay + progress ring. All controls disabled. |
| **Published** | POST 200 | Redirect to -004. |
| **Publish failed** | POST 500 | Overlay dismissed, destructive toast, CTAs re-enable. |
| **Discard confirm** | Discard clicked | Modal shown. |
| **Discarded** | POST discard 200 | Redirect to welcome + toast. |
| **Missing photos / partial AI parse** | Draft has < 3 photos OR partial address | Photo nudge slide + editable chips shown. Publish stays enabled (never block on completeness — the agent decides). |
| **Loading** | GET in flight | Skeleton preview card. |
| **Error — load** | GET 500 | Empty state with retry. |
| **Draft not found** | GET 404 | Redirect to welcome + toast "That draft is no longer available." |
| **Offline** | Network unreachable | Banner, editors disabled, publish disabled. |
| **RTL Arabic** | Locale = ar | Layout mirrors. Photo gallery swipe direction mirrors. Numerals in price use Arabic-Indic digits when locale = ar. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap. Publishing overlay uses `--lc-surface-inverse` in both modes (that's what makes the moment feel like it "goes dark"). |

---

## Backend contract

Reuses PR #50 draft endpoints (verified in `backend/src/modules/whatsapp-listings/interface/agent-routes.js`):

- `GET /api/agent/whatsapp-listings/drafts/:id` — read.
- `POST /api/agent/whatsapp-listings/drafts/:id/approve` body `{ publish_social: false }` — fires WF-03 publish pipeline.
- `POST /api/agent/whatsapp-listings/drafts/:id/discard`.
- `POST /api/agent/whatsapp-listings/drafts/:id/reprocess` — re-runs AI on updated inbound messages.

**Gap noted (blocking for inline edits, not for MVP publish flow):**

Per-field PATCH is not currently supported. Options:
- **(a) Ship inline edit via full editor jump only** for v1. C3's per-field editors defer to AGT-LST-005 opening in a returnUrl mode. This is the safest path to hit Week 4.
- **(b) Ship a new endpoint** `PATCH /api/agent/whatsapp-listings/drafts/:id` accepting a partial JSON body (subset of draft fields). Filed as `[BE-NEW-07] Draft partial PATCH endpoint`.

Recommendation: ship (a) with the family in Week 4; add (b) as a fast-follow in Week 5 to enable true inline edits.

**Note on the approve endpoint:** the current implementation passes `publish_social: false` by default because AGT-ONB-004 (next screen) offers the social-connect nudge. If backend later gains a "publish to WingCaster public page only" default that bypasses external channels, no client change needed — the flag already covers it.

---

## Downstream implementation

- **New route:** `web/src/pages/onboarding/FirstListingReviewPage.tsx`.
- **Shared components created here:**
  - `<DraftListingPreview draftId>` — reused by AGT-WLA-002 (recurring version).
  - `<CelebrationHeader tone>` — reused by -004.
  - `<PublishingOverlay>` — reused any time a listing publishes.
- **AGT-LST-005 must honor `?returnUrl=`** on save/cancel — otherwise the "Open full editor" path breaks the onboarding funnel. Add a test.
- **Analytics:** `onboarding.draft_reviewed`, `onboarding.draft_edited`, `onboarding.draft_published`, `onboarding.draft_discarded` events.
- **Tests:** real-Postgres integration test spanning -002 (mock inbound) → draft appears → -003 renders → approve → -004 loads.

---

## Handoff to v0

Framing:

```
Screen 3 of 5 in WingCaster's agent onboarding family (AGT-ONB-003).
Anchor is AGT-ONB-001. This screen shows the AI-drafted listing that
came out of the WhatsApp intake (AGT-ONB-002) and lets the agent
review + publish. Publish is one big button, edit anything inline,
discard requires confirm. AI attribution is disclosed under the
description ("Drafted by WingCaster AI from your voice memo").

First pass: mobile 375px, "loaded and ready to publish" state.
Sample data: 2BR Downtown Dubai, AED 2.4M, 4 photos, parsed address,
4-line description. Progress marker "Step 3 of 4 · Review your listing".
Sticky bottom: Publish CTA (primary orange) + Edit / Discard inline row above.

LTR English light mode only for pass 1 — I'll ask for the publishing
overlay state, the discard confirm dialog, the missing-fields state,
desktop layout with the right-column pre-publish trust panel, RTL,
and dark mode as follow-ups.

DESIGN BRIEF FOLLOWS:
```

Iterations:
1. Publishing overlay (C9 active).
2. Discard confirm dialog.
3. Missing-fields state (partial address chips + < 3 photos nudge).
4. Desktop 1440px layout with right column trust panel.
5. RTL Arabic + dark mode.

---

## Definition of done

- [ ] 5 v0 iterations produced + committed.
- [ ] `<DraftListingPreview>`, `<CelebrationHeader>`, `<PublishingOverlay>` shared components extracted.
- [ ] AGT-LST-005 `?returnUrl=` support verified.
- [ ] Decision: ship inline-edit via full-editor jump (Week 4) OR file `[BE-NEW-07]` for the partial PATCH endpoint (Week 5 fast-follow).
- [ ] Broadcast `--lc-easing-emphasis` used ONLY in C9's overlay entry — enforced by test.
