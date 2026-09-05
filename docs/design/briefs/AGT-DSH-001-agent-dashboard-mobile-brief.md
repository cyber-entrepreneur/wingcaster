# Screen Brief — AGT-DSH-001 · Agent Dashboard (mobile, Guided mode)

**Layer-2 Brief for design AI consumption.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-DSH-001`. This is the anchor for the entire Agent mobile surface — get this right and the visual language cascades to every other Agent screen.

---

## 🎨 Broadcast alignment (added 2026-09-04 post PR #41 merge)

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Inline hex or shadcn-generic references get replaced with `--lc-*` semantic tokens.

**Screen-specific Broadcast callouts for the mobile Agent Dashboard:**
- Greeting ("Morning, Sara"): `font: var(--lc-type-display)` — Archivo 800, 32/38. Big and warm. On brand for Broadcast "loud + fast" character.
- Date sub-line: `font: var(--lc-type-body-sm)`, color `--lc-text-muted`.
- Urgent card top strip (4px colored bar): `--lc-action-primary` for lead / publish urgency, `--lc-status-underOffer-dot` for pricing alerts, `--lc-status-unpublished-dot` for failed publishes.
- Urgent card body: `--lc-surface-raised` background + `--lc-elevation-sm` shadow (offset, not blurred). Border-radius: `--lc-radius-lg` (7px — tight, on-brand).
- Urgent card CTA button: `--lc-action-primary` fill. Full 44px min-height.
- **Quota strip:** every numeral in the "42 of 50 Instagram posts left" copy uses `<Numeric>`. The Instagram icon is a `<ChannelMark channel="instagram">` — pairs `--lc-channel-instagram` (Instagram pink) with `--lc-channel-instagram-on` (white). 20-28px only.
- Quota bar: `--lc-surface-sunken` track + `--lc-action-primary` fill.
- Recent-listings horizontal-scroll cards: `--lc-surface-raised` + `--lc-elevation-sm`. Photo corners `--lc-radius-md`. Price uses `<Numeric>` in `--lc-type-data`.
- **Status pill on listing cards:** never color-alone. Draft ○ · Published ● · Under offer ◐ · Closed ◆ · Archived ▢ · Unpublished ✕. Use `--lc-status-{X}-{bg,fg,dot}` tokens.
- FAB (bottom-right, 56×56 circle): `--lc-action-primary` fill + `Plus` icon in `--lc-action-primary-text`. `--lc-elevation-lg` offset shadow.
- FAB bottom-sheet: `<Sheet>` from Radix. `--lc-duration-slow` (240ms) slide-up. `--lc-easing-out`.
- **Signal lamp** (teal `--lc-accent-bold` dot pulsing on the urgent card's CTA button when a listing just went LIVE): reserved motif — ONLY on this screen when a publish just succeeded. Do not sprinkle elsewhere.
- Empty state hero button ("Start with WhatsApp"): `--lc-action-primary` fill. WhatsApp icon is a `<ChannelMark channel="whatsapp">`.
- Time-of-day greeting logic: 5am-11:59am morning, 12pm-4:59pm afternoon, 5pm-9:59pm evening, 10pm-4:59am "Working late?"
- Language pill (EN / ع): top-right. Toggle switches `<html lang>` + text direction immediately.
- Theme toggle: use `<ColorModeToggle>` from `web/src/components/ui/color-mode-toggle.tsx` — cycles light / dark / system.
- Pull-to-refresh: native-feeling spinner. Duration: `--lc-duration-slow`.
- Skeleton loaders: `--lc-surface-sunken` base + subtle animate-pulse.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-DSH-001 |
| Screen name | Dashboard (Guided) |
| Persona | Agent (solo or agency-scoped), authenticated |
| Device target | Mobile 375px primary (baseline 360px, comfortable up to 430px) |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Runtime | React web app inside a Capacitor iOS/Android wrapper — must feel native |
| Route | `/dashboard` |
| Mode | Guided (Pro variant is AGT-DSH-002, separate brief) |
| Current state | EXISTS at `web/src/pages/AgentDashboardPage.tsx` — this brief supersedes with mobile-first + Guided-mode redesign |

---

## Purpose (one sentence)

Open the app, see the single most important thing to do right now, get to it in one tap, and see at-a-glance whether your listings are healthy — without scrolling, without menus, without thinking.

---

## Design goals

1. **One-hand-thumb reachable** — every primary action in the bottom half of the screen.
2. **The first thing on screen is a person's decision, not a KPI dashboard.** If there's nothing urgent, greet warmly and offer a quick-add.
3. **Photo-forward** — this is real estate; the app must not feel like a spreadsheet.
4. **Time-of-day-aware** — greeting adapts to morning / afternoon / evening.
5. **Language-first** — Arabic mirrors visually AND numerically (٠-٩ vs 0-9).
6. **Feels native** — iOS-style safe area insets, Android-style back-button behavior, no browser chrome bleeding through.
7. **Fast** — first meaningful paint under 800ms on mid-range Android; skeletons for every data section.

---

## Layout — mobile 375px, portrait

Reading top-to-bottom, working within a 375×812 viewport minus a 44px top safe-area and a bottom-tab-bar zone of 88px (48 for tabs + safe-area).

### Zone 1 — Status header (44px + 8px padding)

- Left: notification bell with unread badge (tap → SHR-NAV-004 notification center). Badge shows `9+` when overflow.
- Center: nothing (no title — the dashboard IS the home)
- Right: two 32×32 pills side-by-side — user avatar (menu on tap) and language pill (currently `EN`; tap to swap to `AR`)

### Zone 2 — Greeting (72px)

- Big warm greeting, 22px semibold: `Good morning, Sara` / `صباح الخير يا سارة`
- Underneath, 15px regular muted: `Wednesday, September 4` / `الأربعاء، ٤ سبتمبر`
- No avatar here — it's already in the header

### Zone 3 — Urgent card (variable height, 120-200px)

The ONE thing that most needs attention right now. Server-computed priority order:
1. A new lead (< 2 hrs old, no reply yet) → shows the lead
2. A listing whose price is > 10% off market → shows the pricing alert
3. An expiring listing → shows the listing
4. A rejected portal submission → shows the fix action
5. A failed publish → shows retry
6. If nothing urgent → show a quick-add prompt (see empty state)

**Card structure** (for a "new lead" example):
- Small colored strip at top (accent color, 4px)
- Small label: `NEW LEAD · 12 MIN AGO` / `عميل جديد · قبل ١٢ دقيقة`
- Big line: `Sara asked about the 2BR in Downtown Dubai` / `سألت سارة عن شقة الغرفتين في وسط دبي`
- Sub-line: `Via WhatsApp · Budget AED 850k` / `عبر واتساب · الميزانية ٨٥٠ ألف درهم`
- Bottom-right: primary button `Reply now` (48px tall) → opens AGT-INB-002 for this thread

Cards for other urgent types follow the same shape but with contextually accurate labels + actions.

### Zone 4 — Quota strip (56px)

A single visual bar showing the most-consumed metered feature this month:
- Label: `Instagram posts · 42 of 50 left this month` / `منشورات إنستغرام · ٤٢ من أصل ٥٠ متبقٍّ`
- Horizontal bar (rounded 4px), primary color fill
- Tap → AGT-SUB-003 (credits page)

Chooses the feature with the highest remaining-capacity concern (< 30% headroom).

### Zone 5 — Recent listings (rest of screen until FAB)

Horizontal scrollable card row (snap-scroll):
- Section header: `Your recent listings` / `أحدث إعلاناتك` with right-aligned `See all →` link (→ AGT-LST-001)
- Cards: 260×160 with square-ish photo (1:1 crop at 160×160 on the left, content on the right)
- Content: price · beds/baths/area · status pill (Active / Pending / Sold)
- Long-press for quick actions (Share / Publish / Edit)
- Tap → AGT-LST-003

Show 3-5 cards; if the agent has < 3 listings, use the empty-state hero (see below).

### Zone 6 — Today's tasks (compact)

- Section header: `Today` / `اليوم` with `See all →` (→ AGT-TSK-001)
- Up to 3 task rows, each 48px:
  - Checkbox left (tap to complete → confetti-free success tick)
  - Task title + due-time
  - Right chevron
- If none: hide the section (don't render an empty state — this is a low-visual-weight zone)

### Zone 7 — Recent activity (compact, 3 items)

- Section header: `Latest` / `آخر التحديثات`
- 3 activity rows, each 56px:
  - Icon left (48×48 tinted circle with icon: 💬 for message, 📸 for publish, 📊 for analytics, 🏠 for listing)
  - Two-line text: what happened + when
  - Right chevron
- Tap → source screen

### Floating action button (FAB)

- Position: bottom-right, 24px from bottom (above the tab bar), 24px from edge (RTL: bottom-left, 24px from left)
- 56×56 circular, brand color, elevation shadow
- Icon: `+` (Lucide Plus)
- Tap → action sheet from bottom with three big options:
  - `Add a listing` → AGT-LST-004
  - `Add a contact` → AGT-CTC-003
  - `Add a task` → AGT-TSK-002
- Long-press opens WhatsApp intake instructions overlay (subtle nudge)

### Zone 8 — Bottom tab bar (SHR-NAV-003, defined separately)

Not part of THIS screen but present. 5 tabs.

---

## Empty state — first-time / no listings yet

If the agent has 0 listings:
- Greeting stays
- Urgent card is replaced with a large friendly hero:
  - Illustration (people + phone + house, MENA-appropriate)
  - Heading: `Let's list your first property` / `فلنُدرج عقارك الأول`
  - Body: `The easiest way is to send us photos + a voice memo on WhatsApp. We'll draft the listing for you.` / `أسهل طريقة هي إرسال صور ومذكّرة صوتية عبر واتساب، وسنكتب الإعلان بدلًا منك.`
  - Big primary button: `Start with WhatsApp` (→ AGT-ONB-002)
  - Text link below: `Or add manually` (→ AGT-LST-004)
