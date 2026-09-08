# Screen Brief — AGT-INB-001 · Unified inbox list

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-INB-001`. **Anchor** for the entire AGT-INB screen family (`-001` list, `-002` detail, `-003` compose, `-004` assign, `-005` channel+source dual-badge treatment). This is **the "Catch"** in WingCaster's Capture · Cast · **Catch** · Convert loop — the surface where an agent literally sees every inbound signal from every channel across every source, in one thumb-reachable feed. If AGT-DSH-001 is where the agent starts their day, AGT-INB-001 is where they spend the rest of it.

Get this right and every other AGT-INB screen inherits its visual language, row density, filter semantics, and channel + source vocabulary.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex or shadcn-generic references appear, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts:**
- Screen title ("Inbox"): mobile hidden (the bottom-tab already identifies it); tablet/desktop shows `var(--lc-type-heading-1)` — IBM Plex Sans 600 26/32 — top-left of the list column.
- Unread-count sub-line (e.g. "12 unread · 3 assigned to you"): `var(--lc-type-body-sm)` + `--lc-text-muted`. Numerals wrapped in `<Numeric>`.
- **Row surface**: `--lc-surface-raised` background; hairline `--lc-border` divider between rows. Selected/hover row: `--lc-surface-sunken` + `--lc-elevation-sm` on desktop. Row corner-radius `var(--lc-radius-md)` on tablet+desktop; on mobile rows are flush edge-to-edge with only bottom hairline dividers (list-style, not card-style).
- **Contact name**: `var(--lc-type-body)` 400 15/22 in `--lc-text-primary`. **Unread** row bumps name to `600` weight — never uses color to indicate unread (per Broadcast no-color-alone rule).
- **Snippet (last message preview)**: `var(--lc-type-body-sm)` in `--lc-text-muted`, single-line truncated with `text-overflow: ellipsis`.
- **Timestamp**: `var(--lc-type-caption)` mono, `--lc-text-muted`, `tabular-nums` via `<Numeric>` — right-aligned in the row.
- **Channel badge (leftmost, next to avatar)**: `<ChannelMark channel="...">` at 24×24 (mobile) / 20×20 (tablet+desktop). Pairs `--lc-channel-{X}` background with `--lc-channel-{X}-on` glyph ink. See AGT-INB-005 for the full channel enumeration.
- **Source badge (rightmost of the badge cluster, before the timestamp)**: portal/source logo at 20×20 in a `var(--lc-radius-sm)` chip with `--lc-surface-sunken` background + `--lc-border` outline. See AGT-INB-005 for the full source enumeration.
- **Unread indicator**: 8×8 `--lc-action-primary` filled dot at the row's leading edge (mobile) or trailing edge before timestamp (desktop). Paired with the 600-weight name — dot + weight together, never dot alone.
- **Priority indicator (AI-scored high)**: small `<Flame>` (lucide) icon in `--lc-status-danger-fg`, 14×14, positioned immediately after the contact name. Tooltip: "Prioritized by inbound signal — {reason}".
- **Assignment indicator**: `<UserRound>` (lucide) icon 14×14 in `--lc-text-muted` when assigned to another agent; hidden when assigned to self or unassigned. Solo agents never see this indicator.
- **Filter chips row** (above the list): `<Button variant="outline" size="sm">` chips, 32px height on mobile with 44px tap target enforced. Active chip: `--lc-action-primary` fill + `--lc-action-primary-text` ink. Inactive: `--lc-border` outline + `--lc-text-primary` ink.
- **Search bar**: `<Input>` with `Search` icon prefix. Placeholder: `Search messages, contacts, listings…`. `var(--lc-border-strong)` border; focus ring is two-tone Broadcast — do not override.
- **Sort dropdown**: `<DropdownMenu>` primitive. Trigger button `<Button variant="ghost" size="sm">` — icon-only on mobile (`ArrowUpDown` lucide), icon+label on tablet+desktop.
- **Bulk-action bar** (appears when ≥1 row selected): slides down from the top of the list with `--lc-duration-slow` (240ms) + `--lc-easing-out`. Background `--lc-surface-inverse` + `--lc-text-inverse` ink. Action buttons `<Button variant="ghost">` with `--lc-text-inverse` override.
- **FAB (bottom-right, mobile only, 56×56)**: `--lc-action-primary` fill + `Plus` icon in `--lc-action-primary-text`. `--lc-elevation-lg` offset shadow. Tap → AGT-INB-003 compose modal.
- **Empty state hero**: `Inbox` lucide icon (48×48) in `--lc-text-muted`, then `var(--lc-type-heading-3)` headline + `var(--lc-type-body)` body + optional primary CTA linking to AGT-ONB-002 (WhatsApp intake tour).
- **Skeleton loader**: `--lc-surface-sunken` base + subtle animate-pulse at `--lc-duration-slow`. Renders 8 rows on first load.
- **Pull-to-refresh (mobile)**: native-feeling spinner using `--lc-action-primary`, duration `--lc-duration-slow`.
- Two-tone focus ring automatic; 44px tap floor automatic; do not override.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-INB-001 |
| Screen name | Unified inbox list |
| Persona | Agent (solo or agency-scoped), authenticated |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/inbox` (query params: `?channel=<code>`, `?source=<code>`, `?assigned=me\|anyone`, `?unread=1`, `?listing=<id>`, `?from=<iso>&to=<iso>`, `?q=<query>`, `?sort=newest\|oldest\|priority`) |
| Current state | EXISTS — `web/src/pages/InboxPage.tsx`. This brief supersedes with dual-badge channel+source treatment, filter chip row, bulk actions, merged/separate mode, mobile-first row density, and empty state. |
| Workflow role | n/a (recipient-side surface) — but every AGT-INB row carries the AGT-INB-005 dual-badge treatment which classifies the WF-role of the underlying conversation. |
| Backend prerequisites | ✅ `conversations` table (migration 005) · ✅ `conversation_messages` table (migration 005) · ✅ conversations list route + assign route · **⏳ [BE-BLOCKER-04] `conversations.source_channel` decomposition into `channel` + `source`** — this brief ASSUMES the migration is done: rows reference `conversation.channel` and `conversation.source` as two independent fields · ⏳ full-text search index over `conversation_messages.content` + `contacts.name` (must be added if not present) · ⏳ agent-preferences row for `inbox_merge_mode` (default `separate`) on tenant × agent scope |

