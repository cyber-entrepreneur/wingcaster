# Screen Brief — AGT-DSH-002 · Agent Dashboard (Pro, tablet + desktop)

**Layer-2 Brief for design AI consumption. DELTA on `AGT-DSH-001-agent-dashboard-mobile-brief.md`.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-DSH-002`. Wave 8+ per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 4 row 19. Reads as a DELTA on the AGT-DSH-001 anchor — do not restate what AGT-DSH-001 already covers (greeting logic, urgent-card taxonomy, quota strip, empty state, copy voice, backend endpoints).

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. See AGT-DSH-001 §Broadcast alignment for the greeting / urgent-card / quota-strip / signal-lamp callouts — every one of those tokens carries over.

**Screen-specific Pro-mode Broadcast callouts:**
- Widget-grid gutters: `--lc-space-md` (16px). Widget outer padding: `--lc-space-lg` (20px).
- Widget cards: `--lc-surface-raised` + `--lc-elevation-sm`. Radii `--lc-radius-lg` (7px).
- Widget titles: `var(--lc-type-heading-3)` — never `heading-1` (Pro is dense; loud headings break density).
- KPI value: `var(--lc-type-display)` + `--lc-font-mono` via `<Numeric>`. Trend delta: `--lc-status-published-fg` for up, `--lc-status-unpublished-fg` for down, glyph + label required (never color alone).
- Keyboard-shortcut palette (`?`): `<Dialog>` with `--lc-elevation-lg`, key chips in `--lc-surface-sunken` with `--lc-type-data-sm`.
- Quick-actions bar (sticky top): `--lc-surface-raised` + `--lc-border` bottom hairline. Buttons `<Button size="default">` — never below 44px.
- Drag-handle affordance (widget top-right, only on hover): `GripVertical` icon in `--lc-text-muted`, becomes `--lc-text-brand` while dragging.
- Drop-zone highlight during drag: 2px dashed border in `--lc-action-primary` + `--lc-surface-selected` fill.
- Density toggle chip group in the top bar: compact / comfortable / spacious — active chip `--lc-action-primary` + `--lc-action-primary-text`.
- Command palette (`⌘K`) reuses SHR-NAV-005 primitive — do NOT redesign here.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-DSH-002 |
| Screen name | Dashboard (Pro) |
| Persona | Agent (Pro mode opt-in) |
| Device targets | Tablet 768px + Desktop 1440px ONLY — per D-S-06 |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/dashboard` when `tenant_memberships.data.ui_mode = 'pro'` AND viewport ≥768px |
| Mode | Pro (Guided variant is AGT-DSH-001) |
| Current state | MISSING — Wave 8+ delivery. |
| Delta from | AGT-DSH-001 (anchor). Same data endpoints, denser layout, keyboard-first, drag-to-arrange widgets, quick-actions bar always visible. |

---

## Breakpoint policy (D-S-06 — non-negotiable)

**Pro mode renders ONLY at viewport ≥768px.** Below 768px the Pro dashboard route falls back to AGT-DSH-001 Guided rendering, silently and without a toast. Server-side `ui_mode = 'pro'` is preserved — the user does NOT lose their preference by opening the app on a phone. When they next open on tablet or desktop, Pro returns.

**Fallback behavior at <768px:**
- Route resolves to `/dashboard` → renders AGT-DSH-001 shell.
- A small `Pro` chip appears next to the greeting: "Pro mode is available on tablet or larger screens" (tooltip on tap). No modal, no interstitial.
- The AGT-SET-002 mode-toggle chip in the top bar is HIDDEN on mobile Pro users (they don't need it — they're on Guided at this size).
- Server `ui_mode` value never changes from this fallback.

---

## Purpose

Power-user dashboard for the daily-active agent who has 20+ listings and treats WingCaster as their operational cockpit. Same data as Guided (AGT-DSH-001), same priority signals, but arranged for speed: multi-widget grid, drag-to-arrange, keyboard shortcuts, always-visible quick-actions bar, dense KPI cards, less illustration and greeting warmth.

---

## Layout — delta on AGT-DSH-001

### Tablet 768-1279px

