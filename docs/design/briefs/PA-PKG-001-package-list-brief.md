# Screen Brief — PA-PKG-001 · Package list (PA admin — pricing-tier catalog)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Anchor brief for the PA-PKG package-admin family.** Companion to `SCREEN_MATRIX_PA.md` §6 entries `PA-PKG-001..007` (renamed/rescoped to a Rev-6 four-screen slate per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §11a) and to Cursor prompt `docs/prompts/CURSOR_PA_PACKAGE_EDIT_UI.md`. Establishes the reusable Platform-Admin package-management shell that inherits into:

- `PA-PKG-002-package-edit-brief.md` — DRAFT version editor (delta).
- `PA-PKG-003-approval-queue-brief.md` — pending-approval queue + detail (delta, ALSO inherits the PA-queue-family Broadcast callout block from `PA-MOD-001-portal-moderation-queue-brief.md`).
- `PA-PKG-004-version-history-brief.md` — full version timeline (delta).

Wave 3.5 (Week 6 per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 6 §6 + §11a) — pulled forward from Phase-2 backlog so the marketing site (`wingcaster.com/pricing`) can render PA-editable tiers instead of static config. Backend prerequisite is `CURSOR_PACKAGES_MARKETING_FIELDS.md` (marketing-display column extension on `product_package_versions`) + the admin routes added in the same Cursor prompt.

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts (referenced by PA-PKG-002/003/004 — keep complete here):**

- **PA admin shell context.** Page renders inside the PA console shell — `SHR-NAV-001` top bar with the PA-NAV-001 env badge always visible. PA console has no side drawer in v1; PA uses top-nav routes. Page shell background `var(--lc-bg-page)`; content max-width 1440px with `padding-inline: var(--lc-space-2xl)`.
- **Env badge (PA-NAV-001) is ALWAYS visible in the top bar.** When PA is in TEST, the persistent full-width warning strip (`--lc-status-warning` fill + white ink, sticky under the top bar per PA-NAV-001 §Layout) offsets the page's sticky sub-header down by `var(--lc-nav-warning-strip-height)` (24px). LIVE mode: no warning strip; badge alone.
- **Env-scoped data.** The package list fetches scoped to the current env — LIVE-vs-TEST catalogs NEVER co-mingle; `X-Wingcaster-Env` header binds every list + write. Env switch mid-session refetches automatically (no stale rows visible for the wrong env). Prices, feature quotas, and approval history are per-env — a version approved in TEST is NOT auto-promoted to LIVE.
- **Page title ("Packages"):** `font: var(--lc-type-heading-1)` (600 26/32 IBM Plex Sans) — NOT display-tier; admin workspace, not marketing.
- **Section subtitle / package-count line:** `font: var(--lc-type-body-sm)`, `color: var(--lc-text-muted)`. Numeric run wrapped in `<Numeric>` — e.g. `<Numeric>7</Numeric> active packages · <Numeric>2</Numeric> drafts · <Numeric>1</Numeric> pending approval · Last change <Numeric>4h</Numeric> ago`.
- **Filter chip strip (Active-only · Sort · Search):** `<Tabs>` for status filter (Active default | All including inactive), `<Select>` for sort (`sort_order` default | Monthly price asc | Monthly price desc | Property cap asc | Recently changed), `<Input>` with `Search` lucide icon for display-name / tagline substring search. Chip strip on `var(--lc-surface-raised)` with `border-bottom: 1px solid var(--lc-border)`.
- **Primary CTA ("New package"):** `<Button variant="default">` — `--lc-action-primary` fill; hover DARKENS to `--lc-action-primary-hover`. Sits in the right slot of the header block. Opens a small modal to seed a brand-new package `code + display_name + tier + currency`, which on save opens PA-PKG-002 as a fresh DRAFT v1. Modal follows the seed-then-edit split from matrix `PA-PKG-003` (renumbered into the anchor per §11a scope).
- **Table shell:** `<Table>` primitive. Header row `background: var(--lc-surface-sunken)`, header text `var(--lc-type-overline)` + `color: var(--lc-text-muted)`. Body rows on `var(--lc-surface-raised)` separated by `border-bottom: 1px solid var(--lc-border)`. Row hover `background: var(--lc-surface-sunken)` at `--lc-duration-fast`.
- **Package cell (display_name + tagline):** primary line = display_name `var(--lc-type-body)` `--lc-text-primary`; secondary = tagline (marketing single-line, from `product_package_versions.tagline`) `var(--lc-type-caption)` `--lc-text-muted`, truncated at ~64ch with ellipsis + `<Tooltip>` on hover for the full string. If the ACTIVE version has no tagline (or tagline is NULL for a not-yet-published package), render placeholder `<span data-placeholder>Add tagline in the next version</span>` in `--lc-text-muted` italic.
- **Version cell:** current ACTIVE version number in mono `<Numeric>` — e.g. `v3` — with `effective_from` date secondary line in `var(--lc-type-caption)` `--lc-text-muted`. If a DRAFT or PENDING_APPROVAL version exists on this package, render a small `<Badge>` beneath: DRAFT `--lc-status-draft-{bg,fg,dot}` + ○ + "Draft v4"; PENDING_APPROVAL `--lc-status-warning-{bg,fg,dot}` + ▲ + "Pending v4". Clicking the DRAFT badge deep-links to PA-PKG-002 editor; clicking PENDING_APPROVAL deep-links to PA-PKG-003 detail.
- **Price cell:** monthly + annual price, each in `<Numeric>` mono, format `$29.00 / mo` and `$290 / yr` (dollar sign + amount, minor-unit conversion done client-side). Effective monthly (annual / 12) shown in `var(--lc-type-caption)` `--lc-text-muted` beneath annual — e.g. `$24.17 / mo`. USD only in v1 per Cursor prompt §7; multi-currency is Phase-2.
- **Property cap cell:** integer via `<Numeric>` — e.g. `50 properties`. `null` → "Unlimited" label (no numeric). Small trend chip in `var(--lc-type-caption)` `--lc-text-muted` if the cap changed from the immediately-prior ACTIVE version — e.g. `↑ from 25` or `↓ from 100`. Drives one of the two-person-approval triggers (see PA-PKG-002 + PA-PKG-003).
- **Agent cap cell:** integer via `<Numeric>`; `null` → "Unlimited"; same delta chip pattern as property cap for changes from prior ACTIVE.
- **Status pill:** `<Badge>` — `active` `--lc-status-published-{bg,fg,dot}` + ● + "Active"; `inactive` `--lc-status-archived-{bg,fg,dot}` + ▢ + "Inactive"; `deprecated` (no ACTIVE version exists but historic versions do) `--lc-status-closed-{bg,fg,dot}` + ◆ + "Deprecated". Always tint + glyph + label.
- **Sales-led badge (secondary):** `<Badge variant="outline">` "Sales-led" using `--lc-accent-bold-edge` outline + `--lc-accent-bold` text when `sales_led=true` on the ACTIVE version. Signals the tier is not self-serve; downstream marketing site renders a "Contact sales" CTA instead of a checkout button.
- **Row action buttons (on hover):** `<Button size="sm" variant="outline">` — `View` (opens PA-PKG-004 version history for that package, from which any version is read-only browsable), `New draft` (opens PA-PKG-002 as a fresh DRAFT copied from the current ACTIVE — prefills every marketing field for editing). If a DRAFT already exists, `New draft` swaps to `Edit draft` and deep-links to that DRAFT in PA-PKG-002. If a PENDING_APPROVAL version exists, both actions are disabled with a `<Tooltip>`: "A version of this package is pending approval — resolve it first in the approvals queue."
- **Pagination footer:** `var(--lc-type-body-sm)`, `var(--lc-text-muted)`, page numerals in `<Numeric>`. Default page size 25; max 100. In practice a healthy WingCaster catalog is <20 packages (Semsar / Boutique / Small Team / Growth / Enterprise etc.), so pagination is a formality.
- **Empty state block:** centered stack, illustration placeholder (`--lc-surface-sunken` 200px square, `border: 1px dashed var(--lc-border-strong)`), title `var(--lc-type-heading-3)`: "No packages in this environment yet.", body `var(--lc-type-body)` `--lc-text-muted`: "Seed the catalog from the New package button — you'll be walked into the version editor.", primary CTA `<Button variant="default">` "New package".
- **Loading skeleton:** 6 shimmering rows using `--lc-surface-sunken` block with subtle animation at `--lc-duration-base ease-in-out infinite alternate`; respects `prefers-reduced-motion`.
- **Focus rings:** two-tone via base CSS — do NOT override. Table rows are focusable (`tabindex="0"`) so J/K keyboard navigation lands a visible focus ring.
- **Radii:** table container `var(--lc-radius-lg)`, filter chips `var(--lc-radius-md)`, buttons `var(--lc-radius-md)`, badges `var(--lc-radius-pill)`.
- **Motion:** row hover `--lc-duration-fast`; status pill swap after inline action `--lc-duration-base` `--lc-easing-in-out`; env-switch refetch `--lc-duration-base` fade; NO signal-lamp motif (reserved for "listing went live").
- **Numeric fields — every price, cap, version number, feature quota, page index, badge counter uses `<Numeric>` or `.lc-data`.** Enforced by `--lc-font-mono` + `tabular-nums`.
- **PA-PKG-family invariants (inherited by PA-PKG-002/003/004):**
  1. Env badge always visible; env-scoped data.
  2. DRAFT is the ONLY editable state — ACTIVE and DEPRECATED are read-only forever (edits create a new DRAFT copy).
  3. Only one ACTIVE version per package per env at a time — approving a new version DEPRECATES the prior ACTIVE atomically.
  4. Only one DRAFT-or-PENDING per package per env at a time — no parallel drafts; UI disables `New draft` when one exists.
  5. Two-person approval REQUIRED when the diff vs current ACTIVE includes price (monthly OR annual) OR property_cap changes. Otherwise single-approver flow (submitter can also approve after a cooling-off configured via `CFG PACKAGE_SINGLE_APPROVER_COOLDOWN_MINUTES`).
  6. Every action writes to immutable audit (PA-AUD-001).
  7. On approve, backend fires `triggerMarketingRevalidate('pricing-tiers')` — non-blocking; approve returns success even if marketing site is unreachable, but a WARN toast surfaces client-side after 5s if the revalidation confirmation ping never returns.
  8. `If-Match` precondition on every write (uses `version.updated_at`) — concurrent edits get 412 with a "Someone else just edited this — reload to pick up their changes" toast.

