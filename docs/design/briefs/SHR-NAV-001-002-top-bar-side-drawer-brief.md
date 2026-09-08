# Screen Brief — SHR-NAV-001 + SHR-NAV-002 · Top bar + side drawer

**Layer-2 Brief for design AI consumption (v0 by Vercel — locked per D-S-03).**

Companion to `SCREEN_MATRIX_SHARED.md` entries `SHR-NAV-001` (top bar) + `SHR-NAV-002` (side drawer / side navigation). Bundled into one brief because they share layout dependencies + interaction contracts. Every authenticated screen renders under these two components.

---

## 🎨 Broadcast alignment

**Inherits `BROADCAST_ALIGNMENT_REFERENCE.md`.** Semantic `--lc-*` tokens only. No raw hex.

**Top bar (SHR-NAV-001) callouts:**
- Bar surface: `--lc-surface-elevated`, `--lc-shadow-sm` bottom shadow, `--lc-border` 1px bottom border.
- Wordmark: use `--lc-brand` for the accent glyph; the wordmark word itself uses `--lc-text`.
- Global search input: `--lc-surface-inset` fill, `--lc-border` outline. Placeholder text `--lc-text-muted`.
- Notification bell icon (idle): `--lc-text-muted`. Hover: `--lc-text`. Active/open: `--lc-action-primary`.
- Notification badge: `--lc-badge-emphasis` fill, `--lc-badge-emphasis-text` ink. Small circle top-right of bell (offset -4px).
- User-menu avatar: circular, 32px. Fallback initials on a Broadcast-token background derived from user id.
- Environment badge (PA persona only — LIVE / TEST): `--lc-status-warning` fill + `TEST` label when in test env; `--lc-status-success` fill + `LIVE` label. Adjacent to wordmark.

**Side drawer (SHR-NAV-002) callouts:**
- Drawer surface: `--lc-surface-page` fill, `--lc-border` right-side border (or left in RTL).
- Section headers: `var(--lc-type-caption)`, uppercase, `--lc-text-muted`.
- Nav item (idle): `--lc-text` ink, transparent fill.
- Nav item (hover): `--lc-surface-hover` fill.
- Nav item (active): `--lc-action-primary-subtle` fill, `--lc-action-primary` ink, weight 600. Left-side (or right in RTL) 3px accent bar in `--lc-action-primary`.
- Nav item (focused): two-tone focus ring.
- Separator between sections: `<Separator>` in `--lc-border`.
- Persistent-collapsed variant: shrinks to icon-only rail (60px wide).

---

## Meta

| | |
|---|---|
| Screen IDs | SHR-NAV-001 (top bar) + SHR-NAV-002 (side drawer) |
| Persona | Every authenticated user — variant per persona (agent / agency admin / PA) |
| Device targets | Mobile 375px, tablet 768px, desktop 1440px |
| Locale | English (LTR) + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | Not a route — persistent chrome around every authenticated route |
| Current state | Partial — some navigation exists in `web/src` but no unified top bar or side-drawer component. Verified: grep confirms no `TopBar\|SideDrawer` unified components. |

---

## Purpose (one sentence)

Give every authenticated user consistent chrome: top-bar for global orientation + high-frequency shortcuts (search, notifications, tenant, language, user menu), and side-drawer for domain navigation — with per-persona variants for agent / agency / PA that render appropriate destinations.

---

## Product context the AI needs

- **Three personas.** The top bar structure is identical; the side-drawer contents differ per persona.
- **Agent side-drawer on desktop** replaces the mobile bottom tab bar. Same destinations; different presentation.
- **Agency admin side-drawer** shows agency-specific destinations (Members, Roles, Settings, Reports, Audit log).
- **PA side-drawer** shows platform admin destinations (grouped: Approvals, Moderation, Financial, Configuration, Audit).
- **Environment badge (LIVE / TEST) shows only for PA persona** — see PA-NAV-001 brief for the env-switcher itself; this brief only handles the visual badge.
- **Tenant switcher (SHR-NAV-008)** embeds on the left of the top bar; language selector (SHR-NAV-006) embeds on the right. See their respective briefs.
- **Global search is present in the top bar for all personas** — placeholder text differs per persona ("Search listings, contacts, campaigns…" for agents; "Search agents, roles, listings…" for agency admins; "Search tenants, invoices, packages…" for PA).

