# Screen Brief — AGN-MEM-002 · Applications queue (WF-02 approver-side)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENCY.md` entry `AGN-MEM-002`. Anchor brief for the WF-02 approver-side pair; the delta brief `AGN-MEM-002b-application-detail-brief.md` covers the single-item review surface and inherits the Broadcast alignment section from this file.

Wave 1 (Week 1) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §6. WF-02 deadlock resolution — pairs with `AGN-MEM-005-public-join-brief.md` (agent-initiator), `AGT-REC-004-application-outcome-brief.md` (agent-recipient), and `SHR-AUT-006-signup-brief.md` (registration path (b) entry point).

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts (this callout block is REFERENCED by AGN-MEM-002b — keep it complete here):**

- Page shell: `background: var(--lc-bg-page)`; content max-width 1440px with `padding-inline: var(--lc-space-2xl)` on ≥1024px viewports.
- Page title ("Applications"): `font: var(--lc-type-heading-1)` (600 26/32 IBM Plex Sans) — NOT display-tier; this is an admin workspace, not marketing.
- Section subtitle / applicant count line: `font: var(--lc-type-body-sm)`, `color: var(--lc-text-muted)`. Numeric run wrapped in `<Numeric>` — e.g. `<Numeric>12</Numeric> pending, <Numeric>3</Numeric> approved this week`.
- Filter chip strip (Status · Applied within · Search): `<Tabs>` for status (Pending default), `<Select>` for applied-within, `<Input>` with `Search` lucide icon for name search. Chip strip sits on `var(--lc-surface-raised)` with `border-bottom: 1px solid var(--lc-border)`.
- Bulk-action bar (appears when ≥1 row selected): `background: var(--lc-surface-sunken)`, `border-radius: var(--lc-radius-md)`, `padding: var(--lc-space-sm) var(--lc-space-md)`. Slides in above the table with `--lc-duration-fast` height transition.
- Table shell: `<Table>` primitive. Header row `background: var(--lc-surface-sunken)`, header text `var(--lc-type-overline)` + `color: var(--lc-text-muted)`. Body rows on `var(--lc-surface-raised)` separated by `border-bottom: 1px solid var(--lc-border)`. Row hover `background: var(--lc-surface-sunken)` at `--lc-duration-fast`.
- Applicant cell: 32px circular avatar + name (`--lc-type-body`) + secondary line (city, experience) in `--lc-type-caption` `--lc-text-muted`. Avatar radius `var(--lc-radius-pill)`.
- Applied-at column: relative time ("2h ago", "3d ago") in `--lc-type-body-sm`; full timestamp in `<Tooltip>` on hover. Rendered via `<Numeric>` wrapper to lock tabular-nums.
- Listings-count column: numeric via `<Numeric>` — `<Numeric>14</Numeric>` centered.
- Message excerpt column: first ~90 chars of the application message + `…` ellipsis via `text-overflow`, `--lc-type-body-sm`.
- Status pill: `<Badge>` — pending `--lc-status-draft-{bg,fg,dot}` + ○ glyph, approved `--lc-status-published-{bg,fg,dot}` + ● glyph, rejected `--lc-status-closed-{bg,fg,dot}` + ◆ glyph, expired `--lc-status-archived-{bg,fg,dot}` + ▢ glyph. Always tint + glyph + label; never color-alone.
- Row action buttons (Approve / Reject inline on hover): `<Button size="sm" variant="outline">` — Approve `--lc-action-primary` outline, Reject `--lc-text-secondary` outline. Inline actions only appear on row hover for the Pending status; approved/rejected rows show View instead.
- Pagination footer: `--lc-type-body-sm`, `--lc-text-muted`, page numerals in `<Numeric>`.
- Empty state block: centered stack, illustration placeholder (`--lc-surface-sunken` 200px square with dashed `--lc-border-strong`), title `--lc-type-heading-3`, body `--lc-type-body` `--lc-text-muted`, primary CTA linking to the agency's public profile URL.
- Loading skeleton: 8 shimmering rows using `--lc-surface-sunken` block with subtle animation at `--lc-duration-base ease-in-out infinite alternate`; respects `prefers-reduced-motion`.
- Focus rings: two-tone via base CSS — do NOT override. Table rows are focusable (`tabindex="0"`) so J/K keyboard navigation lands a visible focus ring.
- Radii: table container `var(--lc-radius-lg)`, filter chips `var(--lc-radius-md)`, buttons `var(--lc-radius-md)`, badges `var(--lc-radius-pill)`.
- Motion: bulk-action bar slide-in `--lc-duration-fast` `--lc-easing-out`; row hover `--lc-duration-fast`; status pill swap after inline approve/reject `--lc-duration-base` `--lc-easing-in-out`; NO signal-lamp motif (reserved for "listing went live" per BROADCAST_ALIGNMENT_REFERENCE.md).
- Numeric fields — every count, listings number, MTD figure, pagination index, timestamp, page-number, badge counter uses `<Numeric>` or `.lc-data`. Enforced by `--lc-font-mono` + `tabular-nums`.

---

## Meta

