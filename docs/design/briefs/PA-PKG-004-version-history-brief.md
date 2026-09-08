# Screen Brief — PA-PKG-004 · Package version history (audit timeline)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** Inherits Broadcast alignment + PA console shell + PA-PKG-family invariants unchanged from `PA-PKG-001-package-list-brief.md` (anchor) AND borrows the read-only diff-section rendering from `PA-PKG-003-approval-queue-brief.md` (detail view). Read PA-PKG-001 first, then this file.

Companion to Cursor prompt `docs/prompts/CURSOR_PA_PACKAGE_EDIT_UI.md` §2.4 "PA-PKG-004 — Version history". Serves as the audit-timeline surface for the WF-07 package publishing workflow — every DRAFT, PENDING_APPROVAL, ACTIVE, and DEPRECATED version of a package listed newest-first with click-to-read-only-detail.

Wave 3.5 (Week 6). Backend prerequisite is the read endpoint `GET /api/admin/packages/:id` (returns all versions per Cursor prompt §2.1) + per-version read `GET /api/admin/packages/:id/versions/:version`.

---

## Broadcast alignment

**Inherits `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` + `PA-PKG-001` §Broadcast-alignment callouts + PA-PKG-family invariants (1..8) verbatim.** Screen-specific deltas below.

- **Two-view surface.** Route `/admin/packages/:packageId/history` renders the timeline. Route `/admin/packages/:packageId/versions/:version` (without `/edit`) renders the read-only detail view for one historical version. Both use the PA console shell.
- **Timeline layout.** Vertical timeline with each version as a card node. Vertical rule `--lc-border-strong` runs the height of the timeline; each card connects to the rule via a small circular status marker (draft ○ · pending ▲ · active ● · deprecated ▢) tinted per its Broadcast status token.
- **Version card:** `<Card>` on `var(--lc-surface-raised)` with `var(--lc-radius-lg)` + `--lc-elevation-sm`. Content:
  - Top row: `v{N}` in mono `<Numeric>` (large, `var(--lc-type-heading-3)`) + status `<Badge>` + effective-from date via `<Numeric>` (if ACTIVE or DEPRECATED — DRAFT and PENDING have no effective-from).
  - Second row: submitter avatar + display name + `Submitted {relative_time}` timestamp.
  - Third row (approver metadata — ACTIVE, DEPRECATED only): approver avatar(s) + display name(s) + `Approved {timestamp}`. For two-person versions, both approvers listed. For DEPRECATED, additional `Deactivated {timestamp}` line + `Deactivated by v{M+1}` link (if superseded) OR `Deactivated by admin action` if manually deprecated.
  - Fourth row (change summary): change-summary chips (Identity / Caps / Price / Trial / Portal group / N feature quotas / N toggles / Support level) — reuse PA-PKG-003's chip pattern. Also renders a compact one-line diff summary "Property cap: 100 → 150 · Monthly price: $99 → $119" truncated at ~90ch with tooltip for full.
  - Bottom row (actions): `Open` button (opens read-only detail view for this version) + (DRAFT only) `Edit draft` button (routes to PA-PKG-002 editor) + (PENDING only) `Review in approvals queue` link (routes to PA-PKG-003 detail).
- **Filter chip strip (sticky under header):** `<Tabs>` for status filter — All (default) / DRAFT / PENDING_APPROVAL / ACTIVE / DEPRECATED — each with a `<Numeric>` counter. Below the tabs: `Sort` `<Select>` (Newest first default / Oldest first / Version number desc / Version number asc), + `Date range` `<Select>` (All time default / Last 30 days / Last 90 days / Last 12 months / Custom range → opens date-picker modal).
- **Read-only detail view.** Same layout as PA-PKG-003 detail view left column (8 sections, collapsible, unchanged fields collapsed by default) BUT the right column changes: instead of the approvers + actions cards, right column shows:
  - **Version summary card**: everything from the timeline card (submitter, approver(s), effective-from, deactivated-at, change-summary chips).
  - **Compare with card**: `<Select>` "Compare v{N} with…" — default value is "Prior version (v{N-1})" for context; PA can select any other version of the same package to diff against, including any DRAFT / PENDING for comparison purposes.
  - **Rollback card** (ACTIVE + DEPRECATED versions only, only visible with special role capability): `<Button variant="outline">` "Copy fields to new DRAFT" — clones this version's field values into a fresh DRAFT (routes to PA-PKG-002). NOT the same as promoting a DEPRECATED version back to ACTIVE — WingCaster does not allow that (would break the immutable-versions invariant). Instead it's a shortcut for "the pricing we had in 2026-06 was right — let me use it as the starting point for a new proposal."
- **Empty state (package has 0 versions ever):** highly unlikely — every package always has ≥1 version (created via PA-PKG-001 new-package modal). If it happens (backend inconsistency): show "This package has no versions on file — this is unexpected. Contact platform ops." with `AlertTriangle` icon `--lc-status-danger-fg`.
- **Empty filter state (filter returns 0):** "No {status} versions in this range." + Clear filter link.
- **Loading skeleton:** 3 shimmering card placeholders vertically stacked; respects `prefers-reduced-motion`.
- **Motion.** Timeline cards enter with `--lc-duration-slow` staggered fade-in (50ms per card, up to 8 cards; skip stagger under `prefers-reduced-motion`). Section expand/collapse in detail view `--lc-duration-base`.
- **Radii + focus.** Cards `var(--lc-radius-lg)`; buttons + inputs `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`. Focus rings via base CSS two-tone.

