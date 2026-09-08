# Screen Brief — AGT-LST-002 · Listings index (Pro table, tablet + desktop)

**Layer-2 Brief for design AI consumption. DELTA on `AGT-LST-001-listing-list-mobile-brief.md`.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-LST-002`. Wave 8+ per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 4 (Listing Management focus-domain cluster). Reads as a DELTA on the AGT-LST-001 card-view anchor — do not restate what AGT-LST-001 already covers (list filters, empty state, listing status vocabulary, backend endpoints, copy voice).

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. AGT-LST-001 §Broadcast callouts (filter chips, cards, status pills, FAB) carry over to Pro table where semantically applicable.

**Screen-specific Pro-table Broadcast callouts:**
- Table container: `--lc-surface-raised` outer + `--lc-elevation-sm` shadow + `--lc-radius-lg` corners.
- Table header row: `--lc-surface-sunken` background + `--lc-border` bottom hairline. Overline type: `var(--lc-type-overline)` (11px 600 tracking 0.08em) in `--lc-text-muted`.
- Table body rows: `--lc-surface-raised` background; alt-row zebra `--lc-surface-sunken` at 40% opacity. Row hover: `--lc-surface-selected`.
- Row separators: `--lc-border` hairline, 1px.
- **Sticky first column (HRID + title):** `--lc-surface-raised` background, right-edge shadow `--lc-elevation-sm` (offset, not blurred). Stays pinned during horizontal scroll.
- **Numeric cells:** every price / count / area / days / HRID uses `<Numeric>` — mono + tabular-nums via `var(--lc-type-data-sm)`.
- Status column: `<Badge>` with token + glyph + label (draft ○ / published ● / underOffer ◐ / closed ◆ / archived ▢ / unpublished ✕). Never color alone.
- Portals column: horizontal `<ChannelMark>` cluster (20px marks) with tooltip listing state per portal.
- Multi-select checkbox column: `<Checkbox>` primitive, 44px hit area (wraps a smaller visual).
- Selected row: `--lc-surface-selected` background + `--lc-border-strong` left-edge accent (2px, `--lc-action-primary`).
- Bulk-actions bar (appears on selection): floats fixed above the table footer, `--lc-surface-inverse` background, `--lc-text-inverse` ink, buttons `<Button variant="outline">` styled for inverse surface.
- Sortable header: sort glyph `ChevronUp` / `ChevronDown` (or `ChevronsUpDown` for unsorted) in `--lc-text-muted` idle, `--lc-text-brand` when this column is active.
- Saved views chip row: `<Badge>` chips above the table, active view in `--lc-action-primary` + `--lc-action-primary-text`, others `--lc-surface-sunken`.
- Keyboard-focus row indicator: 2px `--lc-focus-ring` outline (two-tone via base CSS).

---

## Meta

| | |
|---|---|
| Screen ID | AGT-LST-002 |
| Screen name | Listings index (Pro table) |
| Persona | Agent (Pro mode opt-in) |
| Device targets | Tablet 768px + Desktop 1440px ONLY — per D-S-06 |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/listings` when `tenant_memberships.data.ui_mode = 'pro'` AND viewport ≥768px. Explicit override `/listings?view=table` also honored at ≥768px. |
| Mode | Pro (Guided variant is AGT-LST-001) |
| Current state | MISSING — Wave 8+ delivery. |
| Delta from | AGT-LST-001 (anchor). Same data endpoints, denser table layout, sortable columns, multi-select bulk actions, saved views, keyboard nav, sticky first column. |

---

## Breakpoint policy (D-S-06 — non-negotiable)

**Pro renders ONLY at viewport ≥768px.** Below 768px the `/listings` route falls back to AGT-LST-001 Guided card view, silently. Server-side `ui_mode = 'pro'` is preserved.

**Fallback behavior at <768px:**
- Route resolves to `/listings` → renders AGT-LST-001 card list.
- Explicit `?view=table` query param is IGNORED at <768px — no error, no toast. User's server preference persists.
- The AGT-SET-002 mode-toggle chip in the top bar remains available.
- On viewport growth past 768px in the same session, the app re-renders to the Pro table without needing a reload.

