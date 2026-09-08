# Screen Brief — PA-POR-001 · Portal registry list (dynamic portal catalog)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Anchor brief for the PA-POR portal-admin family.** Companion to `SCREEN_MATRIX_PA.md` (PA-POR family added Rev 6, 2026-09-06 per user directive "add portals on the fly"). Establishes the PA-managed portal catalog surface that the WingCaster publisher pipeline, PA-MOD-001 moderation queue, `credits/features.js` dynamic feature registration, per-country pricing dimension, and `AGT-CHN-001` agent portal-credentials pickers all read from at boot + on-demand.

Delta briefs `PA-POR-002-add-edit-portal-brief.md` (form) and `PA-POR-003-portal-activation-history-brief.md` (audit timeline) inherit the Broadcast alignment section from THIS file. THIS brief is also authoritative for the PA-POR family's env-scoping, two-person-rule flip semantics, and adapter-vs-registry-row separation of concerns.

Wave 6 (Week 6 — Two-person-rule UI + PA-PKG-* admin + PA-POR-* portal admin) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 6 §6. Depends on Week 2 backend `[BE-DESIGN-01]` dynamic portal registry deploy.

The PA-POR family sits alongside PA-PKG-* (package admin, WF-fin) as the two "PA-managed catalog" families. Treat this file as the **portal-catalog analog of `PA-PKG-001-package-list-brief.md`** — same tabular density model, same catalog-row → detail-form → version-history pattern, adapted to the portal domain (adapter class references, country-code chip lists, per-portal SLA, per-portal validator refs, connected-agent counts).

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts (this callout block is REFERENCED by PA-POR-002 AND PA-POR-003 — keep it complete here; do not re-specify base tokens in the delta briefs):**

- **PA admin shell context.** Page renders inside the PA console shell — `SHR-NAV-001` top bar (with PA-NAV-001 env badge always visible), no `SHR-NAV-002` side drawer for PA in v1 (PA uses top-nav routes). Page shell background `var(--lc-bg-page)`; content max-width 1440px with `padding-inline: var(--lc-space-2xl)`.
- **Environment badge (PA-NAV-001) is ALWAYS visible in the top bar** while this page is rendered. When PA is in TEST, the persistent full-width warning strip (`--lc-status-warning` fill + white ink, sticky under the top bar per PA-NAV-001 §Layout) offsets the list's sticky sub-header down by `var(--lc-nav-warning-strip-height)` (24px). LIVE mode: no warning strip; badge alone. **Adapter code + `portal_registry` rows are ENV-SHARED** (portal catalog is a platform config, not a per-tenant record) but the "connected agent count" numeric IS env-scoped — LIVE and TEST agents counted separately.
- **Page title ("Portal registry"):** `font: var(--lc-type-heading-1)` (600 26/32 IBM Plex Sans) — NOT display-tier; this is an admin catalog workspace.
- **Section subtitle / catalog-count line:** `font: var(--lc-type-body-sm)`, `color: var(--lc-text-muted)`. Numeric run wrapped in `<Numeric>` — e.g. `<Numeric>12</Numeric> total · <Numeric>4</Numeric> live · <Numeric>6</Numeric> stub · <Numeric>2</Numeric> deprecated · <Numeric>9</Numeric> countries covered`.
- **"Add portal" primary CTA (top-right of header block):** `<Button variant="default">` — `--lc-action-primary` fill, `--lc-action-primary-hover` on hover (DARKER never lighter), `Plus` lucide icon prefix, label "Add portal". Opens `PA-POR-002` in create mode at `/admin/portals/new`.
- **Filter strip (Status · Active-only · Country · Search):** `<Tabs>` for portal-status (All default · LIVE · STUB · DEPRECATED), `<Toggle>` for "Active only" (checked by default — hides `is_active=false` rows), `<Select>` for Country (multi-select — fed from union of `portal_registry.country_codes` across all rows), `<Input>` with `Search` lucide icon for portal code / display name / adapter class name search (debounced 200ms). Chip strip sits on `var(--lc-surface-raised)` with `border-bottom: 1px solid var(--lc-border)`.
- **Table shell:** `<Table>` primitive. Header row `background: var(--lc-surface-sunken)`, header text `var(--lc-type-overline)` + `color: var(--lc-text-muted)`. Body rows on `var(--lc-surface-raised)` separated by `border-bottom: 1px solid var(--lc-border)`. Row hover `background: var(--lc-surface-sunken)` at `--lc-duration-fast`. Row height ~64px (portal channel-mark + display-name + adapter-class line comfortably vertical). Sticky column header while table scrolls.
- **Portal-identity cell (code + display name + logo):** 32×32 rounded portal logo (`var(--lc-radius-md)`; uploaded via PA-POR-002 assets flow, served from `/assets/portals/<code>.svg` OR a channel-token fallback) + display name (`var(--lc-type-body)`) + portal code monospaced (`var(--lc-type-data-sm)` `var(--lc-text-muted)`). If no logo on file: neutral `--lc-surface-sunken` circle with first two letters of `code` as monogram in `var(--lc-type-caption)`.
- **Country-codes cell (chip list):** stack of country chips — each chip is a small `<Badge variant="outline">` sized `var(--lc-type-caption)` — flag emoji + ISO code (e.g. "🇦🇪 AE"). Chips wrap to a second line if > 6; over 6 shows first 5 + "+N more" chip that opens a `<Tooltip>` listing the rest. Border `--lc-border`; text `--lc-text-secondary`.
- **Adapter cell (adapter_class_name + implementation status):** monospaced adapter path (`var(--lc-type-data-sm)`) — e.g. `portals/property_finder.js` — plus a small `<Badge>` immediately below indicating implementation state: `LIVE` (`--lc-status-published-{bg,fg,dot}` + ● glyph — file exists AND base-class contract satisfied), `STUB` (`--lc-status-draft-{bg,fg,dot}` + ○ glyph — file exists as placeholder throwing `NOT_IMPLEMENTED` OR row exists but adapter file absent), `DEPRECATED` (`--lc-status-archived-{bg,fg,dot}` + ▢ glyph — `is_active=false` AND scheduled for removal). Always tint + glyph + label.
- **Active status cell (`is_active` toggle read-only display):** `<Badge>` — active `--lc-status-published-{bg,fg,dot}` + ● + "Active"; inactive `--lc-status-archived-{bg,fg,dot}` + ▢ + "Inactive". Not editable inline (edits require the two-person-rule flip flow — see §Interactions and PA-POR-002 §Activation section).
- **Current-SLA cell:** numeric hours + "h" suffix (e.g. `4h`, `6h`, `8h`) via `<Numeric>` in `var(--lc-type-data-sm)`. Sourced from `publisher_config.sla_hours` on the current active version. If null (STUB portals with no SLA yet): render em-dash "—" in `var(--lc-text-muted)`.
- **Connected-agents cell (env-scoped count):** `<Numeric>` count of agent-tenant connections (from `agent_portal_credentials` join OR `portal_registry.<id>` allocation table depending on sub-model X vs Y per PORTAL_LIST_RESEARCH §A). Small `Users` lucide icon prefix. Tooltip on hover: "In {env}: {N} agents connected across {M} agencies." Row action `Open connected list →` in tooltip footer.
- **Last-activation-change cell:** relative time ("2d ago", "3w ago") in `var(--lc-type-body-sm)` + a small "by {admin_display_name}" secondary line in `var(--lc-type-caption)` `var(--lc-text-muted)`. Full timestamp in `<Tooltip>` on hover. Clickable — opens PA-POR-003 activation history filtered to this portal.
- **Row action buttons (View / Edit / History):** `<Button size="sm" variant="ghost">` icon-only on hover (Eye = View → PA-POR-002 read mode, Pencil = Edit → PA-POR-002 edit mode, History = Clock icon → PA-POR-003). Buttons appear on row hover with `--lc-duration-fast` fade. Focus-visible always (keyboard reachable regardless of hover).
- **Empty state block:** centered stack, illustration placeholder (`--lc-surface-sunken` 200px square with dashed `--lc-border-strong`), title `var(--lc-type-heading-3)`, body `var(--lc-type-body)` `var(--lc-text-muted)`, primary CTA `Add first portal →` (`<Button variant="default">`).
- **Loading skeleton:** 6 shimmering rows using `--lc-surface-sunken` block with subtle animation at `--lc-duration-base ease-in-out infinite alternate`; respects `prefers-reduced-motion`.
- **Focus rings:** two-tone via base CSS — do NOT override. Table rows are focusable (`tabindex="0"`) so J/K keyboard navigation lands a visible focus ring.
- **Radii:** table container `var(--lc-radius-lg)`, filter chips `var(--lc-radius-md)`, buttons `var(--lc-radius-md)`, badges `var(--lc-radius-pill)`, portal logo cell `var(--lc-radius-md)`, country chips `var(--lc-radius-pill)`.
- **Motion:** row hover `--lc-duration-fast`; add-portal CTA hover `--lc-duration-fast`; status pill swap after inline activate/deactivate `--lc-duration-base` `--lc-easing-in-out`; env-switch refetch of connected-agent counts `--lc-duration-base` fade; NO signal-lamp motif (reserved for "listing went live").
- **Numeric fields — every count, SLA hours, connected-agent count, country-chip counter, pagination index uses `<Numeric>` or `.lc-data`.** Enforced by `--lc-font-mono` + `tabular-nums`.
- **PA-POR family invariants (inherited by PA-POR-002 form + PA-POR-003 history):**
  1. Env badge always visible; portal-catalog is env-shared BUT connected-agent counts + activation history entries are env-scoped for the acting admin's context.
  2. Two-person rule on `is_active` flips — activate/deactivate never single-click; requires submitter + approver per the PA-APR-003 pattern.
  3. Adding a `portal_registry` row does NOT deploy adapter code — adapter file (`backend/src/lib/notifications/portals/<code>.js`) ships via a Cursor-dispatched PR separately. A row without a matching adapter file renders as `STUB` and refuses `is_active=true` server-side.
  4. `code` is IMMUTABLE post-creation (would break metering event keys + `PUBLISHING_REALESTATE_<CODE>` feature registration). Enforced server-side + UI disables the code field in PA-POR-002 edit mode.
  5. Every action writes to immutable audit (PA-AUD-001) AND to `portal_registry_versions` for schema-shape changes.
  6. Step-up (SHR-MFA-007) required for any `is_active=true` flip AND for any `publisher_config` change touching credentials (API keys, OAuth client secrets — reference-only pointers into secrets manager; never stored in the JSONB itself).
  7. Keyboard-first for the list (J/K/Enter/E/H/A/?/Esc).

