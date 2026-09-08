# Screen Brief — SHR-NAV-008 · Tenant switcher

**Layer-2 Brief for design AI consumption (v0 by Vercel — locked per D-S-03).**

Companion to `SCREEN_MATRIX_SHARED.md` entry `SHR-NAV-008`. This brief is what you paste into v0 to get a compelling mockup — with explicit copy, layout, components, sample content, and interaction rules.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references use the semantic `--lc-*` tokens per the alignment reference. No raw hex — the `no-raw-hex` test enforces this.

**Screen-specific Broadcast callouts:**
- Trigger button surface: `--lc-surface-elevated` fill, `--lc-border` outline. Hover: `--lc-surface-elevated-hover` (deeper). Active/open: `--lc-action-primary-subtle` background.
- Trigger label typography: `font: var(--lc-type-body)` — Inter 500 14/20. Tenant name is `font-weight: 600`; role suffix is `--lc-text-muted`.
- Popover: `--lc-surface-elevated` fill, `--lc-shadow-md` shadow, `--lc-radius-md` corners. Border: `1px solid --lc-border`.
- Search input inside popover: standard `<Input>` primitive, `--lc-surface-inset` fill.
- Row hover: `--lc-surface-hover` background.
- Active-tenant checkmark: `--lc-status-success` fill.
- Role pill on each row (Owner / Admin / Manager / Member / Viewer): `--lc-badge-*` per role — Owner uses `--lc-badge-emphasis`, others use `--lc-badge-neutral`.
- Focus ring: automatic two-tone from base CSS.
- Numerics (member count, listing count on each row): wrap in `<Numeric>` for `tabular-nums`.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-NAV-008 |
| Screen name | Tenant switcher |
| Persona | Every authenticated user (agent, agency admin, PA) |
| Device targets | Mobile 375px (compact popover), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | Not a route — a component embedded in `SHR-NAV-001` (top bar) |
| Current state | MISSING — verified: grep on `TenantSwitcher\|currentTenant\|switchTenant` in `web/src` returns zero files. Backend schema exists at migration `028_tenant_authorization_foundation.sql`. |

---

## Purpose (one sentence)

Give a user who belongs to more than one tenant (personal + one-or-more agencies) a fast, obvious way to switch the whole app's context to a specific tenant — and give single-tenant users no friction (the switcher collapses into a static label).

---

## Product context the AI needs

- **Wingcaster is multi-tenant.** A person is a `user` who owns a `personal` tenant by default. When they join or create an agency, they become a `member` of that agency's tenant with a role (owner / admin / manager / member / viewer per capability-pack RBAC — see migration 028).
- **Every authenticated screen renders under a selected tenant.** Listings, contacts, campaigns, credits, subscription — all scoped to the currently active tenant.
- **Without this component the entire agency persona is unreachable.** Agents who joined an agency land in their personal tenant and cannot see agency listings; agency owners create an agency but can never manage it. The audit called this "platform-wide architecture breaker" — correctly.
- **This is not a data screen — it's platform chrome.** The switcher is always present in `SHR-NAV-001` top bar. Users interact with it seconds after sign-in and never think about it again unless they switch.
- **MENA-specific consideration:** many agents run TWO simultaneous personas — solo (personal tenant, side listings) + agency (their day job). The switch is a daily activity for them, not a rare one.

---

## Layout — desktop ≥1024px

The trigger lives on the LEFT side of `SHR-NAV-001` (top bar), immediately to the right of the WingCaster wordmark.

### Trigger (collapsed state)
- 40px tall pill, auto width (max 280px, text-truncates with ellipsis mid-name).
- Left: 24px avatar / mark (tenant avatar if uploaded, otherwise initials on a Broadcast-token-colored background derived from tenant id).
- Middle: **Tenant display name** (weight 600) on line 1; **role in that tenant** on line 2 in `--lc-text-muted`, `var(--lc-type-caption)`.
- Right: `ChevronsUpDown` icon from lucide-react — 16px, `--lc-text-muted`. Hover: `--lc-text`.
- Inline padding: 8px logical-start (avatar), 12px between avatar+text, 12px between text+chevron, 8px logical-end.
- Cursor: pointer. Whole pill is one click target.
- ARIA: `aria-haspopup="listbox"`, `aria-expanded`, `aria-label="Switch tenant. Currently {tenantName}, {roleLabel}."`

### Popover (open state)
- Anchored below the trigger, aligned to the logical-start edge. Width: `min(360px, calc(100vw - 32px))`. Max height: `min(480px, calc(100vh - 120px))`.
- **Header row inside popover:**
  - Label: "Switch to" (uppercase, `var(--lc-type-caption)`, `--lc-text-muted`).
  - Right side of header: small "Manage tenants →" link (only for users who own more than one tenant), goes to `AGT-SET-001` or `AGN-SET-001` per active persona.