---

## Purpose

Dense sortable table for power browsing owned listings. Same data as AGT-LST-001 (`GET /api/properties?scope=mine`), same filter vocabulary, same status vocabulary — but arranged for keyboard-driven speed: multi-column sort, multi-row select for bulk actions, saved views, sticky first column, inline direct-edit for common single-field changes.

---

## Design goals

1. **Density without noise.** Every column earns its width; nothing decorative on the row. Zebra + hairlines + one status glyph per row.
2. **Keyboard-first.** J/K/arrow keys move focus; Space toggles selection; Enter opens detail. Every action reachable without a mouse.
3. **Bulk actions are safe.** Multi-select is prominent; bulk-action bar summarizes count; destructive actions require typed confirm.
4. **Saved views are portable.** A user's "Below market" filter set is one click away and shareable within tenant.
5. **Horizontal scroll is deliberate.** Sticky first column preserves context; other columns scroll under it.

---

## Layout

### Above the table

- Top row (`--lc-surface-raised`, 56px): title "Listings" (`heading-2`) + saved-views chip row + view-toggle button group (Table / Cards — Cards route back to AGT-LST-001) + `+ New listing` primary button (right).
- Filter bar (second row, 48px, `--lc-surface-raised` + `--lc-border` bottom): filter chips (Status / Type / City / Price / Bazaar syndicated / Below market / Missing photos / Assigned-to-me) + `Add filter +` + column customization icon (right) + result count "42 of 128 listings".
- Selection summary (appears only when rows selected, 44px, `--lc-surface-selected`): "12 selected · Deselect all · Select page (20) · Select all (128)".

### The table (fills remaining viewport minus above + bulk bar)

- **Columns (default, left → right):**
  1. Checkbox (44px, sticky)
  2. HRID (72px, sticky) — human-readable ID
  3. Title (240px, sticky) — property title + address subline
  4. Price (120px, right-align) — `<Numeric>`
  5. Status (120px) — `<Badge>` glyph + label
  6. Portals (140px) — `<ChannelMark>` cluster, hover for per-portal state
  7. Inquiries (100px, right-align) — count `<Numeric>`
  8. Views (100px, right-align) — count `<Numeric>` MTD
  9. Days on market (110px, right-align) — `<Numeric>`
  10. Last updated (140px) — relative time + tooltip absolute
  11. Owning agent (160px — only visible in agency tenant context) — avatar + name
  12. Actions (48px, right-sticky) — overflow menu (`MoreHorizontal`)
- **Column customization:** right-click column header → show/hide checklist + drag to reorder. Widths resizable via header drag. Persisted server-side per user (`tenant_memberships.data.column_prefs.listings`).
- **Row height:** compact 40px / comfortable 48px / spacious 56px — respects AGT-DSH-002 density chip if selected globally; page-local override in overflow menu.
- **Virtual scroll:** 1000+ rows without perf drop. Row prefetch buffer 20 above/below viewport.
- **Sticky first cluster:** checkbox + HRID + title columns pin during horizontal scroll. Right-edge shadow makes the pin visible.
- **Empty variants** (all render inside the table container, not full-page):
  - `Filter yields no results`: illustration + "No listings match these filters" + "Save this filter as a view for later" nudge + `Clear filters` link.
  - `No listings at all`: use AGT-LST-001 empty-state hero (do not redesign).

### Bulk-actions bar (fixed, appears on selection)

- Position: fixed at bottom of viewport, above the browser chrome, 24px inset from left/right, `--lc-radius-lg` corners.
- Content: `12 selected` (with `<Numeric>`) + action buttons:
  - Publish to channels → opens AGT-PUB-001 in bulk mode
  - Archive → confirm dialog
  - Adjust price → inline dialog (fixed / percent / new value)
  - Change owning agent → only in agency tenant context; opens agent picker
  - Toggle Bazaar syndication → confirm
  - Export CSV → downloads immediately
  - Delete → 3-tap destructive (initial → warn → typed confirm with row count)