- Onboarding checklist (AGT-ONB-005) inserted BELOW the hero as an accordion

---

## Explicit copy (EN + AR)

| Key | EN | AR |
|---|---|---|
| `greeting.morning` | Good morning, {name} | صباح الخير يا {name} |
| `greeting.afternoon` | Good afternoon, {name} | مساء الخير يا {name} |
| `greeting.evening` | Good evening, {name} | مساء الخير يا {name} |
| `greeting.night` | Working late, {name}? | عملٌ متأخّر، يا {name}؟ |
| `date` | {weekday}, {month} {day} | {weekday}، {day} {month} |
| `urgent.newLead.label` | NEW LEAD · {agoText} | عميل جديد · {agoText} |
| `urgent.newLead.title` | {name} asked about {property} | سأل/ت {name} عن {property} |
| `urgent.newLead.sub` | Via {channel} · Budget {currency} {amount} | عبر {channel} · الميزانية {currency} {amount} |
| `urgent.newLead.button` | Reply now | ردّ الآن |
| `urgent.pricing.label` | PRICE ALERT | تنبيه سعري |
| `urgent.pricing.title` | Your {property} may be overpriced by {pct}% | قد يكون {property} مُبالغًا في سعره بنسبة {pct}% |
| `urgent.pricing.button` | Review pricing | راجع التسعير |
| `urgent.expiring.label` | EXPIRING SOON | ينتهي قريبًا |
| `urgent.expiring.title` | {property} expires in {days} days | ينتهي {property} خلال {days} أيام |
| `urgent.expiring.button` | Renew | جدّد |
| `urgent.publishFailed.label` | PUBLISH FAILED | فشل النشر |
| `urgent.publishFailed.title` | We couldn't post to {channel} | تعذّر النشر على {channel} |
| `urgent.publishFailed.button` | Fix and retry | أصلح وأعد المحاولة |
| `quota.headline` | {feature} · {remaining} of {total} left this month | {feature} · {remaining} من أصل {total} متبقٍّ |
| `section.recentListings` | Your recent listings | أحدث إعلاناتك |
| `section.today` | Today | اليوم |
| `section.latest` | Latest | آخر التحديثات |
| `link.seeAll` | See all → | عرض الكل ← |
| `empty.hero.title` | Let's list your first property | فلنُدرج عقارك الأول |
| `empty.hero.body` | The easiest way is to send us photos and a voice memo on WhatsApp. We'll draft the listing for you. | أسهل طريقة هي إرسال صور ومذكّرة صوتية عبر واتساب، وسنكتب الإعلان بدلًا منك. |
| `empty.hero.buttonPrimary` | Start with WhatsApp | ابدأ عبر واتساب |
| `empty.hero.buttonSecondary` | Or add manually | أو أضف يدويًا |
| `fab.addListing` | Add a listing | إضافة إعلان |
| `fab.addContact` | Add a contact | إضافة جهة اتصال |
| `fab.addTask` | Add a task | إضافة مهمة |
| `error.load` | We couldn't load your dashboard. Try again? | تعذّر تحميل لوحتك. حاول مجددًا؟ |
| `offline.banner` | You're offline. Showing your last saved data. | أنت غير متصل. نعرض آخر البيانات المحفوظة. |