- **Search input** (only shown when the user has ≥ 5 tenants):
  - Full-width, `<Input>` with `Search` icon prefix. Placeholder: "Filter tenants…".
  - Filters the list live by name (case-insensitive, substring).
- **Tenant list** (vertical stack):
  - One row per tenant the user has access to.
  - Row height: 56px. Row layout:
    - Left: 32px avatar / initials mark.
    - Middle: line 1 = tenant name (weight 600); line 2 = role pill + supporting metric ("12 listings", "3 agents", "You + 4 others") in `--lc-text-muted`.
    - Right: `Check` icon (`--lc-status-success`) only on the currently active row.
  - Row states: idle / hover (`--lc-surface-hover`) / active (subtle `--lc-action-primary-subtle` background + check icon) / focus (two-tone ring).
  - Row click = commit switch (no confirmation modal).
- **Personal tenant row is always first** in the list, separated from agency tenants by a subtle `<Separator>` if there are any agency memberships.
- **Empty state (impossible in v1 — every user has personal tenant, so document but never render).**
- **Footer row** inside popover:
  - Two links stacked or side-by-side: "Create a new agency" (→ SHR-AUT-006 path c re-entered) and "Apply to join an agency" (→ SHR-AUT-006 path b re-entered).
  - `var(--lc-type-caption)`, `--lc-action-primary`.

## Layout — tablet 768px

Same as desktop. Trigger stays in the top bar.

## Layout — mobile 375px

- Trigger stays in `SHR-NAV-001` top bar but COLLAPSES to just the tenant avatar + chevron (no text — tap target 40×40).
- Tap opens a bottom sheet (not a popover), full-width, dragging up reveals the search input.
- Bottom sheet has the same content as the desktop popover but stacked full-width with 44px row heights.
- Safe-area inset at the bottom.
- Backdrop: `--lc-scrim`. Tap outside sheet to dismiss.

### RTL variant
- Everything mirrors. Chevron stays vertical. Check icon flips to the logical-end side. Search input's icon flips.
- Arabic tenant names render in `IBM Plex Sans Arabic`. Personal tenant name may be a mix (English name + Arabic city, e.g. "Sara — دبي") — mixed-directional text needs `<bdi>` wrapping.

---

## Explicit copy (all strings, EN + AR)

| Key | EN | AR |
|---|---|---|
| `trigger.aria` | Switch tenant. Currently {tenantName}, {roleLabel}. | تبديل الحساب. الحالي {tenantName}، {roleLabel}. |
| `popover.header` | Switch to | التبديل إلى |
| `popover.manage` | Manage tenants → | إدارة الحسابات ← |
| `popover.search` | Filter tenants… | تصفية الحسابات… |
| `popover.footer.create` | Create a new agency | إنشاء وكالة جديدة |
| `popover.footer.join` | Apply to join an agency | التقديم للانضمام إلى وكالة |
| `role.owner` | Owner | مالك |
| `role.admin` | Admin | مسؤول |
| `role.manager` | Manager | مدير |
| `role.member` | Member | عضو |
| `role.viewer` | Viewer | مشاهد |
| `personalTenant.name` | {userDisplayName} (personal) | {userDisplayName} (شخصي) |
| `personalTenant.role` | You | أنت |
| `metric.listings.one` | 1 listing | إعلان واحد |
| `metric.listings.other` | {count} listings | {count} إعلان |
| `metric.agents.one` | 1 agent | وكيل واحد |
| `metric.agents.other` | {count} agents | {count} وكلاء |
| `metric.youplus.one` | You + 1 other | أنت + شخص آخر |
| `metric.youplus.other` | You + {count} others | أنت + {count} آخرون |
| `toast.switched` | Switched to {tenantName}. | تم التبديل إلى {tenantName}. |
| `error.switchFailed` | Couldn't switch tenants. Please try again. | تعذّر تبديل الحساب. يرجى المحاولة مرة أخرى. |

Copy voice: warm, direct, no exclamation marks, no "Oops".

Arabic pluralization uses CLDR rules (`one` / `other` at minimum; add `zero` / `two` / `few` / `many` for Arabic-specific plural categories if the ICU library supports them).

---

## Component palette

Use these exact primitives from `web/src/components/ui/*`:

- `<Popover>` (Radix) for desktop + tablet
- `<Sheet>` for mobile bottom sheet
- `<Input>` with `<Label>` for search
- `<Separator>` between personal and agency rows
- `<Badge>` for role pills
- `<Numeric>` wrapper for metric numbers (tabular-nums)