- Right-side: `Deselect all` link.

### Column customization side-drawer

- Trigger: column-customization icon in the filter bar.
- `<Sheet side="right">`, 320px wide.
- List of all columns with visibility checkboxes, drag handles for reorder, width reset per column.
- `Save layout` button (auto-saves on close if changed).

### Saved views bar

- Above the filter bar, horizontal chip strip.
- Default views seeded: "All", "My active drafts", "Below market price", "Expiring soon", "Never published to portals".
- User-authored views append. Each chip has an overflow menu (Rename / Duplicate / Delete / Share within tenant).
- `+ Save current filter as view` chip at the end.

---

## Explicit copy (delta only)

Reuse AGT-LST-001 copy for filter chip labels, status vocabulary, empty state.

| Slot | Copy |
|---|---|
| Screen title | Listings |
| View toggle labels | Table · Cards |
| Result count | {n} of {total} listings |
| Selection summary | {n} selected · Deselect all · Select page ({page_n}) · Select all ({total}) |
| Add filter chip | Add filter + |
| Column-customization aria | Customize columns |
| Column header — HRID | ID |
| Column header — Title | Property |
| Column header — Price | Price |
| Column header — Status | Status |
| Column header — Portals | Portals |
| Column header — Inquiries | Inquiries |
| Column header — Views | Views (MTD) |
| Column header — DOM | Days on market |
| Column header — Updated | Updated |
| Column header — Owner | Owning agent |
| Bulk actions bar prefix | {n} selected |
| Bulk publish | Publish to channels |
| Bulk archive | Archive |
| Bulk price adjust | Adjust price |
| Bulk change owner | Change owning agent |
| Bulk toggle bazaar | Toggle Bazaar syndication |
| Bulk export | Export CSV |
| Bulk delete | Delete… |
| Bulk delete confirm typed | Type "delete {n}" to confirm |
| Empty filter | No listings match these filters. |
| Save filter nudge | Save this filter as a view for later |
| Clear filters link | Clear filters |
| Save current view chip | Save current filter as view |
| Save-view dialog title | Save this view |
| Save-view dialog input placeholder | e.g. Below market in JVC |
| Share view (agency) | Share with tenant |
| Delete view confirm | Delete this view? Others in your tenant will lose access. |

Arabic mirrors: `[TRANSLATION-PENDING]` in the AR mirror MDX for the delta strings.

---

## Component palette (delta)

Reuse everything from AGT-LST-001. Additions:

| Element | Primitive |
|---|---|
| Table | `<Table>` from shadcn + `@tanstack/react-table` for sort/select/column state |
| Virtual scroll | `@tanstack/react-virtual` |
| Row select | `<Checkbox>` |
| Sort glyph | `ChevronUp` / `ChevronDown` / `ChevronsUpDown` |
| Column-customization drawer | `<Sheet side="right">` |
| Saved views chips | `<Badge>` cluster |
| Save-view dialog | `<Dialog>` |
| Bulk-actions bar | Custom `<BulkActionsBar>` — fixed positioned, inverse surface |
| Filter bar | Custom `<FilterBar>` — reused with AGT-LST-001 |
| View toggle | `<ToggleGroup>` (Table / Cards) |
| Overflow menu (row + column header) | `<DropdownMenu>` |
| Inline price/status edit | `<Popover>` with `<Input>` or `<Select>` inside |
| Confirm-destructive typed | `<Dialog>` with input that matches phrase before enabling primary |
| Owner avatar | `<Avatar>` |
| Channel cluster | `<ChannelMark>` × N |

Icons: `MoreHorizontal`, `ChevronUp`, `ChevronDown`, `ChevronsUpDown`, `Plus`, `Search`, `Filter`, `Columns`, `Save`, `Trash2`, `Archive`, `Send`, `Users`, `Download`.

---

## Interactions