---

## Layout — SHR-NAV-001 top bar, desktop ≥1024px

Fixed to top, full-width, 56px tall, respecting safe-area inset on notched devices.

Left-to-right (LTR) order:
1. **Hamburger toggle** — only shown when the side drawer is collapsible. Icon: `PanelLeft` from lucide, 20px, `--lc-text-muted`.
2. **Brand wordmark + environment badge** — `WingCaster` wordmark (SVG), 24px tall. Environment badge (LIVE / TEST) sits immediately to the right of the wordmark, only for PA persona.
3. **Tenant switcher** (SHR-NAV-008) — see that brief.
4. **Global search** — expands from a 40×40 icon button (on <1024px) to a 320px input (on ≥1024px). `<Input>` primitive with `Search` icon prefix, `Cmd+K` label suffix on macOS / `Ctrl+K` on Windows.
5. **Spacer** (flexible width).
6. **Language selector** (SHR-NAV-006) — see that brief.
7. **Notification bell** — 40×40 icon button. Badge for unread count.
8. **User-menu avatar** — 32px circular. Click opens a small popover (see §user-menu).

## Layout — top bar, tablet 768px

Same content, tighter spacing. Global search collapses to icon-only until tapped, then expands into a full-width overlay (like macOS Spotlight).

## Layout — top bar, mobile 375px

Same content, aggressive compression:
- Hamburger visible.
- Wordmark shrinks to the mark-only (no wordmark text).
- Tenant switcher shows avatar-only (from SHR-NAV-008 mobile spec).
- Global search collapses to icon-only.
- Language selector: if space is tight (<360px viewport), migrates into `SHR-NAV-002` side drawer (see SHR-NAV-006 mobile-collapse-rule).
- Notification bell present.
- User-menu avatar present.

Layout algorithm: prefer collapsing to icon-only over overflowing off-screen.

---

## Layout — SHR-NAV-002 side drawer, desktop ≥1024px

Two supported modes:

### Mode 1: Persistent expanded
- Fixed to left (or right in RTL), full viewport height minus top bar.
- Width: 240px.
- Content area: scrollable vertical list of nav items grouped by section.
- Bottom: user's current tenant preview + a small "Manage tenants" link (same as tenant switcher popover footer).

### Mode 2: Persistent collapsed rail
- Same fixed position, width 60px.
- Icons only, no labels. Tooltip on hover shows the label.
- Toggle button at bottom of the rail expands to Mode 1.

### Mode 3: Overlay (temporary)
- Slides in from left (or right in RTL) as an overlay above the page content. Backdrop `--lc-scrim`.
- Used when the persistent drawer is toggled OFF by the user AND they tap the hamburger.

**Default per persona:**
- Agent desktop: Mode 1 (expanded).
- Agency admin desktop: Mode 1.
- PA desktop: Mode 1.
- Any user tablet 768px: Mode 2 (collapsed rail).

### Content per persona

**Agent side drawer:**
- Group `Work`
  - Dashboard (→ `/dashboard`, icon `LayoutDashboard`)
  - Listings (→ `/listings`, icon `Home`)
  - Inbox (→ `/inbox`, icon `MessageSquare`, badge = unread)
  - Contacts (→ `/contacts`, icon `Users`, badge = attention)
  - Opportunities (→ `/opportunities`, icon `Target`)
  - Tasks (→ `/tasks`, icon `ListChecks`)
- Group `Grow`
  - Campaigns (→ `/campaigns`, icon `Megaphone`)
  - Templates (→ `/templates`, icon `LayoutTemplate`)
  - Analytics (→ `/analytics`, icon `BarChart3`)
