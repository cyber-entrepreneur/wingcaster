# Screen Brief — AGT-PUB-006 · Portal submission tracker (rolling multi-job status view)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §4 entry `AGT-PUB-006`. Week 2 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 24. Ships in the WF-03 cluster PR pair alongside AGT-PUB-003 (single-job receipt), PA-MOD-001 (moderation queue), PA-MOD-002 (moderation detail). Blocked by `[BE-BLOCKER-01]` (portal publishers stubbed), `[BE-BLOCKER-03]` (`error_class` schema), `[BE-DESIGN-01]` (dynamic `portal_registry`) — see §Backend contract.

**Distinct from AGT-PUB-003.** AGT-PUB-003 is the single-job outcome receipt shown as a drawer immediately after a publish action (one listing × one publish command × N channels — the immediate "what did I just pay for?" screen). AGT-PUB-006 is the LONGITUDINAL tracker showing status of every portal submission attempt across every listing over time (list of rows, one per `(listing × portal × attempt)`, filterable, paginated). A row click on AGT-PUB-006 opens AGT-PUB-003 for that specific job. Do not conflate the two — they are the fresh-receipt and the ledger surfaces respectively.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii / elevation references below are governed by that reference. Never introduce raw hex, never introduce a `--lc-orange-*` primitive alias, never use a Tailwind palette class that isn't already remapped to a Broadcast semantic in `web/tailwind.config.js`.

**Screen-specific Broadcast callouts:**

- **Screen title** ("Portal submissions"): `var(--lc-type-heading-1)` desktop / `heading-2` mobile.
- **KPI strip cards** (Total this month / Success rate / Credits spent / Top failure class):
  - Card surface `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)`.
  - Metric label `var(--lc-type-overline)` + `--lc-text-muted`.
  - Metric value `var(--lc-type-display)` (Archivo 800 32/38) via `<Numeric>` for numerals; text portion (e.g. failure class label like "Rules violation") stays in `var(--lc-font-ui)`.
  - No signal-lamp pulse here (reserved for the "listing went live" moment only).
- **Filter bar** — full-width sticky under the KPI strip on scroll:
  - Container `--lc-surface-raised` + bottom-border `--lc-border`.
  - Chip filters (Status / Portal) use `<Badge variant="outline">` with a small `X` remove icon; active chip fill `--lc-surface-selected` + border `--lc-action-primary`.
  - Listing autocomplete input uses `<Input>` with `--lc-border-strong`.
  - Date-range picker uses shadcn `<DateRangePicker>` (composed from Radix Popover + `react-day-picker`), calendar surface `--lc-surface-raised` + `--lc-elevation-md`.
- **Row layout — status pill** (never color-alone; always tint + glyph + label):
  - `SUBMITTED` → `--lc-status-draft-bg` / `--lc-status-draft-fg` / glyph `Send` (lucide-react).
  - `IN_REVIEW` → `--lc-accent-bold` bg with `--lc-accent-bold-edge` outline (accent bold ALWAYS needs a boundary) + `--lc-accent-bold-text` ink + glyph `Eye`.
  - `LIVE` → `--lc-status-published-bg` / `--lc-status-published-fg` / glyph `CheckCircle2` (● glyph mandatory per Broadcast reference — status pill carries it before the label).
  - `REJECTED` → `--lc-status-closed-bg` / `--lc-status-closed-fg` / glyph `XCircle`. NEVER `--lc-status-danger` alone (rejection is a decision, not an error — inherited from AGT-REC-004 anchor discipline).
  - `EXPIRED` → `--lc-status-archived-bg` / `--lc-status-archived-fg` / glyph `Hourglass` + `--lc-text-muted` ink.
  - `FAILED` → `--lc-status-danger-bg` / `--lc-status-danger-fg` / glyph `AlertOctagon`. This IS the error case (portal-side or platform-side technical failure — distinct from `REJECTED` which is a moderator/portal-editor decision).