- **Sort:** click column header → sort asc; click again → desc; click again → clear. Shift-click a second header → secondary sort key. Sort persists in URL query (`?sort=price:desc,updated_at:desc`).
- **Multi-select rows:**
  - Click row checkbox → toggle selection.
  - Shift-click a checkbox → range-select from last clicked.
  - Header checkbox → toggle-all on current page.
  - `Select all ({total})` link in selection summary → selects all filtered rows (with count confirmation for >200).
- **Keyboard nav:**
  - `J` / `↓` next row focus; `K` / `↑` previous row.
  - `Space` toggles current row selection.
  - `Enter` opens current row detail (AGT-LST-003).
  - `X` toggles "bulk-select mode" (row focus becomes selection too).
  - `A` select all on page; `Ctrl+A` select all filtered.
  - `Escape` clear selection.
  - `/` focus filter/search input.
  - `F` open filter drawer.
  - `S` save current filter as view.
  - `?` open shortcuts palette (shared with AGT-DSH-002).
  - `⌘K` command palette (SHR-NAV-005).
- **Inline direct-edit:**
  - Double-click price cell → popover with input; Enter saves; Escape cancels; toast "Price updated".
  - Double-click status cell → popover with select; same save semantics.
  - Other cells: read-only in place (open detail to edit).
- **Row context menu (right-click OR overflow icon):**
  - Open detail, Duplicate, Share, Quick-publish, Quick-adjust price, Archive, Delete (destructive).
- **Sticky column horizontal scroll:** scroll wheel + trackpad horizontally scrolls the non-sticky columns; sticky columns stay pinned.
- **Column resize:** drag header edge; live width preview. Save on release.
- **Column reorder:** drag column header; live drop preview; save on release.
- **Saved view chip:** click applies view's filters + sort + column prefs. Overflow menu on chip for rename/duplicate/delete/share.
- **Bulk actions:**
  - Non-destructive (Publish / Archive / Toggle Bazaar / Export): confirm dialog with row count; execute on confirm.
  - Adjust price: dialog with amount + type (fixed / percent) + preview; execute on confirm.
  - Change owner (agency): agent picker + confirm.
  - Delete: 3-tap → destructive dialog with typed "delete {n}" confirmation.

---

## State variants (delta)

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial — has listings** | Data loaded, ≥1 row | Table renders with default columns + saved-views chips + last-saved sort. |
| **Empty — no listings at all** | 0 rows total | Use AGT-LST-001 empty-state hero (do not redesign). |
| **Empty — filter yields nothing** | 0 rows after filter | In-table empty variant: "No listings match these filters" + save-view nudge + clear-filters link. |
| **Row focused (keyboard)** | J/K/arrow key | Two-tone focus ring on the row; row not selected unless Space pressed. |
| **Row selected** | Space or checkbox click | `--lc-surface-selected` + left-edge accent bar; bulk-actions bar appears. |
| **Bulk in-flight** | Bulk action confirmed | Loader on the affected rows (or the bulk-actions bar shows a progress %); disable further clicks. |
| **Bulk error** | Backend 500 during bulk | Destructive toast + affected rows re-enable; bulk-actions bar shows "Retry" chip. |
| **Column sort active** | Header clicked | Sort glyph shows current direction; header text `--lc-text-brand`. |
| **Column being resized** | Header edge dragged | Live width guide line; cursor `col-resize`. |
| **Column being reordered** | Header dragged | Drop-target highlight between columns; old position dashed placeholder. |
| **View chip active** | User applied a saved view | Chip in `--lc-action-primary` + `--lc-action-primary-text`; filter bar reflects the view's filters. |
| **View unsaved changes** | User modified filters while a view was active | Chip shows a small `*` suffix; filter bar has an `Update view` inline action. |
| **Save-view dialog open** | User pressed `S` or clicked `Save current filter as view` | Dialog with name input + share-with-tenant toggle (agency only). |
| **Column-customization drawer open** | Icon clicked | `<Sheet>` slides in from right; live-preview toggles as user checks/unchecks. |
| **Inline edit popover** | Double-click price/status | Popover anchored to cell; Escape cancels. |
| **Destructive confirm — bulk delete** | Delete… bulk action | Modal with typed "delete {n}" input + destructive button disabled until typed. |
| **<768px fallback** | Viewport shrinks below 768px | Route silently switches to AGT-LST-001 render. Server `ui_mode` preserved. Explicit `?view=table` ignored. |
| **Loading — page** | Route resolving | Skeleton table (10 rows × current column config). |
| **Loading — sort/filter** | Query change fetches new page | Rows blur to 40% opacity + spinner overlay 300ms delay-to-avoid-flash. |
| **Export in progress** | Export CSV clicked | Toast "Preparing your export…" → toast with download link when ready (server generates async for >500 rows). |
| **RTL** | Locale = ar | Whole table mirrors L↔R; sticky columns pin to right; sort glyphs flip; bulk-actions bar mirrors. Numeric cells stay LTR. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap; sticky-column shadow stays visible against darker surface. |

