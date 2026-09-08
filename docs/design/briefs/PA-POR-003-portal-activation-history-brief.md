# Screen Brief — PA-POR-003 · Portal activation history (delta to PA-POR-001)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** Inherits the Broadcast alignment section, PA console shell context, env-scoping conventions, PA-POR family invariants, and reusable component names from `PA-POR-001-portal-list-brief.md`. Read that anchor brief first; THIS brief specifies only the delta — the immutable per-portal audit timeline surface.

Wave 6 (Week 6 — Two-person-rule UI + PA-PKG-* admin + PA-POR-* portal admin) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 6 §6. Same PR as PA-POR-001 + PA-POR-002.

---

## Broadcast alignment

**Inherits from `PA-POR-001-portal-list-brief.md` §Broadcast alignment + §Broadcast alignment callouts** — do not re-specify base tokens. Delta-specific callouts only:

- **Header block.** Sticky under top bar + optional TEST strip. Left: breadcrumb "Portal registry / {display_name} / History" (each segment a link back preserving `return_to`) + title `var(--lc-type-heading-1)` "Activation history — {display_name}" + code monospaced (`var(--lc-type-data-sm)`) inline. Right: `Back to portal` outline button (returns to PA-POR-002 view mode) + `Export CSV` ghost button.
- **Filter strip (sticky).** Row of chips + selects:
  - Event type multi-select `<Select multiple>` — options: `Activated` / `Deactivated` / `Adapter upgraded` / `SLA changed` / `Country coverage changed` / `Validator ruleset changed` / `Publisher config changed` / `Inbound config changed` / `Deprecated`. Default all.
  - Actor filter `<Combobox>` — search admins by display name; selecting one filters to events they submitted OR approved.
  - Date range `<DateRangePicker>` — defaults to "Last 90 days"; presets: 30d / 90d / 12mo / All time.
- **Timeline shell.** Single-column vertical timeline on `var(--lc-surface-raised)` inside `var(--lc-radius-lg)` card + `var(--lc-elevation-sm)`. Each event = one card entry with a left-side glyph rail (24px wide) + right-side content area.
- **Glyph rail per event type.** Circular 20×20 glyph in `var(--lc-radius-pill)` with tint per event type:
  - Activated: `--lc-status-published-bg` + `--lc-status-published-fg` + `Power` lucide icon.
  - Deactivated: `--lc-status-archived-bg` + `--lc-status-archived-fg` + `PowerOff` lucide icon.
  - Adapter upgraded: `--lc-accent-bold-bg` + `--lc-accent-bold-fg` + `Boxes` icon (outlined per accent-bold-edge rule).
  - SLA changed: `--lc-status-warning-bg` + `--lc-status-warning-fg` + `Clock` icon.
  - Country coverage changed: `--lc-status-draft-bg` + `--lc-status-draft-fg` + `Globe` icon.
  - Validator ruleset changed: `--lc-status-warning-bg` + `--lc-status-warning-fg` + `Shield` icon.
  - Publisher config changed: `--lc-status-draft-bg` + `--lc-status-draft-fg` + `Settings` icon.
  - Inbound config changed: `--lc-status-draft-bg` + `--lc-status-draft-fg` + `Inbox` icon.
  - Deprecated: `--lc-status-closed-bg` + `--lc-status-closed-fg` + `Archive` icon.
  - Vertical connector line between glyphs: `border-left: 2px solid var(--lc-border)` from center of glyph rail.
- **Event card content area.** `padding: var(--lc-space-md) var(--lc-space-lg)`, `padding-left: var(--lc-space-xl)` (to clear glyph rail).
  - Top row: event-type label (`var(--lc-type-heading-3)`) + full timestamp on right (`var(--lc-type-data-sm)` `var(--lc-text-muted)`; hover tooltip shows relative time "2d 4h ago").
  - Second row: actor line — "Submitted by {submitter_display_name}" + (if approval-gated) "Approved by {approver_display_name}" — `var(--lc-type-body-sm)`. Each name links to that admin's profile in a new tab (`rel="noopener noreferrer"`).
  - Notes block (if present): `var(--lc-type-body)` in an indented block quote (`border-left: 3px solid var(--lc-border-strong)`, `padding-left: var(--lc-space-md)`, `color: var(--lc-text-secondary)`). Submitter notes and approver notes rendered as separate blocks with subtle "Submitter" / "Approver" labels.
  - Before/after diff block: expandable via a `<Collapsible>` "View diff" toggle. Renders as a two-column layout with `Before` (left, `--lc-status-danger-bg-subtle` tint) + `After` (right, `--lc-status-published-bg-subtle` tint) — each column showing the changed fields only. Field names in mono (`var(--lc-type-data-sm)`); values rendered as JSON pretty-print for JSONB fields, plain text for scalars, chip list for country_codes.
  - Related-version link (if event created a new registry version): "→ Version {N} of the registry" outline button linking to the version snapshot (`/admin/portals/:code?version=N` — same PA-POR-002 view route with a `?version` param that loads that historical version read-only).