---

## Purpose

Every inbound signal — from any channel, from any source, about any listing — surfaces here in one scannable list, so the agent can catch a lead within minutes of it arriving and never wonder whether they missed something because it came in on a channel they don't check often.

The screen answers three questions in one glance per row:
1. **Who** is this from? (avatar + name, or masked identifier when consent has not been obtained)
2. **How** did it arrive? (channel badge — WhatsApp / Email / SMS / IG DM / FB Messenger / TikTok / X / LinkedIn / Telegram / WingCaster inbound webhook)
3. **Where** did the inquiry originate? (source badge — Direct / Agent profile / Agency profile / White-label / Widget / Bazaar / OLX / Bayut / Property Finder / Dubizzle / Aqar / Wasalt / Aqarmap / 3akarat / see [PORTAL-LIST-LOCK 2026-09-06] for the authoritative source list)

And it lets the agent triage the list in three shapes: **filter** (channel / source / assigned / unread / listing / date), **search** (full-text over body + contact name), and **sort** (newest / oldest / priority).

Success outcome: agent taps a row → AGT-INB-002 conversation detail opens with full message history and reply composer ready.

---

## Design goals

1. **One row = one glance = one decision.** The agent does not scan; they see. Avatar + name + channel + source + snippet + timestamp read as a single visual unit in under 250ms.
2. **Channel and source are always both visible.** Never conflate. A WhatsApp message from a Bayut listing is not the same as a WhatsApp message from a direct save on the agent's profile — they demand different reply framing. The dual-badge treatment (AGT-INB-005) is non-negotiable.
3. **Unread is signaled by weight + dot together — never by color alone.** Per Broadcast rule + accessibility.
4. **Mobile-first row density.** 72px row height on mobile (fits ~9 rows above the fold on a 375×812 viewport minus safe areas and filter chips). Tablet 64px. Desktop 56px with 2-column split (list + preview pane).
5. **Filter chips over dropdown menus for the top 3-5 filters.** Chips are one-tap, thumb-friendly, and show current state without needing to open a menu. Advanced filters (date range, listing) live in a filter sheet behind a chip.
6. **Merged-vs-separate is a SETTINGS decision, not a per-row decision.** Default: separate rows per channel per contact. Merged rows opt-in via AGT-SET-001. When merged, the row shows a badge cluster of all channels this contact has used, and the snippet is drawn from the most recent message across any channel.
7. **Bulk actions surface only when needed.** Selection mode is opt-in (long-press on mobile, checkbox on hover for tablet+desktop). The bulk-action bar slides in from the top only after ≥1 row is selected.
8. **Empty state is warm, not blank.** First-run agents see a friendly "no conversations yet — waiting for your first inquiry" hero with a link to onboard their WhatsApp intake channel (AGT-ONB-002).
9. **RTL Arabic first-class.** Row direction mirrors; badge cluster mirrors; timestamp swaps to the leading edge; masked identifiers stay LTR (email addresses, phone numbers).

---

## Layout

### Mobile ≤767px

Single column, edge-to-edge list. Reading top-to-bottom within a 375×812 viewport minus a 44px top safe-area and an 88px bottom-tab-bar zone.

**Zone 1 — Top bar (44px + safe area)**
- Left: nothing (the bottom-tab identifies this as Inbox).
- Center: search icon → tap expands into a full-width search input pushing the filter chips down (AGT-INB-001 does not use a persistent search bar on mobile — space is precious).
- Right: sort icon (`ArrowUpDown`), filter icon (`SlidersHorizontal` → opens filter sheet for advanced filters).

**Zone 2 — Filter chip row (48px + 8px top padding)**
- Horizontal scroll, snap-scroll off, `-webkit-overflow-scrolling: touch`.
- Chips in order: `Unread` · `Assigned to me` · `All channels` · `All sources` · `Any date` · `Any listing`.
- The 3rd and 4th chips (channels / sources) tap to open dropdowns showing the full channel + source lists.
- The 5th chip (date) taps to open a date-range picker sheet.
- The 6th chip (listing) taps to open a listing picker sheet backed by AGT-LST-001.
- Active chip: filled orange background. Inactive: outlined.

**Zone 3 — Sub-line (32px)**
- Left: unread count + assignment summary, e.g. `12 unread · 3 assigned to you` / `١٢ غير مقروء · ٣ مُسنَدة إليك`. Numerals via `<Numeric>`.
- Right: current sort label, e.g. `Newest first` (tap toggles).

**Zone 4 — Row list (rest of screen until FAB)**
- Each row 72px tall, edge-to-edge, bottom hairline divider only (no card borders).
- Row anatomy left-to-right:
  1. **Leading edge indicator column (8px)**: unread dot (8×8 filled orange) OR empty. Only rendered when row is unread.
  2. **Avatar (48×48)**: contact photo if known; otherwise initials on `--lc-surface-sunken` with a channel-colored ring if the contact is unknown/unrecognized.
  3. **Channel badge overlay (20×20)**: `<ChannelMark>` positioned bottom-right of the avatar, half-overlapping. Pairs `--lc-channel-{X}` with `-on` ink.
  4. **Content column (flex, min-width 0)**:
     - **Row 1**: contact name (or masked identifier — see §Masked identifiers below) + priority flame icon (if AI-scored high) + assignment icon (if assigned to another agent).
     - **Row 2**: last-message snippet, 1-line truncated. In merged mode, prefixed with `[Channel]:` to disambiguate which channel the snippet came from.
  5. **Trailing column (fixed 72px)**:
     - **Row 1**: timestamp (relative — `12m` / `2h` / `Yesterday` / `Mon` / `Sep 4`).
     - **Row 2**: source badge (`<SourceMark>` 20×20 chip — logo + short code).
- Long-press → enters selection mode (checkbox appears in place of the avatar; row background tints to `--lc-surface-selected`).

**Zone 5 — FAB (bottom-right)**
- 56×56 circular, `--lc-action-primary` fill, `Plus` icon.
- 24px from bottom-tab-bar; 24px from edge (RTL: 24px from leading edge).
- Tap → AGT-INB-003 compose modal.