---

## Accessibility

- Table uses `<table>` semantics with `<thead>`, `<tbody>`, `<th scope="col">`, `<td>` — NOT div-grid — for screen-reader compatibility.
- Column headers have `aria-sort` reflecting current sort direction.
- Row checkbox has `aria-label="Select {title}"`.
- Selection summary announces via `aria-live="polite"` on change ("12 rows selected").
- Bulk-actions bar has `role="region"` with labeled buttons.
- Keyboard trap prevention: Tab exits the table normally; internal nav is J/K/arrows via a custom `roving-tabindex` pattern.
- All popovers/dialogs (save view, inline edit, bulk confirm) have focus traps + Escape close.
- Reduced motion: no scroll animations; sticky-column shadow stays static.
- Every tap target ≥44px including row checkbox (hit area wraps a smaller visual).
- Sticky column right-edge shadow tested for AA contrast against both light and dark surfaces.
- Sort glyphs are icons + `aria-label` (never color-only).
- Zebra rows preserve AA contrast for body text on both variants.

---

## Anti-patterns — do NOT do

- ❌ Do not put the FAB (from AGT-LST-001) on the Pro table. Primary create action lives as `+ New listing` in the top row.
- ❌ Do not render status with color alone. Always token + glyph + label.
- ❌ Do not use `Select all` without a count confirmation for >200 rows — accidental bulk-deletes on 1000+ selected rows would be catastrophic.
- ❌ Do not lose sort/filter/view state on route change. Everything reflects in URL query.
- ❌ Do not shrink row checkboxes below 44px hit area. Density affects visual height, not target size.
- ❌ Do not remove sticky columns to fix a horizontal scroll bug. Sticky is the whole point.
- ❌ Do not render numerics in the UI font. Every count, price, ID → `<Numeric>`.
- ❌ Do not show a full-page empty-state hero when a filter yields nothing. In-table variant only — otherwise the user loses their filter chips + saved-views context.
- ❌ Do not persist column widths / order / visibility client-side only. Server is source of truth so preferences sync across devices.

---

## Backend contract (delta)

**Same data endpoints as AGT-LST-001:**
- `GET /api/properties?scope=mine&filter=...&sort=...&limit=...&cursor=...` for the paged rows.
- `POST /api/properties/:id/events` for view telemetry.

**New / extended:**
- `PATCH /api/users/me/list-prefs` accepts:
  ```json
  {
    "listings": {
      "columns": ["hrid","title","price","status","portals","inquiries","views","dom","updated_at","owner","actions"],
      "widths": {"title": 260, "price": 130},
      "density": "compact",
      "default_sort": [["updated_at","desc"]],
      "default_filter": {"status": ["published","under_offer"]}
    }
  }
  ```
  Persisted at `tenant_memberships.data.column_prefs.listings` per matrix note. No schema change; `data` JSONB absorbs.