- **Empty state.** Centered stack, illustration placeholder + title "No activation events yet" + body "{displayName} hasn't been activated, edited, or deactivated yet. Events land here as they happen."
- **Loading skeleton.** 5 timeline entries with shimmer glyphs + shimmer content blocks.
- **Motion.** Timeline entries fade-in on load at `--lc-duration-base` `--lc-easing-out`; diff expand `--lc-duration-fast` height transition; NO signal-lamp motif.
- **Radii.** Timeline card `var(--lc-radius-lg)`; event glyphs `var(--lc-radius-pill)`; diff blocks `var(--lc-radius-md)`; version-link button `var(--lc-radius-md)`.
- **Numeric fields — every version number, SLA hours, country count, timestamp portion — via `<Numeric>`.**

---

## Meta

| | |
|---|---|
| Screen ID | PA-POR-003 |
| Screen name | Portal activation history |
| Persona | PA (Platform Admin — requires `portal-registry-read`; ALL PAs with that cap can view any portal's full audit) |
| Device targets | Desktop 1440px ONLY (inherited from PA-POR-001) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/portals/:code/history` (query params: `?events=<type[,type...]>`, `?actor=<userId>`, `?from=<ISO>`, `?to=<ISO>`, `?page=<n>`) |
| Current state | MISSING. Depends on `[BE-DESIGN-01]` + `portal_activation_history` table (see §Backend contract). |
| Workflow role | Audit view for the PA-POR family; feeds the "Last change" cell on PA-POR-001 + the version dropdown on PA-POR-002 |
| Backend prerequisites | Same as PA-POR-001 + `portal_activation_history` table + `GET /api/admin/portals/:code/history` route. See §Backend contract. |
| Cluster | Wave 6 (Week 6) — same PR as PA-POR-001 + PA-POR-002 |

---

## Purpose

Platform Admin reviews the full immutable audit timeline for a single portal — every activation flip, adapter upgrade, SLA adjustment, country-coverage change, validator ruleset swap, publisher/inbound config edit, and deprecation event, with submitter + approver identity, timestamps, notes, and before/after diffs.

This is the transparency + accountability surface for the PA-POR family. Answers questions like:

- "When did we activate Property Finder Lebanon and who approved it?"
- "What did the Bayut UAE SLA look like before the September change, and who tightened it?"
- "Which admin swapped the validator ruleset from `bayut.js` v1 to v2, and what notes did they leave?"
- "Has any admin made unusual solo activity? (Cross-check submitter + approver pairs.)"

The timeline is append-only + immutable — no editing / deletion of history entries from the UI. Corrections require a new event (e.g. "SLA reverted from 4h back to 6h — mistake in prior change") with notes.

Success outcome: PA has visual confidence in every past change; regulators / auditors can trace any portal-catalog decision back to the two admins who owned it; agents troubleshooting portal issues can see when config last changed.

---

## Design goals (delta over PA-POR-001)

1. **Chronological + visually scannable.** Vertical timeline with distinctive per-event-type glyphs makes it obvious at a glance "what kind of event happened when."
2. **Diff-on-demand, not diff-by-default.** Collapsed diffs keep the timeline compact; expand only when curious. Auto-expand on the first (most-recent) event as a helpful default.
3. **Actor pair visibility.** Every gated event shows BOTH submitter and approver. Reinforces two-person-rule visually.
4. **Version snapshot navigation.** Historical events link to their point-in-time registry version — click to see what the portal looked like at that moment (via PA-POR-002 with `?version=N`).
5. **Filterable but not overwhelming.** Event-type multi-select + actor + date-range are enough; do not add second-order filters (no "Countries added" / "Countries removed" split — that would be timeline-search over diff content, out of scope for v1).

---

## Layout (delta over PA-POR-001)

### Desktop 1440px

Single-column layout inside PA console shell:

**Header block (sticky):**
- Breadcrumb "Portal registry / {display_name} / History" (each segment linked).
- Left: title "Activation history — {display_name}" + code monospaced inline.
- Right: `Back to portal` outline button + `Export CSV` ghost button.

**Filter strip (sticky):**
- Row 1: event-type multi-select (chip-showing "All events" when none filtered, or "3 event types" chip when partial).
- Row 2: actor combobox + date-range picker + Reset button.

**Timeline card (single-column, centered, max-width 960px):**
- Vertical timeline with glyph rail on the left.
- Events in reverse-chronological order (newest first). First event's diff auto-expanded.
- Between event groups from different weeks: a subtle date-header divider "September 2026" in `var(--lc-type-overline)` `var(--lc-text-muted)`.

**Pagination footer (only if total > pageSize):**
- Right-aligned: `<Numeric>1–25</Numeric> of <Numeric>N</Numeric>` + prev / next + `<Select>` page-size (25 default, 50, 100).

### Empty state

Centered stack: illustration placeholder + title "No activation events yet" + body copy + `Back to portal` outline CTA.

### Below-min-viewport fallback

Same as PA-POR-001.

---

## Explicit copy (English, delta only)

| Slot | Copy |
|---|---|
| Breadcrumb — history | History |
| Page title template | Activation history — {displayName} |
| Back to portal | Back to portal |
| Export CSV | Export CSV |
| Filter — event type label | Event type |
| Filter — event type all | All events |
| Filter — event type N template | {N} event types |
| Event — activated | Activated |
| Event — deactivated | Deactivated |
| Event — adapter upgraded | Adapter upgraded |
| Event — sla changed | SLA changed |
| Event — country coverage changed | Country coverage changed |
| Event — validator ruleset changed | Validator ruleset changed |
| Event — publisher config changed | Publisher config changed |
| Event — inbound config changed | Inbound config changed |
| Event — deprecated | Deprecated |
| Filter — actor label | Actor |
| Filter — actor placeholder | Search admin by name… |
| Filter — date range label | Date range |
| Filter — date preset 30d | Last 30 days |
| Filter — date preset 90d | Last 90 days |
| Filter — date preset 12mo | Last 12 months |
| Filter — date preset all | All time |
| Filter — reset | Reset filters |
| Actor line — submitted by | Submitted by {name} |
| Actor line — approved by | Approved by {name} |
| Actor line — combined | Submitted by {submitter} · Approved by {approver} |
| Notes label — submitter | Submitter |
| Notes label — approver | Approver |
| Diff toggle — collapsed | View diff |
| Diff toggle — expanded | Hide diff |
| Diff header — before | Before |
| Diff header — after | After |
| Diff — no changes | No shape changes recorded for this event. |
| Version link template | → Version {N} of the registry |
| Version link tooltip | Open a read-only snapshot of the portal at this version. |
| Section divider — month template | {monthYear} |
| Empty — title | No activation events yet |
| Empty — body template | {displayName} hasn't been activated, edited, or deactivated yet. Events land here as they happen. |
| Empty — CTA | Back to portal |
| Loading | Loading activation history… |
| Error banner | Couldn't load activation history. Try again. |
| Retry button | Retry |
| Pagination template | {start}–{end} of {total} |
| Page-size label | Events per page |

---

## Component palette (delta only)

| Element | Primitive |
|---|---|
| Breadcrumb | Custom `<nav>` with links + `ChevronRight` |
| Back to portal | `Button variant="outline"` |
| Event-type multi-select | `Select` with `multiple` OR headless `Combobox` |
| Actor combobox | Headless `Combobox` searchable by admin display name |
| Date range | `DateRangePicker` (custom or shadcn recipe) with presets |
| Timeline card shell | `Card` primitive with `var(--lc-elevation-sm)` |
| Event glyph | Circular tinted div + lucide icon |
| Timeline connector line | CSS `border-left` on the glyph rail column |
| Event card | Custom `<article>` per event |
| Full timestamp | `<time>` element with `datetime` attribute |
| Actor links | `<a>` with `target="_blank" rel="noopener noreferrer"` |
| Notes block | Blockquote-style `<div>` |
| Diff toggle | `Collapsible` + `Trigger` + `Content` |
| Diff before/after columns | Two-column `<div>` with tint variants |
| Diff — JSON pretty-print | Monospaced `<pre>` (`var(--lc-type-data-sm)`); no editing |
| Diff — chip list | Country chips (reused from PA-POR-001) |
| Version link | `Button variant="outline"` with `ArrowRight` icon |
| Pagination controls | Reused from PA-POR-001 |
| Empty-state | Reused shell from PA-POR-001 |
| Loading skeleton | Custom shimmer timeline |
| Error banner | Reused from PA-POR-001 |
| Toast | `Sonner` |
| Icons | `lucide-react` — `Power`, `PowerOff`, `Boxes`, `Clock`, `Globe`, `Shield`, `Settings`, `Inbox`, `Archive`, `ChevronRight`, `ArrowRight`, `Download` |

---

## Sample content (for v0 / mockup)

Property Finder AE activation history — 5 sample events (newest first):

1. **SLA changed** · 2026-09-06 09:30 UTC (`2d ago`) · Submitted by Rania Farah · Approved by Yara Habib · Notes: "Post-commercial-renegotiation, PF agreed to tighten UAE SLA from 8h to 6h." · Diff auto-expanded: Before `sla_hours: 8` → After `sla_hours: 6`. Version link "→ Version 7 of the registry".
2. **Publisher config changed** · 2026-08-14 11:15 UTC (`3w ago`) · Submitted by Karim Nasr · Approved by Rania Farah · Notes: "Rotated API auth secret ref after PF admin-portal reset." · Diff: Before `auth_secret_ref: secrets/pf/ae/api_key_v1` → After `auth_secret_ref: secrets/pf/ae/api_key`. Version 6.
3. **Country coverage changed** · 2026-07-20 14:42 UTC (`1mo ago`) · Submitted by Rania Farah · Approved by Karim Nasr · Notes: "PF UAE + Abu Dhabi rebrand — retiring separate AD publisher, folding into AE." · Diff: Before `country_codes: [AE, AD]` (chip pair) → After `country_codes: [AE]`. Version 5.
4. **Adapter upgraded** · 2026-07-05 08:00 UTC (`2mo ago`) · Submitted by Karim Nasr · Approved by Rania Farah · Notes: "Adapter class refactored to shared PF Group base — PR #34." · Diff: Before `adapter_class_name: portals/property_finder_ae_v1.js` → After `adapter_class_name: portals/property_finder.js`. Version 4.
5. **Activated** · 2026-06-14 11:02 UTC (`3mo ago`) · Submitted by Rania Farah · Approved by Yara Habib · Notes: "First WingCaster PF UAE publisher — Phase-1 critical path." · Diff: Before `is_active: false` → After `is_active: true`. Version 1.

Section divider "September 2026" between event 1 and 2; "July 2026" between event 3 and 4; etc.

Pagination footer hidden (only 5 events).

Do NOT fabricate admin identities not in the tenant DB.

---

## Interactions (delta only)

**On page load:**
- Fetch `GET /api/admin/portals/:code/history?events=all&from={90d ago}&page=1&pageSize=25`.
- Show 5-entry skeleton while loading.
- On success: render timeline. Auto-expand first event's diff.

**On event-type filter change:**
- Update `?events=<type[,type...]>` in URL. Refetch. Preserve pagination reset.

**On actor filter change:**
- Update `?actor=<userId>`. Refetch. Applies to submitter OR approver match.

**On date-range change:**
- Update `?from=<ISO>&to=<ISO>`. Refetch.

**On diff toggle:**
- Expand/collapse the diff block via `Collapsible`. State per event (independent).
- Auto-expand for the first event on initial load.

**On version link click:**
- Navigate to `/admin/portals/:code?version=N` — PA-POR-002 view mode with historical snapshot loaded, breadcrumb reads "Portal registry / {display_name} / Version {N}". Read-only regardless of PA's write cap (historical snapshots are not editable).

**On actor name click:**
- Opens admin profile in a new tab.

**On Back to portal:**
- Navigate to PA-POR-002 view mode at `/admin/portals/:code` (preserving `return_to` from history route if present).

**On Export CSV:**
- Fires `GET /api/admin/portals/:code/history.csv?<same-query>`. Columns: `event_type, event_at, submitter_id, submitter_name, approver_id, approver_name, submitter_notes, approver_notes, before_json, after_json, version_created`.

**On env switch:**
- Refetch history (some events may be env-scoped in a future revision; v1 events are catalog-scoped so env-switch is a no-op refresh).

---

## State variants (delta only)

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial loading** | Page mount | 5-entry skeleton. Filter strip disabled. |
| **Ready — has events** | ≥1 event | Timeline renders. First event's diff auto-expanded. |
| **Ready — empty** | 0 events for this portal | Empty-state block. |
| **Filter narrows to zero** | Filter combo yields 0 | Simpler empty: "No events match your filters. [Reset filters]" |
| **Event card — collapsed diff** | Diff toggle off | Compact card. |
| **Event card — expanded diff** | Diff toggle on | Two-column before/after visible. |
| **No-shape-change event** | Some events (e.g. re-approval) have no field diff | Diff shows "No changes recorded for this event." |
| **Version link click** | Historical version load | PA-POR-002 opens in view mode with `?version=N`; edit CTA hidden. |
| **Actor filter** | Chose admin from combobox | Timeline filtered; small applied-filter chip near title. |
| **Date-range filter** | Preset or custom range | Same. |
| **Reset filters** | Reset clicked | All URL params cleared; refetch with defaults. |
| **Insufficient permission** | PA lacks `portal-registry-read` | Full-page block per PA-POR-001 pattern. |
| **RTL** | Locale = ar | Glyph rail moves to right; timeline connector line mirrors; diff columns keep Before-left / After-right unchanged (universal chronology). Timestamps stay LTR via bidi isolation. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap; diff before/after tints adjust. |
| **TEST env** | env=TEST | TEST warning strip visible per PA-NAV-001. |

---

## Accessibility (delta only)

- Timeline is `role="list"` with each event `role="listitem"`.
- Each event card has an `aria-label` composing "{event-type} on {timestamp} by {submitter}".
- Glyph icons are `aria-hidden="true"`; event label text carries meaning.
- Diff toggle is a proper `<button>` with `aria-expanded` state.
- Timestamps use `<time datetime="ISO">` for SR + parsability.
- Filter chip labels announce their state via `aria-label`.
- Actor links open in new tab with `aria-label="{name}, opens in new tab"`.
- Skip link at top jumps into first event card.
- Empty-state CTA reachable by Tab.
- Focus visible via two-tone Broadcast focus ring.

---

## Anti-patterns (delta only)

- Do NOT allow editing / deleting timeline entries from the UI. History is immutable — corrections happen as new events.
- Do NOT auto-refresh the timeline. Events land as new PA activity happens; PA can click Refresh (in PA-POR-001 header if navigated back) or reload the page. Real-time updates deferred to Phase 2.
- Do NOT show more than one auto-expanded diff. First event only; others expand on click.
- Do NOT render raw event UUIDs. Event type + timestamp + actor pair is the human handle.
- Do NOT compress the diff block below 200px height when expanded — legibility of JSONB fields requires vertical room.
- Do NOT paint the timeline connector line with a status color; it's structural, not semantic — `--lc-border` only.
- Do NOT flatten submitter and approver into one "author" line — the two-person-rule visibility is the point.
- Do NOT allow the version link to open in an edit mode. Historical snapshots are strictly read-only.
- Do NOT skip event types from the timeline (e.g. hiding `Publisher config changed` because it feels frequent). All event types render; PA filters if they want.

---

## Reference designs (delta only)

- **GitHub PR timeline** — event-per-row timeline with typed glyphs + collapsible diff blocks — closest structural sibling.
- **Linear issue activity** — actor + timestamp + notes with reverse-chronological order.
- **AWS CloudTrail event history** — per-resource audit timeline with before/after diff rendering.
- **Stripe Dashboard → any object → Events tab** — event-typed activity log with diff-on-demand.
- **PA-AUD-001 platform audit (WingCaster, planned)** — same immutable timeline pattern; PA-POR-003 is a per-portal-scoped subset.
- **PA-POR-001 (WingCaster)** — direct pattern sibling; shares shell + filters + env conventions.

---

## Backend contract (delta only)

**History endpoint:** `GET /api/admin/portals/:code/history`

**Query params:**
- `events` — comma-separated event types (default all)
- `actor` — user id filtering submitter OR approver (default all)
- `from` / `to` — ISO date range (default: last 90 days)
- `page` — integer, default 1
- `pageSize` — integer, default 25, max 100

**Response 200:**
```json
{
  "events": [
    {
      "id": "phist_01H8…",
      "portal_code": "property_finder_ae",
      "event_type": "sla_changed",
      "event_at": "2026-09-06T09:30:12Z",
      "submitter": { "id": "usr_admin_rania", "display_name": "Rania Farah", "profile_url": "/admin/users/usr_admin_rania" },
      "approver": { "id": "usr_admin_yara", "display_name": "Yara Habib", "profile_url": "/admin/users/usr_admin_yara" },
      "submitter_notes": "Post-commercial-renegotiation, PF agreed to tighten UAE SLA from 8h to 6h.",
      "approver_notes": null,
      "diff": {
        "before": { "publisher_config": { "sla_hours": 8 } },
        "after": { "publisher_config": { "sla_hours": 6 } }
      },
      "version_created": 7
    }
  ],
  "pagination": { "page": 1, "page_size": 25, "total": 5, "has_next": false },
  "counts": { "total": 5, "activated": 1, "deactivated": 0, "adapter_upgraded": 1, "sla_changed": 1, "country_coverage_changed": 1, "validator_ruleset_changed": 0, "publisher_config_changed": 1, "inbound_config_changed": 0, "deprecated": 0 }
}
```

**CSV export:** `GET /api/admin/portals/:code/history.csv?<same-query>`.

**Prerequisites tracked / to file:**

- **`[BE-VERIFY-17] Portal activation history table — NEW.** `portal_activation_history` table (append-only, immutable via DB constraint + application-layer guards). Columns: `id, portal_code, event_type, event_at, submitter_id, approver_id, submitter_notes, approver_notes, diff_before JSONB, diff_after JSONB, version_created`. Write on every activation flip, edit that produces a version bump, and deprecation. ~1-2 days backend for table + write hooks. **File as new `[BE-VERIFY-17]` in kickoff §5a.**
- **`[BE-VERIFY-18] Historical version snapshot loader — NEW.** `GET /api/admin/portals/:code?version=N` reads `portal_registry_versions` row N and returns a full portal object frozen at that point. Read-only. ~1 day. **File as new `[BE-VERIFY-18]` in kickoff §5a.**
- **`[BE-VERIFY-19] Actor combobox lookup — NEW.** `GET /api/admin/users?role=platform_admin&q=<name>` used by the actor filter. Confirm route exists; if not, add. ~0.5 day.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/portals/PortalActivationHistoryPage.tsx`.
- **Route registration:** `<Route path="/admin/portals/:code/history" element={<PortalActivationHistoryPage />} />` behind `PAConsoleGuard`.
- **Component decomposition:**
  - `PortalActivationHistoryPage.tsx` — page shell + data fetching + URL state.
  - `PortalHistoryFilterStrip.tsx` — event-type + actor + date-range filters.
  - `PortalHistoryTimeline.tsx` — timeline card shell + event mapping.
  - `PortalHistoryEvent.tsx` — one event card (glyph + content + collapsible diff).
  - `PortalHistoryDiffBlock.tsx` — before/after diff renderer per field type.
  - `PortalHistoryEmptyState.tsx` — empty state variants.
- **Data layer:**
  - Hook: `usePortalHistory(code, filters)` — SWR/React Query.
  - Hook: `useAdminSearch(q)` — actor combobox.
- **Test discipline:**
  - Unit: each event-type variant renders with correct glyph + diff shape.
  - Integration: filter combinations narrow the list; version-link navigation opens PA-POR-002 in snapshot mode; export CSV downloads correct rows.
  - RTL: glyph rail mirrors; timestamps stay LTR.
  - Broadcast: `no-raw-hex.test.ts` stays green.
- **Copy/i18n:** `web/src/locales/en/paPortalHistory.json` + `ar/paPortalHistory.json`.

---

## Handoff instruction to v0

Framing prompt:

```
I'm designing the WingCaster PA portal activation history screen (PA-POR-003) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is the immutable per-portal audit timeline showing every activation, deactivation, adapter upgrade, SLA change, country coverage change, validator swap, config change, and deprecation event, with submitter + approver identity, notes, and before/after diffs. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass: render the desktop 1440px layout with the LIVE env badge, Property Finder AE history (5 events per sample content), first event auto-expanded showing SLA change diff.

Follow the brief copy exactly. Do NOT fabricate admin identities.

DESIGN BRIEF FOLLOWS:
```

Iteration order:
1. Default view — 5 events, first auto-expanded.
2. Filter to "Activated" + "Deactivated" only — shows 1 event.
3. Actor filter to "Rania Farah" — shows 3 events.
4. Empty state — 0 events.
5. RTL + dark mode passes.

Save to `docs/design/mockups/v0-outputs/PA-POR-003/`.

---

## Definition of done

- [ ] v0 has produced all 5 iteration states.
- [ ] Screenshots + JSX committed.
- [ ] Cursor Wave-6 dispatch prompt references PA-POR-001 + PA-POR-002 + PA-POR-003.
- [ ] `[BE-VERIFY-17..19]` filed in kickoff §5a.
