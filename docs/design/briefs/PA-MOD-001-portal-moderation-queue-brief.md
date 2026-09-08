# Screen Brief — PA-MOD-001 · Portal moderation queue (WF-03 approver-side)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Anchor brief for the PA approval-queue family.** Companion to `SCREEN_MATRIX_PA.md` §23 entry `PA-MOD-001`. Establishes the reusable Platform-Admin queue pattern that later inherits into `PA-ACR-001` (recovery review queue), `PA-PVA-008` (property-value adjust queue), `PA-APR-002` (generic approval detail), and the workflow-specific detail screens branching off `PA-APR-001` (approvals queue).

Delta brief `PA-MOD-002-portal-moderation-detail-brief.md` covers the single-submission review surface and inherits the Broadcast alignment section from THIS file.

Wave 2 (Week 2 — WF-03 cluster) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 6 §5 rows 38-39 + §5a `[BE-BLOCKER-01]` `[BE-DESIGN-01]` `[BE-BLOCKER-02b]`.

The PA side of WF-03 pairs with agent-side `AGT-PUB-005` (submit for moderation) + `AGT-PUB-006` (portal tracker) + `AGT-REC-001` (outcome). Treat this file as the **PA-side analog of `AGN-MEM-002-applications-queue-brief.md`** — same triage-first density model, same keyboard-native ergonomics, same bulk-decision-with-reason discipline, same undo-grace pattern — adapted to the PA persona + LIVE/TEST environment context + per-portal validator lint results + tenure-risk scoring.

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts (this callout block is REFERENCED by PA-MOD-002 AND by every future PA queue brief that inherits the PA approval-queue family pattern — keep it complete here):**

- **PA admin shell context.** Page renders inside the PA console shell — `SHR-NAV-001` top bar (with PA-NAV-001 env badge always visible), no `SHR-NAV-002` side drawer for PA in v1 (PA uses top-nav routes). Page shell background `var(--lc-bg-page)`; content max-width 1440px with `padding-inline: var(--lc-space-2xl)`.
- **Environment badge (PA-NAV-001) is ALWAYS visible in the top bar** while this page is rendered. When PA is in TEST, the persistent full-width warning strip (`--lc-status-warning` fill + white ink, sticky under the top bar per PA-NAV-001 §Layout) offsets the queue's sticky sub-header down by `var(--lc-nav-warning-strip-height)` (24px). LIVE mode: no warning strip; badge alone.
- **Env-scoped data.** The queue fetches submissions scoped to the current env — LIVE-vs-TEST results NEVER co-mingle; `X-Wingcaster-Env` header per PA-NAV-001 binds every list + action call. A queue loaded in LIVE that switches to TEST mid-session refetches automatically (no stale rows visible for the wrong env).
- **Page title ("Portal moderation queue"):** `font: var(--lc-type-heading-1)` (600 26/32 IBM Plex Sans) — NOT display-tier; this is an admin workspace, not marketing.
- **Section subtitle / submission-count line:** `font: var(--lc-type-body-sm)`, `color: var(--lc-text-muted)`. Numeric run wrapped in `<Numeric>` — e.g. `<Numeric>18</Numeric> pending, <Numeric>7</Numeric> at-risk (breach in <Numeric>2h</Numeric>), <Numeric>42</Numeric> approved this week`.
- **Filter chip strip (Status · Portal · Country · Submitted within · Risk tier · Search):** `<Tabs>` for status (Pending default), `<Select>` for portal (fed live from `portal_registry` per `[BE-DESIGN-01]`), `<Select>` for country (fed from portal_registry `country_codes` intersection with active portals), `<Select>` for within, `<Select>` for risk tier, `<Input>` with `Search` lucide icon for agent/agency search. Chip strip sits on `var(--lc-surface-raised)` with `border-bottom: 1px solid var(--lc-border)`.
- **Bulk-action bar (appears when ≥1 row selected):** `background: var(--lc-surface-sunken)`, `border-radius: var(--lc-radius-md)`, `border: 1px solid var(--lc-border)`, `padding: var(--lc-space-sm) var(--lc-space-md)`. Slides in above the table with `--lc-duration-fast` height transition.
- **Table shell:** `<Table>` primitive. Header row `background: var(--lc-surface-sunken)`, header text `var(--lc-type-overline)` + `color: var(--lc-text-muted)`. Body rows on `var(--lc-surface-raised)` separated by `border-bottom: 1px solid var(--lc-border)`. Row hover `background: var(--lc-surface-sunken)` at `--lc-duration-fast`.
- **Agent + agency cell:** 32px circular avatar + agent display name (`var(--lc-type-body)`) + agency name secondary line in `var(--lc-type-caption)` `var(--lc-text-muted)`. Agency name links to `PA-TEN-001` tenant detail in a new tab (opens with `rel="noopener noreferrer"`).
- **Listing thumbnail + title cell:** 40×40 rounded thumb (`var(--lc-radius-md)`) + title (`var(--lc-type-body)`) + address line (`var(--lc-type-caption)` `var(--lc-text-muted)`). If no hero image on file: dashed `--lc-border-strong` placeholder with `Image` lucide icon inside.
- **Portal + country cell:** `<ChannelMark>` for the portal (using the `portal_registry` code → channel token map — Bayut, PF, Dubizzle, OLX, Aqar, Wasalt, Aqarmap all get channel tokens registered as portals ship; fall back to a neutral `--lc-surface-sunken` circle + first-letter monogram for portals without dedicated tokens yet) + country flag emoji + country ISO code (e.g. "🇦🇪 AE") in `var(--lc-type-caption)`.
- **Validator-lint cell:** stack of tiny status pills — one per lint category the per-portal validator produced (see [BE-BLOCKER-02b] + PORTAL_LIST_RESEARCH §C). Each pill is `<Badge>` sized `var(--lc-type-caption)`: pass `--lc-status-published-{bg,fg,dot}` + ● glyph; warn `--lc-status-warning-{bg,fg,dot}` + ⚠ glyph; fail `--lc-status-danger-{bg,fg,dot}` + ✕ glyph. Cell shows the aggregate — e.g. "3 pass · 1 warn · 2 fail" — with the individual lint list revealed in `<Tooltip>` on hover. Never color-alone.
- **Tenure-risk cell:** `<Badge>` per risk tier — low `--lc-status-published-{bg,fg,dot}` + ● + label "Low"; medium `--lc-status-warning-{bg,fg,dot}` + ▲ + "Medium"; high `--lc-status-danger-{bg,fg,dot}` + ◆ + "High". Tier derived from server-side signals (agency onboarding age, prior-rejection ratio, portal-fee-history — full derivation per `[BE-DESIGN-02]` risk-scoring service; see §Backend contract).
- **SLA aging cell:** submitted-at column shows relative time ("2h ago") in `var(--lc-type-body-sm)` + a small SLA-remaining chip below in `var(--lc-type-caption)` — green `--lc-status-published` when >8h remain, warning `--lc-status-warning` when 2-8h, danger `--lc-status-danger` when <2h or breached. SLA per-portal from `portal_registry.publisher_config.sla_hours`. Full timestamp in `<Tooltip>` on hover. Every numeric via `<Numeric>`.
- **Status pill:** `<Badge>` — pending_moderation `--lc-status-draft-{bg,fg,dot}` + ○ glyph, approved `--lc-status-published-{bg,fg,dot}` + ● glyph, rejected `--lc-status-closed-{bg,fg,dot}` + ◆ glyph, request-info `--lc-status-warning-{bg,fg,dot}` + ▲ glyph, portal-error `--lc-status-danger-{bg,fg,dot}` + ✕ glyph (backend returned a portal-side failure at publish time even after PA approval), expired `--lc-status-archived-{bg,fg,dot}` + ▢ glyph. Always tint + glyph + label.
- **Row action buttons (Approve / Reject / Open on hover):** `<Button size="sm" variant="outline">` — Approve outlines `--lc-action-primary`, Reject outlines `--lc-border-strong`, Open (detail) outlines `--lc-border`. Inline actions ONLY appear on row hover for Pending rows. Approved / rejected / expired rows show `Open` only.
- **Pagination footer:** `var(--lc-type-body-sm)`, `var(--lc-text-muted)`, page numerals in `<Numeric>`.
- **Empty state block:** centered stack, illustration placeholder (`--lc-surface-sunken` 200px square with dashed `--lc-border-strong`), title `var(--lc-type-heading-3)`, body `var(--lc-type-body)` `var(--lc-text-muted)`, secondary CTA linking to PA-POR-001 portal list to review portal-registry health.
- **Loading skeleton:** 8 shimmering rows using `--lc-surface-sunken` block with subtle animation at `--lc-duration-base ease-in-out infinite alternate`; respects `prefers-reduced-motion`.
- **Focus rings:** two-tone via base CSS — do NOT override. Table rows are focusable (`tabindex="0"`) so J/K keyboard navigation lands a visible focus ring.
- **Radii:** table container `var(--lc-radius-lg)`, filter chips `var(--lc-radius-md)`, buttons `var(--lc-radius-md)`, badges `var(--lc-radius-pill)`.
- **Motion:** bulk-action bar slide-in `--lc-duration-fast` `--lc-easing-out`; row hover `--lc-duration-fast`; status pill swap after inline approve/reject `--lc-duration-base` `--lc-easing-in-out`; env-switch refetch `--lc-duration-base` fade; NO signal-lamp motif (reserved for "listing went live").
- **Numeric fields — every count, listing ID, SLA hours, submission ID prefix, tenure days, pagination index, badge counter uses `<Numeric>` or `.lc-data`.** Enforced by `--lc-font-mono` + `tabular-nums`.
- **PA queue-family invariants (inherited by PA-ACR-001, PA-PVA-008, PA-APR-002 detail branches, etc.):**
  1. Env badge always visible; env-scoped data.
  2. Two-person rule: approvals of one's own submissions blocked server-side + hidden UI-side.
  3. Bulk action requires shared reason for reject; bulk approve requires count-confirm modal.
  4. Step-up (SHR-MFA-007) required for high-risk decisions per policy — always required for bulk reject with >5 rows OR any decision on a High-risk-tier row.
  5. Every action writes to immutable audit (PA-AUD-001).
  6. Undo grace window (5s) on single-row decisions; NOT available for bulk (bulk decisions commit immediately).
  7. Keyboard-first (J/K/A/R/Enter/X/Shift+A/?/Esc).