Icons from `lucide-react`:
- `ChevronsUpDown` (trigger chevron)
- `Check` (active row indicator)
- `Search` (search input prefix)
- `Building2` (agency tenant avatar fallback)
- `User` (personal tenant avatar fallback)
- `Plus` (create agency footer link)
- `UserPlus` (join agency footer link)

---

## Sample content for the AI to render against

Render against a user with THREE tenants:

**1. Personal tenant (active)**
- Avatar: `SA` on a warm gold token background
- Name: "Sara Almansoori (personal)"
- Role pill: `You`
- Metric: "3 listings"
- Check icon on right

**2. Agency tenant — Elite Real Estate (owner)**
- Avatar: uploaded logo (small building icon fallback)
- Name: "Elite Real Estate"
- Role pill: `Owner` (emphasis badge)
- Metric: "You + 4 others · 47 listings"

**3. Agency tenant — Dubai Properties Consortium (member)**
- Avatar: uploaded logo
- Name: "Dubai Properties Consortium"
- Role pill: `Member`
- Metric: "You + 22 others · 213 listings"

**Search-filtered state:**
- User types "elite" → only Elite Real Estate row visible + personal row hidden. "No matches" is NOT shown while at least one row remains; if the search filters to zero rows, show empty state "No tenants match '{query}'".

**RTL variant:**
- Same three tenants but with an Arabic name for Elite: "إليت العقارية".

---

## Interactions

- **Trigger click** — opens popover / bottom sheet with 180ms ease-out fade + subtle scale-up (0.98 → 1.0). Focus moves to search input if present, otherwise to the first (active) row.
- **Row click** — commit switch: send `POST /api/auth/switch-tenant` (new endpoint, see downstream notes), show a full-screen `--lc-scrim` overlay with a small spinner for max 500ms while the app re-fetches tenant-scoped data, then dismiss with a toast: "Switched to {tenantName}." Route stays at same URL if the new tenant can access it, otherwise redirects to that tenant's persona-appropriate landing (`/dashboard` for agent, `/agency` for agency, `/admin` for PA).
- **Escape key** — closes popover, returns focus to trigger.
- **Tab key** — moves through rows in DOM order, then footer links.
- **Enter key on trigger** — same as click. Space bar too.
- **Search input keydown Enter** — commits to the first visible row.
- **Search input keydown ArrowDown** — moves focus to first visible row.
- **Row ArrowDown / ArrowUp** — moves focus within the list.
- **Row focus + Enter** — commits switch.
- **Backdrop click (mobile sheet)** — dismisses.
- **Persistence** — active tenant survives sign-out/sign-in cycle. Stored server-side per user (`users.active_tenant_id`) and mirrored to localStorage for zero-flash rehydrate on load.
- **Cross-tab sync** — if the user switches tenant in one browser tab, other open tabs receive a broadcast-channel event and update their own switcher + trigger a soft reload of tenant-scoped data. No forced navigation.
- **Uninitialized state** — first-render before the API confirms the active tenant: trigger shows a skeleton (40×140px shimmer) — do NOT render the wrong tenant name and correct it.

---

## State variants to render

1. **Idle — single tenant.** Trigger renders as a static label (no chevron, no cursor: pointer). Personal tenant only, no popover behavior. This is 60% of solo agents.
2. **Idle — multi-tenant, personal active.** Full trigger with chevron. Sara example.
3. **Idle — multi-tenant, agency active.** Trigger shows agency avatar + name + "Owner" role.
4. **Popover open — 3 tenants, personal active, search bar hidden.**
5. **Popover open — 6+ tenants, search bar visible, personal active.**
6. **Popover open — search filtered to zero results.**
7. **Switching in progress** — trigger disabled, scrim over app, spinner. 300-500ms max.
8. **Switch failed** — trigger returns to previous state, toast: "Couldn't switch tenants. Please try again." No app state change.
9. **Mobile bottom sheet — open, 3 tenants, personal active.**
10. **RTL Arabic — popover open, mixed-directional tenant names.**
11. **Dark mode — popover open, personal active.**

---

## Accessibility (WCAG 2.1 AA)

- Trigger and every row: ≥ 44×44 tap target (48 preferred on mobile row).
- Focus rings visible on trigger, search input, every row, footer links — two-tone from base CSS.
- Popover has `role="listbox"`; each row has `role="option"` and `aria-selected` on the active one.
- Screen reader announces the switch: `aria-live="polite"` region carries the toast string.
- Search input has a visible label — the placeholder is decoration, the label is for screen readers.
- Color is never the only differentiator: active row has both a background tint AND a check icon.
- Popover trapping: Tab within the popover cycles; Shift+Tab reverses; Escape closes.
- Mobile bottom sheet is dismissable by swipe-down gesture with keyboard equivalent (Escape).
- No motion for users with `prefers-reduced-motion: reduce` (fade only, no scale).

