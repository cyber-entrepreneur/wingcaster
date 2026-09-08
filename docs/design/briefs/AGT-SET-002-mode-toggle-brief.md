# Screen Brief — AGT-SET-002 · Mode toggle (Guided ↔ Pro)

**Layer-2 Brief for design AI consumption. Settings-family DELTA — small surface, big cascade.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-SET-002`. Wave 8+ per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 4 row 17. **P0** — without this toggle, every Pro variant we build (AGT-DSH-002, AGT-LST-002, and the D3 focused-domain Pro suite) is unreachable.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference.

**Screen-specific Broadcast callouts:**
- Setting card container: `--lc-surface-raised` + `--lc-elevation-sm` + `--lc-radius-lg`. Sits inside AGT-SET-001 settings home grid.
- Section title ("Interface mode"): `var(--lc-type-heading-2)`.
- Current-mode indicator: `var(--lc-type-heading-3)` + `--lc-text-heading`. Prefixed with a status glyph — Guided `○`, Pro `◆`.
- Two mode cards (Guided / Pro): `<RadioGroup>` primitive rendered as a two-column card grid at ≥768px, two-row card stack at <768px.
- Selected card: `border: 2px solid var(--lc-action-primary)` + `background: var(--lc-surface-selected)` + check icon (`Check` from lucide) top-right in `--lc-action-primary`.
- Unselected card: `border: 1px solid var(--lc-border)` + `background: var(--lc-surface-raised)`.
- Icon per card (top-left, 32×32 in `--lc-surface-sunken` tinted circle): Guided → `Compass`, Pro → `Zap`.
- Mode-card body text: label `var(--lc-type-heading-3)`, pitch `var(--lc-type-body)`, "Best for" line `var(--lc-type-body-sm)` in `--lc-text-muted`.
- Top-bar mode chip (persistent, shows current mode across app): `<Badge>` primitive — Guided variant `--lc-surface-sunken` + `--lc-text-secondary`; Pro variant `--lc-accent-bold-edge` outlined + `--lc-accent-bold-edge` text. Click opens this settings screen.
- Disabled state (mobile <768px Pro card): `opacity: 0.5`, no border color change, cursor `not-allowed`, helper text below.
- Try-Pro nudge banner (Dashboard, triggered by usage threshold): `--lc-action-primary` fill background, `--lc-action-primary-text` ink, dismiss `X` in `--lc-action-primary-text` at 70% opacity.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-SET-002 |
| Screen name | Interface mode (Guided ↔ Pro) |
| Persona | Agent (any tenant context) |
| Device targets | Mobile 375px + Tablet 768px + Desktop 1440px — all three render, but Pro card is DISABLED at <768px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/settings` card (embedded in AGT-SET-001) + top-bar chip (persistent across app) |
| Current state | MISSING — Wave 8+ P0 delivery. |
| Backend | `PATCH /api/users/me` extended with `ui_mode` field OR `tenant_memberships.data.ui_mode` write endpoint (see §Backend contract). |

---

## Purpose

One control, two surfaces:
1. A **setting card** on AGT-SET-001 lets the user pick Guided (default) or Pro. Change persists server-side and re-renders the whole app.
2. A **persistent chip in the top bar** shows the current mode and provides a one-click path back to this setting card.

Per D-S-06, Pro is only available at viewport ≥768px. On mobile the Pro card is visible but DISABLED with a helper explaining the constraint. Server-side value is preserved — a user opted into Pro on desktop stays opted-in when they open the app on mobile; they just render Guided until viewport passes 768px again.

---

## Design goals

1. **Choice is legible.** Both mode cards visible side-by-side with clear one-line pitches — user can decide without hunting.
2. **Immediate feedback.** No separate Save button. Selecting a card triggers the app-wide re-render (200ms transition).
3. **Reversible.** Chip in the top bar keeps the door open — a user who tried Pro and wants Guided back is one click away.
4. **Mobile-honest.** Do NOT hide the Pro card on mobile; disable it and explain why. Hiding erodes trust ("why didn't I know this existed?").
5. **Never annoy.** Try-Pro nudge fires at most once per 90 days after a dismiss.