---

## Meta

| | |
|---|---|
| Screen ID | PA-MOD-001 |
| Screen name | Portal moderation queue |
| Persona | PA (Platform Admin — any admin, but cannot approve submissions from tenants they own personally or where they are the agent-of-record; server-enforced) |
| Device targets | Desktop 1440px ONLY — PA console is desktop-first per matrix (no tablet/mobile fallback for v1; render "PA console requires a larger screen" info block on <1024px) |
| Locale | English + Arabic (RTL) — both mandatory. PA console defaults to English for global admins; Arabic supported for MENA-based admins. |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/moderation/portals` (query params: `?status=pending\|approved\|rejected\|request_info\|portal_error\|expired`, `?portal=<code>`, `?country=<iso>`, `?risk=low\|medium\|high`, `?within=24h\|7d\|30d\|all`, `?q=<agent-or-agency>`, `?page=<n>`) |
| Current state | MISSING. Backend routes `GET /api/admin/moderation/portals`, `GET /:submissionId`, `POST /:submissionId/approve`, `POST /:submissionId/reject` do NOT yet exist per audit (matrix PA-MOD-001 note references `GET /api/admin/submissions` but grep against backend confirms absence). Flagged as `[BE-BLOCKER-02b]` in kickoff §5a — new backend surface required. |
| Workflow role | WF-03 role = Approval queue (portal moderation) |
| Backend prerequisites | ⏳ `[BE-BLOCKER-02b]` `/api/admin/moderation/portals` route family (queue + item + approve + reject + bulk + CSV) — see §Backend contract · ⏳ `[BE-BLOCKER-01]` portal publishers (post-approval push) · ⏳ `[BE-DESIGN-01]` `portal_registry` table (feeds portal + country filters) · ⏳ `[BE-DESIGN-02]` tenure-risk scoring service · ⏳ per-portal validator module (see §Backend contract + PORTAL_LIST_RESEARCH §C) · ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context |
| Cluster | Wave 2 (WF-03 cluster) alongside PA-MOD-002 (detail), AGT-PUB-005 (submit), AGT-PUB-006 (tracker), AGT-REC-001 (outcome) |

---

## Purpose

Platform Admin reviews the queue of listing submissions that agents have pushed to external real-estate portals (Property Finder, Bayut, Dubizzle, OLX, Aqar, Wasalt, Aqarmap, 3akarat, and additional portals added dynamically via `portal_registry` per `[BE-DESIGN-01]`) and takes an approve / reject / request-info decision before WingCaster's portal publisher actually pushes the payload to the target portal.

The queue is where the platform operationalizes WF-03 (Portal moderation). Submissions originate from:

- `AGT-PUB-005` agent submit-to-portal action — agent picked one or more portals from their subscribed catalog and pressed Submit.
- Agent-side auto-republish schedulers (per PORTAL_LIST_RESEARCH §G metering definition — republish events fire fresh submissions through PA moderation IF the portal_registry.publisher_config.remoderate_on_republish flag is true; otherwise republish skips PA and pushes directly).

The queue serves three PA tasks at three cadences:

1. **Continuous triage** — pending submissions must clear within the per-portal SLA (Bayut 4h, PF 6h, Dubizzle 8h, others per portal_registry). Aging + SLA chips make the SLA-at-risk rows scannable.
2. **Weekly hygiene** — approved / rejected / portal-error views for audit + to spot patterns (a spike in Bayut trakheesi-number-missing rejects means the agent AGT-PUB-005 form is under-hinting the field; a spike in Wasalt AI-verification-failed rejects means a portal-side change).
3. **Bulk cleanup** — during a launch or after a stalled backlog, PA selects many rows and applies one decision with a shared reason (bulk approve for a low-risk agency batch; bulk reject with reason for a portal-outage rejection wave).

Success outcome: PA moves a submission from `pending_moderation` to `approved` (portal publisher pushes payload → submission becomes `posted_to_portal` on webhook confirmation → agent sees success on AGT-PUB-006 tracker + AGT-REC-001 outcome), `rejected` with reason (agent sees rejection with actionable message on AGT-REC-001 outcome), or `request_info` (agent sees a fixable-issues list on AGT-PUB-006 with the same reason vocabulary). Zero pending submissions past SLA. Portal-error rows resolved by re-submission or wontfix.

---

## Design goals

1. **Triage-first density.** PA scans dozens of rows in seconds. Every column earns its place; secondary metadata (validator lint detail, tenure derivation) hides in tooltip or the detail screen. Row height minimal but tap-target safe (≥64px row height accommodating avatar + agency line + thumbnail).
2. **Pre-filtered by validator lint.** Per-portal validator runs BEFORE the row appears — if a submission fails a hard requirement (e.g. missing trakheesi_number for Bayut UAE), PA sees the fail count immediately + the row is auto-sorted upward. PA can filter to "at least one fail" to attack the fixable-by-return-to-agent bucket.
3. **Tenure-risk visible, not decisive.** Risk tier is a signal, not a verdict. PA still reads the listing + validator lint before deciding. Show risk badge; do NOT auto-approve low-risk or auto-reject high-risk. The two-person rule + step-up applies to high-risk decisions.
4. **Keyboard-native.** PA operators live in queues all day. J/K row nav, A approve, R reject, I request info, E open detail, X select row, Shift+A select all visible, ? shortcut sheet, Esc clear selection.
5. **Bulk actions are safe by construction.** Bulk reject REQUIRES shared reason (from controlled vocabulary + free-text notes). Bulk approve REQUIRES count-confirm modal. Bulk on any high-risk-tier row REQUIRES step-up.
6. **Env-context is unambiguous.** Env badge always visible; TEST persistent warning strip runs across the queue. Rows tagged with tenant-env; LIVE-vs-TEST data never co-mingle.
7. **No color-only status differentiation** — pending / approved / rejected / request_info / portal_error / expired all use tint + glyph + label per Broadcast rule.
8. **Family-pattern anchor.** This queue's shape (env badge → title → sub-count → filter strip → bulk bar → keyboard-native table → pagination) is the reusable Platform-Admin queue skeleton. Downstream briefs (`PA-ACR-001`, `PA-PVA-008`, `PA-APR-001/002` detail branches) inherit this Broadcast callout block + the invariant list unchanged; only cell composition + backend routes differ.

---

## Layout

### Desktop 1440px (primary and only target for v1)

Single-column stack inside the PA console shell (SHR-NAV-001 top bar with PA-NAV-001 env badge; PA console has no side drawer in v1):

**PA-NAV-001 persistent warning strip (conditional — appears when env=TEST):**
- Full-width, sticky under top bar, 24px tall, `--lc-status-warning` fill + white ink, copy "TEST ENVIRONMENT — actions here do not publish to real portals."
- LIVE mode: no strip; content starts directly under top bar.

**Header block (sticky under top bar + optional TEST strip):**
- Left: page title "Portal moderation queue" (`var(--lc-type-heading-1)`) + subtitle "<Numeric>N</Numeric> pending · <Numeric>K</Numeric> at-risk (breach in <Numeric>2h</Numeric>) · <Numeric>M</Numeric> approved · <Numeric>J</Numeric> rejected this week" (`var(--lc-type-body-sm)` `var(--lc-text-muted)`).
- Right: three utility buttons — `Refresh` (`<Button variant="ghost" size="icon">` with `RefreshCw` icon), `Export CSV` (`<Button variant="ghost">`), `?` keyboard-hints toggle.

**Filter strip (sticky):**
- Row 1: status tabs — `Pending` (default active) / `Approved` / `Rejected` / `Request info` / `Portal error` / `Expired`. Each tab shows a counter — `Pending <Numeric>18</Numeric>`.
- Row 2: five inline filter selects + search — `Portal` (Select fed live from `portal_registry.code`), `Country` (Select fed from union of `portal_registry.country_codes` across active portals), `Risk tier` (Select — Low / Medium / High / Any), `Submitted within` (Select — 24h / 7d default / 30d / All time), search `<Input>` with `Search` icon prefix — placeholder "Search agent, agency, or listing ID…", debounced 200ms.

**Bulk-action bar (conditional — appears when ≥1 row selected):**
- Slides in with `--lc-duration-fast` height transition, sits between the filter strip and the table.
- Left: `<Numeric>N</Numeric> selected · Clear selection` (Clear is a link-styled button).
- Center: aggregate summary — "<Numeric>N</Numeric> across <Numeric>P</Numeric> portals · <Numeric>H</Numeric> High-risk". If H > 0, an amber inline note "Step-up required for high-risk decisions." appears.
- Right: `Approve N`, `Reject N`, `Request info N` primary buttons. Approve opens a count-confirm modal; Reject opens a reason-required modal; Request info opens a reason-required modal (agent-visible fix hints).

**Table:**
- Columns (desktop, left-to-right in LTR; mirror in RTL):
  1. Row-select checkbox (32px)
  2. Submitted — relative time + SLA chip below (default sort: SLA-at-risk first, then oldest)
  3. Agent + agency (avatar + agent name + agency secondary line, agency links to PA-TEN-001 in new tab)
  4. Listing (thumb + title + address secondary line)
  5. Portal + country (channel mark + flag emoji + ISO)
  6. Validator lint (aggregate "P pass · W warn · F fail" pill row, tooltip lists each check)
  7. Tenure risk (Low / Medium / High badge)
  8. Status (`<Badge>` pill)
  9. Row actions (visible on hover for Pending rows) — Approve / Reject / Request info / Open
- Row height ~72px (avatar + agency line + thumbnail row comfortably vertical).
- Row click (anywhere except checkbox or row-action buttons) → navigate to `PA-MOD-002` at `/admin/moderation/portals/:submissionId`, preserving current query params in a `return_to` param for back-navigation.
- Row focus state via keyboard (J/K cycles through rows).
- Sticky column header while table scrolls.

**Pagination footer:**
- Right-aligned: `<Numeric>1–25</Numeric> of <Numeric>84</Numeric>` + prev / next buttons + `<Select>` page-size (25 default, 50, 100).

### Empty state (Pending tab, 0 rows)

Centered stack in the table area:
- Illustration placeholder (200px square, `--lc-surface-sunken`, dashed `--lc-border-strong`) — label "Illustration — empty queue".
- Title (`var(--lc-type-heading-3)`): "No submissions awaiting moderation"
- Body (`var(--lc-type-body)` `var(--lc-text-muted)`): "When agents submit listings to portals, they land here for your review. Check portal-registry health if you expected submissions."
- Secondary CTA (`<Button variant="outline">`): "Review portal registry →" — deep-links to `/admin/portals` (PA-POR-001).

### Empty state (Approved / Rejected / other tabs, 0 rows)

Simpler: title "No {status} submissions in this range" + `var(--lc-text-muted)` body "Try widening the 'Submitted within' filter."

### Below-min-viewport fallback (<1024px)

Full-page info block: "PA console requires a desktop screen (1024px or wider)." + link back to `SHR-NAV-001` home. Do NOT attempt a mobile-optimized queue.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Page title | Portal moderation queue |
| Subtitle template | {N} pending · {K} at-risk (breach in {T}) · {M} approved · {J} rejected this week |
| TEST-env warning strip | TEST ENVIRONMENT — actions here do not publish to real portals. |
| Status tab — pending | Pending |
| Status tab — approved | Approved |
| Status tab — rejected | Rejected |
| Status tab — request-info | Request info |
| Status tab — portal-error | Portal error |
| Status tab — expired | Expired |
| Filter — portal label | Portal |
| Filter — portal any option | Any portal |
| Filter — country label | Country |
| Filter — country any option | Any country |
| Filter — risk label | Risk tier |
| Filter — risk options | Any · Low · Medium · High |
| Filter — within label | Submitted within |
| Filter — within options | Last 24 hours · Last 7 days · Last 30 days · All time |
| Search placeholder | Search agent, agency, or listing ID… |
| Refresh button aria-label | Refresh queue |
| Export CSV | Export CSV |
| Keyboard hints button aria-label | Show keyboard shortcuts |
| Keyboard hints panel title | Keyboard shortcuts |
| Shortcut — navigate down | `J` — next submission |
| Shortcut — navigate up | `K` — previous submission |
| Shortcut — approve | `A` — approve focused submission |
| Shortcut — reject | `R` — reject focused submission |
| Shortcut — request info | `I` — request info on focused submission |
| Shortcut — open detail | `Enter` — open submission detail |
| Shortcut — select | `X` — toggle row selection |
| Shortcut — select-all | `Shift + A` — select all visible rows |
| Shortcut — refresh | `.` — refresh queue |
| Shortcut — close | `Esc` — close modal / clear selection |
| Column — submitted | Submitted |
| Column — agent | Agent · Agency |
| Column — listing | Listing |
| Column — portal | Portal · Country |
| Column — lint | Validator lint |
| Column — risk | Tenure risk |
| Column — status | Status |
| Row action — approve | Approve |
| Row action — reject | Reject |
| Row action — request-info | Request info |
| Row action — open | Open |
| Lint aggregate template | {P} pass · {W} warn · {F} fail |
| Lint tooltip title | Per-portal validator results |
| SLA remaining green | {H}h left |
| SLA remaining amber | {H}h left · at risk |
| SLA remaining red | Breached by {H}h |
| Bulk-bar N selected | {N} selected |
| Bulk-bar summary template | {N} across {P} portals · {H} High-risk |
| Bulk-bar step-up notice | Step-up required for high-risk decisions. |
| Bulk-bar clear | Clear selection |
| Bulk-bar approve | Approve {N} |
| Bulk-bar reject | Reject {N} |
| Bulk-bar request-info | Request info {N} |
| Bulk approve modal title | Approve {N} portal submissions? |
| Bulk approve modal body | Each listing will be pushed to its target portal immediately after your approval. |
| Bulk approve modal confirm | Approve all {N} |
| Bulk approve modal cancel | Cancel |
| Bulk reject modal title | Reject {N} portal submissions |
| Bulk reject modal reason label | Reason (shown to each agent) |
| Bulk reject modal reason vocab | Portal outage · Fails portal validation · Duplicate listing · Suspected fraud · Insufficient photos · Compliance conflict · Other |
| Bulk reject modal notes label | Notes for the agents (optional) |
| Bulk reject modal reason placeholder | Add context — this message is sent to every rejected agent. |
| Bulk reject modal reason helper | Required. Kind and clear beats terse. Agents see this in their outcome inbox. |
| Bulk reject modal confirm | Reject all {N} |
| Bulk reject modal cancel | Cancel |
| Bulk request-info modal title | Request info on {N} submissions |
| Bulk request-info modal reason vocab | Missing trakheesi number · Photo count below minimum · Description too short · Category mapping unclear · Broker license expired · Other |
| Empty pending — title | No submissions awaiting moderation |
| Empty pending — body | When agents submit listings to portals, they land here for your review. Check portal-registry health if you expected submissions. |
| Empty pending — CTA | Review portal registry → |
| Empty other-tab — title | No {status} submissions in this range |
| Empty other-tab — body | Try widening the 'Submitted within' filter. |
| Loading | Loading submissions… |
| Env-switch loading | Switching to {env}. Reloading queue… |
| Error banner | Couldn't load submissions. Try again. |
| Retry button | Retry |
| Pagination template | {start}–{end} of {total} |
| Page-size label | Rows per page |
| Approved toast (single) | Approved {listingTitle} for {portal}. |
| Rejected toast (single) | Rejected {listingTitle} — {reason}. |
| Request-info toast (single) | Requested info on {listingTitle}. |
| Approved toast (bulk) | Approved {N} submissions. |
| Rejected toast (bulk) | Rejected {N} submissions. |
| Undo toast link | Undo |
| Own-submission block | You can't act on this row — you are the agent-of-record for this listing. |
| Step-up prompt template | Confirm your identity to {action} this {tier}-risk submission. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Page title | plain `<h1>` with `--lc-type-heading-1` |
| Env badge | Embedded `PA-NAV-001` component (top bar) |
| TEST warning strip | `PA-NAV-001` persistent-strip subcomponent |
| Status tabs | `Tabs` + `TabsList` + `TabsTrigger` |
| Portal / Country / Risk / Within pickers | `Select` + `SelectItem` (Portal + Country data fed by `useQuery(portalRegistry)`) |
| Search input | `Input` with `Search` icon (lucide) as prefix |
| Table | `Table` + `TableHeader` + `TableRow` + `TableCell` |
| Row-select checkbox | `Checkbox` |
| Avatar | `Avatar` + `AvatarImage` + `AvatarFallback` |
| Listing thumbnail | `<img>` in a fixed 40×40 wrapper with `object-fit: cover` + fallback `Image` icon block |
| Portal chip | `<ChannelMark>` primitive (channel-token per portal code) |
| Country flag | Emoji + ISO code text |
| Validator-lint pill row | Stack of `<Badge>` — pass/warn/fail variants |
| Validator-lint tooltip | `Tooltip` listing per-check results |
| Tenure risk badge | `<Badge>` — 3 variants |
| Status pill | `<Badge>` variant per status with glyph prefix |
| SLA remaining chip | Custom small `<Badge>` — 3 variants |
| Row action buttons | `Button size="sm" variant="outline"` |
| Bulk action bar | Custom `<div>` styled with Broadcast tokens |
| Bulk approve modal | `AlertDialog` |
| Bulk reject / request-info modal | `Dialog` (Textarea for reason + `Select` for controlled vocabulary) |
| Reason vocabulary | `Select` + `SelectItem` |
| Notes | `Textarea` |
| Pagination controls | `Button variant="ghost" size="icon"` for prev/next + `Select` for page size |
| Export CSV | `Button variant="ghost"` + `Download` icon |
| Refresh | `Button variant="ghost" size="icon"` + `RefreshCw` icon |
| Keyboard hints panel | `Sheet` (right-side drawer) triggered by `?` key or button |
| Empty-state CTAs | `Button variant="outline"` |
| Loading skeleton | Custom skeleton rows using `--lc-surface-sunken` blocks |
| Error banner | Custom `<div>` with `AlertTriangle` icon, `--lc-status-danger-bg` background |
| Toast (approve/reject success) | `Sonner` toast — includes Undo action linked to a 5-second grace window (single-row only; bulk commits immediately) |
| Tooltip on relative time | `Tooltip` |
| Numeric renders | `<Numeric>` primitive |
| Step-up | Embedded `SHR-MFA-007` modal per PA-APR-003 pattern |
| Icons | `lucide-react` — `Search`, `Download`, `RefreshCw`, `Check`, `X`, `MessageCircle`, `Eye`, `AlertTriangle`, `HelpCircle`, `ChevronDown`, `ChevronLeft`, `ChevronRight`, `ExternalLink`, `Image` |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:

- **Env:** LIVE (green badge, no warning strip).
- **Header:** "Portal moderation queue" title, subtitle "18 pending · 3 at-risk (breach in 2h) · 42 approved · 6 rejected this week".
- **Filter strip:** `Pending` tab active (counter 18), Approved (42), Rejected (6), Request info (2), Portal error (1), Expired (0); Portal `Any portal`; Country `Any country`; Risk `Any`; Within "Last 7 days"; search empty.
- **Table with 8 sample rows (all Pending):**
  1. Submitted "12m ago · 3h 48m left" · Agent avatar "SM" **Sara Al Mansouri** / *Elite Real Estate Dubai* · Listing thumb + **"3BR apartment · Dubai Marina"** *Marina Gate 2, Tower A, Apt 1204* · Portal 🇦🇪 Property Finder AE · Lint "6 pass · 0 warn · 0 fail" · Risk Low · Pending
  2. Submitted "1h ago · 2h 58m left" · Agent "AK" **Ahmed Khan** / *Abu Dhabi Prime* · Listing thumb + **"Villa · Saadiyat Island"** *Saadiyat Beach Villas, V-217* · Portal 🇦🇪 Bayut UAE · Lint "5 pass · 1 warn · 0 fail" · Risk Low · Pending
  3. Submitted "2h ago · 1h 47m left · at risk" (amber) · Agent "LG" **Layla Georges** / *Beirut Homes* · Listing thumb + **"2BR apartment · Ashrafieh"** *Sursock St, Bldg 24* · Portal 🇱🇧 Property Finder LB · Lint "4 pass · 2 warn · 1 fail" · Risk Medium · Pending
  4. Submitted "3h ago · 47m left · at risk" (amber) · Agent "MR" **Mohammed Al Rashid** / *Riyadh Off-Plan Partners* · Listing thumb + **"Off-plan tower · North Riyadh"** *NORA District, Plot 12* · Portal 🇸🇦 Bayut KSA · Lint "3 pass · 2 warn · 2 fail" · Risk High · Pending
  5. Submitted "5h ago · Breached by 1h" (red) · Agent "NA" **Noura Al Amri** / *Sharjah Coastal Realty* · Listing thumb + **"Studio · Al Majaz"** *Al Majaz 3, Tower 5* · Portal 🇦🇪 Dubizzle UAE · Lint "6 pass · 0 warn · 0 fail" · Risk Low · Pending
  6. Submitted "6h ago · Breached by 2h" (red) · Agent "YT" **Youssef Tarek** / *New Cairo Properties* · Listing thumb + **"Duplex · New Cairo"** *5th Settlement, Block 45* · Portal 🇪🇬 Aqarmap EG · Lint "5 pass · 1 warn · 0 fail" · Risk Medium · Pending
  7. Submitted "8h ago · Breached by 4h" (red) · Agent "FS" **Fatima Suleiman** / *Muscat Waterfront* · Listing thumb + **"Townhouse · Muscat Hills"** *Muscat Hills Golf, TH-14* · Portal 🇴🇲 Property Finder OM · Lint "6 pass · 0 warn · 0 fail" · Risk Low · Pending
  8. Submitted "12h ago · Breached by 6h" (red) · Agent "OZ" **Omar Zayed** / *Amman Skyline* · Listing thumb + **"Penthouse · Abdoun"** *Abdoun Circle, Tower North* · Portal 🇯🇴 Property Finder JO · Lint "4 pass · 2 warn · 1 fail" · Risk Medium · Pending
- **Row 3 (Layla Georges) in hover state:** row background `--lc-surface-sunken`, row-action buttons `Approve` / `Reject` / `Request info` / `Open` visible on the right.
- **Pagination footer:** "1–8 of 18" · prev disabled · next enabled · Rows per page 25.
- **Two side variants to screenshot as separate v0 iterations:**
  - **Bulk selection active:** rows 1, 2, 5 checked. Bulk-action bar visible: "3 selected · 3 across 3 portals · 0 High-risk · Clear selection" left; "Approve 3" + "Reject 3" + "Request info 3" right.
  - **Empty state:** Pending tab with 0 rows. Empty-state block centered with illustration placeholder + copy + CTA.

Do NOT fabricate portal-side approval metrics, agent scores, or agency reputation numbers not returned by the backend contract. Every field above corresponds to a real payload attribute from §Backend contract.

---

## Interactions

**On page load:**
- Fetch `GET /api/admin/moderation/portals?status=pending&within=7d&page=1&pageSize=25` scoped to current env (X-Wingcaster-Env header per PA-NAV-001).
- In parallel, fetch `GET /api/admin/portals` for the Portal filter Select options.
- Show 8-row skeleton while loading.
- On success: render table. On error: show error banner with Retry.

**On env-switch (PA-NAV-001 event):**
- Show "Switching to {env}. Reloading queue…" toast.
- Refetch queue in new env. Clear all filters back to defaults (status=pending, within=7d). Clear selection. Reset page to 1.
- Preserve search string? No — env-switch is a hard context reset for safety.

**On status tab change:**
- Update `?status=<x>` in URL (`history.pushState`, no reload).
- Refetch with new status filter. Reset page to 1. Clear row selection.
- Table re-renders with `--lc-duration-fast` fade transition.

**On filter change (portal / country / risk / within):**
- Update the relevant URL param.
- Refetch. Reset page to 1. Preserve row selection ONLY if all selected IDs are still in the new result set; otherwise clear selection with a toast "Selection cleared — filter changed".

**On search input:**
- Debounce 200ms. Server-side substring match on agent name, agency name, listing_id, listing title.
- Update `?q=<value>` in URL. Refetch. Reset page to 1. Clear selection.

**On row hover:**
- Row background swaps to `--lc-surface-sunken` at `--lc-duration-fast`.
- Row action buttons (Approve / Reject / Request info / Open) fade in at the right edge.
- Cursor becomes `pointer`.

**On row click (anywhere except checkbox or row action buttons):**
- Navigate to `PA-MOD-002` at `/admin/moderation/portals/:submissionId`, appending `?return_to=<current-url>` for back-navigation.

**On lint-cell hover:**
- Tooltip opens listing every check (per-portal validator output) with pass/warn/fail glyphs.

**On row-select checkbox click:**
- Toggle that row's selection (no navigation).
- Update the bulk-action bar row count + across-portals count + High-risk count.
- Shift+Click on a second checkbox selects the range between the last-clicked row and this one.

**On "Select all" header checkbox:**
- Selects all rows on the current page. If total > pageSize, offer toast "Select all N rows across all pages · [Extend selection]".

**On inline Approve (Pending row, hover state):**
- If the focused row is the PA's OWN submission (server returns `is_own=true`): action disabled + tooltip "You can't act on this row — you are the agent-of-record for this listing."
- Else if row's risk tier = High: prompt step-up via SHR-MFA-007. On success, proceed. On cancel, silent-cancel.
- Else if the agency's `elevated_actions_policy=step_up_always`: prompt step-up. On success, proceed.
- Else: fire `POST /api/admin/moderation/portals/:submissionId/approve` with `{ }`.
- Optimistic UI: row status badge swaps to Approved instantly at `--lc-duration-base`, row-action buttons swap to `Open` only.
- Toast "Approved {listingTitle} for {portal}." with `Undo` link (5-second grace).
- On grace expiry: server commits + portal publisher enqueues push. On Undo click: fire `POST .../undo-approve` (see [BE-VERIFY-08]).

**On inline Reject (Pending row):**
- Own-submission guard first (as above).
- Step-up if High-risk or policy requires.
- Opens single-row Reject modal (Select for reason vocab + Textarea for notes). Confirm disabled until reason chosen.
- Confirm fires `POST /:submissionId/reject` with `{ reason_code, notes }`.
- Same optimistic + toast + Undo pattern.

**On inline Request info (Pending row):**
- Opens Request-info modal (Select for reason vocab + Textarea for notes). Confirm required both.
- Fires `POST /:submissionId/request-info` with `{ reason_code, notes }`.
- Row status swaps to Request info; agent sees the reason in AGT-PUB-006 tracker + AGT-REC-001 outcome; agent can resubmit which re-enters the Pending queue.

**On Bulk Approve:**
- Own-submission rows in the selection are silently excluded server-side; a warning is surfaced pre-submit if any exist ("N rows will be skipped — you are agent-of-record for them.").
- Opens AlertDialog "Approve {N} portal submissions?" body per §Explicit copy.
- If any selected row is High-risk OR the count is >5 rows: step-up required.
- Confirm fires `POST /api/admin/moderation/portals/bulk-approve` with `{ submission_ids: [...] }`.
- Bulk commits IMMEDIATELY — no undo affordance for bulk (per PA family-pattern invariant #6). Toast "Approved {N} submissions." with link to failure drawer if server returned 207 partial.

**On Bulk Reject:**
- Opens Dialog: Select reason vocab (required) + Textarea notes (required, ≥5 chars).
- Own-submission guard + step-up (always required for bulk reject with >5 rows per invariant).
- Confirm fires `POST /api/admin/moderation/portals/bulk-reject` with `{ submission_ids: [...], reason_code, notes }`.
- Same commit-immediate + partial-failure drawer pattern.

**On Bulk Request info:** Same flow as bulk reject with the request-info reason vocab.

**On keyboard shortcut:**
- `J` next row focus · `K` prev row · `A` approve focused · `R` reject focused · `I` request info focused · `Enter` open detail · `X` toggle row-select · `Shift+A` select-all-visible · `.` refresh · `?` open shortcuts sheet · `Esc` close modal / drawer / clear selection.

**On Export CSV:**
- Fires `GET /api/admin/moderation/portals.csv?<same-query>`. Browser download. Includes all rows matching filter (not just current page). Columns: `submission_id, submitted_at, agent_name, agency_name, listing_id, listing_title, portal_code, country, sla_hours_remaining, lint_pass, lint_warn, lint_fail, risk_tier, status, decided_at, decided_by, decision_reason, decision_notes`.

**On PA-NAV-001 env-change confirmation modal (if PA is switching env while a bulk selection is active):**
- PA-NAV-001 modal appears; if PA cancels, selection preserved. If PA confirms, env switches → queue refetches in new env → selection cleared with toast.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial loading** | Page mount | Skeleton table (8 shimmer rows). Filter strip disabled. Env badge in top bar reflects current env. |
| **Ready — pending default** | Load complete, ≥1 pending | Table renders. Pending tab active. Row 1 focused for keyboard nav. |
| **Ready — approved / rejected / request-info / expired** | Status tab change | Same table shell; row-action buttons swap to `Open` only. Bulk-action bar hides Approve/Reject/Request info; only Export and Open meaningful. |
| **Ready — portal-error tab** | portal_error rows | `Open` action + a `Retry publish` action (fires `POST /:submissionId/retry-publish` — re-enqueues push to portal without re-approving). |
| **Ready — empty pending** | 0 rows | Empty-state block (see §Layout — Empty state Pending). |
| **Ready — empty other tab** | 0 rows | Simpler empty state. |
| **Search-no-results** | Search returns 0 | "No submissions match '{q}'" + Clear search link. |
| **Row selected (single)** | Checkbox click | Bulk-action bar slides in with "1 selected". |
| **Row selected (multiple)** | ≥2 checkboxes | Bar shows count + summary. |
| **All-page selected + more available** | Select-all + total > pageSize | Toast prompts "Select all N rows across all pages — Extend". |
| **Bulk with High-risk in selection** | H > 0 in summary | Amber step-up notice + step-up prompt fires on confirm. |
| **Own-submission in selection** | Server returns `is_own` rows | Pre-submit warning "N rows will be skipped — you are agent-of-record for them." |
| **Approve in progress (row)** | Approve clicked | Row status badge shows spinner-glyph; row disabled for further clicks. |
| **Reject / Request-info modal open** | Row action clicked | Modal traps focus; reason vocab select autofocused. Confirm disabled until reason chosen + notes ≥5 chars (Reject/Request-info). |
| **Approve success toast** | POST 200 | Toast "Approved {name} for {portal}." + Undo link (5s). Row optimistic. |
| **Bulk approve success** | POST 200 | Toast "Approved {N} submissions." Selection cleared. No Undo (bulk commit-immediate). |
| **Bulk approve partial** | POST 207 | Destructive toast "Approved {n}, failed {k} — see detail" + link to failure drawer listing failed rows with error codes (portal-error, expired, own-submission, etc.). |
| **Step-up required** | 401 `STEP_UP_REQUIRED` or client policy | SHR-MFA-007 modal opens inline; on success re-fires the pending action. On cancel, action aborts silently. |
| **Backend error 500** | POST fails | Destructive toast "Something went wrong. Try again." Row reverts. |
| **Session expired** | 401 (not step-up) | Redirect to `SHR-AUT-001` login with return-to param. |
| **Insufficient permission** | 403 | Full-page block: "You need portal-moderation access to view this page." Link to PA home. |
| **Env-switch mid-flow** | PA-NAV-001 env change | If unsaved modal open: confirm-cancel prompt. If bulk selection: confirm-clear prompt. On confirm: queue refetches in new env. |
| **TEST-env warning strip** | env=TEST | Persistent full-width warning strip renders under top bar. |
| **Loading — pagination** | Prev/next clicked | Table dim overlay + `--lc-duration-fast` while new page loads. |
| **Loading — filter change** | Any filter change | Same dim overlay pattern. |
| **RTL** | Locale = ar | Columns mirror; row-action buttons move to the left edge. Country ISO / SLA numerals stay LTR via bidi isolation. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; status + lint + risk badge tints adjust automatically. |
| **Undo grace period (single-row only)** | After approve/reject toast shows | Row pulse-border `--lc-accent-bold-edge` for 5s; hover shows "Undo within {N}s". |
| **Undo triggered** | Undo link clicked within 5s | Row reverts to Pending; toast dismisses; action reversed server-side. |

---

## Accessibility

- Page has a single `<h1>` "Portal moderation queue". Filter strip labeled by `aria-label="Filter portal submissions"`.
- Env badge in top bar has `aria-live="polite"` announcement on env switch ("Environment switched to TEST").
- TEST warning strip is `role="status"` with `aria-live="polite"` on entering TEST.
- Status tabs are `role="tablist"` + `role="tab"` — arrow keys navigate; Enter/Space activates.
- Table has `role="grid"` (J/K keyboard nav + row focus + inline actions make it interactive). Each row `role="row"` + `tabindex="0"` when focused.
- Every column header labels its cell via `scope="col"`.
- Row-select checkboxes have visible labels tied via `aria-labelledby` to the agent-name cell — SR announces "Select submission by Sara Al Mansouri for Property Finder AE".
- Bulk-action bar `role="status"` + `aria-live="polite"` — count changes announced.
- Modals trap focus + Esc to close + click-outside dismisses (with a "cancel" confirmation if reason was typed and would be lost).
- Toasts `role="status"` + `aria-live="polite"`; destructive `assertive`.
- Keyboard shortcut hints panel (`?`) is a Sheet with focus trap.
- Focus visible via two-tone Broadcast focus ring on every interactive element (rows included).
- Every icon-only button (Refresh, `?`, prev, next, export) has an `aria-label`.
- Relative time ("2h ago") accompanied by full timestamp in `title` + tooltip on hover / focus.
- Status pills, lint pills, risk badges are tint + glyph + label — SR reads the label.
- Row-height baseline 72px meets 44px tap-target with room; row-action buttons 44×44.
- Never rely on hover-only affordances for critical actions — inline Approve / Reject / Request info also reachable via keyboard.
- Skip-to-content link at top of page (jumps past env badge + filter strip into table).

---

## Anti-patterns (do not do these)

- Do NOT render inline Approve without keyboard equivalence — a PA with a trackpad injury or on a keyboard-only workflow must be able to approve without pointing.
- Do NOT allow bulk reject / request-info without a reason. Every decision includes a message the agent sees.
- Do NOT auto-approve on filter change or navigation. All state-changing actions are explicit clicks / keyboard triggers.
- Do NOT show fabricated portal-side approval rates or "agent quality scores." WingCaster does not have agent scoring; do not invent it. Tenure risk comes from [BE-DESIGN-02] with a defined formula — do not paint additional inferred scores.
- Do NOT use color-alone for any pill. Every status / lint / risk badge has tint + glyph + label.
- Do NOT reduce row height below 64px — the thumbnail + avatar + agency line + validator lint row need vertical room.
- Do NOT paint the row hover state with `--lc-action-primary` tint. Hover uses `--lc-surface-sunken`; primary orange is reserved for action buttons.
- Do NOT show Approve / Reject buttons for already-decided rows (approved / rejected / request-info / expired tabs). Only `Open` (and `Retry publish` in portal_error) meaningful.
- Do NOT reload the page on filter change. All filter/tab/search/pagination updates use URL query params + client-side refetch.
- Do NOT lose row selection silently on filter change unless the selection would be nonsensical; toast when lost.
- Do NOT display raw submission IDs (UUIDs) anywhere prominently. Agent name + listing title + portal is the human handle.
- Do NOT skip the two-tone focus ring on rows.
- Do NOT co-mingle LIVE and TEST data — every list + action must carry the env header + server verifies against session.
- Do NOT hide the env badge, even briefly (e.g. during a modal). Badge is always visible per PA-NAV-001.
- Do NOT allow PA to approve their own submissions in the UI. Server enforces; UI hides the buttons and shows a tooltip when the row is hovered.
- Do NOT allow Undo on bulk actions — bulk commits immediately by design; undo affordance would be too dangerous.
- Do NOT ship the mobile viewport as anything other than the "PA console requires a desktop screen" info block for v1.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Linear "Triage" view** — J/K keyboard nav + inline row actions + swap-tab-not-page.
- **GitHub Actions queue** — status tabs with counts, sticky filter strip, per-row aging chip.
- **Stripe Radar / Reviews queue** — approve/reject decision surface with reason capture, risk-tier signal without over-fitting to it.
- **Sentry Issues queue** — dense triage row + hover reveals + bulk-select bar + assignee context.
- **Notion admin console** — env-context awareness (workspace switcher analogous to env switcher).
- **AGN-MEM-002 applications queue (WingCaster)** — direct pattern predecessor; same shell, filters, bulk actions, keyboard nav, undo grace.

Do NOT match:

- Salesforce case queue (over-dense, low-density-per-decision, too enterprise-noisy).
- Kanban / Trello (wrong tool for a moderator queue with clear terminal states).
- Gmail Priority Inbox (algorithmic ML sorting out of scope for v1 PA queue).

---

## Backend contract

**List endpoint:** `GET /api/admin/moderation/portals`

**Query params:**
- `status` — `pending` | `approved` | `rejected` | `request_info` | `portal_error` | `expired` (default `pending`)
- `portal` — portal_registry.code (default all)
- `country` — ISO country code (default all)
- `risk` — `low` | `medium` | `high` (default all)
- `within` — `24h` | `7d` (default) | `30d` | `all`
- `q` — search string (agent, agency, listing_id, listing title; ≥2 chars server-side)
- `page` — integer, default 1
- `pageSize` — integer, default 25, max 100
- `sort` — `sla_remaining:asc` (default) | `submitted_at:desc` | `submitted_at:asc` | `agent_name:asc`

**Response 200:**
```json
{
  "submissions": [
    {
      "id": "psub_abc123",
      "submitted_at": "2026-09-07T12:04:11Z",
      "sla_hours_remaining": 3.8,
      "sla_hours_total": 4.0,
      "agent": {
        "id": "usr_xyz789",
        "display_name": "Sara Al Mansouri",
        "avatar_url": "https://…"
      },
      "agency": {
        "id": "agy_dubai_elite",
        "name": "Elite Real Estate Dubai",
        "tenant_url": "/admin/tenants/agy_dubai_elite"
      },
      "listing": {
        "id": "lst_marina_1204",
        "title": "3BR apartment · Dubai Marina",
        "address_line": "Marina Gate 2, Tower A, Apt 1204",
        "hero_image_url": "https://…"
      },
      "portal": {
        "code": "property_finder_ae",
        "display_name": "Property Finder AE",
        "country_code": "AE",
        "country_flag_emoji": "🇦🇪"
      },
      "validator_lint": {
        "pass_count": 6,
        "warn_count": 0,
        "fail_count": 0,
        "checks": [
          { "code": "trakheesi_number_present", "severity": "pass", "message": "Trakheesi number present." },
          { "code": "photo_count_min", "severity": "pass", "message": "8 photos (min 4)." }
        ]
      },
      "tenure_risk": {
        "tier": "low",
        "score": 0.12,
        "signals": ["agency_age_days:1240", "prior_rejection_ratio:0.02"]
      },
      "status": "pending",
      "decision": null,
      "is_own": false,
      "step_up_required": false,
      "env": "live"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 18,
    "has_next": false
  },
  "counts": {
    "pending": 18,
    "pending_at_risk": 3,
    "approved_this_week": 42,
    "rejected_this_week": 6,
    "request_info_this_week": 2,
    "portal_error_this_week": 1
  }
}
```

**Single actions:** `POST /:submissionId/approve`, `.../reject`, `.../request-info`, `.../undo-approve`, `.../undo-reject`, `.../retry-publish`.

Reject / request-info bodies: `{ "reason_code": "portal_outage" | "fails_portal_validation" | …, "notes": "…" }`.

Response 401 `STEP_UP_REQUIRED` — client triggers SHR-MFA-007, retries.

**Bulk actions:** `POST /bulk-approve`, `.../bulk-reject`, `.../bulk-request-info`.

Body: `{ "submission_ids": [...], "reason_code"?: …, "notes"?: … }`.

Response 200 all-succeeded or 207 partial:
```json
{ "succeeded": [...], "failed": [{ "id": "psub_a", "error": "OWN_SUBMISSION" }, { "id": "psub_b", "error": "PORTAL_UNAVAILABLE" }] }
```

**CSV export:** `GET /api/admin/moderation/portals.csv?<same-query>`.

**Portal registry lookup:** `GET /api/admin/portals` — returns `[{ code, display_name, country_codes, is_active }]` for filter Select population per `[BE-DESIGN-01]`.

**Prerequisites tracked / to file:**

- **`[BE-BLOCKER-02b]` ALREADY TRACKED in kickoff §5a.** `/api/admin/moderation/portals` route family (queue + item + approve + reject + request-info + bulk + retry-publish + CSV + undo-*). ~5-7 days backend for the surface + integration tests. This brief refines the scope from "queue + item + approve + reject" to the full 10-endpoint surface listed above.
- **`[BE-BLOCKER-01]` ALREADY TRACKED.** Portal publishers implement the post-approval push.
- **`[BE-DESIGN-01]` ALREADY TRACKED.** Dynamic `portal_registry` — this queue's Portal + Country filters depend on it.
- **`[BE-DESIGN-02] Tenure-risk scoring service — NEW.** Backend must expose a per-submission risk tier (low/medium/high) + score + signals list. Derivation formula: agency onboarding age, prior rejection ratio across all portals, portal-fee-history payment record, WingCaster tenure. Currently no such service exists. Scope: define signal collection + expose `GET /:submissionId` payload with `tenure_risk` block. ~3-5 days backend. **File as new `[BE-DESIGN-02]` in kickoff §5a.**
- **`[BE-BLOCKER-07] Per-portal validator module — NEW.** Backend must run per-portal validator BEFORE queue rendering + expose `validator_lint` block per PORTAL_LIST_RESEARCH §C rules. Requires `backend/src/lib/portal-validators/<code>.js` module per portal (Bayut UAE, PF UAE/KSA/EG/LB/others, Dubizzle, OLX, Aqar, Wasalt, Aqarmap, 3akarat). Effort: ~1 day per portal validator × 8 = 8 days initial + ongoing per-new-portal 1 day. Extract per-portal rules from PORTAL_LIST_RESEARCH §C. **File as new `[BE-BLOCKER-07]` in kickoff §5a.**
- **`[BE-VERIFY-07] SLA policy per portal — NEW.** `portal_registry.publisher_config.sla_hours` field must exist and be populated. Confirm schema. ~0.5 day if column exists; ~1 day if migration needed.
- **`[BE-VERIFY-08] Undo grace-period support — NEW.** Undo affordance assumes `POST /:submissionId/undo-approve` and `undo-reject` endpoints. Confirm; if absent, ~1 day backend.
- **`[BE-VERIFY-09] Own-submission detection — NEW.** Backend must return `is_own: true` when the current PA is the agent-of-record OR the tenant owner of the submitting agency. Confirm join logic. ~0.5 day.
- **`[BE-VERIFY-10] Env-scoped queue — NEW.** Confirm the queue route respects `X-Wingcaster-Env` header and NEVER returns cross-env rows. ~0.5 day audit.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/moderation/PortalModerationQueuePage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/admin/moderation/portals" element={<PortalModerationQueuePage />} />` behind the `PAConsoleGuard` HOC (requires `portal-moderation` capability pack).
- **Top-nav entry:** update PA top nav to add "Moderation → Portals" with a badge counter tied to the pending count. Badge uses `<Numeric>` + `--lc-status-draft` styling. Poll every 60s.
- **Component decomposition (this decomposition becomes the reusable PA-queue-family template):**
  - `PortalModerationQueuePage.tsx` — page shell + data fetching + URL state + env context binding.
  - `PAQueueFilterStrip.tsx` — **REUSABLE across PA queue family** — tabs + inline selects + search + refresh + export.
  - `PAQueueTable.tsx` — **REUSABLE** — table shell + row rendering slots + keyboard nav.
  - `PortalModerationRow.tsx` — one row (agent + agency, listing, portal + country, lint, risk, status, actions).
  - `PAQueueBulkBar.tsx` — **REUSABLE** — conditional bulk-action bar.
  - `PAQueueBulkApproveDialog.tsx` — **REUSABLE** — count-confirm AlertDialog.
  - `PAQueueBulkReasonDialog.tsx` — **REUSABLE** — reason-vocab + notes Dialog (for reject + request-info).
  - `PortalModerationEmptyState.tsx` — empty-state variants.
  - `PAQueueKeyboardShortcutsPanel.tsx` — **REUSABLE** — `?` sheet.
- **Data layer:**
  - Hook: `usePortalModerationQuery({ status, portal, country, risk, within, q, page, pageSize, sort, env })` — wraps `fetch` with SWR/React Query pattern; env-scoped.
  - Hook: `usePortalRegistry()` — fetches `/api/admin/portals` once for filter options.
  - Optimistic-update helpers for approve / reject / request-info / bulk.
  - Undo queue (single-row only): 5-second timer keeping mutation refundable.
- **Test discipline:**
  - Unit: each of the sub-components renders + keyboard nav + filter state.
  - Integration: full page load + filter × tab-swap × row-click × bulk-approve happy path × bulk-reject with reason × step-up prompt × undo-within-grace × own-submission block × env-switch mid-flow.
  - RTL: `screens.rtl.test.tsx` extension with the queue in Arabic locale.
  - Broadcast: `no-raw-hex.test.ts` must stay green.
  - Real-Postgres: at least one path that transitions a submission end-to-end through approve → portal push (mock publisher).
  - Accessibility: axe-core scan of loaded + bulk-selected + modal-open + step-up-open states.
- **Perf:**
  - Table virtualization not required for v1 (pageSize max 100 is fine unvirtualized).
  - Skeleton must render within 100ms of route mount.
- **Copy/i18n:**
  - All strings in `web/src/locales/en/paModeration.json` + `ar/paModeration.json`. `[TRANSLATION-PENDING]` in AR for now.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable. (Delta briefs like PA-MOD-002 AND downstream PA queue-family briefs reference THIS section.)

- Page shell background `var(--lc-bg-page)`; card / table shell on `var(--lc-surface-raised)`; header row on `var(--lc-surface-sunken)`.
- Env badge (PA-NAV-001) always visible in top bar; TEST warning strip full-width sticky under top bar.
- Page title `var(--lc-type-heading-1)`; subtitle `var(--lc-type-body-sm)` `var(--lc-text-muted)`.
- Column headers `var(--lc-type-overline)` (11px + 0.08em tracking) `var(--lc-text-muted)`.
- Row body text `var(--lc-type-body)` for agent name + listing title, `var(--lc-type-body-sm)` for secondary lines, `var(--lc-type-caption)` for agency + country + validator-lint aggregate.
- Every numeric — SLA hours, pass/warn/fail counts, page-size, pagination indices, badge counters, listing_id numeric prefix — via `<Numeric>` (mono + tabular-nums).
- Status pills use `--lc-status-{draft,published,closed,warning,danger,archived}-{bg,fg,dot}` + required glyph (○ ● ◆ ▲ ✕ ▢) + label; never color-alone.
- Validator lint pills use `--lc-status-{published,warning,danger}-{bg,fg,dot}` + glyph + label.
- Tenure risk badges use `--lc-status-{published,warning,danger}-{bg,fg,dot}` + glyph + label ("Low"/"Medium"/"High").
- SLA remaining chip uses `--lc-status-{published,warning,danger}-{bg,fg}` + label ("Xh left" / "at risk" / "Breached").
- Row hover `background: var(--lc-surface-sunken)` at `--lc-duration-fast`; row focus (via keyboard) shows the two-tone `--lc-focus-ring` + `--lc-focus-ring-contrast` ring — do NOT override.
- Row action buttons on hover: `<Button size="sm" variant="outline">`; Approve outline `--lc-action-primary`, Reject outline `--lc-border-strong`, Request info outline `--lc-status-warning`, Open outline `--lc-border`.
- Bulk-action bar: `background: var(--lc-surface-sunken)`, `border-radius: var(--lc-radius-md)`, `border: 1px solid var(--lc-border)`. Primary buttons inside use `--lc-action-primary` fill for Approve, `--lc-action-secondary` for Reject + Request info.
- Reject / Request-info modal reason vocab: `Select`; notes textarea: `--lc-border-strong` border, `--lc-radius-md`, min 3 rows.
- Empty-state illustration placeholder: `--lc-surface-sunken` fill, `border: 1px dashed var(--lc-border-strong)`, `var(--lc-radius-lg)`.
- Loading skeleton: `--lc-surface-sunken` blocks; shimmer opacity 0.6→1 at `--lc-duration-base` `--lc-easing-in-out infinite alternate`; disabled under `prefers-reduced-motion`.
- Undo pulse-border on affected row: `--lc-accent-bold-edge` at 2px, pulsing at `--lc-duration-slow` for 5s.
- Motion: bulk-bar slide-in `--lc-duration-fast` `--lc-easing-out`; row hover `--lc-duration-fast`; status swap `--lc-duration-base` `--lc-easing-in-out`; env-switch refetch `--lc-duration-base` fade. NO signal-lamp motif.
- Radii: page card `var(--lc-radius-lg)`; filter chips + buttons `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`; listing thumb `var(--lc-radius-md)`.
- Elevation: table shell `var(--lc-elevation-sm)`; modals `var(--lc-elevation-lg)`; bulk-action bar no elevation (flat, sunken).
- Focus rings: two-tone via base CSS — do not override.
- Never use `--lc-action-primary` as a row-hover fill; that token is reserved for action buttons and primary CTAs.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) portal moderation queue screen (PA-MOD-001) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is where a Platform Admin reviews listing submissions that agents pushed to external portals (Property Finder, Bayut, Dubizzle, etc.) before WingCaster pushes them to the target portal (WF-03 approver-side inbox). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass: render the desktop 1440px layout with the LIVE env badge in the top bar (green), Pending tab active (counter 18), 8 sample rows all Pending (mix of low/medium/high risk, mix of portals across UAE/KSA/EG/LB/OM/JO), row 3 in hover state showing inline Approve/Reject/Request info/Open buttons on the right. Bulk-action bar hidden. Pagination footer showing "1–8 of 18".