- Group `Setup`
  - Channels (→ `/channels`, icon `Zap`)
  - Routing (→ `/routing`, icon `GitBranch`)
- Group `Account`
  - Plans (→ `/plans`, icon `CreditCard`)
  - Settings (→ `/settings`, icon `Settings`)
  - Help (→ `/help`, icon `LifeBuoy`)

**Agency admin side drawer:**
- Group `Agency`
  - Dashboard (→ `/agency`, icon `LayoutDashboard`)
  - Members (→ `/agency/members`, icon `Users`)
  - Roles & permissions (→ `/agency/roles`, icon `ShieldCheck`)
  - Team activity (→ `/agency/activity`, icon `Activity`)
- Group `Operations`
  - Listings (→ `/agency/listings`, icon `Home`)
  - Reports (→ `/agency/reports`, icon `BarChart3`)
  - Routing (→ `/agency/routing`, icon `GitBranch`)
- Group `Setup`
  - White-label (→ `/agency/white-label`, icon `LayoutTemplate`)
  - Channels (→ `/agency/channels`, icon `Zap`)
- Group `Governance`
  - Audit log (→ `/agency/audit`, icon `FileText`)
  - Settings (→ `/agency/settings`, icon `Settings`)
- Group `Billing`
  - Subscription (→ `/agency/subscription`, icon `CreditCard`)
  - Credits (→ `/agency/credits`, icon `Coins`)
  - Invoices (→ `/agency/invoices`, icon `FileText`)

**PA side drawer:**
- Group `Approvals`
  - Approvals queue (→ `/admin/approvals`, icon `CheckCircle2`, badge = pending count)
  - Package publishing (→ `/admin/packages`, icon `Package`)
  - Credit grants (→ `/admin/credits`, icon `Coins`)
- Group `Moderation`
  - Portal submissions (→ `/admin/moderation`, icon `Shield`)
  - Property valuation (→ `/admin/pva`, icon `Calculator`)
  - Account recovery (→ `/admin/acr`, icon `KeyRound`)
- Group `Financial`
  - Dashboard (→ `/admin/fin`, icon `LayoutDashboard`)
  - Vendors (→ `/admin/fin/vendors`, icon `Truck`)
  - Vendor rates (→ `/admin/fin/rates`, icon `DollarSign`)
  - Statements (→ `/admin/fin/statements`, icon `FileText`)
  - Reconciliation (→ `/admin/fin/reconciliation`, icon `RefreshCcw`)
  - Dunning (→ `/admin/fin/dunning`, icon `AlertCircle`)
- Group `Configuration`
  - System config (→ `/admin/cfg`, icon `Settings`)
  - Portal registry (→ `/admin/portals`, icon `Globe`)
  - Templates (→ `/admin/tpl`, icon `LayoutTemplate`)
  - Notifications (→ `/admin/notifications`, icon `Bell`)
- Group `Audit`
  - Audit log (→ `/admin/audit`, icon `History`)

---

## Layout — SHR-NAV-002 side drawer, mobile 375px

Overlay mode only. Slides in from left (or right in RTL) as a full-height sheet, 80% of viewport width (max 320px). Backdrop `--lc-scrim`. Same content as desktop expanded, tighter spacing.

**Note:** on mobile, the agent persona typically uses SHR-NAV-003 bottom tab bar as primary navigation; the drawer becomes secondary — accessible via hamburger but rarely opened. Design accordingly (drawer is functional but not the fast path on mobile).

---

## Layout — SHR-NAV-001 + SHR-NAV-002 in RTL

Full mirror. Hamburger + wordmark + tenant switcher move to the right; user menu + language selector move to the left. Side drawer slides in from the right.

---

## User menu popover (part of SHR-NAV-001)

Anchored to the user-menu avatar. Width 240px, `--lc-shadow-md`, `--lc-radius-md`.

