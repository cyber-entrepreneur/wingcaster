# Screen Brief — AGT-ACT-001 · Activation wizard — Welcome (5-step overview)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI). ANCHOR for the AGT-ACT-* family.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-ACT-001` (row 54 in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5). Wave-4 Phase-1 add-on per Rev 8 (2026-09-06). This anchor governs AGT-ACT-002/003/004/005 — deltas inherit every callout below unless they explicitly override.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Semantic `--lc-*` tokens only. No raw hex.

**Screen-specific Broadcast callouts:**
- Hero heading ("Unlock every WingCaster feature"): `var(--lc-type-display)` — Archivo 800 32/38. Sub: `var(--lc-type-body-lg)`, `--lc-text-muted`.
- **Overall progress bar** (0/5 → 5/5): sits directly under the H1. Track `--lc-surface-sunken`, fill `--lc-action-primary`, height 6px, radius `--lc-radius-pill`. The `X of 5 complete` label uses `<Numeric>` for both numerals, `var(--lc-type-caption)`, `--lc-text-muted`.
- **Step-card grid** (5 cards, 3-up on desktop / 2-up on tablet / 1-up on mobile): each card = `--lc-surface-raised` + `--lc-elevation-sm` + `--lc-radius-lg` (7px). Border `1px solid var(--lc-border)`.
- **Step card variants** (by state, mandatory tint + glyph + label):
  - **Not started** → border `--lc-border`, step-number chip fill `--lc-surface-sunken`, chip ink `--lc-text-muted`, glyph `○` (Circle from lucide).
  - **In progress** → border `2px solid var(--lc-action-primary)`, chip fill `--lc-action-primary`, chip ink `--lc-action-primary-text`, glyph `◐` (CircleDot).
  - **Complete** → border `1px solid var(--lc-status-published-fg)`, chip fill `--lc-status-published-bg`, chip ink `--lc-status-published-fg`, glyph `●` (CheckCircle2).
  - **Skipped** → border `1px dashed var(--lc-border-strong)`, chip fill transparent, chip ink `--lc-text-muted`, glyph `▢` (SquareDashed). Small "Skipped — resume" text link uses `--lc-text-brand`.
  - **Locked** (dependency not yet ready — see AGT-ACT-004) → border `1px dashed var(--lc-border)`, opacity 0.6, chip glyph `✕` (Lock icon), small helper "Available soon" in `--lc-text-muted`.
