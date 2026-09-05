# Screen Brief — AGT-LST-003 · Listing Detail (mobile, Guided mode)

**Layer-2 Brief for design AI consumption.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-LST-003`. This is the highest-frequency screen an agent will visit — every publish, every price change, every share, every performance check flows through here. It must feel like the property itself lives in the phone.

---

## 🎨 Broadcast alignment (added 2026-09-04 post PR #41 merge)

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Inline hex or shadcn-generic references get replaced with `--lc-*` semantic tokens.

**Screen-specific Broadcast callouts for the mobile Listing Detail:**
- Top nav (44px + safe area): `--lc-surface` background. Back arrow + Share + Bookmark + More icons all 32×32 with 44px tap target enforced by base CSS.
- Photo hero (300px tall): full-bleed. Photo counter overlay "1 / 12" uses `<Numeric>` inside a `--lc-surface-inverse` pill with `--lc-text-inverse` ink.
- **Status pill on hero** (Active / Draft / Pending / Sold): NEVER color-alone. `--lc-status-{X}-{bg,fg,dot}` + required glyph (draft ○ · published ● · underOffer ◐ · closed ◆ · archived ▢ · unpublished ✕) + label. Positioned top-left inside safe-area.
- **Price**: `font: var(--lc-type-display)` — Archivo 800, 32/38 — with `<Numeric>` wrapping the value. Currency prefix ("AED") stays UI font.
- **Beds / baths / area row**: every numeral wrapped in `<Numeric>`. Dot separators between fields in `--lc-text-muted`.
- "Change" pill (opens AGT-APR-002 price adjust): `<Button variant="ghost" size="sm">` — but override the size to keep 44px min tap target on mobile.
- Address + area link: `font: var(--lc-type-body)`. Area link chevron in `--lc-text-brand` (orange).
- Tab bar (Overview / Publications / Comments / Analytics / Notes): `<Tabs>` primitive. Active tab underline `--lc-action-primary`, 2px. Tabs are horizontally scrollable — critical for Arabic RTL when tab labels are longer.
- Amenity icons in Overview: 24px lucide icons + label. Grid 2-col mobile, 4-col tablet+.
- Publications tab: per-channel row uses `<ChannelMark>` (Instagram pink, WhatsApp green, TikTok black etc.) + status pill next to it + timestamp in `<Numeric>` (relative time).
- Comments tab: comment cards use `--lc-surface-raised` + `--lc-elevation-sm`. Channel badge on each. Classification badge uses `--lc-status-*` tokens per category (Inquiry = published-green, Complaint = unpublished-red, Compliment = underOffer-amber, etc. — pick semantically).
- Analytics tab: 3-KPI strip in Guided mode uses `<Numeric>` for every value. Sparkline chart uses `--lc-action-primary` line + `--lc-accent` reference band.
- **Sticky bottom action bar** (72px + safe area): `--lc-surface` background with `--lc-elevation-md` shadow appearing on scroll. Elevation SHADOW-ONLY when content scrolls under; no shadow at rest.
- Bottom bar buttons: Edit (`<Button variant="outline">`) + Publish (`<Button>` primary orange, flex-grow) + Share (`<Button variant="outline">`). All 44px+ min-height.
- **Publish button hover / press** on mobile: press feedback via `--lc-easing-emphasis` (spring) — this is the ONE screen where the "publish moment" easing lands. Signal lamp pulse on success (200ms, `--lc-accent-bold` on the confirmation toast).
- Photo gallery swipe: momentum scroll, snap. `--lc-duration-base` (180ms) for dot-indicator transitions.
- Delete confirm (destructive): `<Dialog>` with `<Button variant="destructive">` (`--lc-status-unpublished-fg` red). Requires typed "DELETE" confirmation + step-up via `SHR-MFA-007`.
- Share sheet: native share on Capacitor mobile OR `<Sheet>` fallback with `--lc-elevation-lg`.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-LST-003 |
| Screen name | Listing Detail |
| Persona | Agent (owner) — Guided mode |
| Device target | Mobile 375px primary |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Runtime | Capacitor wrapper — must feel like a native app |
| Route | `/listings/:id` |
| Mode | Guided (Pro variant reuses same layout with denser tabs) |
| Current state | EXISTS at `web/src/pages/ListingProfilePage.tsx` — this brief supersedes with mobile-first + Guided-mode redesign + sticky bottom action bar |

---

## Purpose (one sentence)

Show one owned property in a way that makes the agent proud to share it, gives them one-tap access to publish/edit/share, and surfaces performance without them having to hunt for it.

---

## Design goals

1. **Photo-first** — the hero is the property, not a data table
2. **Sticky action bar at bottom** — Publish is always one tap away, no matter how far the user scrolls
3. **Tabs for depth** — Overview / Publications / Comments / Analytics / Notes — but Overview is 80% of use
4. **Share is a first-class action**, not buried in a menu
5. **Delete is destructive and slow** — never a single-tap
6. **Feels like a listing page a buyer might see**, but with owner-only actions

---

## Layout — mobile 375px, portrait

Reading top-to-bottom:

### Zone 1 — Top nav (44px + safe area)

- Left: back arrow → AGT-LST-001 (respects Android hardware back)
- Center: nothing
- Right: three icon buttons (32×32 each, 12px apart)
  - Share (`Share2` icon) — opens native share sheet
  - Bookmark/Favorite — for personal watchlist
  - More (`MoreVertical`) — opens action sheet with (Duplicate / Archive / Delete)

### Zone 2 — Photo hero (300px tall — 80% of viewport width in 16:9 aspect)

- Full-bleed edge-to-edge horizontal-swipe photo gallery
- Photo counter overlay bottom-right: `1 / 12`
- Dot indicators bottom-center (max 5 dots, ... for more)
- Status pill top-left (10px inset from safe area): `Active` / `Draft` / `Pending Review` / `Sold`
- If video: play button overlay center
- If voice memo attached: waveform overlay bottom-left
- Swipe left/right to advance; pinch-to-zoom on tap-to-expand (full-screen photo viewer)
- RTL: swipe direction inverts (visual only — backend photo order stays)

### Zone 3 — Price + key stats (72px)

- Big price: `AED 2,400,000` — 24px semibold. Arabic uses locale numerals: `٢٬٤٠٠٬٠٠٠ درهم`
- Under price: `2 bed · 2 bath · 1,200 sqft · Apartment` — 15px muted. Dot separators.
- Right side: small "Change" pill (Ghost button) that opens AGT-APR-002 (adjust price)

### Zone 4 — Location (64px)

- Address one line: `Marina Gate 1, Dubai Marina` — 15px
- Under: neighborhood link (chevron) → AGT-NVL-001: `See what makes this area great →` / `اعرف ما يميّز هذه المنطقة ←`

### Zone 5 — Tab bar (48px, sticky under status bar on scroll)

Five tabs, horizontally scrollable if they overflow (they will in Arabic):
- `Overview` (default)
- `Publications` — badge showing count
- `Comments` — badge showing unread
- `Analytics`
- `Notes`

Active tab has 2px underline in primary color. Tap → filter zone 6.

### Zone 6 — Tab content (variable height, scrolls under sticky elements)

**Overview tab (default):**
- Description card (200 char preview, "See more" expander)
- Amenities grid (icons + label, 2 columns): Pool, Gym, Parking, Balcony, etc.
- Highlights list (agent-authored): "Panoramic marina view", "Recently renovated", etc.
- Documents section (contract, floor plan PDFs) — files-with-icons list
- Offers section (see AGT-LST-010) — cards for each offer received

**Publications tab (AGT-LST-011):**
- Timeline of publishing events (per channel)
- Each row: channel icon + label ("Instagram · 3 days ago") + status pill (Success / Failed / Pending / Removed)
- Failed rows have inline "Fix and retry" link → AGT-PUB-004
- Sub-section at bottom: Scheduled posts (if any)

**Comments tab (AGT-LST-012):**
- Comment cards per channel
- Author avatar + text + timestamp + channel badge
- Classification badge (Inquiry / Compliment / Question / Spam)
- Reply inline (opens AGT-INB-002)
- Mark spam / Reclassify actions

**Analytics tab (AGT-LST-006):**
- 3-KPI strip (Views / Saves / Inquiries) — Guided keeps it simple
- One sparkline chart (last 30 days)
- Per-channel breakdown row
- "Full analytics" link → Pro mode variant

**Notes tab:**
- Private-to-owner notes (rich text)
- Timeline of note edits
- Add Note button

### Zone 7 — Sticky bottom action bar (72px + safe area)

Full-width bar, always visible, floats above content on scroll:
- Left button (48px, outline): `Edit` → AGT-LST-005
- Center button (flex, primary, 48px): `Publish` → AGT-PUB-001 (with Guided one-tap flow)
- Right button (48px, outline): `Share` → native share sheet

If the listing is `Draft`: button changes to `Save & Publish`.
If the listing is `Sold`: bar collapses to just an `Edit` button + `Unarchive` if archived.

---

## Layout — desktop 1440px

Two-column: left 60% is the photo hero + tab content; right 40% is a sticky sidebar with price / key stats / location / action buttons stacked vertically. Comments and Publications tabs render as full-width overlays on desktop.

---

## Explicit copy (EN + AR)

| Key | EN | AR |
|---|---|---|
| `back` | Back | رجوع |
| `share` | Share | مشاركة |
| `bookmark` | Bookmark | حفظ |
| `more` | More | المزيد |
| `status.active` | Active | نشط |
| `status.draft` | Draft | مسودّة |
| `status.pending` | Pending Review | قيد المراجعة |
| `status.sold` | Sold | مُباع |
| `status.archived` | Archived | مُؤرشف |
| `photoCounter` | {n} / {total} | {n} / {total} |
| `price.change` | Change | تغيير |
| `stats.pattern` | {beds} bed · {baths} bath · {area} {unit} · {type} | {beds} غرفة · {baths} حمام · {area} {unit} · {type} |
| `location.areaLink` | See what makes this area great → | اعرف ما يميّز هذه المنطقة ← |
| `tab.overview` | Overview | نظرة عامة |
| `tab.publications` | Publications | المنشورات |
| `tab.comments` | Comments | التعليقات |
| `tab.analytics` | Analytics | التحليلات |
| `tab.notes` | Notes | الملاحظات |
| `desc.seeMore` | See more | عرض المزيد |
| `desc.seeLess` | See less | عرض أقل |
| `section.amenities` | Amenities | المرافق |
| `section.highlights` | Highlights | أبرز الميزات |
| `section.documents` | Documents | المستندات |
| `section.offers` | Offers received | العروض المستلمة |
| `action.edit` | Edit | تعديل |
| `action.publish` | Publish | نشر |
| `action.savePublish` | Save & Publish | حفظ ونشر |
| `action.unarchive` | Unarchive | إلغاء الأرشفة |
| `analytics.views` | Views | المشاهدات |
| `analytics.saves` | Saves | الحفظ |
| `analytics.inquiries` | Inquiries | الاستفسارات |
| `analytics.fullLink` | See full analytics → | عرض التحليلات الكاملة ← |
| `publications.retry` | Fix and retry | أصلح وأعد المحاولة |
| `publications.scheduled` | Scheduled | مُجدول |
| `comments.reply` | Reply | ردّ |
| `comments.markSpam` | Mark as spam | ضع علامة كمزعج |
| `comments.reclassify` | Reclassify | إعادة التصنيف |
| `notes.add` | Add a note | إضافة ملاحظة |
| `more.duplicate` | Duplicate listing | نسخ الإعلان |
| `more.archive` | Archive listing | أرشفة الإعلان |
| `more.delete` | Delete listing | حذف الإعلان |
| `archive.confirm.title` | Archive this listing? | هل تريد أرشفة هذا الإعلان؟ |
| `archive.confirm.body` | It will be hidden from public sites and portals. You can unarchive later. | سيُخفى من المواقع العامة والبوابات. يمكنك إلغاء الأرشفة لاحقًا. |
| `archive.confirm.cta` | Archive | أرشف |
| `archive.confirm.cancel` | Cancel | إلغاء |
| `delete.confirm.title` | Delete this listing permanently? | حذف هذا الإعلان نهائيًا؟ |
| `delete.confirm.body` | This cannot be undone. Publications will be removed. Comments and analytics history will be lost. | لا يمكن التراجع. ستُزال المنشورات وستُفقد التعليقات وسجلّ التحليلات. |
| `delete.confirm.typeLabel` | Type DELETE to confirm | اكتب "حذف" للتأكيد |
| `delete.confirm.cta` | Delete listing | حذف الإعلان |
| `share.copyLink` | Copy link | نسخ الرابط |
| `share.qr` | QR code | رمز QR |
| `share.native` | Share via… | شارك عبر… |
| `share.instagram` | Share to Instagram Story | شارك على ستوري إنستغرام |
| `share.whatsapp` | Share via WhatsApp | شارك عبر واتساب |
| `error.load` | We couldn't load this listing. Try again? | تعذّر تحميل الإعلان. حاول مجددًا؟ |
| `error.permission` | You don't have access to this listing. | ليس لديك صلاحية على هذا الإعلان. |

Copy voice: warm and confident. Never "!". Use full sentences for buttons where the action isn't self-evident.

---

## Component palette

- `<PhotoGallery>` — custom, horizontal snap-scroll with dots + counter, full-screen expand on tap
- `<StatusPill>` — variants: active / draft / pending / sold / archived
- `<Tabs>` from Radix — horizontal, sticky-on-scroll
- `<Card>` for sections in Overview
- `<Button variant="primary" | "outline">` — action bar
- `<Sheet>` from Radix — for More action sheet + Share sheet
- `<Dialog>` — Archive confirm + Delete confirm (with typed input)
- `<Sparkline>` — custom lightweight chart component (or use `recharts` minimal)
- `<KpiTile>` — reused from Analytics

Icons: `lucide-react`
- `ChevronLeft`, `Share2`, `Bookmark`, `MoreVertical`, `Play`
- `Edit`, `Send`, `Copy`, `QrCode`, `MessageCircle`, `Instagram`, `Trash2`, `Archive`
- Amenity icons: `Waves` (pool), `Dumbbell` (gym), `Car` (parking), `Wind` (AC), `TreePine` (garden), etc.

Fonts + colors + motion: inherit from the design system defined in `AGT-DSH-001-agent-dashboard-mobile-brief.md`.

Extra motion:
- Photo gallery: momentum scroll, snap, dot indicator animates on swipe
- Tab bar: 200ms slide of the active-tab underline
- Sticky action bar: elevation shadow appears when content scrolls under it
- Delete confirm: dialog scales in from 0.95 to 1.0 (150ms)

---

## Sample content

Render:

**State 1 — Active Dubai Marina apartment, English, light**
- Photos: 5 (modern 2BR marina apartment)
- Status: Active
- Price: AED 2,400,000
- Stats: 2 bed · 2 bath · 1,200 sqft · Apartment
- Address: Marina Gate 1, Dubai Marina
- Overview description: "Furnished 2-bedroom with panoramic marina views. Recently renovated kitchen. Access to premium building amenities including infinity pool and gym."
- Amenities: Pool, Gym, Parking, Concierge, Balcony, Sea view (6 items)
- 2 documents (Floor plan PDF, Title deed PDF)
- 1 offer received (AED 2,300,000, pending)
- Tab counts: Publications (4), Comments (7)
- Bottom bar: [Edit] [Publish] [Share]

**State 2 — Sold Egypt villa, Arabic, dark**
- Photos: 8
- Status: Sold (badge on hero)
- Price: EGP 12,500,000
- Stats: 4 غرفة · 5 حمام · 400 م² · فيلا
- Address: كمبوند بالم هيلز، القاهرة الجديدة
- Description in Arabic
- Bottom bar: [Edit] only (Publish hidden because sold)

**State 3 — Draft (no photos yet), Arabic, light**
- Photo hero shows placeholder: "Add photos" CTA (link → AGT-LST-005 edit)
- Status: Draft
- Price: — (dash, not zero)
- Stats: incomplete, shown as `— غرفة · — حمام`
- Bottom bar: [Edit] [Save & Publish]

---

## Interactions

- **Pull to refresh** — refreshes tab content
- **Swipe left/right on photo hero** — advance photo
- **Tap photo** — expand to full-screen photo viewer with pinch-zoom
- **Long-press photo** — save to device (via Capacitor)
- **Tap price "Change"** — opens AGT-APR-002 modal
- **Tap location area link** — → AGT-NVL-001
- **Tap tab** — filter content, update URL query `?tab=X`
- **Tap Publish** — opens AGT-PUB-001 (Guided one-tap flow)
- **Tap Edit** — → AGT-LST-005 with all fields populated
- **Tap Share** — opens Share sheet (native share sheet on iOS/Android via Capacitor)
- **Tap More** — opens action sheet (Duplicate / Archive / Delete)
- **Delete flow** — 3-tap: More → Delete → Type DELETE + confirm

---

## State variants

1. **Loading** — skeleton for hero, price, tabs, content
2. **Loaded — Active** — as State 1
3. **Loaded — Sold/Archived** — subdued (opacity 0.7 on photos, gray status watermark, limited actions)
4. **Loaded — Draft** — as State 3
5. **Permission denied** — full-screen `SHR-ERR-002` with "This listing belongs to another agent" message
6. **Not found** — `SHR-ERR-001` variant with "This listing was removed or never existed"
7. **Offline** — banner at top, actions that need network are disabled with tooltip

---

## Accessibility

- Photo gallery: alt text per photo (agent-authored during listing creation)
- Status pill: has aria-label describing status
- Tab bar: proper `role="tablist"` + `role="tab"` + `aria-selected`
- Sticky bottom action bar: focus-order sensible; skip-link at top to jump to it
- Delete confirm: focus trapped in dialog, ESC cancels
- Screen-reader: hero → status → price → stats → location → tabs (active tab announced) → content
- Bottom-tab-bar and this screen's sticky-action-bar both respect safe-area-inset-bottom
- Video hero has captions option if video contains speech

---

## Anti-patterns — do NOT do

- Do not make the price a small element in the corner — it's the second-most-important thing after the photos
- Do not hide Publish inside a menu — it's the primary action
- Do not use the browser's default share button — always use the native Capacitor share sheet on mobile
- Do not show a delete button that looks like a normal action — Delete lives under More, and requires typed confirm
- Do not show all analytics on Guided mode — 3 KPIs + one chart is enough; deep dive is Pro
- Do not put Comments in a modal — they belong as a tab so the user can browse without losing context
- Do not autoplay video in the hero — user opt-in only

---

## Reference designs

- **Airbnb listing detail (mobile)** — photo hero, sticky action bar treatment
- **Bayut listing (mobile)** — MENA baseline
- **Zillow home details (mobile)** — analytics-visible pattern (for reference; we're more restrained on Guided)
- **Instagram post viewer** — full-screen photo viewer pattern
- **Notion mobile page** — tab-in-detail-page pattern

Avoid style-anchoring on: MLS or IDX portals (too dense), Craigslist (too plain), Facebook Marketplace (too casual).

---

## Downstream implementation

- File: `web/src/pages/ListingProfilePage.tsx` — full rewrite for mobile-first Guided
- New components:
  - `web/src/components/listings/PhotoGallery.tsx`
  - `web/src/components/listings/StickyActionBar.tsx`
  - `web/src/components/listings/StatusPill.tsx`
- Reused: `Tabs`, `Card`, `Dialog`, `Sheet`, `Button`, `PropertyCard` (for offers)
- Backend: `GET /api/properties/:id` already returns everything needed; verify shape includes `documents[]`, `offers[]`, `documents_pdf_urls`
- Publications tab: `GET /api/properties/:id/distributions`
- Comments tab: `GET /api/listings/:id/comments`
- Analytics tab: `GET /api/listings/:id/performance`
- Notes tab: `GET /api/properties/:id/notes`
- Metering: view event fires once per session load (`POST /api/properties/:id/events`)