Contents:
- Header row: avatar (48px) + user display name + email.
- `<Separator>`.
- Row: "Your profile" → `/settings/profile`.
- Row: "Preferences" → `/settings/preferences`.
- Row: "Change password" → `/settings/security`.
- Row: "2FA & security" → `/settings/security` (SHR-MFA).
- `<Separator>`.
- Row (destructive): "Sign out" → clears session + redirects to `/login`.

---

## Notification popover (part of SHR-NAV-001)

Anchored to notification bell. Width 360px, max height 480px.

Contents:
- Header row: "Notifications" + "Mark all as read" text link.
- Scrollable list of notification rows. Each row: 72px tall, icon on left, title + timestamp + snippet, unread ones with a subtle `--lc-action-primary-subtle` background.
- Footer: "View all →" link → `/notifications` (Phase 2 — full notification history; in Phase 1 the popover is the only surface).
- Empty state: "You're all caught up." icon + message.

---

## Global search overlay

Triggered by Cmd+K / Ctrl+K, or by clicking the search input in the top bar.

- Modal overlay centered on the viewport, 640px wide max.
- Search input at top, autofocused.
- Below input: grouped results:
  - Recent searches
  - Suggestions (context-aware — recent listings, recent contacts, active campaigns)
  - Actions ("Create new listing", "Start a campaign")
- Keyboard nav: ArrowDown/Up moves through results, Enter commits, Escape closes.

Per-persona placeholder text:
- Agent: "Search listings, contacts, campaigns…"
- Agency: "Search agents, roles, listings…"
- PA: "Search tenants, invoices, packages…"

---

## Explicit copy (subset — see also SHR-NAV-006, -008)

| Key | EN | AR |
|---|---|---|
| `search.placeholder.agent` | Search listings, contacts, campaigns… | ابحث عن الإعلانات، جهات الاتصال، الحملات… |
| `search.placeholder.agency` | Search agents, roles, listings… | ابحث عن الوكلاء، الأدوار، الإعلانات… |
| `search.placeholder.pa` | Search tenants, invoices, packages… | ابحث عن الحسابات، الفواتير، الباقات… |
| `search.hotkey.mac` | ⌘K | ⌘K |
| `search.hotkey.win` | Ctrl+K | Ctrl+K |
| `user.menu.profile` | Your profile | ملفك الشخصي |
| `user.menu.preferences` | Preferences | التفضيلات |
| `user.menu.password` | Change password | تغيير كلمة المرور |
| `user.menu.security` | 2FA & security | المصادقة الثنائية والأمان |
| `user.menu.signout` | Sign out | تسجيل الخروج |
| `notifications.header` | Notifications | الإشعارات |
| `notifications.markall` | Mark all as read | تحديد الكل كمقروء |
| `notifications.viewall` | View all → | عرض الكل ← |
| `notifications.empty` | You're all caught up. | لقد اطلعت على كل شيء. |
| `env.badge.live` | LIVE | مباشر |
| `env.badge.test` | TEST | اختبار |
| `nav.group.work` | Work | العمل |
| `nav.group.grow` | Grow | النمو |
| `nav.group.setup` | Setup | الإعداد |
| `nav.group.account` | Account | الحساب |
| `nav.group.agency` | Agency | الوكالة |
| `nav.group.operations` | Operations | العمليات |
| `nav.group.governance` | Governance | الحوكمة |
| `nav.group.billing` | Billing | الفوترة |
| `nav.group.approvals` | Approvals | الموافقات |
| `nav.group.moderation` | Moderation | الإشراف |
| `nav.group.financial` | Financial | المالية |
| `nav.group.configuration` | Configuration | الإعدادات |
| `nav.group.audit` | Audit | التدقيق |

(Individual nav-item labels defined per each downstream screen brief — do not duplicate here.)

---

## Component palette