- `GET/POST/PATCH/DELETE /api/tenants/:tid/saved-views` for saved views. Each view row:
  ```json
  { "id": "sv_...", "resource": "listings", "name": "Below market in JVC", "owner_user_id": "...", "shared_with_tenant": true, "filter": {...}, "sort": [...], "column_prefs": {...} }
  ```
  If a `saved_views` table doesn't exist yet, MVP path: store as `tenants.data.saved_views` JSONB array. File as `[BE-BLOCKER-XX]` in kickoff if a table is preferred.
- **Bulk mutation endpoints:**
  - `POST /api/properties/bulk/archive` body `{ ids: [] }`
  - `POST /api/properties/bulk/publish` body `{ ids: [], channels: [] }` (delegates to publish module)
  - `POST /api/properties/bulk/price-adjust` body `{ ids: [], mode: "fixed"|"percent", value: n }`
  - `POST /api/properties/bulk/change-owner` body `{ ids: [], owner_user_id }` (agency context only)
  - `POST /api/properties/bulk/toggle-bazaar` body `{ ids: [], enabled: bool }`
  - `DELETE /api/properties/bulk` body `{ ids: [], confirmed_phrase: "delete {n}" }`
  - `POST /api/properties/bulk/export` body `{ ids: [] | null (all filtered), format: "csv" }` → returns job id; poll `GET /api/exports/:jobId` for download URL.

If any of these bulk endpoints are missing, file each as `[BE-BLOCKER-XX]` — bulk actions are P0 for the Pro table's value prop.

---

## Downstream implementation

- **New page state:** `web/src/pages/ListingsPage.tsx` — branch on `useMode()` + viewport width. At ≥768px + `ui_mode='pro'` render `<ProListingsTable>`; otherwise render existing `<GuidedListingsCards>` (AGT-LST-001).
- **New components:**
  - `web/src/components/listings/pro/ListingsTable.tsx` — TanStack Table wrapper + virtualization.
  - `web/src/components/listings/pro/BulkActionsBar.tsx` — fixed inverse-surface bar.
  - `web/src/components/listings/pro/SavedViewsBar.tsx` — chip strip + save/edit dialogs.
  - `web/src/components/listings/pro/ColumnCustomizationDrawer.tsx` — right sheet.
  - `web/src/components/listings/pro/InlineEditPopover.tsx` — reusable for price/status double-click edit.
  - `web/src/components/listings/pro/RowContextMenu.tsx` — dropdown wrapper.
- **Hooks:**
  - `web/src/hooks/useListingsTableState.ts` — TanStack Table state + URL sync + server prefs load/save.
  - `web/src/hooks/useSavedViews.ts` — CRUD saved views.
  - `web/src/hooks/useBulkActions.ts` — dispatchers per action + optimistic UI.
  - `web/src/hooks/useIsProCapable.ts` — shared with AGT-DSH-002 and AGT-SET-002.
- **Keyboard shortcut layer:** register table-scope shortcuts in `useListingsShortcuts.ts`; cleanup on route exit. Do not collide with global palette (`⌘K`, `?`).
- **Tests:**
  - Unit: table sort persists to URL; column customization saves to server; saved-view chip applies filters.
  - Integration: opt in via AGT-SET-002 → arrive at `/listings` Pro table; select 5 rows; bulk archive; verify server call + row disappearance.
  - Integration: shrink viewport → Guided cards render; `?view=table` ignored below 768px.
  - Destructive: bulk delete requires typed phrase match before button enables.
  - RTL: sticky columns pin to right; sort glyphs mirror.
  - Regression: at <768px + `ui_mode='pro'`, no Pro table DOM present.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.

---

## Broadcast alignment callouts