---

## Meta

| | |
|---|---|
| Screen ID | PA-PKG-001 |
| Screen name | Packages (PA admin) |
| Persona | PA (Platform Admin — `platform_role === 'platform_admin'`; elevated writes require step-up per SHR-MFA-007 on approve action, not on list/browse) |
| Device targets | Desktop 1440px ONLY — PA console is desktop-first per matrix (no tablet/mobile fallback for v1; render "PA console requires a larger screen" info block on <1024px) |
| Locale | English + Arabic (RTL) — both mandatory. PA console defaults to English for global admins; Arabic supported for MENA-based admins. |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/packages` (query params: `?filter=active\|all`, `?sort=sort_order\|price_asc\|price_desc\|cap_asc\|recent`, `?q=<display-name-substring>`, `?page=<n>`) |
| Current state | PARTIAL — legacy `Packages.tsx` (matrix `PA-PKG-001`) at `/admin/fin/packages` exists but predates the marketing-field extension. This brief SUPERSEDES that route with the Cursor-prompt `/admin/packages` shell + marketing-field columns. Legacy `Packages.tsx` should be redirected to the new route or removed in the same PR. |
| Workflow role | WF-07 (Package publishing) role = Composition / Index |
| Backend prerequisites | ⏳ `[BE-DESIGN-01]` dynamic package fields + admin routes per Cursor prompt §2.1 — `GET /api/admin/packages/`, `GET /:id`, `GET /:id/versions/:version` (list + read endpoints for PA-PKG-001..004). ⏳ Marketing-display column extension on `product_package_versions` (from `CURSOR_PACKAGES_MARKETING_FIELDS.md`) — tagline, display_name, portal_group, feature_quotas JSONB, feature_toggles JSONB, support_level. ✅ PA-NAV-001 env context. ✅ SHR-MFA-007 step-up. ⏳ `[BE-VERIFY-11] Env-scoped package catalog — NEW.` Confirm the `/api/admin/packages` route respects `X-Wingcaster-Env` header and NEVER returns cross-env rows. ~0.5 day audit. **File in kickoff §5a.** |
| Cluster | Wave 3.5 (Week 6 per §6 + §11a — one PR with PA-PKG-001..004 + PA-POR-001..003 in a companion PR) |

---

## Purpose

Platform Admin lands on `/admin/packages` when they need to:

1. **See at a glance what tiers WingCaster currently sells** in the current env. Display name, tagline, monthly + annual price, property cap, agent cap, status — one row per package.
2. **Spot in-flight edits.** A DRAFT or PENDING_APPROVAL badge on any package row tells the admin that work is underway. Clicking either badge deep-links to the correct next screen (PA-PKG-002 for DRAFT, PA-PKG-003 for PENDING_APPROVAL).
3. **Open the version editor for a new change.** `New draft` copies the ACTIVE version's fields into a fresh DRAFT and drops the admin into PA-PKG-002 already prefilled — the shortest path from "we need to bump the Semsar price by $5" to a submittable change.
4. **Audit history.** `View` opens PA-PKG-004 (version history) for the row — every past + present version of that package, with the diff-summary per version and click-to-read-only detail.
5. **Seed a brand-new package.** `New package` opens a small modal to capture the immutable seed fields (`code`, `display_name`, `tier`, `currency`, `billing_cadence`) and then hands off to PA-PKG-002 as a fresh v1 DRAFT to compose caps + prices + feature quotas + toggles.

Success outcome: PA leaves `/admin/packages` having either (a) seen the catalog and moved on, or (b) landed in PA-PKG-002 with the right DRAFT ready to edit, or (c) landed in PA-PKG-003 to approve/reject a pending peer submission, or (d) landed in PA-PKG-004 to inspect a specific historical version. The marketing site's public API (`GET /api/pricing/tiers`) reflects any ACTIVE-version change within ~5 seconds of an approve via the on-approve revalidation dispatch (Cursor prompt §2.6).

---

## Design goals

1. **Catalog density.** Full active-package catalog visible without scrolling for a healthy WingCaster shape (5-10 packages). Every column earns its place — price, caps, status are the fields PA actually needs to decide "do I need to change something here?".
2. **In-flight edits are impossible to miss.** DRAFT + PENDING badges on the version cell make the "somebody's working on this" state loud without cluttering the ACTIVE-version display.
3. **One click to the next screen.** Row → PA-PKG-004 history OR badge → PA-PKG-002 editor OR badge → PA-PKG-003 approval. No intermediate "package detail" wrapper in the Rev-6 four-screen slate — the row IS the summary; deeper drilldown goes to the appropriate specialized screen.
4. **Env-context is unambiguous.** Env badge always visible; TEST persistent warning strip runs across the page. Rows tagged with tenant-env; LIVE-vs-TEST catalogs never co-mingle.
5. **No color-only status differentiation** — Active / Inactive / Deprecated pills use tint + glyph + label per Broadcast rule.
6. **Family-pattern anchor.** This page's shape (env badge → title → sub-count → filter strip → primary CTA → table → pagination) is the reusable PA-PKG shell. PA-PKG-002 (editor), PA-PKG-003 (approval queue + detail), PA-PKG-004 (version history) all inherit this Broadcast callout block + the invariant list unchanged.
7. **Keyboard-friendly (opt-in).** J/K row nav, Enter opens PA-PKG-004 history, N opens New package modal, D opens New draft on the focused row, ? shortcut sheet. Full parity with PA-MOD-001 keyboard rig is NOT required (this is a browse-plus-launch surface, not a triage queue), but the same shortcuts DO the equivalent things where they apply.

---

## Layout

### Desktop 1440px (primary and only target for v1)

Single-column stack inside the PA console shell (SHR-NAV-001 top bar with PA-NAV-001 env badge; PA console has no side drawer in v1):

**PA-NAV-001 persistent warning strip (conditional — appears when env=TEST):**
- Full-width, sticky under top bar, 24px tall, `--lc-status-warning` fill + white ink, copy "TEST ENVIRONMENT — changes here do not appear on wingcaster.com/pricing."
- LIVE mode: no strip; content starts directly under top bar.

**Header block (sticky under top bar + optional TEST strip):**
- Left: page title "Packages" (`var(--lc-type-heading-1)`) + subtitle "<Numeric>N</Numeric> active · <Numeric>D</Numeric> drafts · <Numeric>P</Numeric> pending approval · Last change <Numeric>T</Numeric>" (`var(--lc-type-body-sm)` `--lc-text-muted`).
- Right: `New package` primary CTA + `?` keyboard-hints toggle (icon-only button).

**Filter strip (sticky):**
- Row 1: status tabs — `Active only` (default active) / `All including inactive`. Each tab shows a counter — `Active <Numeric>7</Numeric>` / `All <Numeric>9</Numeric>`.
- Row 2: two inline filter selects + search — `Sort` (Select — Default order [sort_order] / Monthly price asc / Monthly price desc / Property cap asc / Recently changed), search `<Input>` with `Search` icon prefix — placeholder "Search display name or tagline…", debounced 200ms.

**Table:**
- Columns (desktop, left-to-right in LTR; mirror in RTL):
  1. Package — display_name + tagline secondary line
  2. Version — current ACTIVE `vN` + effective_from date + DRAFT / PENDING badges if any
  3. Price — monthly + annual (with effective-monthly hint) + Sales-led badge if `sales_led=true`
  4. Property cap — integer or "Unlimited" + trend chip if changed vs prior ACTIVE
  5. Agent cap — integer or "Unlimited" + trend chip if changed
  6. Status — Active / Inactive / Deprecated pill
  7. Row actions (visible on hover) — `View` / `New draft` (or `Edit draft` if one exists; both disabled if pending)
- Row height ~72px (tagline second line + version + delta chips comfortably vertical).
- Row click (anywhere except row-action buttons or badge links) → navigate to `PA-PKG-004` at `/admin/packages/:id/history`, preserving current query params in a `return_to` param for back-navigation.
- Row focus state via keyboard (J/K cycles through rows).
- Sticky column header while table scrolls.

**Pagination footer:**
- Right-aligned: `<Numeric>1–7</Numeric> of <Numeric>7</Numeric>` + prev / next buttons + `<Select>` page-size (25 default, 50, 100).

### New-package modal (from `New package` CTA)

`<Dialog>` (700px wide, `--lc-elevation-lg`). Title "Create a new package". Body: single-column form.

- **Code** (`<Input>`, immutable after creation — helper text "URL-safe, lowercase, dashes only. Used in the marketing URL, cannot change."). Real-time validation: `/^[a-z0-9\-]+$/`, unique per env server-side.
- **Display name** (`<Input>`, marketing-facing) — helper "Shown on wingcaster.com/pricing".
- **Tier** (`<Select>` — Semsar / Boutique / Small Team / Growth / Enterprise). Drives sort_order default + support-level defaults in PA-PKG-002.
- **Currency** (`<Select>` — USD only in v1 per Cursor prompt §7; select is present but locked with `<Tooltip>` "Multi-currency in Phase 2").
- **Billing cadence** (`<Select>` — Monthly + Annual [default] / Monthly only / Annual only).
- Footer: `Cancel` (secondary) + `Create and edit` (primary, `--lc-action-primary` fill). Primary CTA fires `POST /api/admin/packages` with the seed fields → server returns the new package with a fresh v1 DRAFT → client redirects to `PA-PKG-002` at `/admin/packages/:id/versions/1/edit`.

### Empty state (0 packages in env)

Centered stack in the table area:
- Illustration placeholder (200px square, `--lc-surface-sunken`, dashed `--lc-border-strong`) — label "Illustration — empty catalog".
- Title (`var(--lc-type-heading-3)`): "No packages in this environment yet."
- Body (`var(--lc-type-body)` `--lc-text-muted`): "Seed the catalog from the New package button — you'll be walked into the version editor. Every marketing field, cap, price, feature quota, and toggle lives inside the version editor."
- Primary CTA (`<Button variant="default">`): "New package" — opens the same modal as the header CTA.
- Secondary link (`<Button variant="ghost">`): "Copy from LIVE →" — visible only when env=TEST and the LIVE env has packages. Fires a bulk-import handshake (server-side; `POST /api/admin/packages/import-from-live`) — copies each LIVE package's current ACTIVE version as a fresh v1 DRAFT in TEST. Convenience shortcut for QA/staging setup. **This handshake requires `[BE-VERIFY-11]` + a new endpoint — file as `[BE-DESIGN-04] Cross-env package clone helper — NEW.` in kickoff §5a; ~1 day backend; not blocking for v1 if TEST catalog is seeded manually.**

### Search-no-results state

Simpler: title "No packages match '{q}' in the {Active-only|All} filter." + Clear search link.

### Below-min-viewport fallback (<1024px)

Full-page info block: "PA console requires a desktop screen (1024px or wider)." + link back to `SHR-NAV-001` home. Do NOT attempt a mobile-optimized package list.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Page title | Packages |
| Subtitle template | {N} active · {D} drafts · {P} pending approval · Last change {T} |
| TEST-env warning strip | TEST ENVIRONMENT — changes here do not appear on wingcaster.com/pricing. |
| Status tab — active-only | Active only |
| Status tab — all | All including inactive |
| Filter — sort label | Sort |
| Filter — sort options | Default order · Monthly price ↑ · Monthly price ↓ · Property cap ↑ · Recently changed |
| Search placeholder | Search display name or tagline… |
| Keyboard hints button aria-label | Show keyboard shortcuts |
| Primary CTA | New package |
| Keyboard hints panel title | Keyboard shortcuts |
| Shortcut — navigate down | `J` — next package |
| Shortcut — navigate up | `K` — previous package |
| Shortcut — open history | `Enter` — open version history |
| Shortcut — new draft on focused | `D` — new draft for focused package |
| Shortcut — new package | `N` — new package |
| Shortcut — refresh | `.` — refresh catalog |
| Shortcut — close | `Esc` — close modal / clear focus |
| Column — package | Package |
| Column — version | Current version |
| Column — price | Price |
| Column — property-cap | Property cap |
| Column — agent-cap | Agent cap |
| Column — status | Status |
| Row action — view | View history |
| Row action — new-draft | New draft |
| Row action — edit-draft | Edit draft |
| Version cell — draft badge | Draft v{N} |
| Version cell — pending badge | Pending v{N} |
| Version cell — effective from | Effective {DATE} |
| Price cell — monthly template | ${amount} / mo |
| Price cell — annual template | ${amount} / yr |
| Price cell — effective-monthly helper | ${effective} / mo effective |
| Sales-led badge | Sales-led |
| Cap cell — unlimited | Unlimited |
| Cap cell — trend up | ↑ from {prior} |
| Cap cell — trend down | ↓ from {prior} |
| Status — active | Active |
| Status — inactive | Inactive |
| Status — deprecated | Deprecated |
| Row action disabled tooltip (pending exists) | A version of this package is pending approval — resolve it first in the approvals queue. |
| New-package modal title | Create a new package |
| New-package modal — code label | Package code |
| New-package modal — code helper | URL-safe, lowercase, dashes only. Used in the marketing URL — cannot change. |
| New-package modal — code error format | Only lowercase letters, digits, and dashes. |
| New-package modal — code error taken | A package with this code already exists in this environment. |
| New-package modal — name label | Display name |
| New-package modal — name helper | Shown on wingcaster.com/pricing. |
| New-package modal — tier label | Tier |
| New-package modal — tier options | Semsar · Boutique · Small Team · Growth · Enterprise |
| New-package modal — currency label | Currency |
| New-package modal — currency locked tooltip | Multi-currency in Phase 2. |
| New-package modal — cadence label | Billing cadence |
| New-package modal — cadence options | Monthly + Annual · Monthly only · Annual only |
| New-package modal — confirm | Create and edit |
| New-package modal — cancel | Cancel |
| Empty catalog — title | No packages in this environment yet. |
| Empty catalog — body | Seed the catalog from the New package button — you'll be walked into the version editor. Every marketing field, cap, price, feature quota, and toggle lives inside the version editor. |
| Empty catalog — CTA | New package |
| Empty catalog — copy-from-live | Copy from LIVE → |
| Search-no-results — title | No packages match '{q}' in the {filter} filter. |
| Search-no-results — clear | Clear search |
| Loading | Loading packages… |
| Env-switch loading | Switching to {env}. Reloading catalog… |
| Error banner | Couldn't load packages. Try again. |
| Retry button | Retry |
| Pagination template | {start}–{end} of {total} |
| Page-size label | Rows per page |
| Concurrent-edit toast | Someone else just edited this — reload to pick up their changes. |
| Reload CTA | Reload catalog |
| Below-min-viewport title | PA console requires a desktop screen (1024px or wider). |
| Below-min-viewport CTA | ← Back to home |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Page title | plain `<h1>` with `--lc-type-heading-1` |
| Env badge | Embedded `PA-NAV-001` component (top bar) |
| TEST warning strip | `PA-NAV-001` persistent-strip subcomponent |
| Status tabs | `Tabs` + `TabsList` + `TabsTrigger` |
| Sort picker | `Select` + `SelectItem` |
| Search input | `Input` with `Search` icon (lucide) as prefix |
| Primary CTA | `Button variant="default"` |
| Keyboard hints button | `Button variant="ghost" size="icon"` + `HelpCircle` icon |
| Table | `Table` + `TableHeader` + `TableRow` + `TableCell` |
| Package cell (name + tagline) | plain markup with `<Numeric>`-wrapped elements where numeric |
| Version cell | text + `<Numeric>` for version number + `Badge` for DRAFT/PENDING |
| Price cell | `<Numeric>` for amounts + `<Badge variant="outline">` for Sales-led |
| Cap cells | `<Numeric>` for integer + text for "Unlimited" + trend chip |
| Status pill | `<Badge>` variant per status with glyph prefix |
| Row action buttons | `Button size="sm" variant="outline"` |
| Row action disabled tooltip | `Tooltip` |
| Pagination controls | `Button variant="ghost" size="icon"` for prev/next + `Select` for page size |
| New-package modal | `Dialog` |
| Modal fields | `Input`, `Select`, `Textarea` where needed |
| Empty-state CTAs | `Button variant="default"` + `Button variant="ghost"` |
| Loading skeleton | Custom skeleton rows using `--lc-surface-sunken` blocks |
| Error banner | Custom `<div>` with `AlertTriangle` icon, `--lc-status-danger-bg` background |
| Toast (concurrent-edit + error) | `Sonner` toast |
| Keyboard hints panel | `Sheet` (right-side drawer) triggered by `?` key or button |
| Icons | `lucide-react` — `Search`, `Plus`, `Eye`, `Edit`, `RefreshCw`, `HelpCircle`, `AlertTriangle`, `ChevronLeft`, `ChevronRight`, `ChevronDown`, `ArrowUp`, `ArrowDown`, `ExternalLink` |
| Numeric renders | `<Numeric>` primitive |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:

- **Env:** LIVE (green badge, no warning strip).
- **Header:** "Packages" title, subtitle "7 active · 1 draft · 1 pending approval · Last change 4h ago". `New package` primary CTA visible top-right, `?` icon-only button beside it.
- **Filter strip:** `Active only` tab active (counter 7), `All including inactive` tab (counter 9); Sort `Default order`; search empty.
- **Table with 7 sample rows (all Active):**
  1. **Semsar** / *Get started free — everything a solo agent needs to test the water* · v4 · Effective 2026-08-01 · $0 / mo · $0 / yr · 5 properties · 1 agent · Active
  2. **Boutique** / *For solo agents ready to grow into a small brand* · v3 · Effective 2026-07-14 · $29 / mo · $290 / yr ($24.17 / mo effective) · 25 properties · 1 agent · Active
  3. **Small Team** / *Two to five agents sharing a listing pool and inbox* · v6 (with **Pending v7** badge in warning-amber) · Effective 2026-06-02 · $99 / mo · $990 / yr ($82.50 / mo effective) · 100 properties · 5 agents · Active
  4. **Growth** / *Mid-market agency with dedicated portal quotas and priority chat* · v2 · Effective 2026-05-20 · $249 / mo · $2,490 / yr ($207.50 / mo effective) · 500 properties (↑ from 250) · 15 agents · Active
  5. **Growth+** / *Growth tier plus premium portal quotas and dedicated onboarding* · v1 (with **Draft v2** badge in draft-slate) · Effective 2026-05-20 · $399 / mo · $3,990 / yr ($332.50 / mo effective) · 750 properties · 25 agents · Active
  6. **Enterprise** / *Custom-scoped for national brokerages — contact us to configure* · v3 · Effective 2026-03-10 · Sales-led badge · $— / mo · $— / yr · Unlimited · Unlimited · Active
  7. **Enterprise+** / *Global brokerage tier — dedicated Slack, dedicated success manager* · v2 · Effective 2026-01-04 · Sales-led badge · $— / mo · $— / yr · Unlimited · Unlimited · Active
- **Row 3 (Small Team) in hover state:** row background `--lc-surface-sunken`, row-action buttons `View history` + `Edit draft` (disabled with tooltip "A version of this package is pending approval — resolve it first in the approvals queue.") visible on the right.
- **Pagination footer:** "1–7 of 7" · prev disabled · next disabled · Rows per page 25.
- **Three side variants to screenshot as separate v0 iterations:**
  - **New-package modal open** on top of the pass-1 catalog. Form filled: code `growth-plus-mena`, display name `Growth+ MENA`, tier Growth, currency USD, cadence Monthly + Annual.
  - **TEST env** state: amber TEST badge + full-width warning strip under top bar; Empty state (0 packages) visible with `Copy from LIVE →` secondary link showing.
  - **All including inactive** tab active: 9 rows including 2 with `Deprecated ◆` status pill.

Do NOT fabricate MRR, subscriber counts, revenue-per-package, or any figure the backend doesn't return. Every field above corresponds to a real payload attribute from §Backend contract.

---

## Interactions

**On page load:**
- Fetch `GET /api/admin/packages?filter=active&sort=sort_order&page=1&pageSize=25` scoped to current env (X-Wingcaster-Env header per PA-NAV-001).
- In parallel, fetch a lightweight `HEAD` or lightweight `GET /api/admin/packages/counts` for the tab counters + subtitle counts (or derive from the list response if backend includes counts inline — see §Backend contract).
- Show 6-row skeleton while loading.
- On success: render table. On error: show error banner with Retry.

**On env-switch (PA-NAV-001 event):**
- Show "Switching to {env}. Reloading catalog…" toast.
- Refetch in new env. Clear all filters back to defaults (filter=active, sort=default). Reset page to 1.
- Preserve search string? No — env-switch is a hard context reset for safety.

**On status tab change:**
- Update `?filter=<x>` in URL (`history.pushState`, no reload).
- Refetch with new filter. Reset page to 1.
- Table re-renders with `--lc-duration-fast` fade transition.

**On sort change / search input:**
- Update the relevant URL param.
- Refetch. Reset page to 1. Search debounced 200ms.

**On row hover:**
- Row background swaps to `--lc-surface-sunken` at `--lc-duration-fast`.
- Row action buttons (`View history` + `New draft` OR `Edit draft`) fade in at the right edge.
- Cursor becomes `pointer`.

**On row click (anywhere except row-action buttons or badge links):**
- Navigate to `PA-PKG-004` at `/admin/packages/:id/history`, appending `?return_to=<current-url>` for back-navigation.

**On DRAFT badge click:**
- Navigate to `PA-PKG-002` at `/admin/packages/:id/versions/:draftVersion/edit`, appending `?return_to=<current-url>`.

**On PENDING badge click:**
- Navigate to `PA-PKG-003` detail at `/admin/packages/approvals/:versionId`, appending `?return_to=<current-url>`.

**On `New draft` row action:**
- Fires `POST /api/admin/packages/:id/versions` with an empty body — backend seeds a fresh DRAFT copied from the current ACTIVE version's fields.
- Optimistic: row's version cell shows a `Draft v{N+1}` badge instantly.
- On success: navigate to PA-PKG-002 with the returned draft version number.
- On conflict (409 — another DRAFT already exists on this package): show toast "A draft already exists for this package — opening it" + navigate to that existing draft.

**On `Edit draft` row action (shown when DRAFT exists):**
- Directly navigate to `PA-PKG-002` at `/admin/packages/:id/versions/:draftVersion/edit`.

**On `New package` primary CTA:**
- Opens the New-package Dialog. Focus autofocuses the `code` field.
- Real-time validation on code: format + uniqueness (uniqueness debounced 300ms).
- Confirm disabled until code + display_name + tier + cadence all valid.
- Confirm fires `POST /api/admin/packages` with the seed fields → server returns `{ package_id, draft_version: 1 }` → client navigates to `PA-PKG-002` at `/admin/packages/:package_id/versions/1/edit`.

**On `Copy from LIVE` (TEST env only, empty state):**
- Opens a small confirm AlertDialog "Copy all LIVE packages into TEST as fresh v1 drafts?" — copy explains "You'll get one DRAFT per LIVE package, prefilled from that package's current ACTIVE version. You can edit each and submit for TEST approval separately."
- Confirm fires `POST /api/admin/packages/import-from-live` (requires `[BE-DESIGN-04]`). On success: refetch catalog + toast "Copied {N} packages — each now has a v1 DRAFT in TEST."

**On keyboard shortcut:**
- `J` next row focus · `K` prev row · `Enter` open version history for focused row · `D` new draft for focused row · `N` open new-package modal · `.` refresh · `?` open shortcuts sheet · `Esc` close modal / drawer / clear focus.

**On PA-NAV-001 env-change confirmation:**
- If the New-package modal is open, PA-NAV-001 asks "Discard unsaved package draft and switch env?" — Cancel keeps modal + env; Confirm closes modal + refetches in new env.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial loading** | Page mount | Skeleton table (6 shimmer rows). Filter strip + primary CTA disabled. Env badge in top bar reflects current env. |
| **Ready — active-only default** | Load complete, ≥1 active | Table renders. Active-only tab active. Row 1 focused for keyboard nav. |
| **Ready — all including inactive** | Tab change | Same shell; deprecated + inactive rows interleaved by sort order; row-action `New draft` remains available on inactive rows (reactivation via a new version is legitimate). |
| **Ready — empty catalog (LIVE)** | 0 rows in LIVE | Empty-state block; primary `New package` CTA emphasized; no `Copy from LIVE` link (LIVE is source-of-truth). |
| **Ready — empty catalog (TEST)** | 0 rows in TEST | Same empty-state block PLUS the `Copy from LIVE →` secondary link when LIVE has ≥1 package (server hint in the list response). |
| **Search-no-results** | Search returns 0 | "No packages match '{q}'" + Clear search link. |
| **New-package modal open** | New package CTA click | Dialog opens; body dimmed; focus on `code` field. |
| **New-package modal — code validation** | Format fail or dup | Inline field error; Confirm disabled. |
| **New-package modal — submitting** | Confirm click | Confirm shows `Loader2` icon + "Creating…"; entire modal disabled. |
| **New-package modal — success** | POST 201 | Modal closes; navigate to PA-PKG-002 with returned draft version. |
| **Row action — creating draft** | `New draft` click | Row row-action button shows Loader2; on success, DRAFT badge appears + navigate. |
| **Row action — draft exists on new-draft click** | 409 | Toast "A draft already exists — opening it" + navigate to that draft. |
| **Row action — pending exists** | Both buttons disabled | Tooltip on hover: "A version of this package is pending approval — resolve it first in the approvals queue." |
| **Backend error 500** | Any read fails | Error banner "Couldn't load packages. Try again." + Retry button. Existing rows remain visible if refetch (not initial load) failed. |
| **Concurrent-edit 412** | Rare — client detects mismatch on new-draft POST | Toast "Someone else just edited this — reload to pick up their changes" + Reload CTA. |
| **Session expired** | 401 (not step-up) | Redirect to `SHR-AUT-001` login with return-to param. |
| **Insufficient permission** | 403 | Full-page block: "You need package-admin access to view this page." Link to PA home. |
| **Env-switch mid-flow** | PA-NAV-001 env change | If New-package modal open: confirm-discard prompt. Otherwise: refetch in new env. |
| **TEST-env warning strip** | env=TEST | Persistent full-width warning strip renders under top bar. |
| **Loading — pagination** | Prev/next clicked | Table dim overlay + `--lc-duration-fast` while new page loads. |
| **Loading — filter change** | Any filter change | Same dim overlay pattern. |
| **RTL** | Locale = ar | Columns mirror; row-action buttons move to the left edge. Price / cap numerals stay LTR via bidi isolation. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; status + trend chips + badges tints adjust automatically. |

---

## Accessibility

- Page has a single `<h1>` "Packages". Filter strip labeled by `aria-label="Filter packages"`.
- Env badge in top bar has `aria-live="polite"` announcement on env switch ("Environment switched to TEST").
- TEST warning strip is `role="status"` with `aria-live="polite"` on entering TEST.
- Status tabs are `role="tablist"` + `role="tab"` — arrow keys navigate; Enter/Space activates.
- Table has `role="grid"` (J/K keyboard nav + row focus + inline actions make it interactive). Each row `role="row"` + `tabindex="0"` when focused.
- Every column header labels its cell via `scope="col"`.
- New-package modal traps focus + Esc to close + click-outside dismisses with a "cancel" confirmation if any field was typed.
- Toasts `role="status"` + `aria-live="polite"`; destructive `assertive`.
- Keyboard shortcut hints panel (`?`) is a Sheet with focus trap.
- Focus visible via two-tone Broadcast focus ring on every interactive element (rows included).
- Every icon-only button (`?`, prev, next) has an `aria-label`.
- DRAFT / PENDING badges are focusable links with descriptive `aria-label` — e.g. `aria-label="Open draft version 4 for Small Team package"`.
- Status pills, cap trend chips, sales-led badge are tint + glyph + label — SR reads the label.
- Row-height baseline 72px meets 44px tap-target with room; row-action buttons 44×44.
- Never rely on hover-only affordances for critical actions — row-action buttons also reachable via keyboard (`D` for New draft; `Enter` for View history).
- Skip-to-content link at top of page (jumps past env badge + filter strip into table).

---

## Anti-patterns (do not do these)

- Do NOT render the price cell without `<Numeric>` — currency amounts, cap integers, and version numbers ALL go through the mono + tabular-nums primitive.
- Do NOT show a color-only status pill. Active / Inactive / Deprecated all use tint + glyph + label.
- Do NOT allow inline editing in the row. Every write goes through PA-PKG-002 (editor) or the approval flow — the row is read-only in-place.
- Do NOT surface the two-person-approval trigger detection UI here. That decision lives in PA-PKG-002 (submit banner) + PA-PKG-003 (approval detail). This screen only shows the PENDING badge; the diff + trigger reasoning is in the detail.
- Do NOT fabricate MRR, subscriber counts, revenue-per-package. That analytics surface is Phase-2 (matrix references `PA-PKG-002 view subscribers → PA-SUB-001 filtered` — deep-link only, no inline metrics here).
- Do NOT show more than one DRAFT badge per row. Server enforces "one DRAFT per package per env"; UI trusts that invariant.
- Do NOT allow `New package` while an unsaved LIVE-env DRAFT modal is mid-flight — the confirm-discard prompt on env-switch protects the modal, but concurrent new-package races are prevented server-side by the code-uniqueness check.
- Do NOT use `--lc-action-primary` as a row-hover fill; that token is reserved for the primary CTA and DRAFT-badge accents.
- Do NOT co-mingle LIVE and TEST data — every list must carry the env header + server verifies against session.
- Do NOT hide the env badge, even briefly (e.g. during the New-package modal). Badge is always visible per PA-NAV-001.
- Do NOT ship the mobile viewport as anything other than the "PA console requires a desktop screen" info block for v1.
- Do NOT link to the legacy `/admin/fin/packages` route from anywhere new. If the legacy route persists during migration, it must redirect to `/admin/packages` server-side or client-side.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Stripe Products dashboard** — product+price catalog with per-row current-version + inline actions. Direct pattern predecessor for "row is the summary; drilldown to a specialized screen".
- **Paddle Catalog admin** — tier list with monthly/annual price + property/agent caps side-by-side + status pill.
- **Linear settings → Billing → Plans** — clean tier presentation, active/inactive state, in-flight draft indicator.
- **Notion admin → Plans** — env-context awareness (workspace switcher analogous to env switcher).
- **PA-MOD-001 (WingCaster)** — the PA admin shell + env badge + TEST strip + filter strip pattern is inherited unchanged.

Do NOT match:

- Salesforce Price Book (over-dense, multi-hierarchy, wrong tool for a small catalog).
- Shopify Products list (product-catalog metaphor is not tier-catalog; agent seeing quantity/inventory would confuse the PA).

---

## Backend contract

**List endpoint:** `GET /api/admin/packages`

**Query params:**
- `filter` — `active` (default) | `all`
- `sort` — `sort_order` (default) | `price_monthly:asc` | `price_monthly:desc` | `property_cap:asc` | `updated_at:desc`
- `q` — search string (display_name, tagline substring; ≥2 chars server-side)
- `page` — integer, default 1
- `pageSize` — integer, default 25, max 100

**Response 200:**
```json
{
  "packages": [
    {
      "id": "pkg_semsar",
      "code": "semsar",
      "tier": "semsar",
      "currency": "USD",
      "billing_cadence": "monthly_and_annual",
      "sort_order": 100,
      "status": "active",
      "active_version": {
        "version": 4,
        "effective_from": "2026-08-01",
        "display_name": "Semsar",
        "tagline": "Get started free — everything a solo agent needs to test the water",
        "price_monthly_minor": 0,
        "price_annual_minor": 0,
        "property_cap": 5,
        "agent_cap": 1,
        "sales_led": false,
        "support_level": "email"
      },
      "prior_active_version": {
        "version": 3,
        "property_cap": 5,
        "agent_cap": 1
      },
      "draft_version": null,
      "pending_version": null,
      "updated_at": "2026-08-01T09:12:44Z",
      "env": "live"
    },
    {
      "id": "pkg_small_team",
      "code": "small-team",
      "tier": "small_team",
      "currency": "USD",
      "billing_cadence": "monthly_and_annual",
      "sort_order": 300,
      "status": "active",
      "active_version": {
        "version": 6,
        "effective_from": "2026-06-02",
        "display_name": "Small Team",
        "tagline": "Two to five agents sharing a listing pool and inbox",
        "price_monthly_minor": 9900,
        "price_annual_minor": 99000,
        "property_cap": 100,
        "agent_cap": 5,
        "sales_led": false,
        "support_level": "email_and_chat"
      },
      "prior_active_version": {
        "version": 5,
        "property_cap": 100,
        "agent_cap": 5
      },
      "draft_version": null,
      "pending_version": { "version": 7, "submitted_at": "2026-09-08T04:12:00Z", "submitter_display_name": "Fatima Al-Sayed" },
      "updated_at": "2026-09-08T04:12:00Z",
      "env": "live"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 7,
    "has_next": false
  },
  "counts": {
    "active": 7,
    "all": 9,
    "drafts": 1,
    "pending_approval": 1,
    "last_change_at": "2026-09-08T04:12:00Z"
  },
  "test_env_hint": {
    "live_has_packages": true
  }
}
```

**New package endpoint:** `POST /api/admin/packages`

Body:
```json
{
  "code": "growth-plus-mena",
  "display_name": "Growth+ MENA",
  "tier": "growth",
  "currency": "USD",
  "billing_cadence": "monthly_and_annual"
}
```

Response 201:
```json
{
  "id": "pkg_growth_plus_mena",
  "code": "growth-plus-mena",
  "draft_version": 1,
  "redirect_to": "/admin/packages/pkg_growth_plus_mena/versions/1/edit"
}
```

Response 409 (code taken):
```json
{ "error": "PACKAGE_CODE_TAKEN", "message": "A package with this code already exists in this environment." }
```

**New draft endpoint:** `POST /api/admin/packages/:id/versions` — see PA-PKG-002 backend contract.

Response 409 (draft already exists):
```json
{ "error": "DRAFT_ALREADY_EXISTS", "message": "…", "existing_draft_version": 4 }
```

**Copy-from-live endpoint (TEST env only, requires `[BE-DESIGN-04]`):** `POST /api/admin/packages/import-from-live`

Body: `{}`. Response 200: `{ "copied_count": 7, "packages_created": [...] }`.

**Prerequisites tracked / to file:**

- **`[BE-DESIGN-01]` ALREADY TRACKED.** Dynamic packages with marketing fields — Cursor prompt `CURSOR_PACKAGES_MARKETING_FIELDS.md` + `CURSOR_PA_PACKAGE_EDIT_UI.md` §2.1 admin routes cover this.
- **`[BE-VERIFY-11] Env-scoped package catalog — NEW.** Confirm the `/api/admin/packages` route family respects `X-Wingcaster-Env` header and NEVER returns cross-env rows. ~0.5 day audit. **File in kickoff §5a.**
- **`[BE-DESIGN-04] Cross-env package clone helper — NEW.** `POST /api/admin/packages/import-from-live` — copies each LIVE package's ACTIVE version into TEST as a fresh v1 DRAFT. ~1 day backend. NOT blocking for v1 if TEST catalog is seeded manually — the `Copy from LIVE` link in the empty-state renders only if the endpoint exists (feature-flagged via a server hint in the list response's `test_env_hint`). **File in kickoff §5a.**

---

## Downstream implementation (Cursor prompt handoff notes)

Direct alignment with `CURSOR_PA_PACKAGE_EDIT_UI.md` §2.4 "PA-PKG-001 — Package list" section — this brief is the Layer-2 expansion of that prompt-line spec. Route `/admin/packages` matches.

- **File to create:** `web/src/pages/admin/packages/PackageListPage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/admin/packages" element={<PackageListPage />} />` behind the `PAConsoleGuard` HOC (requires `platform_role === 'platform_admin'`).
- **Top-nav entry:** update PA top nav to add "Billing → Packages" with a badge counter tied to the DRAFT-or-PENDING count in the current env. Badge uses `<Numeric>` + `--lc-status-draft` styling. Poll every 60s.
- **Component decomposition:**
  - `PackageListPage.tsx` — page shell + data fetching + URL state + env context binding.
  - `PackageListFilterStrip.tsx` — tabs + sort select + search + refresh + `?` button.
  - `PackageListTable.tsx` — table shell + row rendering + keyboard nav.
  - `PackageListRow.tsx` — one row (package cell, version cell with badges, price cell, caps with trend chips, status, actions).
  - `NewPackageDialog.tsx` — seed-fields modal.
  - `PackageListEmptyState.tsx` — empty-state variants including TEST `Copy from LIVE` link.
  - `PAKeyboardShortcutsPanel.tsx` — inherited from `PA-MOD-001` REUSABLE component; add package-list shortcuts to the shared config.
- **Data layer:**
  - Hook: `usePackageListQuery({ filter, sort, q, page, pageSize, env })` — wraps `fetch` with SWR/React Query pattern; env-scoped.
  - Hook: `useCreatePackage()` — the New-package mutation.
  - Hook: `useCreateDraft(packageId)` — the New-draft mutation.
- **Test discipline:**
  - Unit: each sub-component renders + keyboard nav + filter state.
  - Integration: full page load + filter × sort × search × new-package modal happy path + new-draft × new-draft-conflict → open-existing × env-switch mid-flow.
  - RTL: `screens.rtl.test.tsx` extension with the catalog in Arabic locale.
  - Broadcast: `no-raw-hex.test.ts` must stay green.
  - Real-Postgres: at least one path that creates a new package + a fresh v1 DRAFT and asserts the list reflects both.
  - Accessibility: axe-core scan of loaded + modal-open + empty-state states.
- **Perf:**
  - Table virtualization not required — package catalog is small (<50 packages ever).
  - Skeleton must render within 100ms of route mount.
- **Copy/i18n:**
  - All strings in `web/src/locales/en/paPackages.json` + `ar/paPackages.json`. `[TRANSLATION-PENDING]` in AR for now.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable. (Delta briefs PA-PKG-002/003/004 reference THIS section.)

- Page shell background `var(--lc-bg-page)`; card / table shell on `var(--lc-surface-raised)`; header row on `var(--lc-surface-sunken)`.
- Env badge (PA-NAV-001) always visible in top bar; TEST warning strip full-width sticky under top bar.
- Page title `var(--lc-type-heading-1)`; subtitle `var(--lc-type-body-sm)` `var(--lc-text-muted)`.
- Column headers `var(--lc-type-overline)` (11px + 0.08em tracking) `var(--lc-text-muted)`.
- Row body text `var(--lc-type-body)` for package display_name, `var(--lc-type-caption)` for tagline + effective-date + trend chips + Sales-led badge.
- Every numeric — monthly/annual price, effective monthly, property cap, agent cap, version number, page-size, pagination indices, badge counters — via `<Numeric>` (mono + tabular-nums).
- Status pills use `--lc-status-{published,archived,closed}-{bg,fg,dot}` + required glyph (● ▢ ◆) + label; never color-alone.
- DRAFT badge on version cell: `--lc-status-draft-{bg,fg,dot}` + ○ + "Draft v{N}"; focusable link to PA-PKG-002.
- PENDING badge on version cell: `--lc-status-warning-{bg,fg,dot}` + ▲ + "Pending v{N}"; focusable link to PA-PKG-003 detail.
- Sales-led badge: `<Badge variant="outline">` using `--lc-accent-bold-edge` outline + `--lc-accent-bold` text — signals a "contact sales" flow downstream.
- Cap trend chip: `var(--lc-type-caption)` `--lc-text-muted` + `ArrowUp` / `ArrowDown` glyph tinted `--lc-status-warning-dot`; NEVER paint the cap value itself in warning color — the value is neutral, only the delta glyph carries the "changed" signal.
- Row hover `background: var(--lc-surface-sunken)` at `--lc-duration-fast`; row focus (via keyboard) shows the two-tone `--lc-focus-ring` + `--lc-focus-ring-contrast` ring — do NOT override.
- Row action buttons on hover: `<Button size="sm" variant="outline">`; View outline `--lc-border`, New draft outline `--lc-action-primary`.
- Primary CTA `New package`: `<Button variant="default">` — `--lc-action-primary` fill, hover DARKER `--lc-action-primary-hover`.
- New-package Dialog: `--lc-elevation-lg`, radii `var(--lc-radius-lg)`, fields with `--lc-border-strong` borders + `var(--lc-radius-md)`.
- Empty-state illustration placeholder: `--lc-surface-sunken` fill, `border: 1px dashed var(--lc-border-strong)`, `var(--lc-radius-lg)`.
- Loading skeleton: `--lc-surface-sunken` blocks; shimmer opacity 0.6→1 at `--lc-duration-base` `--lc-easing-in-out infinite alternate`; disabled under `prefers-reduced-motion`.
- Motion: row hover `--lc-duration-fast`; status pill swap `--lc-duration-base` `--lc-easing-in-out`; env-switch refetch `--lc-duration-base` fade. NO signal-lamp motif.
- Radii: page card `var(--lc-radius-lg)`; filter chips + buttons `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`; modal `var(--lc-radius-lg)`.
- Elevation: table shell `var(--lc-elevation-sm)`; modals `var(--lc-elevation-lg)`.
- Focus rings: two-tone via base CSS — do not override.
- Never use `--lc-action-primary` as a row-hover fill; that token is reserved for the primary CTA and DRAFT-badge accents.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) package-list screen (PA-PKG-001) — MENA real-estate B2B SaaS admin surface for editing pricing tiers that render on wingcaster.com/pricing. Desktop 1440px ONLY. This is where a Platform Admin browses all pricing packages in the current environment (LIVE or TEST), sees which have drafts / pending approvals, and launches into the version editor or the approval detail. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass: render the desktop 1440px layout with the LIVE env badge in the top bar (green), Active-only tab active (counter 7), 7 sample rows all Active (Semsar / Boutique / Small Team [with PENDING v7 badge on the version cell] / Growth / Growth+ [with DRAFT v2 badge] / Enterprise [Sales-led badge] / Enterprise+ [Sales-led badge]), row 3 (Small Team) in hover state showing inline `View history` + `Edit draft` (disabled with tooltip) buttons on the right. Header shows subtitle "7 active · 1 draft · 1 pending approval · Last change 4h ago" and the `New package` primary CTA + `?` icon-only button on the right. Pagination footer showing "1–7 of 7".