**Zone 6 — Bulk action bar (appears when selection active)**
- Slides down from the top of Zone 3, covering the sub-line and filter chip row.
- 56px tall, `--lc-surface-inverse` background.
- Left: `X` close icon → exits selection mode. Then `{n} selected` counter.
- Right: action buttons — `Mark read` / `Mark unread` / `Assign…` / `Archive`. Overflow into a `MoreVertical` menu on narrow viewports.

### Tablet 768-1279px

Single-column list with a persistent header (search bar visible, no icon-collapse). Row height 64px. Filter chips row visible with 2 more chips inline (`Priority` and one advanced-filter shortcut).

### Desktop ≥1280px

Two-column split, 40/60:

**Left column (40%, min 380px, max 480px) — the list.**
- Header bar with H1 `Inbox`, sub-line, search bar (persistent), sort dropdown.
- Filter chip row underneath.
- List of rows, 56px each.
- FAB replaced by a `<Button variant="default">` labeled `Compose` in the header.

**Right column (60%) — inline conversation preview.**
- On first load: illustration + friendly nudge `Select a conversation to preview it here` / `اختر محادثة لعرضها هنا`.
- When a row is selected: AGT-INB-002 renders inline (message thread + reply composer). No route change — URL updates to `/inbox/:id` via history replace.
- Selection indicator on the list side: left-border `--lc-action-primary` 3px wide + row background `--lc-surface-sunken`.

**Bulk-action bar** on desktop docks to the top of the LEFT column only, so the preview stays reachable.

### Row anatomy at all viewports

Concretely, the row DOM order is:

```
[leading-dot] [avatar + channel-overlay] [name + priority + assign-icon]  [timestamp]
                                          [snippet]                        [source-badge]
```

Left-align on LTR; right-align on RTL. Timestamp + source badge column is always on the trailing edge.

---

## Masked identifiers (consent-not-obtained-yet)

Per data-privacy discipline: if the inbound message arrived from a channel where the contact's personal identifier is provider-scoped (e.g. an IG DM from a handle we haven't linked to a WingCaster contact yet, or an anonymous inbound web-widget submission), the row shows:
- **Name field**: masked identifier — for IG/FB/TikTok/X: `@handle` (as provided by the platform, which the user already made public on that platform); for email: `s***@example.com` (first character + asterisks + domain); for phone: `+971 5X *** **78` (country code + first digit + masked middle + last two).
- **Avatar**: initials fallback derived from the masked identifier's leading character, on a neutral `--lc-surface-sunken` background. **Never** display a scraped platform avatar unless the platform's terms explicitly permit it (per project honesty guardrail).
- **A small `<Lock>` icon** (12×12, `--lc-text-muted`) sits immediately before the masked name, communicating "we don't have consent to identify this contact yet." Tap → tooltip: "This contact hasn't opted in yet — reply to start the consent flow."