Copy voice: warm, direct, personal ("your"), respectful of the user's time. No exclamations except in the "Working late?" late-night greeting. No jargon (never "SKU", "quota", "reservation" — instead: "posts left this month").

---

## Component palette

- `<Card>` — for urgent card and empty-state hero
- `<Button variant="primary">` — for urgent card action + empty-state CTA
- `<Button variant="outline">` — for "Or add manually" and secondaries
- Custom `<QuotaBar>` — extends `<FeatureQuotaBar>` from `web/src/components/credits/FeatureQuotaBar.tsx`
- `<ListingCard>` — from `web/src/components/PropertyCard.tsx`, mobile variant (260×160)
- Custom `<UrgentBanner>` — new component; variants per urgent type
- `<Sheet>` (bottom sheet from Radix) — for the FAB action sheet
- `<Skeleton>` for every data-backed zone
- FAB: custom button, 56×56, brand color, elevation

Icons: `lucide-react`
- `Bell`, `BellDot` — notification bell
- `Plus` — FAB
- `MessageCircle`, `Camera`, `BarChart3`, `Home` — activity icons
- `AlertTriangle` — pricing alert
- `Clock` — expiring soon
- `X` — publish failed

Fonts:
- Latin: system font stack, 15px base, 22px greeting
- Arabic: `IBM Plex Sans Arabic`, 15px base, 22px greeting
- Numerals: use locale-appropriate (Arabic uses ٠-٩ in Arabic mode)