LTR English only for this pass — I'll ask for RTL Arabic, dark mode, TEST env with warning strip + empty state, New-package modal, and All-including-inactive tab as separate follow-ups.

Follow the copy table in the brief exactly. Do NOT fabricate MRR, subscriber counts, or revenue-per-package. The version cell, price, caps, and status are the ONLY signals — all backed by defined backend payloads.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now show the New-package modal open on top of the pass-1 catalog. Form filled: code "growth-plus-mena", display name "Growth+ MENA", tier Growth, currency USD (locked with tooltip "Multi-currency in Phase 2"), cadence Monthly + Annual. Confirm button enabled.`
2. `Now the same layout in TEST env — badge shows amber TEST + full-width warning strip under top bar. Empty state (0 packages) with the "Copy from LIVE →" secondary link visible.`
3. `Now the All-including-inactive tab active, 9 sample rows including 2 Deprecated (◆) status pills.`
4. `Now the keyboard-shortcuts drawer open on the right side, listing J/K/Enter/D/N/./?/Esc.`
5. `Now RTL Arabic at desktop 1440px. Use [TRANSLATION-PENDING] where copy has no Arabic; MIRROR the whole layout including column order.`
6. `Now the dark mode version of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-PKG-001/` + screenshot to `docs/design/mockups/PA-PKG-001-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 6 iteration states (ready-active LIVE, new-package-modal, TEST-env empty, all-including-inactive tab, keyboard drawer, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-PKG-001/`.
- [ ] Cursor Wave-3.5 dispatch prompt (`CURSOR_PA_PACKAGE_EDIT_UI.md`) references this brief + the mockup paths + the delta briefs PA-PKG-002/003/004.
- [ ] `[BE-VERIFY-11]` env-scoped package catalog audit filed in kickoff §5a.
- [ ] `[BE-DESIGN-04]` cross-env package clone helper filed in kickoff §5a as non-blocking Phase-1 add-on.
- [ ] Reusable component names (`PAKeyboardShortcutsPanel`) inherited from PA-MOD-001; shared config extended with package-list shortcuts.