---

## Anti-patterns — do NOT do

- Do NOT show a modal confirmation before switching. Switching is a chrome action, not a destructive one. Trust the user; if they land in the wrong tenant, they switch back — no data lost.
- Do NOT sort tenants alphabetically. Order: personal always first, then agencies by user's role (owner → admin → manager → member → viewer), then by most-recently-active.
- Do NOT show the switcher chevron when the user has only one tenant. Chrome that does nothing is confusing.
- Do NOT put a "Sign out" link inside the switcher popover. Sign out lives in a separate user-menu (`SHR-NAV-002` side drawer or top-bar user dropdown).
- Do NOT enumerate tenants the user does NOT belong to as "invited pending". Pending-invitation-membership goes in a separate surface (`AGT-REC-004` per WF-02).
- Do NOT force a full-page reload on switch. React-Query invalidations + a single scrim is enough.
- Do NOT persist the last-typed search string. Search input clears on popover close.
- Do NOT auto-select the first search result on typing. Enter or arrow-down commits.
- Do NOT render tenant names in provider-brand colors. Use `--lc-text` and `--lc-text-muted`.

---

## Reference designs (for style anchoring)

- **Vercel dashboard team switcher** — trigger + popover shape, chevron pattern, search-when-many.
- **Linear workspace switcher** — role labels, active-checkmark treatment.
- **GitHub org switcher** — mobile bottom-sheet treatment.
- **Notion workspace switcher** — mixed personal + workspace, footer links.

Do NOT anchor on: AWS console account switcher (too dense), Salesforce (too corporate), Google Workspace switcher (too much brand color).

---

## Handoff instruction to v0

> Produce this component at desktop 1440px + tablet 768px (both trigger + open popover), and mobile 375px (both trigger + open bottom sheet), in English (LTR) and Arabic (RTL), in light and dark themes — that's 16 total renders. Use shadcn/ui components already present in the codebase. Follow the copy table exactly. The trigger is embedded in `SHR-NAV-001` top bar; render enough of the surrounding chrome (wordmark on the logical-start side, avatar user-menu on the logical-end side) for context but do NOT design those elements — they have their own briefs.

---

## Downstream implementation notes (for Cursor Code, Wave 0 dispatch)

- Route + component: new file `web/src/components/nav/TenantSwitcher.tsx`. Embed in `web/src/components/nav/TopBar.tsx` (also new, from SHR-NAV-001 brief).
- State store: extend `web/src/state/session.ts` (or equivalent) with `activeTenantId`, `availableTenants[]`, `switchTenant(id)`, driven by React Query with a stable query key.
- Backend endpoints needed (verify existing / add if missing):
  - `GET /api/auth/me/tenants` — returns list of tenants the user has access to, with role + role-derived metric preview (listings count, agents count). Backend should scope by `users.id`.
  - `POST /api/auth/switch-tenant` (body `{ tenantId }`) — server sets `active_tenant_id`, returns fresh session token if using JWTs, or updates the session row. Migration 028 already scaffolded `tenant_memberships`; verify the routes exist.
- Persistence: `users.active_tenant_id` column already exists per migration 028. Confirm at branch time; add migration if missing.
- Cross-tab: use `BroadcastChannel('wingcaster-session')` API to sync across tabs.
- React Query invalidation on switch: invalidate every query keyed under `['tenant', activeTenantId]`. Prefer refetch-on-mount for tenant-scoped queries.
- Cursor prompt must include this brief verbatim, plus the SHR-NAV-001 top-bar brief (once written), plus the BROADCAST_ALIGNMENT_REFERENCE.md contents, plus a link to migration 028.

---

## Test discipline

- **Unit tests:** trigger renders correct label + role, popover opens on click, search filters correctly, active-row has check icon, single-tenant collapses to static label, RTL variant mirrors, dark mode uses correct tokens.
- **Integration tests:** switch API call fires, session state updates, cross-tab BroadcastChannel event received.
- **Accessibility tests:** keyboard nav walks through all rows, focus trap works, `aria-live` announces switch, dir="rtl" renders correctly.
- **Visual tests (Chromatic / equivalent):** 11 state variants captured; add to `no-raw-hex.test.ts` allowlist confirmation (none should trigger it).

---

## Definition of done (component)

1. Trigger visible on every authenticated page via `SHR-NAV-001`.
2. Popover / bottom sheet functional with all 11 state variants tested.
3. Switch action fires the correct backend endpoint + updates active tenant.
4. Cross-tab sync working.
5. RTL variant verified in Arabic locale.
6. Dark mode verified.
7. Keyboard navigation complete.
8. Screen reader announces the switch.
9. Zero raw hex; `no-raw-hex.test.ts` green.
10. Storybook entry for each state variant.