LTR English only for this pass — I'll ask for RTL Arabic, dark mode, TEST env with warning strip, bulk-selection state, empty state, and modal states as separate follow-ups.

Follow the copy table in the brief exactly. Do NOT fabricate portal approval rates or agent quality scores. The validator lint, tenure risk, and SLA remaining are the ONLY signals — all backed by defined backend payloads.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now show the bulk-selection state — rows 1, 2, 5 checked. Bulk-action bar visible: "3 selected · 3 across 3 portals · 0 High-risk · Clear selection" left, "Approve 3" + "Reject 3" + "Request info 3" right.`
2. `Now the Bulk Reject dialog open over the bulk-selection state. Reason Select shown (Portal outage highlighted), Notes textarea empty, Confirm button disabled.`
3. `Now the same layout in TEST env — badge shows amber TEST + full-width warning strip under top bar.`
4. `Now the empty state — Pending tab with 0 rows. Show illustration placeholder + title + body + secondary CTA "Review portal registry".`
5. `Now the Approved tab active, 6 sample rows in Approved status. Row-action buttons show only "Open".`
6. `Now the keyboard-shortcuts drawer open on the right side, listing J/K/A/R/I/Enter/X/Shift+A/./?/Esc.`
7. `Now RTL Arabic at desktop 1440px. Use [TRANSLATION-PENDING] where copy has no Arabic; MIRROR the whole layout including column order.`
8. `Now the dark mode version of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-MOD-001/` + screenshot to `docs/design/mockups/PA-MOD-001-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 8 iteration states (ready-pending LIVE, bulk-selection, bulk-reject-modal, TEST-env, empty, approved tab, keyboard drawer, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-MOD-001/`.
- [ ] Cursor Wave-2 dispatch prompt references this brief + the mockup paths + the paired PA-MOD-002 brief.
- [ ] `[BE-DESIGN-02]` tenure-risk scoring service filed in kickoff §5a.
- [ ] `[BE-BLOCKER-07]` per-portal validator module filed in kickoff §5a.
- [ ] `[BE-VERIFY-07..10]` SLA / Undo / Own-submission / Env-scoping verifications filed in kickoff §5a.
- [ ] Delta brief `PA-MOD-002-portal-moderation-detail-brief.md` referenced from Wave-2 dispatch prompt.
- [ ] Reusable component names (`PAQueueFilterStrip`, `PAQueueTable`, `PAQueueBulkBar`, `PAQueueBulkApproveDialog`, `PAQueueBulkReasonDialog`, `PAQueueKeyboardShortcutsPanel`) reserved in the codebase so downstream `PA-ACR-001` / `PA-PVA-008` / `PA-APR-002` briefs can inherit without renaming.