---

## Layout

### Setting card (embedded in AGT-SET-001)

Full-width card in the settings grid.

- Header row: section title "Interface mode" + current-mode indicator (right-aligned) — e.g., `Interface mode · ○ You're in Guided mode`.
- Below: two mode cards side-by-side (desktop/tablet) or stacked (mobile). Each card contains icon + label + pitch + "Best for" line + selected check.
- Below the cards: helper line — "You can switch anytime. Your preference syncs across devices."
- On mobile: below the (disabled) Pro card, an inline helper: "Pro mode is available on tablet or larger screens (≥768px). Your preference is saved either way."

### Top-bar chip (persistent, cross-app)

Position: top-nav right cluster, immediately left of the user avatar. Height 32px, radius `--lc-radius-pill`. Content:
- Guided: `○ Guided` (muted style)
- Pro: `◆ Pro` (accent-bold-edge outlined style)

Tap: navigates to `/settings#interface-mode` (deep-link to this card). Hover tooltip: "Interface mode — {Guided | Pro}. Click to change."

On mobile (<768px), if the user's server-side `ui_mode = 'pro'`, the chip STILL renders showing `◆ Pro` (never lie to the user about their preference) — but a small info tooltip on tap says "Rendering Guided at this viewport size. Pro returns on tablet+."

### Try-Pro nudge (Dashboard banner, non-modal)

Fired by system when:
- User has been in Guided ≥14 days AND
- User has ≥20 listings AND
- User has never dismissed a Pro nudge OR last dismissal was ≥90 days ago AND
- Viewport ≥768px

Banner: sticks under the greeting on AGT-DSH-001, above the urgent card. `--lc-action-primary` background, `--lc-action-primary-text` ink. Copy: "You've got 20+ listings — try Pro mode for faster browsing?" + `Try Pro →` button + dismiss `X`.

Try-Pro button switches immediately to Pro (same as selecting the Pro card). Dismiss records timestamp; nudge doesn't reappear for 90 days.

---

## Explicit copy (English)

Arabic mirrors: `[TRANSLATION-PENDING]` in the AR mirror MDX.

| Slot | Copy |
|---|---|
| Section title | Interface mode |
| Current mode — Guided | You're in Guided mode |
| Current mode — Pro | You're in Pro mode |
| Guided card label | Guided |
| Guided card pitch | Big buttons, one decision at a time, plain language. All features available. |
| Guided card best-for | Best for: new users, occasional use, or when you want the simplest path. |
| Pro card label | Pro |
| Pro card pitch | Dense tables, keyboard shortcuts, bulk actions, saved views. All the same features. |
| Pro card best-for | Best for: power users, high listing volume, or when you value speed over hand-holding. |
| Helper line | You can switch anytime. Your preference syncs across devices. |
| Mobile Pro disabled helper | Pro mode is available on tablet or larger screens (≥768px). Your preference is saved either way. |
| Top-bar chip — Guided | Guided |
| Top-bar chip — Pro | Pro |
| Top-bar chip tooltip | Interface mode — {mode}. Click to change. |
| Top-bar chip mobile-Pro tooltip | Rendering Guided at this viewport size. Pro returns on tablet+. |
| Try-Pro nudge banner | You've got 20+ listings — try Pro mode for faster browsing? |
| Try-Pro nudge CTA | Try Pro → |
| Try-Pro nudge dismiss aria | Dismiss Pro suggestion |
| Switching toast (success) | Switched to {mode} mode. |
| Switching toast (error) | Couldn't switch modes. Try again? |

---

## Component palette