Three-column widget grid (12-col system, most widgets span 4 cols). Top: quick-actions bar (persistent, sticky). Below: greeting + density chip cluster in one row. Below: the widget grid.

- Quick-actions bar: `+ New listing` · `+ Contact` · `+ Task` · `Publish` · `Inbox` · `Search (/)`. Icons + labels; 44px height. Right-aligned: density chips (compact / comfortable / spacious) + `Add widget +`.
- Greeting row: `Good morning, Sara` (`heading-2`, not `display` — Pro is dense) + date sub + tenant-context pill (personal/agency).
- Widget grid: 3 columns × N rows. Default widgets on first-Pro entry: KPI row (4 KPI cards spanning 3 cols each in one row = full width, but each card is small), Urgent card (spans 8 cols), Quota strip (spans 4 cols), Recent listings (spans 12 cols, horizontal-scroll internally), Today's tasks (spans 6 cols), Inbox preview (spans 6 cols), Recent activity (spans 12 cols).

### Desktop 1280px+

Four-column widget grid (12-col system, most widgets span 3 cols; wide widgets span 6 or 12). Same quick-actions bar; density chips visible. Right rail (280px) reserved for the **widget palette drawer** — opens from the `Add widget +` button, docks right, does not overlap grid.

- Widget palette drawer contents: categorized list of widget types (KPIs / Funnels / Listings / Inbox / Tasks / Calendar / Credits / Pipeline). Drag from drawer onto the grid — drop zones highlight during drag.
- Fullscreen a widget: keyboard `1-9` OR click the fullscreen icon in widget header. Widget takes over the grid area; Escape returns.

### Widget grid mechanics

- **12-column responsive grid** (react-grid-layout OR custom flex+grid). Row height auto per widget content, snap to 40px vertical grid.
- **Drag-to-arrange:** grab the drag handle (top-right, GripVertical icon, only visible on widget hover). Drop targets highlighted with dashed border. Debounced 300ms auto-save on drop.
- **Resize:** widget corner grip; widths snap to 3/4/6/8/12 cols; heights snap to 40px increments.
- **Layout persistence:** stored server-side in `tenant_memberships.data.dashboard_layout` per user × tenant context. Syncs across devices on next login.
- **Multi-device conflict:** last-write-wins with a toast "Your layout changed on another device — refresh to see the latest".
- **Reset to default** in the overflow menu (top-right of quick-actions bar).

### Widget types (Pro)

- **KPI card** (small, span 3 cols): value + label + trend delta with glyph. Click drills into source screen. E.g., "Active listings · 42 · ↑ 3 from last week".
- **Urgent card** (span 8 cols): SAME content as AGT-DSH-001 §Zone 3 — do not redesign. Just wider.
- **Quota strip widget** (span 4 or 12 cols): same as AGT-DSH-001 §Zone 4 but rendered as a multi-feature stack when full-width.
- **Recent listings widget** (span 6 or 12): horizontal-scroll cards from AGT-DSH-001 §Zone 5.
- **Today's tasks widget** (span 6): task rows from AGT-DSH-001 §Zone 6, denser.
- **Inbox preview widget** (span 6): last 5 unread threads with sender + snippet + source badge.
- **Recent activity widget** (span 12): 20-row activity stream, filterable by type.
- **Funnel widget** (span 6): leads → viewings → offers → closed. Horizontal bar chart per stage.
- **Pipeline value estimate** (span 3): single KPI card variant with a small sparkline.
- **Calendar widget** (span 6): upcoming viewings (next 7 days).
- **Bazaar-driven-leads counter** (span 3): KPI card variant.

---

## Explicit copy (delta only)

Reuse everything from AGT-DSH-001 copy table. Additions:

| Slot | Copy |
|---|---|
| Quick-actions bar labels | New listing · Contact · Task · Publish · Inbox · Search |
| Density chips | Compact · Comfortable · Spacious |
| Add widget button | Add widget + |
| Widget palette drawer heading | Add a widget |
| Widget palette categories | KPIs · Funnels · Listings · Inbox · Tasks · Calendar · Credits · Pipeline |
| Fullscreen tooltip | Press {N} or click to fullscreen |
| Shortcuts palette title | Keyboard shortcuts |
| Shortcuts palette hint | Press `?` any time to reopen |
| Reset layout confirm | Reset dashboard to default layout? Your current arrangement will be lost. |
| Multi-device conflict toast | Your layout changed on another device. Refresh to see the latest. |
| Pro-fallback tooltip (<768px) | Pro mode is available on tablet or larger screens. |
| Empty grid nudge | No widgets yet. Press `Add widget +` or use `/` to search. |

