# Screen Brief — SHR-NAV-003 · Agent bottom tab bar

**Layer-2 Brief for design AI consumption (v0 by Vercel — locked per D-S-03).**

Companion to `SCREEN_MATRIX_SHARED.md` entry `SHR-NAV-003`. Mobile-first primary navigation chrome for the agent persona. Without this component, "mobile-first Agent" is aspirational — every AGT screen's `Entry from: bottom-tab X` reference is unreachable.

---

## 🎨 Broadcast alignment

**Inherits `BROADCAST_ALIGNMENT_REFERENCE.md`.** Semantic `--lc-*` tokens only. No raw hex.

**Screen-specific callouts:**
- Bar surface: `--lc-surface-elevated` with `--lc-shadow-up` top-shadow (subtle 0 -1px 2px on light; 0 -1px 2px on dark). Border top: `1px solid --lc-border`.
- Tab icon (idle): `--lc-text-muted`, 24px stroke-1.5 lucide.
- Tab label (idle): `var(--lc-type-caption)` — Inter 500 11/14, `--lc-text-muted`.
- Tab icon (active): `--lc-action-primary`, 24px stroke-2.
- Tab label (active): same size, weight 600, `--lc-action-primary`.
- Tab press-down (active-press): `--lc-action-primary-hover`, 100ms.
- Badge (unread / pending): `--lc-badge-emphasis` fill, `--lc-badge-emphasis-text` ink. Small pill top-right of icon (offset -6px each axis). Contains a `<Numeric>` count or a dot if count is 0-but-attention.
- Divider between More menu items (when open): `--lc-border`.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-NAV-003 |
| Screen name | Agent bottom tab bar |
| Persona | Agent (mobile) — solo agents + agency-scoped agents |
| Device targets | Mobile 375px only (bar hides on ≥768px — desktop uses side navigation `SHR-NAV-002`) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | Not a route — a persistent component rendered under every AGT-* route |
| Current state | MISSING — verified: grep on `BottomTab\|MobileTabBar\|TabBar` in `web/src` returns zero files. |

---

## Purpose (one sentence)

Give a mobile-first agent a fixed-position, thumb-reachable primary navigation with the 5 most-frequented destinations (Dashboard / Listings / Inbox / Contacts / More) so every core task is one tap from anywhere in the app.

---

## Product context the AI needs

- **Mobile is primary for agents.** Broadcast §3.2 mandates a bottom tab bar. Without it, agents on phones use a hamburger drawer (desktop pattern) or direct URL entry — both fail the "bumpy taxi ride, one-handed" test.
- **Five tabs, no more.** Design brief and industry standard both cap at 5. The 6th slot is the More menu.
- **Tab order is fixed** — Dashboard / Listings / Inbox / Contacts / More. Reordering breaks muscle memory.
- **Badges must matter.** Only three tabs badge: Inbox (unread), Contacts (opportunity attention), More (settings warnings, e.g., MFA not enrolled). Dashboard and Listings never badge — they're always-present destinations.
- **RTL:** the visual order stays the same top-to-bottom, but the horizontal order mirrors (Dashboard on the right, More on the left in Arabic).
- **iOS + Android:** Capacitor runtime. Respect safe-area insets at the bottom (home indicator on iOS, gesture bar on Android).

---

## Layout — mobile 375px

Fixed to viewport bottom, spanning full width, respecting safe-area inset.

### Dimensions
- Height: 56px content + safe-area-inset-bottom padding.
- Total surface (with safe-area on modern iPhone): ~90px visible.
- Icon size: 24px.
- Label size: 11px, line-height 14.
- Icon-to-label vertical gap: 2px.
- Each tab: equal width — `100% / 5 = 20%` of viewport width.
- Tap target per tab: at least 44×44 (whole cell); labels are decorative — the whole cell is one target.