| Element | Primitive |
|---|---|
| Setting card container | `<Card>` |
| Mode picker | `<RadioGroup>` + `<RadioGroupItem>` styled as cards (same pattern as SHR-AUT-006 path selector) |
| Selected check icon | `Check` (lucide) |
| Icons per card | `Compass` (Guided) + `Zap` (Pro) |
| Current-mode glyph | plain unicode `○` / `◆` (matches status glyph vocabulary) |
| Top-bar chip | `<Badge>` — variants `guided` and `pro` |
| Try-Pro banner | `<Alert>` primitive with dismiss action |
| Success/error toast | `Sonner` |
| Route link | Standard `react-router` `<Link to="/settings#interface-mode">` |

---

## Interactions

- **Select Guided → Pro:** if viewport ≥768px, immediately PATCH the preference, show success toast, trigger 200ms fade transition + re-render, top-bar chip updates. If viewport <768px AND user managed to click somehow (edge case, keyboard-nav), block with tooltip explaining the constraint — do NOT persist.
- **Select Pro → Guided:** always allowed. PATCH + toast + re-render.
- **Chip click:** navigates to settings with hash anchor `#interface-mode` — scroll target and briefly highlights the card.
- **Chip mobile-Pro tap:** shows tooltip; does NOT navigate (avoids friction — user knows the constraint).
- **Try-Pro banner dismiss:** records timestamp in `users.data.pro_nudge_dismissed_at`; banner disappears with 120ms fade.
- **Try-Pro banner accept:** same as selecting the Pro card.
- **Server error on PATCH:** rollback the visual selection to the previous mode; destructive toast; user can retry.
- **Viewport crosses 768px in an active Pro session:** no user-facing prompt; app just renders the appropriate variant. Top-bar chip stays consistent with server preference.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial — Guided** | Server value = guided | Guided card selected (border + check + surface-selected). Pro card unselected. Current-mode line reads "You're in Guided mode". |
| **Initial — Pro** | Server value = pro AND viewport ≥768px | Pro card selected. Current-mode line "You're in Pro mode". |
| **Initial — Pro on mobile** | Server value = pro AND viewport <768px | Pro card selected VISUALLY (server truth), but disabled affordance; a small "Rendering Guided at this size" chip pinned to the card. |
| **Switching** | Selection changed, PATCH in flight | Selected card shows a subtle spinner (`Loader2` next to check); other card disabled for 200ms. |
| **Success** | 200 back | Toast "Switched to {mode} mode." App re-renders. Chip updates. |
| **Error** | PATCH failed | Rollback visual selection; destructive toast; card re-enabled. |
| **Mobile Pro disabled** | Viewport <768px | Pro card: 0.5 opacity, `cursor: not-allowed`, helper text below. Radio input `disabled`. |
| **First-time Pro** | User just switched to Pro | Downstream AGT-DSH-002 guided tour fires (owned by DSH-002, not this brief). |
| **Nudge banner armed** | Threshold met on AGT-DSH-001 load | Banner renders above urgent card. |
| **Nudge dismissed** | User clicks X on banner | Banner fades, 90-day cooldown starts. |
| **RTL** | Locale = ar | Cards mirror; chip moves to left of avatar; check icon moves to top-left. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap; selected-card border stays legible. |

---

## Accessibility

- Radio group has `role="radiogroup"` with `aria-labelledby` pointing at the section title.
- Each card is a `role="radio"` with `aria-checked` reflecting state, and `aria-disabled="true"` when disabled at <768px on the Pro card.
- Current-mode line uses `aria-live="polite"` and announces on change ("You're now in Pro mode").
- Chip has `aria-label="Interface mode: {mode}. Click to change."`
- Try-Pro banner has `role="region"` + labeled dismiss button.
- Focus rings via base CSS two-tone Broadcast — do not override.
- Every tap target ≥44px including the chip and dismiss X.
- Reduced-motion: 200ms transition becomes instant flip; no fade on chip update.

---

## Anti-patterns — do NOT do