- Table container: `--lc-surface-raised` + `--lc-elevation-sm` + `--lc-radius-lg`.
- Header row: `--lc-surface-sunken` background + `--lc-border` bottom hairline; overline type in `--lc-text-muted`.
- Body rows: `--lc-surface-raised` + zebra `--lc-surface-sunken` at 40%; hover `--lc-surface-selected`; separator hairline `--lc-border`.
- Sticky first cluster: preserves `--lc-surface-raised`; right-edge `--lc-elevation-sm` shadow (offset, not blurred).
- Selected row: `--lc-surface-selected` + left-edge 2px `--lc-action-primary` accent.
- Numeric cells: `<Numeric>` mono + tabular-nums via `var(--lc-type-data-sm)`.
- Status badges: token + glyph + label per Broadcast status vocabulary.
- Portals cluster: `<ChannelMark>` marks 20-24px only; paired with `-on` ink.
- Sort glyphs: idle `--lc-text-muted`; active-column `--lc-text-brand`.
- Saved-view chips: active `--lc-action-primary` + `--lc-action-primary-text`; inactive `--lc-surface-sunken` + `--lc-text-secondary`.
- Bulk-actions bar: `--lc-surface-inverse` + `--lc-text-inverse`; buttons outlined for inverse contrast.
- Motion: sort/filter row-blur `--lc-duration-fast`; column-customization drawer `--lc-duration-slow` slide-in with `--lc-easing-out`; bulk-actions bar entrance `--lc-duration-base`.
- Focus rings via base CSS two-tone — do not override on any row/cell/header/button.
- Radii: table `--lc-radius-lg`; chips `--lc-radius-pill`; badges `--lc-radius-sm`.

---

## Handoff instruction to v0

Paste this brief + AGT-LST-001 brief in full into a fresh v0.app chat. Framing prompt:

```
I'm designing the Pro-mode listings TABLE for a MENA real-estate B2B SaaS (WingCaster). This is a DELTA on the Guided mobile card view (also pasted). Pro renders ONLY at ≥768px viewport — mobile falls back to Guided silently. Stack: React 18 + shadcn/ui + Radix + @tanstack/react-table + @tanstack/react-virtual + lucide-react + Tailwind.

First pass: render the DESKTOP 1440px layout. Top row: title "Listings" + saved-views chips (All / My active drafts / Below market price / Expiring soon / + Save current) + Table/Cards toggle (Table active) + "+ New listing" primary button (right). Filter bar below with chips (Status / Type / City / Price / Missing photos / Assigned-to-me / Add filter +) + column customization icon + result count "42 of 128 listings". Table below: columns (checkbox / HRID / Title / Price / Status / Portals / Inquiries / Views / Days on market / Updated / Actions). Sample data: 12 listings, one selected showing left-edge accent + bulk-actions bar at bottom ("1 selected · Publish · Archive · Adjust price · Export · Delete · Deselect all"). Every numeric cell in mono + tabular-nums. Status badges with glyph + label. Portals column shows Instagram + WhatsApp + Bayut ChannelMarks. Sticky first column cluster (checkbox + HRID + Title).

LTR English only for pass 1. Follow-ups: (2) tablet 768px same state — narrower with sticky column shadow visible during horizontal scroll. (3) Multi-select 12 rows + bulk-actions bar with all buttons visible. (4) Filter-yields-empty state inside the table container. (5) Column-customization drawer open (right sheet). (6) Save-view dialog open. (7) Dark mode. (8) RTL Arabic desktop. (9) Bulk-delete typed-confirm dialog.
```

---

## Definition of done

- [ ] v0 produced all 9 iteration states.
- [ ] Screenshots under `docs/design/mockups/AGT-LST-002-<state>.png`.
- [ ] JSX exports under `docs/design/mockups/v0-outputs/AGT-LST-002/`.
- [ ] Cursor Wave-8 prompt references this brief + AGT-LST-001 + AGT-SET-002.
- [ ] Bulk mutation endpoints verified in `backend/src/routes/properties/*` — missing ones filed as `[BE-BLOCKER-XX]` in kickoff §5a.
- [ ] `saved_views` storage decision made (dedicated table vs `tenants.data.saved_views`) and filed if the table path is chosen.
- [ ] `useIsProCapable` viewport gate shared with DSH-002 + SET-002.
- [ ] `no-raw-hex.test.ts` green.
