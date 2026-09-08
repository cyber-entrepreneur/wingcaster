# Screen Brief — AGT-ONB-001 · Onboarding Welcome (3-intake-path picker)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §1 entry `AGT-ONB-001`. **Family anchor** for AGT-ONB-002/003/004/005 — those four deltas reference the Broadcast callouts, component palette, and copy conventions established here. Wave 4 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5 row 20 + §6 Week 4. Bundled in a single PR with all four deltas.

Upstream: `SHR-AUT-006` signup success (path=solo) redirects here.
Downstream: user picks an intake path → `AGT-ONB-002` (WhatsApp) / `AGT-LST-004` (manual wizard) / `AGT-SYN-002` (spreadsheet import).

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens.

**Screen-specific Broadcast callouts (referenced by AGT-ONB-002/003/004/005 as "anchor callouts"):**

- **A1 · Hero greeting** ("Welcome to WingCaster, Sara"): `font: var(--lc-type-display)` — Archivo 800, 32/38 desktop. Mobile drops to `var(--lc-type-heading-1)` (26/32) with the first-name still on its own line for weight. Color `--lc-text-heading`.
- **A2 · Hero sub-line** ("Let's get your first listing on WhatsApp — under 3 minutes."): `var(--lc-type-body-lg)` + `--lc-text-secondary`. Never marketing puffery, always a time-to-value promise.
- **A3 · Intake-path card grid.** Three large cards. Desktop: 3-col grid, each ~320px wide × 260px tall. Mobile: 3-row stack, full-width, ~144px tall. Card surface `--lc-surface-raised` + `--lc-elevation-sm`. Radius `--lc-radius-lg` (7px — tight). Unselected border `1px solid var(--lc-border)`; hover `var(--lc-border-strong)`; selected/focused `2px solid var(--lc-action-primary)` + inner background tint via `--lc-surface-sunken`. Each card is a `<RadioGroupItem>` under the hood so keyboard nav works.
- **A4 · Recommended-path badge.** The WhatsApp card carries a small "Recommended · fastest to your first listing" caption `--lc-type-caption` + `--lc-text-brand` (broadcast orange), positioned top-right inside the card. Never render two "recommended" badges at once.
- **A5 · Card icon.** 32px in a 48×48 tinted well. WhatsApp card uses `<ChannelMark channel="whatsapp">` (pairs `--lc-channel-whatsapp` with `--lc-channel-whatsapp-on`, 20-28px only inside the well); Manual card uses `Edit3` from lucide inside a `--lc-surface-sunken` well with `--lc-text-heading` ink; Import card uses `Sheet` (spreadsheet) icon in the same well style. Never resize a channel-mark beyond 28px — enlarge the well, not the mark.
- **A6 · Primary CTA on selected card.** "Get started →" fills `--lc-action-primary`; hover `--lc-action-primary-hover` (darker). Text `--lc-action-primary-text`. Full 44px min-height. Focus ring two-tone (base CSS).
- **A7 · Skip link** ("Skip for now, take me to the dashboard"): `var(--lc-type-body-sm)` `--lc-text-muted`, underline-on-hover. Positioned bottom-right below the card grid on desktop, centered below on mobile. Skipping still writes `onboarding_state.step = 'welcome_skipped'` server-side so AGT-ONB-005 can nudge later.
- **A8 · Language selector** (embedded `SHR-NAV-006`): top-right, pill `--lc-surface-sunken` + `--lc-text-primary`.
- **A9 · Progress marker** ("Step 1 of 4 · Welcome"): top-left, `var(--lc-type-overline)` + `--lc-text-muted`. This same marker appears on -002/003/004 with the step number incremented.
- **A10 · Focus ring** always the base-CSS two-tone (`--lc-focus-ring` + `--lc-focus-ring-contrast`). Do NOT override per card or per button.
- **A11 · Motion.** Card selection state flip `var(--lc-duration-fast)` (120ms). Path-picked → route transition to next screen `var(--lc-duration-deliberate)` (320ms) `var(--lc-easing-out)`. Reduced-motion swaps to `var(--lc-duration-instant)`.
- **A12 · MENA hero illustration.** No Western stock imagery per matrix note. Illustration slot lives right of the card grid on desktop (400×480), collapses to a 200px top-block on mobile. Fallback: gradient-only using `--lc-brand-hero-gradient` tokens with WingCaster logomark centered.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ONB-001 |
| Screen name | Onboarding — Welcome (3-intake-path picker) |
| Persona | Agent, authenticated, `onboarding_state IS NULL` OR `onboarding_state.step IN ('welcome', 'welcome_skipped')` |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/onboarding/welcome` (also served at `/onboarding` — root redirects to `/welcome`) |
| Current state | MISSING. Signup currently dumps to `/dashboard`. This brief creates the first onboarding surface. |
| Workflow role | WF-01 (Onboarding) initiator — branches to WF-03 (WhatsApp intake) if user picks WhatsApp path |
| Backend prerequisites | ✅ `POST /api/auth/whatsapp/activation-code` (PR #50) · ✅ `GET /api/auth/whatsapp/binding-status` (PR #50) · ⏳ `GET/PATCH /api/user/onboarding-state` (NEW — see §Backend contract) · ✅ Draft pipeline endpoints (`/api/agent/whatsapp-listings/drafts/*`) |
| Family role | **ANCHOR** — AGT-ONB-002/003/004/005 reference Broadcast callouts A1-A12 by ID |
| PR bundle | Ships all five AGT-ONB briefs in one PR per D4 |

---

## Purpose

The just-signed-up agent lands here. Sets the "why WingCaster" moment in the first paragraph they read and forces one active decision — how do they want to get their first listing into the system.

Three intake paths, in on-brand priority order:

1. **WhatsApp** — send photos + a voice memo to WingCaster's shared Business number, we draft the listing (uses PR #50 Model B activation-code binding). Recommended for speed and for agents who already do most of their work on WhatsApp.
2. **Manual** — step-by-step guided wizard (`AGT-LST-004`) for agents who want to type everything themselves.
3. **Import** — upload a spreadsheet (CSV/XLSX) with existing inventory (`AGT-SYN-002` equivalent). Recommended for agencies moving from another CRM.

Success outcome: `onboarding_state.step` advances from `welcome` → `whatsapp_intake_pending | manual_wizard | import_pending`, and the user is routed to the picked screen. Skipping still records `welcome_skipped` so AGT-ONB-005 can nudge the user back later.

---

## Design goals

1. **One decision, three cards, no scroll on 375px.** Agent must not have to think about anything else. Path picker is the only interactive element besides the skip link and language selector.
2. **First-value promise in the hero sub.** "Under 3 minutes" is the anchor — every downstream screen (-002/003/004) reinforces this by showing progress toward the moment the listing is live.
3. **WhatsApp path is soft-recommended, not forced.** MENA agents already live on WhatsApp; the Recommended badge nudges without pretending the other paths are inferior.
4. **Skip is a first-class citizen.** An agent already knows the product? They can escape to the dashboard without judgment. The onboarding checklist (AGT-ONB-005) picks up the slack.
5. **MENA-first illustration.** Warm palette, MENA cityscape hint, real WhatsApp glyph — no Western stock office imagery.
6. **RTL Arabic mirrors 1:1.** The Recommended badge stays inside the card corner (visually top-right in LTR, top-left in RTL). Channel-mark stays LTR (WhatsApp logo doesn't mirror).

---

## Layout

### Desktop / tablet ≥768px

Two-column split, 60/40:

**Left column (60%) — decision area:**
- Top bar: progress marker `Step 1 of 4 · Welcome` (left) · language selector (right).
- Hero heading (A1): `Welcome to WingCaster, {firstName}` — first name pulled from `req.user.name`. If missing, fallback: `Welcome to WingCaster`.
- Sub (A2): `Let's get your first listing on WhatsApp — under 3 minutes.`
- Section label (A9-adjacent, tiny): `How would you like to start?` — `var(--lc-type-overline)` `--lc-text-muted`.
- Path card grid — 3 cards horizontal, each ~320×260.
- Below grid: skip link (A7), right-aligned on desktop, centered on mobile.

**Right column (40%) — hero panel:**
- Full-height illustration slot (A12).
- Bottom of panel: small rotating value-prop line, one of:
  - "Draft listings from a voice memo."
  - "Publish once, syndicate everywhere."
  - "Every inquiry, one inbox."
- Below the rotator: anonymized 5-avatar cluster + caption `Joining {agentCount}+ MENA agents on WingCaster` — `agentCount` from `GET /api/marketing/agent-count` rounded down to nearest 100 (fallback: hide the caption if endpoint fails — never fabricate).

### Mobile ≤767px

Single column, no horizontal scroll:

- Top bar: progress marker (left) · language pill + `<ColorModeToggle>` (right).
- Compact hero: 200px illustration collapsed to a top block with `--lc-brand-hero-gradient` background.
- Hero heading (A1) drops to `var(--lc-type-heading-1)`; first name on its own line so the greeting still lands as a person-to-person moment.
- Sub (A2) unchanged.
- Section label.
- Path card stack — 3 rows, each full-width, ~144px tall.
- Skip link centered below the stack.
- Value-prop rotator + agent-count caption pinned above the safe-area bottom.

### Path-card anatomy (all viewports) — used by A5/A6

Each of the 3 cards contains, top-to-bottom:
- **Icon well** (48×48 tinted): channel-mark or lucide icon per A5.
- **Card label** (bold, `var(--lc-type-heading-3)`): "WhatsApp voice memo" / "Add manually" / "Import a spreadsheet".
- **One-line description** (`var(--lc-type-body-sm)`, `--lc-text-secondary`).
- **Time-to-value line** (`var(--lc-type-caption)`, `--lc-text-muted`): "~2 min" / "~5 min" / "Depends on file size".
- **Recommended badge** (A4) — WhatsApp card only.
- **Card-level CTA** (A6): "Get started →" — appears only on the selected card; the other two cards show `<Sparkles>` outline hover-cue only.

Selection model: single-select radio group. Enter/Space activates the currently focused card. Arrow keys move focus among cards.

---

## Explicit copy (English — Arabic mirror pending MENA copywriter pass)

| Slot | Copy |
|---|---|
| Progress marker | Step 1 of 4 · Welcome |
| H1 (Latin has name) | Welcome to WingCaster, {firstName} |
| H1 (name missing) | Welcome to WingCaster |
| Sub | Let's get your first listing on WhatsApp — under 3 minutes. |
| Section label | How would you like to start? |
| Card 1 label | WhatsApp voice memo |
| Card 1 description | Send photos + a voice note to our WhatsApp. We draft the listing for you. |
| Card 1 time-to-value | ~2 min |
| Card 1 recommended badge | Recommended · fastest to your first listing |
| Card 2 label | Add manually |
| Card 2 description | Step-by-step wizard. You type; we help. |
| Card 2 time-to-value | ~5 min |
| Card 3 label | Import a spreadsheet |
| Card 3 description | Upload existing inventory as CSV or Excel. We'll map the columns. |
| Card 3 time-to-value | Depends on file size |
| Card CTA (selected) | Get started → |
| Skip link | Skip for now, take me to the dashboard |
| Value prop 1 | Draft listings from a voice memo. |
| Value prop 2 | Publish once, syndicate everywhere. |
| Value prop 3 | Every inquiry, one inbox. |
| Agent-count caption | Joining {agentCount}+ MENA agents on WingCaster |
| Error toast — save state | We couldn't save your choice. Try again? |
| Offline banner | You're offline. Reconnect to continue setup — your progress is saved. |

**Voice rules** (inherited by -002/003/004/005):
- Second person, warm, no exclamations except celebration screen (-004).
- No jargon: never "SKU", "onboarding funnel", "activation event".
- Time promises must be truthful — under 3 minutes is a spec target, not marketing.
- Never fabricate agent counts, agency names, or testimonials.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Path card grid | `RadioGroup` + `RadioGroupItem` styled as cards |
| Card icon well | `<div>` with tinted background — WhatsApp uses `<ChannelMark channel="whatsapp">`; others use `Edit3` / `Sheet` from lucide |
| Recommended badge | `<Badge variant="outline">` with `--lc-text-brand` ink |
| Card CTA | `<Button>` variant="default" size="lg" — shown only on selected card |
| Skip link | `<Button variant="link">` |
| Progress marker | Custom `<OnboardingProgressMarker>` — see §Shared components |
| Language selector | Embedded `SHR-NAV-006` |
| Color mode toggle | `<ColorModeToggle>` |
| Hero illustration | `<img loading="eager">` with `alt="MENA agent listing a property on WhatsApp"` |
| Value-prop rotator | Custom `<RotatingCaption>` — 4s per line, respects `prefers-reduced-motion` (freezes on first) |
| Error toast | `<Sonner>` destructive variant |
| Offline banner | Custom `<OfflineBanner>` reused across all onboarding screens |

Icons: `lucide-react` for Edit3, Sheet, Sparkles, ArrowRight. Official WhatsApp glyph SVG (NOT lucide's `MessageCircle`) for the WhatsApp channel-mark.

---

## Sample content (for v0 / mockup)

Show the desktop layout with:
- **User:** first name "Sara"
- **Progress:** "Step 1 of 4 · Welcome"
- **Path selected:** "WhatsApp voice memo" card (Recommended badge visible, CTA "Get started →" enabled)
- **Card 2 + 3:** unselected, hover state neutral
- **Hero panel:** illustration placeholder "MENA agent listing — 400×480" with `--lc-brand-hero-gradient` behind
- **Rotator:** currently showing "Draft listings from a voice memo."
- **Agent-count caption:** "Joining 2,400+ MENA agents on WingCaster"
- **Skip link:** visible bottom-right
- **Language:** EN, Light mode

---

## Interactions

**On page load:**
- Fetch `GET /api/user/onboarding-state`. If `step === 'complete'`, redirect to `/dashboard` (user reached this URL directly after finishing).
- If `step IN ('whatsapp_intake_pending', 'draft_review', 'first_published')`, resume at the corresponding screen (-002/003/004).
- Otherwise render this welcome screen and set focus on the first card.

**On card focus/hover:**
- Card gets `--lc-border-strong` border (unselected) or stays `--lc-action-primary` (selected).
- Time-to-value line color intensifies from `--lc-text-muted` to `--lc-text-secondary`.

**On card selection:**
- Selected state instant (120ms).
- CTA "Get started →" appears on selected card only; other two lose their CTA. No layout shift — CTA slot is always reserved (opacity 0 when unselected).

**On CTA click:**
- Client-side: PATCH `/api/user/onboarding-state` with `{ step: 'whatsapp_intake_pending' | 'manual_wizard' | 'import_pending', path: 'whatsapp' | 'manual' | 'import' }`.
- On 200: navigate to `/onboarding/whatsapp` (AGT-ONB-002) OR `/listings/new` (AGT-LST-004) OR `/imports/new` per path.
- On error: destructive toast, CTA re-enables.

**On skip link click:**
- PATCH `/api/user/onboarding-state` with `{ step: 'welcome_skipped', path: null }`.
- Navigate to `/dashboard`. The dashboard renders AGT-ONB-005 checklist since `welcome_skipped` is < 100% complete.

**On language toggle:**
- Instant locale switch. `<html lang>` + `<html dir>` update. Preserve selected card + progress marker. No confirmation.

**On offline:**
- Banner appears at top. Card CTAs disable. Skip link stays enabled but queues the state write.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial** | First load, no path picked | Cards rendered, none selected. No CTA visible. Skip link enabled. |
| **Path selected** | Card picked | Selected card gets Broadcast selected style + CTA. |
| **Submitting** | CTA clicked, PATCH in flight | CTA shows `Loader2` + "Saving…". Cards disabled. |
| **Route transition** | PATCH succeeded | Card grid fades out `var(--lc-duration-deliberate)` while the next screen fades in. Progress marker updates to "Step 2 of 4 …" on the next screen. |
| **Error — state save** | PATCH 500 | Destructive toast: "We couldn't save your choice. Try again?" CTA re-enables. |
| **Loading — initial fetch** | `GET /api/user/onboarding-state` in flight | Skeleton grid (3 cards silhouette) + skeleton hero panel. |
| **Loading — resumed state** | User resumes at -002/003/004 | This screen never renders; router redirects immediately. |
| **Skipped** | Skip link clicked | Immediate PATCH + redirect; toast on dashboard: "No rush — your setup steps live in the top-right menu." |
| **Offline** | Network unreachable | Banner. CTAs disabled; skip queued (writes when back online). |
| **RTL Arabic** | Locale = ar | Layout mirrors. Recommended badge repositions to top-left. WhatsApp glyph stays LTR. Hero illustration mirrors OR uses a symmetrical variant. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap automatically. Hero gradient stays warm; the WhatsApp channel-mark polarity flips per token kit. |
| **Missing name** | `req.user.name` null | Fallback H1 "Welcome to WingCaster" — never render "Welcome, undefined". |
| **Empty agent count** | `/api/marketing/agent-count` fails | Hide the caption; never fabricate a number. |

---

## Accessibility

- Focus order: language selector → color mode toggle → card 1 → card 2 → card 3 → (CTA on selected card) → skip link.
- Card radio group: `role="radiogroup"` with an accessible name from the section label; each card `role="radio"` with `aria-checked`.
- Arrow keys move focus within the group (Left/Right on desktop, Up/Down on mobile stack).
- Enter/Space selects a card.
- CTA has `aria-describedby` pointing to the card's description text so a screen reader announces "Get started; WhatsApp voice memo; send photos and a voice note…" as one flow.
- Skip link has visible focus ring and no `aria-hidden` — it's a real navigation target.
- Progress marker uses `aria-current="step"` on the active step number.
- Illustration `alt` describes function ("MENA agent listing a property on WhatsApp"), not aesthetic details.
- Every tap target ≥ 44×44 CSS pixels including cards (cards are 260px tall on desktop, 144px on mobile — comfortably above the floor).
- Reduced-motion: value-prop rotator freezes on first line; route transition drops from 320ms to instant.
- Language switch announces via `aria-live="polite"` ("Language changed to Arabic.").

---

## Anti-patterns (do NOT do)

- ❌ Do NOT show more than 3 intake paths. If a 4th path is added later, replace one of the existing three — cognitive overload is the failure mode.
- ❌ Do NOT auto-select the WhatsApp card on load. The user must actively decide. Recommended badge is guidance, not a default.
- ❌ Do NOT hide the skip link on mobile. Users who reached this screen twice will look for it.
- ❌ Do NOT use `MessageCircle` from lucide for WhatsApp. Use the official WhatsApp SVG in the `<ChannelMark>`.
- ❌ Do NOT fabricate agent counts or testimonials in the hero panel (honesty guardrail). If `/api/marketing/agent-count` fails, hide the caption.
- ❌ Do NOT use exclamation marks in this screen's copy. Save the celebration voice for AGT-ONB-004.
- ❌ Do NOT round cards to 12px+. Broadcast is intentionally tight — `--lc-radius-lg` (7px).
- ❌ Do NOT lighten the CTA hover — Broadcast rule: hover DARKER (`--lc-action-primary-hover`).
- ❌ Do NOT use Western real-estate stock imagery in the hero panel (matrix note). MENA-appropriate or gradient-only.
- ❌ Do NOT block the user if `/api/user/onboarding-state` errors on read — fall through to rendering the welcome screen with a soft warning banner ("We couldn't check your progress. Continue anyway?").

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Linear onboarding "Personal / Team" picker** — the two-card radio pattern.
- **Notion onboarding** — hero + rotating value props on the right.
- **Superhuman onboarding** — "under 30 seconds" time-to-value promise on the hero sub.
- **Airbnb Host first-listing** — path-picker card anatomy with time-to-value line.

Do NOT match:
- Salesforce onboarding (too many fields on step 1).
- Any generic SaaS onboarding that renders a video autoplay in the hero (bandwidth-hostile on MENA mobile).

---

## Backend contract

### Read state on load

**Endpoint:** `GET /api/user/onboarding-state` (NEW — must ship with this brief)

**Response 200:**
```json
{
  "user_id": "usr_...",
  "step": "welcome" | "welcome_skipped" | "whatsapp_intake_pending" | "manual_wizard" | "import_pending" | "draft_review" | "first_published" | "complete",
  "path": "whatsapp" | "manual" | "import" | null,
  "started_at": "2026-09-07T10:00:00.000Z",
  "updated_at": "2026-09-07T10:00:00.000Z",
  "completed_at": null,
  "checklist": {
    "welcome_seen": true,
    "first_listing_drafted": false,
    "first_listing_published": false,
    "channels_connected": false,
    "notifications_enabled": false,
    "profile_completed": false
  }
}
```

**Response 404** (first-time — no row yet): return the same shape with `step="welcome"`, `path=null`, all checklist flags `false`. Do NOT force clients to handle 404 as an error.

### Write state on CTA / skip

**Endpoint:** `PATCH /api/user/onboarding-state` (NEW)

**Request body:**
```json
{
  "step": "whatsapp_intake_pending" | "manual_wizard" | "import_pending" | "welcome_skipped",
  "path": "whatsapp" | "manual" | "import" | null,
  "checklist_delta": { "welcome_seen": true }
}
```

**Response 200:** the full updated state shape (same as GET).

**Response 409** (illegal transition, e.g. going backwards from `first_published` to `welcome`): `{ "error": "INVALID_TRANSITION", "current_step": "..." }` — client should silently drop the write and treat the user as fully onboarded.

**Response 500:** destructive toast, no state change.

### Schema (new — migration required)

```sql
CREATE TABLE agent_onboarding_state (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  step          TEXT NOT NULL DEFAULT 'welcome',
  path          TEXT,
  checklist     JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX agent_onboarding_state_step_idx ON agent_onboarding_state (step);
```

File as `[BE-NEW-06] agent_onboarding_state table + read/write endpoints` in the kickoff doc §5a.

### Existing endpoints reused by the family

Verified against `backend/src/modules/whatsapp-listings/binding/routes.js` and `.../interface/agent-routes.js` (PR #50):

- `POST /api/auth/whatsapp/activation-code` → `{ display_code, shared_number_e164, expires_at }` — used by AGT-ONB-002.
- `GET /api/auth/whatsapp/binding-status` → poll-target for AGT-ONB-002.
- `GET /api/auth/whatsapp/bindings` → list active bindings.
- `GET /api/agent/whatsapp-listings/drafts` + `GET .../drafts/:id` → poll + fetch for AGT-ONB-002/003.
- `POST /api/agent/whatsapp-listings/drafts/:id/approve` → fires WF-03 publish, used by AGT-ONB-003.
- `POST /api/agent/whatsapp-listings/drafts/:id/discard` and `.../reprocess` → discard / edit paths in -003.

**Gap** (family-level, not blocking): no aggregate `GET /api/user/onboarding-progress` endpoint that returns "what step + how many checklist items done"; AGT-ONB-005 currently has to compose the state from `GET /api/user/onboarding-state` + individual channel/notification/profile queries. Filed as `[BE-NICE-01]` — a v1.1 nicety, not a v1 blocker.

---

## Downstream implementation (Cursor prompt handoff notes)

### File creation

- **New route:** `web/src/pages/onboarding/WelcomePage.tsx` (this brief).
- **Route registration:** `web/src/App.tsx` — add `/onboarding/welcome` and root `/onboarding` → welcome redirect. Guard with `useOnboardingState()` hook so already-onboarded users bounce to `/dashboard`.
- **Sibling routes** (shipped by delta briefs): `/onboarding/whatsapp` (-002), `/onboarding/first-listing/:draftId` (-003), `/onboarding/first-listing/published` (-004). AGT-ONB-005 is a widget embedded in `AgentDashboardPage.tsx`, not a standalone route.

### Shared components (extracted for family reuse — MUST live in `web/src/components/onboarding/`)

The following components are used by 2+ of AGT-ONB-001/002/003/004/005 and must be extracted up-front, not inlined:

1. **`<OnboardingProgressMarker step={1|2|3|4} of={4} label="…" />`** — the top-left `Step X of 4 · …` marker. Used by 001, 002, 003, 004.
2. **`<IntakePathCard variant="whatsapp"|"manual"|"import" selected onSelect />`** — the path card used by 001 and re-used in 004's "next actions" (channel connect / invite team / set price alerts).
3. **`<ActivationCodeBanner code shared_number expires_at status onCopy onCheckAgain />`** — the big code + shared-number card. Used by 002 and by AGT-SET-004 (settings → WhatsApp intake re-bind).
4. **`<DraftListingPreview draftId />`** — read-only draft render used by 003; re-used by AGT-WLA-002 (recurring version outside onboarding).
5. **`<CelebrationHero title body illustration onNext />`** — the confetti + hero used by 004; re-usable for other "first-X" moments (first inquiry, first close).
6. **`<OnboardingChecklistCard state onDismissForever />`** — the 5-item persistent checklist used by 005 (embedded in dashboard).
7. **`<OfflineBanner />`** — the offline state banner. Used by every onboarding screen.
8. **`<useOnboardingState()`** hook** — SWR-backed hook exposing `{ state, patch, isLoading, isError }`. Used by all five screens + AGT-DSH-001 (to know whether to render the checklist).

### Test discipline

- Unit: WelcomePage renders 3 cards, first card is WhatsApp + Recommended badge, CTA appears on selection only.
- Integration: full flow tests for each path (welcome → -002/003/004 for WhatsApp; welcome → AGT-LST-004 for manual; welcome → import for import; welcome → dashboard for skip).
- State-machine tests: PATCH transitions honored, illegal transitions return 409.
- RTL: `screens.rtl.test.tsx` extension covering Arabic layout mirror + WhatsApp glyph LTR retention.
- Broadcast tokens: `no-raw-hex.test.ts` stays green.
- a11y: axe-core smoke test on the welcome screen + keyboard nav test (Arrow → Enter → route change).

### Behavior contracts

- `useOnboardingState()` MUST be resilient to 404 on first fetch — return `step: 'welcome'` and let the screen render.
- Route transition uses `<motion.div>` with `--lc-duration-deliberate` unless `prefers-reduced-motion: reduce` — then instant.
- WhatsApp channel-mark is the ONLY channel-mark on this screen. Do not add Instagram / Facebook / Messenger marks to the hero — that's AGT-ONB-004's job.
- Language toggle preserves selection state (persist to `sessionStorage` between locale swaps so the user doesn't lose the WhatsApp pick mid-decision).

---

## Broadcast alignment callouts summary

Every callout below is Broadcast-token-specific and non-negotiable. **Deltas -002/003/004/005 reference these by ID (A1-A12).**

- A1 hero heading — `--lc-type-display` desktop, `--lc-type-heading-1` mobile.
- A2 hero sub — `--lc-type-body-lg` + `--lc-text-secondary`.
- A3 intake-path cards — `--lc-surface-raised` + `--lc-elevation-sm`; selected `2px --lc-action-primary` + `--lc-surface-sunken` tint; radius `--lc-radius-lg`.
- A4 recommended badge — `--lc-type-caption` + `--lc-text-brand`.
- A5 card icon well — 48×48 tinted well; WhatsApp uses `<ChannelMark>`.
- A6 primary CTA — `--lc-action-primary` fill, hover DARKER.
- A7 skip link — `--lc-text-muted` + underline-on-hover.
- A8 language selector — embedded `SHR-NAV-006`.
- A9 progress marker — `--lc-type-overline` + `--lc-text-muted`.
- A10 focus ring — base-CSS two-tone, NEVER overridden.
- A11 motion — 120ms card flip / 320ms route change; reduced-motion → instant.
- A12 MENA hero illustration — no Western stock; gradient fallback with logomark.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster agent onboarding welcome screen (AGT-ONB-001) —
MENA real-estate B2B SaaS. It's the anchor of a 5-screen family (AGT-ONB-001
through 005) — every downstream brief references this one's Broadcast callouts.
Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind + Broadcast
theme (--lc-* tokens; no raw hex).

First pass: render the desktop 1440px layout with the first-name "Sara",
progress marker "Step 1 of 4 · Welcome", WhatsApp voice-memo card selected
(with the "Recommended · fastest to your first listing" badge and the
"Get started →" CTA), the other two cards unselected, hero illustration
placeholder on the right with gradient background and rotator showing
"Draft listings from a voice memo.", agent-count caption showing
"Joining 2,400+ MENA agents on WingCaster.", skip link visible bottom-right.

LTR English light mode only for this pass — I'll ask for RTL Arabic,
mobile 375px, dark mode, offline state, and the resumed-state routing
short-circuit as separate follow-ups.

Follow the copy table exactly. Do NOT fabricate agent counts or testimonials.
Do NOT use lucide's MessageCircle for WhatsApp — use the official WhatsApp SVG
inside the <ChannelMark channel="whatsapp"> component.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now the mobile 375px layout — 3-row card stack, compact hero, same selection state.`
2. `Now RTL Arabic desktop — mirror everything except the WhatsApp glyph. Copy strings in Arabic where the table has them, [TRANSLATION-PENDING] otherwise.`
3. `Now dark mode versions of desktop LTR and mobile LTR.`
4. `Now the "no card selected" initial state — no CTA visible on any card.`
5. `Now the offline banner state — banner at top, CTAs disabled.`

Save each output's JSX to `docs/design/mockups/v0-outputs/AGT-ONB-001/` and screenshots to `docs/design/mockups/AGT-ONB-001-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 5 iteration states (desktop-LTR-light, mobile-LTR-light, RTL-desktop, dark-mode, offline).
- [ ] Screenshots committed under `docs/design/mockups/AGT-ONB-001-*.png`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/AGT-ONB-001/`.
- [ ] Shared components extracted at `web/src/components/onboarding/` per §Downstream.
- [ ] `[BE-NEW-06]` filed in kickoff §5a — `agent_onboarding_state` table + GET/PATCH endpoints.
- [ ] `useOnboardingState()` hook implemented + used by AGT-ONB-002/003/004/005 in the same PR.
- [ ] `no-raw-hex.test.ts`, `screens.rtl.test.tsx`, and a11y smoke tests pass.
- [ ] AGT-ONB-002/003/004/005 briefs cross-reference this brief's A1-A12 callouts without redefining them.