---

## Meta

| | |
|---|---|
| Screen ID | PA-POR-001 |
| Screen name | Portal registry list |
| Persona | PA (Platform Admin — any admin with `portal-registry-read` capability; write requires `portal-registry-write`; activation flip requires `portal-registry-activate`) |
| Device targets | Desktop 1440px ONLY — PA console is desktop-first per matrix (no tablet/mobile fallback for v1; render "PA console requires a larger screen" info block on <1024px) |
| Locale | English + Arabic (RTL) — both mandatory. PA console defaults to English for global admins; Arabic supported for MENA-based admins. |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/portals` (query params: `?status=all\|live\|stub\|deprecated`, `?active=true\|false\|all`, `?country=<iso[,iso...]>`, `?q=<code-or-name-or-adapter>`, `?page=<n>`, `?sort=code:asc\|display_name:asc\|last_change:desc\|connected:desc`) |
| Current state | MISSING. Backend `portal_registry` table + CRUD routes `[BE-DESIGN-01]` scheduled for Week 2 deploy; frontend PA-POR-001..003 scheduled for Week 6. This brief authored 2026-09-08 in a dedicated session per kickoff §6 Week 6 note. |
| Workflow role | Portal-catalog administration (upstream of WF-03 moderation, WF-fin per-country pricing, AGT-CHN portal-credential connection, AGT-PUB portal-picker rendering) |
| Backend prerequisites | ⏳ `[BE-DESIGN-01]` `portal_registry` + `portal_registry_versions` tables + `GET/POST/PATCH /api/admin/portals` route family + adapter-class file-existence check + dynamic feature registration on boot (see §Backend contract) · ⏳ `[BE-BLOCKER-07]` per-portal validator module registration (validator files referenced by the row) · ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context · ✅ PA-AUD-001 audit sink |
| Cluster | Wave 6 (Week 6 — Two-person-rule UI + PA-PKG-* admin + PA-POR-* portal admin) alongside PA-APR-003/005/006 + PA-PKG-001..004 |

---

## Purpose

Platform Admin browses, filters, and manages the WingCaster portal catalog — the DB-backed list of external real-estate portals that WingCaster publishes to (AGT-PUB) and receives leads from (AGT-INB), plus the placeholder rows for portals that are commercially committed but not yet code-live.

Per user directive 2026-09-06 ("add portals on the fly") + `[BE-DESIGN-01]`, portal identity is **NO LONGER hardcoded** in `backend/src/lib/notifications/realestate.js` or `credits/features.js`. Instead:

- `portal_registry` table is the source of truth for portal code, display name, country coverage, adapter class name, publisher config, inbound config, validator ruleset reference, current SLA, and active status.
- `credits/features.js` reads `portal_registry` at boot and auto-registers `PUBLISHING_REALESTATE_<CODE>` metered features for every `is_active=true` row.
- Publisher adapter files live at `backend/src/lib/notifications/portals/<code>.js`, extending a `PortalPublisher` base. Adding a new portal end-to-end = (1) PA adds a `portal_registry` row via PA-POR-002 (creates STUB portal — visible in the catalog, but NOT active + NOT registered as a metered feature); (2) Cursor-dispatched PR adds the adapter file; (3) PA flips `is_active=true` via PA-POR-002 activation form under two-person-rule with the adapter-existence + validator-file-existence gate satisfied.

The list serves three PA tasks at three cadences:

1. **Ongoing catalog inventory** — visual scan of "what portals do we support, in what countries, at what SLA, with how many connected agents." Sortable by `connected_agents` descending answers "which portals are actually being used." Sortable by `last_change` answers "what has moved recently."
2. **Adding a new portal (BD-driven)** — after commercial deal closes with a new portal, PA clicks `Add portal` and drafts the registry row (PA-POR-002) with `is_active=false` (STUB). Row goes live only after the adapter PR merges + a second PA approves the activation flip.
3. **Adjusting an active portal** — SLA tightening after a commercial renegotiation; country-coverage expansion when a portal launches in a new market; validator-ruleset swap when a portal updates its required-fields spec; deprecation when a portal exits a market.

Success outcome: portals visible in the list match the deployed adapter files + operationally-committed commercial state. Zero orphaned rows (`is_active=true` without matching adapter). Zero orphaned adapters (adapter file exists but no `portal_registry` row). Country coverage across all active portals matches the D19 PORTAL-LIST-LOCK critical path.

---

## Design goals

1. **Catalog-first density.** PA scans the full catalog (10-30 rows at v1 scale) in one screen. Every column earns its place; secondary metadata (publisher_config JSONB, validator ruleset details, activation history) hides behind row actions or the detail form.
2. **Adapter-vs-row separation visible.** The `STUB` badge on the adapter cell makes it OBVIOUS which rows are placeholders waiting for code deploy vs. which are code-live. PA can filter to `STUB` to see the queue of "portals commercially committed but not yet integrated."
3. **Two-person rule is the default posture.** `is_active` toggle is NOT inline-editable — this is a catalog-level configuration flip with cross-tenant blast radius (activation immediately makes the portal appear in every agent's AGT-CHN-001 portal-credentials picker + AGT-PUB portal picker). Editing happens via PA-POR-002 with a submitter + approver hand-off.
4. **Connected-agent count is env-scoped, catalog identity is env-shared.** PA in LIVE sees LIVE connection counts; PA in TEST sees TEST counts. But the portal `code`, `display_name`, `adapter_class_name`, `country_codes`, `publisher_config`, and `is_active` are shared across envs — a portal is a portal regardless of env.
5. **Sortable by "what matters right now."** Default sort: `last_change:desc` (recent activity first). Alternate sorts: `connected:desc` (most-used first), `code:asc` (alphabetical), `display_name:asc`.
6. **No color-only status differentiation** — LIVE / STUB / DEPRECATED and Active / Inactive all use tint + glyph + label per Broadcast rule.
7. **Family-pattern anchor.** This list's shape (env badge → title → add-portal CTA → filter strip → keyboard-native table → pagination) is the reusable PA-POR-family skeleton. PA-POR-002 form + PA-POR-003 history inherit this Broadcast callout block + invariants unchanged; only content composition + backend routes differ.

---

## Layout

### Desktop 1440px (primary and only target for v1)

Single-column stack inside the PA console shell (SHR-NAV-001 top bar with PA-NAV-001 env badge; PA console has no side drawer in v1):

**PA-NAV-001 persistent warning strip (conditional — appears when env=TEST):**
- Full-width, sticky under top bar, 24px tall, `--lc-status-warning` fill + white ink, copy "TEST ENVIRONMENT — portal catalog changes apply platform-wide; agent-connection counts shown are TEST-env only."

**Header block (sticky under top bar + optional TEST strip):**
- Left: page title "Portal registry" (`var(--lc-type-heading-1)`) + subtitle "<Numeric>N</Numeric> total · <Numeric>K</Numeric> live · <Numeric>S</Numeric> stub · <Numeric>D</Numeric> deprecated · <Numeric>C</Numeric> countries covered" (`var(--lc-type-body-sm)` `var(--lc-text-muted)`).
- Right: three utility buttons + primary CTA — `Refresh` (`<Button variant="ghost" size="icon">` with `RefreshCw` icon), `Export CSV` (`<Button variant="ghost">`), `?` keyboard-hints toggle, **`Add portal`** primary CTA (`<Button variant="default">` with `Plus` icon prefix).

**Filter strip (sticky):**
- Row 1: portal-status tabs — `All` (default active) / `LIVE` / `STUB` / `DEPRECATED`. Each tab shows a counter — `LIVE <Numeric>4</Numeric>`.
- Row 2: inline filters — `Active only` toggle (`<Switch>` with label — checked by default when `status=all|live`, unchecked and disabled when `status=deprecated`), `Country` multi-select (`<Select>` with country flag + ISO options fed from active portal_registry country_codes union), search `<Input>` with `Search` icon prefix — placeholder "Search portal code, display name, or adapter class…", debounced 200ms.
- Row 3: sort control — `<Select>` "Sort by" — options: `Last change (newest first)` (default), `Last change (oldest first)`, `Portal code (A–Z)`, `Display name (A–Z)`, `Connected agents (most first)`, `Country count (most first)`.

**Table:**
- Columns (desktop, left-to-right in LTR; mirror in RTL):
  1. Portal identity — logo + display name + code (default 240px)
  2. Country codes — chip list (280px, wraps)
  3. Adapter — adapter_class_name + implementation-status badge (220px)
  4. Active status — Active / Inactive badge (110px)
  5. Current SLA — hours (80px, right-aligned numeric)
  6. Connected agents — env-scoped count with Users icon (110px, right-aligned numeric)
  7. Last activation change — relative time + by-admin secondary line (160px)
  8. Row actions — View / Edit / History icon buttons (120px, right-aligned)
- Row height ~64px.
- Row click (anywhere except row-action buttons) → navigate to PA-POR-002 in READ mode at `/admin/portals/:code`, preserving current list query params in a `return_to` param.
- Row focus state via keyboard (J/K cycles through rows).
- Sticky column header while table scrolls.

**Pagination footer (only if total > pageSize):**
- Right-aligned: `<Numeric>1–25</Numeric> of <Numeric>N</Numeric>` + prev / next buttons + `<Select>` page-size (25 default, 50, 100).

**Below-table note (only when filters hide rows):**
- Small `var(--lc-text-muted)` line: "N rows hidden by filters — [Clear filters]." Clear is a link-styled button.

### Empty state (no portals in catalog)

Centered stack in the table area:
- Illustration placeholder (200px square, `--lc-surface-sunken`, dashed `--lc-border-strong`) — label "Illustration — empty catalog".
- Title (`var(--lc-type-heading-3)`): "No portals in the catalog yet"
- Body (`var(--lc-type-body)` `var(--lc-text-muted)`): "Add the first portal to enable publishing (AGT-PUB) and inbound lead capture (AGT-INB). A newly-added portal starts as a STUB — activation requires a matching adapter file and a two-person approval."
- Primary CTA (`<Button variant="default">`): "Add first portal →" — navigates to PA-POR-002 create mode.

### Empty state (filter matches nothing)

Simpler: title "No portals match your filters" + `var(--lc-text-muted)` body "Try clearing the country filter or switching to All status." + `Clear filters` outline button.

### Below-min-viewport fallback (<1024px)

Full-page info block: "PA console requires a desktop screen (1024px or wider)." + link back to `SHR-NAV-001` home. Do NOT attempt a mobile-optimized catalog.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Page title | Portal registry |
| Subtitle template | {N} total · {K} live · {S} stub · {D} deprecated · {C} countries covered |
| TEST-env warning strip | TEST ENVIRONMENT — portal catalog changes apply platform-wide; agent-connection counts shown are TEST-env only. |
| Add portal CTA | Add portal |
| Refresh button aria-label | Refresh portal registry |
| Export CSV | Export CSV |
| Keyboard hints button aria-label | Show keyboard shortcuts |
| Keyboard hints panel title | Keyboard shortcuts |
| Shortcut — navigate down | `J` — next portal |
| Shortcut — navigate up | `K` — previous portal |
| Shortcut — open detail (view mode) | `Enter` — view focused portal |
| Shortcut — edit | `E` — edit focused portal |
| Shortcut — history | `H` — activation history for focused portal |
| Shortcut — add portal | `A` — add new portal |
| Shortcut — refresh | `.` — refresh registry |
| Shortcut — help | `?` — open shortcuts sheet |
| Shortcut — close | `Esc` — close modal / sheet |
| Status tab — all | All |
| Status tab — live | LIVE |
| Status tab — stub | STUB |
| Status tab — deprecated | DEPRECATED |
| Filter — active-only label | Active only |
| Filter — country label | Country |
| Filter — country any option | Any country |
| Search placeholder | Search portal code, display name, or adapter class… |
| Sort label | Sort by |
| Sort — last change desc | Last change (newest first) |
| Sort — last change asc | Last change (oldest first) |
| Sort — code asc | Portal code (A–Z) |
| Sort — display name asc | Display name (A–Z) |
| Sort — connected desc | Connected agents (most first) |
| Sort — country count desc | Country count (most first) |
| Column — portal identity | Portal |
| Column — country codes | Countries |
| Column — adapter | Adapter |
| Column — active | Active |
| Column — sla | SLA |
| Column — connected | Connected |
| Column — last change | Last change |
| Column — actions | Actions |
| Adapter badge — live | LIVE |
| Adapter badge — stub | STUB |
| Adapter badge — deprecated | DEPRECATED |
| Adapter badge — stub tooltip | This portal has a registry row but no matching adapter file at backend/src/lib/notifications/portals/{code}.js. Ship the adapter via Cursor before activating. |
| Adapter badge — deprecated tooltip | This portal is scheduled for removal. Existing publishes will complete; no new publishes are accepted. |
| Active badge — active | Active |
| Active badge — inactive | Inactive |
| Country-chip more template | +{N} more |
| Country-chip more tooltip title | Additional countries |
| SLA missing placeholder | — |
| Connected tooltip template | In {env}: {N} agents connected across {M} agencies. |
| Connected tooltip footer link | Open connected list → |
| Last-change secondary template | by {adminDisplayName} |
| Last-change tooltip template | {fullTimestamp} — {adminDisplayName} |
| Row action — view aria-label | View {portalDisplayName} |
| Row action — edit aria-label | Edit {portalDisplayName} |
| Row action — history aria-label | Activation history for {portalDisplayName} |
| Empty catalog — title | No portals in the catalog yet |
| Empty catalog — body | Add the first portal to enable publishing (AGT-PUB) and inbound lead capture (AGT-INB). A newly-added portal starts as a STUB — activation requires a matching adapter file and a two-person approval. |
| Empty catalog — CTA | Add first portal → |
| Empty filter — title | No portals match your filters |
| Empty filter — body | Try clearing the country filter or switching to All status. |
| Empty filter — CTA | Clear filters |
| Filter-hidden note template | {N} rows hidden by filters — [Clear filters] |
| Loading | Loading portal registry… |
| Env-switch loading | Switching to {env}. Reloading connected-agent counts… |
| Error banner | Couldn't load the portal registry. Try again. |
| Retry button | Retry |
| Pagination template | {start}–{end} of {total} |
| Page-size label | Rows per page |
| Refresh toast — success | Portal registry refreshed. |
| Own-approval block | You can't act on this portal — you drafted the pending change; a second admin must approve. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Page title | plain `<h1>` with `--lc-type-heading-1` |
| Env badge | Embedded `PA-NAV-001` component (top bar) |
| TEST warning strip | `PA-NAV-001` persistent-strip subcomponent |
| Add portal CTA | `Button variant="default"` + `Plus` icon |
| Status tabs | `Tabs` + `TabsList` + `TabsTrigger` |
| Active-only toggle | `Switch` with `Label` |
| Country multi-select | `Select` (with `multiple`) OR headless-ui `Combobox` for a country-picker with search — pattern per PA-PKG-001 country picker |
| Search input | `Input` with `Search` icon (lucide) as prefix |
| Sort select | `Select` + `SelectItem` |
| Table | `Table` + `TableHeader` + `TableRow` + `TableCell` |
| Portal logo | `<img>` in a fixed 32×32 wrapper with `object-fit: contain` + fallback monogram block |
| Country chips | Stack of `<Badge variant="outline">` |
| Adapter status badge | `<Badge>` with variant per status |
| Active-status badge | `<Badge>` with variant per status |
| Connected-agents chip | `Users` icon + `<Numeric>` + optional Tooltip |
| Last-change cell | Relative-time text + secondary "by admin" + Tooltip |
| Row action buttons | `Button size="sm" variant="ghost"` with icon-only (Eye / Pencil / Clock) |
| Pagination controls | `Button variant="ghost" size="icon"` for prev/next + `Select` for page size |
| Export CSV | `Button variant="ghost"` + `Download` icon |
| Refresh | `Button variant="ghost" size="icon"` + `RefreshCw` icon |
| Keyboard hints panel | `Sheet` (right-side drawer) triggered by `?` key or button |
| Empty-state CTAs | `Button variant="default"` for primary; `Button variant="outline"` for clear-filters |
| Loading skeleton | Custom skeleton rows using `--lc-surface-sunken` blocks |
| Error banner | Custom `<div>` with `AlertTriangle` icon, `--lc-status-danger-bg` background |
| Toast | `Sonner` toast |
| Tooltip | `Tooltip` |
| Numeric renders | `<Numeric>` primitive |
| Icons | `lucide-react` — `Plus`, `Search`, `Download`, `RefreshCw`, `Eye`, `Pencil`, `Clock`, `AlertTriangle`, `HelpCircle`, `ChevronLeft`, `ChevronRight`, `Users`, `Image` |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:

- **Env:** LIVE (green badge, no warning strip).
- **Header:** "Portal registry" title, subtitle "12 total · 4 live · 6 stub · 2 deprecated · 9 countries covered", `Refresh` / `Export CSV` / `?` ghost buttons + `Add portal` orange primary CTA at right.
- **Filter strip:** `All` tab active (counter 12), LIVE (4), STUB (6), DEPRECATED (2); `Active only` toggle ON; Country `Any country`; search empty; Sort by "Last change (newest first)".
- **Table with 12 sample rows:**
  1. **Property Finder AE** — code `property_finder_ae` · Countries [🇦🇪 AE] · Adapter `portals/property_finder.js` LIVE · Active · SLA `6h` · Connected `142` · Last change "2d ago · by Rania Farah"
  2. **Property Finder KSA** — code `property_finder_sa` · Countries [🇸🇦 SA] · Adapter `portals/property_finder.js` LIVE · Active · SLA `6h` · Connected `38` · Last change "2d ago · by Rania Farah"
  3. **Property Finder Egypt** — code `property_finder_eg` · Countries [🇪🇬 EG] · Adapter `portals/property_finder.js` LIVE · Active · SLA `8h` · Connected `24` · Last change "2d ago · by Rania Farah"
  4. **Property Finder Lebanon** — code `property_finder_lb` · Countries [🇱🇧 LB] · Adapter `portals/property_finder.js` LIVE · Active · SLA `12h` · Connected `9` · Last change "2d ago · by Rania Farah"
  5. **Bayut UAE** — code `bayut_ae` · Countries [🇦🇪 AE] · Adapter `portals/bayut.js` STUB · Inactive · SLA `—` · Connected `0` · Last change "5d ago · by Karim Nasr"
  6. **Bayut KSA** — code `bayut_sa` · Countries [🇸🇦 SA] · Adapter `portals/bayut.js` STUB · Inactive · SLA `—` · Connected `0` · Last change "5d ago · by Karim Nasr"
  7. **Dubizzle UAE** — code `dubizzle_ae` · Countries [🇦🇪 AE] · Adapter `portals/dubizzle.js` STUB · Inactive · SLA `—` · Connected `0` · Last change "5d ago · by Karim Nasr"
  8. **Aqar KSA** — code `aqar_sa` · Countries [🇸🇦 SA] · Adapter `portals/aqar.js` STUB · Inactive · SLA `—` · Connected `0` · Last change "1w ago · by Karim Nasr"
  9. **Aqarmap Egypt** — code `aqarmap_eg` · Countries [🇪🇬 EG] · Adapter `portals/aqarmap.js` STUB · Inactive · SLA `—` · Connected `0` · Last change "1w ago · by Karim Nasr"
  10. **Wasalt KSA** — code `wasalt_sa` · Countries [🇸🇦 SA] · Adapter `portals/wasalt.js` STUB · Inactive · SLA `—` · Connected `0` · Last change "2w ago · by Karim Nasr"
  11. **OLX Lebanon** — code `olx_lb` · Countries [🇱🇧 LB] · Adapter `portals/olx.js` DEPRECATED · Inactive · SLA `—` · Connected `0` · Last change "3w ago · by Yara Habib"
  12. **Blue Door LB** — code `blue_door_lb` · Countries [🇱🇧 LB] · Adapter `portals/blue_door.js` DEPRECATED · Inactive · SLA `—` · Connected `0` · Last change "4w ago · by Yara Habib"
- **Row 1 (Property Finder AE) in hover state:** row background `--lc-surface-sunken`, row-action buttons `View` / `Edit` / `History` visible on the right.
- **Pagination footer:** hidden (only 12 rows, under default page size of 25).
- **Two side variants to screenshot as separate v0 iterations:**
  - **Filter to STUB:** `STUB` tab active. 6 rows visible (Bayut UAE, Bayut KSA, Dubizzle UAE, Aqar KSA, Aqarmap Egypt, Wasalt KSA). All `Inactive`. Below-table note "6 rows shown of 12 in catalog".
  - **Empty state:** All tab with 0 rows (fresh install). Empty-state block centered with illustration placeholder + copy + primary CTA "Add first portal →".

Do NOT fabricate portal metrics not in the backend contract. Country lists must match the D19 PORTAL-LIST-LOCK from PORTAL_LIST_RESEARCH_2026-09-04.md.

---

## Interactions

**On page load:**
- Fetch `GET /api/admin/portals?status=all&active=true&sort=last_change:desc&page=1&pageSize=25` scoped to current env (X-Wingcaster-Env header per PA-NAV-001 — env drives the `connected_agents` count only; catalog identity is env-shared).
- Show 6-row skeleton while loading.
- On success: render table. On error: show error banner with Retry.

**On env-switch (PA-NAV-001 event):**
- Show "Switching to {env}. Reloading connected-agent counts…" toast.
- Refetch registry in new env (only the connected-agent count column re-renders; other columns keep their values via optimistic reuse). Preserve filters + sort + page + search (env-switch is NOT a hard reset here — catalog identity is stable across envs, only counts change).

**On status tab change:**
- Update `?status=<x>` in URL (`history.pushState`, no reload).
- Refetch with new status filter. Reset page to 1.
- Table re-renders with `--lc-duration-fast` fade transition.
- Special: when tab is DEPRECATED, disable the `Active only` toggle + force it OFF (deprecated portals are never active).

**On Active-only toggle:**
- Update `?active=true|false|all` in URL.
- Refetch. Reset page to 1.

**On country multi-select change:**
- Update `?country=<iso[,iso...]>` in URL.
- Refetch with country-intersection filter (rows whose `country_codes` contains ANY selected ISO).
- Reset page to 1.

**On search input:**
- Debounce 200ms. Server-side substring match on `code`, `display_name`, `adapter_class_name`.
- Update `?q=<value>` in URL. Refetch. Reset page to 1.

**On sort change:**
- Update `?sort=<field>:<dir>` in URL. Refetch (sort is server-side).

**On row hover:**
- Row background swaps to `--lc-surface-sunken` at `--lc-duration-fast`.
- Row action buttons (View / Edit / History) fade in at the right edge.
- Cursor becomes `pointer`.

**On row click (anywhere except row-action buttons):**
- Navigate to PA-POR-002 in READ mode at `/admin/portals/:code`, appending `?return_to=<current-url>` for back-navigation.

**On row action — View:**
- Same as row click — navigate to PA-POR-002 in READ mode.

**On row action — Edit:**
- Requires `portal-registry-write` capability. If PA lacks it: tooltip "You don't have permission to edit portals" + button disabled.
- Navigate to PA-POR-002 in EDIT mode at `/admin/portals/:code/edit`.

**On row action — History:**
- Navigate to PA-POR-003 at `/admin/portals/:code/history`, appending `?return_to=<current-url>`.

**On Add portal CTA:**
- Requires `portal-registry-write` capability.
- Navigate to PA-POR-002 in CREATE mode at `/admin/portals/new`.

**On keyboard shortcut:**
- `J` next row focus · `K` prev row · `Enter` open focused (View mode) · `E` edit focused · `H` history focused · `A` add new portal · `.` refresh · `?` open shortcuts sheet · `Esc` close modal / drawer / sheet.

**On Export CSV:**
- Fires `GET /api/admin/portals.csv?<same-query>`. Browser download. Includes all rows matching filter (not just current page). Columns: `code, display_name, country_codes, adapter_class_name, adapter_status, is_active, sla_hours, connected_agents_env, connected_agents_env_name, last_change_at, last_change_by`.

**On PA-NAV-001 env-change confirmation (while list is loaded):**
- No unsaved state to warn about on the list itself; confirm-cancel modal is skipped. Refetch counts only.

**On Refresh:**
- Fires the same query as page load. Shows a short "Portal registry refreshed." toast on completion.

**On row focus (keyboard):**
- Visible two-tone focus ring on the row. Row action shortcuts (E, H) act on the focused row.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial loading** | Page mount | Skeleton table (6 shimmer rows). Filter strip disabled. Env badge in top bar reflects current env. Add portal CTA disabled while loading. |
| **Ready — all-tab default** | Load complete, ≥1 portal | Table renders. All tab active. Row 1 focused for keyboard nav. |
| **Ready — LIVE tab** | Status tab change to LIVE | Table filters to `is_active=true` AND adapter status LIVE. Row-action Edit visible for PAs with write cap. |
| **Ready — STUB tab** | STUB rows only | Table filters to rows whose adapter file is absent OR base-class contract unmet. Rows always `Inactive`. Row-action Edit prominent (STUB rows are the "in-progress" queue). |
| **Ready — DEPRECATED tab** | Deprecated rows | Table filters to `is_active=false AND deprecated_at IS NOT NULL`. Active-only toggle disabled + forced off. |
| **Ready — empty catalog** | 0 rows in DB | Empty-state block with "Add first portal" primary CTA. |
| **Ready — empty filter** | Filter matches 0 rows | Simpler empty state with Clear-filters button. |
| **Search-no-results** | Search returns 0 | "No portals match your filters" + Clear-filters. |
| **Row hover** | Cursor enters row | Background swap + action buttons reveal. |
| **Row focus (keyboard)** | J/K nav | Two-tone focus ring; row action shortcuts (E/H) active. |
| **Env-switch loading** | PA-NAV-001 env change | Connected-count column shows shimmer skeleton for ~200ms while refetch completes. |
| **Insufficient permission (read)** | PA lacks `portal-registry-read` | Full-page block: "You need portal-registry read access to view this page." + link to PA home. |
| **Insufficient permission (write)** | PA has read but not write | Add portal CTA + row Edit actions disabled with tooltip; Row hover shows only View + History. |
| **Backend error 500** | GET fails | Destructive error banner with Retry. |
| **Session expired** | 401 | Redirect to `SHR-AUT-001` login with return-to param. |
| **RTL** | Locale = ar | Columns mirror; row-action buttons move to the left edge. Country ISO / SLA numerals stay LTR via bidi isolation. Adapter path stays LTR. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; adapter-status + active-status badge tints adjust automatically. |
| **TEST-env warning strip** | env=TEST | Persistent full-width warning strip renders under top bar. |
| **Loading — pagination** | Prev/next clicked | Table dim overlay + `--lc-duration-fast` while new page loads. |
| **Loading — filter/sort change** | Any filter or sort change | Same dim overlay pattern. |
| **Refresh toast** | Refresh completes | Short "Portal registry refreshed." toast. |
| **Adapter-file-missing hover** | Hover on STUB badge | Tooltip explains: "This portal has a registry row but no matching adapter file at backend/src/lib/notifications/portals/{code}.js. Ship the adapter via Cursor before activating." |

---

## Accessibility

- Page has a single `<h1>` "Portal registry". Filter strip labeled by `aria-label="Filter portal registry"`.
- Env badge in top bar has `aria-live="polite"` announcement on env switch ("Environment switched to TEST").
- TEST warning strip is `role="status"` with `aria-live="polite"` on entering TEST.
- Status tabs are `role="tablist"` + `role="tab"` — arrow keys navigate; Enter/Space activates.
- Table has `role="grid"` (J/K keyboard nav + row focus + inline row actions make it interactive). Each row `role="row"` + `tabindex="0"` when focused.
- Every column header labels its cell via `scope="col"`.
- Country chips per row are grouped via `role="list"` + each chip `role="listitem"` with `aria-label="{country} ({iso})"`.
- Adapter status badge + Active status badge announce their tint + glyph + label via SR (tint + glyph are decorative; label carries meaning).
- Row-action icon buttons have `aria-label` per action + portal name — e.g. "Edit Property Finder AE".
- Add portal CTA reachable via `A` keyboard shortcut + Tab.
- Modals + Sheets (keyboard-shortcut panel) trap focus + Esc to close.
- Toasts `role="status"` + `aria-live="polite"`.
- Focus visible via two-tone Broadcast focus ring on every interactive element (rows included).
- Every icon-only button (Refresh, `?`, prev, next, export, row actions) has an `aria-label`.
- Relative time ("2d ago") accompanied by full timestamp in `title` + tooltip on hover / focus.
- Row-height baseline 64px meets 44px tap-target with room; row-action buttons 44×44.
- Never rely on hover-only affordances for critical actions — Edit / History / View also reachable via keyboard shortcuts + Tab.
- Skip-to-content link at top of page (jumps past env badge + filter strip into table).

---

## Anti-patterns (do not do these)

- Do NOT allow inline `is_active` toggling from this list. Activation flips are two-person-rule + step-up + require adapter-file-existence check — they belong in PA-POR-002 activation form.
- Do NOT auto-refresh the list on the connected-agent count changes (would flicker under normal WhatsApp/portal churn); refresh is manual OR env-switch driven only.
- Do NOT display raw `portal_registry.id` UUIDs anywhere. `code` is the human handle.
- Do NOT hide the STUB adapter status. PAs need to see which rows are placeholders to plan Cursor dispatch.
- Do NOT color-code adapter-status without glyph + label — LIVE ● / STUB ○ / DEPRECATED ▢.
- Do NOT surface `publisher_config` JSONB contents on the list. That is detail-view territory (PA-POR-002); listing it here leaks credentials-adjacent config.
- Do NOT allow bulk-select / bulk-actions on this list. Portal-catalog changes are catalog-scale, not queue-scale — every change deserves a deliberate form pass in PA-POR-002.
- Do NOT reload the page on filter / tab / search / pagination changes. All updates via URL query params + client-side refetch.
- Do NOT allow deletion of a portal from the list. Deprecation via PA-POR-002 (marks `deprecated_at`); actual DB deletion requires migration + PA-AUD-001 audit trail preservation.
- Do NOT expose the raw `adapter_class_name` file path as a link. The list DISPLAYS the path for engineering-diagnostics visibility; navigating to backend source belongs in a separate developer console (not shipped in v1).
- Do NOT co-mingle LIVE and TEST connected-agent counts. Each env's counts render in that env's context only. Catalog identity (code, display_name, country_codes, adapter) is env-shared.
- Do NOT hide the env badge, even briefly. Badge is always visible per PA-NAV-001.
- Do NOT skip the two-tone focus ring on rows.
- Do NOT ship the mobile viewport as anything other than the "PA console requires a desktop screen" info block for v1.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Stripe Dashboard → Products → Product catalog** — dense catalog table with sortable columns + row-hover actions + create CTA in header.
- **AWS console → IAM → Roles list** — role-status badges + resource-count columns + last-activity secondary line pattern.
- **Vercel Dashboard → Integrations catalog** — provider-catalog card/list with implementation-status badges (Beta / GA / Deprecated) analogous to LIVE / STUB / DEPRECATED.
- **Zapier → Apps directory admin** — provider identity + coverage metadata + connected-count as first-class row data.
- **Notion → Integrations settings** — env-scoped connection counts alongside catalog-scoped identity.
- **PA-PKG-001 package list (WingCaster)** — direct pattern sibling; same shell, filters, header CTA, keyboard nav.
- **PA-MOD-001 portal moderation queue (WingCaster)** — filter-strip + keyboard-nav + env-badge patterns are shared.

Do NOT match:

- Salesforce object manager (over-dense, low-density-per-decision, too enterprise-noisy).
- Kanban / Trello (wrong tool for a catalog with fixed rows and no in-flight state).
- WordPress plugins page (over-loud plugin cards; wrong metaphor for a compact provider catalog).

---

## Backend contract

**List endpoint:** `GET /api/admin/portals`

**Query params:**
- `status` — `all` (default) | `live` | `stub` | `deprecated`
- `active` — `true` (default) | `false` | `all`
- `country` — comma-separated ISO codes (default all)
- `q` — search string (`code`, `display_name`, `adapter_class_name`; ≥2 chars server-side)
- `page` — integer, default 1
- `pageSize` — integer, default 25, max 100
- `sort` — `last_change:desc` (default) | `last_change:asc` | `code:asc` | `display_name:asc` | `connected:desc` | `country_count:desc`

**Response 200:**
```json
{
  "portals": [
    {
      "id": "por_01H7X…",
      "code": "property_finder_ae",
      "display_name": "Property Finder AE",
      "description": "Property Finder UAE — flagship agent portal for Dubai + Abu Dhabi listings.",
      "logo_url": "/assets/portals/property_finder_ae.svg",
      "country_codes": ["AE"],
      "primary_language": "en",
      "adapter_class_name": "portals/property_finder.js",
      "adapter_status": "live",
      "publisher_config": { "sla_hours": 6, "endpoint_env": "prod", "auth_secret_ref": "secrets/pf/ae/api_key" },
      "inbound_config": { "webhook_secret_ref": "secrets/pf/ae/webhook", "email_forward": "leads-pf-ae@in.wingcaster.io" },
      "validator_ref": "backend/src/lib/portal-validators/property_finder.js",
      "is_active": true,
      "current_version": 7,
      "connected_agents_env": 142,
      "connected_agents_env_name": "live",
      "connected_agencies_env": 21,
      "last_change_at": "2026-09-06T09:30:12Z",
      "last_change_by": {
        "id": "usr_admin_rania",
        "display_name": "Rania Farah"
      },
      "deprecated_at": null,
      "created_at": "2026-06-14T11:02:00Z",
      "updated_at": "2026-09-06T09:30:12Z"
    }
  ],
  "pagination": { "page": 1, "page_size": 25, "total": 12, "has_next": false },
  "counts": { "total": 12, "live": 4, "stub": 6, "deprecated": 2, "countries_covered": 9 }
}
```

**Single portal read:** `GET /api/admin/portals/:code` — used by PA-POR-002 view/edit modes.

**Create portal:** `POST /api/admin/portals` — see PA-POR-002 brief.

**Update portal:** `PATCH /api/admin/portals/:code` — see PA-POR-002 brief. `code` NEVER accepted in body (immutable).

**Activate portal:** `POST /api/admin/portals/:code/activate` — two-person-rule submit; requires second PA `POST /api/admin/portals/:code/activate/approve`. Server-side gate: adapter file exists AND validator file exists AND publisher_config passes shape validation. Step-up required.

**Deactivate portal:** `POST /api/admin/portals/:code/deactivate` — two-person-rule submit + approve pair. Step-up required.

**Deprecate portal:** `POST /api/admin/portals/:code/deprecate` — sets `deprecated_at` timestamp; must be preceded by `deactivate`.

**Activation history:** `GET /api/admin/portals/:code/history` — see PA-POR-003 brief.

**CSV export:** `GET /api/admin/portals.csv?<same-query>`.

**Prerequisites tracked / to file:**

- **`[BE-DESIGN-01]` ALREADY TRACKED in kickoff §5a.** Dynamic `portal_registry` table + `portal_registry_versions` versioning + CRUD routes + dynamic feature registration. Refines scope: this brief lists the full 8-endpoint surface above.
- **`[BE-VERIFY-11] Adapter-file existence check — NEW.** Backend must expose `adapter_status` derived from a boot-time + on-demand check of `backend/src/lib/notifications/portals/<code>.js` file existence AND base-class contract satisfaction (has `publish()`, `receiveInbound()` methods). ~1 day. **File as new `[BE-VERIFY-11]` in kickoff §5a.**
- **`[BE-VERIFY-12] Env-scoped connected-agents count — NEW.** Backend must compute `connected_agents_env` / `connected_agencies_env` scoped to `X-Wingcaster-Env` header. Confirm join between `portal_registry.id` and per-env `agent_portal_credentials` table. ~0.5-1 day. **File as new `[BE-VERIFY-12]` in kickoff §5a.**
- **`[BE-VERIFY-13] Portal logo asset pipeline — NEW.** Uploaded logos land at `/assets/portals/<code>.svg` served from CDN. Confirm upload flow via PA-POR-002 assets step. ~0.5 day.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/portals/PortalRegistryListPage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/admin/portals" element={<PortalRegistryListPage />} />` behind the `PAConsoleGuard` HOC (requires `portal-registry-read` capability).
- **Top-nav entry:** update PA top nav to add "Portals" (dropdown containing "Portal registry" → `/admin/portals` and "Moderation queue" → `/admin/moderation/portals`). Badge counter on top-nav "Portals" showing count of STUB rows if PA has `portal-registry-write`.
- **Component decomposition (aligns with PA-queue-family reusable primitives already reserved by PA-MOD-001):**
  - `PortalRegistryListPage.tsx` — page shell + data fetching + URL state + env context binding.
  - `PAQueueFilterStrip.tsx` — **REUSED from PA-MOD-001** — tabs + inline selects + search + refresh + export (add optional `primaryCta` slot for the Add portal button).
  - `PAQueueTable.tsx` — **REUSED** — table shell + row rendering slots + keyboard nav.
  - `PortalRegistryRow.tsx` — one row (portal identity, country chips, adapter, active, SLA, connected, last change, actions).
  - `PortalRegistryEmptyState.tsx` — empty-state variants (empty catalog + empty filter).
  - `PAQueueKeyboardShortcutsPanel.tsx` — **REUSED** — `?` sheet (populate with PA-POR shortcut set).