### Tab content (LTR order)
1. **Dashboard** — icon: `LayoutDashboard` (lucide). Label: "Dashboard". Route: `/dashboard`.
2. **Listings** — icon: `Home` (lucide, house style, not building). Label: "Listings". Route: `/listings`.
3. **Inbox** — icon: `MessageSquare` (lucide). Label: "Inbox". Route: `/inbox`. Badges: unread conversation count (max shown "99+").
4. **Contacts** — icon: `Users` (lucide, plural). Label: "Contacts". Route: `/contacts`. Badges: opportunity-attention count (max shown "9+").
5. **More** — icon: `Menu` (lucide, three-line). Label: "More". Not a route — opens a bottom sheet listing secondary destinations. Badges: dot indicator only (e.g., MFA not enrolled).

### Active-tab treatment
- Filled icon variant (stroke-2 vs stroke-1.5 idle).
- Label color + weight change per Broadcast callouts.
- Small 2px pill indicator at the very top of the active tab cell, 20px wide, `--lc-action-primary`, centered horizontally.
- No motion on tab switch — it's chrome, not animation.

### Active-tab-press feedback
- Instant color change to `--lc-action-primary-hover`, back to `--lc-action-primary` on release. 100ms transition.
- No ripple, no scale, no bounce.

---

## The "More" bottom sheet

Tap "More" → sheet slides up from bottom. Full-width, dismisses via drag-down or backdrop tap.

### Sheet content (top-to-bottom)
- Sheet handle (24×4px pill, `--lc-border`, 6px from top).
- Header row: "More" — `var(--lc-type-title)`, `--lc-text`.
- Grouped list of secondary destinations:
  - **Group: Business**
    - Campaigns → `/campaigns`
    - Templates → `/templates`
    - Pricing / plans → `/plans`
    - Analytics → `/analytics`
  - **Group: Setup**
    - Channels → `/channels`
    - Routing rules → `/routing`
    - Team → `/team` (only shown if user is agency-scoped)
  - **Group: Account**
    - Settings → `/settings` (SHR-SET-001 entry)
    - Help & support → `/help`
    - Sign out (destructive-styled row)
- Each row: 56px tall, icon + label + right-facing chevron (`ChevronRight` in LTR, `ChevronLeft` in RTL).
- Separator between groups: `<Separator>` with group name label (uppercase caption).