- **Row layout — portal mark**: `<ChannelMark size={24}>` — pairs `--lc-channel-<code>` bg with `--lc-channel-<code>-on` ink per Broadcast reference. If the portal has no registered channel token yet (added via `portal_registry` after Week 2 launch), fall back to a neutral `--lc-surface-sunken` square with 2-letter monogram in `--lc-text-primary`.
- **Row layout — listing thumbnail**: 48×48 on mobile, 56×56 on desktop. `var(--lc-radius-md)`. Fallback to a `--lc-surface-sunken` square with `Home` lucide glyph in `--lc-text-muted` if no photo.
- **Row layout — numeric fields** (`submitted_at`, credits): `<Numeric>` — mono + tabular-nums. Always.
- **Row layout — action button** on the right: `<Button variant="ghost" size="sm">` with the arrow-right chevron. Full row is also clickable — the ghost button is a redundant affordance for the a11y "action per row" pattern.
- **Empty state illustration**: no fabricated success screenshots; use a neutral gradient card + `Send` glyph 64×64 in `--lc-text-muted` + explanatory copy + primary CTA. Illustration keeps `var(--lc-radius-xl)` (10px, still tight — no 16+px rounding).
- **Pagination**: cursor-based "Load more" button at bottom (`<Button variant="outline">`) — infinite-scroll deferred to Phase 2 per matrix. Loading spinner uses `Loader2` from lucide-react.
- **Motion**: row hover surface tint 120ms `var(--lc-easing-out)`. Status pill flip on live update (see §Interactions) cross-fades at `var(--lc-duration-base)` — no signal lamp. Respect `prefers-reduced-motion`.
- **Focus rings + 44px tap floor**: automatic via base CSS. Do not override.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-PUB-006 |
| Screen name | Portal submission tracker |
| Persona | Agent (has active listings + at least one portal submission) |
| Device targets | Mobile 375px (primary — agents check portal status from the field), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/publishing/tracker` (canonical). Also reachable as a deep-link from AGT-LST-011 publications tab "See all across listings →" and from SHR-NAV-003 bottom-tab "Publishing" menu. |
| Current state | MISSING — must ship as P0 with the WF-03 cluster (Week 2 per Rev 9). |
| Workflow role | WF-03 role=Recipient (rolling view). Complements AGT-PUB-003 (single-job receipt) with the multi-job ledger surface. |
| Backend prerequisites | ⏳ `[BE-BLOCKER-01]` PF Group publisher adapter · ⏳ `[BE-BLOCKER-03]` `distribution_attempts.error_class` CHECK enum · ⏳ `[BE-DESIGN-01]` dynamic `portal_registry` · ⏳ **NEW `[BE-BLOCKER-10]`** `GET /api/publishing/tracker` list endpoint + `GET /api/publishing/tracker/summary` aggregate KPI endpoint · ⏳ **NEW `[BE-BLOCKER-11]`** push-notification template `portal_submission.status_changed` (piggybacks existing dispatcher — one template row) |

---

## Purpose

An agent needs one screen to answer: "Of everything I submitted to Bayut / Property Finder / Dubizzle / Aqar this month — what's live, what's stuck, what got rejected, and what did I pay for it?" Without this screen, AGT-PUB-003 (the single-job receipt) is a firehose of one-off drawers with no rollup — the agent has to remember every submission and check them individually via AGT-LST-011's per-listing publications tab.

**AGT-PUB-006 is the ledger.** One row per submission attempt (`(listing × portal × attempt_number)`), sorted newest first, filterable by status / portal / listing / date range, with a KPI strip that tells the agent at a glance whether their portal presence is healthy this month.

Emotional stakes: **trust in the metered surface.** Portal submissions are the primary metered revenue vertical (per matrix §Notes on AGT-PUB-003). Every submission the agent can't account for is a support ticket + a churn risk + a lost credit charge. This screen is the transparency contract.

Success outcomes:
- Agent scans the KPI strip → sees "23 submissions this month · 87% success rate · 46 credits spent · 2 rejected for rules violation" → knows the state of their portal presence in 4 seconds.
- Agent filters to `Status = REJECTED` → sees the 3 rejected rows → taps one → lands in AGT-PUB-003 with retry affordance pre-loaded.
- Agent filters to `Portal = Property Finder + Date = Last 7 days` → verifies their PF submissions cleared cleanly after a recent onboarding flow.
- On live push (submission flipped `IN_REVIEW → LIVE`), the row cross-fades to the new status without the agent leaving the page.

---

## Design goals

1. **KPI strip earns the top 20% of the viewport.** Four metrics, one glance. Total submissions, success rate, credits spent, top failure class. If the strip shows "97% success" the agent trusts the screen and stops scrolling. If it shows "62% success" the agent is now in triage mode and the row list below must let them find the failures fast.
2. **Rows are scannable, not designed.** Every row has the same shape — listing thumbnail + address, portal mark + name, submitted-at timestamp, status pill, credits, chevron. No creative variance. The agent's eye moves down the column, not around the row.
3. **Filters are a bar, not a modal.** Filter chips + listing autocomplete + date-range picker live in a horizontal bar under the KPI strip, sticky on scroll. Never open a filter modal on mobile — that hides context. On mobile the bar horizontally scrolls if it overflows.
4. **Rejection is a decision. Failure is an error.** Two distinct statuses, two distinct token pairs (closed vs danger). Never conflate them. The agent seeing "REJECTED" thinks "moderator declined — fix and resubmit." The agent seeing "FAILED" thinks "system broke — retry or contact support."
5. **Empty states carry the same visual weight as full states.** Empty tracker (agent has never published) gets a warm CTA into AGT-LST-003; filtered-to-empty (agent's filter yielded no rows) gets a "Clear filters" affordance without an illustration. Don't fabricate example rows.
6. **RTL-first for MENA.** Row layout mirrors — thumbnail on the right, chevron on the left. Filter bar mirrors. KPI strip mirrors. Numerics (credits, timestamps) stay LTR bidi-embedded inside RTL text runs.
7. **The row is a link, the button is redundant.** Full-row click opens AGT-PUB-003 for that submission. The right-chevron `<Button variant="ghost">` is an a11y hint for row-level action; both must fire the same handler.

---

## Layout

### Mobile 375px (primary)

Single scrolling column:

1. **Top nav** — sticky bar: back arrow (left) → screen title "Portal submissions" (center) → filter icon (right, opens filter drawer when the sticky filter bar is out of view — otherwise same-page anchor scroll). 48px tall including safe area.
2. **KPI strip** — 2×2 grid of KPI cards, `var(--lc-space-sm)` gutter, `var(--lc-space-md)` padding. Card min-height 88px. Metric value wraps to two lines if needed on 375px (e.g. "Top failure: Rules violation").
3. **Filter bar** — sticky-below-KPI, horizontally scrolling if overflow. Order: `Status` chip (multi-select popover) · `Portal` chip (multi-select popover) · `Listing` autocomplete input (compact 160px wide, expands on focus) · `Date` chip (opens range popover). "Clear all" text link right-aligned when any filter is active.
4. **Row list** — one row per submission attempt, edge-to-edge padding `var(--lc-space-md)`. Row height ~88px (48×48 thumbnail + 2 lines of text + status pill + timestamp). Rows separated by 1px `--lc-border` hairline.
5. **Load more** — `<Button variant="outline">` full-width at bottom of list. Disabled + shows `Loader2` while fetching next page.
6. **Empty states** (see §State variants for the mapping): render inside the row-list area, not stacked below.

**Row anatomy (mobile 375px):**

```
┌────────────────────────────────────────────────────┐
│ [thumb]  Listing address                     [>]  │
│  48×48   Portal name · portal mark 20×20          │
│          [status pill]  ·  02 credits  · 2h ago   │
└────────────────────────────────────────────────────┘
```

- Row 1: listing address (`var(--lc-type-body)` + `--lc-text-primary`), right-aligned chevron button.
- Row 2: portal name + inline `<ChannelMark size={20}>` mark (`var(--lc-type-body-sm)` + `--lc-text-muted`).
- Row 3: status pill (with glyph + label) · credits mono via `<Numeric>` · submitted-at relative time mono via `<Numeric>` with hover for absolute.

### Tablet 768px & Desktop 1440px

Two-region layout, max-width `1200px` centered:

1. **Header region** — screen title (H1) left, "Export CSV" `<Button variant="outline" size="sm">` right (feature gated behind Pro mode + Phase 2; see §Anti-patterns for the mobile stance).
2. **KPI strip** — 1×4 horizontal row, 4 equal-width cards, `var(--lc-space-lg)` gutter.
3. **Filter bar** — full-width horizontal bar, all filters visible without overflow. "Clear all" right-aligned.
4. **Table region** — responsive `<table>` semantics:
   - Column heads (`var(--lc-type-overline)` + `--lc-text-muted`, `--lc-surface-sunken` bg): `Listing` · `Portal` · `Submitted` · `Status` · `Credits` · (action column, no head text).
   - Row height 72px (56×56 thumbnail).
   - Zebra striping OFF (Broadcast tables prefer hairlines only, per existing patterns in web/src/components/ui/table).
5. **Load more** at bottom of table, right-aligned in the row-count footer ("Showing 20 of 143 · Load more").

### RTL

Full mirror. Row thumbnail flips to the right, chevron flips to the left. Column order in the desktop table reverses. Filter bar reverses. KPI strip cell order reverses. Timestamps and credit numerics stay LTR bidi-embedded.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Screen title | Portal submissions |
| KPI 1 label | Submissions this month |
| KPI 2 label | Success rate |
| KPI 3 label | Credits spent |
| KPI 4 label | Top failure class |
| KPI 4 empty value (no failures) | No failures — nice |
| Filter chip — Status | Status |
| Filter chip — Portal | Portal |
| Filter chip — Listing placeholder | Search listings… |
| Filter chip — Date | Date |
| Filter — Clear all | Clear filters |
| Status pill — SUBMITTED | Submitted |
| Status pill — IN_REVIEW | In review |
| Status pill — LIVE | Live |
| Status pill — REJECTED | Not accepted |
| Status pill — EXPIRED | Timed out |
| Status pill — FAILED | Delivery failed |
| Row credits suffix | credits |
| Row action button aria | View submission details |
| Load more button | Load more |
| Load more button (in flight) | Loading… |
| Footer row count | Showing **{shown}** of **{total}** submissions |
| Empty — never published | No portal submissions yet |
| Empty — never published body | When you publish a listing to Bayut, Property Finder or another portal, its status shows up here. |
| Empty — never published CTA | Publish your first listing |
| Empty — filters yield nothing | No submissions match these filters |
| Empty — filters body | Try broadening your date range or clearing a filter. |
| Empty — filters CTA | Clear filters |
| Empty — offline | You're offline |
| Empty — offline body | Reconnect to see up-to-date portal submissions. |
| Empty — offline CTA | Retry |
| Live-update toast | Submission updated |
| Row live-update SR announce | Submission for {listing_address} on {portal_name} is now {status_label} |
| Contact support link (footer) | Something not right? Contact WingCaster support |

---

## Sample content (for v0 / mockup)

Show the **mobile 375px** layout with:
- **KPI strip:** "23 Submissions this month" · "87% Success rate" · "46 Credits spent" · "Rules violation Top failure class".
- **Filter bar:** all filters idle, "Clear filters" hidden.
- **Row 1:** thumbnail placeholder (48×48 grey with `Home` glyph) · "Marina Gate 2 · Apt 1205" · Property Finder mark + "Property Finder" · status pill `Live` (green) · "3 credits" · "2h ago".
- **Row 2:** thumbnail placeholder · "Downtown Views · Villa 4B" · Bayut mark + "Bayut" · status pill `In review` (accent teal with edge) · "3 credits" · "5h ago".
- **Row 3:** thumbnail placeholder · "JBR Sadaf 6 · Studio 811" · Dubizzle mark + "Dubizzle" · status pill `Not accepted` (closed neutral) · "2 credits" · "yesterday".
- **Row 4:** thumbnail placeholder · "Business Bay · Office 22F" · Property Finder mark + "Property Finder" · status pill `Delivery failed` (danger) · "3 credits" · "yesterday".
- **Row 5:** thumbnail placeholder · "Al Barsha · Townhouse 12" · Bayut mark + "Bayut" · status pill `Submitted` (draft) · "3 credits" · "3 days ago".
- **Load more** button below, showing "Showing 5 of 23 · Load more".

Iteration order for v0 after first pass:
1. Same mobile viewport, filter bar shows `Status: Not accepted` chip active + `Clear filters` visible; row list filtered to only the rejected row (row 3 from pass 1). No results below that would confuse the count.
2. Same mobile viewport, EMPTY state — never published. Illustration card centered with `Send` glyph + copy + primary CTA "Publish your first listing".
3. Same mobile viewport, EMPTY state — filters yield nothing. No illustration; just headline + body + "Clear filters" secondary button.
4. Same mobile viewport, LOADING state — KPI strip cards show skeleton shimmer; 5 row skeletons stacked.
5. Same mobile viewport, LIVE-UPDATE — row 2 flips from "In review" to "Live"; cross-fade at `var(--lc-duration-base)`; toast at top of screen "Submission updated".
6. Desktop 1440px, default state (same data as pass 1) — 1×4 KPI strip, full filter bar, table rows.
7. Desktop 1440px, filtered state matching pass 1's iteration 1.
8. RTL Arabic mirror at mobile 375px — same content as pass 1; timeline mirror not applicable (no timeline on this screen), but row thumbnail + chevron sides swap; filter bar reverses.
9. Dark mode desktop, default state — Broadcast tokens swap; orange KPI accents shift to `#FF7440`.
10. Offline banner state — thin banner at top of screen "You're offline — some actions won't work."; row list shows last-cached data; load-more disabled.