- **Data layer:**
  - Hook: `usePortalRegistryQuery({ status, active, country, q, page, pageSize, sort, env })` — SWR/React Query pattern; env-scoped counts.
  - Hook: `usePortalRegistryCounts()` — small poll for STUB-count top-nav badge (60s interval).
- **Test discipline:**
  - Unit: each sub-component renders + keyboard nav + filter state.
  - Integration: full page load + filter × tab-swap × row-click → PA-POR-002 view mode × Edit → PA-POR-002 edit mode × History → PA-POR-003 × Add portal → PA-POR-002 create mode.
  - Env-switch: LIVE-vs-TEST connected-count differs; catalog identity stable.
  - RTL: `screens.rtl.test.tsx` extension with the list in Arabic locale.
  - Broadcast: `no-raw-hex.test.ts` must stay green.
  - Accessibility: axe-core scan of loaded + empty + hover-row states.
- **Perf:**
  - Table virtualization not required for v1 (portal catalog is <100 rows at Phase-1 scale).
  - Skeleton must render within 100ms of route mount.
- **Copy/i18n:**
  - All strings in `web/src/locales/en/paPortalRegistry.json` + `ar/paPortalRegistry.json`. `[TRANSLATION-PENDING]` in AR for now.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable. (Delta briefs PA-POR-002 + PA-POR-003 reference THIS section.)