---

## Meta

| | |
|---|---|
| Screen ID | PA-PKG-004 (timeline + per-version read-only detail — two routes, one brief) |
| Screen name | Package version history · Package version (read-only) |
| Persona | PA (Platform Admin — `platform_role === 'platform_admin'`; no elevated actions on this surface; read-only) |
| Device targets | Desktop 1440px ONLY |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Timeline: `/admin/packages/:packageId/history` (query `?status=all\|draft\|pending\|active\|deprecated&sort=newest\|oldest\|version_desc\|version_asc&range=all\|30d\|90d\|12m\|custom&page=<n>`) · Read-only detail: `/admin/packages/:packageId/versions/:version` (no `/edit` suffix) (query `?compare_to=<version>&return_to=<url>`) |
| Current state | MISSING — new files: `web/src/pages/admin/packages/PackageVersionHistoryPage.tsx` + `web/src/pages/admin/packages/PackageVersionReadOnlyPage.tsx`. |
| Workflow role | WF-07 (Package publishing) role = Audit view / Read-only composition |
| Backend prerequisites | ⏳ `GET /api/admin/packages/:packageId` (all versions summary — extend existing endpoint per Cursor prompt §2.1). ⏳ `GET /api/admin/packages/:packageId/versions/:version` (per-version read — same endpoint as PA-PKG-002 uses for editing, works for any version regardless of status). ⏳ `GET /api/admin/packages/:packageId/versions/:versionA/diff/:versionB` — arbitrary-version diff for the Compare-with card. If this doesn't exist yet, client-side computes the diff from two read calls; server-side is `[BE-DESIGN-06] Arbitrary-version diff endpoint — NEW.` ~1 day. **File in kickoff §5a.** ✅ PA-NAV-001 env context. ✅ No writes on this surface. |
| Cluster | Wave 3.5 (Week 6 per §6 + §11a — same PR as PA-PKG-001/002/003) |

---

## Purpose

Platform Admin lands on `/admin/packages/:packageId/history` when they need to:

1. **Audit "who changed what, when."** Every version of the package is listed with submitter, approver(s), timestamps, and change summary. Immutable timeline.
2. **Debug a marketing-site issue.** "The Small Team price was $89 in June, when did it become $99?" — timeline answers instantly.
3. **Roll forward with prior context.** "The v3 pricing worked well; let me start a new DRAFT from that shape." — Copy-fields-to-new-DRAFT action on any historical version.
4. **Compare any two versions.** Not just consecutive — compare v3 to v7 to understand the aggregate change over four revisions.
5. **Reach the read-only detail for one version.** Click any card → detail view with 8 sections, unchanged-collapsed diff panel, and the same read-only render used by PA-PKG-003 approval detail's left column.

Success outcome: PA leaves with (a) the answer to their audit question, (b) a fresh DRAFT seeded from a historical version, or (c) confidence that a specific price/cap/feature change was made by a specific admin on a specific date.

---

## Design goals

1. **Timeline is scannable, not decorative.** Every card carries the version number + status + submitter + approver(s) + change summary. No unnecessary illustrations, no marketing polish — this is an audit surface.
2. **Read-only means read-only.** No inline actions modify any version. `Edit draft` on DRAFT rows routes to PA-PKG-002 (which owns the writes); `Copy fields to new DRAFT` clones the fields but never mutates the source version. Immutable-versions invariant is upheld.
3. **Diff comparison is arbitrary.** Compare any two versions — not just v{N} vs v{N-1}. Critical for audits like "how did we get from v3's pricing to v7's pricing over 4 iterations?".
4. **DEPRECATED versions are not hidden.** They live in the same timeline as ACTIVE and are filterable but never removed. Compliance requirement.
5. **Env-context is unambiguous.** Env badge always visible; TEST persistent warning strip runs; LIVE vs TEST version histories NEVER co-mingle (a version approved in TEST is not visible in LIVE and vice versa).
6. **No color-only status differentiation** — DRAFT / PENDING_APPROVAL / ACTIVE / DEPRECATED status markers on the timeline use tint + glyph + label per Broadcast rule.

---

## Layout

### Timeline view — `/admin/packages/:packageId/history`

Single-column PA console shell (SHR-NAV-001 top bar + PA-NAV-001 env badge + optional TEST warning strip).

**Header block (sticky):**
- Left: page title "{Package display_name} — version history" (`var(--lc-type-heading-1)`) + subtitle "<Numeric>N</Numeric> versions · <Numeric>A</Numeric> approved · <Numeric>D</Numeric> deprecated · Created <Numeric>T</Numeric>" (`var(--lc-type-body-sm)` `--lc-text-muted`).
- Right: `Back to packages` link (routes to PA-PKG-001) + `?` icon button.

**Filter strip (sticky):**
- Row 1: status tabs — `All` (default) / `DRAFT` / `PENDING_APPROVAL` / `ACTIVE` / `DEPRECATED` — each with a `<Numeric>` counter.
- Row 2: `Sort` `<Select>` + `Date range` `<Select>` + `Export CSV` icon-button (exports the currently-filtered timeline).

**Timeline (single column, max-width 900px, centered):**

For each version (newest first per default sort):