Save each output's JSX to `web/src/components/publishing/PortalTrackerScreen/` and screenshot to `docs/design/mockups/AGT-PUB-006-<state>.png`.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Top nav (mobile) | Custom sticky `<header>` — reuse `SHR-NAV-002` mobile top-bar shell |
| KPI strip cards | `Card` + `<Numeric>` value + `var(--lc-type-overline)` label |
| Filter bar container | Custom `<div>` with sticky positioning + `--lc-surface-raised` bg |
| Status/Portal filter chip | `Badge variant="outline"` composed inside a Radix `Popover` for the multi-select checkbox list |
| Multi-select popover contents | Radix `Popover` + shadcn `Command` (search + checkbox list) |
| Listing autocomplete | shadcn `Command` inside a Radix `Popover` — debounced query against `GET /api/listings/search` |
| Date-range picker | shadcn `DateRangePicker` (Radix `Popover` + `react-day-picker`) |
| Clear-all link | `Button variant="link"` |
| Row (mobile) | Custom `<a role="button">` with row semantics; whole row clickable |
| Row (desktop) | `<tr>` inside `web/src/components/ui/table` — reuse existing `<Table>` primitive |
| Status pill | `Badge` variant per Broadcast token map above; pairs glyph + label; NEVER color-only |
| Portal channel mark | `<ChannelMark size={20|24}>` from `web/src/components/ui/channel-mark.tsx`; fallback monogram square if portal not in channel-token registry |
| Listing thumbnail | `<img>` with `object-fit: cover` + `var(--lc-radius-md)`; fallback to a `--lc-surface-sunken` square + `Home` glyph |
| Numeric renders (credits, timestamps, counts) | `<Numeric>` from `web/src/components/ui/numeric.tsx` |
| Row action button | `Button variant="ghost" size="sm"` with `ChevronRight` |
| Load more | `Button variant="outline"` |
| Loading (row + KPI) | `Skeleton` from shadcn |
| Empty state illustrations | Custom card `--lc-surface-raised` + `--lc-elevation-sm` + centered lucide glyph 64×64 + copy stack |
| Live-update toast | `Sonner` |
| Filter drawer (mobile fallback when sticky bar out of view) | shadcn `Sheet` opening from bottom |