- Page shell background `var(--lc-bg-page)`; card / table shell on `var(--lc-surface-raised)`; header row on `var(--lc-surface-sunken)`.
- Env badge (PA-NAV-001) always visible in top bar; TEST warning strip full-width sticky under top bar.
- Page title `var(--lc-type-heading-1)`; subtitle `var(--lc-type-body-sm)` `var(--lc-text-muted)`.
- Column headers `var(--lc-type-overline)` (11px + 0.08em tracking) `var(--lc-text-muted)`.
- Row body text `var(--lc-type-body)` for portal display name, `var(--lc-type-data-sm)` for portal code + adapter path (mono), `var(--lc-type-caption)` for country chips + secondary lines.
- Every numeric — SLA hours, connected count, agencies count, page-size, pagination indices, counter badges — via `<Numeric>` (mono + tabular-nums).
- Adapter-status badges use `--lc-status-{published,draft,archived}-{bg,fg,dot}` + glyph (● / ○ / ▢) + label; never color-alone.
- Active-status badges use `--lc-status-{published,archived}-{bg,fg,dot}` + glyph + label ("Active" / "Inactive").
- Row hover `background: var(--lc-surface-sunken)` at `--lc-duration-fast`; row focus (via keyboard) shows the two-tone `--lc-focus-ring` + `--lc-focus-ring-contrast` ring — do NOT override.
- Row action buttons on hover: `<Button size="sm" variant="ghost">`; icons `Eye` / `Pencil` / `Clock` from lucide-react. Focus visible even without hover.
- Add portal CTA: `<Button variant="default">` fill `--lc-action-primary`, hover `--lc-action-primary-hover` (DARKER).
- Country chips: `<Badge variant="outline">` on `--lc-surface-raised`, border `--lc-border`, text `--lc-text-secondary`; flag emoji + ISO code.
- Portal logo: 32×32, `object-fit: contain`, `var(--lc-radius-md)`; fallback monogram uses `--lc-surface-sunken` fill + `--lc-text-secondary` initials.
- Empty-state illustration placeholder: `--lc-surface-sunken` fill, `border: 1px dashed var(--lc-border-strong)`, `var(--lc-radius-lg)`.
- Loading skeleton: `--lc-surface-sunken` blocks; shimmer opacity 0.6→1 at `--lc-duration-base` `--lc-easing-in-out infinite alternate`; disabled under `prefers-reduced-motion`.
- Motion: row hover `--lc-duration-fast`; add-CTA hover `--lc-duration-fast`; env-switch connected-count fade `--lc-duration-base`. NO signal-lamp motif.
- Radii: page card `var(--lc-radius-lg)`; filter chips + buttons `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`; portal logo `var(--lc-radius-md)`; country chips `var(--lc-radius-pill)`.
- Elevation: table shell `var(--lc-elevation-sm)`; keyboard sheet `var(--lc-elevation-lg)`; add-CTA no elevation (primary button owns its focal-weight from color).
- Focus rings: two-tone via base CSS — do not override.
- Never use `--lc-action-primary` as a row-hover fill; that token is reserved for action buttons and primary CTAs.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) portal registry list screen (PA-POR-001) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is the PA-managed catalog of external real-estate portals (Property Finder, Bayut, Dubizzle, Aqar, Wasalt, Aqarmap, OLX, and any new portal added on the fly) that WingCaster publishes to and receives leads from. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass: render the desktop 1440px layout with the LIVE env badge in the top bar (green), All tab active (counter 12), 12 sample rows (4 LIVE Property Finder variants, 6 STUB portals, 2 DEPRECATED), row 1 in hover state showing inline View/Edit/History icon buttons on the right. Add portal orange primary CTA in the top-right of the header.