```
  ●     v7   Draft
  |     Submitted by Fatima Al-Sayed · 2h ago
  |     [Identity] [Caps] [Price] · Property cap: 100 → 150 · Monthly: $99 → $119
  |     [ Open ] [ Edit draft ]
  |
  ●     v6   Active   Effective 2026-06-02
  |     Submitted by Sara Al Mansouri · Jun 2, 2026
  |     Approved by Omar Al-Khouri · Jun 2, 2026
  |     [Caps] [Price] · Property cap: 75 → 100 · Monthly: $89 → $99
  |     [ Open ]
  |
  ●     v5   Deprecated   Effective 2026-04-14 → 2026-06-02
  |     Submitted by Sara Al Mansouri · Apr 14, 2026
  |     Approved by Omar Al-Khouri · Apr 14, 2026
  |     Deactivated by v6 · Jun 2, 2026
  |     [Identity] [3 feature quotas] · Tagline updated · Rate limits raised
  |     [ Open ]
```

Card layout per §Broadcast alignment. Each card is a focusable `<article>` — J/K keyboard nav cycles through cards.

**Pagination footer (only if >20 versions):** `var(--lc-type-body-sm)`, `var(--lc-text-muted)`, page numerals in `<Numeric>`. Default page size 20.

### Read-only detail view — `/admin/packages/:packageId/versions/:version`

Single-column PA console shell + a back-link.

**Header block:**
- Left: page title "{Package display_name} — v{N} ({status label})" (`var(--lc-type-heading-1)`) + subtitle version-lifecycle summary — for ACTIVE: "Effective {date}"; for DEPRECATED: "Effective {date} → {deactivated_at}"; for DRAFT: "Draft · Last saved {T}"; for PENDING: "Pending approval · Submitted {T}".
- Right: `Back to history` link (routes to timeline).

**Two-column split, 62/38 (diff/values panel / summary + compare + rollback cards):**

**Left column (62%) — 8 read-only sections:**

Same rendering as PA-PKG-003 detail view: 8 collapsible sections; unchanged-vs-compare-target fields collapsed by default; changed fields expanded. When `compare_to` query param is absent, compare target defaults to `v{N-1}` (or "no prior version" for v1 — in which case ALL fields render as "new value" without a strikethrough current).

Top-of-panel toggle: `Show all fields (<Numeric>N</Numeric> unchanged)` — global expand for review.

**Right column (38%):**

**Version summary card:**
- Version number (large, mono) + status badge.
- Submitter row: avatar + display name + Submitted-at.
- Approver row(s) (ACTIVE + DEPRECATED only): one row per approver.
- Effective-from + Deactivated-at rows (ACTIVE + DEPRECATED).
- Change-summary chips.
- Submitter reason blockquote (if present).

