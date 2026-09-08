# Screen Brief — AGT-WLB-005 · Listing ready — delta of AGT-WLB-001

**Layer-2 Brief for design AI consumption.** Delta of the AGT-WLB-001 anchor. Inherits the anchor's Broadcast alignment, `<TourFrame>`, and `<StepHero>` (**success emphasis** — this is the one screen in the WLB family where the loud-orange band is legal) patterns verbatim.

Wave 4, completion moment of the AGT-WLB tour. Renders as a cross-fade on top of AGT-WLB-004's route (same `/onboarding/whatsapp/drafting/:sessionId` URL) — no browser navigation. Cross-fade in ~1200ms after AGT-WLB-004's `draft-ready` state.

---

## 🎨 Broadcast alignment

Same as AGT-WLB-001 anchor. Additional callouts:

- **Success hero band** — `<StepHero emphasis="success">` uses `background: var(--lc-action-primary)` full-bleed. Glyph in a WHITE circle chip (`--lc-surface-raised` inverse) so `CheckCircle2` reads at glance against the orange. This mirrors AGT-REC-004's approval-hero discipline — the ONE hero in this family + the ONE hero on the whole product apart from the REC family's approved state where loud orange runs large.
- **Success band motion** — the cross-fade from -004's neutral hero to -005's success hero uses `var(--lc-duration-slow)` (240ms) with `var(--lc-easing-emphasis)` — the "broadcast moment" easing. This is the FAMILY's one completion celebration. One-shot per tour. Respect `prefers-reduced-motion`: instant swap, no easing bounce.
- **Confetti / celebration graphics** — none. The loud-orange band + the drafted listing preview are the celebration. No animated confetti, no lottie fireworks, no sound. Broadcast is intentionally poster-like, not playful.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-WLB-005 |
| Screen name | Listing ready |
| Persona | Agent (tour completion moment) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/onboarding/whatsapp/drafting/:sessionId` (same as -004; cross-fade state, not a new route). |
| Current state | MISSING — ships in Wave 4. |
| Workflow role | WF-01 completion + entry to WF-04 (draft review + publish). |
| Backend prerequisites | ✅ `GET /api/whatsapp-listings/drafts/:sessionId` (existing pipeline write endpoint — verify shape at branch time). ✅ Draft is written to the standard `listings` table with `status='draft'` per existing intake pipeline. ✅ Route to AGT-LST-003 (listing detail) or AGT-ONB-003 (tour-final review) already exists per matrix. |

---

## Purpose

The reward. The tour's payoff moment. The agent watched fields fill in on -004 and now sees the completed listing preview with one huge primary CTA — "Review & publish →" — that hands off to the standard listing detail / review flow.

Success = tap primary → land on AGT-ONB-003 (tour-final review + publish confirmation) OR AGT-LST-003 (standard listing detail) depending on whether the AGT-ONB-003 review-screen has been implemented as a separate tour terminus or is being consolidated into AGT-LST-003. Product to confirm at branch time; the CTA target is a single config value.

**This is the "aha moment" completion.** Everything from signup through -001-002-003-004 was engineered to make this reveal land. Get the loud-orange hero right and the agent's neuron pathway wires "WhatsApp → listing in seconds → I want to do this again."

---

## Layout (deltas from -001 and -004)

Everything from -001 stays: `<TourFrame>` with all 5 dots completed (dot 5 filled), close-X, screen title. **Progress bar transitions from "dot 5 active" (-004) to "dot 5 completed" (-005) as part of the cross-fade** — signals "we're done."

**Body replaces `<LiveDraftCanvas>` (-004) with a listing-preview composition:**

- **`<StepHero emphasis="success">`** — loud orange band, ~200px tall on mobile:
  - Glyph: `CheckCircle2` in a white circle chip. 40×40 mobile / 48×48 desktop.
  - Title: "Your listing is ready" — Archivo 800 in `--lc-action-primary-text` (white ink on orange).
  - Body: "Review the details, tweak anything you want, then publish to Bazaar and your connected portals." — `var(--lc-type-body-lg)` in `--lc-action-primary-text` with slight opacity for hierarchy.
- **`<ListingPreviewCard>`** — the drafted listing rendered as it would appear on the AGT-LST-003 detail page's hero. Content:
  - Photos gallery: 3-up horizontal strip mobile / 5-up desktop, `<img>` thumbnails at `var(--lc-radius-md)`. First photo tall (2x). Total-count badge overlaying the last visible: `+{N}` via `<Numeric>`.
  - Address: `var(--lc-type-heading-2)`.
  - Meta row: `<Numeric>` for bedrooms `Bed 3`, bathrooms `Bath 2`, area `1,850 sqft`. Icons: `Bed`, `Bath`, `Ruler`. `var(--lc-type-body)`.
  - Price: `var(--lc-type-display)` in mono via `<Numeric>` — this is the emotional number, give it the display weight. Currency badge: `<Badge variant="outline">` "AED".
  - Description: first 3 lines with a "Read more" ghost link.
  - Draft-status chip: `<Badge>` with the `draft` status token per Broadcast — `--lc-status-draft-{bg,fg,dot}` + `○` glyph + label "Draft".
- **"What we caught" summary panel** — small `--lc-surface-sunken` card below the preview, lists what the AI extracted from each message-attachment:
  - "Address extracted from your voice note + location pin"
  - "Price extracted from your voice note"
  - "Photos organized by room type"
  - Each line has a subtle `Check` icon in `--lc-accent-bold-edge` (small text-legal accent form).

**Sticky mobile bottom bar:**
- Primary CTA: `<Button variant="default" size="lg">` full-width — "Review & publish →". On tap navigates to AGT-ONB-003 (tour-final review) OR AGT-LST-003 (standard listing detail) — determined by a single config `wingcaster.tour.completion_route` — default `/listings/:listingId?tour=complete` mapping to AGT-LST-003 with a query-param that AGT-LST-003 uses to render a one-time celebratory banner. Leading `ArrowRight` icon.
- Ghost above primary: "Save for later — I'll review in Drafts" — navigates to `/listings/drafts` with a persistent toast "Your listing is saved as a draft. Publish anytime." Also completes the tour.

**Desktop layout:** two-column, 55/45 — success hero full-width above the split; below the split, listing preview card in the left column and the "What we caught" summary + CTA stack in the right column (sticky sidebar, top-offset `var(--lc-space-3xl)`).

**RTL:** full mirror. Listing preview photo strip flips (first photo on the RIGHT); price + meta row mirrors; description text RTL-aligned; draft chip mirrors.

---

## Explicit copy (deltas only)

| Slot | Copy |
|---|---|
| Hero title | Your listing is ready |
| Hero body | Review the details, tweak anything you want, then publish to Bazaar and your connected portals. |
| Preview card — draft status label | Draft |
| Preview card — read more | Read more |
| Preview card — photos badge (surplus) | +{N} |
| Summary overline | What we caught |
| Summary line 1 | Address extracted from your voice note + location pin |
| Summary line 2 | Price extracted from your voice note |
| Summary line 3 | Photos organized by room type |
| Summary line 4 (variable, if applicable) | Bedrooms + bathrooms extracted from your voice note |
| Primary CTA | Review & publish → |
| Ghost secondary | Save for later — I'll review in Drafts |
| Save-toast | Your listing is saved as a draft. Publish anytime. |
| Post-publish landing (on AGT-LST-003 with `?tour=complete`) | You did it. Your first listing is live on WingCaster. |

---

## Interactions (deltas)

**On cross-fade from -004:**
- Same route (`/onboarding/whatsapp/drafting/:sessionId`). No navigation. Component-level state switches from `phase: 'drafting'` to `phase: 'ready'`. React renders the new composition; opacity + hero-background cross-fade at `var(--lc-duration-slow)` with `var(--lc-easing-emphasis)`.
- The `<TourFrame>` progress bar dot 5 morphs from "active" (orange filled dot) to "completed" (accent-bold-with-edge filled dot) synchronously.
- Screen reader announces "Your listing is ready. Review and publish, or save for later." (single `aria-live="polite"` announcement — not two).

**On primary CTA tap:**
- POST `/api/users/me/onboarding-events` `{ event: "whatsapp_tour_completed", tour_step: 5, listing_id: <draftId> }` (fire-and-forget).
- Navigate to the configured completion route (see §Meta) with `?tour=complete` query param.

**On ghost "Save for later" tap:**
- Same event POST + navigate to `/listings/drafts` + persistent toast.

**On close-X:**
- Same as ghost — the draft is already saved server-side; closing is safe.

**On listing preview card tap (mobile):**
- Same as primary CTA — the whole card is a large tap target for the "Review & publish →" action. Ripple effect from the tap origin at `var(--lc-duration-fast)`; then navigate.

---

## State variants (deltas)

| Variant | Trigger | Behavior |
|---|---|---|
| **Ready (default)** | Cross-fade from -004 drafting complete | Full success composition. |
| **Ready — partial-fields** | Draft finalized but some optional fields empty (e.g. no area extracted) | Preview card still renders; empty fields simply omit (do NOT render placeholder "Not provided" text — cleaner to show only what we have). Summary panel omits corresponding line. |
| **Ready — no-photos** | Extremely rare — voice + pin only, no photos attached | Photos block replaced with a small grey placeholder card + inline nudge "Add photos in the next step" + `Camera` icon. |
| **Publishing** | Primary tap → route in flight | Primary shows `Loader2` + "Opening review…"; whole screen `aria-busy`. |
| **Save-later** | Ghost tap → navigation in flight | Ghost shows `Loader2` + "Saving to Drafts…"; navigates. |
| **RTL / Dark** | Locale / mode | Full mirror + token swap. In dark mode the loud-orange hero becomes `#FF7440` (Broadcast dark-mode primary). Body ink stays white on the hero band. |