---

## Interactions

**On page load:**
- Parallel fetch: `GET /api/publishing/tracker?limit=20` (row list) AND `GET /api/publishing/tracker/summary` (KPI strip aggregate for current-month scope by default).
- If either fails: full-screen error state with retry button. Do NOT render a half-loaded page.
- If both succeed: render KPI strip + rows. If zero rows AND no filters active: empty-never-published state. If zero rows AND filters active: empty-filters-yield-nothing state.

**On filter change:**
- Debounce 200ms.
- Refetch `GET /api/publishing/tracker?<filter-params>` (rows) AND `GET /api/publishing/tracker/summary?<filter-params>` (KPI strip recomputes for the filter scope — so the KPI strip reflects the filtered ledger, not the whole month).
- Query-string reflects filter state so the URL is shareable/refreshable (`?status=rejected,failed&portal=bayut&from=2026-08-01&to=2026-09-07`).

**On listing autocomplete typing:**
- Debounce 300ms. Query `GET /api/listings/search?q=<query>&scope=mine&limit=8`. Rendered as `Command` popover with 8 max suggestions.
- Selecting a listing applies it as a `listing_id` filter chip; the input clears back to placeholder.

**On row click / row Enter key:**
- Navigate to `/publishing/receipts/:distributionAttemptId` — AGT-PUB-003 in retrospective mode (single-job receipt for a historical attempt). AGT-PUB-003 must accept this deep-link entry.

**On chevron button click:**
- Same handler as row click. Explicit for a11y — button has an accessible label.

**On Load more click:**
- POST cursor `after=<last_row_cursor>` to `GET /api/publishing/tracker?after=…&limit=20`. Append rows to bottom.
- If server returns `has_more=false`, hide the Load more button and show a soft "You've reached the end" line in `--lc-text-muted`.

**On live push (websocket / SSE / polling):**
- The client subscribes to the `portal_submission.status_changed` push template for the current user. When a push arrives whose `distribution_attempt_id` matches a currently-rendered row, update that row's status pill inline with a `var(--lc-duration-base)` cross-fade. Fire a `Sonner` toast "Submission updated" (max 1 toast on screen at a time; subsequent live updates within 5s replace the toast rather than stacking).
- If a push arrives whose row is NOT currently rendered (e.g. older row scrolled past load-more): silently increment a `new_since_last_refresh` counter shown as a pill at the top of the list "3 new updates — Refresh" that triggers a full refetch when clicked.
- If `prefers-reduced-motion`: skip the cross-fade, apply the state change instantly.

**On Clear filters click:**
- Reset filter state to defaults; refetch both endpoints; URL query string cleared.

**On Contact support click (footer):**
- Navigate to `SHR-SUP-001` support portal with pre-filled context (`?ref=publishing-tracker&filter_snapshot=<serialized>`). Never open `mailto:`.