Arabic mirrors: `[TRANSLATION-PENDING]` in the AR mirror MDX for the delta strings. AGT-DSH-001 Arabic strings carry over unchanged.

---

## Component palette (delta)

Reuse everything from AGT-DSH-001. Additions:

| Element | Primitive |
|---|---|
| Widget grid engine | `react-grid-layout` (already candidate for `web/src/components/dashboard/WidgetGrid.tsx`) |
| Widget frame | New `<WidgetCard>` — extends `<Card>` with a header row (title + drag handle + fullscreen + overflow) |
| Quick-actions bar | New `<QuickActionsBar>` — sticky wrapper of `<Button>` primitives |
| Density chip group | `<ToggleGroup>` (Radix) — three-option single-select |
| Widget palette drawer | `<Sheet side="right">` on desktop; falls back to `<Sheet side="bottom">` on tablet portrait |
| Shortcuts palette | `<Dialog>` opened by `?` |
| Command palette | `<CommandDialog>` via SHR-NAV-005 (do not redesign) |
| KPI card | New `<KpiCard>` — value in `<Numeric>` + label + trend delta with `TrendingUp`/`TrendingDown` glyph |
| Funnel widget chart | Recharts `BarChart` (horizontal) with Broadcast token colors |
| Sparkline | Recharts `LineChart` (compact, no axes) |

Icons: `GripVertical`, `Maximize2`, `MoreHorizontal`, `Plus`, `Search`, `TrendingUp`, `TrendingDown`.

---

## Interactions

- **Drag widget:** grab drag handle → dashed drop-zone highlights → release to place. Auto-save 300ms after drop. Ctrl+drag ignores snap grid (advanced).
- **Resize widget:** grab corner grip → live snap indicators at 3/4/6/8/12 cols. Save on release.
- **Add widget:** `Add widget +` opens the palette drawer → drag onto grid OR click a palette item to drop into first empty grid slot.
- **Remove widget:** widget overflow menu → Remove. Confirmation only when the widget was recently added (avoid annoying frequent power-users).
- **Fullscreen widget:** click fullscreen icon OR press `1-9` (widget index). Escape returns. State: `?widget=<id>` query param so the URL is shareable.
- **Density toggle:** compact / comfortable / spacious — instant re-render, no reload. Persisted server-side alongside layout.
- **Keyboard shortcuts (delta):**
  - `?` open shortcuts palette
  - `⌘K` global command palette (SHR-NAV-005)
  - `/` focus global search
  - `G+D` navigate Dashboard · `G+I` Inbox · `G+L` Listings · `G+C` Contacts · `G+T` Tasks
  - `1-9` fullscreen widget N
  - `E` edit-mode toggle (enables drag/resize handles by default when off)
  - `Escape` exit fullscreen / edit-mode / drawer

- **Quick-actions bar buttons:** each opens the same route/sheet as its Guided FAB equivalent (Add listing → AGT-LST-004; Contact → AGT-CTC-003; Task → AGT-TSK-002; Publish → AGT-PUB-001; Inbox → AGT-INB-001; Search → focus input).

- **Auto-nudge downgrade to Guided:** never nudge Pro users back to Guided. Once opted in, they stay unless they toggle.

---

## State variants (delta)