---

## Anti-patterns (deltas)

- ❌ Do not add confetti / fireworks / lottie animations. The loud-orange hero + the drafted listing preview + the earned progress arc IS the celebration. Broadcast is poster-like, not playful.
- ❌ Do not auto-publish. Every listing publishes only after the agent explicitly confirms on AGT-LST-003 / AGT-ONB-003. The tour's job ends here.
- ❌ Do not use `variant="destructive"` for any button. Save-for-later and close are ghosts. There's no destructive action on this screen.
- ❌ Do not repeat the "You did it" copy on both this screen AND the post-publish landing. THIS screen says "Your listing is ready" (not-yet-published); the celebratory copy on AGT-LST-003 after publish says "You did it. Your first listing is live." — different moments, different words.
- ❌ Do not put a "Try WhatsApp intake again" CTA on this screen. The agent should feel the loop closed, not restarted. That affordance lives on AGT-DSH-001 as an attention-card.
- ❌ Do not swap the tour dot 5 to a checkmark glyph on completion. Keep it a filled accent-bold-with-edge dot per the anchor pattern. Consistency over cuteness.
- ❌ Do not delay the cross-fade beyond 1200ms after `draft-ready`. The "wow" degrades fast with a stale spinner.
- ❌ Do not fabricate the listing content in the mockup. Use realistic MENA sample data: `42 Marina Walk, Dubai Marina · Bed 3 · Bath 2 · 1,850 sqft · AED 2,450,000` etc. — no lorem ipsum.

