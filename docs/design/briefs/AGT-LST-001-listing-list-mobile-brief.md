# Screen Brief — AGT-LST-001 · Listing List (mobile, Guided) — ANCHOR for AGT-LST family

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-LST-001` (row 20 of the kickoff §5 dispatch grid; slotted in Week 8+ of the implementation plan). This is the **second-most-frequently-visited screen in the entire product** after the Agent Dashboard (AGT-DSH-001) — every time an agent opens the app with intent to work on a specific property, they land here. It is also the **entry gate to the entire AGT-LST family** (AGT-LST-002 Pro table, AGT-LST-003 detail, AGT-LST-004 Guided wizard, AGT-LST-005 Pro form, AGT-LST-006 analytics, AGT-LST-010 offers, AGT-LST-011 publications timeline, AGT-LST-012 comments). Get this brief right and the visual grammar for the whole family follows.

Because it anchors a family, this brief is intentionally longer than an average per-screen brief: state variants, view modes, filter semantics, empty-state variants, and the multi-tenant chrome interaction are all pinned down here so downstream briefs in the family can reference back without re-litigating decisions.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts:**

- Screen title ("Listings"): `font: var(--lc-type-heading-1)` — IBM Plex Sans 600 26/32. NOT display — this is a working screen, not a marketing screen.
- Counts sub-line ("42 total · 28 published · 8 draft · 6 pending"): `var(--lc-type-body-sm)` in `--lc-text-muted`. Every numeral wrapped in `<Numeric>` — activates IBM Plex Mono + `tabular-nums`.
- Filter chips (status + type): rendered as `<Badge>` / pill row. Unselected `background: var(--lc-surface-sunken)` + `color: var(--lc-text-secondary)`; selected `background: var(--lc-action-primary)` + `color: var(--lc-action-primary-text)`. Selected chip hover DARKENS to `--lc-action-primary-hover` — never lightens. Status chips MUST also carry the required glyph (draft ○ · published ● · underOffer ◐ · closed ◆ · archived ▢ · unpublished ✕) — never color-alone.
- Search input: `<Input>` with `Search` lucide icon left affix. `border: 1px solid var(--lc-border-strong)`; focus ring is the automatic two-tone Broadcast ring — do NOT override.
- Sort dropdown: `<DropdownMenu>` primitive. Trigger button `<Button variant="ghost" size="sm">` with `ArrowUpDown` icon + current-sort label. Menu items 44px tap height on mobile.
- View-toggle segmented control (card / list / gallery): three icon buttons in a shared `border: 1px solid var(--lc-border)` shell with `--lc-radius-md`. Active button `background: var(--lc-action-primary)` + `color: var(--lc-action-primary-text)`; inactive `background: transparent` + `color: var(--lc-text-muted)`. Icons from `lucide-react`: `Grid3x3` (card), `List` (list), `LayoutGrid` (gallery). **Preserves existing `web/src/pages/ListingsPage.tsx` viewMode precedent** — same three modes, same union type, same iconography.
- Listing cards (card view): `--lc-surface-raised` background + `--lc-elevation-sm` shadow (offset, not blurred). Border-radius `--lc-radius-lg` (7px — Broadcast is intentionally tight; do NOT round to 12+ px). Hero-photo corners inherit the top corners; content region is `padding: var(--lc-space-md)`.
- **Status pill on card** (top-left overlay on hero photo, 10px inset): NEVER color-alone. `--lc-status-{draft,published,underOffer,closed,archived,unpublished}-{bg,fg,dot}` + required glyph + label. Pill sits on a `--lc-surface-inverse` scrim at 60% opacity so it stays legible over any photo.
- HRID chip (top-right overlay on hero photo): monospace ID (e.g. `LST-4821`) in `<Numeric>` inside a `--lc-surface-inverse` pill with `--lc-text-inverse` ink at 90% opacity. Small — `var(--lc-type-caption)`.
- Card title (property title / address): `var(--lc-type-heading-3)` — IBM Plex Sans 600 18/24. Two-line clamp.
- Card price: `font: var(--lc-type-data)` (IBM Plex Mono 500 15/20) with currency prefix ("AED") in the UI font. Wrapped in `<Numeric>`. Prices for RENT append `/mo` in `--lc-text-muted`.
- Beds / baths / area row: every numeral in `<Numeric>`. Dot separators (`·`) in `--lc-text-muted`. `Bed`, `Bath`, `Home` icons from `lucide-react`, 16px, inline before each numeral.
- **Portal-syndication chip strip** (below stats row): row of `<ChannelMark>` marks for each channel the listing is syndicated to — Bayut, Property Finder, Dubizzle, OLX, Blue Door LB, Instagram, Facebook, plus Bazaar. Each 20-24px. Marks NEVER expand to large surfaces. Failed syndications get a tiny `--lc-status-unpublished-dot` dot overlay bottom-right of the mark. Not-syndicated channels show as a ghost outline of the mark in `--lc-border-strong`. Cap at 6 marks visible; if more, render "+N" in a `--lc-surface-sunken` circle at the tail.
- Inquiries-count badge (bottom-right of card, above sticky action zone): `<Badge>` in `--lc-accent` (teal) with `--lc-accent-bold-edge` outline (accent bold ALWAYS needs a boundary), pill radius. Shows `{count} new` when count > 0; hidden when 0. Count in `<Numeric>`.
- Last-updated relative timestamp: `var(--lc-type-caption)` in `--lc-text-muted`. e.g. "Updated 3h ago" / "Updated yesterday" / "Updated Mar 12". Uses `<Numeric>` for the numeric fragment.
- Days-on-market badge (small chip on hero, bottom-left): `var(--lc-type-caption)`, `--lc-surface-inverse` scrim + `--lc-text-inverse` ink. Numeric wrapped. Shown only when > 7 days.
- **FAB (mobile, bottom-right, 56×56 circle)**: `--lc-action-primary` fill + `Plus` icon in `--lc-action-primary-text`. `--lc-elevation-lg` offset shadow. Bottom offset must respect `safe-area-inset-bottom` + the 88px bottom-tab-bar height. RTL: mirrors to bottom-left.
- FAB action-sheet: `<Sheet>` from Radix. `--lc-duration-slow` (240ms) slide-up, `--lc-easing-out`. Contains "Add a listing (Guided)", "Add a listing (Pro form)", "Import from portal URL". Each row 56px, 44px+ tap.
- **Desktop "+ New listing" button** (in top-right of header, replaces FAB on ≥1024px): `<Button variant="default">` primary orange with `Plus` icon prefix. 44px min-height.
- Skeleton loaders: `--lc-surface-sunken` base + subtle `animate-pulse`. 6 skeleton cards on first paint.
- Pull-to-refresh (mobile): native-feeling spinner, `--lc-duration-slow`. Fires `loadListings()` again.
- Motion:
  - View-mode transition: `--lc-duration-slow` (240ms) opacity crossfade + subtle 4px Y translate. `--lc-easing-in-out`.
  - Filter chip active-state flip: `--lc-duration-fast` (120ms).
  - Card hover on desktop: elevation lifts from `--lc-elevation-sm` to `--lc-elevation-md` in 120ms; NOT a translate.
  - Long-press on mobile: haptic tick (Capacitor `Haptics.impact({ style: 'light' })`) + quick-actions overlay slide-in from bottom of the card, 180ms.
- Focus: two-tone Broadcast focus ring auto via base CSS. Do NOT override.
- Tap targets: 44px minimum. View-toggle icon buttons must NOT shrink below 44px on mobile even though the icon is 16px.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-LST-001 |
| Screen name | Listing List (Guided) |
| Persona | Agent (owns listings) — Guided mode |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Runtime | React web app inside a Capacitor iOS/Android wrapper — must feel native on mobile |
| Route | `/listings` (query params: `?view=card\|list\|gallery`, `?status=all\|draft\|published\|underOffer\|closed\|archived\|unpublished`, `?type=all\|sale\|rent`, `?q=<search>`, `?agent=<id>` in agency mode, `?sort=<field>:<dir>`) |
| Mode | Guided (Pro variant is AGT-LST-002 table — reachable via view-toggle → list mode OR global Mode=Pro flip) |
| Workflow role | n/a (browse gate — not a workflow step itself) |
| Family role | ANCHOR for AGT-LST-002/003/004/005/006/010/011/012. Visual grammar pinned here. |
| Current state | EXISTS — `web/src/pages/ListingsPage.tsx` already implements card/list/gallery viewMode + status + type + query filters + `<StatusPill>` + `<PropertyCard>` + `<ListingFormModal>` create flow. This brief supersedes with **mobile-first + Guided-mode redesign + portal-syndication chip strip + inquiries-count badge + agency-of-record filter + tenant context integration + Broadcast token migration**. The existing viewMode `'card' \| 'list' \| 'gallery'` union is **preserved intact** — same names, same iconography — so component signatures and URL params don't churn. |
| Backend prerequisites | ✅ `GET /api/properties?agent_id=…` (exists) · ✅ `LISTING_STATUSES` + `LISTING_STATUS_META` (`web/src/lib/listingStatus.ts`) · ⏳ **[BE-NEW-01] Syndication summary field** — `properties[i].syndications: [{channel, status, last_synced_at}]` — needed for the portal chip strip · ⏳ **[BE-NEW-02] Inquiries-count-per-listing field** — `properties[i].inquiries_new_count: number` — needed for the accent badge · ⏳ **[BE-NEW-03] Days-on-market field** — `properties[i].days_on_market: number` — derived at query time · ⏳ **[BE-NEW-04] Agency-of-record filter** — `?owning_agent=<id>` (agency mode only) |

---

## Purpose

Open the app, tap the Listings tab, and immediately see every property the agent owns — as a scan-first photo-forward grid on mobile, a dense table for power users, or a Pinterest-style gallery for visual browse. From here the agent decides which property to work on next; every tap either drills into detail (AGT-LST-003) or spawns a new listing (AGT-LST-004 / AGT-LST-005). It is a **decision surface, not a workspace** — every second the agent spends here is a second not spent on the property itself, so filtering, sorting, and finding must be instant.

Success outcome:
1. Agent opens `/listings`.
2. Agent finds the right property in ≤ 3 seconds (search / filter / scan).
3. Agent taps the card → AGT-LST-003.
4. OR: agent taps FAB / "+ New listing" → AGT-LST-004 (Guided) or AGT-LST-005 (Pro).
5. OR: agent long-presses a card → quick actions (Share / Publish / Duplicate / Archive) without leaving the list.

---

## Design goals

1. **Photo-first, always.** Real estate is visual — the card view IS the default, and the hero photo takes ~60% of the card. No "compact" mode that swallows the photo.
2. **View-toggle preserves user memory.** The three modes (card / list / gallery) from the existing `ListingsPage.tsx` implementation stay intact so users who have been running with `viewMode: 'gallery'` for months don't lose their setting. Persisted per user via `localStorage` key `wc.listings.viewMode` (existing behavior implied by current code).
3. **Filters are chips, not a drawer.** Status + type filters live inline as pill chips at the top of the list — one tap to apply, one tap to clear. A drawer only appears when the count of active filters exceeds what fits inline (progressive disclosure).
4. **Filter chips carry counts.** Every chip shows `(count)` next to the label — the agent sees at-a-glance how many drafts, pending, sold, etc. before tapping.
5. **Portal syndication is visible per-card, not hidden in detail.** The chip strip is a first-class card element — the agent sees which portals a listing is on WITHOUT tapping in. Failed syndications carry a red dot for immediate re-publish CTA.
6. **New-inquiry count is loud.** The teal `<Badge>` on the card is a call to reply. If a listing has new inquiries, the badge is the visual hook that pulls the eye.
7. **Tenant context is respected.** In agency mode, the list defaults to "my listings" but includes a top-of-list filter row for "All agency listings" / "Listing agent: {me}" / "Listing agent: {other}". Per `SHR-NAV-008`, the current selected tenant governs which properties the API returns.
8. **Empty state is warm.** Zero listings gets an illustrated hero + primary CTA to AGT-LST-004 (Guided wizard) with a secondary "Start with WhatsApp" link to AGT-WLB-001 — because the fastest path for a non-technical agent is a voice memo + photos.
9. **RTL Arabic is not an afterthought.** Chip row flows right-to-left, FAB flips to bottom-left, view-toggle order mirrors, and card layouts mirror. Prices and reference codes stay LTR-embedded.
10. **Fast.** First meaningful paint under 800ms on mid-range Android. Skeleton for every card slot on the first 6 items; further items lazy-load with infinite scroll (20 per page, matching the existing scroll pattern).

---

## Layout

### Mobile 375px, portrait

Reading top-to-bottom, within a 375×812 viewport minus 44px top safe-area and an 88px bottom-tab-bar zone:

**Zone 1 — Screen header (56px)**
- Left: screen title "Listings" (`var(--lc-type-heading-1)`)
- Right: sort dropdown trigger (`<Button variant="ghost">`) with `ArrowUpDown` icon + "Newest" (current sort label) — 44px tap
- Below title: counts sub-line "42 total · 28 published · 8 draft · 6 pending" (`var(--lc-type-body-sm)` muted, numerals in `<Numeric>`)

**Zone 2 — Search + filters (sticky under status bar on scroll, 108px)**
- Row 1 (48px): search `<Input>` with `Search` icon left affix. Placeholder: "Search by title, area, or reference".
- Row 2 (48px, horizontal scroll if overflow): status filter chips — "All", "Draft ○", "Published ●", "Pending ◐", "Sold ◆", "Archived ▢", "Unpublished ✕". Each chip includes label + glyph + `(count)`.
- Row 3 (only when status ≠ "all" or agency mode active, 48px): sub-filter chips — for status filter, type ("All", "For sale", "For rent"); for agency mode, agent-of-record picker ("Me", "Any agent", "{other agent name}").

**Zone 3 — View toggle row (44px)**
- Right-aligned: segmented three-icon toggle (card / list / gallery). Selected mode label appears on tablet+.

**Zone 4 — List content (scrolls under sticky zone 2, extends to just above FAB)**
- Card view (default): single-column card grid, cards full-width minus 16px side padding, 12px gap between cards. See §Card anatomy.
- List view: dense-row layout with 56×56 thumbnail left + title/address/status/price stacked right. Optimized for text scan.
- Gallery view: 2-column square-crop grid, 8px gap; overlay-only labels (price + status glyph) at bottom of each tile; tap to open detail.
- Bottom of list: infinite-scroll spinner. When last page reached: "You've seen all {n} listings" muted text.

**Zone 5 — FAB (bottom-right)**
- 56×56 circle, `--lc-action-primary`, `Plus` icon. Position: `bottom: calc(88px + var(--safe-area-inset-bottom) + 16px); right: 16px;`. RTL: `right → left`.

### Tablet 768px

- Zone 1–3 stay the same but the view toggle shows text labels next to icons.
- Card view: 2-column grid, 20px gap.
- Gallery view: 3-column.
- FAB stays but a `+ New listing` outline button also appears in the header.

### Desktop 1440px

- Zone 1 becomes a two-row header: title + counts on left, "+ New listing" primary button on right.
- Zones 2 + 3 collapse into one horizontal row: search input (max-width 320px, left) + status chips (middle) + type chips (right of status) + sort dropdown + view toggle (far right).
- Card view: 3-column grid at 1024–1279px, 4-column at 1280px+, 24px gap.
- List view becomes a full-featured table (this is the boundary between AGT-LST-001 and AGT-LST-002 — when `Mode=Pro` OR `?view=list` on desktop, the layout upgrades to the Pro table variant per AGT-LST-002).
- FAB is HIDDEN on desktop — replaced by the header button.

### Card anatomy (all viewports)

Each card contains, top-to-bottom:
1. **Hero photo band** (16:9 aspect, edge-to-edge)
   - `<img>` first photo with `object-fit: cover`. Fallback to `/placeholder-property.svg`.
   - Overlay top-left: `<StatusPill>` (glyph + label + tint) on scrim.
   - Overlay top-right: HRID chip (e.g. `LST-4821`) in mono.
   - Overlay bottom-left (conditional, > 7 days): "42 days" badge.
   - Overlay bottom-right (conditional, when new inquiries > 0): the accent `<Badge>` "3 new" — teal with white bounding edge.
2. **Content region** (`padding: var(--lc-space-md)`)
   - Title (2-line clamp) — `var(--lc-type-heading-3)`.
   - Address one-liner with `MapPin` icon prefix — `var(--lc-type-body-sm)` muted.
   - Price row: currency prefix + `<Numeric>` price + `/mo` (rent) — `var(--lc-type-data)`.
   - Stats row: `Bed 2 · Bath 2 · Home 1,200 sqft` — every numeral in `<Numeric>`.
   - Portal-syndication chip strip: `<ChannelMark>` row, cap 6, "+N" tail if overflow.
   - Bottom meta row: "Updated 3h ago" (`var(--lc-type-caption)` muted, left) · views count `Eye 128` (right, muted, numeric).

Cards are TAPPABLE across the whole surface. Long-press opens a quick-actions overlay (Share / Publish → AGT-PUB-001 / Duplicate / Archive → confirm dialog). Long-press behavior is not a Capacitor-only feature — right-click on desktop opens the same overlay as a `<ContextMenu>` primitive.

---

## Explicit copy (EN + AR)

| Key | EN | AR |
|---|---|---|
| `page.title` | Listings | الإعلانات |
| `page.counts` | {total} total · {published} published · {draft} draft · {pending} pending | {total} إجمالي · {published} منشور · {draft} مسودّة · {pending} قيد المراجعة |
| `search.placeholder` | Search by title, area, or reference | ابحث بالعنوان أو المنطقة أو الرقم المرجعي |
| `filter.status.all` | All | الكل |
| `filter.status.draft` | Draft ○ | مسودّة ○ |
| `filter.status.published` | Published ● | منشور ● |
| `filter.status.pending` | Pending ◐ | قيد المراجعة ◐ |
| `filter.status.underOffer` | Under offer ◐ | تحت العرض ◐ |
| `filter.status.closed` | Sold ◆ | مُباع ◆ |
| `filter.status.archived` | Archived ▢ | مُؤرشف ▢ |
| `filter.status.unpublished` | Unpublished ✕ | غير منشور ✕ |
| `filter.type.all` | All | الكل |
| `filter.type.sale` | For sale | للبيع |
| `filter.type.rent` | For rent | للإيجار |
| `filter.agent.me` | My listings | إعلاناتي |
| `filter.agent.any` | Any agent | أي وكيل |
| `filter.agent.select` | Choose agent… | اختر وكيلًا… |
| `sort.newest` | Newest first | الأحدث أولًا |
| `sort.oldest` | Oldest first | الأقدم أولًا |
| `sort.priceHigh` | Price: high to low | السعر: من الأعلى للأدنى |
| `sort.priceLow` | Price: low to high | السعر: من الأدنى للأعلى |
| `sort.mostInquiries` | Most inquiries | الأكثر استفسارات |
| `sort.leastActivity` | Least activity | الأقل نشاطًا |
| `view.card` | Card | بطاقات |
| `view.list` | List | قائمة |
| `view.gallery` | Gallery | معرض |
| `card.updated` | Updated {agoText} | تحديث {agoText} |
| `card.daysOnMarket` | {days} days | {days} يومًا |
| `card.inquiriesNew` | {count} new | {count} جديد |
| `card.hrid` | {reference} | {reference} |
| `card.portalOverflow` | +{count} | +{count} |
| `card.pricePerMonth` | /mo | /شهر |
| `fab.addListing` | Add listing | إضافة إعلان |
| `fab.action.guided` | Add a listing (Guided) | أضف إعلانًا (موجّه) |
| `fab.action.pro` | Add a listing (Pro form) | أضف إعلانًا (النموذج الكامل) |
| `fab.action.importUrl` | Import from portal URL | استيراد من رابط بوابة |
| `empty.zero.title` | Your first listing awaits | إعلانك الأول بانتظارك |
| `empty.zero.body` | Add photos, price, and details — or send us a voice memo on WhatsApp and we'll draft it for you. | أضف الصور والسعر والتفاصيل — أو أرسل مذكّرة صوتية عبر واتساب وسنكتبه بدلًا عنك. |
| `empty.zero.ctaGuided` | Create a listing | أنشئ إعلانًا |
| `empty.zero.ctaWhatsapp` | Start with WhatsApp | ابدأ عبر واتساب |
| `empty.filtered.title` | No listings match | لا توجد إعلانات مطابقة |
| `empty.filtered.body` | Try widening your filters or clearing search. | جرّب توسيع الفلاتر أو مسح البحث. |
| `empty.filtered.cta` | Clear filters | امسح الفلاتر |
| `infiniteScroll.end` | You've seen all {n} listings | لقد شاهدت جميع الإعلانات وعددها {n} |
| `contextMenu.share` | Share | مشاركة |
| `contextMenu.publish` | Publish now | انشر الآن |
| `contextMenu.duplicate` | Duplicate | نسخ |
| `contextMenu.archive` | Archive | أرشف |
| `error.load` | We couldn't load your listings. Try again? | تعذّر تحميل الإعلانات. حاول مجددًا؟ |
| `error.retry` | Try again | حاول مجددًا |
| `offline.banner` | You're offline. Showing cached listings. | أنت غير متصل. تُعرض الإعلانات المخزّنة. |

Copy voice: direct, confident, and warm. Never "!". Numeric plurals resolve at build time from the copy table (Arabic dual/plural forms).

---

## Component palette (shadcn / Radix / lucide-react + Broadcast primitives)

| Element | Primitive |
|---|---|
| Page shell | Existing `<AppLayout>` chrome (tenant context bar from `SHR-NAV-008` renders above this screen — this screen does NOT render its own chrome) |
| Screen title | `<h1>` styled with `var(--lc-type-heading-1)` |
| Counts sub-line | `<p>` with `<Numeric>` for each number |
| Search input | `<Input>` with `Search` lucide icon left affix |
| Status filter chips | `<Badge>` set OR custom chip row (matches existing `ListingsPage.tsx` chip pattern, migrated to Broadcast tokens) |
| Type filter chips | Same primitive as status |
| Agent-of-record filter | `<DropdownMenu>` — only rendered in agency mode |
| Sort dropdown | `<DropdownMenu>` |
| View-toggle segmented control | 3× `<Button variant="ghost" size="icon">` inside a bordered shell — preserves existing `<ViewToggle>` component signature from `ListingsPage.tsx` |
| Listing card | `<PropertyCard>` (existing, from `web/src/components/PropertyCard.tsx`) — extended with new props: `syndications`, `inquiriesNewCount`, `daysOnMarket`, `hrid`. Extension is additive, no rename. |
| Status pill on card | `<StatusPill>` (already extracted inside `ListingsPage.tsx` — promote to `web/src/components/listings/StatusPill.tsx` per `AGT-LST-003` note) |
| HRID chip | Inline `<span>` — no new primitive |
| Portal chip strip | New `<PortalStrip>` component wrapping N × `<ChannelMark>` + overflow tail |
| Inquiries-count badge | `<Badge>` with `--lc-accent` variant + bounding edge |
| Days-on-market chip | Inline `<span>` on scrim |
| FAB | `<Button variant="default" size="icon">` + `Plus` — wrapped in absolutely-positioned container respecting safe-area |
| FAB action sheet | `<Sheet>` (Radix) from bottom |
| Long-press context menu | `<ContextMenu>` (Radix) on desktop; custom overlay on Capacitor with `Haptics.impact` |
| Create modal / wizard entry | Existing `<ListingFormModal>` (guided create) — kept for compatibility; new FAB action opens AGT-LST-004 wizard on mobile |
| Empty state | `<EmptyState>` — existing pattern from `ListingsPage.tsx`, restyled |
| Infinite scroll | `useIntersectionObserver` hook on a sentinel `<div>` at list bottom |
| Pull-to-refresh | Capacitor gesture handler (mobile only); no-op on web |
| Loading skeleton | Custom skeleton cards using `--lc-surface-sunken` + `animate-pulse` |
| Offline banner | `<Banner>` (top of content); fires when `navigator.onLine === false` |
| Error state | Inline `<ErrorState>` component with retry CTA |

Icons: `lucide-react` — `Search`, `Grid3x3`, `List`, `LayoutGrid`, `Plus`, `Filter`, `ArrowUpDown`, `MapPin`, `Bed`, `Bath`, `Home`, `Eye`, `Building2`, `MessageCircle`, `Share2`, `Send`, `Copy`, `Archive`.

Channel marks: `<ChannelMark>` from `web/src/components/ui/channel-mark.tsx` — official provider SVGs for Instagram, WhatsApp, Facebook, TikTok, X, LinkedIn, OLX, plus Bayut / Property Finder / Dubizzle / Blue Door LB (add to `ChannelMark` if not already present).

---

## Sample content (for v0 / mockup)

Render the mobile 375px LTR light state with:
- Title "Listings" + counts "42 total · 28 published · 8 draft · 6 pending"
- Sort dropdown showing "Newest first"
- Search input empty with placeholder "Search by title, area, or reference"
- Status chips: "All (42)" (selected), "Draft ○ (8)", "Published ● (28)", "Pending ◐ (6)"
- Type chips: not rendered (status filter is "All")
- View toggle: card mode active
- **First card:**
  - Hero: modern 2BR marina apartment photo
  - Status pill: `Published ●` (green tint)
  - HRID chip: `LST-4821`
  - Title: "Marina Gate 1 — 2BR with view"
  - Address: "Dubai Marina, Dubai"
  - Price: `AED 2,400,000`
  - Stats: `Bed 2 · Bath 2 · Home 1,200 sqft`
  - Portal strip: Bayut, Property Finder, Dubizzle marks visible; Instagram mark visible with red-dot failure indicator
  - Inquiries badge: `3 new` (teal)
  - Meta: "Updated 3h ago" · `Eye 128`
- **Second card:**
  - Hero: villa exterior photo
  - Status pill: `Draft ○`
  - HRID chip: `LST-4822`
  - Title: "Villa in Palm Hills New Cairo"
  - Address: "New Cairo, Cairo"
  - Price: `EGP 12,500,000`
  - Stats: `Bed 4 · Bath 5 · Home 400 m²`
  - Portal strip: all ghost outlines (not syndicated yet)
  - Days badge: not shown
  - Meta: "Updated yesterday" · `Eye 0`
- **Third card:**
  - Hero: apartment interior photo
  - Status pill: `Under offer ◐` (amber)
  - HRID chip: `LST-4791`
  - Title: "Downtown Dubai Studio"
  - Address: "Downtown Dubai, Dubai"
  - Price: `AED 4,500 /mo`
  - Stats: `Bed 0 · Bath 1 · Home 480 sqft`
  - Portal strip: 6 channels + `+2` overflow tail
  - Days badge: "12 days"
  - Meta: "Updated 2 days ago" · `Eye 89`
- FAB visible bottom-right
- Bottom tab bar visible (rendered by shell, not this screen)

---

## Interactions

**On page load:**
- Read tenant context from `SHR-NAV-008` selected tenant.
- If URL has `?view=X`, `?status=X`, `?type=X`, `?q=X`, `?sort=X`, `?agent=X` — hydrate state from URL first.
- Otherwise, hydrate `viewMode` from `localStorage['wc.listings.viewMode']`, default to `'card'`.
- Fire `GET /api/properties?agent_id={me}&...filters` OR `GET /api/properties?tenant_id={tenant}&...filters` for agency mode.
- Render skeleton for 6 card slots while loading.

**On search input:**
- Debounce 250ms.
- Update URL query `?q=`. Filter locally (no backend round-trip on the first page).
- After 3 characters, if no matches locally, trigger a server-side search request.

**On filter chip tap:**
- Toggle active state instantly (no delay).
- Update URL query.
- Re-filter the client list. No refetch unless the filter is one the server hasn't returned data for.

**On sort change:**
- Update URL query.
- Re-order the client list. No refetch.

**On view-toggle tap:**
- Crossfade 240ms.
- Persist to `localStorage['wc.listings.viewMode']`.
- Update URL query.

**On card tap:**
- Navigate to `/listings/:id` (AGT-LST-003).
- Prefetch the detail on card hover (desktop) or when the card enters the viewport intersection at 80% (mobile).

**On card long-press (mobile) or right-click (desktop):**
- Open context menu overlay: Share / Publish now / Duplicate / Archive.
- Haptic tick on mobile.

**On portal-strip mark tap:**
- If channel succeeded: opens the live published URL in a new tab.
- If channel failed (red dot): opens AGT-PUB-004 (fix + retry).
- If channel not-syndicated (ghost): opens AGT-PUB-001 (publish flow) with that channel preselected.

**On inquiries-badge tap:**
- Navigate to AGT-INB-001 filtered to this listing's inquiries.

**On FAB tap:**
- Open `<Sheet>` with 3 actions: Guided wizard (AGT-LST-004), Pro form (AGT-LST-005), Import from URL (AGT-LST-014).

**On desktop "+ New listing" button:**
- Open `<ListingFormModal>` (existing behavior) — Guided-first, with a "Switch to Pro form" link inside.

**On empty state (zero listings, no filters):**
- Show hero: illustration + heading + body + primary CTA "Create a listing" (→ AGT-LST-004) + secondary "Start with WhatsApp" link (→ AGT-WLB-001).

**On empty state (filtered, zero results):**
- Show smaller card: "No listings match" + "Clear filters" text button.

**On pull-to-refresh:**
- Fire `loadListings()` again.
- Show native spinner.

**On infinite-scroll sentinel intersection:**
- Fetch next page (20 items).
- Append to existing list.
- If backend returns `has_more: false`, show "You've seen all {n} listings".

**On offline:**
- Show top banner "You're offline. Showing cached listings."
- Disable FAB (can't create when offline; queue for later isn't in scope for v1).
- Cards remain tappable (detail is cached in service worker).

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading — initial** | First render, no cache | 6 skeleton cards. Header + counts show `—` until data arrives. |
| **Loading — refresh** | Pull-to-refresh | Native spinner at top; existing cards stay visible (no flash). |
| **Loading — pagination** | Sentinel intersect | Spinner appended at list bottom. |
| **Loaded — has listings** | Data present | Cards render per view mode. |
| **Empty — zero listings** | `listings.length === 0` and no filters active | Illustrated hero with two CTAs. |
| **Empty — filtered** | Non-empty listings but `filtered.length === 0` | "No match" card with clear-filters CTA. |
| **Error — load failed** | GET rejected | Full-content error card with retry CTA; toast destructive. |
| **Offline** | `navigator.onLine === false` | Top banner + FAB disabled + cached data. |
| **Permission denied** | Backend 403 (rare — user without list scope in agency) | Full-screen error variant with sign-out CTA. |
| **Agency mode** | Selected tenant is an agency, not personal | Zone 2 shows the agent-of-record filter chip row; default to "My listings"; count sub-line respects filter. |
| **RTL** | Locale = `ar` | Whole layout mirrors. Prices + HRIDs stay LTR-embedded. FAB flips to bottom-left. |
| **Dark mode** | `prefers-color-scheme: dark` | All tokens swap; card scrims deepen; portal marks flip polarity via `--lc-channel-*-on`. |

---

## Accessibility

- Every filter chip is a `<button>` with `aria-pressed` state.
- View-toggle is a `role="group"` with `aria-label="View mode"`; each button has an `aria-label` (e.g. "Card view").
- Search input has a visible `<label>` (visually hidden but present for SR): "Search listings".
- Sort dropdown trigger has `aria-label="Sort listings"`.
- Card is a `<Link>` primitive — full-surface tappable, keyboard focusable, focus ring visible.
- Long-press context menu: `role="menu"` + items `role="menuitem"`.
- Status pill has `aria-label` describing status ("Status: Published, published listing").
- Portal chip strip: each `<ChannelMark>` is a `<Link>` or `<button>` with `aria-label="Bayut: Published"` / `aria-label="Instagram: Failed — tap to fix"`.
- Inquiries badge: `aria-label="3 new inquiries — tap to view"`.
- Skeleton has `aria-busy="true"` on the region.
- Empty state has `role="status"` announcing "No listings" or similar.
- Every tap target ≥ 44×44 CSS pixels including chip-row buttons and view-toggle icons.
- Two-tone Broadcast focus ring visible on every interactive element (automatic; do not override).
- Infinite-scroll sentinel is `aria-hidden="true"` — screen readers get the load state via `aria-live="polite"` on the list container.
- Reduced motion: view-toggle crossfade collapses to instant swap; card hover elevation change disabled.
- Color-independent status: every status pill has glyph + label + tint — passes the "print in grayscale" test.

---

## Anti-patterns (do NOT do these)

- ❌ Do not replace or rename the `viewMode` `'card' \| 'list' \| 'gallery'` union — it's the existing precedent and users have `localStorage` state pointing at these values. Extend, don't rewrite.
- ❌ Do not render the portal chip strip as full channel names ("Instagram", "Bayut") — it's icon marks only. Marks with labels turn the card into a spreadsheet.
- ❌ Do not show a "Pro table" toggle inline with card/list/gallery — the Pro variant is AGT-LST-002 and is reached via global Mode flip or via `?view=table` explicitly. Mixing Guided and Pro UI dilutes both.
- ❌ Do not show BOTH an FAB and a top-right "+ New listing" button on mobile — pick one per viewport. FAB below 1024px; header button ≥ 1024px.
- ❌ Do not put filter chips inside a drawer on mobile — chips are inline. A drawer only enters when the count of filter dimensions exceeds 3 (extensibility, not v1).
- ❌ Do not fabricate portal-syndication data if the backend hasn't returned `syndications` yet — render the strip as ghost outlines with a subtle "Not yet syndicated" tooltip on hover.
- ❌ Do not make the inquiries-count badge orange — the accent teal is DELIBERATE, so the eye reads it as "reply needed" (parallels the dashboard urgent card without competing with the status pill).
- ❌ Do not show the agency-of-record filter in solo-agent mode — it's noise. Only surface when `tenantType === 'agency'`.
- ❌ Do not autoplay hero video or animate cards on scroll — this is a decision surface, not a hero page.
- ❌ Do not use soft blurred shadows on cards — Broadcast is offset elevation, always.
- ❌ Do not paint HRID in the UI font — mono + tabular-nums, always. HRIDs are data.
- ❌ Do not silently swallow API errors — always toast + inline error state.
- ❌ Do not lose the search / filter / sort state when the user opens a card and comes back — persist via URL query params.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Airbnb "your listings" (mobile)** — photo-first card grid, HRID overlay, inline status pill.
- **Bayut agent portal (mobile)** — MENA baseline for the portal chip strip pattern.
- **Zillow Premier Agent CRM (mobile)** — inquiries-count badge as first-class card element.
- **Notion database gallery view** — the three-mode toggle (card / list / gallery) is a direct analogue.
- **Linear issue list** — chip filter row + count sub-line pattern.

Avoid style-anchoring on:
- Craigslist (too plain).
- Facebook Marketplace (too casual).
- MLS / IDX portals (too dense — that's AGT-LST-002's job).

---

## Backend contract

**Endpoint:** `GET /api/properties`

**Query params:**
```
agent_id       — required in solo mode; defaults to me in agency mode
tenant_id      — required in agency mode; supplied by tenant context
status         — 'all' | 'draft' | 'published' | 'underOffer' | 'closed' | 'archived' | 'unpublished'
type           — 'all' | 'sale' | 'rent'
owning_agent   — <agent_id> (agency mode only; overrides agent_id default)
q              — search string
sort           — 'created_at:desc' (default) | 'created_at:asc' | 'price:desc' | 'price:asc' | 'inquiries_new_count:desc' | 'last_activity_at:asc'
page           — 1-indexed
per_page       — 20 (default)
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "prop_01H…",
      "reference": "LST-4821",              // human-readable HRID
      "title": "Marina Gate 1 — 2BR",
      "location": "Dubai Marina",
      "city": "Dubai",
      "neighborhood": "Marina",
      "address": "Marina Gate 1",
      "type": "sale",
      "property_type": "apartment",
      "price": 2400000,
      "price_unit": "AED",
      "status": "published",
      "beds": 2,
      "baths": 2,
      "area": 1200,
      "area_unit": "sqft",
      "photos": ["https://cdn.wingcaster.…/…/1.jpg"],
      "views": 128,
      "inquiries_new_count": 3,             // NEW — [BE-NEW-02]
      "days_on_market": 42,                 // NEW — [BE-NEW-03]
      "listed_date": "2026-07-27T…",
      "last_activity_at": "2026-09-08T…",
      "agent_id": "agt_…",
      "owning_agent_id": "agt_…",           // agency mode only
      "owning_agent_name": "Sara Almansoori",
      "syndications": [                     // NEW — [BE-NEW-01]
        { "channel": "bayut", "status": "published", "last_synced_at": "…" },
        { "channel": "property_finder", "status": "published", "last_synced_at": "…" },
        { "channel": "instagram", "status": "failed", "last_synced_at": "…", "error": "…" }
      ]
    }
  ],
  "page": 1,
  "per_page": 20,
  "total": 42,
  "has_more": true
}
```

**Backward compatibility:** the current `GET /api/properties?agent_id=…` returns an array. Migration path: bump response to the object shape above; keep a `Accept-Version` header handshake for a release cycle, then flip default. All new fields (`inquiries_new_count`, `days_on_market`, `syndications`, `owning_agent_*`) are OPTIONAL — the UI degrades gracefully (badges hide, chip strip renders as ghost outlines).

**Related endpoints:**
- `GET /api/properties/:id/inquiries?state=new` (used by inquiries-badge deep link)
- `POST /api/properties/:id/duplicate` (context menu — Duplicate)
- `POST /api/properties/:id/archive` (context menu — Archive)
- `POST /api/properties/:id/events` (view telemetry — fired on card impression)

---

## Downstream implementation (Cursor prompt handoff notes)

- **File:** `web/src/pages/ListingsPage.tsx` — refactor in place, do NOT rename.
- **New extracted components:**
  - `web/src/components/listings/StatusPill.tsx` — promote from inline
  - `web/src/components/listings/PortalStrip.tsx` — NEW
  - `web/src/components/listings/InquiriesBadge.tsx` — NEW
  - `web/src/components/listings/ListingCard.tsx` — wraps existing `<PropertyCard>` and adds the new overlays; keep `<PropertyCard>` as the plain thumbnail for other consumers.
  - `web/src/components/listings/FabActionSheet.tsx` — NEW (Radix Sheet)
- **Preserved contracts:**
  - `ViewMode = 'card' | 'list' | 'gallery'` — unchanged.
  - `<ViewToggle>` component signature — unchanged.
  - `LISTING_STATUSES` + `LISTING_STATUS_META` from `web/src/lib/listingStatus.ts` — reused (do not fork).
  - `<ListingFormModal>` — kept as the desktop create modal; mobile FAB opens the wizard route instead.
  - URL query params — the existing `?status=…&type=…&q=…` set is preserved; `?view=…&sort=…&agent=…` added.
  - `localStorage['wc.listings.viewMode']` — preserved.
- **New component decomposition:**
  - `<ListingList>` — top-level layout
  - `<ListingFilters>` — chip row + search + sort + view toggle
  - `<ListingGrid>` — grid / list / gallery renderer switch
  - `<ListingCard>` — one card
  - `<PortalStrip>` — chip strip
  - `<InquiriesBadge>` — accent badge
  - `<EmptyState>` — zero / filtered variants
  - `<Fab>` + `<FabActionSheet>` — FAB and sheet
- **Test discipline:**
  - Unit: each component renders + state transitions (view mode, filter chip toggle, sort dropdown).
  - Unit: `localStorage` persistence of viewMode.
  - Integration: full page renders with mocked API — card view default, filter-by-status, filter-by-type, search, sort, infinite scroll.
  - Integration: agency mode surface — agent-of-record filter chip visible when tenant is agency.
  - Integration: empty states — zero listings vs filtered-empty.
  - RTL: `screens.rtl.test.tsx` extension with a listings RTL scenario.
  - Broadcast tokens: `no-raw-hex.test.ts` must stay green.
- **URL sync:** use `useSearchParams` from `react-router-dom` — write filter/sort/view changes back to URL query string; read from URL on mount.
- **Metering:** view telemetry `POST /api/properties/:id/events` fires when a card enters the viewport at ≥ 50% for ≥ 1 second (`IntersectionObserver`).
- **Feature flags:** none. This is a first-class always-on screen.

---

## Definition of done for this brief

- [ ] v0 has produced all 5 iteration states (mobile card default, mobile filtered, mobile empty-zero, desktop LTR, RTL Arabic).
- [ ] Screenshots committed under `docs/design/mockups/AGT-LST-001-<state>.png`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/AGT-LST-001/`.
- [ ] Cursor Week-8+ dispatch prompt references this brief + the mockup paths.
- [ ] `[BE-NEW-01]` through `[BE-NEW-04]` filed in kickoff §5a — properties response extension + agency filter.
- [ ] Sibling briefs in the AGT-LST family (AGT-LST-002, 003, 004, 005, 006, 010, 011, 012) updated to reference this anchor for shared visual grammar (portal chip strip, HRID chip, inquiries badge, status pill).