**On offline detection (`navigator.onLine === false`):**
- Show top-of-screen thin banner "You're offline — some actions won't work."
- Disable filter mutations + Load more.
- Rows already rendered stay visible (last-cached data). Show a "Last updated {relative}" line under the KPI strip in `--lc-text-muted`.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading — initial** | First fetch in flight | KPI strip: 4 skeleton cards. Row list: 5 skeleton rows. Filter bar interactive but disabled-submission until first load completes. |
| **Loading — filter change** | Filter mutation in flight | KPI strip cards show shimmer; row list dims to 40% opacity + `Loader2` centered above. Prevents flash-of-empty-content while refetching. |
| **Loading — load more** | Cursor page fetch in flight | Existing rows stay rendered; Load more button shows `Loader2` + "Loading…"; disabled. |
| **Empty — never published** | Zero rows + no filters active + never-published flag from server | Illustration card + copy + primary CTA "Publish your first listing" → `/listings` (routes into AGT-LST-003 or the listings index depending on whether the agent has any listings). |
| **Empty — filters yield nothing** | Zero rows + at least one filter active | Headline + body + secondary "Clear filters" button. No illustration. |
| **Empty — offline** | Zero rows AND `navigator.onLine === false` AND no cache | Offline copy + Retry button. |
| **Mixed-status list** | Normal path with heterogeneous statuses | Rows render per status pill mapping. This is the default rendering — the sample content section above depicts this state. |
| **Heavy-load pagination** | Total > 100 submissions | Load more paginates in 20-row pages. Footer shows "Showing {shown} of {total}". If total > 500, show a persistent hint under the filter bar: "Tip: use filters to narrow this list — {total} total submissions." |
| **Live-update — row present** | Push for an on-screen row | Row status pill cross-fades to new status at `var(--lc-duration-base)`. Toast at top. Row jumps to top of list if `sort_by = submitted_at` and status transition changed `updated_at`. |
| **Live-update — row not present** | Push for an off-screen row | Increment "N new updates" pill at top of list. Do not silently refetch. |
| **Row hover (desktop)** | Pointer over row | Row bg tints to `--lc-surface-selected` at 120ms. Cursor becomes pointer. Chevron button subtly darkens. |
| **Row focus (keyboard)** | Tab reaches row | Two-tone focus ring on the whole row (base CSS handles this). |
| **Filter chip active** | Any filter applied | Filter chip fill `--lc-surface-selected` + border `--lc-action-primary`; small `X` remove icon. |
| **Filter drawer open (mobile fallback)** | User taps filter icon in top nav when sticky bar out of view | `Sheet` slides up from bottom with the same filter controls stacked vertically. Apply/Cancel bar at bottom. |
| **Error — fetch failed** | Both endpoints returned non-2xx | Full-screen error state: `AlertOctagon` glyph + "Something went wrong loading your submissions." + Retry button + Contact support link. |
| **Error — partial (KPI ok, rows failed)** | Summary ok, list failed | KPI strip renders; row area shows inline error + Retry (in the row region only, preserving KPI context). |
| **Offline** | `navigator.onLine === false` mid-session | Thin top banner + filter mutations disabled + Load more disabled + "Last updated {relative}" under KPI strip. |
| **RTL** | Locale = ar | Full mirror per §Layout. Numerics remain LTR bidi-embedded. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap automatically. Status pills swap per token kit's dark-mode values. Portal channel marks flip polarity per Broadcast reference. |

---

## Accessibility

- Screen title is a semantic `<h1>`. KPI strip is a `<section aria-label="Portal submissions summary">` containing 4 `<article>` cards each with `<h2>` label + numeric value.
- Filter bar is a `<div role="toolbar" aria-label="Filter portal submissions">`. Each filter chip is a `<button aria-haspopup="dialog" aria-expanded="true|false">`.
- Row list on mobile is a `<ul>` with `<li>` per row; each row contains an `<a role="button">` wrapping the whole row (single tab-stop per row); the chevron action button is `aria-hidden="true"` on mobile because the whole row is the action target.
- Row list on desktop is a `<table>` with `<thead>` + `<tbody>` + `<tr>` semantics. Column heads use `<th scope="col">`. The action column head has `<span class="sr-only">Actions</span>`.
- Every status pill has both a text label AND a glyph — never color-only. Screen reader reads the label ("Live", "Not accepted", "Delivery failed"), not the color.
- Numeric fields render inside `<Numeric>` — mono + tabular-nums. Timestamps have `aria-label` expanding relative to absolute (e.g. `aria-label="2 hours ago, 07 Sep 2026, 14:22"`).
- Live-update toast fires an `aria-live="polite"` announcement: "Submission for {listing_address} on {portal_name} is now {status_label}."
- Filter popovers use Radix `Popover` which handles focus trap + Escape close + focus return.
- Load more button announces "Loading more submissions" via `aria-live="polite"` while in flight; announces "Loaded {n} more submissions" when done.
- Empty states have descriptive headings — screen readers hit the headline first, then the body copy, then the CTA.
- Every tap target ≥ 44×44 CSS px including filter chips and the row chevron button on mobile.
- Focus rings visible on every interactive element — two-tone Broadcast focus ring, do not override.
- Motion respects `prefers-reduced-motion` — skip cross-fades, skip hover tint transitions, apply state instantly.

---

## Anti-patterns (do not do these)

