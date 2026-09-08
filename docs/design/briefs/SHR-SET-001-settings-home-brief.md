# Screen Brief — SHR-SET-001 · Settings home (anchor + sub-nav shell for the SHR-SET family)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_SHARED.md` entry `SHR-SET-001`. Wave 4 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 (§5 rows 12-16, §6 Week 4). This brief establishes the **`<SettingsShell>` sub-nav primitive** that SHR-SET-002 (account), SHR-SET-003 (billing/notification prefs), SHR-SET-004 (sessions & devices) and SHR-SET-005 (danger zone / delete account) all inherit from as delta briefs. Downstream SHR-SET-* briefs specify page CONTENT only — chrome, breadcrumb, active-state highlighting, mobile transition, empty-search state, capability-gate render, and RTL mirroring all come from this file.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Semantic `--lc-*` tokens only. Zero raw hex.

**Screen-specific Broadcast callouts:**

- Page background: `--lc-bg-page`. Content wrapper max-width `1200px`, centered, `--lc-space-4xl` top padding on desktop, `--lc-space-xl` on mobile.
- H1 ("Settings"): `font: var(--lc-type-heading-1)` (600 26/32 IBM Plex Sans), `--lc-text-heading`. Sub: `var(--lc-type-body)` muted.
- Sub-nav sidebar (desktop): `--lc-surface-raised` fill, 240px wide, sticks below top bar, full remaining viewport height, `--lc-border` right-edge hairline (or left in RTL). Internal padding `--lc-space-md`.
- Sub-nav group heading: `var(--lc-type-overline)` (600 11/14 + 0.08em), `--lc-text-muted`, `--lc-space-md` top margin, `--lc-space-2xs` bottom margin, ONE per group. Never rendered when the group has zero visible items.
- Sub-nav item idle: `var(--lc-type-body)` `--lc-text-primary`, transparent fill, `--lc-radius-md`, height 40px, `--lc-space-sm` horizontal padding, icon 18px on the leading edge. Full row is the tap target.
- Sub-nav item hover: `--lc-surface-sunken` fill.
- Sub-nav item active: `--lc-action-primary` 3px leading bar (left in LTR, right in RTL) + `--lc-surface-sunken` fill + `--lc-text-brand` label + weight 600 + icon becomes `--lc-text-brand`. Applied by React Router `NavLink` `isActive` — do NOT use aria-current alone.
- Sub-nav item focused: two-tone focus ring `--lc-focus-ring` + `--lc-focus-ring-contrast` — automatic via base CSS, do NOT override.
- Search input at the top of the sidebar: `<Input>` primitive, `Search` icon prefix (16px, `--lc-text-muted`), `--lc-surface-sunken` fill, `--lc-border-strong` outline. Placeholder text `--lc-text-muted`. Full sidebar width.
- Danger-zone item: label ink `--lc-status-unpublished-fg` red on hover and active; idle stays `--lc-text-primary` — the red tint activates only on interaction to avoid alarm-fatigue at rest. Icon `--lc-status-unpublished-fg` always.
- Mobile grouped-cards variant: each group renders as a `<Card>` (`--lc-surface-raised` + `--lc-elevation-sm` + `--lc-radius-lg`), section heading inside the card uses `var(--lc-type-heading-3)`, items inside are 56px-tall list rows with 18px icon + label + `ChevronRight` (RTL: `ChevronLeft`) affordance.
- Numerals in item badges (unread count on Billing, active-session count on Security, etc.) use `<Numeric>` wrapper — mono + tabular-nums.
- Motion: sidebar-to-page fade `--lc-duration-base` on route change; no slide (settings screens live in the same shell, transition should feel instant). Mobile card→detail push-transition `--lc-duration-slow` + `--lc-easing-out`.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-SET-001 |
| Screen name | Settings home |
| Persona | All authenticated (Agent solo, Agent in agency, Agency admin, PA — visibility per capability set) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/settings` (also acts as the layout route — `/settings/*` children render inside the shell) |
| Current state | MISSING — the app has per-area settings pages reached only by direct URL; no unified home or sub-nav chrome exists. Verified: no `SettingsShell\|SettingsSidebar` component under `web/src`. |
| Workflow role | n/a (chrome + orientation surface; no workflow of its own) |
| Backend prerequisites | ⏳ `GET /api/settings/index` — returns the ordered list of setting groups + items the current caller may see per capability (see §Backend contract). Estimated 0.5 day. **Slot: Week 4, must land with the SHR-SET-* PR.** |

---

## Purpose

Give every authenticated user a single, capability-scoped orientation surface for account, security, billing/notification, team/tenant, and destructive-zone settings — AND establish the persistent sub-nav shell that hosts every other SHR-SET-* screen. Two jobs, one screen:

1. **Anchor** — at `/settings` the right pane renders a summary/dashboard of the user's account (see §Anchor pane content) so `/settings` alone is a useful destination, not a spinning "please pick a section" empty state.
2. **Shell** — at `/settings/*` (account, billing, sessions, delete, etc.) the same left sidebar persists, active item highlighted, right pane hosts the child route.

Per D9-adjacent (2026-09-04) capability model, groups appear or disappear based on server-computed capability tokens (never client-side role checks). A solo agent sees Account / Security / Billing / Notifications / Danger zone. An agency admin adds Team & tenants. A PA in TEST env additionally sees a small "Platform" group (feature flags, env). Empty settings home = show only what the user has access to — never render a disabled section with a lock icon (per anti-pattern rule below).

---

## Design goals

1. **One shell, many pages.** SHR-SET-002/003/004/005 briefs specify their right-pane content only. Every chrome, breadcrumb, active-item highlight and mobile transition is defined here.
2. **Capability-gated, not role-gated.** The server returns the visible groups. The UI never guesses. See §Backend contract.
3. **Search-first jump.** The sidebar's top slot is a search input that filters every group + item by label + synonyms + description. Enter jumps to the first match.
4. **Mobile is not a shrunken desktop.** Mobile flattens the sub-nav into a stack of grouped cards; sidebar is not rendered at all under 768px. A tap on a card pushes to the child route, back arrow returns to the card list.
5. **Danger zone is visually quieter than warnings.** Amber caution tone at rest, red only on hover/active. Matches SHR-SET-005 brief's "sober not scary" principle.
6. **RTL first-class.** Sidebar flips to the right; leading accent bar flips to the right edge of active items; chevrons in mobile card rows flip direction. Every icon that has a directional metaphor mirrors.

---

## Layout

### Desktop / tablet ≥768px — Shell + anchor pane

Two-column grid inside the standard app shell (top bar + optional side drawer from SHR-NAV-001/002 above). Widths:

- **Left sub-nav (240px, sticky):** full remaining viewport height, scrollable if content exceeds height. Sits INSIDE `web/src/app/AgentAppShell.tsx` (and the agency + PA shells) as the second-level chrome. Does NOT replace the primary side drawer — the primary drawer (SHR-NAV-002) is still visible to the left of it, or collapsed to its 60px rail per user preference.
- **Right pane (fluid, min 640px, max 960px):** the child route mounts here. On `/settings` exactly, this pane renders the anchor content (see §Anchor pane content).

Grid layout tokens: `display: grid; grid-template-columns: 240px minmax(640px, 960px); gap: var(--lc-space-2xl); padding: var(--lc-space-4xl) var(--lc-space-2xl);`.

#### Left sub-nav anatomy (top-to-bottom)

1. **H1 "Settings"** — desktop only, sits ABOVE the search input, `var(--lc-type-heading-1)`, `--lc-space-md` bottom margin.
2. **Search input** — `<Input>` primitive, placeholder "Search settings" / "ابحث في الإعدادات". `Search` icon prefix. `Cmd+/` / `Ctrl+/` hotkey focuses it (distinct from `Cmd+K` global search which targets domain content, not settings).
3. **Nav groups** — each group has:
   - Overline heading (uppercased in EN, natural case in AR — Arabic doesn't have letter case).
   - 1..N item rows. Each item = icon + label + (optional) trailing badge.
4. **Footer** — small `<div>` at the bottom of the sidebar (position: sticky-bottom): app version, build hash, "Send feedback" link. Muted, `var(--lc-type-caption)`.

#### Nav groups (canonical, in this order)

Groups render only when the server includes them in the capability response. Item order within a group is stable and defined here:

| Group | Item | Route | Icon (lucide) | Visible to | Trailing badge |
|---|---|---|---|---|---|
| **Account** | Profile | `/settings/account` | `User` | All | — |
| Account | Language & region | `/settings/account/locale` | `Globe` | All | — |
| Account | Timezone | `/settings/account/timezone` | `Clock` | All | — |
| **Security** | Two-factor authentication | `/settings/security/2fa` | `ShieldCheck` | All | `2FA off` (amber pill) if not enrolled |
| Security | Sessions & devices | `/settings/security/sessions` | `Laptop` | All | `<Numeric>` count if >1 active session |
| Security | Change password | `/settings/security/password` | `KeyRound` | All (password-holders only — hidden for OAuth-only accounts) | — |
| **Billing & notifications** | Subscription | `/settings/billing/subscription` | `CreditCard` | Owner of a paid plan (agent solo, agency owner) | `Past due` red pill if applicable |
| Billing & notifications | Invoices | `/settings/billing/invoices` | `FileText` | Same as above | — |
| Billing & notifications | Payment methods | `/settings/billing/payment-methods` | `Wallet` | Same as above | — |
| Billing & notifications | Notification preferences | `/settings/notifications` | `Bell` | All | — |
| **Team & tenants** | Members | `/settings/team/members` | `Users` | Agency owner OR agency admin capability | `<Numeric>` pending-invite count if >0 |
| Team & tenants | Roles & permissions | `/settings/team/roles` | `Shield` | Agency owner only | — |
| Team & tenants | Ownership transfer | `/settings/team/ownership` | `KeyRound` | Agency owner only | — |
| Team & tenants | Tenant switcher | `/settings/team/tenants` | `Building2` | User with membership in >1 tenant | — |
| **Integrations** *(optional, appears only for users who have any integration installed or capability to install)* | Channels | `/settings/integrations/channels` | `Zap` | Capability-gated | — |
| Integrations | Portal credentials | `/settings/integrations/portals` | `Globe2` | Capability-gated | — |
| **Advanced** *(rare)* | API keys | `/settings/advanced/api-keys` | `Terminal` | Capability-gated (currently PA-only) | — |
| Advanced | Feature flags | `/settings/advanced/flags` | `Flag` | PA in TEST env only | — |
| **Danger zone** | Delete account | `/settings/danger/delete-account` | `AlertTriangle` | All (with server-side blocks per SHR-SET-005 — agency owner with remaining members etc. still sees the link, block message renders inside the child pane) | — |

**Group ordering rule:** Account → Security → Billing & notifications → Team & tenants → Integrations → Advanced → Danger zone. Never reorder based on personalization — muscle memory is the point.

**Selector for the active item:** whichever nav item's route is a prefix of `useLocation().pathname`. If two items match (e.g. `/settings/account` and `/settings/account/locale`), the LONGER prefix wins.

### Desktop anchor pane content (right side when route is exactly `/settings`)

The anchor pane is not a "pick a section" empty state. It's a small dashboard:

1. **Greeting card** — `--lc-surface-raised` + `--lc-elevation-sm`, `--lc-radius-lg`, padding `--lc-space-xl`:
   - Avatar 64px on the leading edge + display name (`var(--lc-type-heading-2)`) + primary identifier + "Signed in via {method}" line.
   - Right side: Edit-profile button `<Button variant="outline">` linking to `/settings/account`.
2. **Security posture row** — 3 side-by-side status tiles:
   - **2FA** — status pill (green "On" / amber "Off"), link to `/settings/security/2fa`.
   - **Sessions** — count via `<Numeric>` + "Manage sessions" link.
   - **Password** — "Last changed {relative time}" + "Change" link (hidden for OAuth-only accounts).
3. **Billing snapshot** (only if user has a paid plan) — 1 tile: plan name + next-renewal date + "Manage subscription" link.
4. **Recent activity** (last 3 audit events for THIS user only — profile changes, session revokes, password changes, 2FA enroll) — small list, `PA-AUD-001` style rows, but scoped to `actor_user_id = current user`.
5. **Danger zone quick-link** — small link at the very bottom, muted, "Need to delete your account?" → `/settings/danger/delete-account`.

Do NOT render a fake "onboarding progress" card here — that lives on AGT-DSH-001.

### Mobile ≤767px — Grouped cards, no sidebar

Sub-nav sidebar is NOT rendered under 768px. Instead:

1. **Top bar** — standard SHR-NAV-001 top bar with back arrow (RTL: forward arrow) that navigates to the previous route (usually the dashboard). Title "Settings" centered.
2. **Search input** — full-width, below the top bar, sticky. Same placeholder + hotkey behavior as desktop.
3. **Grouped cards** — one `<Card>` per group. Group heading INSIDE the card top (`var(--lc-type-heading-3)`), then a list of 56px-tall list rows — icon + label + optional trailing badge + `ChevronRight` (RTL: `ChevronLeft`) affordance.
4. **Tapping a row** — pushes to the child route as a full-screen page. The child page shows its own back arrow returning to `/settings`.
5. **The anchor pane content** (greeting, security posture, billing snapshot, recent activity) is NOT rendered on mobile at all. Mobile users see only the grouped-card menu. Rationale: mobile settings are a task list, not a dashboard — the anchor content is desktop-only.

### Search UX (both viewports)

- Typing filters the visible groups + items in place (client-side, since the full capability list is already in memory).
- Match algorithm: case-insensitive substring on label + synonyms + one-line description. Synonyms defined per item (e.g. "2FA" also matches "two-factor", "MFA", "authenticator").
- Empty search state (no matches): "No settings match '<query>'. Try 'password', '2FA', 'invoices', or 'notifications'." + a "Clear search" link.
- Enter key jumps to the first match's route.
- Escape clears the query.
- Search input carries a small `X` clear button when non-empty.

### RTL (Arabic)

- Sub-nav sidebar sits on the RIGHT of the content pane instead of the left.
- Active-item leading accent bar sits on the RIGHT edge of the active row.
- Mobile card rows' trailing `Chevron` icon becomes `ChevronLeft` (Lucide has both).
- Icons that carry directional meaning (arrows, chevrons, `KeyRound` is directionless so unchanged) mirror.
- Overline group headings render in natural Arabic case; the `text-transform: uppercase` CSS applies only under `[dir="ltr"]`.

---

## Explicit copy (English + Arabic)

Where Arabic is `[TRANSLATION-PENDING]`, the string will be filled during the MENA copywriter pass. Never guess Arabic — leave the marker so the pass is visible.

| Key | EN | AR |
|---|---|---|
| `title` | Settings | الإعدادات |
| `sub.desktopOnly` | Manage your account, security, billing, and workspace preferences. | إدارة حسابك، الأمان، الفوترة، وتفضيلات مساحة العمل. |
| `search.placeholder` | Search settings | ابحث في الإعدادات |
| `search.hotkey.mac` | ⌘/ | ⌘/ |
| `search.hotkey.win` | Ctrl+/ | Ctrl+/ |
| `search.empty` | No settings match '{query}'. Try 'password', '2FA', 'invoices', or 'notifications'. | لا توجد إعدادات تطابق '{query}'. جرّب 'كلمة المرور'، '2FA'، 'الفواتير'، أو 'الإشعارات'. |
| `search.clear` | Clear search | مسح البحث |
| `group.account` | Account | الحساب |
| `group.security` | Security | الأمان |
| `group.billing` | Billing & notifications | الفوترة والإشعارات |
| `group.team` | Team & tenants | الفريق والمساحات |
| `group.integrations` | Integrations | التكاملات |
| `group.advanced` | Advanced | متقدّم |
| `group.danger` | Danger zone | منطقة الخطر |
| `item.account.profile` | Profile | الملف الشخصي |
| `item.account.locale` | Language & region | اللغة والمنطقة |
| `item.account.timezone` | Timezone | المنطقة الزمنية |
| `item.security.2fa` | Two-factor authentication | المصادقة الثنائية |
| `item.security.sessions` | Sessions & devices | الجلسات والأجهزة |
| `item.security.password` | Change password | تغيير كلمة المرور |
| `item.billing.subscription` | Subscription | الاشتراك |
| `item.billing.invoices` | Invoices | الفواتير |
| `item.billing.payment` | Payment methods | طرق الدفع |
| `item.billing.notifications` | Notification preferences | تفضيلات الإشعارات |
| `item.team.members` | Members | الأعضاء |
| `item.team.roles` | Roles & permissions | الأدوار والصلاحيات |
| `item.team.ownership` | Ownership transfer | نقل الملكية |
| `item.team.tenants` | Tenant switcher | تبديل المساحة |
| `item.integrations.channels` | Channels | القنوات |
| `item.integrations.portals` | Portal credentials | بيانات البوابات |
| `item.advanced.apiKeys` | API keys | مفاتيح API |
| `item.advanced.flags` | Feature flags | مفاتيح الميزات |
| `item.danger.delete` | Delete account | حذف الحساب |
| `badge.2faOff` | 2FA off | 2FA معطّل |
| `badge.pastDue` | Past due | متأخّر |
| `anchor.greeting` | Signed in via {method} | مسجّل الدخول عبر {method} |
| `anchor.editProfile` | Edit profile | تعديل الملف |
| `anchor.security.2fa.on` | On | مفعّل |
| `anchor.security.2fa.off` | Off | معطّل |
| `anchor.security.2fa.action` | Manage two-factor | إدارة المصادقة الثنائية |
| `anchor.security.sessions.action` | Manage sessions | إدارة الجلسات |
| `anchor.security.password.last` | Last changed {relativeTime} | آخر تغيير {relativeTime} |
| `anchor.security.password.action` | Change | تغيير |
| `anchor.billing.title` | Current plan | الخطة الحالية |
| `anchor.billing.renewsOn` | Renews on {date} | يُجدَّد في {date} |
| `anchor.billing.action` | Manage subscription | إدارة الاشتراك |
| `anchor.activity.title` | Recent account activity | نشاط الحساب الأخير |
| `anchor.activity.empty` | No recent activity. | لا يوجد نشاط حديث. |
| `anchor.danger.hint` | Need to delete your account? | تحتاج إلى حذف حسابك؟ |
| `footer.version` | Wingcaster {version} · {buildHash} | Wingcaster {version} · {buildHash} |
| `footer.feedback` | Send feedback | إرسال ملاحظات |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive | Notes |
|---|---|---|
| Shell layout | Custom `<SettingsShell>` under `web/src/components/settings/` | 2-col grid on desktop, single column on mobile; renders `<Outlet />` in the right pane. |
| Sidebar container | Custom `<SettingsSidebar>` | Sticky, 240px, `--lc-surface-raised`. Contains search + groups + footer. |
| Sidebar group | Custom `<SettingsNavGroup>` | Renders overline + items. Suppresses render if `items.length === 0`. |
| Sidebar item | `NavLink` from `react-router-dom` + custom `<SettingsNavItem>` | Uses `isActive` for the leading-bar + tint state. |
| Search input | `<Input>` + `<Kbd>` hotkey hint | `<Input>` from `web/src/components/ui/input.tsx`. |
| Mobile grouped card | `<Card>` + custom `<SettingsCardList>` | Card wraps a list of `<SettingsCardRow>`. |
| Mobile card row | `<button role="link">` with icon + label + optional badge + chevron | 56px tall, full-width, navigates on click. |
| Trailing badge | `<Badge>` — status variant per case | 2FA off → amber; Past due → red; Numeric count → default. Every badge is a component, never a plain span. |
| Numeric counts | `<Numeric>` from `web/src/components/ui/numeric.tsx` | Mono + tabular-nums; enforced. |
| Icons | `lucide-react` per table above | Icon size 18px in nav items, 16px in search input prefix, 24px in mobile row leading. |
| Anchor security tiles | Custom `<SecurityPostureTile>` under `web/src/components/settings/anchor/` | Three-tile side-by-side row on desktop. |
| Anchor recent activity | Custom `<SettingsActivityList>` | Reuses `PA-AUD-001` row shape scoped to current user. |

**Storybook coverage:** every custom component gets a Story file. Sidebar rendered as: expanded desktop light, expanded desktop dark, RTL, mobile-cards LTR, mobile-cards RTL, capability-limited PA-only, capability-limited solo-agent (no Team group), search-filtered active, search-empty state.

---

## Sample content (for v0 / mockup)

Render the desktop 1440px anchor state (route = `/settings`) for a **solo agent** persona, English (LTR), light theme:

- **Sidebar:**
  - H1 "Settings"
  - Search input empty, hotkey `⌘/` shown as `<Kbd>` on the right
  - Group "Account": Profile (active — leading bar + tint), Language & region, Timezone
  - Group "Security": Two-factor authentication (amber "2FA off" badge trailing), Sessions & devices (`<Numeric>` badge showing "3"), Change password
  - Group "Billing & notifications": Subscription, Invoices, Payment methods, Notification preferences
  - Group "Danger zone": Delete account (idle, no red tint)
  - (No Team & tenants group — solo agent, no membership in another tenant.)
  - Footer: "Wingcaster 1.14.0 · a3f9b21" + "Send feedback"
- **Right pane (anchor):**
  - Greeting card: 64px avatar with initials "SA" on `--lc-surface-inverse` background, "Sara Al-Mansoori", "sara.almansoori@example.com", "Signed in via Email". Edit profile button on the right.
  - Security posture row: three tiles side by side —
    - 2FA tile: "2FA" label, amber "Off" pill, "Manage two-factor" link (dark).
    - Sessions tile: "Sessions" label, `<Numeric>` "3", "Manage sessions" link.
    - Password tile: "Password" label, "Last changed 6 months ago", "Change" link.
  - Billing snapshot: "Semsar (free)" plan name, no renewal date (free tier), "Manage subscription" link.
  - Recent activity: 3 rows —
    - "Signed in from Dubai, UAE · 5 minutes ago"
    - "Enrolled backup phone · 2 days ago"
    - "Password changed · 6 months ago"
  - Danger-zone hint at the bottom: "Need to delete your account? →"

**Second pass** — the same layout for an **agency owner** persona, dark theme, RTL Arabic — MUST add:

- Group "Team & tenants" between "Billing & notifications" and "Danger zone".
- Sidebar flipped to the right of the content pane; active-item leading bar on the RIGHT edge of the active row.
- Every string in Arabic (or `[TRANSLATION-PENDING]` marker for entries not in the copy table).

**Third pass** — mobile 375px, English (LTR), light theme, solo agent:

- Top bar with back arrow + "Settings" centered.
- Sticky search input below.
- 4 grouped cards stacked vertically: Account, Security, Billing & notifications, Danger zone.
- Each card shows its overline heading, then list rows.
- Danger-zone card visually identical to the others at rest — the "danger" quality lives in the destination screen, not the card.

---

## Interactions

**On mount:**
- Fetch `GET /api/settings/index` (SWR-cached, 5-minute stale-while-revalidate — user's capability set changes rarely).
- Render sidebar groups from the response only. Do NOT render a hard-coded group list, do NOT render a disabled placeholder for a hidden group.
- If the response is a loading state, render the sidebar skeleton (see §State variants).
- If the response 500s, render the fallback minimum groups (Account + Security + Danger zone) with a small "Some settings could not be loaded — retry" banner at the top of the sidebar.

**On sidebar item click:**
- React Router `NavLink` navigates via router push. No page reload.
- Active state is derived from the URL only — do NOT track active state in local component state.
- The clicked item gets focused (`focus-visible`); Tab key continues to the next item; Shift+Tab goes back.

**On search input change:**
- Debounced 60ms.
- Filter visible items in-place. Groups with zero visible items after filter are hidden entirely (heading + all rows collapse).
- Enter key navigates to the first visible item.
- Escape clears the query and returns to unfiltered view.
- The active item highlight rules still apply — if the currently-active URL matches an item hidden by search, the highlight is not shown until the search clears.

**On mobile card row tap:**
- Navigates to the child route as a full-screen page.
- On the child page, the top bar's back arrow returns to `/settings` (the card list).

**On anchor pane "Edit profile" click:**
- Navigates to `/settings/account`. Active state in sidebar updates automatically.

**On anchor pane security tile action link click:**
- Navigates to the specific security sub-route.

**On danger-zone quick-link click:**
- Navigates to `/settings/danger/delete-account` (SHR-SET-005).

**Hotkey `Cmd+/` (macOS) / `Ctrl+/` (Windows/Linux):**
- Focuses the sidebar search input.
- Registered via the existing `useHotkey` hook, scoped to routes matching `/settings`.

**Preservation:**
- Search query does NOT persist across route changes within `/settings/*`. Each mount is a fresh unfiltered view. Rationale: users don't come back to settings expecting a filter to stick.
- Sidebar scroll position IS preserved across child route changes within `/settings/*`.

**On capability change (e.g. user accepted an agency invite in another tab):**
- SWR revalidation refreshes the sidebar. New group ("Team & tenants") slides in with a `--lc-duration-base` fade — no layout jank.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading — first render** | Capability fetch in flight | Sidebar renders a skeleton: 5 group placeholders (4 items each). Right pane skeletonizes anchor content. |
| **Loading — SWR revalidation** | Background refresh | Sidebar stays interactive; no skeleton. If items change, they animate in with `--lc-duration-base` fade. |
| **Loaded — solo agent** | Capability set is minimal | Groups: Account, Security, Billing & notifications, Danger zone. |
| **Loaded — agent in agency (non-admin)** | Capability set includes tenant membership but not admin | Adds Team & tenants group with ONLY the Tenant switcher item (no Members, no Roles, no Ownership). |
| **Loaded — agency admin** | Capability set includes admin | Adds Team & tenants group with Members + Roles + Tenant switcher (no Ownership — owner only). |
| **Loaded — agency owner** | Capability set includes owner | Adds Team & tenants group with all four items including Ownership transfer. |
| **Loaded — PA in LIVE env** | Capability set includes `pa` | Adds Advanced group with API keys only. |
| **Loaded — PA in TEST env** | Capability set includes `pa` AND env is TEST | Adds Advanced group with API keys + Feature flags. |
| **Loaded — OAuth-only account** | Capability set has `identity.oauth_only = true` | Hides "Change password" item under Security. |
| **Loaded — no paid plan** | Capability set has `billing.plan = 'free'` | Hides Subscription, Invoices, Payment methods; keeps Notification preferences. |
| **Search — filtering** | User typed a query | Groups + items filter live. Groups with zero matches hide entirely. |
| **Search — no matches** | Query returns zero | Sidebar shows the empty-state copy + "Clear search" link. Right pane unchanged. |
| **Search — one match, Enter pressed** | Query matches ≥1 item and user hits Enter | Navigate to the first visible match's route. |
| **Error — capability fetch failed** | 500 or network error | Sidebar renders the minimum-fallback groups (Account, Security, Danger zone) with a small `<Alert variant="warning">` at the top: "Some settings could not be loaded. [Retry]" — the Retry link re-triggers the fetch. Right pane renders anchor content in a degraded mode (skips billing snapshot). |
| **Empty — no capabilities at all** | Impossible in practice (every user has Account + Security + Danger zone at minimum) | Defensive fallback: render Account + Security + Danger zone anyway. Never render an empty sidebar. |
| **RTL** | Locale = ar | Sidebar flips to right; active-item bar flips to right; chevrons in mobile card rows flip. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap; sidebar `--lc-surface-raised` becomes `#1C2749`; active item `--lc-surface-sunken` becomes `#070C21`. |
| **Offline** | Network unreachable at mount | Sidebar renders cached SWR data if available; otherwise renders the minimum-fallback groups with a "You're offline — some settings may be stale" banner at the top of the sidebar. |

---

## Accessibility (WCAG 2.1 AA)

- Every nav item is a proper `<a href>` (via `NavLink`), keyboard-focusable, focus-ring visible.
- Sidebar has `role="navigation"` + `aria-label="Settings navigation"`.
- Group headings use `<h2>` semantically (visually rendered per overline token) so screen-reader users can jump between groups via H-key.
- Search input has a visible `<label>` (visually hidden on desktop where the H1 provides context; visible on mobile). Uses `htmlFor` correctly.
- Empty-search state announces via `aria-live="polite"`: "No settings match {query}."
- Mobile card rows are semantic buttons (`<button role="link">`) with `aria-label` including the group name for screen readers ("Two-factor authentication, Security group").
- Every trailing badge has visible text AND is announced ("Two-factor authentication, 2FA off"). Badges are never icon-only.
- Focus flows: Sidebar search → nav groups top-to-bottom → footer → skip to right-pane content. `Tab` traps NEVER — this is a persistent shell, not a modal.
- Skip-link at the top of the shell: "Skip to settings content" jumps focus to the right-pane container.
- Hotkey `Cmd+/` announced in the sidebar via a small "Search settings — press {hotkey}" hint (visible on desktop, hidden on mobile).
- Color is never the only indicator — active nav item has bar + tint + weight + color; danger badges have red + text; amber badges have amber + text.
- Reduced motion respected: no fade on group add; instant show/hide.

---

## Anti-patterns — do NOT do

- ❌ Do NOT render disabled or locked settings items for capabilities the user lacks. If a group is hidden, it is hidden ENTIRELY — no "🔒 Team (upgrade to unlock)" ghost rows. Cognitive noise + implies a sales upsell that belongs on a dedicated pricing screen.
- ❌ Do NOT check capabilities client-side by reading `session.role` or similar. The server owns capability computation. See §Backend contract.
- ❌ Do NOT re-order groups based on frequency of use, "recently visited", or personalization. Muscle memory is the point.
- ❌ Do NOT show the danger-zone item in red at rest. Red on interaction only.
- ❌ Do NOT put a badge on an item when the count is zero. Empty badges are noise (e.g. don't show "0" for pending invites when there are none).
- ❌ Do NOT render the sub-nav sidebar on mobile. Mobile is grouped-cards only. A shrunken sidebar is worse than a redesigned layout.
- ❌ Do NOT reuse the global `Cmd+K` hotkey for settings search. `Cmd+K` is the domain-content search (from SHR-NAV-001). Settings search uses `Cmd+/`.
- ❌ Do NOT let search results include groups from OTHER personas (e.g. filter should not surface "Members" for a solo agent). The client filter operates ONLY on the capability-scoped list.
- ❌ Do NOT auto-navigate on typing. Only Enter navigates.
- ❌ Do NOT show a "you have no unread notifications" style empty widget on the anchor pane. Anchor is a dashboard of ACTUAL settings state — 2FA, sessions, password, billing — not a general notification well.
- ❌ Do NOT show the anchor pane content on child routes. The right pane hosts EITHER the anchor content (route === `/settings` exact) OR the child route content — never both.
- ❌ Do NOT surface the "Change password" item to OAuth-only users. It's hidden by capability, not disabled with an error message.
- ❌ Do NOT let the sidebar overflow horizontally. Long labels truncate with ellipsis + tooltip on hover.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Linear settings** — the sidebar-shell pattern with grouped sections and a top search. Their group heading treatment (overline + muted) is a direct analog.
- **Stripe dashboard settings** — the anchor pane "security posture row" pattern and the capability-driven visibility model.
- **GitHub account settings** — the mobile grouped-card pattern is close to what we want (though GitHub's card treatment is heavier).
- **Notion settings modal** — the search-first-in-sidebar affordance.
- **Vercel dashboard settings** — the danger-zone-at-bottom pattern with quieter styling than red-everywhere.

Do NOT anchor on:
- Salesforce setup (too dense, too many nested tabs).
- AWS console settings (search-first but overwhelming taxonomy).
- macOS System Settings (top-level icon grid works poorly at web scale).

---

## Backend contract

**Endpoint:** `GET /api/settings/index`

**Auth:** authenticated only (401 if no session).

**Query params:** none. The server computes visibility from `session.user_id` + `session.tenant_id` + `session.environment`.

**Response 200:**
```json
{
  "capabilities": {
    "identity": {
      "oauth_only": false,
      "signin_method": "email"
    },
    "billing": {
      "plan": "semsar",
      "past_due": false
    },
    "team": {
      "role": "owner" | "admin" | "member" | "solo",
      "member_count": 12,
      "pending_invite_count": 2
    },
    "security": {
      "two_factor_enrolled": true,
      "active_session_count": 3
    },
    "env": "live"
  },
  "groups": [
    {
      "id": "account",
      "label_key": "group.account",
      "items": [
        { "id": "profile",  "route": "/settings/account",          "icon": "User",  "badge": null },
        { "id": "locale",   "route": "/settings/account/locale",   "icon": "Globe", "badge": null },
        { "id": "timezone", "route": "/settings/account/timezone", "icon": "Clock", "badge": null }
      ]
    },
    {
      "id": "security",
      "label_key": "group.security",
      "items": [
        { "id": "2fa",      "route": "/settings/security/2fa",      "icon": "ShieldCheck", "badge": { "kind": "status", "tone": "warning", "label_key": "badge.2faOff" } },
        { "id": "sessions", "route": "/settings/security/sessions", "icon": "Laptop",      "badge": { "kind": "count",  "value": 3 } },
        { "id": "password", "route": "/settings/security/password", "icon": "KeyRound",    "badge": null }
      ]
    }
    // ... billing, team, integrations, advanced, danger — only groups the caller may see
  ],
  "recent_activity": [
    { "kind": "sign_in",        "label": "Signed in from Dubai, UAE",   "at": "2026-09-07T12:34:56Z" },
    { "kind": "backup_phone",   "label": "Enrolled backup phone",       "at": "2026-09-05T10:12:00Z" },
    { "kind": "password_change","label": "Password changed",             "at": "2026-03-14T08:00:00Z" }
  ]
}
```

**Response 401:** unauthenticated — client redirects to `/login`.

**Response 500:** the client renders the minimum-fallback sidebar + a retryable warning banner (see §State variants).

**Cache:** SWR — 5-minute stale-while-revalidate. Server may set `Cache-Control: private, max-age=60` if it wants to short-circuit revalidation frequency.

**Capability-gate check is SERVER-SIDE.** The client never decides visibility. Every group + item in the response is renderable; every group + item NOT in the response is invisible. This preserves the property that adding a capability (e.g. shipping a new admin permission) requires ONE server change instead of one server + one client change, and prevents a compromised client from surfacing admin-only routes to non-admins.

**Backend prerequisite:** `GET /api/settings/index` does not exist yet. Estimated 0.5 day to implement. **Slot: Week 4, must land with the SHR-SET-* PR.** File as `[BE-BLOCKER-SET-01]` in the kickoff §5a if not already tracked.

---

## Downstream implementation (Cursor prompt handoff notes)

- **New files:**
  - `web/src/components/settings/SettingsShell.tsx` — the 2-col grid layout + `<Outlet />` in the right pane. Detects viewport via existing `useMediaQuery` and switches to mobile grouped-cards render.
  - `web/src/components/settings/SettingsSidebar.tsx` — sidebar container: H1 + search input + groups + footer.
  - `web/src/components/settings/SettingsNavGroup.tsx` — one group; renders overline + items; suppresses render if items are empty after filter.
  - `web/src/components/settings/SettingsNavItem.tsx` — one item; uses `NavLink` + `isActive` for active state.
  - `web/src/components/settings/SettingsCardList.tsx` — mobile grouped-card view.
  - `web/src/components/settings/SettingsCardRow.tsx` — mobile card row.
  - `web/src/components/settings/anchor/SettingsAnchor.tsx` — the right-pane content when route === `/settings` exact.
  - `web/src/components/settings/anchor/SecurityPostureTile.tsx` — 2FA / Sessions / Password tile.
  - `web/src/components/settings/anchor/BillingSnapshotCard.tsx` — plan + renewal.
  - `web/src/components/settings/anchor/SettingsActivityList.tsx` — recent activity list, reuses PA-AUD-001 row shape.
  - `web/src/hooks/useSettingsIndex.ts` — SWR hook wrapping `GET /api/settings/index`.
  - `web/src/lib/settings-search.ts` — pure client-side filter over the loaded groups.
- **Route registration:** in `web/src/App.tsx`, register `/settings/*` as a layout route rendering `<SettingsShell />`. Every SHR-SET-* child screen (SET-002 account, SET-003 billing, SET-004 sessions, SET-005 danger) registers as a child under this layout.
- **Persona detection:** capability-based, from `useSettingsIndex()`. Do NOT read `session.role`.
- **Active-route detection:** `useLocation()` + longest-prefix match against item routes.
- **Hotkey:** `useHotkey('mod+/', focusSettingsSearch)` scoped to routes matching `/settings/*` — do NOT register globally.
- **SWR key:** `['/api/settings/index']` — invalidated by mutations that change capability (e.g. accepting an agency invite, changing 2FA enrollment). Downstream SHR-SET-* screens must `mutate(['/api/settings/index'])` when their action changes a badge or a capability.
- **Test discipline:**
  - Unit: `SettingsSidebar` renders correct groups per capability payload (parametrize across solo agent, agency member, agency admin, agency owner, PA live, PA test, OAuth-only).
  - Unit: search filter behavior (substring + synonyms + Enter navigation).
  - Unit: mobile grouped-cards render + navigation.
  - Integration: full mount → SWR fetch → child route swap → active-item highlight updates.
  - Integration: capability change mid-session refreshes sidebar without full reload.
  - Accessibility: axe-core green on desktop + mobile. Keyboard navigation covers every interactive.
  - Real-Postgres: at least one integration test where a user accepts an agency invite → `useSettingsIndex` revalidates → "Team & tenants" group appears.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **RTL:** verified via `screens.rtl.test.tsx` extension with the settings shell scenario (LTR + RTL renders both captured).

---

## Definition of done for this brief

- [ ] `<SettingsShell>` layout renders on desktop and mobile per this brief.
- [ ] `GET /api/settings/index` is implemented server-side and drives sidebar rendering.
- [ ] SHR-SET-002 / -003 / -004 / -005 briefs reference this file for their chrome + navigation and specify only their right-pane content deltas.
- [ ] Sidebar search filters live and hotkey `Cmd+/` focuses it.
- [ ] Mobile grouped-cards render matches the mobile spec and navigates correctly.
- [ ] Anchor pane renders on `/settings` exact and hides on `/settings/*` child routes.
- [ ] Capability-gate visibility is server-driven; no client-side role checks anywhere in the sidebar code.
- [ ] RTL + dark mode verified for every state variant.
- [ ] `no-raw-hex.test.ts` green.
- [ ] Storybook coverage: every custom component has a Story file; sidebar has stories for solo / agency admin / PA / OAuth-only / search-active / search-empty / mobile-LTR / mobile-RTL / dark / RTL-dark.
- [ ] v0 has produced first-pass mockups for the three sample-content states (solo desktop LTR light, agency-owner desktop RTL dark, solo mobile LTR light).
- [ ] Screenshots committed under `docs/design/mockups/SHR-SET-001-<state>.png`.
- [ ] `[BE-BLOCKER-SET-01]` filed in kickoff §5a if not already tracked — `GET /api/settings/index` endpoint.
- [ ] Cursor Wave-4 dispatch prompt references this brief + the mockup paths + the four inheriting SHR-SET-* briefs.