### RTL variant
- Tab order reverses horizontally: More / Contacts / Inbox / Listings / Dashboard from left to right.
- Icons stay the same orientation (they're all symmetric except `ChevronRight` which flips).
- Arabic labels shorter — verify none exceed the cell width at 320px viewport.

---

## Explicit copy (all strings, EN + AR)

| Key | EN | AR |
|---|---|---|
| `tab.dashboard` | Dashboard | لوحة التحكم |
| `tab.listings` | Listings | الإعلانات |
| `tab.inbox` | Inbox | الوارد |
| `tab.contacts` | Contacts | جهات الاتصال |
| `tab.more` | More | المزيد |
| `sheet.header` | More | المزيد |
| `sheet.group.business` | Business | الأعمال |
| `sheet.group.setup` | Setup | الإعداد |
| `sheet.group.account` | Account | الحساب |
| `sheet.row.campaigns` | Campaigns | الحملات |
| `sheet.row.templates` | Templates | القوالب |
| `sheet.row.pricing` | Pricing & plans | التسعير والخطط |
| `sheet.row.analytics` | Analytics | التحليلات |
| `sheet.row.channels` | Channels | القنوات |
| `sheet.row.routing` | Routing rules | قواعد التوجيه |
| `sheet.row.team` | Team | الفريق |
| `sheet.row.settings` | Settings | الإعدادات |
| `sheet.row.help` | Help & support | المساعدة والدعم |
| `sheet.row.signout` | Sign out | تسجيل الخروج |
| `badge.unread.max` | 99+ | ٩٩+ |
| `badge.attention.max` | 9+ | ٩+ |
| `a11y.tab.active` | Currently on {tabLabel} | أنت الآن على {tabLabel} |
| `a11y.badge.unread` | {count} unread messages | {count} رسائل غير مقروءة |
| `a11y.badge.attention` | {count} contacts need attention | {count} جهة اتصال تحتاج إلى انتباه |

Copy voice: single-word labels where possible. Arabic labels are as tight as the language allows (verify at 320px viewport).

---

## Component palette

- Custom: `<BottomTabBar>` container + `<BottomTab>` cell + `<BottomTabBadge>` — new components under `web/src/components/nav/`
- `<Sheet>` (Radix / vaul) for the More sheet
- `<Separator>` for group dividers in the sheet

Icons from `lucide-react`:
- `LayoutDashboard`, `Home`, `MessageSquare`, `Users`, `Menu` for tabs
- `ChevronRight` / `ChevronLeft` for sheet rows (dir-aware)
- Sheet row icons: `Megaphone` (Campaigns), `LayoutTemplate` (Templates), `CreditCard` (Pricing), `BarChart3` (Analytics), `Zap` (Channels), `GitBranch` (Routing), `UsersRound` (Team), `Settings` (Settings), `LifeBuoy` (Help), `LogOut` (Sign out)

---

## Sample content for the AI to render against

**State 1 — Dashboard active, no badges**
- Dashboard cell: active treatment (pill indicator on top, filled icon, weight-600 label).
- Others: idle.

**State 2 — Inbox active, Inbox has 12 unread**
- Inbox cell: active treatment.
- Inbox badge: `12` in emphasis pill top-right of icon.

**State 3 — Contacts active, Contacts has 3 attention items**
- Contacts cell: active treatment.
- Contacts badge: `3` in emphasis pill.

**State 4 — Listings active, More has attention dot (MFA not enrolled)**
- Listings cell: active treatment.
- More badge: 8px solid dot in `--lc-status-warning`, no number.

**State 5 — More sheet open, viewing "Business" group**
- Sheet slid up 60% of viewport.
- Backdrop `--lc-scrim` over rest of app.

**State 6 — Inbox active, 99+ badge, dark mode**
**State 7 — RTL Arabic, More sheet open**

---

## Interactions

- **Tab tap** — instant navigation to route. Router history push (not replace). If already on that route, scroll-to-top the current page.
- **Tab press-and-hold** — no long-press behavior. Ignored.
- **Tab tap on already-active tab** — scrolls the current page to top.
- **More sheet swipe-down** — dismisses. Threshold: >120px drag or velocity >0.5.
- **More sheet backdrop tap** — dismisses.
- **Escape key** (Bluetooth keyboard) — dismisses More sheet.
- **Route change externally** — bar's active state updates automatically based on current URL segment.
- **Scroll hide** — DO NOT hide the bar on scroll. It stays fixed. Agents rely on always-present chrome.
- **Keyboard visibility** — when the soft keyboard opens (an input is focused), the bar HIDES to reclaim vertical space. Reappears when keyboard dismisses. Detection: `visualViewport` API.

---

## State variants to render

1. **Idle — Dashboard active, no badges** (light + dark, LTR + RTL = 4 renders)
2. **Idle — Inbox active with badge = 12** (light)
3. **Idle — Contacts active with badge = 3** (light)
4. **Idle — Listings active, More attention dot** (light)
5. **Idle — Inbox active with badge = "99+" — max cap** (light + dark)
6. **More sheet open — Business group visible** (light + dark, LTR + RTL)
7. **Keyboard-hidden state** — bar not rendered (empty state for docs)

At least 12 total renders.

---

## Accessibility (WCAG 2.1 AA)

- Every tab cell ≥ 44×44 tap target (56px height covers this even with narrow cells).
- Focus rings visible on Bluetooth-keyboard nav.
- Each tab: `role="tab"`, `aria-selected` on active.
- Bar container: `role="tablist"`, `aria-label="Primary navigation"`.
- Badges: hidden from AT via `aria-hidden="true"`, count instead announced via a `sr-only` span with the a11y copy strings above.
- More sheet: `role="dialog"`, `aria-modal="true"`, focus trap while open.
- Sheet close: escape key + backdrop tap + swipe-down all supported.
- Color-only badge attention is forbidden — the More badge dot MUST also have an accessible warning label announcing which item needs attention (e.g., "MFA not enrolled").
- Reduced motion: no slide animation on sheet — instant show/hide with fade.

---

## Anti-patterns — do NOT do

- Do NOT hide the bar on scroll. Chrome that disappears is chrome that surprises.
- Do NOT reorder tabs across sessions. Order is fixed.
- Do NOT badge Dashboard or Listings with numeric counts. Dashboard's "notifications" go inside the dashboard; Listings' counts (draft, published, expired) go inside listing filters.
- Do NOT put Sign Out anywhere except the More sheet's Account group.
- Do NOT introduce a 6th tab, ever. If more nav is needed, it goes in More.
- Do NOT use color as the only differentiator for active state. Filled icon + label weight + top pill indicator triple-encode it.
- Do NOT animate the tab switch. Chrome is instant, page content transitions if the destination screen chooses to.
- Do NOT put the tab bar under `SHR-NAV-002` side drawer on mobile. Mobile does not have a side drawer.
- Do NOT show the bar on desktop (≥768px). Desktop uses side navigation from `SHR-NAV-002`.
- Do NOT show the bar on the login screen or any pre-auth surface.

---

## Reference designs

- **Instagram mobile bottom nav** — 5 tabs, always-present, badge treatment.
- **Notion mobile** — active-tab treatment, sheet-for-more pattern.
- **Linear mobile** — density, tap target sizing.
- **WhatsApp mobile tabs** — MENA-familiar visual weight.

Do NOT anchor on: Uber (icon-only, no labels), TikTok (center-emphasized tab), Twitter/X (icon changes shape per state).

---

## Handoff instruction to v0

> Produce this component at mobile 375px (only — desktop hides this bar), in English (LTR) and Arabic (RTL), in light and dark themes. Render at least 12 state variants per the list above. Use shadcn/vaul for the More sheet. Follow the copy table exactly. Do not render the surrounding pages — the bar is the subject.

---

## Downstream implementation notes (for Cursor Code, Wave 0 dispatch)

- New files:
  - `web/src/components/nav/BottomTabBar.tsx` — container
  - `web/src/components/nav/BottomTab.tsx` — cell primitive
  - `web/src/components/nav/BottomTabBadge.tsx` — badge primitive
  - `web/src/components/nav/MoreSheet.tsx` — the More sheet
- Rendered from: `web/src/app/AgentAppShell.tsx` (new — wraps every AGT-* route). Not rendered under PA or Agency shells.
- Route detection: `useLocation()` from `react-router-dom` (verify router in use).
- Visibility rule: `useMediaQuery('(max-width: 767px)')` + `useVisualViewportKeyboardVisible()` (new hook).
- Badge data sources:
  - Inbox unread: subscribe to `useUnreadConversationCount()` (React Query polling / SSE — verify existing infra).
  - Contacts attention: `useContactAttentionCount()` (opportunity-stage-based; count contacts with a needs-attention flag).
  - More warning: aggregate — MFA not enrolled OR trial ending soon OR failed payment. Boolean flag + a rotating tooltip listing which.
- Route-scroll-to-top on already-active tap: `window.scrollTo({top: 0, behavior: 'smooth'})`.
- Keyboard-visible detection: `visualViewport.height < window.innerHeight - 100`.

## Test discipline

- **Unit tests:** tab renders active/idle correctly, badges render with correct counts + max cap, RTL mirrors, keyboard hide fires.
- **Integration tests:** tap navigates via router, More sheet opens/closes, active tab updates on external route change.
- **A11y tests:** every tab has correct ARIA, keyboard nav works, screen reader announces badge counts.
- **Visual tests:** all 12 variants captured.

## Definition of done

1. Bar renders on every AGT-* mobile route.
2. Hides on ≥768px and when keyboard visible.
3. All 5 tabs navigate correctly; already-active tap scrolls to top.
4. Badges reflect live data with correct max cap.
5. More sheet opens with all 10 rows, dismissable 3 ways.
6. RTL + dark mode + light mode verified.
7. Zero raw hex.
8. Storybook entry per state variant.