- ❌ Do not render REJECTED with `--lc-status-danger` — it's a decision, not an error. Use `--lc-status-closed-*` per the token map. Danger tokens are reserved for FAILED (technical delivery failure).
- ❌ Do not use color-only status differentiation. Every pill = tint + glyph + label. A colorblind agent must be able to distinguish LIVE from REJECTED without hue.
- ❌ Do not fabricate example rows in the empty state. When the agent has zero submissions, show the empty-never-published state with a real CTA — never a screenshot of a full list "to give them an idea."
- ❌ Do not hide the KPI strip under a "See summary" toggle. It IS the answer to why the agent opened this screen. Always visible.
- ❌ Do not use signal-lamp pulse anywhere on this screen. That motion motif is reserved for the "listing went live" moment (per Broadcast reference §Motion). Live-status transitions on this screen use a plain cross-fade.
- ❌ Do not open a filter modal on mobile as the primary filter surface. The sticky filter bar is the primary. The `Sheet` drawer is a fallback ONLY when the sticky bar has scrolled out of view.
- ❌ Do not render dates in the UI font. Every timestamp goes through `<Numeric>`.
- ❌ Do not stack toasts on live updates. Cap 1 at a time; subsequent updates within 5s replace the toast rather than piling up. Prevents notification spam when a batch job completes and 8 rows flip at once.
- ❌ Do not auto-refetch on window focus with no debounce. Debounce 2s so tabbing back-and-forth doesn't hammer the endpoint.
- ❌ Do not display raw `distribution_attempt_id` in the visible row. Put it in the AGT-PUB-003 sidebar for support-ticket reference. Row IDs are noise.
- ❌ Do not offer Export CSV on mobile in v1. Desktop-only, Pro-mode-only, Phase 2. Mobile agents don't ask for CSV exports — they ask for a filtered view.
- ❌ Do not conflate AGT-PUB-006 with AGT-PUB-003. -003 is the fresh receipt drawer for one publish action. -006 is the longitudinal ledger. Distinct routes, distinct components, distinct entry points. A row on -006 links INTO -003, not vice versa.
- ❌ Do not render a portal without its channel mark. If a portal was added via `portal_registry` after Week 2 and doesn't yet have a `--lc-channel-<code>` token entry, use the monogram fallback — never a plain text label with no visual identifier.
- ❌ Do not use `variant="destructive"` red on any button on this screen. Retry-failed lives on AGT-PUB-003; withdraw-submission is a ghost variant per the AGT-REC-004 anchor discipline.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Stripe Payments dashboard row list** — the KPI strip + filter bar + row table composition is directly analogous. Study the way status pills stay legible at 13px font sizes.
- **Vercel Deployments list** — per-deployment status pill (`Ready` / `Building` / `Error`) + live-update cross-fade pattern is the closest analog to our live-update behavior.
- **GitHub Actions run list** — heterogeneous status pills in a scannable table; adopt the density (72px row height desktop) but keep our Broadcast tightness.
- **Linear issue list** — filter chip + multi-select popover pattern is the model for our filter bar.

Do NOT match:
- Salesforce Reports (too dense, too enterprise; overwhelming for a solo agent on a phone).
- Zendesk ticket list (too utilitarian; no KPI framing at top).
- Any dashboard that puts KPIs behind a tab — our KPIs are the answer, not a drill-down.

---

## Backend contract

**Endpoint 1 (list):** `GET /api/publishing/tracker`

Query params (all optional except `limit`):
- `status`: comma-separated `submitted,in_review,live,rejected,expired,failed`
- `portal`: comma-separated portal codes (from `portal_registry.code`)
- `listing_id`: single listing id
- `from`: ISO date lower bound (inclusive) on `submitted_at`
- `to`: ISO date upper bound (inclusive) on `submitted_at`
- `after`: cursor from a prior response (`next_cursor`) for pagination
- `limit`: page size, default 20, max 50
- `sort`: `submitted_at:desc` (default) | `updated_at:desc` — v1 supports these two only

**Response 200:**
```json
{
  "rows": [
    {
      "distribution_attempt_id": "att_01H9...",
      "listing": {
        "id": "lst_01H8...",
        "address_line": "Marina Gate 2 · Apt 1205",
        "thumbnail_url": "https://cdn.wingcaster.app/listings/marina-gate.jpg" | null
      },
      "portal": {
        "code": "property_finder",
        "display_name": "Property Finder",
        "channel_token_key": "property_finder" | null
      },
      "submitted_at": "2026-09-07T12:14:22Z",
      "updated_at": "2026-09-07T14:22:15Z",
      "status": "live",
      "error_class": null,
      "error_message": null,
      "credits_charged": 3,
      "portal_live_url": "https://propertyfinder.ae/en/plp/...-1205.html" | null
    }
    // ...
  ],
  "next_cursor": "eyJhZnRlciI6Ii4uLiJ9" | null,
  "has_more": true,
  "total": 143
}
```

`status` is one of `submitted | in_review | live | rejected | expired | failed`. `error_class` is populated when `status ∈ {rejected, failed}` and MUST come from the CHECK-constrained enum landed by `[BE-BLOCKER-03]`: `auth-expired | portal-rules-violation | portal-down | quota-exceeded | invalid-content | unknown-error`.

**Endpoint 2 (KPI summary):** `GET /api/publishing/tracker/summary`

Query params: same filter set as endpoint 1 (so KPI recomputes for the currently-filtered scope). Defaults to current calendar month + no filters.

**Response 200:**
```json
{
  "scope": {
    "from": "2026-09-01T00:00:00Z",
    "to": "2026-09-30T23:59:59Z",
    "filters_applied": { "status": null, "portal": null, "listing_id": null }
  },
  "total_submissions": 23,
  "success_rate": 0.87,
  "credits_spent": 46,
  "top_failure_class": {
    "class": "portal-rules-violation",
    "display_label": "Rules violation",
    "count": 2
  } | null
}
```