| Variant | Trigger | Behavior |
|---|---|---|
| **First-time Pro** | User just opted into Pro via AGT-SET-002 | Guided tour overlay (Popover cascade, 4 steps): "Drag widgets to rearrange" → "Press `?` for shortcuts" → "Click `Add widget +` to customize" → "Toggle density here". Dismissable; never shows again per user (flag on `users.data.pro_tour_seen = true`). |
| **Empty grid** | User removed all widgets | Centered nudge card: "No widgets yet. Press `Add widget +` or use `/` to search." + big `Add widget` CTA. |
| **Drag-in-progress** | User dragging a widget | Dashed drop zones visible; other widgets dim to 40% opacity; drop targets highlight in `--lc-action-primary`. |
| **Layout-save in-flight** | Debounced save after drop/resize | Small "Saving…" chip in top bar; becomes "Saved" for 1s then fades. Never blocks interaction. |
| **Layout-save failed** | Server 500 on layout persist | Toast: "Layout couldn't save. Retrying…" Retry auto up to 3× then destructive toast "Layout not saved. Try again?" with retry button. |
| **Multi-device conflict** | Layout was changed on another device | Non-blocking toast "Your layout changed on another device. Refresh to see the latest." + refresh CTA. |
| **Widget data error** | Any single widget's data endpoint fails | That widget shows an error tile with retry button. Other widgets render normally. |
| **<768px fallback** | Viewport shrinks below 768px | Route silently switches to AGT-DSH-001 render. Server `ui_mode` preserved. |
| **Loading — page** | Route resolving | Skeleton grid (3 or 4 columns of placeholder cards). |
| **Loading — widget** | Single widget's data fetching | Skeleton state inside the widget frame. |
| **RTL** | Locale = ar | Grid mirrors L↔R; drag handle moves to top-left; palette drawer opens from left. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; drop-zone highlight stays legible against the darker surface. |

---

## Accessibility

- Every widget's title is an `<h3>` — screen-reader landmark structure preserved.
- Drag-and-drop reachable via keyboard: `Tab` to drag handle → `Space` to lift → arrow keys to move → `Space` to drop → `Escape` to cancel. Announce via `aria-live` region ("Widget lifted", "Moved to column 2 row 3", "Widget dropped").
- All keyboard shortcuts documented in the `?` palette; palette is itself keyboard-navigable.
- Focus rings via base CSS (two-tone Broadcast) on every widget frame + interactive control.
- Density chip group: `role="radiogroup"` with named radios.
- Fullscreen widget: `role="dialog"` semantics + focus trap + Escape close.
- Reduced motion: drag/drop animations shorten to instant snap; skeleton pulses become static.
- Every tap target ≥44px (density toggle does NOT shrink buttons below floor).

---

## Backend contract (delta)

**Same data endpoints as AGT-DSH-001** — `GET /api/dashboard/stats` (or the split urgent / quota-headliner / activity-feed endpoints). Do NOT introduce new data endpoints for Pro.

**New: layout persistence.**

`GET /api/users/me/dashboard-layout?tenant_id=<tid>` returns:
```json
{ "layout": [{"id":"kpi-active-listings","x":0,"y":0,"w":3,"h":2}, ...], "density": "comfortable", "updated_at": "..." }
```

`PATCH /api/users/me/dashboard-layout` accepts:
```json
{ "tenant_id": "...", "layout": [...], "density": "compact" | "comfortable" | "spacious" }
```

Persisted at `tenant_memberships.data.dashboard_layout` (per user × tenant context) per the matrix note. The `tenant_memberships` table exists via migration 028; no schema change required — the `data` JSONB column absorbs it.

**Widget-list catalog** is a static frontend enum; not fetched from server (avoids one round-trip on first paint).

---

## Downstream implementation

- **New page state:** `web/src/pages/AgentDashboardPage.tsx` — branch on `useMode()` context + viewport width. At ≥768px + `ui_mode='pro'` render `<ProDashboard>`; otherwise render existing Guided.
- **New components:**
  - `web/src/components/dashboard/pro/WidgetGrid.tsx` — react-grid-layout wrapper + drop-zone visuals.
  - `web/src/components/dashboard/pro/WidgetCard.tsx` — frame with header + drag handle + fullscreen + overflow.
  - `web/src/components/dashboard/pro/QuickActionsBar.tsx` — sticky top bar.
  - `web/src/components/dashboard/pro/WidgetPaletteDrawer.tsx` — right-side drawer.
  - `web/src/components/dashboard/pro/ShortcutsPalette.tsx` — `?`-triggered Dialog.
  - `web/src/components/dashboard/pro/KpiCard.tsx` — small KPI tile.
  - `web/src/components/dashboard/pro/widgets/*` — one file per widget type.
