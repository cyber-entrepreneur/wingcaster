# Screen Brief — AGT-LST-004 · Manual listing composer (guided wizard)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-LST-004` (row 20 of §5, Wave 8+ per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md`). This is the **fallback path for creating a listing when WhatsApp voice-memo intake (AGT-ONB-002 / AGT-WLB) is not used** — for agents who prefer to type, for laptop-first onboarding, for editing a listing that was seeded by WhatsApp but needs manual completion, and for the "Add a listing manually" tile on AGT-ONB-001.

Sibling to `AGT-LST-003-listing-detail-mobile-brief.md` (the surface this wizard resolves into after publish) and `AGT-LST-001` (listing list — the FAB that opens this wizard). Reuses many primitives from `AGT-ONB-002-whatsapp-intake-tour-brief.md` (5-step progress chrome, live preview canvas) but drives the fields itself instead of streaming them from an intake engine.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace with `--lc-*` semantic tokens per the alignment reference. No new tokens. No raw hex.

**Screen-specific Broadcast callouts:**

- Wizard chrome (progress dots + step title + step counter): background `var(--lc-surface)` with a `var(--lc-elevation-sm)` bottom edge only when content scrolls beneath. Progress dots use `var(--lc-action-primary)` for completed + current, `var(--lc-border-strong)` for upcoming. Reuse the `<TourFrame>` primitive extracted for AGT-ONB (5-dot progress chrome).
- Step title: `font: var(--lc-type-heading-1)` — 600 26/32 IBM Plex Sans. Sub-title (helper): `var(--lc-type-body-lg)` + `--lc-text-muted`.
- Step counter overline ("Step 2 of 5"): `var(--lc-type-overline)` — 600 11/14 + 0.08em tracking + `--lc-text-muted`.
- Field labels ALWAYS visible above their input — never placeholder-only. `var(--lc-type-body-sm)` + `--lc-text-secondary`. Required marker asterisk in `--lc-status-danger-fg`.
- Text inputs, textareas, selects: `--lc-surface-raised` background + `--lc-border-strong` 1px border + `var(--lc-radius-md)` (5px). Focus: two-tone Broadcast focus ring auto-applied.
- Every numeric field (price, bedrooms, bathrooms, sqft/sqm, floor, year built) wraps its rendered value in `<Numeric>` — IBM Plex Mono + `tabular-nums`. Especially on the live preview + review step.
- Currency + area-unit toggle buttons: `<ToggleGroup>` primitive. Selected pill `--lc-action-primary` fill + `--lc-action-primary-text` ink; unselected `--lc-surface-sunken` + `--lc-text-secondary`.
- Features multi-select chips: `<Toggle>` chips with `var(--lc-radius-pill)`. Unselected: `--lc-surface-sunken` + `--lc-border`. Selected: `--lc-action-primary` fill + `--lc-action-primary-text` ink + `Check` icon prefix (14px).
- Media step upload zone: dashed border `2px dashed var(--lc-border-strong)`, `var(--lc-radius-lg)`, background `--lc-surface-sunken`. Drag-hover state: `--lc-action-primary` dashed border + `--lc-surface-selected` tint.
- Photo tile grid: each tile `var(--lc-radius-md)`, `var(--lc-elevation-sm)`. Hero photo tile shows a "Hero" ribbon top-left using `--lc-accent-bold` fill + `--lc-accent-bold-text` ink + `--lc-accent-bold-edge` border (accent-bold requires a boundary — spec rule).
- Alt-text field beneath each photo tile: `var(--lc-type-body-sm)`. Required for a11y — inline warning glyph if empty.
- Visibility radio group (public / private / white-label-only): `<RadioGroup>` styled as three vertical cards. Selected card gets `border: 2px solid var(--lc-action-primary)` + `background: var(--lc-surface-selected)`.
- Portal-preview cards in Step 5: each portal chip uses `<ChannelMark>` (Bayut, PF, Dubizzle, OLX, Aqar, Blue Door LB, etc.) 24px + label. Never large surfaces in channel colors.
- Autosave indicator (top-right of chrome): small pill — `<Numeric>` for the timestamp, `Cloud` / `CloudOff` / `Check` lucide icons. Idle: `--lc-text-muted`. Saving: `--lc-accent` dot pulsing at `--lc-duration-slow`. Saved: `--lc-status-published-fg` (green) + `Check`. Failed: `--lc-status-unpublished-fg` (red) + `AlertCircle`.
- Sticky bottom nav bar (Back / Save draft & exit / Next): `--lc-surface` + `--lc-elevation-md` shadow appearing on scroll. All buttons 44px+.
- Next / Publish CTA: `--lc-action-primary` fill; hover DARKENS to `--lc-action-primary-hover`. On Step 5 the CTA reads "Publish →" and triggers the AGT-PUB-005 outcome sequence — that is the ONE place `--lc-easing-emphasis` (spring) lands.
- Publish-success signal-lamp pulse (200ms, `--lc-accent-bold` dot on `--lc-action-primary` surface) is authorized here per the alignment reference — this IS the "publish moment".
- Motion: step transitions slide horizontally 240ms `--lc-easing-in-out`. Field reveal (conditional fields) uses `<Collapsible>` at 180ms. Do NOT bounce.
- Radii: cards `var(--lc-radius-lg)` (7px); inputs `var(--lc-radius-md)` (5px); chips `var(--lc-radius-pill)`.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-LST-004 |
| Screen name | Manual listing composer |
| Persona | Agent (Guided mobile primary; Pro tablet/desktop reuses same wizard with denser layout) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/listings/new` (fresh) OR `/listings/:id/edit` (editing existing) — same wizard shell, hydration differs |
| Query params | `?step=1..5` (deep-link into a step), `?agency=<id>` (pre-fill agent-of-record when agency-context), `?source=onboarding` (attribution for AGT-ONB entry) |
| Current state | PARTIAL — `web/src/components/ListingFormModal.tsx` exists as a single-form modal. This brief supersedes with a 5-step guided wizard variant. The single-form Pro variant (AGT-LST-005) stays for power users who want everything on one screen. |
| Workflow role | Fallback to AGT-ONB-002 (WhatsApp intake). Entry to WF-03 (AGT-PUB-005 publish outcome) on final Publish. |
| Backend prerequisites | ✅ `POST /api/properties` (create with `status: 'draft'`) — `backend/src/server.js:1668` · ✅ `PUT /api/properties/:id` (update) — `backend/src/server.js:1786` · ✅ `POST /api/uploads/photos` (media upload — used elsewhere) · ✅ Territory disclosure fields — migration 003 (already gates Step 1 country field) · ⏳ **Optional:** dedicated `PATCH /api/properties/:id/draft` alias for autosave semantics — piggybacks on existing PUT today; see §Backend contract for the trade-off. |

---

## Purpose

Let an agent create a complete, publishable listing by typing (or tapping through pickers) without needing to send a WhatsApp voice memo. This is the honest fallback: MENA agents love WhatsApp intake, but not every agent is comfortable dictating a listing, not every device has WhatsApp connected, and every listing eventually needs manual completion — either because the intake AI missed a field or because the agent wants to add richness (features, alt-text, portal-specific overrides) that voice can't easily capture.

Success outcomes:

- **New listing published:** wizard completes → `PUT /api/properties/:id` with `status: 'active'` → redirect to `/publish/outcome/:id` (AGT-PUB-005) → AGT-LST-003 detail.
- **New listing saved as draft:** any step's "Save draft & exit" → `PUT /api/properties/:id` with `status: 'draft'` → redirect to AGT-LST-001 with a toast.
- **Existing listing edited:** hydrated from `GET /api/properties/:id` → user edits → PUT persists on step transition and on final "Save changes" → redirect to AGT-LST-003 detail with a "Saved" toast.

---

## Design goals

1. **One decision per step.** Five steps is the ceiling. Do not cram a sixth. Each step's screen has ONE primary focal area — everything else is secondary.
2. **Autosave is invisible but visible when it matters.** The user must never fear losing work by tapping Back, backgrounding the app, or losing connectivity mid-step. The autosave indicator is understated in idle, unmistakable in "saving now", and impossible to miss when it fails.
3. **Manual composer is honest about what WhatsApp intake would have done for them.** Step 1 has a subtle "Prefer to talk it out? Use WhatsApp intake instead →" link that jumps to AGT-ONB-002 (only when this session is coming from a fresh onboarding — do NOT show this once the agent has committed to typing).
4. **The live preview is the reward.** From Step 2 onwards, a compact `<ListingPreviewCard>` (the same one AGT-LST-003 reuses) renders on-screen — mobile: peek strip at bottom; tablet/desktop: right-column sidebar. Fields the agent fills flow into the preview immediately. Empty fields render as placeholder chips ("Add price", "Add photos") that also serve as jump-back links.
5. **Photos are treated as first-class content, not attachments.** Step 3 is a full-screen media manager: drag-reorder, hero-pick, alt-text-per-photo (a11y non-negotiable), video-optional. Not a "click here to upload" afterthought.
6. **Attribution is a real Step, not a footer checkbox.** Agency-context agents must consciously decide whether the listing is agency-owned or agent-owned (governs `listing_owner_type` + `exit_disposition` from AGT-LST-005 update spec). Solo agents skip this decision (Step 4 collapses to contact preferences only).
7. **Publish preview is a fair mirror of every downstream surface.** Step 5 renders the listing as it will appear on: agent profile card, agency profile card (if agency-tied), white-label mini-site (if configured), Bazaar syndication card (if `marketplace_syndicated` toggle on), and each connected portal (Bayut / PF / Dubizzle / OLX / Aqar / …). Portal previews are per-portal, not generic — each portal has field-level differences (e.g. Bayut demands Trakheesi number, PF has different photo aspect requirements). Portal-specific validators (BE-BLOCKER-17 in the kickoff) render inline warnings here so the agent fixes them before publish, not after.

---

## Layout

### Mobile ≤767px (primary — Guided mode)

Single-column, step-by-step. Each step is a full-viewport view; transitions slide horizontally. Sticky wizard chrome top + sticky bottom nav.

**Wizard chrome (56px + safe area, sticky top):**
- Left: back arrow (goes to previous step; on Step 1 it prompts "Discard draft?" if fields have been touched)
- Center: 5-dot progress + step counter overline underneath ("Step 2 of 5 · Property details")
- Right: autosave indicator pill (`Cloud` / `Check` / `AlertCircle` + timestamp)

**Step body (scrolls):**
- H1: step title (`var(--lc-type-heading-1)`)
- Sub: one-line helper (`var(--lc-type-body-lg)`, muted)
- Fields stacked, generous vertical rhythm (`--lc-space-xl` between field groups)
- Live-preview peek strip at bottom of step body (56px tall, tappable to expand to a full-screen preview sheet)

**Sticky bottom nav (72px + safe area):**
- Left (outline, 30% width): "Save draft & exit" — always visible after Step 1 fields are touched
- Right (primary, 70% width): "Next →" (Step 1–4) / "Publish →" (Step 5)
- Back arrow is in the chrome, not the bottom bar (matches the app's mobile nav pattern from AGT-LST-003)

### Tablet 768px + desktop ≥1024px (Pro fallback)

Two-column split, 60/40:

- **Left column (60%) — wizard body:** same wizard chrome + fields as mobile, but form fields laid out in a denser 2-column sub-grid where sensible (bedrooms/bathrooms side-by-side, sqft/sqm side-by-side).
- **Right column (40%) — live preview panel:** persistent `<ListingPreviewCard>` at the top, mode-toggle chips underneath ("Agent profile · Agency profile · White-label · Bazaar · Bayut · PF · Dubizzle · OLX · Aqar") that swap the preview render. Bottom of right column: small "Preview scale: mobile / tablet / desktop" mini-toggle.

Sticky bottom nav collapses into an inline right-aligned button row inside the left column footer.

### Common: Progress + step map

The 5 steps are:

1. **Basics** — Listing type (sale / rent), purpose, territory (auto-guessed from IP, editable), area/neighborhood, price + currency
2. **Property details** — Bedrooms, bathrooms, floor area (sqft + sqm toggle), features multi-select, property type, year built (optional), floor number (optional), lot size (villa/land only)
3. **Media** — Photos (drag-reorder, hero-pick, alt-text per photo, min 3 max 30), optional video, optional 360 tour URL
4. **Contact + attribution** — Agent-of-record (agency mode: pick agency-owned / self-owned), contact channel preferences (WhatsApp / call / SMS / email), visibility (public / private / white-label-only), Bazaar syndication toggle
5. **Publish preview** — How the listing will appear on each surface + per-portal validator report + final publish confirmation

---

## Explicit copy (English)

Fill Arabic strings during the MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

### Global chrome

| Slot | Copy |
|---|---|
| Wizard title (all steps) | List a new property |
| Wizard title (edit mode) | Edit listing |
| Step counter pattern | Step {n} of 5 |
| Autosave — idle | Saved {relative time} |
| Autosave — saving | Saving… |
| Autosave — success | Saved just now |
| Autosave — failed | Couldn't save — retry? |
| Back-with-unsaved dialog title | Discard this draft? |
| Back-with-unsaved dialog body | You haven't saved anything yet. Leaving now will discard what you've typed. |
| Back-with-unsaved keep | Keep editing |
| Back-with-unsaved discard | Discard draft |
| Save-and-exit CTA | Save draft & exit |
| Next CTA | Next → |
| Publish CTA (Step 5) | Publish → |
| Save-changes CTA (edit mode) | Save changes |
| WhatsApp alternative offer (fresh onboarding only, Step 1) | Prefer to talk it out? Use WhatsApp intake → |

### Step 1 — Basics

| Slot | Copy |
|---|---|
| Step title | The basics |
| Step sub | Type, purpose, where, how much. |
| Listing type label | I'm listing this for |
| Listing type options | Sale · Rent |
| Purpose label | Deal purpose |
| Purpose options | Primary residence · Investment · Off-plan · Commercial |
| Territory label | Country |
| Territory helper | This governs which disclosures are required (Trakheesi in UAE, Fal in KSA, none in Lebanon, etc.) |
| Area label | Area / neighborhood |
| Area placeholder | e.g. Dubai Marina, Hamra, New Cairo |
| Address label | Building or street (optional) |
| Address helper | Kept private from public listings unless you tick "Show exact address" below |
| Show address toggle | Show exact address on the public listing |
| Price label | Asking price |
| Price placeholder | e.g. 2,400,000 |
| Currency toggle | AED · SAR · EGP · LBP · USD |
| Price cadence (rent only) | per month · per year |

### Step 2 — Property details

| Slot | Copy |
|---|---|
| Step title | Property details |
| Step sub | The specs a buyer or tenant will ask about first. |
| Property type label | Property type |
| Property type options | Apartment · Villa · Townhouse · Duplex · Penthouse · Studio · Land · Office · Retail · Warehouse |
| Bedrooms label | Bedrooms |
| Bathrooms label | Bathrooms |
| Area label | Floor area |
| Area unit toggle | sqft · sqm |
| Year built label (optional) | Year built (optional) |
| Floor label (optional, non-land) | Floor number (optional) |
| Lot size label (villa / land only) | Lot / plot size (optional) |
| Features label | Features & amenities |
| Features helper | Tap all that apply — buyers filter by these. |
| Features chips (sample) | Pool · Gym · Parking · Balcony · Maid's room · Concierge · Sea view · City view · Furnished · Central A/C · Built-in wardrobes · Kitchen appliances · Study · Storage · Pet-friendly · Garden · Private pool · Rooftop terrace |

### Step 3 — Media

| Slot | Copy |
|---|---|
| Step title | Photos & video |
| Step sub | Great photos are the single biggest conversion lever. Add at least 3. |
| Upload zone primary | Drag photos here or tap to choose |
| Upload zone helper | JPG or PNG, up to 10 MB each. Min 3, max 30. |
| Photo minimum warning | Add at least {n} more to publish. |
| Hero label (on tile) | Hero |
| Set-hero action | Set as hero photo |
| Reorder helper (mobile) | Long-press a photo to drag it. |
| Reorder helper (desktop) | Drag photos to reorder. First photo is the hero. |
| Alt-text label (per photo) | Describe this photo (for accessibility) |
| Alt-text placeholder | e.g. Marina view from the living room at sunset |
| Alt-text missing warning | Adding a short description helps buyers with screen readers and improves SEO. |
| Video label | Add a video walkthrough (optional) |
| Video helper | Paste a YouTube or Vimeo URL, or upload MP4 up to 100 MB. |
| Tour 360 label | Add a 360° tour link (optional) |
| Tour 360 helper | Matterport, Kuula, or any 360 tour URL. |

### Step 4 — Contact & attribution

| Slot | Copy |
|---|---|
| Step title | Who owns this listing? |
| Step title (solo) | How should buyers reach you? |
| Step sub (agency) | Solo listings stay with you if you leave the agency. Agency-owned listings stay with the agency. |
| Step sub (solo) | Buyers will contact you through the channels you enable here. |
| Owner label (agency only) | This listing is |
| Owner option — agency | **Agency-owned** — belongs to {agency_name}. Stays with the agency if you leave. |
| Owner option — self | **My own** — belongs to me personally. Comes with me if I leave the agency. |
| Owner option — case-review | **Not sure yet** — flag for review with my agency. |
| Contact channels label | How can buyers reach you? |
| Contact channel options | WhatsApp · Call · SMS · Email · In-app message |
| Contact channel default helper | We recommend keeping at least WhatsApp on — MENA buyers overwhelmingly prefer it. |
| Visibility label | Who can see this listing? |
| Visibility — public | **Public** — appears on portals, Bazaar, and your public profile. |
| Visibility — private | **Private** — visible only to you. Useful for pocket listings and pre-market prep. |
| Visibility — white-label | **White-label only** — appears on your agency's white-label site + private profile, NOT on public portals or Bazaar. |
| Bazaar syndication toggle | Syndicate to Real Estate Bazaar |
| Bazaar syndication helper | Bazaar is our consumer marketplace. Turning this on adds one more channel where buyers find you — free while in beta. |

### Step 5 — Publish preview

| Slot | Copy |
|---|---|
| Step title | Last look before you publish |
| Step sub | Here's how this listing will appear everywhere it goes. |
| Surface toggle label | Preview as |
| Surface toggles | Agent profile · Agency profile · White-label · Bazaar · Bayut · Property Finder · Dubizzle · OLX · Aqar · Blue Door |
| Validator OK line | All checks passed for {portal}. |
| Validator warning line | {portal} may reject or hide this listing — {issue}. Fix now? |
| Validator jump-back link | Fix in Step {n} → |
| Publish confirmation modal title | Publish this listing? |
| Publish confirmation modal body | Once you publish, we'll queue it for {n} portals + your public profile. You can unpublish or edit anytime. |
| Publish confirmation cancel | Not yet |
| Publish confirmation confirm | Yes, publish |
| Publish-in-progress toast | Publishing to {n} channels… |
| Publish-success toast (routes to WF-03) | Published. Taking you to your dashboard. |
| Publish-failure toast | Some channels couldn't accept the listing. Let's fix them. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Wizard chrome | `<TourFrame>` from `web/src/components/onboarding/whatsapp/` (extracted for AGT-ONB — reuse) |
| Step transition | Custom `<StepSlider>` wrapping `framer-motion`'s `AnimatePresence` with horizontal slide direction |
| Progress dots | `<StepDots count={5} current={n} />` — matches `<TourFrame>` |
| Autosave indicator pill | Custom `<AutosaveIndicator status="idle" | "saving" | "saved" | "failed" ts={Date} />` |
| Field label + input pair | shadcn `<Label>` + `<Input>` / `<Textarea>` / `<Select>` |
| Currency / area-unit toggles | `<ToggleGroup type="single">` |
| Features multi-select chips | `<Toggle>` chips wrapped in a flex-wrap container |
| Territory picker | `<Select>` (loads from `GET /api/territories`) |
| Radio-group cards (visibility, owner) | `<RadioGroup>` styled per SHR-AUT-006 card model |
| Photo upload zone | Custom `<PhotoDropzone>` using `react-dropzone` + Capacitor camera bridge on mobile |
| Photo tile grid | Custom `<PhotoGrid>` using `@dnd-kit/sortable` for drag-reorder |
| Per-photo alt-text | `<Input>` beneath each tile |
| Video URL input | `<Input>` with paste-detection for YouTube/Vimeo shortlinks |
| Live preview card | `<ListingPreviewCard>` reused from AGT-LST-003 |
| Portal preview mode toggle | `<ToggleGroup type="single">` (Step 5) |
| Portal validator report | Custom `<ValidatorReport>` — one row per portal, expandable |
| Publish confirmation | `<Dialog>` |
| Discard-draft confirmation | `<Dialog>` |
| Back-with-unsaved | `<Dialog>` |
| Sticky bottom nav | Custom `<StickyStepNav>` — matches AGT-LST-003 sticky bottom bar |
| Toasts | `<Sonner>` |
| Skeleton (edit-mode hydration) | shadcn `<Skeleton>` |

Icons (`lucide-react`): `ChevronLeft`, `ChevronRight`, `Check`, `Cloud`, `CloudOff`, `AlertCircle`, `Camera`, `Upload`, `GripVertical`, `Star` (hero), `Play`, `Globe`, `Lock`, `Eye`, `EyeOff`, `Building2`, `User`, `MessageCircle`, `Phone`, `Mail`.

---

## Sample content (for v0 / mockup)

Render the mobile 375px Step 2 (Property details) with:

- Wizard chrome: 5 dots (dot 1 filled, dot 2 filled + current pulse, dots 3–5 outline), step counter "Step 2 of 5 · Property details", autosave pill "Saved just now" with green check
- H1: "Property details"
- Sub: "The specs a buyer or tenant will ask about first."
- Property type select: "Apartment" chosen
- Bedrooms input: 2 (mono, tabular-nums)
- Bathrooms input: 2 (mono, tabular-nums)
- Floor area: 1,200 with sqft/sqm toggle set to sqft
- Year built: blank, muted placeholder
- Floor number: 14
- Features chips: Pool, Gym, Parking, Concierge, Balcony, Sea view all selected (chips show `Check` prefix + orange fill); Maid's room, Furnished, City view unselected
- Live-preview peek strip at bottom shows: "Marina Gate 1 · 2 bed · 2 bath · 1,200 sqft · Apartment · AED 2,400,000"
- Sticky bottom nav: "Save draft & exit" (outline) + "Next →" (primary orange)

Follow-up passes:

1. Step 3 mobile — photo upload zone empty state + photo grid with 5 photos, drag-reorder cursor visible, hero ribbon on photo 1, alt-text field beneath photo 2 focused (empty warning showing).
2. Step 4 mobile — agency-context view showing the three owner cards (agency / self / not sure), self selected; contact-channel toggles below (WhatsApp on, Call on, SMS off, Email on).
3. Step 5 mobile — publish preview with Bayut portal selected showing a validator warning: "Add Trakheesi number to publish on Bayut UAE. Fix in Step 1 →".
4. Desktop 1440px — Step 2 with the right-column live preview visible on the right (~560px wide), preview scale toggle set to "mobile".
5. RTL Arabic Step 2 mobile — mirrored layout, `[TRANSLATION-PENDING]` in strings.
6. Dark mode Step 2 mobile.
7. Autosave failure state — the pill in red with `AlertCircle` + "Couldn't save — retry?" tap-target expanded.
8. Discard-draft dialog over Step 2.

---

## Interactions

**Step transitions:**
- Tap "Next →" → validates the current step client-side. If invalid, inline field errors + focus first invalid field. If valid, calls the autosave (PUT `/api/properties/:id` with `status: 'draft'`) BEFORE advancing. On network failure of the autosave, the transition proceeds anyway but the autosave indicator turns red and queues a retry (exponential backoff, 3 attempts).
- Tap "Back" (chrome arrow) on Step 2+ → advances backward, no autosave triggered (last save is still valid).
- Tap "Back" on Step 1 with any touched field → discard-draft dialog. On confirm-discard: `DELETE /api/properties/:id` if a draft row was created; then navigate to entry point (AGT-LST-001 or AGT-ONB-001).
- Deep link `?step=n` in edit mode: opens that step directly. In create mode: only opens steps whose prerequisite steps have been completed (otherwise redirects to the first incomplete step).

**Autosave triggers (in addition to step transitions):**
- 3 seconds of typing-idle in any field
- App backgrounding (Capacitor `App.addListener('appStateChange')`) or `visibilitychange` on web
- Explicit tap on the autosave indicator pill (retry)

**Step 3 media interactions:**
- Drag-reorder photos via `@dnd-kit`. Long-press to start drag on mobile; grip icon on desktop.
- First photo is hero by default. Tap the `Star` on any other tile to promote it to hero — the current hero swaps to that tile's position (not dropped).
- Delete a photo: tap the `X` overlay on hover/tap. Confirm inline (no dialog) with a 3-second Undo toast.
- Alt-text field is per-photo. Missing alt-text does not block publish but shows the a11y warning line beneath each affected tile at Step 5.

**Step 5 validator report:**
- Each portal row is expandable (`<Collapsible>`). Collapsed: portal channel-mark + count of warnings ("2 issues" in `--lc-status-warning-fg` OR "All checks passed" in `--lc-status-published-fg`).
- Expanded: list of per-portal checks, each with severity (block / warn / info), field name, expected, actual, and a "Fix in Step {n} →" jump link that returns the user to that step with the field pre-focused.
- Blocking issues prevent Publish (disable the Publish CTA + inline banner "Fix {n} blocking issues to publish").

**Publish flow:**
- Tap "Publish →" → confirmation dialog → confirm → PUT `/api/properties/:id` with `status: 'active'` → show "Publishing to {n} channels…" toast → server queues portal syndication (existing) → redirect to `/publish/outcome/:id` (AGT-PUB-005).
- On backend rejection: toast + return the user to the offending step with inline error.

**Edit mode:**
- Hydration on mount: `GET /api/properties/:id`. Show skeleton for 200ms max — if slower, keep skeleton until load. On error: full-screen `SHR-ERR-002` with retry.
- Bottom nav CTA reads "Save changes" instead of "Next →" ON THE LAST STEP the user visits. Intermediate step transitions still show "Next →" (the wizard is still linear for edit mode too — encourages a full review before saving).
- "Save draft & exit" is hidden in edit mode when the listing is already `status: 'active'` (there's no draft to save to — changes autosave to the live listing in place). Replaced by "Discard changes".

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **initial-new** | `/listings/new` fresh load | Step 1 rendered. All fields empty. No draft row yet. Autosave indicator hidden until first field touched. |
| **step-2 typing** | User on Step 2, mid-input | Field the user is in has focus ring. Live preview peek updates on debounce (300ms). Autosave indicator idle until 3s typing-idle. |
| **autosaving** | Autosave in flight | Autosave pill: `Cloud` icon + "Saving…" + `--lc-accent` dot pulse. Other UI unaffected. |
| **autosave-saved** | Autosave 200 | Pill: `Check` + "Saved just now". Fades to "Saved {relative time}" after 5s. |
| **autosave-failed** | Autosave 4xx / 5xx / network | Pill: `AlertCircle` red + "Couldn't save — retry?". Tap retries. Bottom-nav Next still works but the user sees the red pill; if they try to advance on unsaved state, we show an inline banner "This step hasn't saved. Continue anyway?" — proceed lets them advance; the next step's autosave will retry the accumulated payload. |
| **editing-existing** | `/listings/:id/edit` | Hydrated form. Autosave indicator immediately shows "Saved {relative time}" from last-modified timestamp. |
| **hydration-loading** | Edit-mode initial load | Skeleton wizard chrome + Step 1 skeleton fields. Bottom nav disabled. |
| **hydration-error** | Edit-mode GET failed | Full-screen SHR-ERR-002 with retry + back-to-list CTA. |
| **draft-saved-exit** | User tapped Save draft & exit | Toast "Draft saved. You can finish later from your listings.". Redirect to `/listings`. |
| **submitting-publish** | User tapped Publish → confirmed | Publish CTA shows Loader2 + "Publishing…". Entire wizard disabled. |
| **published** | Publish 200 | Signal-lamp pulse (200ms) on the CTA button + success toast "Published. Taking you to your dashboard." + redirect to `/publish/outcome/:id`. |
| **portal-validator-blocking** | Step 5 has ≥1 blocking issue | Publish CTA disabled + red-tinted. Inline banner top of step "Fix {n} blocking issues to publish". Each blocking row highlighted. |
| **portal-validator-warning** | Step 5 has warnings, no blockers | Publish CTA enabled. Yellow-tinted banner "This will publish with {n} warnings. Buyers on some portals may not see it." |
| **error-per-step (validation)** | Step Next tapped with invalid fields | Inline field errors + focus first invalid + prevent advance. |
| **error-per-step (server)** | Autosave or Publish 500 | Toast + retry option. Step content unchanged. |
| **offline** | Network offline | Top banner "You're offline. We'll save your changes when you reconnect." Autosave queued locally (localStorage). Publish disabled with tooltip. |
| **rtl-arabic** | Locale = ar | Whole wizard mirrors. Progress dots order reverses. Slide direction inverts. Numeric inputs stay LTR (prices, bedrooms, sqft). Currency + area unit toggles mirror. Live preview mirrors. |
| **dark-mode** | prefers-color-scheme dark | Tokens swap; upload dropzone dashed border uses dark-mode `--lc-border-strong`; preview card contrast preserved. |
| **agency-context** | User's active tenant is an agency | Step 4 shows owner card group. `agency_tied` default = true. Step 5 preview surface toggles include Agency profile + White-label surfaces. |
| **solo-context** | User's active tenant is personal | Step 4 collapses to contact preferences + visibility only (no owner cards). Step 5 preview surfaces exclude Agency profile + White-label. |

---

## Accessibility

- Every form control has a visible `<label>` (not placeholder-only). `htmlFor` bound.
- Step-to-step transitions announce the new step title via `aria-live="polite"` region ("Step 2 of 5, Property details, entered.").
- Progress dots are `role="progressbar"` with `aria-valuenow={currentStep}` `aria-valuemin={1}` `aria-valuemax={5}`.
- Sticky bottom nav is `role="navigation"` with `aria-label="Wizard navigation"`.
- Photo grid is keyboard-reorderable: `Space` picks up focused photo, arrow keys move it, `Space` drops. Announces via aria-live.
- Alt-text field per photo carries an inline helper linked via `aria-describedby`; missing alt is a warning, not blocking, but is announced via the same helper.
- Autosave indicator changes announce via `aria-live="polite"` ("Saved just now" / "Couldn't save, retry?").
- Validator report at Step 5 renders each portal row as `<details>` (or Radix `<Collapsible>` with proper aria-expanded).
- Discard-draft, back-with-unsaved, and publish-confirm dialogs trap focus + Escape closes + close-on-outside-click.
- 44px min tap target on every interactive element including toggle chips.
- No color-only status — every autosave state, validator severity, and required-field marker pairs color with a glyph + label.
- RTL: mirror direction is correct per Broadcast — text alignment flips, numeric inputs stay LTR.

---

## Anti-patterns (do not do these)

- ❌ Do NOT collapse the wizard into an accordion on desktop. The step model is what makes this screen approachable — a full-form on desktop is what AGT-LST-005 (Pro variant) is for. Keep them separate surfaces.
- ❌ Do NOT skip alt-text prompts. Alt-text isn't optional metadata — it's an accessibility guarantee. The warning stays until dismissed OR filled.
- ❌ Do NOT show a global "Publish" button on any step except Step 5. Publishing from the middle of the wizard bypasses the validator report and creates half-formed portal submissions.
- ❌ Do NOT autosave passwords, OTP fields, or any credential-shaped input. This wizard has none, but the autosave hook must whitelist listing fields explicitly, never `input[type="password"]`.
- ❌ Do NOT let the WhatsApp intake nudge appear once the agent has committed to typing. Show it only when `?source=onboarding` AND the agent has typed <20 chars total. Persistent nudging is condescending.
- ❌ Do NOT render portal previews as a generic "your listing" card. Bayut differs from PF differs from Dubizzle — the per-portal preview must reflect the actual rendered surface, or the validator is theatre.
- ❌ Do NOT throttle photo uploads server-side without surfacing progress. If BE-BLOCKER-X is that photo upload doesn't have a progress endpoint, use a client-side estimate (bytes-uploaded / total-bytes) and warn if the estimate stalls.
- ❌ Do NOT block Publish on missing alt-text alone. It is a strong warning, not a hard gate. Hard gates are: no photos below minimum (3), missing required territory disclosures, missing price, missing property type, blocking-severity portal validators.
- ❌ Do NOT let the "Bazaar syndication" toggle default OFF. Bazaar is our consumer surface — the honest default is ON for public listings, opt-out is the affordance for agents who want portal-only syndication.
- ❌ Do NOT round any card/tile to 12+ px. Broadcast is intentionally tight; use `var(--lc-radius-md/lg)`.
- ❌ Do NOT render numeric fields (price, beds, baths, sqft, floor, year) in the UI font. Every numeral wraps in `<Numeric>`.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Airbnb "List your place" wizard** — the definitive multi-step property intake; progress + save-and-exit + hero-photo affordances all align.
- **Notion's page-creation flow with live preview** — the split-view live preview model at Step 2+.
- **Stripe Atlas onboarding** — the honest per-jurisdiction disclosure prompting (Trakheesi/Fal per territory).
- **Linear's issue-creation flow** — the compact 5-step model applied to a complex domain object.
- **Figma's community "publish to Community" modal** — the per-surface publish preview (thumbnail + card + full page) is the exact pattern for Step 5.

Do NOT match:

- Zillow's Post-A-Listing (too US-suburban, too MLS-centric, wrong for MENA).
- Bayut's own agent portal (dense, unopinionated form — that's the surface we're replacing).
- Salesforce Lead-Create (heavy enterprise form UX — antithetical to Guided mode).

---

## Backend contract

**Endpoints (existing — see `backend/src/server.js`):**

- `POST /api/properties` — creates a listing row. Accepts `status: 'draft' | 'active'` (line 1717 defaults to `'active'`). Enforces `assertFreeTierListingAllowed` (PR #49). Validates required territory disclosure fields per `territory_disclosure_fields` (migration 003).
- `PUT /api/properties/:id` — updates fields on an existing listing. Same schema as create.
- `DELETE /api/properties/:id` — used on Step-1 Back-with-unsaved discard when a draft row was created.
- `GET /api/properties/:id` — hydration for edit mode.
- `GET /api/territories` — Territory picker options.
- `GET /api/territories/:id/disclosure-fields` — Per-territory required-field list for Step 1 validation (feeds the same server-side check).

**Autosave flow (piggybacks on existing endpoints):**

- First autosave in a fresh-new session → `POST /api/properties` with `status: 'draft'` + all Step-1 fields collected so far. Store the returned `id` in wizard state; from now on all further saves are PUTs.
- Subsequent autosaves → `PUT /api/properties/:id` with the delta (or full form state — server tolerates full PUTs).
- Explicit "Save draft & exit" → same PUT with `status: 'draft'` (redundant but explicit) + redirect.
- Final Publish → PUT with `status: 'active'` + trigger downstream portal-syndication pipeline (existing).

**Optional new endpoint (nice-to-have, not blocking):**

- `PATCH /api/properties/:id/draft` — a named alias for autosave semantics that could accept a partial payload without triggering the full `propertyUpdateSchema` validation used by PUT (which today may reject partial payloads for required-required fields). Today's PUT accepts partials because `propertyUpdateSchema` (see `backend/src/server.js:1786`) doesn't re-require every field — but if that changes, a dedicated draft endpoint becomes necessary. **File as `[BE-NICE-TO-HAVE-01]` in kickoff §5b if PUT partial-payload tolerance regresses.**

**Media upload:**

- Photos upload one-at-a-time via existing `POST /api/uploads/photos` (or the equivalent Capacitor-camera-bridge upload path — confirm the exact route during dispatch — grep for `uploads/photos` and `multer` in `backend/src/server.js`). Response returns a `{ url, id }` per photo. On successful upload, the wizard appends `{ url, alt_text }` to the local `media` array; the array is persisted on the next autosave.

**Publish call and downstream:**

- The Publish CTA triggers PUT with `status: 'active'`. Server-side portal syndication is orchestrated downstream (existing pipeline). The screen then routes to `/publish/outcome/:id` (AGT-PUB-005) which listens on the syndication event stream.

**No new backend blocker required for the wizard shell.** Optional `PATCH .../draft` is a naming-only improvement.

---

## Downstream implementation (Cursor prompt handoff notes)

- **New file:** `web/src/pages/ListingComposerPage.tsx` (route `/listings/new` + `/listings/:id/edit`).
- **Extract:** `web/src/components/listings/composer/` — with sub-components:
  - `ComposerShell.tsx` — wizard chrome, step routing, autosave hook
  - `StepBasics.tsx` — Step 1
  - `StepPropertyDetails.tsx` — Step 2
  - `StepMedia.tsx` — Step 3
  - `StepContactAttribution.tsx` — Step 4
  - `StepPublishPreview.tsx` — Step 5
  - `AutosaveIndicator.tsx`
  - `PhotoDropzone.tsx`
  - `PhotoGrid.tsx` (dnd-kit)
  - `PortalValidatorReport.tsx`
  - `PreviewSurfaceToggle.tsx` (Step 5)
- **Reuse:** `<TourFrame>`, `<StepDots>`, `<ListingPreviewCard>` (already extracted for AGT-ONB / AGT-LST-003).
- **Update:** `web/src/App.tsx` — replace or supplement the current `/listings/new` route to load `ListingComposerPage` in Guided mode; keep AGT-LST-005 (`?mode=pro`) as a Pro fallback.
- **Autosave hook:** `useAutosaveDraft(propertyId, formState)` in `web/src/hooks/`. Encapsulates the debounce, PUT, retry, and offline-queue logic.
- **Route guards:** on route-away with unsaved changes, use `useBlocker` from `react-router-dom` v6.4+ to intercept.
- **Test discipline:**
  - Unit: each Step component renders + transitions.
  - Integration: full wizard flow for Solo + Agency contexts × Sale + Rent × Ltr + Rtl (8 combos parameterized).
  - Autosave: simulate typing → 3s idle → assert PUT fires; simulate network fail → assert retry + red pill.
  - Photo grid: drag-reorder correctness, hero swap, alt-text-per-photo persistence.
  - Portal validator: mock BE-BLOCKER-17 validator responses (blocking / warn / clean) and assert publish gate.
  - Real-Postgres: a full happy-path create-then-publish flow with photo upload.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green. Use `<Numeric>` for every numeral.
- **RTL:** verified via `screens.rtl.test.tsx` extension with a Step-2 mobile scenario.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction the design AI + Cursor implementation MUST honor. Non-negotiable.

- Wizard chrome: `--lc-surface` bg + `--lc-elevation-sm` bottom edge on scroll only.
- Progress dots: filled `--lc-action-primary`; upcoming `--lc-border-strong`.
- Step title: `var(--lc-type-heading-1)`. Sub: `var(--lc-type-body-lg)` + `--lc-text-muted`. Step counter overline: `var(--lc-type-overline)` + `--lc-text-muted`.
- Field label: `var(--lc-type-body-sm)` + `--lc-text-secondary`. Required asterisk: `--lc-status-danger-fg`.
- Inputs: `--lc-surface-raised` + `--lc-border-strong` + `var(--lc-radius-md)`. Two-tone focus auto.
- Numeric values (price, beds, baths, sqft, floor, year): `<Numeric>` — mono + tabular-nums.
- Currency + area-unit toggles: `<ToggleGroup>` selected `--lc-action-primary` + `--lc-action-primary-text`; unselected `--lc-surface-sunken` + `--lc-text-secondary`.
- Feature chips: `<Toggle>` with `var(--lc-radius-pill)`. Selected `--lc-action-primary` + Check glyph.
- Photo dropzone: `2px dashed var(--lc-border-strong)` + `--lc-surface-sunken` bg; drag-hover swaps border to `--lc-action-primary` + bg to `--lc-surface-selected`.
- Hero ribbon on photo tile: `--lc-accent-bold` + `--lc-accent-bold-text` + `--lc-accent-bold-edge` boundary.
- Radio-group cards (visibility, owner): unselected `1px solid var(--lc-border)`; selected `2px solid var(--lc-action-primary)` + `--lc-surface-selected` bg.
- Autosave indicator: idle `--lc-text-muted`; saving `--lc-accent` dot pulse (`--lc-duration-slow`); saved `--lc-status-published-fg`; failed `--lc-status-unpublished-fg`.
- Sticky bottom nav: `--lc-surface` + `--lc-elevation-md` on scroll. Next/Publish primary orange, hover DARKENS.
- Publish moment (Step 5 CTA success): `--lc-easing-emphasis` press feedback + signal-lamp pulse (`--lc-accent-bold` on `--lc-action-primary`, 200ms). This is one of the authorized signal-lamp surfaces (alongside AGT-DSH-001 and the AGT-PUB-005 outcome).
- Motion: step transitions 240ms `--lc-easing-in-out` horizontal slide; conditional-field reveal 180ms `<Collapsible>`; hover 120ms; NO bounce.
- Radii: cards `var(--lc-radius-lg)`; inputs `var(--lc-radius-md)`; chips `var(--lc-radius-pill)`.
- Elevation: hard-edged offset, never blurred glow.
- Two-tone focus ring automatic; 44px tap floor automatic.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before the brief):

```
I'm designing the WingCaster manual listing composer (AGT-LST-004) — a 5-step guided wizard that's the FALLBACK when WhatsApp voice-memo intake isn't used. MENA real-estate B2B SaaS. Mobile 375px primary, tablet + desktop secondary. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind + framer-motion + dnd-kit. Broadcast design system — Archivo display, IBM Plex Sans body, IBM Plex Mono numerics, warm off-white surface, cobalt-navy text, broadcast-orange primary. Semantic tokens only (--lc-*), never raw hex.