Both endpoints scoped strictly to the caller's `user_id` (or `active_tenant_id` for agency-context agents) — a `distribution_attempt` belonging to another tenant returns as if it doesn't exist (never appears in the list, never counted in summary).

**Backend prerequisites NOT already tracked:**

- **`[BE-BLOCKER-10]` `GET /api/publishing/tracker` list endpoint + `GET /api/publishing/tracker/summary` aggregate KPI endpoint.** No cross-listing tracker endpoint exists today; matrix references `GET /api/my-submissions` as a list, but the AGT-PUB-006 brief requires a filterable + cursor-paginated + KPI-summary pair. Estimated effort: 2-3 days backend (query, indexes on `(user_id, submitted_at desc)` and `(active_tenant_id, submitted_at desc)`, cursor pagination, summary aggregation). **Slot: Week 2 (before AGT-PUB-006 dispatch).**
- **`[BE-BLOCKER-11]` Push template `portal_submission.status_changed`.** Piggybacks on existing push dispatch infrastructure (WF-01 WhatsApp draft, WF-03 portal outcome). ONE new template row with variants per status transition. Deep-link to `wingcaster://publishing/receipts/:distributionAttemptId` (opens AGT-PUB-003 in retrospective mode). Estimated 0.5 day. **Slot: Week 2 (bundled with WF-03 UI cluster).**
- **`[BE-BLOCKER-03]` (already tracked)** — the `error_class` CHECK enum on `distribution_attempts` MUST land before this screen dispatches, or the FAILED / REJECTED rows can't render their failure class chip. Reiterating the dependency here.
- **`[BE-DESIGN-01]` (already tracked)** — the `portal_registry` table drives the `portal.channel_token_key` field. Rows for portals that don't have a channel token key yet still render (monogram fallback), so this is a soft dependency at v1 launch — but the row endpoint MUST return `channel_token_key: null` cleanly rather than omitting the portal.

---

## Notification hook

**Trigger:** `distribution_attempts.status` transitions to any of `in_review`, `live`, `rejected`, `expired`, `failed` for a submission owned by the calling user/tenant.

**Piggybacks on existing push infrastructure** — WingCaster already has `notifications` table + push-dispatch service (WF-01 WhatsApp AI-draft approval, WF-03 portal submission outcome fires from AGT-PUB-003). No new dispatch machinery.

**Requires ONE new push-notification template row:**
- Template key: `portal_submission.status_changed`
- Variants by `new_status`: `in_review` (minor — batched, max 1/hour per user), `live` (celebratory, immediate), `rejected` (decision — immediate), `expired` (immediate), `failed` (technical — immediate).
- Title / body per variant (short-form for push):
  - `live`: "{Portal name} accepted your listing" / "{Listing address} is now live on {Portal name}."
  - `rejected`: "{Portal name} didn't accept your listing" / "See the reason and fix it — tap to review."
  - `failed`: "Delivery to {Portal name} failed" / "Retry or contact support — tap to see details."
  - `expired`: "Submission to {Portal name} timed out" / "No portal response after {sla_days} days. Tap to see options."
  - `in_review`: "{Portal name} started reviewing your listing" / "You'll get another update when they decide." (batched)
- Deep-link: `wingcaster://publishing/receipts/:distributionAttemptId` → maps to AGT-PUB-003 in retrospective mode.
- Client-side: the AGT-PUB-006 screen subscribes to the same template and updates matching rows inline (see §Interactions live push). Push notification opens AGT-PUB-003 directly (not AGT-PUB-006) — the notification is for a single event, so it deep-links to the single-event surface.

**Answer to caller's question:** the notification hook piggybacks on existing push infrastructure — no new dispatcher, no new subscription plumbing. It requires ONE new template row (`portal_submission.status_changed`) with five status-transition variants. File under Week 2 cluster work.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/PortalTrackerPage.tsx`.
- **Route:** add to `web/src/App.tsx` — `<Route path="/publishing/tracker" element={<PortalTrackerPage />} />`. Also add an entry-point link from AGT-LST-011 publications tab ("See all across listings →" → `/publishing/tracker?listing_id=<current>` OR bare `/publishing/tracker`).
- **Component decomposition:**
  - `web/src/components/publishing/PortalTrackerScreen/PortalTrackerScreen.tsx` — top-level composition.
  - `web/src/components/publishing/PortalTrackerScreen/TrackerKpiStrip.tsx` — 1×4 or 2×2 KPI card grid.
  - `web/src/components/publishing/PortalTrackerScreen/TrackerFilterBar.tsx` — sticky filter bar with chips + autocomplete + date range.
  - `web/src/components/publishing/PortalTrackerScreen/PortalTrackerRow.tsx` — single row (mobile card layout AND desktop table row via composition; not two components).
  - `web/src/components/publishing/PortalTrackerScreen/PortalStatusPill.tsx` — the status-pill primitive (glyph + label + Broadcast token map). Extract as a shared primitive under `web/src/components/ui/portal-status-pill.tsx` because AGT-PUB-003 will also use it.
  - `web/src/components/publishing/PortalTrackerScreen/TrackerEmptyState.tsx` — handles never-published / filters-empty / offline variants.
- **Data hooks:**
  - `web/src/hooks/usePortalTrackerList.ts` — cursor-paginated infinite query via React Query.
  - `web/src/hooks/usePortalTrackerSummary.ts` — KPI aggregate query, keyed on same filter state.
  - `web/src/hooks/usePortalSubmissionPush.ts` — subscribes to `portal_submission.status_changed` push template + reconciles into React Query cache.