- **Hook:** `web/src/hooks/useDashboardLayout.ts` — reads/writes layout via PATCH, debounces saves, handles multi-device conflict toast.
- **Keyboard shortcut layer:** register global shortcuts in `web/src/hooks/useDashboardShortcuts.ts` — cleans up on unmount.
- **Viewport gate:** `web/src/hooks/useIsProCapable.ts` — returns `false` below 768px; drives silent fallback.
- **Tests:**
  - Unit: WidgetGrid drop-zone visual states; useDashboardLayout debounce + retry; viewport-gate below/above breakpoint.
  - Integration: full Pro flow — opt in via AGT-SET-002, arrive on `/dashboard`, drag a widget, verify PATCH fires, reload, verify layout persisted.
  - Regression: at <768px + `ui_mode='pro'`, route renders Guided shell (no Pro DOM present).
  - RTL: drag handle moves to top-left, palette drawer opens from left.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.

---

## Broadcast alignment callouts

- Widget frames: `--lc-surface-raised` + `--lc-elevation-sm` + `--lc-radius-lg`. No 12+px radii.
- KPI values: `<Numeric>` in `--lc-type-display`; trend delta with glyph (`TrendingUp`/`TrendingDown`) + label ("+3 vs last week"), never color alone.
- Quick-actions bar: `--lc-surface-raised` + `--lc-border` bottom hairline; buttons keep 44px floor.
- Density chip group: active chip `--lc-action-primary` + `--lc-action-primary-text`; inactive `--lc-surface-sunken` + `--lc-text-muted`.
- Drag handle: `--lc-text-muted` idle; `--lc-text-brand` while dragging.
- Drop-zone: 2px dashed `--lc-action-primary` border + `--lc-surface-selected` fill.
- Motion: drag/resize `--lc-duration-fast` snap; palette drawer `--lc-duration-slow` slide-in with `--lc-easing-out`. Fullscreen widget expand `--lc-duration-base`.
- Focus rings: two-tone via base CSS — do not override.
- Signal lamp still reserved for the "listing went live" moment inside the urgent card widget only.

---

## Handoff instruction to v0

Paste this brief + AGT-DSH-001 brief in full into a fresh v0.app chat. Framing prompt:

```
I'm designing the Pro-mode dashboard for a MENA real-estate B2B SaaS (WingCaster). This is a DELTA on the Guided mobile dashboard (also pasted). Pro renders ONLY at ≥768px viewport — mobile falls back to Guided silently. Stack: React 18 + shadcn/ui + Radix + react-grid-layout + lucide-react + Tailwind.

First pass: render the DESKTOP 1440px layout. Sticky quick-actions bar at top (New listing / Contact / Task / Publish / Inbox / Search + density chips + Add widget). Below: greeting "Good morning, Sara" + date + personal/agency pill. Below: 4-column widget grid with (a) 4 KPI cards row, (b) urgent card (span 8) + quota strip (span 4), (c) recent listings (span 6) + inbox preview (span 6), (d) today's tasks (span 6) + funnel widget (span 6), (e) recent activity (span 12). Every KPI uses tabular-nums mono. Follow Broadcast tokens (already loaded).

LTR English only for pass 1. Follow-ups: tablet 768px 3-col grid, drag-in-progress state, widget palette drawer open, shortcuts palette open, dark mode, RTL, <768px fallback showing Guided render.
```

---

## Definition of done

- [ ] v0 produced all 7 iteration states (desktop LTR, tablet LTR, drag-in-progress, palette drawer open, shortcuts palette open, dark, RTL, <768px Guided-fallback).
- [ ] Screenshots under `docs/design/mockups/AGT-DSH-002-<state>.png`.
- [ ] JSX exports under `docs/design/mockups/v0-outputs/AGT-DSH-002/`.
- [ ] Cursor Wave-8 prompt references this brief + AGT-DSH-001 + AGT-SET-002.
- [ ] `no-raw-hex.test.ts` green; `useIsProCapable` viewport gate covered by integration test.