- **Step-number chip** (24×24 circle, top-left of each card): `<Numeric>` inside, `var(--lc-type-caption)` weight 700. Displays `1..5`.
- **Step icon** (32×32 lucide-react, top-right of each card): step-specific (see §Copy). Ink `--lc-text-heading` (not-started / in-progress) or `--lc-status-published-fg` (complete).
- **Primary CTA** ("Start" / "Resume" / "Continue setup"): `--lc-action-primary` fill, `--lc-action-primary-text` ink, hover `--lc-action-primary-hover` (DARKER). Full 44px tap-target. Bottom-right of card on desktop; full-width on mobile.
- **Secondary CTA** ("I'll do this later"): `<Button variant="ghost">`, `--lc-text-muted` ink. Under the primary CTA on mobile; inline on desktop.
- **Persistent "Skip wizard" affordance** (top-right of the screen, not per-card): `<Button variant="link">`, `--lc-text-muted`. Opens a `<Dialog>` confirming that progress persists on the dashboard.
- **Confetti moment**: on the transition from 4/5 → 5/5 (last step completed), a one-off `--lc-easing-emphasis` badge slide-in above the progress bar reads "You're activated." Motion respects `prefers-reduced-motion`. This is the only place in AGT-ACT-* where `--lc-easing-emphasis` fires.
- Two-tone focus ring automatic; 44px tap floor automatic; do not override.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ACT-001 |
| Screen name | Activation wizard — Welcome |
| Persona | Agent (solo or agency-scoped or agency-owner), authenticated, post-signup |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/activate` (default landing after signup for agents who haven't completed activation) + `/activate/welcome` (explicit) |
| Current state | MISSING — new screen family per Rev 8 (2026-09-06). No prior React file to supersede. |
| Workflow role | WF-01 structured-activation companion. Runs alongside AGT-ONB-001..005 free-form onboarding without duplication (see §ACT vs ONB). |
| Backend prerequisites | ✅ Identity + tenant established at signup (SHR-AUT-006) · ✅ Model B WhatsApp binding (PR #50) · ⏳ `[BE-DESIGN-01]` dynamic `portal_registry` — blocking for AGT-ACT-004 only (Week 2 backend) · ✅ Feature flag `activation_wizard.enabled` (assumed ships with this wave; add if missing) |

---

## Purpose (one sentence)

Give a freshly signed-up agent a structured, resumable, five-step map from "account created" to "every core WingCaster capability unlocked" — without forcing linear order and without duplicating what the free-form onboarding (ONB) already covered.

---

## ACT vs ONB — how they coexist (READ THIS FIRST)

The two families run in parallel and must not double-charge the user's time. Design AI and Cursor implementations MUST honor this distinction:

| | **AGT-ONB-*** (free-form onboarding) | **AGT-ACT-*** (structured activation wizard) |
|---|---|---|
| **Question it answers** | "How do I get to my first listing?" | "How do I unlock every WingCaster feature?" |
| **Shape** | Linear, celebratory, one path — welcome → import → first listing → celebrate. | Non-linear card grid; user can complete steps out of order or defer any of them. |
| **Trigger** | First sign-in after signup (SHR-AUT-006). Runs once. | Available from dashboard indefinitely until 5/5 complete. Progress persists per user. |
| **Skippable?** | Skippable at each step; leaves the funnel. | Every step individually skippable; user can leave wizard at any time and resume from dashboard. |
| **Overlap** | If ONB Step 3 completed a first listing, AGT-ACT-003 auto-marks Complete. If ONB connected WhatsApp, AGT-ACT-002 auto-marks Complete. | Reads the same backend flags — never re-asks. |
| **Route** | `/onboarding/*` | `/activate/*` |

**Deduplication contract:** every AGT-ACT-* step reads a backend `activation_state` object (see §Backend contract). If a capability was already completed elsewhere (ONB, direct dashboard action, WhatsApp intake), the corresponding wizard step renders as **Complete** on load — the user never repeats work.

**Rendering rule:** the wizard is silently pre-populated. Do NOT show a "we saw you already did X" banner — that reads as surveillance. Just show the step as complete with a subdued "Completed via WhatsApp intake" or "Completed during onboarding" caption in `--lc-text-muted`, `var(--lc-type-caption)`.

---

## Design goals

1. **Structure without pressure.** The five steps read as a map, not a checklist tyranny. Any step can be skipped and resumed.
2. **Progress is legible at a glance.** The `X of 5` counter + fill bar are the single visual anchor — same treatment on this welcome screen, on the dashboard's activation-progress tile, and on every AGT-ACT-002..005 sub-screen (see §Progress persistence).
3. **Zero re-work across ONB and ACT.** If the user already connected WhatsApp during ONB, ACT-002 loads as Complete. Same for every other step.
4. **Non-linear by default.** No forced sequence. User can start at Step 3 (first listing) before Step 2 (WhatsApp). The dashboard entry point deep-links into any step.
5. **Agency-owner path visible; solo-agent path uncluttered.** Step 5 (invite team) renders as **Locked** for solo-agent signups (path=a from SHR-AUT-006) with helper "Available if you register an agency later." For agency-owner signups (path=c), it renders as a first-class step.
6. **Persistence across sessions.** Close the browser at 2/5, come back next week, wizard shows 2/5 with the exact same step marked in-progress. `activation_state` lives on the server, not `localStorage`.
7. **Never the whole first-run experience alone.** Pairs with AGT-DSH-001's activation-progress attention card — one is the map, the other is the daily nudge.

---

## Layout

### Desktop / tablet ≥768px

Single-column, centered, max-width 960px. Top-to-bottom:

**Zone 1 — Header strip (56px):**
- Left: WingCaster wordmark (small, links to dashboard).
- Right: `SHR-NAV-006` language selector + `<ColorModeToggle>` + "Skip wizard" link.

**Zone 2 — Hero block (auto height, ~200px):**
- H1: "Unlock every WingCaster feature"
- Sub: "Five short steps get you from account-created to fully activated. Do them in any order — your progress saves automatically."
- Overall progress: `<Numeric>0</Numeric> of <Numeric>5</Numeric> complete` label + 6px pill-shaped bar under it. When steps complete, bar fills orange left-to-right with a `--lc-duration-base` (180ms) `--lc-easing-out` transition.

**Zone 3 — Step-card grid (auto height):**
- 3-column CSS grid on desktop (≥1024px), 2-column on tablet (768-1023px). `--lc-space-lg` (20px) grid gap.
- Cards flow top-left → bottom-right in the step order (1 → 5) but the user may activate them in any order.
- Each card is 280-320px wide, ~200px tall (grows if secondary CTAs stack on mobile).

**Zone 4 — Footer helper strip (~64px):**
- Left: `<HelpCircle>` icon + "Not sure where to start? Take the guided path →" (link opens AGT-ONB-001 in a new route). Text `var(--lc-type-body-sm)`, `--lc-text-muted`.
- Right: "Return to dashboard →" link.

### Mobile ≤767px

Single-column stack (no grid — one card per row, full-width minus 16px page padding):

- Sticky top bar (56px): WingCaster wordmark (left) + kebab menu (right — houses language selector, color mode, "Skip wizard").
- Hero block (~180px): H1 (`var(--lc-type-heading-1)`, smaller than desktop), sub, progress bar, `X of 5` label.
- Card stack: one card per row. Each card ~120px tall. Primary CTA full-width at the bottom of each card. Secondary "Later" as a ghost button under the primary CTA.
- Footer helper strip: stacked, two rows.

### Step-card anatomy (all viewports)

```
┌──────────────────────────────────────┐
│ [1]                          [icon]  │  ← step-number chip + step icon
│                                      │
│  Step title                          │  ← var(--lc-type-heading-3)
│  One-line description of what this   │  ← var(--lc-type-body-sm), --lc-text-muted
│  step unlocks.                       │
│                                      │
│  Completed via WhatsApp intake       │  ← only when auto-completed; caption
│                                      │
│  [Start →]         [I'll do later]   │  ← primary + ghost secondary
└──────────────────────────────────────┘
```

Card padding: `--lc-space-lg` (20px). Chip + icon at `--lc-space-md` (16px) inset.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| H1 | Unlock every WingCaster feature |
| Sub | Five short steps get you from account-created to fully activated. Do them in any order — your progress saves automatically. |
| Progress label | **{n}** of **5** complete |
| Skip wizard link | Skip wizard |
| Skip confirm dialog title | Leave the activation wizard? |
| Skip confirm dialog body | Your progress is saved. You can pick this back up any time from your dashboard. |
| Skip confirm CTA (primary) | Leave — I'll return later |
| Skip confirm CTA (secondary) | Never mind, keep going |
| Footer helper | Not sure where to start? **Take the guided path** → |
| Footer return | Return to dashboard → |
| **Step 1 — title** | Connect WhatsApp |
| Step 1 icon | `MessageCircle` (lucide) |
| Step 1 description | Bind your business WhatsApp so leads land in your WingCaster inbox from the first hello. |
| Step 1 CTA | Start with WhatsApp |
| **Step 2 — title** | Publish your first listing |
| Step 2 icon | `Home` (lucide) |
| Step 2 description | Create a listing manually or dictate it over WhatsApp — either path counts. |
| Step 2 CTA | Create a listing |
| **Step 3 — title** | Add your portal credentials |
| Step 3 icon | `KeyRound` (lucide) |
| Step 3 description | Connect Bayut, Property Finder, Dubizzle, and other portals so WingCaster can publish for you. |
| Step 3 CTA | Connect a portal |
| Step 3 locked helper | Available soon — we're finalizing your country's portal list. |
| **Step 4 — title** | Set your working hours & response time |
| Step 4 icon | `Clock` (lucide) |
| Step 4 description | Tell leads when to expect a reply so auto-responders never overpromise. |
| Step 4 CTA | Set my hours |
| **Step 5 — title (agency-owner)** | Invite your team |
| Step 5 icon (agency-owner) | `Users` (lucide) |
| Step 5 description (agency-owner) | Bring your agents into your workspace. Share a code, a link, or bulk-email invitations. |
| Step 5 CTA (agency-owner) | Invite agents |
| **Step 5 — title (solo agent)** | Grow into an agency (when you're ready) |
| Step 5 icon (solo) | `Lock` (lucide) |
| Step 5 description (solo) | Available if you register an agency workspace later. |
| Step 5 CTA (solo) | Learn about agencies |
| Step secondary CTA | I'll do this later |
| Step resume CTA | Resume |
| Step completed caption (auto) | Completed via {source} — {timestamp} |
| Step completed caption (manual) | Completed — {timestamp} |
| 5/5 confetti banner | You're activated. |

Sources for the "Completed via {source}" caption enum: `whatsapp_intake`, `onboarding`, `dashboard_action`, `direct`, `bulk_import`.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Page shell | `<main>` + Broadcast top bar (reused) |
| Language selector | Embedded `SHR-NAV-006` component |
| Color mode toggle | `<ColorModeToggle>` from `web/src/components/ui/color-mode-toggle.tsx` |
| Progress bar | `<Progress>` from Radix (Broadcast-styled) |
| Numeric fields (`{n}`, `5`) | `<Numeric>` — mandatory |
| Step-card grid | Native CSS grid (no library) |
| Step card | `<Card>` primitive |
| Step-number chip | `<Badge variant="outline">` + `<Numeric>` |
| Step icon | `lucide-react` per §Copy |
| State glyphs (○ ◐ ● ▢ ✕) | `lucide-react` — `Circle`, `CircleDot`, `CheckCircle2`, `SquareDashed`, `Lock` |
| Primary step CTA | `<Button variant="default">` |
| Secondary step CTA | `<Button variant="ghost">` |
| Skip-wizard dialog | `<Dialog>` |
| 5/5 celebration banner | `<Toast>` (sonner) or inline `<div>` with `--lc-easing-emphasis` slide-in |
| Loading skeleton | Broadcast skeleton pattern |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with a mid-flow state:

- Agent signed up as **path=a solo agent** 6 days ago.
- Progress: **2 of 5 complete**, orange bar filled 40%.
- Step 1 (WhatsApp): **Complete**, caption "Completed via onboarding — 6 days ago".
- Step 2 (First listing): **Complete**, caption "Completed via WhatsApp intake — 4 days ago".
- Step 3 (Portal credentials): **In progress**, CTA "Resume →".
- Step 4 (Working hours): **Not started**, CTA "Set my hours →".
- Step 5 (Invite team / solo variant): **Locked**, CTA "Learn about agencies →" ghost.
- Skip-wizard link visible top-right.
- Footer helper strip visible.

---

## Interactions

**On page load:**
- Fetch `GET /api/agent/activation_state`. Response drives every card's state.
- Render skeleton (5 empty cards + shimmering progress bar) until response resolves.
- Animate the progress-bar fill from 0 → current value in `--lc-duration-slow` (240ms) `--lc-easing-out` on first paint.

**On step-card primary CTA click:**
- Not-started or In-progress step → navigate to the step's own screen (AGT-ACT-002/003/004/005 or the "Learn about agencies" marketing page for Step 5-solo).
- Complete step → navigate to the underlying feature surface (WhatsApp binding management, listing detail, portal detail, working-hours settings, team management).
- Locked step (Step 3 when `portal_registry` empty for the user's country, Step 5-solo) → open a small info popover, do NOT navigate.

**On step-card secondary CTA ("I'll do this later"):**
- Mark step as `deferred` in `activation_state` (does NOT count toward `X of 5` — deferred and not-started are visually distinct but functionally equivalent for the counter).
- Card animates to Skipped variant. Small "Skipped — resume" link appears where the primary CTA was.

**On "Skip wizard" click (header):**
- Open `<Dialog>`. Focus-trap. Escape closes. Confirming navigates to `/dashboard`.
- Dashboard's AGT-DSH-001 activation-progress attention card remains visible until 5/5.

**On step completion (from within an AGT-ACT-002..005 sub-screen):**
- Sub-screen POSTs completion to `/api/agent/activation_state`.
- Returns user to `/activate` with the newly-completed card animating from In-progress → Complete (glyph swap, border color transition, `--lc-duration-slow`).
- Progress bar fill animates upward.
- If the completion moves the counter to 5, fire the 5/5 confetti banner (see below) instead of returning to the dashboard.

**On reaching 5/5:**
- Confetti banner slides in above the progress bar with `--lc-easing-emphasis`, holds 3 seconds, fades.
- All cards remain visible in Complete state.
- The "Return to dashboard →" footer link becomes prominent: `--lc-action-primary` fill, full-width on mobile.
- Wizard remains reachable from `/activate` afterward as a read-only "audit trail" — but no longer surfaces as an attention card on the dashboard.

**On language toggle:**
- Immediate `<html dir>` flip. Layout mirrors. Icons in step cards do NOT mirror (`MessageCircle`, `Home`, `KeyRound`, `Clock`, `Users`, `Lock` are language-agnostic). Progress bar fills right-to-left in Arabic.

**On dashboard entry:**
- AGT-DSH-001 attention card "Activation: 3 of 5" deep-links to `/activate` (this screen). If the user is on the last incomplete step, deep-link straight to that step's sub-screen instead (`/activate/portal-credentials`).

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Route entered, `activation_state` pending | Skeleton — 5 empty card outlines + shimmering progress bar. No layout shift on data arrival. |
| **Fresh start** | `activation_state.completed === []` | All 5 cards in Not-started state. Progress `0 of 5`. Bar empty. |
| **Mid-flow** | 1-4 steps complete | Mix of Complete / In-progress / Not-started / Skipped cards. |
| **Complete** | All 5 marked done | All cards Complete. Confetti banner if just crossed. Return-to-dashboard CTA promoted. |
| **Solo-agent variant** | Signup path=a | Step 5 renders in Locked (solo) variant per §Copy. |
| **Agency-owner variant** | Signup path=c | Step 5 renders as first-class Invite team card. |
| **Agent-joining variant** | Signup path=b | Step 5 renders Locked with helper "Invite is managed by your agency owner." |
| **Portal registry unavailable** | `GET /api/portal_registry?country=<user_country>` returns empty | Step 3 renders in Locked state with helper "Available soon — we're finalizing your country's portal list." Do not fail the whole page. |
| **Backend error** | `activation_state` fetch 500s | Full-page error card: "We couldn't load your activation progress. Try again in a moment." Retry button. |
| **Offline** | Network unreachable | Top-of-page banner "You're offline. Progress won't save until you reconnect." All CTAs disabled. |
| **RTL** | Locale = ar | Layout mirrors; progress bar fills right-to-left; icons unmirrored. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap. Orange primary stays orange (dark: `#FF7440`). |
| **Reduced motion** | `prefers-reduced-motion: reduce` | Progress-bar fill snaps instantly. Confetti banner appears without slide-in — pure fade. |

---

## Accessibility

- Every card is a `<div role="region" aria-labelledby="step-{n}-title">` — NOT a button. The primary CTA inside is the interactive control.
- Overall progress bar is a `<div role="progressbar" aria-valuemin="0" aria-valuemax="5" aria-valuenow="{n}" aria-label="Activation progress">`.
- Card state announced via visually-hidden text inside the state glyph: `<span class="sr-only">Complete</span>` etc.
- Auto-completed caption ("Completed via onboarding") announced via `aria-describedby` on the card.
- Tab order: header (wordmark → language → color mode → skip-wizard) → Card 1 primary → Card 1 secondary → Card 2 primary → Card 2 secondary → ... → footer helper → return-to-dashboard.
- Focus rings visible on every interactive element (two-tone Broadcast focus ring).
- Skip-wizard dialog: focus trap, Escape to close, primary CTA is autofocused on open.
- 5/5 confetti banner announced via `aria-live="polite"`: "You're activated. All five steps complete."
- All numerals (progress `{n}`, `5`, timestamps) render via `<Numeric>` for tabular alignment + Arabic-Indic digits in AR locale.
- Every tap target ≥ 44×44 CSS pixels including ghost secondary CTAs.
- No color-only state differentiation — every card state uses tint + glyph + label.

---

## Anti-patterns (do not do these)

- ❌ Do not force linear step order. Every card is independently actionable.
- ❌ Do not surface a "we saw you already did X" banner on load. Auto-completed steps just render Complete with a subdued caption — no surveillance vibe.
- ❌ Do not celebrate every step completion. The confetti + `--lc-easing-emphasis` motif is reserved for the 5/5 moment only. Sub-screens (AGT-ACT-002..005) return the user here with a quiet state-change animation, not a party.
- ❌ Do not block the dashboard behind this wizard. Skip-wizard is one click, no "are you sure" barrage — just the single confirmation dialog.
- ❌ Do not duplicate ONB work. If the backend `activation_state` says Step 1 was completed via onboarding, the card MUST render Complete with the source caption. Never re-ask.
- ❌ Do not lock Step 3 silently when `portal_registry` is empty — render Locked with the helper copy so the user understands the delay is on WingCaster's side, not theirs.
- ❌ Do not use the 5/5 confetti banner outside this exact moment. Reserved motion.
- ❌ Do not hardcode the 5-step count. The `activation_state.steps` array from the backend is the source of truth — if steps evolve (Rev 9+), the UI adapts without a code change.
- ❌ Do not show the wizard on desktop-only routes for a mobile-signed-up agent whose device is mobile — the wizard MUST render across all three breakpoints.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Linear onboarding checklist** — non-linear grid of activation steps with per-step status glyphs is the closest analog.
- **Notion "Get started" grid** — card-per-capability layout with clear completion states.
- **Stripe Radar activation checklist** — the "X of N complete" counter + progress bar treatment.
- **GitHub repo setup checklist** (post-create) — dismissible-but-persistent activation nudges.

Do NOT match:
- Intercom's Product Tours (too pushy — this wizard is opt-in, not opt-out).
- Salesforce Setup Assistant (too linear + form-heavy).

---

## Backend contract

**Read endpoint:** `GET /api/agent/activation_state`

**Response 200:**
```json
{
  "user_id": "usr_...",
  "tenant_id": "tnt_...",
  "signup_path": "solo" | "join" | "agency",
  "country_code": "AE",
  "steps": [
    {
      "id": "whatsapp",
      "order": 1,
      "state": "complete" | "in_progress" | "not_started" | "deferred" | "locked",
      "completed_at": "2026-09-01T14:22:00Z",   // null unless complete
      "completed_via": "onboarding" | "whatsapp_intake" | "dashboard_action" | "direct",
      "sub_route": "/activate/whatsapp"
    },
    { "id": "first_listing", "order": 2, "state": "complete", "completed_via": "whatsapp_intake", ... },
    { "id": "portal_credentials", "order": 3, "state": "locked", "lock_reason": "portal_registry_empty_for_country", ... },
    { "id": "working_hours", "order": 4, "state": "not_started", ... },
    { "id": "invite_team", "order": 5, "state": "locked", "lock_reason": "solo_signup_path", ... }
  ],
  "completed_count": 2,
  "total_count": 5
}
```

**Write endpoint (called from AGT-ACT-002..005 sub-screens, not this welcome screen):** `POST /api/agent/activation_state/complete`
```json
{ "step_id": "working_hours", "completed_via": "dashboard_action" }
```
Returns updated `activation_state`.

**Defer endpoint:** `POST /api/agent/activation_state/defer` with `{ "step_id": "..." }`. Marks state=`deferred`. Does NOT count toward `completed_count`.

**Backend prerequisite for AGT-ACT-004 only:** `[BE-DESIGN-01]` dynamic `portal_registry` table + `GET /api/portal_registry?country=<code>` endpoint. See §5a of `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md`. Until that ships (Week 2), the `portal_credentials` step MUST render as Locked with `lock_reason: "portal_registry_empty_for_country"`. THIS SCREEN (AGT-ACT-001) is NOT blocked — it renders the locked card gracefully and continues.

**Signup-path resolution:** `signup_path` is copied from `users.signup_path` at account creation (SHR-AUT-006). Drives the Step 5 variant.

**Auto-complete triggers (backend, out of scope for this brief but relevant to the contract):**
- WhatsApp binding success → sets `whatsapp` step to complete, `completed_via = whatsapp_intake` or `onboarding`.
- First listing published → sets `first_listing` step to complete.
- First portal credential saved → sets `portal_credentials` step to complete.
- Working hours saved → sets `working_hours` step to complete.
- First invitation sent → sets `invite_team` step to complete.

---

## Progress persistence (contract shared across AGT-ACT-*)

**Every AGT-ACT-002..005 sub-screen MUST:**
1. Render the same 6px pill-shaped progress bar at the top with `X of 5 complete` label.
2. Show a breadcrumb "Activation wizard → Step {n} · {title}" above the bar.
3. On completion, POST to `/api/agent/activation_state/complete`.
4. On defer, POST to `/api/agent/activation_state/defer`.
5. On back-navigation, return to `/activate` (this screen), NOT to the previous browser page.

The progress bar is the visual identity of the AGT-ACT family. Any AGT-ACT-* screen missing it is a bug.

---

## Downstream implementation (Cursor prompt handoff notes)

- **New file:** `web/src/pages/ActivationWizardPage.tsx` — route `/activate`.
- **Route additions in `web/src/App.tsx`:** `/activate` → `ActivationWizardPage`; `/activate/whatsapp` → `ActivationWhatsAppPage` (AGT-ACT-002); `/activate/first-listing` → `ActivationFirstListingPage` (AGT-ACT-003); `/activate/portal-credentials` → `ActivationPortalCredentialsPage` (AGT-ACT-004); `/activate/invite-team` → `ActivationInviteTeamPage` (AGT-ACT-005).
- **Component decomposition:**
  - `ActivationWizardPage` — page shell + header + hero + grid + footer.
  - `ActivationProgressBar` — reused across all 5 AGT-ACT screens. Props: `completed`, `total`, `size` ('lg' for welcome, 'sm' for sub-screens).
  - `StepCard` — Props: `step: ActivationStep`, `variant: 'welcome' | 'compact'`. Handles all 5 state variants.
  - `SkipWizardDialog` — controlled dialog. Fires on header link click.
  - `ActivationCelebrationBanner` — 5/5 moment. Respects `prefers-reduced-motion`.
- **Data hook:** `useActivationState()` — TanStack Query hook wrapping `GET /api/agent/activation_state`. Exposes `mutate: complete(stepId)` + `mutate: defer(stepId)`.
- **Context integration:** read `signup_path` from `AuthContext` (already exists post SHR-AUT-006) to double-check the Step 5 variant matches the backend response.
- **Feature flag:** wrap route in a `<FeatureFlag flag="activation_wizard.enabled">` — allows staged rollout.
- **Test discipline:**
  - Unit: each of the 5 state variants of `StepCard` renders correctly.
  - Unit: `ActivationProgressBar` renders 0/5, 3/5, 5/5 correctly + fires the celebration banner on 4→5.
  - Integration: full page loads with mocked `activation_state`; simulate completing Step 2 → banner does NOT fire; simulate completing Step 5 (final) → banner DOES fire.
  - Integration: solo-signup renders Step 5 as Locked (solo variant); agency-owner-signup renders Step 5 as first-class card.
  - Integration: portal registry empty → Step 3 locked with correct helper copy.
  - Cross-brief: AGT-ACT-002/003/004/005 sub-screens each POST completion correctly and route back to `/activate` with updated state.
  - Broadcast tokens: `no-raw-hex.test.ts` must stay green.
  - RTL: verified via `screens.rtl.test.tsx` extension with an activation-wizard scenario.
  - a11y: `axe` clean; `progressbar` role announces correctly; state-glyph sr-only text present.

---

## Broadcast alignment callouts (non-negotiable)

- Step-card variants: exact tint + glyph + label combinations per §Broadcast alignment. No color-only state.
- Progress bar: `--lc-surface-sunken` track + `--lc-action-primary` fill. 6px height. Pill radius.
- Step-number chip numerals: `<Numeric>`, mono, tabular. NEVER the UI font.
- Progress label `{n}` and `5`: `<Numeric>`. NEVER inline text.
- Primary CTAs: hover DARKENS (`--lc-action-primary-hover`). Never lightens.
- Locked cards: opacity 0.6 + dashed border + `Lock` glyph. NEVER just opacity.
- Motion budget: card state transitions `--lc-duration-slow` (240ms) `--lc-easing-out`; progress bar fill `--lc-duration-base` (180ms) `--lc-easing-out`; 5/5 celebration `--lc-easing-emphasis` — single occurrence per wizard lifecycle.
- Radii: cards `--lc-radius-lg`; chips `--lc-radius-pill`; buttons `--lc-radius-md`.
- Elevation: cards `--lc-elevation-sm`. Offset, not blurred. Never soft glow.
- Focus rings: two-tone via base CSS. Do not override.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Activation Wizard welcome screen (AGT-ACT-001) — MENA real-estate B2B SaaS. Structured, non-linear, five-step activation flow that coexists with a separate free-form onboarding (AGT-ONB-*). Users can complete steps out of order or defer any of them. Progress persists on the dashboard. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind. Broadcast theme (semantic --lc-* tokens only).

First pass: render the desktop 1440px layout for a solo agent who is 2 of 5 complete. Step 1 (WhatsApp) complete via onboarding. Step 2 (First listing) complete via WhatsApp intake. Step 3 (Portal credentials) in progress. Step 4 (Working hours) not started. Step 5 (Invite team) locked in solo variant. Progress bar 40% filled. Skip-wizard link top-right. Footer helper strip.

LTR English only for this pass — I'll ask for RTL Arabic, mobile 375px, agency-owner variant, 5/5 celebration state, portal-registry-locked state, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now the agency-owner variant. Step 5 renders as first-class Invite Team card. Same 2 of 5 progress otherwise.`
2. `Now the 5/5 complete state. All cards Complete. Confetti banner "You're activated." visible above the progress bar. Return-to-dashboard CTA promoted to primary orange.`
3. `Now mobile 375px viewport. Same solo-agent 2 of 5 state. Cards stack single-column, primary CTAs full-width.`
4. `Now the portal-registry-empty variant. Step 3 renders Locked with helper "Available soon — we're finalizing your country's portal list.".`
5. `Now RTL Arabic layout at desktop 1440px. Use [TRANSLATION-PENDING] where copy has no Arabic yet, but MIRROR the whole layout. Icons stay unmirrored.`
6. `Now dark mode versions of the desktop LTR and mobile LTR passes.`

Save each output's JSX to `web/src/components/activation/ActivationWizardPage/` (or the mockups folder) + screenshot to `docs/design/mockups/AGT-ACT-001-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 6 iteration states (desktop solo mid-flow, agency-owner variant, 5/5 complete, mobile, portal-registry-empty, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Backend contract `GET /api/agent/activation_state` + POST endpoints confirmed with backend owner (add to `[BE-VERIFY-*]` list if not yet implemented).
- [ ] Cursor Wave-4 dispatch prompt references this brief + the 4 delta briefs (AGT-ACT-002..005) + the mockup paths.
- [ ] Feature flag `activation_wizard.enabled` scaffolded.