- ❌ Do not hide the Pro card on mobile. Visible + disabled + explained is trustworthy; hidden is not.
- ❌ Do not use a `<Switch>` primitive (Guided/Pro is a categorical choice, not a boolean state flip; two cards make the trade-off legible).
- ❌ Do not require a Save button. Immediate switch is expected.
- ❌ Do not persist ui_mode client-side only (localStorage). Server is source of truth per the AGT-DSH-002 layout persistence contract.
- ❌ Do not fire the Try-Pro nudge on mobile — Pro isn't available there. Same threshold logic but gated on viewport at nudge time.
- ❌ Do not repeat the nudge more than once per 90 days after dismiss — respects user's choice.
- ❌ Do not use a modal for the switch confirmation. It's a preference, not a destructive action.
- ❌ Do not surface Pro-only shortcuts (`?`, `⌘K`) inside the Guided help hint — those belong on the Pro dashboard tour.

---

## Backend contract

**Endpoint (existing extension):** `PATCH /api/users/me`

Extended body accepts:
```json
{ "ui_mode": "guided" | "pro" }
```

Server writes to `tenant_memberships.data.ui_mode` for the acting tenant context — per AGT-DSH-002 note ("preference persisted server-side per tenant context; different mode per tenant an agent could be Guided in personal, Pro in agency"). The `tenant_memberships` table exists via migration 028; the `data` JSONB column absorbs the write.

**Alternative (per-user global preference):** `users.data.ui_mode`. If the acting tenant has no per-tenant override, server falls back to the user-level default. This lets a user set Pro as their "always" preference while still allowing per-tenant overrides.

**Response 200:**
```json
{
  "user": { "id": "...", "data": { "ui_mode": "pro", ... } },
  "tenant_membership": { "tenant_id": "...", "data": { "ui_mode": "pro", "dashboard_layout": [...] } }
}
```

**No new column required** — `users.data` (migration 002) and `tenant_memberships.data` (migration 028) are both JSONB and can hold `ui_mode` + related fields (`pro_nudge_dismissed_at`, `pro_tour_seen`, `dashboard_layout`, `dashboard_density`, `saved_views`, `column_prefs`). See §Notes at end of this brief.

**GET side:** `GET /api/users/me` returns the merged effective `ui_mode` for the current tenant context (per-tenant override → user-level default → 'guided').

---

## Downstream implementation

- **File:** `web/src/pages/SettingsPage.tsx` (or the AGT-SET-001 settings home) → add `<InterfaceModeCard>` section.
- **New components:**
  - `web/src/components/settings/InterfaceModeCard.tsx` — the two-card radio group.
  - `web/src/components/nav/ModeChip.tsx` — the persistent top-bar chip.
  - `web/src/components/dashboard/TryProNudgeBanner.tsx` — the Dashboard nudge.
- **Context extension:** extend the existing `BrandContext` (or a new `UiModeContext`) to expose `mode: 'guided' | 'pro'`, `setMode(next)`, `isProCapable: boolean` (viewport-derived), and `effectiveMode: 'guided' | 'pro'` (= `mode === 'pro' && isProCapable ? 'pro' : 'guided'`).
- **Hook:** `web/src/hooks/useIsProCapable.ts` — window-matchmedia watcher on `(min-width: 768px)`, shared with AGT-DSH-002 + AGT-LST-002.
- **PATCH client:** `web/src/api/users.ts` extended with `updateUiMode(mode)`.
- **Nudge gating:** `web/src/components/dashboard/TryProNudgeBanner.tsx` reads `mode`, listing count, `pro_nudge_dismissed_at`, and viewport. Only renders when all conditions met.
- **Tests:**
  - Unit: `InterfaceModeCard` selection triggers PATCH; Pro disabled at <768px.
  - Unit: `ModeChip` renders both variants; mobile-Pro tooltip fires.
  - Integration: switch to Pro on desktop → arrive at Pro dashboard route; shrink viewport → renders Guided; grow again → renders Pro; server value unchanged throughout.
  - Integration: Try-Pro nudge fires on the correct thresholds; dismiss records timestamp; doesn't re-fire for 90 days.
  - RTL: chip mirrors to left of avatar.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.