First pass: render the mobile 375px Step 2 (Property details) with wizard chrome + step counter "Step 2 of 5", H1 "Property details", sub, property type "Apartment" selected, bedrooms 2, bathrooms 2, floor area 1200 sqft toggle, feature chips (Pool/Gym/Parking/Concierge/Balcony/Sea view selected), live-preview peek strip at bottom, sticky nav (Save draft & exit + Next →), autosave pill "Saved just now".

LTR English only for this pass — I'll ask for the other steps, RTL Arabic, tablet/desktop, dark mode, and state variants as separate follow-ups.

Follow the copy table in the brief exactly. Wrap every numeric value in <Numeric>. Do not fabricate portal names, agency names, or property addresses beyond the sample content.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:

1. `Now Step 3 mobile — media upload zone empty + photo grid with 5 photos + hero ribbon on photo 1 + alt-text field beneath photo 2 focused (empty warning showing).`
2. `Now Step 4 mobile (agency context) — three owner cards (agency / self / not sure), self selected; contact channels row; visibility radio cards.`
3. `Now Step 5 mobile — publish preview with Bayut selected showing validator warning "Add Trakheesi number to publish on Bayut UAE. Fix in Step 1 →".`
4. `Now desktop 1440px Step 2 with right-column live preview + preview-scale toggle "mobile".`
5. `Now RTL Arabic Step 2 mobile — mirrored layout, use [TRANSLATION-PENDING] for strings.`
6. `Now dark mode Step 2 mobile.`
7. `Now autosave failure state — red pill "Couldn't save — retry?" + Step 2 body underneath.`
8. `Now the discard-draft dialog open over Step 2.`

Save each output's JSX to `docs/design/mockups/v0-outputs/AGT-LST-004/` + screenshot to `docs/design/mockups/AGT-LST-004-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 8 iteration states (Step 2 mobile LTR light, Step 3, Step 4 agency, Step 5 with validator, desktop Step 2, RTL Step 2 mobile, dark Step 2 mobile, autosave-failure, discard-draft dialog).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/AGT-LST-004/`.
- [ ] Cursor Wave-8 dispatch prompt references this brief + the mockup paths + the `useAutosaveDraft` hook contract.
- [ ] Any Cursor implementation lands `no-raw-hex.test.ts` green, `<Numeric>` wrapping all numerics, and RTL scenario test extended.
- [ ] Portal validator integration blocked on BE-BLOCKER-17 (per-portal validator modules) — dispatch coordinates timing with BE-BLOCKER-17.
- [ ] Autosave semantics decision recorded: piggybacks on existing PUT `/api/properties/:id` with `status: 'draft'`. `[BE-NICE-TO-HAVE-01]` (dedicated `PATCH .../draft` alias) filed in kickoff §5b for the day PUT partial-payload tolerance regresses.