**Compare with card:**
- Label "Comparing v{N} against:"
- `<Select>` — default value derived from `compare_to` query param (or `v{N-1}`). Options: every other version of this package, labeled `v{M} · {status} · {date}` (e.g. `v3 · Active · Apr 14 2026`).
- Below the Select, a `Reset to prior version` link that restores the default compare target.
- Changing the compare target refetches the diff (or client-computes from two GET calls if the arbitrary-version-diff endpoint isn't implemented yet).

**Rollback / clone card (only visible with role capability `package.clone_from_history`):**
- `<Button variant="outline">` "Copy fields to new DRAFT" — opens AlertDialog "Create a new DRAFT with v{N}'s field values?" body "This clones every field into a fresh DRAFT. The current DRAFT (if any) will be blocked — you'll need to discard or submit it first. The historical v{N} is not modified."
- If a DRAFT already exists on this package (server-side check on card render): button is disabled with tooltip "A draft already exists for this package — discard or submit it first."
- On confirm: fire `POST /api/admin/packages/:id/versions` with body `{ clone_from_version: N }` (server extends the existing endpoint to accept this optional field — `[BE-DESIGN-06]` extension). Redirect to PA-PKG-002 editor.

### Empty timeline (0 versions — unexpected)

Centered stack: `AlertTriangle` icon `--lc-status-danger-fg` + title "This package has no versions on file" + body "This is unexpected — every package should have at least one version. Contact platform ops or the SRE on-call." + `Back to packages →` link.

### Empty filter (filter returns 0)

Simpler: title "No {status} versions in this range." + Clear filter link.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Timeline — page title template | {Package display_name} — version history |
| Timeline — subtitle template | {N} versions · {A} approved · {D} deprecated · Created {T} |
| Timeline — back-to-packages link | ← Back to packages |
| Timeline — status tab all | All |
| Timeline — status tab draft | Draft |
| Timeline — status tab pending | Pending approval |
| Timeline — status tab active | Active |
| Timeline — status tab deprecated | Deprecated |
| Timeline — sort label | Sort |
| Timeline — sort options | Newest first · Oldest first · Version number ↓ · Version number ↑ |
| Timeline — range label | Date range |
| Timeline — range options | All time · Last 30 days · Last 90 days · Last 12 months · Custom range |
| Timeline — export CSV aria-label | Export version history as CSV |
| Card — version number template | v{N} |
| Card — status draft | Draft |
| Card — status pending | Pending approval |
| Card — status active | Active |
| Card — status deprecated | Deprecated |
| Card — effective from template | Effective {date} |
| Card — effective range template | Effective {from} → {to} |
| Card — submitted-by template | Submitted by {submitter} · {relative_time} |
| Card — approved-by template | Approved by {approver} · {timestamp} |
| Card — approved-by-two template | Approved by {approver1} and {approver2} · {timestamp} |
| Card — deactivated-by-supersede template | Deactivated by v{M} · {timestamp} |
| Card — deactivated-by-admin template | Deactivated by admin action · {timestamp} |
| Card — diff-summary template | {chips} · {inline-summary} |
| Card — action open | Open |
| Card — action edit-draft | Edit draft |
| Card — action review-approvals | Review in approvals queue |
| Empty timeline — title | This package has no versions on file. |
| Empty timeline — body | This is unexpected — every package should have at least one version. Contact platform ops or the SRE on-call. |
| Empty timeline — CTA | ← Back to packages |
| Empty filter — title | No {status} versions in this range. |
| Empty filter — CTA | Clear filter |
| Loading | Loading version history… |
| Env-switch loading | Switching to {env}. Reloading history… |
| Error banner | Couldn't load version history. Try again. |
| Retry button | Retry |
| Pagination template | {start}–{end} of {total} |
| Detail — page title template | {Package display_name} — v{N} ({status}) |
| Detail — subtitle active | Effective {date} |
| Detail — subtitle deprecated | Effective {from} → {to} |
| Detail — subtitle draft | Draft · Last saved {T} |
| Detail — subtitle pending | Pending approval · Submitted {T} |
| Detail — back-to-history link | ← Back to history |
| Detail — diff heading — with compare | Comparing v{N} against v{M} |
| Detail — diff heading — v1 no prior | v1 — original version (no prior to compare) |
| Detail — show-unchanged toggle | Show all fields ({N} unchanged) |
| Detail — hide-unchanged toggle | Hide unchanged fields |
| Detail — version summary heading | Version summary |
| Detail — approver line template | Approved by {approver} · {timestamp} |
| Detail — compare-with heading | Compare v{N} against |
| Detail — compare-with reset | Reset to prior version |
| Detail — rollback heading | Reuse this version's fields |
| Detail — rollback CTA | Copy fields to new DRAFT |
| Detail — rollback disabled tooltip | A draft already exists for this package — discard or submit it first. |
| Rollback confirm — title | Create a new DRAFT with v{N}'s field values? |
| Rollback confirm — body | This clones every field into a fresh DRAFT. The historical v{N} is not modified. You'll be routed to the editor. |
| Rollback confirm — confirm | Create DRAFT |
| Rollback confirm — cancel | Cancel |
| Rollback success toast | Created DRAFT v{N+1} from v{M}. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Timeline card | `Card` |
| Timeline vertical rule + status marker | Custom `<div>` with Broadcast tokens |
| Status badge | `<Badge>` with glyph prefix |
| Change-summary chips | `<Badge variant="outline">` |
| Submitter / approver avatars | `Avatar` + `AvatarImage` + `AvatarFallback` |
| Timeline filter tabs | `Tabs` + `TabsList` + `TabsTrigger` |
| Sort + range Selects | `Select` + `SelectItem` |
| Custom-range date picker | `Popover` + `Calendar` |
| Export CSV | `Button variant="ghost" size="icon"` + `Download` icon |
| Detail read-only sections | `Accordion` + `AccordionItem` |
| Detail summary card | `Card` |
| Detail compare-with card | `Card` with `Select` |
| Detail rollback card | `Card` with `Button variant="outline"` |
| Rollback confirm | `AlertDialog` |
| Empty state | Custom `<div>` with icon + copy |
| Loading skeleton | Custom skeleton cards |
| Error banner | Custom `<div>` with `AlertTriangle` icon |
| Toast | `Sonner` toast |
| Keyboard hints | `Sheet` — inherited from PA-MOD-001 REUSABLE |
| Icons | `lucide-react` — `Clock`, `Check`, `X`, `AlertTriangle`, `ChevronDown`, `ChevronRight`, `Download`, `HelpCircle`, `Copy`, `ArrowLeft`, `RefreshCw`, `RotateCcw` |
| Numeric renders | `<Numeric>` primitive |

---

## Sample content (for v0 / mockup)

**Pass 1 — Timeline view for Small Team:** desktop 1440px, LIVE env.

- Header: "Small Team — version history" title, subtitle "7 versions · 5 approved · 2 deprecated · Created Jan 12, 2026".
- Filter strip: `All` tab active (counter 7); `Draft` (1), `Pending approval` (1), `Active` (1), `Deprecated` (4); Sort "Newest first"; Range "All time"; Export CSV icon on the right.
- Timeline showing 7 stacked cards (newest first):
  1. `● v7 Draft` — Submitted by Fatima Al-Sayed · 2h ago — chips `Identity` `Caps` `Price` — "Property cap: 100 → 150 · Monthly: $99 → $119" — `Open` + `Edit draft`.
  2. `▲ v6 Pending approval` (using amber status marker) — Submitted by Sara Al Mansouri · 4h ago — chips `Caps` `Price` — "Property cap: 100 → 150 · Monthly: $99 → $110" — `Open` + `Review in approvals queue`. (NOTE: this shows a race condition where two admins submitted overlapping changes — v6 pending, v7 also drafted; only one will ultimately win.)
  3. `● v5 Active   Effective 2026-06-02` — Submitted by Sara Al Mansouri · Jun 2 2026 — Approved by Omar Al-Khouri · Jun 2 2026 — chips `Caps` `Price` — "Property cap: 75 → 100 · Monthly: $89 → $99" — `Open`.
  4. `▢ v4 Deprecated   Effective 2026-04-14 → 2026-06-02` — Submitted + Approved same day — Deactivated by v5 · Jun 2 2026 — chips `Identity` `3 feature quotas` — "Tagline updated · AI-copy quota raised" — `Open`.
  5. `▢ v3 Deprecated   Effective 2026-03-01 → 2026-04-14` — chips `Price` — "Monthly: $79 → $89" — `Open`.
  6. `▢ v2 Deprecated   Effective 2026-02-10 → 2026-03-01` — chips `Caps` `2 toggles` — `Open`.
  7. `▢ v1 Deprecated   Effective 2026-01-12 → 2026-02-10` — Original version — chips (none) — "Initial version" — `Open`.

Draw the vertical timeline rule connecting all 7 status markers on the left of the cards.

**Pass 2 — Read-only detail view for v5 (Active):** desktop 1440px, LIVE env.

- Header: "Small Team — v5 (Active)", subtitle "Effective 2026-06-02". `← Back to history` link on the right.
- Left column (62%): heading "Comparing v5 against v4". Sections Identity + Caps + Price expanded with the 3 changes (tagline/property cap/monthly price); other sections collapsed with "No changes" suffix. Global toggle "Show all fields (28 unchanged)".
- Right column (38%):
  - Version summary card: v5 · Active · Submitted by Sara Al Mansouri · Jun 2 2026 · Approved by Omar Al-Khouri · Jun 2 2026 · Effective from Jun 2 2026 · chips `Caps` `Price`.
  - Compare with card: label "Comparing v5 against"; Select showing "v4 · Deprecated · Apr 14 2026" (default); options include v3, v2, v1, v6 pending, v7 draft.
  - Rollback card: "Reuse this version's fields" heading; Copy fields to new DRAFT button DISABLED with tooltip (because v7 draft already exists).

Do NOT fabricate cross-version audit data beyond what backend returns. Every field above corresponds to a real payload attribute from §Backend contract.

---

## Interactions

**On timeline page load:**
- Fetch `GET /api/admin/packages/:packageId` (returns package + all versions summary — extended per Cursor prompt §2.1).
- Show 3-card skeleton while loading.
- On success: render timeline. Card 1 focused for keyboard nav.

**On timeline filter tab change:**
- Update `?status=<x>` URL. Client-side filter (versions are already in memory from the list call).

**On sort change:**
- Update `?sort=<x>` URL. Client-side sort.

**On date-range change:**
- Update `?range=<x>` URL. Client-side filter. Custom range opens a Popover Calendar.

**On card click (or `Open` action):**
- Navigate to `/admin/packages/:packageId/versions/:version` with `?return_to=<current-url>`.

**On DRAFT card `Edit draft` action:**
- Navigate to `/admin/packages/:packageId/versions/:version/edit` (PA-PKG-002).

**On PENDING card `Review in approvals queue` action:**
- Navigate to `/admin/packages/approvals/:versionId` (PA-PKG-003 detail).

**On Export CSV:**
- Fires `GET /api/admin/packages/:packageId/versions.csv?<same-filter>`. Browser download. Columns: `version_id, version, status, submitted_by, submitted_at, approved_by, approved_at, effective_from, deactivated_at, deactivated_reason, change_summary_json`.

**On detail page load:**
- Fetch `GET /api/admin/packages/:packageId/versions/:version` — the full field payload.
- Fetch `GET /api/admin/packages/:packageId` (or reuse the list-cache) for the Compare-with Select options.
- If `compare_to` query param present: also fetch `GET /api/admin/packages/:packageId/versions/:compare_to`. Client-computes diff (or uses arbitrary-version-diff endpoint if implemented).
- Show skeleton diff + skeleton right-column cards.

**On section header click (detail view):**
- Toggle Accordion open/close. Same behavior as PA-PKG-003 detail.

**On "Show all fields (N unchanged)" toggle:**
- Global expand.

**On Compare-with Select change:**
- Update `?compare_to=<x>` URL.
- Refetch the compare-target version + recompute diff.
- Diff panel re-renders with `--lc-duration-base` fade.

**On Copy-fields-to-new-DRAFT:**
- If disabled: no-op + tooltip.
- Otherwise: open Rollback confirm AlertDialog.
- On confirm: fire `POST /api/admin/packages/:id/versions` with `{ clone_from_version: N }`.
- On success: toast + navigate to `/admin/packages/:id/versions/:newDraftVersion/edit` (PA-PKG-002).
- On 409 (draft-already-exists — race): toast "A draft already exists — opening it" + navigate to that existing draft.

**On keyboard shortcut:**
- Timeline: `J` next card · `K` prev · `Enter` open focused card · `.` refresh · `?` shortcuts · `Esc` back to packages.
- Detail: `.` refresh · `?` shortcuts · `Esc` back to history.

**On PA-NAV-001 env-change:**
- Confirm-close if a modal is open. Otherwise, if the current versionId doesn't exist in the new env, redirect to `/admin/packages/:packageId/history` in new env; if the package doesn't exist in new env either, redirect to `/admin/packages` in new env.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Timeline loading** | Page mount | Skeleton cards. |
| **Timeline ready — all** | Load complete | Cards rendered newest-first. Card 1 focused. |
| **Timeline filter — specific status** | Tab change | Client-side filter. |
| **Timeline empty package** | 0 versions (unexpected) | Danger empty state with contact-ops copy. |
| **Timeline empty filter** | Filter returns 0 | "No {status} versions in this range." |
| **Timeline error** | Load fails | Error banner + Retry. |
| **Detail loading** | Page mount | Skeleton diff + skeleton cards. |
| **Detail ready — with compare** | Load complete + compare target loaded | Diff renders with changed-expanded, unchanged-collapsed. |
| **Detail ready — v1 no prior** | version=1 | Diff panel shows "v1 — original version" and all fields render as "new" without strikethrough current. |
| **Detail compare-change loading** | Compare Select change | Diff panel dimmed while compare-target refetches. |
| **Rollback card visible** | Role has `package.clone_from_history` | Button rendered. |
| **Rollback card hidden** | Role lacks capability | Card omitted entirely (no disabled placeholder). |
| **Rollback button disabled** | Draft already exists for this package | Button disabled + tooltip. |
| **Rollback confirm open** | Button click when enabled | AlertDialog. |
| **Rollback success** | POST 201 | Toast + navigate to PA-PKG-002. |
| **Rollback conflict 409** | Draft race | Toast "A draft already exists — opening it" + navigate to existing draft. |
| **Session expired** | 401 | Redirect to `SHR-AUT-001`. |
| **Insufficient permission** | 403 | Full-page block. |
| **Env-switch mid-flow** | PA-NAV-001 env change | Redirect if the target versionId or packageId doesn't exist in new env. |
| **TEST-env warning strip** | env=TEST | Persistent full-width strip. |
| **Below-min-viewport** | <1024px | Full-page info block. |
| **RTL** | Locale = ar | Timeline vertical rule moves to right; card content mirrors; detail-view columns reverse. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap. |

---

## Accessibility

- Timeline is a `<ol>` with each card `<li role="article">` + `tabindex="0"`.
- Vertical timeline rule + status markers are decorative (`aria-hidden="true"`) — status is announced via the card badge label.
- Filter tabs `role="tablist"` + arrow-key navigation.
- Compare-with Select in detail view is a proper `<Select>` with keyboard support.
- Rollback AlertDialog traps focus + Esc closes.
- Toasts `role="status"` + `aria-live="polite"`; destructive `assertive`.
- Every icon-only button has `aria-label`.
- Every timestamp has full ISO date/time in `title` attribute for tooltip + SR readback.
- Focus rings via base CSS two-tone.
- Skip-to-content link at top of both routes.
- Section-expand toggles have `aria-expanded` state.

---

## Anti-patterns (do not do these)

- Do NOT allow inline editing on any timeline card. DRAFT cards route to PA-PKG-002 for edits; every other status is immutable.
- Do NOT hide DEPRECATED versions from the default view. They're part of the audit record.
- Do NOT show a "promote to ACTIVE" action on DEPRECATED versions. That would break the immutable-versions invariant. Use Copy-fields-to-new-DRAFT instead.
- Do NOT compare against a version that doesn't exist (e.g. v0 for v1 detail). The v1 case renders "original version" copy instead of forcing an invalid compare.
- Do NOT let the timeline paginate silently. If >20 versions, page counter is visible + `<Numeric>` counters in filter tabs stay accurate for the FULL package (not per-page).
- Do NOT collapse the detail-view diff panel by default when there ARE changes. Changed fields are open; unchanged are closed.
- Do NOT show the marketing preview on the detail view. This is an audit surface, not a promotion surface — the preview lives in PA-PKG-002 (submitter's editor).
- Do NOT co-mingle LIVE and TEST version history.
- Do NOT let the Rollback card be visible if the current PA lacks the capability. Server also enforces; UI omits.
- Do NOT paint the timeline vertical rule in `--lc-action-primary`. It's a structural line, use `--lc-border-strong`.

---

## Reference designs

- **GitHub commit history + compare-across-commits** — direct pattern predecessor for arbitrary-version diff.
- **Stripe Products → Price history** — timeline of price changes with effective-from ranges.
- **Notion page → Version history** — click any version → read-only view.
- **Linear → Issue history sidebar** — condensed change-summary chips per version.
- **Figma → Version history** — timeline card model with submitter avatars + status markers.

Do NOT match:
- Wikipedia edit history (too dense, wrong for a small-cardinality version list).
- Google Docs → Version history (too visual; missing the audit structure needed for PA).

---

## Backend contract

**Timeline endpoint:** `GET /api/admin/packages/:packageId`

Response 200:
```json
{
  "package": {
    "id": "pkg_small_team",
    "code": "small-team",
    "tier": "small_team",
    "currency": "USD",
    "billing_cadence": "monthly_and_annual",
    "created_at": "2026-01-12T09:00:00Z"
  },
  "versions": [
    {
      "version": 7,
      "status": "DRAFT",
      "submitted_at": null,
      "submitter": { "id": "usr_fatima", "display_name": "Fatima Al-Sayed", "avatar_url": "…", "role": "PA · Elite Support" },
      "approvers": [],
      "effective_from": null,
      "deactivated_at": null,
      "deactivated_by_version": null,
      "deactivated_reason": null,
      "change_summary": { "identity": true, "caps": true, "price": true, "trial": false, "portal_group": false, "feature_quotas_count": 0, "feature_toggles_count": 0, "support_level": false },
      "inline_summary": "Property cap: 100 → 150 · Monthly: $99 → $119"
    },
    {
      "version": 6,
      "status": "PENDING_APPROVAL",
      "submitted_at": "2026-09-08T10:00:00Z",
      "submitter": { "id": "usr_sara", "display_name": "Sara Al Mansouri", "avatar_url": "…" },
      "approvers": [],
      "effective_from": null,
      "change_summary": { "caps": true, "price": true },
      "inline_summary": "Property cap: 100 → 150 · Monthly: $99 → $110"
    },
    {
      "version": 5,
      "status": "ACTIVE",
      "submitted_at": "2026-06-02T08:30:00Z",
      "submitter": { "id": "usr_sara", "display_name": "Sara Al Mansouri" },
      "approvers": [{ "id": "usr_omar", "display_name": "Omar Al-Khouri", "approved_at": "2026-06-02T09:15:00Z" }],
      "effective_from": "2026-06-02",
      "deactivated_at": null,
      "change_summary": { "caps": true, "price": true }
    }
  ],
  "counts": { "total": 7, "draft": 1, "pending": 1, "active": 1, "deprecated": 4 },
  "env": "live",
  "current_pa_capabilities": { "package_clone_from_history": true }
}
```

**Per-version read endpoint:** `GET /api/admin/packages/:packageId/versions/:version` — same shape as PA-PKG-002 read endpoint.

**Arbitrary-version diff endpoint (`[BE-DESIGN-06]`):** `GET /api/admin/packages/:packageId/versions/:versionA/diff/:versionB`

Response 200:
```json
{
  "a_version": 5,
  "b_version": 4,
  "changes": {
    "identity": [{ "field": "tagline", "a": "…", "b": "…" }],
    "caps": [{ "field": "property_cap", "a": 100, "b": 75 }],
    "price": [{ "field": "price_monthly_minor", "a": 9900, "b": 8900 }]
  },
  "unchanged_count": 28
}
```

If not implemented in v1: client fetches both versions via the per-version read endpoint and computes the diff client-side (identical to what the endpoint would do; just heavier on the wire).

**Clone-from-version endpoint (extends existing new-DRAFT endpoint per Cursor prompt §2.1):** `POST /api/admin/packages/:packageId/versions` with body `{ clone_from_version: 5 }` — server copies v5's fields into a fresh DRAFT.

Response 409 `DRAFT_ALREADY_EXISTS`:
```json
{ "error": "DRAFT_ALREADY_EXISTS", "existing_draft_version": 7 }
```

**CSV export:** `GET /api/admin/packages/:packageId/versions.csv?<same-filter>`.

**Prerequisites tracked / to file:**

- ⏳ `GET /api/admin/packages/:packageId` — extend to return all-versions summary + counts + current_pa_capabilities. Per Cursor prompt §2.1 the endpoint exists but response shape needs extension. ~0.5 day. Fold into the Cursor prompt PR.
- **`[BE-DESIGN-06] Arbitrary-version diff endpoint — NEW.** `GET /api/admin/packages/:packageId/versions/:versionA/diff/:versionB` — server-side diff computation for compare-across-versions. ~1 day. NOT blocking for v1 if client-side diff computation is used. **File in kickoff §5a.**
- ⏳ Clone-from-version parameter on existing create-DRAFT endpoint. ~0.5 day extension.
- ⏳ CSV export endpoint. ~0.5 day.

---

## Downstream implementation (Cursor prompt handoff notes)

Direct alignment with `CURSOR_PA_PACKAGE_EDIT_UI.md` §2.4 "PA-PKG-004" section.

- **Files to create:** `web/src/pages/admin/packages/PackageVersionHistoryPage.tsx` + `web/src/pages/admin/packages/PackageVersionReadOnlyPage.tsx`.
- **Route registration:** `/admin/packages/:packageId/history` + `/admin/packages/:packageId/versions/:version` (without `/edit`) behind `PAConsoleGuard`.
- **Component decomposition:**
  - `PackageVersionHistoryPage.tsx` — timeline page shell + filter/sort/pagination + data fetching.
  - `PackageVersionTimelineCard.tsx` — one card per version.
  - `PackageVersionReadOnlyPage.tsx` — read-only detail shell.
  - `PackageVersionDiffSection.tsx` — REUSABLE from PA-PKG-003 (per-section collapsible diff).
  - `PackageVersionSummaryCard.tsx` — right-column summary.
  - `PackageVersionCompareCard.tsx` — right-column compare-with Select.
  - `PackageVersionRollbackCard.tsx` — right-column rollback.
  - `PackageVersionRollbackConfirmDialog.tsx` — AlertDialog.
  - Reused: `PAKeyboardShortcutsPanel` from PA-MOD-001.
- **Data layer:**
  - Hook: `usePackageVersionsQuery({ packageId, env })` — fetches the timeline payload; 1min stale time.
  - Hook: `usePackageVersionQuery({ packageId, version, env })` — per-version read.
  - Hook: `usePackageVersionDiffQuery({ packageId, versionA, versionB, env })` — uses arbitrary-diff endpoint if available, else client-computes from two version fetches.
  - Mutation: `useCloneFromVersion(packageId, sourceVersion)`.
- **Test discipline:**
  - Unit: timeline card renders per status; filter tabs + sort + range work; detail view diff sections open/close.
  - Integration: full flow — timeline load → filter to DEPRECATED → open v4 detail → change compare-with to v3 → diff updates → rollback → new DRAFT created → route to PA-PKG-002.
  - RTL: `screens.rtl.test.tsx`.
  - Broadcast: `no-raw-hex.test.ts` green.
  - Real-Postgres: create a package with 5 versions across statuses → verify timeline correctly reports each.
  - Accessibility: axe-core scan of timeline + detail + rollback modal.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Page shell inherits PA-MOD-001 unchanged.
- Timeline vertical rule `--lc-border-strong` (2px wide).
- Status markers on the timeline: circular 12px dots using `--lc-status-{draft,warning,published,archived}-dot` fills + glyph inside (○ ▲ ● ▢); markers have `--lc-surface-raised` outer ring to visually "punch through" the vertical rule.
- Timeline cards `<Card>` on `var(--lc-surface-raised)` with `var(--lc-radius-lg)` + `--lc-elevation-sm`.
- Card version number `var(--lc-type-heading-3)` mono; status badge with tint + glyph + label; submitter/approver avatars 32px.
- Change-summary chips `<Badge variant="outline">`.
- Inline-summary text `var(--lc-type-caption)` `--lc-text-muted` truncated at ~90ch with `<Tooltip>` for full.
- Detail view left column read-only diff sections: identical styling to PA-PKG-003 detail view left column.
- Detail view right column cards: `<Card>` on `var(--lc-surface-raised)` on a `var(--lc-surface-sunken)` panel background.
- Rollback button `<Button variant="outline">` with `--lc-action-primary` outline; disabled state greyed via base CSS.
- Rollback confirm AlertDialog `--lc-elevation-lg`.
- Motion: timeline cards stagger fade-in `--lc-duration-slow` (50ms per card); section expand/collapse `--lc-duration-base`; compare-with change `--lc-duration-base` fade. NO signal-lamp motif.
- Radii: cards + modals `var(--lc-radius-lg)`; buttons + inputs + Selects `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`.
- Focus rings: two-tone via base CSS.
- Never use `--lc-action-primary` as a card fill or timeline-rule color; that token is reserved for the primary CTA and outline emphasis on rollback.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) package version-history + read-only-version screens (PA-PKG-004) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is the audit-timeline surface for one package — every DRAFT / PENDING / ACTIVE / DEPRECATED version listed newest-first with click-to-read-only-detail and arbitrary-version diff comparison. Read-only surface (no writes). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass (timeline view): render the desktop 1440px layout at /admin/packages/pkg_small_team/history with LIVE env badge in the top bar (green), All tab active (counter 7), 7 stacked cards on a vertical timeline (Draft v7 → Pending v6 → Active v5 → 4 Deprecated cards v4..v1). Each card carries version number + status badge + submitter avatar+name + approver row (for approved versions) + effective-from date + change-summary chips + inline diff summary + action buttons. Vertical rule connects all 7 status markers on the left of the cards.

LTR English only for this pass — I'll ask for the read-only detail view next.

Follow the copy table in the brief exactly.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now the read-only detail view at /admin/packages/pkg_small_team/versions/5. Left column: heading "Comparing v5 against v4", 8 collapsible sections with Identity + Caps + Price expanded (3 changes) and rest collapsed with "No changes" suffix; global toggle "Show all fields (28 unchanged)". Right column: Version summary card (v5 Active, Sara submitted, Omar approved, effective Jun 2 2026, chips Caps+Price); Compare-with card (Select showing "v4 · Deprecated · Apr 14 2026" default); Rollback card with Copy-fields-to-new-DRAFT button DISABLED (tooltip "A draft already exists for this package").`
2. `Now change the Compare-with Select to "v1 · Deprecated · Jan 12 2026" — diff panel refetches and expands to show many more changed fields (roughly 15 fields across all 8 sections).`
3. `Now the Rollback confirm AlertDialog open on top of pass 2 — hypothetical state where the DRAFT was discarded and the button is now enabled.`
4. `Now the empty-package state — an unexpected 0-versions package with the AlertTriangle danger empty-state block.`
5. `Now the same timeline in TEST env — amber TEST badge + warning strip under top bar.`
6. `Now RTL Arabic at desktop 1440px for the timeline. MIRROR the whole layout — timeline vertical rule moves to right, cards mirror.`
7. `Now dark mode versions of pass 1 (timeline) and pass 2 (detail).`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-PKG-004/` + screenshot to `docs/design/mockups/PA-PKG-004-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 7 iteration states (timeline-ready, detail-vs-prior, detail-vs-v1, rollback-confirm, empty-package, TEST env, RTL timeline, dark timeline+detail).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-PKG-004/`.
- [ ] Cursor Wave-3.5 dispatch prompt references this brief.
- [ ] `[BE-DESIGN-06]` arbitrary-version diff endpoint filed in kickoff §5a as non-blocking (client-side fallback documented).
- [ ] Clone-from-version parameter on the existing new-DRAFT endpoint folded into the Cursor prompt PR.
- [ ] CSV export endpoint folded into the Cursor prompt PR.
- [ ] Reusable `PackageVersionDiffSection.tsx` shared between PA-PKG-003 detail view + PA-PKG-004 read-only detail view — enforced by a single component in `web/src/components/admin/packages/`.