- **Test discipline:**
  - Unit: each component renders all state variants (KPI loading, KPI populated; row status pills across all 6 statuses; filter chips active/idle; empty states).
  - Integration: full screen renders across all listed state variants (loading, empty-never-published, empty-filters, mixed-status, heavy-load pagination, live-update-row-present, live-update-row-not-present, offline).
  - Contract: mock `/api/publishing/tracker` + `/api/publishing/tracker/summary` and assert filter → refetch → correct query params.
  - Live-push: fake WebSocket / SSE emits a status-change payload → assert the row cross-fades to the new pill and the toast fires.
  - Deep-link: navigating to `/publishing/tracker?status=rejected&portal=bayut` on cold load hydrates the filter state.
  - Real-Postgres: at least one end-to-end scenario (agent submits via AGT-PUB-005 → PA reviews via PA-MOD-002 → agent lands on AGT-PUB-006 and sees the row with the correct status).
  - Row-click: assert navigation to `/publishing/receipts/:distributionAttemptId` (AGT-PUB-003 retrospective mode).
  - RTL: verified via `screens.rtl.test.tsx` extension.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **Guard:** an assertion test that verifies `<PortalStatusPill>` renders BOTH glyph AND label for every status enum value — enforces the color-blindness safeguard.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Status pills follow the token map in §Broadcast alignment. REJECTED uses `--lc-status-closed-*` (decision), FAILED uses `--lc-status-danger-*` (error). Never swap.
- Every status pill carries a glyph AND a text label. Never color-only.
- Portal channel marks pair `--lc-channel-<code>` with `--lc-channel-<code>-on`. Monogram fallback uses `--lc-surface-sunken` + `--lc-text-primary`.
- KPI value numerals via `<Numeric>` — Archivo 800 32/38 in the display type, IBM Plex Mono for the digits + tabular-nums.
- Card radii `var(--lc-radius-lg)` (7px). No 12+ px rounding anywhere.
- Elevations offset, not blurred — `var(--lc-elevation-sm)` for cards. Never a soft blur shadow.
- Filter chip active state uses `--lc-surface-selected` + `--lc-action-primary` border. Never a solid primary-orange fill on the chip.
- Row hover tint uses `--lc-surface-selected`, 120ms `var(--lc-easing-out)`.
- Live-update row cross-fade `var(--lc-duration-base)` (180ms), `var(--lc-easing-out)`. No signal-lamp pulse.
- Focus rings two-tone via base CSS. Do not override.
- Motion: respect `prefers-reduced-motion` — skip hover tint, skip cross-fade, apply state instantly.
- Radii: cards `var(--lc-radius-lg)`; buttons `var(--lc-radius-md)`; status pill `var(--lc-radius-pill)`; thumbnail `var(--lc-radius-md)`.
- 44px tap floor via base CSS. Do not shrink filter chips or row chevron below.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster "Portal submission tracker" screen (AGT-PUB-006) — MENA real-estate B2B SaaS. It's the rolling ledger view of every portal submission the agent has made (Bayut / Property Finder / Dubizzle / Aqar / etc.), one row per (listing × portal × attempt), filterable by status / portal / listing / date range, with a KPI strip at the top. Distinct from AGT-PUB-003 which is the single-job receipt drawer. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

First pass: render the MOBILE 375px layout with a mixed-status list (5 rows: Live, In review, Not accepted, Delivery failed, Submitted — mixing decision vs error semantics). KPI strip 2×2 grid at top with 4 metrics. Sticky filter bar below the KPI strip. Load-more button at bottom. Sample content per the brief's §Sample content.

LTR English only for this pass — I'll ask for RTL Arabic, filter-applied, empty states, live-update, desktop, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Do not fabricate portal names outside the sample content list. REJECTED uses a neutral closed-status color, FAILED uses danger — they are visually distinct.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Same mobile viewport, filter bar shows Status=Not accepted chip active + Clear filters visible. Row list filtered to the one rejected row from pass 1's sample.`
2. `Same mobile viewport, EMPTY-never-published state. Send glyph 64×64 in muted, headline + body copy, primary CTA "Publish your first listing".`
3. `Same mobile viewport, EMPTY-filters-yield-nothing state. No illustration; headline + body + Clear filters button.`
4. `Same mobile viewport, LOADING state. KPI cards shimmer, 5 row skeletons.`
5. `Same mobile viewport, LIVE-UPDATE moment. Row 2 flipping from "In review" to "Live" mid-cross-fade. Sonner toast at top "Submission updated".`
6. `Desktop 1440px, default state with 1×4 KPI strip + full filter bar + table rows (72px row height).`
7. `Desktop 1440px, filtered state matching pass 1's iteration 1.`
8. `RTL Arabic mirror at mobile 375px. Thumbnail on right, chevron on left, filter bar reversed. Numerics stay LTR bidi-embedded.`
9. `Dark mode desktop, default state.`
10. `Offline state — thin top banner + "Last updated" hint + filter mutations disabled.`

Save each output's JSX to `web/src/components/publishing/PortalTrackerScreen/` + screenshot to `docs/design/mockups/AGT-PUB-006-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 10 iteration states (mobile mixed-status, mobile filtered, mobile empty-never-published, mobile empty-filters, mobile loading, mobile live-update, desktop default, desktop filtered, RTL mobile, dark desktop, offline).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-2 dispatch prompt references this brief + the mockup paths + the shared `<PortalStatusPill>` primitive extraction.
- [ ] `[BE-BLOCKER-10]` (`GET /api/publishing/tracker` + `/summary` endpoints) filed in kickoff §5a.
- [ ] `[BE-BLOCKER-11]` (push template `portal_submission.status_changed`) filed in kickoff §5a.
- [ ] `<PortalStatusPill>` extracted as a shared primitive under `web/src/components/ui/portal-status-pill.tsx` so AGT-PUB-003 reuses it in the same PR.
- [ ] Live-push subscription (`usePortalSubmissionPush`) exercised in at least one integration test with a fake dispatcher.