- Custom: `<TopBar>`, `<SideDrawer>`, `<SideDrawerRail>`, `<UserMenu>`, `<NotificationsPopover>`, `<GlobalSearch>` — all under `web/src/components/nav/`.
- `<Popover>` (Radix) for user menu + notifications popovers.
- `<Sheet>` (vaul) for mobile side drawer.
- `<Command>` (cmdk) for the global search overlay.
- `<Tooltip>` for collapsed-rail hover labels.
- `<Badge>` for notification counts + environment badge.
- Embed: `<TenantSwitcher>` (SHR-NAV-008), `<LanguageSelector>` (SHR-NAV-006).

Icons: extensive `lucide-react` per drawer content list above.

---

## Sample content for the AI to render against

**State A — Agent desktop, expanded drawer, Dashboard active, light theme**
- Top bar: wordmark, tenant switcher showing "Elite Real Estate", search input `Cmd+K`, EN language selector, bell (3 unread badge), avatar.
- Drawer expanded, Dashboard row highlighted.

**State B — Agent mobile 375px, drawer closed, top bar collapsed to icons only**
- Wordmark reduced to brand mark.
- Tenant switcher: avatar-only.
- Search: icon-only.
- Bell: icon + 12 badge.
- Avatar: 32px.

**State C — PA desktop, expanded drawer, "Approvals queue" active, TEST env badge, dark theme**
- Env badge next to wordmark: `TEST` in warning color.
- Drawer expanded with PA groups; Approvals badge showing `7`.

**State D — Agency admin desktop, expanded drawer, "Members" active**

**State E — RTL Arabic, agent desktop, drawer expanded on the right**
- Wordmark + tenant switcher on the right of top bar.
- Language selector + bell + avatar on the left.
- Drawer flush against right edge.

**State F — Global search overlay open, agent persona, "sara" typed, 4 results grouped by type**

**State G — Notification popover open, 5 notification rows, top 2 unread**

**State H — User menu popover open**

**State I — Collapsed rail drawer (60px)** — icon-only with tooltip visible on hover

**State J — Mobile hamburger tap → drawer slides in as overlay**

At least 10 renders.

---

## Interactions

- **Hamburger toggle** — flips drawer between expanded ↔ collapsed (desktop) or opens/closes overlay (mobile).
- **Global search hotkey** — Cmd+K on macOS, Ctrl+K on Windows/Linux. Focus lands in the search input.
- **Notification bell click** — opens popover. Auto-marks-read on close (with a subtle "marked N as read" toast).
- **User-menu avatar click** — opens popover.
- **Nav item click** — navigates via router push; drawer stays open on desktop, auto-closes on mobile.
- **Active-route detection** — nav items highlight based on the current URL segment automatically.
- **Escape key** — closes any open popover, closes global search, closes mobile drawer overlay.
- **Reduced motion** — no drawer slide animation; instant show/hide with fade.
- **Persistent drawer state** — user's preference (expanded vs collapsed rail) persists via localStorage.
- **PA env badge click** — opens PA-NAV-001 env switcher (see that brief).

---

## State variants to render

At minimum 10 per §Sample Content. Ideally 20 to cover all persona × device × theme × RTL combinations for the top-priority anchor states.

---

## Accessibility (WCAG 2.1 AA)

- Every interactive element ≥ 44×44 tap target.
- Focus rings visible on every focusable element.
- Top bar has `role="banner"`.
- Side drawer has `role="navigation"` + `aria-label="Primary"`.
- User menu popover: focus trap while open.
- Notification popover: focus trap; announces "X new notifications" on open.
- Global search overlay: `role="dialog"` + focus trap + Escape closes.
- Skip-to-content link visible on first Tab press from top bar.
- Color is never the only indicator (env badge has label text; active nav item has bar + weight + color).
- Screen reader announces route changes via `aria-live="polite"` in the top bar.
- Reduced-motion respected across all transitions.

---

## Anti-patterns — do NOT do