Colors (light theme values):
- `--bg` `#FCFCFD`
- `--card` `#FFFFFF` with 0 1px 2px rgba(0,0,0,0.06) shadow
- `--fg` `#0F172A`, `--fg-muted` `#64748B`
- `--primary` `#1D4ED8` (deep blue — trustworthy MENA-appropriate; NOT the tech-startup purple)
- `--accent` `#F97316` (warm orange for urgent-card strip)
- `--success` `#10B981`, `--warning` `#F59E0B`, `--danger` `#EF4444`
- Dark theme: warm neutrals, not pure black — `--bg` `#0B0F1A`, `--card` `#111827`

Corner radius: 16px on cards, 12px on buttons.

Motion:
- Skeleton pulses at 1.5s
- Cards fade in as data lands (150ms)
- FAB action sheet slides up from bottom (250ms ease-out)
- Task-complete tick animates (200ms, subtle — no confetti)
- Long-press feedback: 100ms scale-to-0.98

---

## Sample content

Render two states:

**State 1 — Sara, morning, has 3 listings, one new lead**
- Greeting: `Good morning, Sara` / `Wednesday, September 4`
- Urgent card: `NEW LEAD · 12 MIN AGO / Sara asked about the 2BR in Downtown Dubai / Via WhatsApp · Budget AED 850k / [Reply now]`
- Quota: `Instagram posts · 42 of 50 left this month` (bar at ~16%)
- Recent listings: 3 cards
  1. AED 2.4M · 2BR · 1,200 sqft · Downtown Dubai · Active · sample photo (modern apartment)
  2. AED 850k · 1BR · 720 sqft · JVC · Active · sample photo
  3. AED 3.8M · 4BR villa · Arabian Ranches · Pending · sample photo