LTR English only for this pass — I'll ask for RTL Arabic, dark mode, TEST env with warning strip, STUB-tab filter, empty state, and the keyboard-shortcuts drawer as separate follow-ups.

Follow the copy table in the brief exactly. Do NOT fabricate portal metrics not in the backend contract. Country lists must match the D19 PORTAL-LIST-LOCK from PORTAL_LIST_RESEARCH_2026-09-04.md.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now show the STUB-tab filter — 6 rows visible (Bayut UAE, Bayut KSA, Dubizzle UAE, Aqar KSA, Aqarmap Egypt, Wasalt KSA), all Inactive.`
2. `Now the empty state — 0 rows in the catalog. Show illustration placeholder + title + body + primary CTA "Add first portal →".`
3. `Now the same layout in TEST env — badge shows amber TEST + full-width warning strip under top bar; connected-agent count column shows TEST-env counts (all 0 for this sample).`
4. `Now the keyboard-shortcuts drawer open on the right side, listing J/K/Enter/E/H/A/./?/Esc.`
5. `Now RTL Arabic at desktop 1440px. Use [TRANSLATION-PENDING] where copy has no Arabic; MIRROR the whole layout including column order. Adapter path + portal code stay LTR via bidi isolation.`
6. `Now the dark mode version of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-POR-001/` + screenshot to `docs/design/mockups/PA-POR-001-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 6 iteration states (ready-all LIVE, STUB-tab, empty, TEST-env, keyboard drawer, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-POR-001/`.
- [ ] Cursor Wave-6 dispatch prompt references this brief + the mockup paths + the paired PA-POR-002 + PA-POR-003 briefs.
- [ ] `[BE-VERIFY-11..13]` adapter-file-existence check, env-scoped connected count, and portal-logo asset pipeline filed in kickoff §5a.
- [ ] Reusable component names (`PAQueueFilterStrip`, `PAQueueTable`, `PAQueueKeyboardShortcutsPanel`) reused unchanged from PA-MOD-001 registration.