---

## Broadcast alignment callouts

- Mode cards: unselected `border: 1px solid var(--lc-border)`; selected `border: 2px solid var(--lc-action-primary)` + `background: var(--lc-surface-selected)`.
- Card icon tile: 32×32 in `--lc-surface-sunken` with icon in `--lc-text-heading`.
- Selected check: `Check` icon in `--lc-action-primary`, top-right of card.
- Current-mode glyph: unicode `○` (Guided) / `◆` (Pro) — matches Broadcast status glyph vocabulary.
- Top-bar chip Guided variant: `--lc-surface-sunken` + `--lc-text-secondary`; Pro variant: transparent + `1px solid var(--lc-accent-bold-edge)` + `--lc-accent-bold-edge` text.
- Try-Pro banner: `--lc-action-primary` background + `--lc-action-primary-text` ink; dismiss X in `--lc-action-primary-text` at 70% opacity.
- Motion: card select `--lc-duration-fast` (120ms); app-wide mode transition `--lc-duration-base` (180ms); banner dismiss `--lc-duration-fast` fade.
- Focus rings via base CSS two-tone — do not override.
- Radii: cards `--lc-radius-lg`; chip `--lc-radius-pill`; banner `--lc-radius-md`.
- Reduced-motion respected on all transitions.

---

## Handoff instruction to v0

Framing prompt:

```
I'm designing the interface-mode toggle for a MENA real-estate B2B SaaS (WingCaster). Two modes: Guided (default, big buttons) and Pro (dense tables, keyboard shortcuts). Pro is only available at ≥768px viewport — mobile shows the Pro card DISABLED with a helper explaining why. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

First pass: render the DESKTOP 1440px settings-card layout. Section title "Interface mode", current-mode line "○ You're in Guided mode", two cards side-by-side (Guided selected with orange border + check; Pro unselected). Helper line below. Follow Broadcast tokens.

Follow-ups: (2) same card at mobile 375px with Pro card DISABLED + helper. (3) Top-bar chip variants — Guided (muted) and Pro (accent outline) — shown in a mock top-nav. (4) Try-Pro nudge banner on the Dashboard (above the urgent card). (5) RTL Arabic desktop. (6) Dark mode. (7) Switching-in-progress state (spinner on selected card).
```

---

## Definition of done

- [ ] v0 produced 7 iteration states (desktop LTR, mobile disabled, chip variants, Try-Pro banner, RTL, dark, switching).
- [ ] Screenshots under `docs/design/mockups/AGT-SET-002-<state>.png`.
- [ ] JSX exports under `docs/design/mockups/v0-outputs/AGT-SET-002/`.
- [ ] Cursor Wave-8 prompt references this brief + AGT-DSH-002 + AGT-LST-002.
- [ ] `PATCH /api/users/me` extension verified in `backend/src/routes/users.ts` (or new endpoint filed as `[BE-BLOCKER-XX]` in kickoff if missing).
- [ ] `useIsProCapable` viewport gate shared with DSH-002 + LST-002.
- [ ] `no-raw-hex.test.ts` green.

---

## Notes — schema audit

`users.ui_prefs` as a **dedicated JSONB column** does NOT exist in migrations 002 / 017 / 028. What exists:
- `users.data` JSONB (migration 002 line 12, `NOT NULL DEFAULT '{}'::jsonb`) — user-level catch-all.
- `tenant_memberships.data` JSONB (migration 028) — per-user × per-tenant catch-all.

Both are sufficient to store `ui_mode`, `pro_nudge_dismissed_at`, `pro_tour_seen`, `dashboard_layout`, `dashboard_density`, `saved_views`, `column_prefs`. **No new column or migration required** — just PATCH endpoint extension. If the team wants to promote `ui_prefs` to a dedicated column later for indexing or query ergonomics, that's a Phase-2 refactor, not a Wave-8 blocker.