---

## Downstream implementation notes (deltas)

- **File:** hosted inside `web/src/pages/onboarding/WhatsAppDraftingPage.tsx` (same as -004). A `phase` state variable drives the -004 vs -005 render.
- **Reuses:** `<TourFrame>`, `<StepHero emphasis="success">` (the ONE legal success usage in the family), `<ChannelMark>` NOT used (content is no longer WhatsApp-branded — it's a WingCaster listing).
- **New primitive:** `<ListingPreviewCard>` — under `web/src/components/listings/ListingPreviewCard.tsx`. Reused by AGT-LST-003 and future card composers. Props: `{ listing: Listing, variant: 'preview' | 'compact', onTap?: () => void }`. Composes photo strip + address + meta row + price + description + status chip. Draft status chip uses `<Badge>` + `--lc-status-draft-*` tokens + `○` glyph + label "Draft".
- **Cross-fade choreographer:** in `WhatsAppDraftingPage.tsx`, use `<AnimatePresence mode="wait">` (framer-motion — already a dep; verify at branch time) with `initial={false}` on subsequent renders. Custom variants set opacity + hero-background color transition. Respects `prefers-reduced-motion` via `useReducedMotion()` hook — instant swap.
- **Route-config:** `web/src/config/tour.ts` exports `TOUR_COMPLETION_ROUTE` — default `/listings/:listingId?tour=complete`. Single source of truth for the primary-CTA target.
- **Test discipline:**
  - Unit: `<ListingPreviewCard>` renders across all field permutations (photos empty / partial / full; description empty / long; price present / absent).
  - Integration: cross-fade from -004 `draft-ready` to -005 renders correctly at both motion and reduced-motion.
  - CTA: primary + ghost both fire the onboarding-event POST AND navigate correctly.
  - Real-Postgres: end-to-end scenario — real inbound webhook → real intake pipeline → real draft row → -005 renders with the real listing → primary tap → lands on AGT-LST-003 with the tour-complete banner.
  - RTL: verified via `screens.rtl.test.tsx`.
- **Guard:** an assertion test that verifies `<StepHero emphasis="success">` is ONLY used on this screen across the whole WLB family. Enforces anchor discipline.

---

## Definition of done (family-level, since this closes the tour)

- [ ] All five WLB briefs (-001 anchor, -002/-003/-004/-005 deltas) written and reviewed.
- [ ] All five v0 iterations completed per each brief's Handoff instruction section.
- [ ] Screenshots committed under `docs/design/mockups/AGT-WLB-*-*.png`.
- [ ] Cursor Wave-4 dispatch prompt references all five briefs + the mockup paths + the five reusable anchor components (`<TourFrame>`, `<StepHero>`, `<BenefitList>`, `<WhatsAppHandshakePanel>`, `<LiveDraftCanvas>`, plus the two per-screen primitives `<SignalLampBadge>` and `<InboundMessageSummary>` and the shared `<ListingPreviewCard>`).
- [ ] `[BE-BLOCKER-07]` (Live draft-progress endpoint) filed in kickoff §5a — needed for -004 fidelity.
- [ ] `[BE-BLOCKER-07a]` (Inbound-message poll endpoint) filed in kickoff §5a — needed for -003 fidelity.
- [ ] `[BE-BLOCKER-08]` (Onboarding events endpoint) filed if not already present — needed for -001/-005 event tracking.
- [ ] `[BE-BLOCKER-09]` (GET current activation-code endpoint) filed in kickoff §5a if PR #50's POST endpoint doesn't return existing active code idempotently — needed for -002 re-entry.