- Do NOT add per-persona brand colors to the top bar. All three personas use the same Broadcast tokens.
- Do NOT show the PA env badge for non-PA personas. Agents and agency admins never see LIVE/TEST.
- Do NOT hide the wordmark on any authed screen (except mobile where it collapses to the mark).
- Do NOT put "Sign out" in the top bar directly — it lives in the user-menu popover only.
- Do NOT auto-collapse the drawer on scroll. Chrome that disappears is chrome that surprises.
- Do NOT let the drawer scroll independently of the page unless the nav-item count exceeds viewport height.
- Do NOT show a badge on a nav item when the count is zero. Empty badges are noise.
- Do NOT put the language selector inside the user-menu popover. It's chrome for both anon + authed users; keep it in the top bar.
- Do NOT show the collapsed-rail on mobile. Mobile is overlay-only.
- Do NOT include a "search" nav item in the side drawer. Search is a top-bar affordance.
- Do NOT allow the global search overlay to remain open across route changes. Any navigation closes it.

---

## Reference designs

- **Linear** — top bar + side drawer geometry, keyboard-first search.
- **Notion** — collapsed-rail behavior, section-header pattern in the drawer.
- **Vercel dashboard** — team switcher + top bar interplay.
- **Stripe dashboard** — PA-style admin drawer grouping, env badge.
- **GitHub** — user menu popover pattern, notifications popover.

Do NOT anchor on: AWS console (too dense), Salesforce (too corporate), Slack (channel-list geometry doesn't apply).

---

## Handoff instruction to v0

> Produce these two components at desktop 1440px, tablet 768px, and mobile 375px, in English (LTR) and Arabic (RTL), in light and dark themes. Render at minimum the 10 state variants listed above. Use shadcn/ui + Radix + cmdk + vaul primitives already present. Follow the copy table exactly. Render enough surrounding page content (a plain gray "content goes here" panel is fine) to show the chrome in context.

---

## Downstream implementation notes (for Cursor Code, Wave 0 dispatch)

- New files:
  - `web/src/components/nav/TopBar.tsx`
  - `web/src/components/nav/SideDrawer.tsx`
  - `web/src/components/nav/SideDrawerRail.tsx`
  - `web/src/components/nav/UserMenu.tsx`
  - `web/src/components/nav/NotificationsPopover.tsx`
  - `web/src/components/nav/GlobalSearch.tsx`
  - `web/src/app/AgentAppShell.tsx`, `AgencyAppShell.tsx`, `PaAppShell.tsx` (three shells, each importing TopBar + SideDrawer with persona-specific config)
- Persona detection: from `useSession()` hook → `session.persona ∈ {'agent', 'agency', 'pa'}`.
- Active route detection: `useLocation()`.
- Search backend: verify `POST /api/search` exists or add. Per-persona result scoping enforced server-side.
- Notifications backend: verify `/api/notifications` returns list + unread count.
- User pref for drawer state: `users.ui_prefs` JSONB or localStorage — user's choice.
- Search hotkey: `useHotkey('mod+k', openSearch)`.
- Env badge: read from `useSession()` → `session.environment ∈ {'live', 'test'}`. Only render for PA.

## Test discipline

- **Unit tests:** top bar renders correct items per persona, search hotkey works, notification badge count reflects data, active nav item highlights on route match, RTL mirrors.
- **Integration tests:** hamburger toggle persists preference, route change updates active item, sign-out clears session and redirects.
- **A11y tests:** skip-to-content works, focus traps in popovers, screen reader announces route changes, keyboard nav complete.
- **Visual tests:** all state variants captured.

## Definition of done

1. Three app shells render top bar + side drawer with correct per-persona content.
2. Top bar renders all embedded components (tenant switcher, language selector, notifications, user menu).
3. Global search overlay works with hotkey + click, correct per-persona placeholder.
4. Side drawer has 3 modes (expanded / collapsed rail / mobile overlay) and preference persists.
5. RTL + dark mode verified.
6. PA env badge renders only for PA persona.
7. Zero raw hex.
8. Storybook entries for all state variants.