Once the contact accepts the consent handshake (per WingCaster's inbound-consent protocol, tracked in AGT-CTC-002 detail), the row auto-upgrades: full name, real avatar (if provided), no lock icon.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Screen title (tablet+desktop only) | Inbox |
| Sub-line | {n} unread · {m} assigned to you |
| Sub-line (solo agent) | {n} unread |
| Search placeholder | Search messages, contacts, listings… |
| Filter chip — unread | Unread |
| Filter chip — assigned to me | Assigned to me |
| Filter chip — all channels (inactive label) | All channels |
| Filter chip — channel active label | {ChannelName} |
| Filter chip — all sources (inactive label) | All sources |
| Filter chip — source active label | {SourceName} |
| Filter chip — any date | Any date |
| Filter chip — date active label | {DateRangeSummary} — e.g. "Last 7 days", "Sep 1 – Sep 4" |
| Filter chip — any listing | Any listing |
| Filter chip — listing active label | {ListingAddressShort} |
| Sort — newest | Newest first |
| Sort — oldest | Oldest first |
| Sort — priority | Highest priority first |
| Selection counter | {n} selected |
| Bulk action — mark read | Mark read |
| Bulk action — mark unread | Mark unread |
| Bulk action — assign | Assign… |
| Bulk action — archive | Archive |
| Bulk action — cancel | Cancel |
| FAB label (screen-reader) | Compose new conversation |
| Compose button (desktop) | Compose |
| Merged-mode snippet prefix | {Channel}: {snippet} |
| Empty state — headline | No conversations yet |
| Empty state — body | Every message from every channel lands here. Connect WhatsApp intake to catch your first inquiry. |
| Empty state — primary CTA | Connect WhatsApp intake → |
| Empty state — secondary CTA | Or compose one yourself |
| Preview pane placeholder (desktop) | Select a conversation to preview it here |
| Consent lock tooltip | This contact hasn't opted in yet — reply to start the consent flow. |
| Priority flame tooltip | Prioritized: {reason} — e.g. "hot lead, viewed listing 3× today" |
| Assignment icon tooltip | Assigned to {agentName} |
| Refreshing (pull-to-refresh label) | Refreshing… |
| Loading (initial) | Loading your inbox… |
| Load-more sentinel | Loading more… |
| Row action — mark read (swipe left, mobile) | Mark read |
| Row action — archive (swipe right, mobile) | Archive |
| Error state — headline | We couldn't load your inbox |
| Error state — body | Check your connection and try again. |
| Error state — CTA | Try again |
| Offline banner | You're offline. Showing the last sync — new messages will appear once you reconnect. |
| Merged-mode toggle (in filter sheet) | Merge conversations across channels per contact |
| Merged-mode helper | When on, the same contact who messages you on WhatsApp and Instagram appears as one row with a badge cluster. Change this in Settings anytime. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Row list | Virtualized list via `@tanstack/react-virtual` (already in use in listing surfaces) |
| Row container | `<button>` styled — the whole row is one focusable button |
| Avatar | `<Avatar>` + `<AvatarImage>` + `<AvatarFallback>` |
| Channel badge overlay | `<ChannelMark channel="...">` custom Broadcast primitive |
| Source badge | `<SourceMark source="...">` NEW custom Broadcast primitive — pairs a portal/source logo with a Broadcast chip shell |
| Priority flame | `Flame` from lucide-react |
| Assignment icon | `UserRound` from lucide-react |
| Consent lock | `Lock` from lucide-react, 12×12 |
| Unread dot | `<span>` styled — 8×8 filled circle |
| Filter chip row | `<ScrollArea>` (Radix) horizontal + `<Button variant="outline">` chips |
| Channel/source picker (from chip) | `<DropdownMenu>` for short list; `<Sheet>` (bottom sheet) for the long source list |
| Date range picker | `<Sheet>` containing `<Calendar>` (Radix) + presets |
| Listing picker | `<Sheet>` with `<Command>` (cmdk) autocomplete |
| Search bar | `<Input>` + `Search` icon prefix |
| Sort dropdown | `<DropdownMenu>` + `<DropdownMenuTrigger>` + items |
| Bulk action bar | Custom `<BulkActionBar>` component — `<Sheet side="top">` on mobile, docked absolute on desktop |
| Assign action | Opens AGT-INB-004 dropdown (reused component) |
| Selection checkbox | `<Checkbox>` (Radix) in place of the avatar during selection |
| FAB | Custom `<FloatingActionButton>` used elsewhere in agent shell |
| Compose modal | AGT-INB-003 (`<Dialog>` on desktop, `<Sheet>` on mobile) |
| Empty state | `<CmdEmptyState>` from `web/src/components/layout/CmdEmptyState.tsx` (already in use in InboxPage.tsx) |
| Skeleton | `<Skeleton>` from `web/src/components/ui/skeleton.tsx` |
| Pull-to-refresh | Custom hook + Capacitor bridge on native |
| Row swipe actions (mobile) | `react-swipeable` gestures + reveal-under buttons |
| Numeric wrappers | `<Numeric>` for every unread count, timestamp value, currency in the snippet, etc. |

---

## Sample content (for v0 / mockup)

Render the desktop 1440px light-mode default state with:

**List column (left 40%)**:
- Header: `Inbox` + sub-line `14 unread · 4 assigned to you` + persistent search bar + sort dropdown `Newest first`.
- Filter chip row: `Unread` (inactive) · `Assigned to me` (inactive) · `All channels` (inactive) · `All sources` (inactive) · `Any date` (inactive) · `Any listing` (inactive).
- Rows (8 shown, sample content):

| # | Contact | Channel | Snippet | Time | Source | Unread | Priority | Assigned |
|---|---|---|---|---|---|---|---|---|
| 1 | Sara Al-Mansoori (real avatar) | WhatsApp | "Is the 2BR in Downtown Dubai still available? Can I view Saturday morning?" | 12m | Bayut | ● | 🔥 | — |
| 2 | Ahmed Khoury (initials AK) | Email | "Following up on our conversation last week about the 4BR villa in Arabian Ranches…" | 47m | Direct | ● | — | — |
| 3 | @priya_home_search (masked, IG handle) | Instagram DM | "Hi! Saw your reel about the JVC 1BR — is it still available for 850k?" | 1h | Instagram (Agent profile) | ● | — | — |
| 4 | +971 5X *** **34 (masked phone) | SMS | "Please share brochure for the Palm listing" | 2h | Property Finder | — | — | — |
| 5 | Layla Haddad | WhatsApp | "Confirmed viewing for tomorrow 3pm. Thanks!" | 3h | Widget | — | — | Assigned to Omar |
| 6 | Fatima Al-Rashid | Facebook Messenger | "What are the service charges on this?" | 5h | Bazaar | ● | — | — |
| 7 | Yousef Ibrahim | Email | "Attached signed reservation form — please confirm receipt" | Yesterday | White-label site | — | — | — |
| 8 | @ali.property.hunt (masked, X handle) | X DM | "Interested in the Marina studio — what floor?" | Yesterday | X (Agent profile) | ● | 🔥 | — |

- Row 1 highlighted (selected/preview-active) with orange leading border + sunken background.

**Preview column (right 60%)**:
- AGT-INB-002 rendered inline for row 1's conversation. Show the WhatsApp thread with Sara Al-Mansoori, 4 messages visible, reply composer at the bottom with a "Reply from WhatsApp" indicator.

Second sample render: **mobile 375px empty state** — Ahmed, first-time, no conversations.
- Filter chips row + sub-line hidden.
- Empty state hero centered: `Inbox` icon → `No conversations yet` → body copy → `Connect WhatsApp intake →` primary CTA + `Or compose one yourself` secondary link.
- FAB visible bottom-right.

---

## Interactions

**On row tap:**
- Mobile: pushes AGT-INB-002 as a full-screen route change (`/inbox/:id`) with a 240ms slide-in.
- Tablet+desktop: replaces the preview column contents; URL updates to `/inbox/:id` via history replace (back button returns to `/inbox` list without preview).

**On row long-press (mobile) / row-hover-checkbox click (tablet+desktop):**
- Enters selection mode. Avatar swaps to a checkbox. Bulk-action bar slides down.
- Additional rows can be tapped to add to selection.
- Tapping the currently-highlighted row again removes it from selection.
- Bulk-action bar exit (X or Cancel) clears selection and slides back up.

**On row swipe-left (mobile):**
- Reveals `Mark read` action under the row. Full swipe commits; partial swipe snaps back.
- Undo toast for 5 seconds after commit.

**On row swipe-right (mobile):**
- Reveals `Archive` action. Full swipe archives (moves row out of default filter — appears again if user selects an "Archived" filter chip, which is available via the filter sheet).
- Undo toast for 5 seconds after commit.

**On filter chip tap:**
- If binary (Unread / Assigned to me): toggles the chip's active state and refetches immediately.
- If picker-backed (All channels / All sources / Any date / Any listing): opens the appropriate dropdown or sheet.
- Multiple chips can be active simultaneously (AND semantics). E.g. `Unread` + `WhatsApp` shows unread WhatsApp conversations.
- Clearing a chip: tap the active chip again to clear, OR tap the small `X` inside the active label.

**On sort dropdown change:**
- Swaps the current sort order. List re-orders with a 180ms fade-cross transition.

**On search input:**
- Debounced 250ms. Full-text search hits `/api/conversations/search?q=…` (backend must expose this — see §Backend contract).
- Results replace the row list while the query is active. Empty results show a `No matches for "{query}"` state with a `Clear search` CTA.
- Escape clears the input and returns to the filtered list.

**On pull-to-refresh (mobile):**
- Fetches the latest page of conversations. Native-feeling spinner.
- Also refetches unread counts + assignment summary.

**On scroll near the list bottom:**
- Infinite scroll: fetches the next page (25 rows per page). Load-more sentinel shows `Loading more…` skeleton row.

**On FAB tap:**
- Opens AGT-INB-003 compose modal.

**On Compose (desktop):**
- Same as FAB — opens AGT-INB-003 as a `<Dialog>`.

**On merged-mode toggle (in filter sheet):**
- Immediately re-groups the list. Rows collapse: e.g. rows 1 (WhatsApp) and 6 (Facebook Messenger) become one row if both were from the same contact — the row shows a badge cluster (2 channels) and the snippet is drawn from the most recent message across any channel.
- The toggle persists via `PATCH /api/agent-preferences { inbox_merge_mode: "merged" | "separate" }` (default `separate`).

**On selecting an active channel filter chip via the picker:**
- Opens a bottom sheet (mobile) or dropdown (tablet+desktop) with the channel list. Multi-select is supported — active channels appear as a chip cluster inside the filter chip.

**On selecting an active source filter chip via the picker:**
- Same pattern. Source list is long — grouped by region (UAE / KSA / Egypt / Lebanon / Other) per `PORTAL_LIST_RESEARCH_2026-09-04.md`.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial load** | Route mount | Skeleton (8 rows) + filter chip row skeleton. Fetches page 1 + unread counts. |
| **Loaded — has conversations** | Fetch success, ≥1 row | Renders row list. Default sort: newest first. Default filters: none active (shows everything the agent can see per tenant + assignment scope). |
| **Loaded — empty** | Fetch success, 0 rows AND no active filters | Empty state hero (see §Explicit copy). |
| **Loaded — empty via filter** | Fetch success, 0 rows WITH active filters | Different empty state: `No conversations match your filters` + `Clear filters` CTA + list current filters. |
| **Search active** | User typed ≥2 chars | Replaces row list with search results. Shows `Search: "{query}"` chip at top of results. |
| **Search — no matches** | Search returns 0 rows | `No matches for "{query}"` + `Clear search` CTA. |
| **Selection mode** | User long-pressed (mobile) or checked a row (desktop) | Avatar → checkbox. Bulk-action bar visible. Row tap adds/removes from selection. |
| **Preview open (desktop)** | User selected a row | Right column shows AGT-INB-002. List column shows selected-row highlight. |
| **Merged mode** | `inbox_merge_mode = "merged"` in preferences | Rows are contact-grouped, not channel-grouped. Badge cluster (up to 3 channel marks + `+n` overflow) on each row. |
| **Priority-sorted** | Sort = `priority` | Rows re-ordered by server-provided `priority_score`. Priority flame visible on high-scored rows. |
| **Loading more (infinite scroll)** | Bottom-sentinel visible | Load-more skeleton row at the list bottom. |
| **Refreshing** | Pull-to-refresh triggered | Spinner at top for the duration of the refetch. |
| **Row action — mark-read undo pending** | User just marked read | Row temporarily still in list (5s) with an undo toast — commits after 5s or on next filter/route change. |
| **Row action — archive undo pending** | User just archived | Same pattern. |
| **Bulk action in flight** | User confirmed a bulk action | Bar shows spinner + disabled state. On success, rows update in place; on failure, destructive toast + rollback. |
| **Offline (cached)** | Network unreachable | Top banner: `You're offline. Showing the last sync — new messages will appear once you reconnect.` Row list shows cached data (from IndexedDB via Capacitor storage). Compose FAB disabled; long-press swipe actions queue locally. |
| **Error — initial fetch** | 500 or timeout on first load | Error state hero: `We couldn't load your inbox` + `Try again` CTA. |
| **Error — pagination** | 500 on load-more | Inline toast at the bottom of the list: `Couldn't load more — tap to retry`. |
| **RTL** | Locale = ar | Whole layout mirrors. Row anatomy: leading unread dot on the right; avatar+channel-overlay next; content column; trailing timestamp+source on the left. Masked identifiers (emails, phones, handles) stay LTR. |
| **Dark mode** | `prefers-color-scheme: dark` | All tokens swap. Row surface `--lc-surface-raised` remaps to the dark equivalent (`#1C2749`). Unread dot stays orange (`--lc-action-primary` in dark = `#FF7440`). |
| **Compact viewport (mobile landscape)** | height < 500px | Filter chip row collapses into a single `Filters (n)` chip that opens a bottom sheet. Sub-line hidden. |
| **New message arrives (real-time)** | WebSocket push | New row inserts at the top with a 180ms fade-in. Unread count in the sub-line increments. Bottom-tab-bar Inbox badge increments. No auto-scroll (agent may be reading; don't disrupt). |
| **Row updated in place (real-time)** | WebSocket push (reply arrives on an existing conversation) | Row's snippet + timestamp update in place. Row re-orders if sort=newest. Unread dot appears if unread. |

---

## Accessibility

- Every row is a `<button>` with an `aria-label` combining name + channel + source + timestamp + unread state: e.g. `Sara Al-Mansoori · WhatsApp from Bayut · 12 minutes ago · unread · priority`.
- Filter chips are `role="button"` with `aria-pressed` reflecting active state.
- Search input has `aria-label="Search inbox"` and results announce via `aria-live="polite"`: `{n} conversations found`.
- Bulk-action bar appearance announces via `aria-live="assertive"`: `Selection mode. {n} conversations selected.`
- Sort changes announce via `aria-live="polite"`: `Sorted by {sortLabel}`.
- Selection checkbox has `aria-label` combining `Select conversation with {name}`.
- Unread state is conveyed by BOTH font-weight (600) AND the dot AND the aria-label — never color-alone.
- Priority flame + assignment + consent-lock icons are each accompanied by `aria-label` and tooltips.
- Focus order: search → sort → filter chips (left-to-right, or right-to-left in RTL) → sub-line (not focusable) → first row → next row → … → FAB / Compose.
- Escape key: exits selection mode, or clears search when search is focused.
- Keyboard row navigation: Up/Down arrows move focus between rows; Enter opens the conversation; Space toggles selection.
- All tap targets ≥ 44×44 CSS pixels including filter chips on mobile.
- Reduced-motion honored: row inserts snap rather than fade; bulk-action bar snaps rather than slides.
- Skip-to-content link jumps past the top bar into the row list.

---

## Merged-vs-separate mode (deep dive per user OQ3)

The default per project decision is **separate**: same-contact-across-channels remain distinct rows. Rationale: a phone-first contact and an IG-first contact are behaviorally different leads even when they're the same human; agents want to see channel-level flow. Merged is opt-in.

**Where the toggle lives:**
- Primary: AGT-SET-001 (Agent settings home) → "Inbox behavior" section → toggle `Merge conversations across channels per contact`.
- Secondary shortcut: AGT-INB-001 filter sheet → "Display" section → same toggle. Both write to the same `agent_preferences.inbox_merge_mode` scoped tenant × agent.

**When merged mode is ON:**
- Row is contact-scoped, not conversation-scoped.
- Contact identifier is the merge key: `contact_id` when known; otherwise a stable hash of the earliest normalized identifier per PR #49 identity normalization.
- **Row anatomy**: avatar + name + a badge CLUSTER (leftmost single primary channel + additional channels as small 16×16 marks in a horizontal strip, up to 3 visible + `+n` overflow chip). The primary channel is the one where the most recent message arrived.
- **Snippet**: drawn from the most recent message across any channel, prefixed with `[Channel]:` to disambiguate. E.g. `WhatsApp: Is the 2BR still available?` or `Email: Following up on…`
- **Source badge**: shows the source of the most recent message. Cluster tooltip lists all sources across all channels.
- **Timestamp**: reflects the most recent message across any channel.
- **Unread dot** appears if ANY conversation in the cluster is unread.
- **Row tap** in merged mode: opens AGT-INB-002 with a channel switcher at the top of the conversation view (each channel shows its own thread; agent can switch between them without leaving the contact).

**When merged mode is OFF (default):**
- Row is conversation-scoped. Same contact + different channel = separate rows.
- No snippet prefix. Single channel badge overlay on the avatar.
- Row tap opens AGT-INB-002 for that specific conversation.

**Migration between modes:**
- Switching modes does NOT change backend data — it's a client-side rendering decision. Backend always returns the raw conversation list; client groups.
- Switching modes preserves the current filter chip selections.
- Toggle triggers a fade-cross transition on the list (240ms).

---

## Anti-patterns (do not do these)

- ❌ Do not conflate channel and source. A WhatsApp message from Bayut is not the same as a WhatsApp message from Direct — both badges must always be visible on every row.
- ❌ Do not use color alone to signal unread. Weight + dot together. Per Broadcast rule.
- ❌ Do not use a scraped platform avatar for masked-identifier rows. Initials + consent-lock icon. Per honesty guardrail.
- ❌ Do not auto-scroll the list when a new message arrives via WebSocket. Insert at top; let the agent choose to scroll.
- ❌ Do not show a KPI grid at the top of the inbox (`Total inquiries · Response rate · Conversion`). That's Pro-mode density (AGT-DSH-002 territory). Inbox leads with the list.
- ❌ Do not render more than 4 filter chips before the first "picker" chip on mobile. Keep the primary row scannable in one glance.
- ❌ Do not treat the search bar as a filter. Search REPLACES the list; filters COMPOSE with the list.
- ❌ Do not open a full-page modal to switch merged/separate mode. It's a toggle in Settings + a secondary shortcut in the filter sheet — no dedicated screen.
- ❌ Do not display "Now" as a timestamp — smallest granularity is `<1m` / `just now`. Confusing to see many "Now" rows during a burst.
- ❌ Do not use amber/orange for the unread dot AND for priority flame — reserve orange (`--lc-action-primary`) for unread; use `--lc-status-danger-fg` (red-orange) for priority. Otherwise the two collapse visually.
- ❌ Do not show the assignment icon for the current agent's own conversations — visual noise. Only render when someone ELSE owns the row.
- ❌ Do not fabricate portal-source logos. Use SVGs sourced from official brand kits per PORTAL-LIST-LOCK, or a plain wordmark chip if the logo is unlicensed.
- ❌ Do not silently drop rows in merged mode. If merging surfaces N conversations under 1 row, the row must reflect that (badge cluster count + `View {n} channels` in the AGT-INB-002 header).

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Front (frontapp.com)** — the reference standard for unified multi-channel inbox rows. Row density, channel-badge treatment, assignment indicator patterns.
- **Missive** — merged-vs-separate handling; contact-scoped grouping.
- **Superhuman inbox** — keyboard navigation + row density on desktop.
- **Slack DMs** — presence indicator + assignment cues (not our exact use, but pattern-transferable).
- **Bayut / Property Finder agent apps** — MENA baseline for portal-source recognition. Agents should feel the source logos are familiar.
- **Notion inbox (post-2024 redesign)** — filter chip row pattern; empty state warmth.

Do NOT match:
- Gmail (too dense, too many actions, wrong altitude).
- Outlook (too many folders, wrong tenancy model).
- WhatsApp Business (single-channel; misses the point of unified inbox).
- Salesforce Service Cloud (enterprise heavy; agent-first is different).

---

## Backend contract

**List endpoint:** `GET /api/conversations`

**Query params:**
```
?tenant_id=<uuid>              // implied from session tenant context
&channel=<code>[,<code>...]     // filter — comma-separated channel codes (whatsapp,email,sms,instagram_dm,messenger,tiktok,x,linkedin,telegram,wingcaster_webhook)
&source=<code>[,<code>...]      // filter — comma-separated source codes (direct,agent_profile,agency_profile,white_label,widget,bazaar,olx,bayut,property_finder,dubizzle,aqar,wasalt,aqarmap,3akarat,...)
&assigned=<me|anyone>           // filter — assignment scope
&unread=1                       // filter — unread only
&listing_id=<uuid>              // filter — conversations linked to a specific listing
&from=<iso8601>&to=<iso8601>    // filter — date range on last_message_at
&sort=<newest|oldest|priority>  // sort order
&page=<n>&limit=<25>            // pagination
```

**Response 200:**
```json
{
  "conversations": [
    {
      "id": "conv_...",
      "contact_id": "contact_...",
      "contact_name": "Sara Al-Mansoori",
      "contact_masked": false,
      "contact_avatar_url": "https://...",
      "channel": "whatsapp",
      "source": "bayut",
      "assigned_agent_id": "agent_...",
      "assigned_agent_name": "Omar Fadel",
      "linked_listing_id": "listing_...",
      "linked_listing_label": "2BR · Downtown Dubai",
      "last_message_at": "2026-09-08T09:12:00Z",
      "last_message_preview": "Is the 2BR still available? Can I view Saturday morning?",
      "unread_count": 2,
      "is_unread_by_agent": true,
      "priority_score": 87,
      "priority_reason": "hot lead, viewed listing 3× today",
      "status": "open"
    }
    // ... 24 more per page
  ],
  "page": 1,
  "total_pages": 12,
  "unread_count_total": 14,
  "assigned_to_me_count": 4
}
```

**Search endpoint:** `GET /api/conversations/search?q=<query>&limit=25`

Same shape as list response but with `snippet_highlights` added per conversation:
```json
"snippet_highlights": [
  { "message_id": "msg_...", "excerpt": "…still available? Can I view <mark>Saturday morning</mark>?" }
]
```

**Bulk update:** `POST /api/conversations/bulk`
```json
{
  "conversation_ids": ["conv_a", "conv_b", "conv_c"],
  "action": "mark_read" | "mark_unread" | "assign" | "archive",
  "assign_to_agent_id": "agent_..." // required only when action=assign
}
```

Response: `{ "updated": 3, "failed": [] }` or `{ "updated": 2, "failed": [{"conversation_id":"conv_c","error":"PERMISSION_DENIED"}] }` on partial.

**Agent preferences endpoint:** `PATCH /api/agent-preferences`
```json
{ "inbox_merge_mode": "merged" | "separate" }
```

**WebSocket topic:** `ws:/tenant/<tenant_id>/inbox`
- Event `conversation.created` — new conversation → prepend row
- Event `conversation.updated` — snippet/timestamp/unread changed → update in place
- Event `conversation.assigned` — assignment changed → refresh assignment icon
- Event `conversation.archived` — remove from default filter view

**Backend prerequisite: [BE-BLOCKER-04].** Per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md §5 [BE-BLOCKER-04]`, `conversations.source_channel` must be decomposed into `channel` + `source`. This brief assumes that migration has landed:
- Migration adds `channel TEXT` and `source TEXT` columns to `conversations`.
- Backfill: parse existing `source_channel` values; where the string maps to a known transport (`whatsapp`, `email`, `sms`, `instagram_dm`, etc.), copy to `channel` and set `source = 'direct'` (safe default). Where it maps to a source-shape string, log and hand-triage.
- Dual-read window: API returns both `source_channel` (legacy) and `channel` + `source` (new) for the migration window; 14 code sites migrate incrementally.
- Index: replace `idx_conversations_source_channel` with `idx_conversations_channel` and `idx_conversations_source`.

**Full-text search prerequisite.** If not already present, add:
- GIN index over `to_tsvector('simple', conversation_messages.content)`.
- GIN index over `contacts.name`.
- A backend `/api/conversations/search` route that unions matches across both.

**Agent preferences prerequisite.** If `agent_preferences` table doesn't have an `inbox_merge_mode` column, add it: `TEXT DEFAULT 'separate' CHECK (inbox_merge_mode IN ('merged','separate'))`.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to refactor:** `web/src/pages/InboxPage.tsx` — significant rewrite. Current implementation:
  - Uses a single `source_channel: string` field. **This will conflict** with [BE-BLOCKER-04] decomposition. See §Conflict note in the response summary.
  - Uses a legacy channel-labels map at `CHANNEL_LABELS` — replace with `<ChannelMark>` + `<SourceMark>` primitives.
  - Renders a two-column desktop split (list + preview) which is the CORRECT baseline shape — preserve it, but modernize the row rendering, add the filter chip row, add bulk actions, add the source-badge column.
  - `activeConversation.source_channel` on line ~449 is used in the preview-pane header — must be split into channel + source display.

- **Route:** already `/inbox` in `web/src/App.tsx`. Add query-param handlers for filter state persistence (deep-linking).

- **Component decomposition:**
  - `InboxPage.tsx` — orchestrator + data fetching + WebSocket subscription.
  - `<InboxFilterChipRow>` — the horizontal-scroll chip strip + chip pickers.
  - `<InboxSubLine>` — unread count + assignment summary + sort dropdown.
  - `<InboxRow>` — one row rendering; handles merged/separate mode internally.
  - `<InboxRowSelectionCheckbox>` — swap-in for the avatar in selection mode.
  - `<InboxBulkActionBar>` — the top-docked bar with actions.
  - `<InboxEmptyState>` — variants for first-run vs filter-empty vs search-empty.
  - `<InboxPreviewPane>` (desktop only) — hosts AGT-INB-002 inline.
  - `<SourceMark source="...">` — NEW Broadcast primitive; complements `<ChannelMark>`.
  - `<InboxSearchInput>` — the debounced search bar.
  - `<InboxSortDropdown>` — sort control.

- **State management:** `useSearchParams` for filter/sort/search state (already used in existing InboxPage.tsx). Local state for selection mode. WebSocket via existing `useConversationsRealtime` hook (create if missing).

- **Test discipline:**
  - Unit: each of the 9 components renders + state transitions. Row anatomy in all 4 modes (default, merged, selection, masked-identifier).
  - Integration: full inbox flow — load, filter, search, sort, select, bulk-action, open preview, WebSocket update.
  - Real-Postgres: verify channel+source columns render correctly post-BE-BLOCKER-04.
  - RTL: `screens.rtl.test.tsx` extension with an inbox RTL scenario.
  - Accessibility: axe pass on all state variants; keyboard-nav path verified.

- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green. `<SourceMark>` MUST NOT introduce new color primitives — source-logo backgrounds are all `--lc-surface-sunken`; only the logo SVG itself may carry its brand color inside the chip. Cluster the source-logo SVGs under `web/src/components/broadcast/source-marks/` mirroring the existing `channel-marks/` folder pattern.

- **Data migration:** during the [BE-BLOCKER-04] dual-read window, InboxPage.tsx MUST prefer `channel` + `source` when both are present; fall back to `source_channel` for rows still legacy. Delete the fallback branch when the dual-read window closes.

- **RTL:** verify swipe directions (swipe-left → mark-read, swipe-right → archive) mirror correctly in RTL. Timestamp + source-badge column mirrors to the leading edge.

- **Performance:** row virtualization mandatory. First-paint budget: 8 skeleton rows within 100ms of route mount. Data-loaded budget: first real row visible within 400ms on mid-range Android.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Row background: `--lc-surface-raised`. Hover (tablet+desktop): `--lc-surface-sunken`. Selected: `--lc-surface-sunken` + 3px leading border `--lc-action-primary`.
- Row divider: 1px `--lc-border` on the bottom edge only. No shadow between rows.
- Contact name: `var(--lc-type-body)` — 400 weight unread=false; 600 weight unread=true.
- Snippet: `var(--lc-type-body-sm)` in `--lc-text-muted`. Never `--lc-text-primary` — the muted tone is the visual hierarchy signal.
- Timestamp: `var(--lc-type-caption)` mono, `tabular-nums`, `--lc-text-muted`.
- Unread dot: 8×8 `--lc-action-primary` filled circle. `var(--lc-radius-pill)`.
- Channel badge overlay: uses `<ChannelMark>` primitive; do NOT re-invent.
- Source badge: uses `<SourceMark>` primitive (new); chip shell `--lc-surface-sunken` bg + `--lc-border` outline + `var(--lc-radius-sm)` corner.
- Priority flame: `Flame` lucide, 14×14, `--lc-status-danger-fg` fill. Not `--lc-action-primary` (avoid orange clash with unread dot).
- Assignment icon: `UserRound` lucide, 14×14, `--lc-text-muted`.
- Consent lock: `Lock` lucide, 12×12, `--lc-text-muted`.
- Filter chip active: `--lc-action-primary` fill + `--lc-action-primary-text` ink. Hover DARKENS to `--lc-action-primary-hover`.
- Filter chip inactive: `--lc-border` outline + `--lc-text-primary` ink + transparent bg.
- Search input: `--lc-border-strong` outline, focus via two-tone ring (base CSS — do not override).
- Bulk-action bar: `--lc-surface-inverse` bg + `--lc-text-inverse` ink. Buttons `<Button variant="ghost">` with `--lc-text-inverse` override.
- FAB: `--lc-action-primary` fill + `--lc-elevation-lg`. On press: darken to `--lc-action-primary-hover`.
- Empty state icon: `--lc-text-muted`.
- Empty state headline: `var(--lc-type-heading-3)`.
- Skeleton: `--lc-surface-sunken` base + subtle animate-pulse. Do NOT use gradient shimmers.
- Motion: row insert on real-time push = `--lc-duration-base` (180ms) fade-in `--lc-easing-out`. Bulk bar = `--lc-duration-slow` (240ms). Selection tint = `--lc-duration-fast` (120ms). Sort re-order = `--lc-duration-base` fade-cross.
- Radii: chip = `var(--lc-radius-pill)`; source chip = `var(--lc-radius-sm)`; input = `var(--lc-radius-md)`; row (tablet+desktop) = `var(--lc-radius-md)`; FAB = full circle via `var(--lc-radius-pill)`.
- Focus rings: two-tone via base CSS on every focusable element — do not override.
- **Signal lamp motif: DO NOT use here.** Reserved for AGT-DSH-001 "listing went live" moment per Broadcast alignment reference.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Unified Inbox screen (AGT-INB-001) — MENA real-estate B2B SaaS. This is the ANCHOR screen for the entire AGT-INB family (list, detail, compose, assign, dual-badge treatment). Every inbound conversation from every channel and every source lands here. Persona: real estate agent. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind + Broadcast design tokens (--lc-*).

First pass: render the DESKTOP 1440px light-mode default state with the two-column split — left 40% list, right 60% preview. Show 8 conversation rows with realistic MENA content (see the Sample content section). Row 1 highlighted with the preview pane showing that conversation inline. Filter chip row with all 6 chips visible and inactive. Search bar persistent. Sort dropdown showing "Newest first".

LTR English only for this pass — I'll ask for mobile 375px, RTL Arabic, dark mode, empty state, selection mode, merged mode, and search state as separate follow-ups.

Every row MUST show BOTH a channel badge (WhatsApp / Email / SMS / etc. — overlay on the avatar) AND a source badge (Bayut / PF / Direct / Widget / Bazaar / etc. — chip on the trailing edge). Do NOT conflate the two. Do NOT use color-alone for unread — use font-weight 600 + a filled orange dot.

Follow the copy table exactly. Do not fabricate contact photos.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now switch to mobile 375px viewport, same 8 rows. FAB visible bottom-right. Filter chips horizontal-scroll.`
2. `Now show the mobile empty state — no conversations yet. Empty hero centered.`
3. `Now selection mode on mobile — 3 rows selected, bulk-action bar docked to the top.`
4. `Now merged mode on desktop — rows 1 and 6 combine into one contact-grouped row with a badge cluster (WhatsApp + FB Messenger) and the snippet prefixed "WhatsApp: …".`
5. `Now search state — search bar shows "downtown dubai", results are 2 rows with highlighted snippets.`
6. `Now RTL Arabic layout at desktop 1440px. Whole layout mirrors. Masked identifiers stay LTR.`
7. `Now dark mode versions of desktop LTR and mobile LTR.`
8. `Now a masked-identifier row — @handle from Instagram DM with a consent lock icon.`
9. `Now the filter sheet open (mobile) — showing the merged-mode toggle, date range picker, and advanced filters.`

Save each output's JSX to `docs/design/mockups/v0-outputs/AGT-INB-001/` + screenshot to `docs/design/mockups/AGT-INB-001-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 9 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/AGT-INB-001/`.
- [ ] Cursor Week 8+ dispatch prompt references this brief + the mockup paths + companion AGT-INB-002 brief + AGT-INB-005 dual-badge treatment brief.
- [ ] `[BE-BLOCKER-04]` migration verified landed before this brief is dispatched to Cursor.
- [ ] `<SourceMark>` primitive scaffolded under `web/src/components/broadcast/` in advance of the row rewrite.
- [ ] Existing `InboxPage.tsx` `source_channel` references (lines 37, 404, 405, 449) migrated to `channel` + `source` reads.
- [ ] Full-text search endpoint `/api/conversations/search` scoped and confirmed in backend backlog.
- [ ] Agent-preferences `inbox_merge_mode` column scoped and confirmed in backend backlog.