| | |
|---|---|
| Screen ID | AGN-MEM-002 |
| Screen name | Applications queue |
| Persona | Agency admin (Owner OR member with `capability_pack` including `agency-management`) |
| Device targets | Desktop 1440px (primary), tablet 1024px (secondary — table stays; two lower-priority columns collapse into an expandable row-detail) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/agency/members/applications` (query params: `?status=pending\|approved\|rejected\|expired`, `?within=7d\|30d\|90d\|all`, `?q=<name>`, `?page=<n>`) |
| Current state | MISSING dedicated page. Backend `GET /api/agencies/:id/applications` exists per matrix note. |
| Workflow role | WF-02 role = Approval queue (agent-joins-agency flow, approver side) |
| Backend prerequisites | ✅ `GET /api/agencies/:id/applications?status=…` · ✅ `POST /api/agencies/:id/applications/:appId/approve` · ✅ `POST /api/agencies/:id/applications/:appId/reject` · ✅ `POST /api/agencies/:id/applications/bulk-approve` and `.../bulk-reject` (bulk endpoints — VERIFY existence; see §Backend contract) · ⏳ agent-side outcome screen `AGT-REC-004` (pairs) |
| Cluster | Week 1 (WF-02 deadlock resolution) alongside AGN-MEM-005 · AGN-MEM-002b · AGT-REC-004 · SHR-AUT-006 |

---

## Purpose

Agency admin (Owner or member with `agency-management` capability pack) reviews the queue of agents who have applied to join their agency and takes an approve / reject decision.

The queue is where the agency operationalizes WF-02 (Join agency). Applicants originate from:

- `SHR-AUT-006` registration path (b) "Agent joining an existing agency" — user typed the agency slug / invitation code at signup.
- `AGN-MEM-005` public agency profile "Apply to join" button — user found the agency organically.
- `AGN-MEM-003` invite emails that led to an application (as opposed to a direct join).

The queue serves three admin tasks at three cadences:

1. **Daily triage** — pending applications need a quick accept/reject to keep applicants unblocked; SLA target 48 hours (surface via applied-at aging).
2. **Weekly hygiene** — approved / rejected views for audit + to spot patterns (e.g. surge of low-experience applicants suggests the profile pitch needs work).
3. **Bulk cleanup** — during a hiring wave or after a stalled backlog, admin selects many rows and applies one decision with a shared reason.

Success outcome: the admin moves an application from pending to approved (membership created, agent notified via AGT-REC-004) or rejected (with reason, agent notified). Zero pending applications older than 48 hours.

---

## Design goals

1. **Triage-first density.** Admin scans dozens of rows in seconds. Every column earns its place; secondary metadata hides behind hover or the detail screen. Row height minimal but tap-target safe (≥44px total row height).
2. **Keyboard-native.** Real agency operators live in tools like Front, Superhuman, Linear. J/K to navigate rows, `A` to approve focused row, `R` to reject, `Shift+Click` for range selection, `Space` to preview in a side drawer (optional Phase 2). Keyboard hints visible on `?` press.
3. **Bulk actions are safe by construction.** A shared reason is required for bulk reject (never anonymous rejection). Bulk approve confirms count in a small modal — no accidental 50-approve slip.
4. **Applicant humanity preserved.** Avatar + name + city + listings-count + message excerpt on every row — never reduce an applicant to a checkbox. The message excerpt is the honesty guardrail against faceless approval.
5. **Empty state is a coaching moment.** "No applications yet" is a chance to nudge the admin toward publishing their public agency profile so applicants can find them. Deep-link straight to `AGN-MEM-005` public URL.
6. **Status-view symmetry.** Pending is default and always active; Approved / Rejected / Expired are tabs that swap the same table shell — no separate pages. Consistent muscle memory.
7. **No color-only status differentiation** — pending / approved / rejected / expired all use tint + glyph + label per Broadcast rule.

---

## Layout

### Desktop 1440px (primary)

Single-column stack inside the standard Agency shell (SHR-NAV-001 top bar + SHR-NAV-002 side drawer):

**Header block (sticky under the top bar):**
- Left: page title "Applications" (`--lc-type-heading-1`) + subtitle "<Numeric>N</Numeric> pending · <Numeric>M</Numeric> approved · <Numeric>K</Numeric> rejected this week" (`--lc-type-body-sm` `--lc-text-muted`).
- Right: two utility buttons — `Export CSV` (`<Button variant="ghost">`), `?` keyboard-hints toggle (`<Button variant="ghost" size="icon">`).

**Filter strip (sticky):**
- Left: status tabs — `Pending` (default active) / `Approved` / `Rejected` / `Expired`. Each tab shows a counter — `Pending <Numeric>12</Numeric>`.
- Center: `Applied within` `<Select>` — options `7 days`, `30 days` (default), `90 days`, `All time`.
- Right: search `<Input>` with `Search` icon prefix — placeholder `Search applicants by name…`. Debounced 200ms on type.

**Bulk-action bar (conditional — appears when ≥1 row selected):**
- Slides in with `--lc-duration-fast` height transition, sits between the filter strip and the table.
- Left: `<Numeric>N</Numeric> selected · Clear selection` (Clear is a link-styled button).
- Right: `Approve N`, `Reject N` primary buttons. Approve opens a small confirmation modal (count + Confirm); Reject opens a modal that REQUIRES a shared reason (see §Interactions).

**Table:**
- Columns (desktop):
  1. Row-select checkbox (32px)
  2. Applicant (avatar + name + city · experience secondary line) — sortable by name
  3. Applied — relative time (default sort desc)
  4. Listings — applicant's stated listings count `<Numeric>`
  5. Message excerpt — ~90 chars
  6. Status — `<Badge>` pill
  7. Row actions (visible on hover for Pending rows) — Approve / Reject / View
- Row height ~64px (avatar + secondary line comfortably vertical).
- Row click (anywhere except checkbox or row-action buttons) → navigate to `AGN-MEM-002b` (`/agency/members/applications/:applicationId`).
- Row focus state via keyboard (`J`/`K` cycles through rows).
- Sticky column header while table scrolls.

**Pagination footer:**
- Right-aligned: `<Numeric>1–25</Numeric> of <Numeric>73</Numeric>` + prev / next buttons + `<Select>` page-size (25 default, 50, 100).

### Tablet 1024px (secondary)

Same page shell, but the table drops the `Message excerpt` and `Listings` columns; a row-expander chevron on the right reveals those two fields inline when tapped. Row height grows to ~72px for tap-target comfort.

### Mobile ≤767px (fallback — not a target device for Agency v1)

Agency screens are desktop-only for v1 per matrix. On mobile viewports, render a full-page "Agency console requires a larger screen" info state with a link back to the shared home. Do NOT attempt a mobile-optimized queue in this brief; that's Phase 2.

### Empty state (Pending tab, 0 rows)

Centered stack in the table area:
- Illustration placeholder (200px square, `--lc-surface-sunken`, dashed `--lc-border-strong`) — label "Illustration — empty inbox".
- Title (`--lc-type-heading-3`): "No applications yet"
- Body (`--lc-type-body` `--lc-text-muted`): "When agents apply to join your agency, they'll show up here. Share your public agency profile to start receiving applications."
- Primary CTA (`<Button variant="default">`): "View your public agency page →" — deep-links to `/agencies/<slug>` (AGN-MEM-005 public route).
- Secondary CTA (`<Button variant="outline">`): "Invite an agent directly" — opens `AGN-MEM-003` invite modal.

### Empty state (Approved / Rejected / Expired tabs, 0 rows)

Simpler: title "No <status> applications in this range" + `--lc-text-muted` body "Try widening the 'Applied within' filter." No CTAs; this is a benign zero-count.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Page title | Applications |
| Subtitle template | {N} pending · {M} approved · {K} rejected this week |
| Status tab — pending | Pending |
| Status tab — approved | Approved |
| Status tab — rejected | Rejected |
| Status tab — expired | Expired |
| Applied-within label | Applied within |
| Applied-within options | Last 7 days · Last 30 days · Last 90 days · All time |
| Search placeholder | Search applicants by name… |
| Export CSV | Export CSV |
| Keyboard hints button aria-label | Show keyboard shortcuts |
| Keyboard hints panel title | Keyboard shortcuts |
| Shortcut — navigate down | `J` — next application |
| Shortcut — navigate up | `K` — previous application |
| Shortcut — approve | `A` — approve focused application |
| Shortcut — reject | `R` — reject focused application |
| Shortcut — open detail | `Enter` — open application detail |
| Shortcut — select | `X` — toggle row selection |
| Shortcut — select-all | `Shift + A` — select all visible rows |
| Column — applicant | Applicant |
| Column — applied | Applied |
| Column — listings | Listings |
| Column — message | Message |
| Column — status | Status |
| Row action — approve | Approve |
| Row action — reject | Reject |
| Row action — view | View |
| Bulk-bar N selected | {N} selected |
| Bulk-bar clear | Clear selection |
| Bulk-bar approve | Approve {N} |
| Bulk-bar reject | Reject {N} |
| Bulk approve modal title | Approve {N} applications? |
| Bulk approve modal body | Each applicant will be added to your agency as an Agent (default role) and notified immediately. |
| Bulk approve modal confirm | Approve all {N} |
| Bulk approve modal cancel | Cancel |
| Bulk reject modal title | Reject {N} applications |
| Bulk reject modal reason label | Reason (shown to each applicant) |
| Bulk reject modal reason placeholder | e.g. We're not adding agents in your city right now. |
| Bulk reject modal reason helper | Required. This message is sent to every rejected applicant. Keep it kind and clear. |
| Bulk reject modal confirm | Reject all {N} |
| Bulk reject modal cancel | Cancel |
| Empty pending — title | No applications yet |
| Empty pending — body | When agents apply to join your agency, they'll show up here. Share your public agency profile to start receiving applications. |
| Empty pending — primary CTA | View your public agency page → |
| Empty pending — secondary CTA | Invite an agent directly |
| Empty other-tab — title | No {status} applications in this range |
| Empty other-tab — body | Try widening the 'Applied within' filter. |
| Loading | Loading applications… |
| Error banner | Couldn't load applications. Try again. |
| Retry button | Retry |
| Pagination template | {start}–{end} of {total} |
| Page-size label | Rows per page |
| Approved toast (single) | Approved {name}. |
| Rejected toast (single) | Rejected {name}. |
| Approved toast (bulk) | Approved {N} applications. |
| Rejected toast (bulk) | Rejected {N} applications. |
| Undo toast link | Undo |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Page title | plain `<h1>` with `--lc-type-heading-1` |
| Status tabs | `Tabs` + `TabsList` + `TabsTrigger` |
| Applied-within picker | `Select` + `SelectItem` |
| Search input | `Input` with `Search` icon (lucide) as prefix |
| Table | `Table` + `TableHeader` + `TableRow` + `TableCell` |
| Row-select checkbox | `Checkbox` |
| Avatar | `Avatar` + `AvatarImage` + `AvatarFallback` |
| Status pill | `Badge` (variant per status) with glyph prefix |
| Row action buttons | `Button size="sm" variant="outline"` |
| Bulk action bar | Custom `<div>` styled with Broadcast tokens |
| Bulk approve modal | `AlertDialog` |
| Bulk reject modal | `Dialog` (requires text input, so not AlertDialog) |
| Reason textarea | `Textarea` |
| Pagination controls | `Button variant="ghost" size="icon"` for prev/next + `Select` for page size |
| Export CSV | `Button variant="ghost"` + `Download` icon |
| Keyboard hints panel | `Sheet` (right-side drawer) triggered by `?` key or button |
| Empty-state CTAs | `Button variant="default"` + `Button variant="outline"` |
| Loading skeleton | Custom skeleton rows using `--lc-surface-sunken` blocks |
| Error banner | Custom `<div>` with `AlertTriangle` icon, `--lc-status-danger-bg` background |
| Toast (approve/reject success) | `Sonner` toast — includes Undo action linked to a 5-second grace window |
| Tooltip on relative time | `Tooltip` |
| Numeric renders | `<Numeric>` primitive |
| Icons | `lucide-react` — `Search`, `Download`, `Check`, `X`, `Eye`, `AlertTriangle`, `HelpCircle`, `ChevronDown`, `ChevronLeft`, `ChevronRight` |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:

- **Header:** "Applications" title, subtitle "12 pending · 8 approved · 2 rejected this week"
- **Filter strip:** `Pending` tab active (counter 12), Approved (8), Rejected (2), Expired (0); `Applied within` set to "Last 30 days"; search input empty
- **Table with 8 sample rows (all Pending):**
  1. Avatar (initials "SM") · **Sara Al Mansouri** · Dubai · 5 years exp · Applied 2h ago · Listings 14 · Message "Hi, I've been agent-of-record at Elite for 3 years and looking for a stronger MENA-wide platform. My portfolio focuses on…" · Pending badge
  2. Avatar "AK" · **Ahmed Khan** · Abu Dhabi · 2 years exp · Applied 5h ago · Listings 6 · Message "Interested in joining. I currently work with Bayut portal only and would like broader reach through your…" · Pending badge
  3. Avatar "LG" · **Layla Georges** · Beirut · 8 years exp · Applied 1d ago · Listings 27 · Message "Requesting to move my portfolio from Blue Door to your agency. I have documented mandates for 24 of my current…" · Pending badge
  4. Avatar "MR" · **Mohammed Al Rashid** · Riyadh · 3 years exp · Applied 1d ago · Listings 9 · Message "I saw your public profile. I focus on off-plan projects in Riyadh and would like to collaborate on…" · Pending badge
  5. Avatar "NA" · **Noura Al Amri** · Sharjah · 1 year exp · Applied 2d ago · Listings 2 · Message "Junior agent looking for an agency that offers training. I have my license and…" · Pending badge
  6. Avatar "YT" · **Youssef Tarek** · Cairo · 6 years exp · Applied 2d ago · Listings 18 · Message "I have an established client base in New Cairo and would like to expand into the MENA-wide portals through your…" · Pending badge
  7. Avatar "FS" · **Fatima Suleiman** · Muscat · 4 years exp · Applied 3d ago · Listings 11 · Message "Applying to join. Currently agent-of-record at a small local agency, looking for better tooling…" · Pending badge
  8. Avatar "OZ" · **Omar Zayed** · Amman · 7 years exp · Applied 3d ago · Listings 22 · Message "I received an invite from your admin last week but wanted to submit a fresh application. My focus…" · Pending badge
- **Row 3 (Layla Georges) in hover state:** row background `--lc-surface-sunken`, row-action buttons `Approve` / `Reject` / `View` visible on the right.
- **Pagination footer:** "1–8 of 12" · prev disabled · next enabled · Rows per page 25.
- **Two side variants to screenshot as separate v0 iterations:**
  - **Bulk selection active:** rows 1, 3, 5 checked. Bulk-action bar visible: "3 selected · Clear selection" left, "Approve 3" + "Reject 3" right.
  - **Empty state:** Pending tab with 0 rows. Empty-state block centered in the table area with illustration placeholder + copy + CTAs.

Do NOT fabricate transaction figures, agency logos, or testimonials on this screen. The applicant name + city + listings count + message text are the honest signals — no invented KPIs.

---

## Interactions

**On page load:**
- Fetch `GET /api/agencies/:id/applications?status=pending&within=30d&page=1&pageSize=25` (defaults).
- Show 8-row skeleton while loading.
- On success: render table. On error: show error banner with Retry.

**On status tab change:**
- Update `?status=<x>` in URL (`history.pushState`, no reload).
- Refetch with new status filter.
- Reset page to 1. Clear any row selection.
- Table re-renders with `--lc-duration-fast` fade transition.

**On applied-within change:**
- Update `?within=<x>` in URL.
- Refetch. Reset page to 1. Preserve row selection ONLY if all selected IDs are still in the new result set; otherwise clear selection with a toast "Selection cleared — filter changed".

**On search input:**
- Debounce 200ms.
- Update `?q=<value>` in URL.
- Refetch. Reset page to 1. Clear selection.

**On row hover:**
- Row background swaps to `--lc-surface-sunken` at `--lc-duration-fast`.
- Row action buttons (Approve / Reject / View) fade in at the right edge.
- Cursor becomes `pointer`.

**On row click (anywhere except checkbox or row action buttons):**
- Navigate to `AGN-MEM-002b` at `/agency/members/applications/:applicationId`.
- The status tab + filter state should be preserved in the URL so back-nav returns to the same view.

**On row-select checkbox click:**
- Toggle that row's selection (no navigation).
- Update the bulk-action bar row count.
- `Shift+Click` on a second checkbox selects the range between the last-clicked row and this one.

**On "Select all" header checkbox:**
- Selects all rows on the current page. If some rows are already selected on other pages, offer a toast "N rows selected across all pages · [Clear]".

**On inline Approve (Pending row, hover state):**
- If agency has security-enabled elevation policy: prompt for step-up via SHR-MFA-007. On success, proceed. On failure, cancel silently with a toast "Elevation required".
- Otherwise: fire `POST /api/agencies/:id/applications/:appId/approve` with `{ role: 'agent' }` (default role).
- Optimistic UI: row status badge swaps to Approved instantly at `--lc-duration-base`, row-action buttons swap to just `View`.
- Show toast "Approved {name}." with `Undo` link (5-second grace).
- On 5-second grace expiry: server-side commit. On Undo click: fire `POST /api/agencies/:id/applications/:appId/undo-approve` (VERIFY endpoint — if absent, use `POST .../reject` with reason "Undone within grace period" and update the copy).

**On inline Reject (Pending row, hover state):**
- Opens the single-row Reject modal (same shape as bulk reject, but N=1 and copy adjusts).
- Requires reason. Confirm fires `POST /api/agencies/:id/applications/:appId/reject` with `{ reason }`.
- Same optimistic + toast + Undo pattern as approve.

**On Bulk Approve:**
- Opens `AlertDialog` — "Approve {N} applications?" with body copy per §Explicit copy.
- Confirm: if step-up required, prompt SHR-MFA-007 first. On success, fire `POST /api/agencies/:id/applications/bulk-approve` with `{ applicationIds: [...], role: 'agent' }`.
- On success: rows update in-place with new Approved status. Toast "Approved {N} applications." with Undo (5s grace, undoes ALL N atomically if server supports it — see [BE-VERIFY]).
- On partial failure (some approved, some failed): toast destructive "Approved {n}, failed {k} — see detail." — offer link to a small drawer showing the failed rows with error reasons.

**On Bulk Reject:**
- Opens `Dialog` with reason `<Textarea>` — REQUIRED (Confirm disabled until reason has ≥5 chars).
- Confirm: step-up if required, then fire `POST /api/agencies/:id/applications/bulk-reject` with `{ applicationIds: [...], reason }`.
- Same optimistic + toast + Undo pattern.

**On keyboard shortcut:**
- `J` — move focus to next row (visible focus ring).
- `K` — move focus to previous row.
- `A` — trigger inline Approve on focused row.
- `R` — trigger inline Reject on focused row.
- `Enter` — navigate to detail screen for focused row.
- `X` — toggle row-select on focused row.
- `Shift+A` — select all visible rows.
- `?` — open keyboard-hints sheet.
- `Esc` — close any open modal / drawer / dismiss selection.

**On Export CSV:**
- Fires `GET /api/agencies/:id/applications.csv?<same query>`. Browser download triggers.
- Include all rows matching the current filter (not just current page). Backend implements pagination-less CSV variant.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial loading** | Page mount | Skeleton table (8 shimmer rows). Filter strip disabled. |
| **Ready — pending default** | Load complete, ≥1 pending | Table renders. Pending tab active. Row 1 focused for keyboard nav. |
| **Ready — approved / rejected / expired** | Status tab change | Same table shell; row-action buttons swap `Approve/Reject` for `View` only. Bulk-action bar hides Reject button (already rejected) and hides Approve button (already approved). Only "Export CSV" and "View" are meaningful. |
| **Ready — empty pending** | 0 rows | Empty-state block (see §Layout — Empty state Pending). |
| **Ready — empty other tab** | 0 rows | Simpler empty state. |
| **Search-no-results** | Search returns 0 | "No applicants match '{q}'" + Clear search link. |
| **Row selected (single)** | Checkbox click | Bulk-action bar slides in with "1 selected". |
| **Row selected (multiple)** | ≥2 checkboxes | Bar shows count. Bulk buttons enabled. |
| **All-page selected + more available** | Select-all + total > pageSize | Toast prompts "Select all N rows across all pages" — one click extends selection scope. |
| **Approve in progress (row)** | Approve clicked | Row status badge shows spinner-glyph; row disabled for further clicks. |
| **Reject modal open** | Reject clicked | Modal traps focus; reason textarea autofocused. Confirm disabled until reason ≥5 chars. |
| **Approve success toast** | POST 200 | Toast "Approved {name}." + Undo link (5s). Row updates optimistically. |
| **Bulk approve success** | POST 200 | Toast "Approved {N} applications." Optimistic update; selection cleared. |
| **Bulk approve partial** | POST 207 or per-row error map | Destructive toast "Approved {n}, failed {k} — see detail" + link to failure drawer. |
| **Step-up required** | 401 `STEP_UP_REQUIRED` | SHR-MFA-007 modal opens inline; on success re-fires the pending action. On cancel, action aborts with silent toast. |
| **Backend error 500** | POST fails | Destructive toast "Something went wrong. Try again." Row reverts to Pending. |
| **Session expired** | 401 (not step-up) | Redirect to `SHR-AUT-001` login with return-to param. |
| **Insufficient permission** | 403 | Full-page block: "You need agency-management access to view this page." Link to home. Should not happen if the side-drawer link is correctly role-guarded. |
| **Loading — pagination** | Prev/next clicked | Table shows dim overlay + `--lc-duration-fast` while new page loads. Row focus preserved on the equivalent row index. |
| **Loading — filter change** | Any filter change | Same dim overlay pattern. |
| **RTL** | Locale = ar | Table columns mirror; row-action buttons move to the left edge. Applied-at "2h ago" strings run RTL; the numeral inside stays LTR via bidi isolation. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; status badge tints adjust automatically per token kit. |
| **Undo grace period** | After approve/reject toast shows | Row shows a subtle pulse-border at `--lc-accent-bold-edge` for 5 seconds; hover shows "Undo within {N}s". |
| **Undo triggered** | Undo link clicked within 5s | Row reverts to Pending status; toast dismisses; action reversed server-side. |

---

## Accessibility

- Page has a single `<h1>` "Applications". Filter strip labeled by `aria-label="Filter applications"`.
- Status tabs are `role="tablist"` + `role="tab"` — arrow keys navigate; Enter/Space activates.
- Table has `role="grid"` (since J/K keyboard nav + row focus + inline actions make it interactive). Each row `role="row"` + `tabindex="0"` when focused.
- Every column header labels its cell via `scope="col"`.
- Row-select checkboxes have visible labels tied via `aria-labelledby` to the applicant-name cell — screen reader announces "Select Sara Al Mansouri".
- Bulk-action bar has `role="status"` + `aria-live="polite"` — count changes announced ("3 selected", "4 selected").
- Modals trap focus + Esc to close + click-outside dismisses (with a "cancel" confirmation if reason was typed and would be lost).
- Toasts have `role="status"` + `aria-live="polite"`; destructive toasts `aria-live="assertive"`.
- Keyboard shortcut hints panel (`?`) is a modal drawer with focus trap.
- Focus visible via the two-tone Broadcast focus ring on every interactive element (rows included).
- Every icon-only button (`?`, prev, next, export) has a real `aria-label`.
- Relative time ("2h ago") accompanied by full timestamp in `title` + accessible tooltip on hover / focus.
- Status pills are tint + glyph + label — screen reader reads the label, sighted user sees color + glyph.
- Row-height baseline 64px meets 44px tap-target with room to spare; row-action buttons are 44×44 targets.
- Never rely on hover-only affordances for critical actions — inline Approve / Reject are also reachable via `A` / `R` keyboard shortcuts and via the row-click detail screen.
- Skip-to-content link at top of page (jumps past filter strip into table).

---

## Anti-patterns (do not do these)

- Do NOT render inline Approve without keyboard equivalence — an admin with a trackpad injury or on a keyboard-only workflow must be able to approve without pointing.
- Do NOT allow bulk reject without a reason. Every rejection includes a message the applicant will see; anonymous rejection creates support tickets.
- Do NOT auto-approve on filter change or navigation. All state-changing actions are explicit clicks / keyboard triggers.
- Do NOT show fabricated agency-side reputation scores or "match %" on applicants. WingCaster does not have applicant scoring in v1; do not invent it.
- Do NOT use color-alone for status pills. Every pill has tint + glyph + label.
- Do NOT reduce row height below 56px to squeeze more rows on screen — that breaks the 44px tap-target floor when hover actions appear.
- Do NOT paint the row hover state with `--lc-action-primary` tint. Hover uses `--lc-surface-sunken`; primary orange is reserved for the action buttons themselves.
- Do NOT show approve / reject buttons for already-decided rows (approved / rejected / expired tabs). Only `View` is meaningful there.
- Do NOT reload the page on filter change. All filter/tab/search/pagination updates use URL query params + client-side refetch.
- Do NOT lose row selection silently when the user changes filters unless the selection would be nonsensical (rows no longer visible). If lost, toast to explain.
- Do NOT display raw application IDs (UUIDs) anywhere visible. Applicant name + applied-at is the human handle.
- Do NOT skip the two-tone focus ring on rows. Table rows are focusable and must show the ring.
- Do NOT ship the mobile viewport as anything other than the "desktop-only" info block for v1 — a badly-scaled table on mobile does more harm than a clear "not here" message.
- Do NOT put the bulk-action bar in a floating position that overlaps table rows. It docks between the filter strip and the table.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Linear "Triage" view** — J/K keyboard nav + inline row actions + swap-tab-not-page pattern.
- **Front conversation list** — dense triage row + hover reveals actions + bulk-select bar.
- **GitHub Pull-Requests list** — status tabs with counts, filter chip strip, hover-row actions.
- **Superhuman inbox** — keyboard-first triage with visible hints on `?`.
- **Stripe Radar / Reviews queue** — approve/reject decision surface with reason capture and audit-friendly optimistic UI.

Do NOT match:
- Salesforce case queue (over-dense, low-density-per-decision; too enterprise-noisy for WingCaster).
- Gmail Priority Inbox (over-personalized ML sorting is out of scope for v1).
- Trello / Kanban board views (kanban wrong tool for a moderator queue with clear terminal states).

---

## Backend contract

**List endpoint:** `GET /api/agencies/:agencyId/applications`

**Query params:**
- `status` — `pending` | `approved` | `rejected` | `expired` (default `pending`)
- `within` — `7d` | `30d` | `90d` | `all` (default `30d`)
- `q` — search string (applicant name, case-insensitive; trims to ≥2 chars server-side)
- `page` — integer, default 1
- `pageSize` — integer, default 25, max 100
- `sort` — `applied_at:desc` (default) | `applied_at:asc` | `applicant_name:asc` | `applicant_name:desc`

**Response 200:**
```json
{
  "applications": [
    {
      "id": "app_abc123",
      "applicant": {
        "id": "usr_xyz789",
        "display_name": "Sara Al Mansouri",
        "avatar_url": "https://…",
        "city": "Dubai",
        "years_experience": 5,
        "listings_count": 14
      },
      "applied_at": "2026-09-06T12:04:11Z",
      "message": "Hi, I've been agent-of-record at Elite for 3 years and looking for a stronger MENA-wide platform. My portfolio focuses on off-plan and secondary residential in Dubai Marina.",
      "status": "pending",
      "decision": null,
      "expires_at": "2026-10-06T12:04:11Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 73,
    "has_next": true
  },
  "counts": {
    "pending": 12,
    "approved_this_week": 8,
    "rejected_this_week": 2,
    "expired_this_week": 0
  }
}
```

**Single approve:** `POST /api/agencies/:agencyId/applications/:appId/approve`

Request body:
```json
{ "role": "agent" }
```

Response 200:
```json
{
  "application": { "id": "app_abc123", "status": "approved", "decision": { "decided_at": "…", "decided_by": "usr_…", "role_assigned": "agent" } },
  "membership": { "id": "mem_…", "agency_id": "…", "user_id": "…", "role": "agent" }
}
```

Response 401 `STEP_UP_REQUIRED` — client must trigger SHR-MFA-007 and retry with elevated session.

**Single reject:** `POST /api/agencies/:agencyId/applications/:appId/reject`

Request body:
```json
{ "reason": "We're not adding agents in your city right now." }
```

Response 200: application object with `status: "rejected"` + `decision.reason`.

**Bulk approve:** `POST /api/agencies/:agencyId/applications/bulk-approve`

Request body:
```json
{ "application_ids": ["app_a", "app_b", "app_c"], "role": "agent" }
```

Response 200 (all succeeded):
```json
{ "succeeded": ["app_a", "app_b", "app_c"], "failed": [] }
```

Response 207 (partial):
```json
{ "succeeded": ["app_a"], "failed": [{ "id": "app_b", "error": "ALREADY_MEMBER" }, { "id": "app_c", "error": "APPLICATION_EXPIRED" }] }
```

**Bulk reject:** `POST /api/agencies/:agencyId/applications/bulk-reject`

Request body:
```json
{ "application_ids": [...], "reason": "…" }
```

Same 200/207 shape as bulk-approve.

**CSV export:** `GET /api/agencies/:agencyId/applications.csv?<same-query-as-list>` — returns text/csv with headers `id,applicant_name,applicant_city,applied_at,listings_count,status,message,decided_at,decided_by,reason`. All rows matching filter, no pagination.

**[BE-VERIFY-03] Bulk endpoints existence.** The matrix flags `GET /api/agencies/:id/applications` as ✅ merged, but does NOT confirm bulk-approve / bulk-reject. Grep backend for `bulk-approve` and `bulk-reject` before Wave-1 Cursor dispatch. If absent: add ~1-2 days backend to §5a as `[BE-BLOCKER-06]` "Bulk application decision endpoints" and slot into Week 1.

**[BE-VERIFY-04] Undo grace-period support.** The Undo UX assumes either a server-side 5-second commit delay OR a `POST /undo-approve` and `POST /undo-reject` endpoint. Confirm which pattern the backend team prefers; if neither exists, either (a) drop the Undo affordance from v1 with a note or (b) add the endpoints (~1 day backend). Recommend (b) — Undo saves a lot of support tickets.

**[BE-VERIFY-05] Step-up policy per agency.** Backend must expose "does this agency require step-up for member-management writes" — either via agency settings row or a policy endpoint. If the flag is not yet exposed, default frontend behavior to "no step-up required" for approve, but ALWAYS require step-up for bulk reject with >5 rows. Document this fallback in the CURSOR prompt.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/agency/ApplicationsQueuePage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/agency/members/applications" element={<ApplicationsQueuePage />} />` behind the `AgencyRoleGuard` HOC (requires `agency-management` capability pack).
- **Sidebar entry:** update `SHR-NAV-002` side drawer to add "Applications" under Members with a badge counter tied to the pending count. Badge uses `<Numeric>` + `--lc-status-draft` styling. Live-updates via polling every 60s OR SSE if the agency has real-time enabled.
- **Component decomposition:**
  - `ApplicationsQueuePage.tsx` — page shell + data fetching + URL-state.
  - `ApplicationsFilterStrip.tsx` — tabs + within-picker + search + export.
  - `ApplicationsTable.tsx` — table shell + row rendering + keyboard nav.
  - `ApplicationRow.tsx` — one row (applicant cell, applied cell, listings, message, status pill, actions).
  - `ApplicationsBulkBar.tsx` — the conditional bulk-action bar.
  - `BulkApproveDialog.tsx` — the small confirmation modal.
  - `BulkRejectDialog.tsx` — the reason-required modal.
  - `ApplicationsEmptyState.tsx` — empty-state block variants.
  - `KeyboardShortcutsPanel.tsx` — the `?` drawer.
- **Data layer:**
  - Hook: `useApplicationsQuery({ status, within, q, page, pageSize, sort })` — wraps `fetch` with SWR / React Query pattern (match whatever's already in use for the AgencyManagement page).
  - Optimistic-update helpers for approve / reject / bulk.
  - Undo queue: 5-second timer keeping a mutation refundable; if page navigates before the timer expires, commit immediately.
- **Test discipline:**
  - Unit: each of the sub-components renders + keyboard nav + filter state.
  - Integration: full page load + filter + tab-swap + row-click + bulk-approve happy path + bulk-reject + step-up prompt + undo-within-grace.
  - RTL: `screens.rtl.test.tsx` extension with the queue in Arabic locale.
  - Broadcast: `no-raw-hex.test.ts` must stay green.
  - Real-Postgres: at least one path that creates a membership row via approve (assert agency_members table). Match the pattern in the existing agency-management tests.
  - Accessibility: axe-core scan of the page in loaded + bulk-selected + modal-open states.
- **Perf:**
  - Table virtualization not required for v1 (page-size max 100 is fine unvirtualized).
  - Skeleton must render within 100ms of route mount — no blocking auth checks; guard errors with the shared error boundary.
- **Copy/i18n:**
  - All strings in `web/src/locales/en/agencyApplications.json` + `ar/agencyApplications.json`. Use `[TRANSLATION-PENDING]` in AR for now.
  - Relative time via existing `formatRelativeTime` util; ensure it handles Arabic locale.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable. (Delta briefs like AGN-MEM-002b reference THIS section.)

- Page shell background `var(--lc-bg-page)`; card / table shell on `var(--lc-surface-raised)`; header row on `var(--lc-surface-sunken)`.
- Page title `var(--lc-type-heading-1)`; subtitle `var(--lc-type-body-sm)` `var(--lc-text-muted)`.
- Column headers `var(--lc-type-overline)` (11px + 0.08em tracking) `var(--lc-text-muted)`.
- Row body text `var(--lc-type-body)` for applicant name, `var(--lc-type-body-sm)` for secondary lines and message excerpt, `var(--lc-type-caption)` for city + experience.
- Every numeric — listings count, page-size, pagination indices, badge counters, relative-time "2h" — via `<Numeric>` (mono + tabular-nums).
- Status pills use `--lc-status-{draft,published,closed,archived}-{bg,fg,dot}` + required glyph (○ ● ◆ ▢) + label; never color-alone.
- Row hover `background: var(--lc-surface-sunken)` at `--lc-duration-fast`; row focus (via keyboard) shows the two-tone `--lc-focus-ring` + `--lc-focus-ring-contrast` ring — do NOT override.
- Row action buttons on hover: `<Button size="sm" variant="outline">`; Approve outline `--lc-action-primary`, Reject outline `--lc-border-strong`, View outline `--lc-border`.
- Bulk-action bar: `background: var(--lc-surface-sunken)`, `border-radius: var(--lc-radius-md)`, `border: 1px solid var(--lc-border)`. Primary buttons inside use `--lc-action-primary` fill for Approve, `--lc-action-secondary` for Reject.
- Reject modal reason textarea: `--lc-border-strong` border, `--lc-radius-md`, min 3 rows, monospace-off (regular UI font — reason is human copy).
- Empty-state illustration placeholder: `--lc-surface-sunken` fill, `border: 1px dashed var(--lc-border-strong)`, `var(--lc-radius-lg)`.
- Loading skeleton: `--lc-surface-sunken` blocks; shimmer opacity 0.6→1 at `--lc-duration-base` `--lc-easing-in-out infinite alternate`; disabled under `prefers-reduced-motion`.
- Undo pulse-border on affected row: `--lc-accent-bold-edge` at 2px, pulsing at `--lc-duration-slow` for 5s. Small enough to satisfy the "accent bold needs a boundary" rule.
- Motion: bulk-bar slide-in `--lc-duration-fast` `--lc-easing-out`; row hover `--lc-duration-fast`; status swap `--lc-duration-base` `--lc-easing-in-out`. NO signal-lamp motif (reserved).
- Radii: page card `var(--lc-radius-lg)`; filter chips + buttons `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`.
- Elevation: table shell `var(--lc-elevation-sm)`; modals `var(--lc-elevation-lg)`; bulk-action bar no elevation (flat, sunken).
- Focus rings: two-tone via base CSS — do not override on any element.
- Never use `--lc-action-primary` as a row-hover fill; that token is reserved for the action buttons and primary CTAs.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster agency Applications queue screen (AGN-MEM-002) — MENA real-estate B2B SaaS admin surface. Desktop 1440px only for v1. This is where an agency owner or admin reviews agents who applied to join their agency (WF-02 approver-side inbox). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass: render the desktop 1440px layout with the Pending tab active (counter 12), 8 sample rows all Pending, row 3 in hover state showing inline Approve/Reject/View buttons on the right, applied-within set to "Last 30 days", search input empty. Bulk-action bar hidden (no rows selected). Pagination footer showing "1–8 of 12".

LTR English only for this pass — I'll ask for RTL Arabic, dark mode, bulk-selection state, empty state, and modal states as separate follow-ups.

Follow the copy table in the brief exactly. Do NOT fabricate reputation scores, match %, or agency-side ratings on applicants. Applicant name + city + years experience + listings count + message excerpt are the ONLY signals.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now show the bulk-selection state — rows 1, 3, 5 checked. Bulk-action bar visible above the table with "3 selected · Clear selection" left, "Approve 3" and "Reject 3" buttons right.`
2. `Now the Bulk Reject dialog open over the bulk-selection state. Reason textarea visible, Confirm button disabled (empty reason).`
3. `Now the empty state — Pending tab with 0 rows. Show the illustration placeholder + title + body + primary CTA "View your public agency page" + secondary CTA "Invite an agent directly".`
4. `Now the Approved tab active, 6 sample rows in Approved status. Row-action buttons show only "View" (no Approve/Reject).`
5. `Now the keyboard-shortcuts drawer open on the right side, listing J/K/A/R/Enter/X/Shift+A/?/Esc.`
6. `Now the RTL Arabic layout at desktop 1440px. Use [TRANSLATION-PENDING] where copy has no Arabic yet, but MIRROR the whole layout including column order, action-button placement, and filter strip.`
7. `Now the dark mode version of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/AGN-MEM-002/` + screenshot to `docs/design/mockups/AGN-MEM-002-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 7 iteration states (ready-pending desktop, bulk-selection, bulk-reject-modal, empty state, approved tab, keyboard-drawer, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/AGN-MEM-002/`.
- [ ] Cursor Wave-1 dispatch prompt references this brief + the mockup paths + the paired AGN-MEM-002b brief.
- [ ] `[BE-VERIFY-03]` bulk endpoints existence check filed in kickoff §5a.
- [ ] `[BE-VERIFY-04]` undo grace-period support check filed in kickoff §5a.
- [ ] `[BE-VERIFY-05]` step-up policy per agency check filed in kickoff §5a.
- [ ] Delta brief `AGN-MEM-002b-application-detail-brief.md` referenced from Wave-1 dispatch prompt.