- Tasks: `Follow up with Ahmed · 10:00`, `Confirm viewing with Priya · 14:30`
- Activity: 3 rows

**State 2 — Ahmed, first-time, no listings, empty state**
- Greeting: `Good afternoon, Ahmed`
- Hero: WhatsApp illustration + `Let's list your first property` + `[Start with WhatsApp]`
- Onboarding checklist below (2 of 6 complete)

Both states in EN light, AR RTL dark.

---

## Interactions & gestures

- **Pull to refresh** — refreshes urgent card + quotas + recent activity. Native-feeling spinner from Capacitor's pull-to-refresh or a custom one.
- **Long-press listing card** — quick-actions sheet (Share / Publish / Edit).
- **Long-press FAB** — quick tip overlay ("Did you know you can send WhatsApp photos to draft a listing?").
- **Swipe left on task row** — Complete inline.
- **Tap greeting** — no action (not a link).
- **Tap language pill** — instant locale switch, no confirmation. Preserve scroll position and page state.

---

## State variants

1. **First load** — skeletons for every zone, greeting resolves first (from cached user)
2. **Loaded, urgent present** — as State 1 above
3. **Loaded, nothing urgent** — Zone 3 shows a gentle "You're on top of things" card with an illustration
4. **Loaded, empty account** — as State 2 above
5. **Offline** — banner at top ("You're offline..."), cached data shown, write-actions disabled
6. **Error** — hero replaced with retry card

---

## Accessibility

- WCAG 2.1 AA throughout
- All tap targets ≥ 48×48
- Screen-reader order: greeting → urgent card → quota → tasks → listings → activity → FAB
- Aria labels on all icon buttons
- Reduced motion honored: skeleton pulses become static, FAB sheet snaps rather than slides
- Focus visible on every interactive element (keyboard-navigable even on mobile with hardware keyboard)
- Language switcher updates `<html lang>` and `<html dir>` immediately

---

## Anti-patterns — do NOT do

- Do not put a KPI grid ("Views · Inquiries · Conversions · Revenue") as the top zone. That's Pro-mode density (AGT-DSH-002). Guided leads with a decision, not numbers.
- Do not use emoji in section headers (💰 Recent listings). Icons are for compact rows only.
- Do not center-align long text — Arabic + English both read left-aligned (in RTL, right-aligned).
- Do not show a hamburger menu — the bottom tab bar is the primary nav.
- Do not use "Welcome back!" — that's a login screen phrase, not a dashboard phrase. Use time-of-day greeting.
- Do not include Wingcaster branding in the top-left. The user knows they opened the app.
- Do not show notifications count > 99 as "99+" — cap at "9+" (mobile UX best practice, less screen real estate).

---

## Reference designs

- **Notion mobile home** — greeting pattern, quiet urgency
- **Airbnb Host mobile app** — real-estate feel, photo-forward, warm
- **Bayut agent app** — MENA baseline, familiar to target users
- **Linear mobile inbox** — urgent-card pattern, one-decision-first
- **Calm** — soft warm color palette, not too tech

Avoid style-anchoring on: Google Analytics (too dense), Salesforce Mobile (too corporate), Instagram (too playful for a work tool).

---

## Downstream implementation

- File: `web/src/pages/AgentDashboardPage.tsx` — full rewrite for mobile-first
- New components:
  - `web/src/components/dashboard/UrgentBanner.tsx` — variants per urgent type
  - `web/src/components/dashboard/GreetingHeader.tsx` — time-of-day + date
  - `web/src/components/dashboard/QuickAddSheet.tsx` — FAB action sheet
- Reused: `PropertyCard.tsx`, `FeatureQuotaBar.tsx`, `Skeleton.tsx`
- Backend: `GET /api/dashboard/stats` returns the urgent priority list + quota headliner + recent activity; may need to be split into `GET /api/dashboard/urgent`, `GET /api/dashboard/quota-headliner`, `GET /api/dashboard/activity-feed` for finer caching
- i18n: `web/src/i18n/en/dashboard.json`, `web/src/i18n/ar/dashboard.json`
- RTL: implemented via `<html dir>` swap + Tailwind logical properties (`ms-4` not `ml-4`, `pe-6` not `pr-6`)
