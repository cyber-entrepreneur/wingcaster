# Screen Brief — SHR-SET-003 · Billing & notification preferences

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_SHARED.md` §7 (`SHR-SET-003`). One of the Wave-1 settings-shell children per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5 row 14. This brief is a **delta from the SHR-SET-001 anchor** — the settings shell (top-bar + left sub-nav + right pane on desktop; stacked list on mobile) is inherited unchanged. This brief only specifies the pane content, per-section behavior, and Paddle-portal deep-links.

**Scope note:** Matrix row 7-§SHR-SET-003 originally scoped this as "billing notification preferences" only. This brief consolidates the Wave-1 kickoff row title "Billing / notification prefs" per §5 row 14 — a single pane that houses **(a) current subscription overview + Paddle portal deep-link, (b) invoice history table, and (c) notification-channel preferences (WhatsApp / Email / SMS / Push per WF-24)**. If the implementer wants to split into two sub-pages later, that's a downstream refactor; the API shape supports it.

---

## 🎨 Broadcast alignment (inherits from anchor)

**This brief inherits the Broadcast token contract from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` AND the settings-shell chrome from `SHR-SET-001`.** Do not re-render the shell.

**Screen-specific Broadcast callouts (deltas only):**
- Pane title `var(--lc-type-heading-1)` — "Billing & notifications". Sub `var(--lc-type-body-lg)` muted.
- Three section anchors (Subscription / Invoices / Notification channels) rendered as `<Tabs>` on desktop when pane width < 900px, otherwise as three stacked sections with anchor links at pane-top.
- Subscription tier card: `--lc-surface-raised` + `--lc-elevation-sm`, plan name in `var(--lc-type-heading-2)`, price in `<Numeric>` with `var(--lc-type-data)` (mono, tabular).
- Paddle portal button: `<Button variant="default">` with external-link icon (`ExternalLink` from lucide-react). Label makes the destination explicit ("Manage in Paddle portal ↗").
- Invoice table: `<Table>` primitive; header row `--lc-surface-sunken`; amount + date columns use `<Numeric>` mono. Status column uses `<Badge>` — paid → `--lc-status-published-*`, failed → `--lc-status-unpublished-*`, pending → `--lc-status-draft-*`.
- Download-invoice action per row: `<Button variant="ghost" size="icon">` with `Download` icon; opens signed URL in a new tab.
- Notification channel grid: `<Table>` cross-tab — rows = event types (invoice-sent, payment-failed, credit-low, etc.), columns = channels (WhatsApp / Email / SMS / Push). Each cell = `<Checkbox>` primitive.
- Channel column headers include the `<ChannelMark>` component (channel-specific tint + on-ink per Broadcast) at 20px.
- "Test send" ghost button per channel column header — sends a sample notification to the current user's own address.
- Save behavior: autosave-on-toggle for each cell; small `Saved ✓` pill above the table fades in for 1.5s.
- Two-tone focus ring automatic; 44px tap floor automatic; do not override.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-SET-003 |
| Screen name | Billing & notifications |
| Persona | All authenticated (per-tenant billing — the pane shows the currently-active tenant's subscription; users with multiple tenants pick from tenant-switcher in the shell top-bar) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/settings/billing` (deep-linkable; sub-nav highlights "Billing & notifications" on entry) |
| Current state | PARTIAL — `GET /api/tenant/subscription` + `GET /api/tenant/invoices` exist (`backend/src/lib/credits/tenant-routes.js:208,305`); `GET/PUT /api/billing/notifications/preferences` exists (`backend/src/notifications/subscription/routes.js`). No unified UI page — legacy tenant-scoped screens partial. Paddle-portal-session mint endpoint status: unknown; see §Backend contract. |
| Workflow role | WF-24 (notification-channel preferences) primary surface; billing-flow read-only surface (edits live in Paddle portal) |
| Backend prerequisites | ✅ `GET /api/tenant/subscription` · ✅ `GET /api/tenant/invoices` · ✅ `GET/PUT /api/billing/notifications/preferences` · ⏳ `POST /api/billing/portal-session` (mint a Paddle customer portal URL — NEW backend surface) · ⏳ Notification-channel matrix API shape (see §Backend contract; existing endpoint returns preferences but shape may need extension for per-event × per-channel matrix) |

---

## Purpose

The user manages **three things** for the current tenant:

1. **Subscription overview** — what plan is active, when it renews, what it costs. Read-only here; edits live in the Paddle customer portal (deep-linked).
2. **Invoice history** — every past invoice with amount + date + status + download link. Paged, filterable by status.
3. **Notification-channel preferences** — a per-event × per-channel grid (invoice-sent / payment-failed / credit-low / renewal-approaching / … × WhatsApp / Email / SMS / Push). Autosave on toggle.

Success outcome: the user finds their current plan without noise; every invoice is downloadable in one click; the channel matrix reflects what they want.

Design goal: this pane must NOT try to be a billing dashboard. It's an anchor screen for the two flows that matter (change plan in Paddle; adjust notification channels).

---

## Design goals

1. **Subscription is glanceable, not a form.** Plan name + price + next-renewal date + a single primary CTA ("Manage in Paddle portal ↗"). Nothing else editable here.
2. **Invoice history is a table, not cards.** Numeric-mono amounts + dates; status badges; per-row download; server-paginated.
3. **Notification channel matrix is the true feature of this screen.** Cross-tab layout, autosave-on-toggle, per-column test-send button.
4. **Channel availability is honest.** If the user has no linked WhatsApp number, the WhatsApp column shows an inline "Link WhatsApp →" empty-state, not silently-disabled checkboxes.
5. **RTL Arabic first-class.** Table headers mirror; numeric columns stay LTR; channel marks stay their canonical orientation.

---

## Layout

### Desktop / tablet ≥1024px (inside SHR-SET-001 shell right pane)

Reading top-to-bottom:

1. **Pane title row** — "Billing & notifications" (H1) + sub "For **{tenantName}**. Switch tenant in the top bar to see other subscriptions."
2. **Anchor-nav strip** — three text links (Subscription · Invoices · Notification channels) that scroll to sections; sticky just below pane title on scroll.
3. **Subscription section:**
   - Card 1 (raised) — plan name + tier badge, price (`<Numeric>` mono), billing cycle, next-renewal date, primary CTA "Manage in Paddle portal ↗".
   - Card 2 (sunken) — meta strip: payment method (masked card / last-4), tax region, currency. Small "Update payment method in Paddle portal" link.
3. **Invoices section:**
   - Header row: "Invoice history" (H2) + right-aligned status filter (`<Select>`: All / Paid / Failed / Pending / Refunded).
   - `<Table>`:
     - Columns: Invoice # · Date · Amount · Status · Actions (Download).
     - Rows paged 10 per page; server-driven pagination.
     - Empty state: "No invoices yet." (illustration + one-liner).
4. **Notification channels section:**
   - Header row: "Notification channels" (H2) + right-aligned "Reset to defaults" ghost button.
   - Sub-explanation: "Choose how you want to be notified for each event. You can test each channel."
   - Column-headers row (across the top of the matrix): WhatsApp · Email · SMS · Push. Each header has a `<ChannelMark>` + label + a small "Test send" ghost button below.
   - Rows (event types):
     - Billing group: Invoice sent · Payment failed · Subscription renewing soon · Credit low · Credit exhausted
     - Deal-activity group (out of Wave 1 scope; STUB with disabled checkboxes for now, marked "coming soon")
   - Each cell = `<Checkbox>` (checked = ON). Autosave-on-toggle.
   - Above the matrix: `Saved ✓` pill (fades in on any save).
   - If a channel is unavailable for the user (e.g. no linked WhatsApp), the column shows an empty-state overlay in the checkbox area: "Link WhatsApp to enable →" (deep-link to `SHR-AUT-004` WhatsApp bind flow).

### Mobile ≤767px

Same three sections, single column, stacked:
- Anchor-nav strip becomes a sticky `<Tabs>` at pane-top; switching tab replaces the visible section (not accordion — full swap).
- Subscription cards stack.
- Invoice table becomes a card list: each invoice = one card with Invoice # + Date on the top row, Amount + Status on the second, Download button full-width third row.
- Notification channels matrix becomes an accordion — each event is a collapsible; expanding shows 4 stacked toggles (one per channel) with the channel mark inline.
- "Test send" buttons stay inline with channel columns.

### Subscription-card anatomy

- **Plan name** — `var(--lc-type-heading-2)`, e.g. "Wingcaster Semsar".
- **Tier badge** — `<Badge>` — trial / free / paid tint (`--lc-status-draft-*` / `--lc-status-published-*` / `--lc-accent-bold-*` respectively).
- **Price row** — `<Numeric>` `var(--lc-type-display)` for the amount, `var(--lc-type-body)` `--lc-text-muted` for the currency + period ("USD / month").
- **Next-renewal row** — icon `Calendar` + "Renews on {longDate}". If canceled: "Cancels on {longDate}" in amber.
- **Primary CTA** — `<Button>` "Manage in Paddle portal ↗", opens in new tab.

---

## Explicit copy (English)

Arabic mirror strings in the AR MDX pass — placeholder `[TRANSLATION-PENDING]` for now.

| Slot | Copy |
|---|---|
| Pane title | Billing & notifications |
| Pane sub | For **{tenantName}**. Switch tenant in the top bar to see other subscriptions. |
| Anchor — subscription | Subscription |
| Anchor — invoices | Invoices |
| Anchor — channels | Notification channels |
| Subscription section heading | Your current plan |
| Plan renew line | Renews on {longDate} |
| Plan cancel line | Cancels on {longDate} |
| Plan trial line | Trial ends on {longDate} |
| Manage in Paddle CTA | Manage in Paddle portal ↗ |
| Payment method meta | Payment: **{brand}** ending in {last4} |
| Update payment link | Update payment method in Paddle portal ↗ |
| Tax region meta | Tax region: {country} |
| Currency meta | Currency: {code} |
| Invoice section heading | Invoice history |
| Filter — all | All |
| Filter — paid | Paid |
| Filter — failed | Failed |
| Filter — pending | Pending |
| Filter — refunded | Refunded |
| Column — invoice # | Invoice # |
| Column — date | Date |
| Column — amount | Amount |
| Column — status | Status |
| Column — actions | Actions |
| Download tooltip | Download PDF |
| Empty invoices | No invoices yet. |
| Empty invoices helper | When your first invoice is issued, it will appear here. |
| Channels section heading | Notification channels |
| Channels section sub | Choose how you want to be notified for each event. You can test each channel. |
| Reset to defaults | Reset to defaults |
| Test send button | Test send |
| Test send toast | Test sent — check your **{channel}**. |
| Test send failure | Couldn't send test. Try again. |
| Autosave pill | Saved ✓ |
| Event — invoice sent | Invoice sent |
| Event — payment failed | Payment failed |
| Event — renewal approaching | Subscription renewing soon |
| Event — credit low | Credit balance low |
| Event — credit exhausted | Credit balance exhausted |
| Channel unavailable — WhatsApp | Link WhatsApp to enable → |
| Channel unavailable — Push | Enable push in your app to enable → |
| Coming soon note | Deal-activity notifications coming soon. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Pane title | plain `<h1>` styled `var(--lc-type-heading-1)` |
| Anchor nav / mobile tabs | `<Tabs>` (Radix) |
| Subscription card | `<Card>` (raised) + `<Numeric>` for price |
| Tier badge | `<Badge>` (status tokens) |
| Paddle portal button | `<Button variant="default">` + `ExternalLink` icon |
| Payment method meta | Plain rows |
| Invoice filter | `<Select>` |
| Invoice table | `<Table>` (shadcn) + `<Numeric>` for amount/date; `<Badge>` for status |
| Download button | `<Button variant="ghost" size="icon">` + `Download` icon |
| Table pagination | `<Pagination>` (shadcn) |
| Channels matrix | Custom `<Table>` cross-tab wrapping `<Checkbox>` cells |
| Channel column header | `<ChannelMark>` + label + `<Button variant="ghost" size="sm">` (Test send) |
| Reset to defaults | `<Button variant="ghost">` + `AlertDialog` confirm |
| Autosave pill | Custom `<span>` — `--lc-status-published-bg` |
| Toasts | `<Sonner>` (bottom-center) |
| Channel unavailable overlay | Custom `<div>` with `<Link>` inside |

---

## Sample content (for v0 / mockup)

Show the desktop layout with:
- **Tenant:** "Elite Real Estate"
- **Subscription:** "Wingcaster Semsar" tier, USD 49 / month, renews on Oct 15, 2026, Visa ending 4242, tax region UAE, USD
- **Invoices table:** 3 rows —
  - `INV-2026-1042` · Sep 15, 2026 · $49.00 · Paid · Download
  - `INV-2026-0987` · Aug 15, 2026 · $49.00 · Paid · Download
  - `INV-2026-0921` · Jul 15, 2026 · $49.00 · Refunded · Download
- **Notification channels:** matrix populated — Invoice sent ✓ Email only; Payment failed ✓ Email + ✓ WhatsApp + ✓ Push; Credit low ✓ Push only; Credit exhausted ✓ Email + ✓ WhatsApp + ✓ Push + ✓ SMS. SMS column has one row of test-send button hover-state visible.

---

## Interactions

**Subscription section:**
- **Manage in Paddle portal ↗** → POSTs to `/api/billing/portal-session` → receives a signed Paddle portal URL → opens in `_blank` new tab. If POST fails: toast "Couldn't open Paddle portal. Try again." — button re-enables.
- **Update payment method link** → same flow, but the Paddle portal URL includes a `?section=payment-methods` deep-link hint.

**Invoices section:**
- **Filter change** → GET with `?status=` — replaces rows.
- **Pagination click** → GET with `?page=` — replaces rows.
- **Download** → GET signed URL from `/api/tenant/invoices/:id/download` → opens the returned URL in a new tab. On failure: toast.

**Notification channels section:**
- **Toggle a checkbox** → PATCH `/api/billing/notifications/preferences` with the (event, channel, on/off) triple. Optimistic UI: check flips immediately; on failure revert + toast.
- **Test send** → POST `/api/billing/notifications/test?channel=whatsapp` → sends a canned test message to the user's own linked address. Toast on 202 "Test sent — check your **{channel}**." Failure: toast + inline "couldn't send" label under column head.
- **Reset to defaults** → AlertDialog "Reset notification preferences to their defaults?" → PUT `/api/billing/notifications/preferences` with the defaults payload. On success: matrix rebuilds + toast.
- **Channel unavailable click** → deep-link into the linking flow (WhatsApp: `SHR-AUT-004`; Push: `SHR-SET-004` sessions/devices page section — see that brief).

**Keyboard:**
- Tab order: anchor tabs → subscription CTA → payment method link → invoice filter → invoice table (per-row Download) → pagination → reset-to-defaults → channel column test-send buttons → channels matrix (row-major cell order) → footer.
- Enter on Download opens the PDF in a new tab.
- Space toggles a channel checkbox.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Route resolving / initial GETs in flight | Skeleton: subscription card shape + 5-row invoice table shape + 5×4 checkbox grid shape. |
| **Loaded — active plan** | Subscription is active, invoices exist | Full render as sample. |
| **Loaded — trial** | Subscription is in trial | Tier badge shows "Trial" (`--lc-status-draft-*`); banner above card "Your trial ends on {longDate}. Add a payment method to continue." with Paddle-portal CTA. |
| **Loaded — canceled but active** | Canceled but paid-through-cycle | Banner "Your plan cancels on {longDate}. Restart in the Paddle portal to keep your team." |
| **Loaded — past-due** | Payment failed and grace-period active | Banner (amber) "Your last payment failed. Update your payment method in the Paddle portal to keep service." Invoice table shows the failed invoice at top with failed badge. |
| **Loaded — no invoices** | Zero rows | Table replaced by empty-state illustration + copy. |
| **Loaded — filter empty** | Non-zero rows total but filter returns none | "No {status} invoices." (no illustration; less loud). |
| **Portal-session in flight** | POST /portal-session in flight | Paddle button shows `Loader2` + "Opening portal…" |
| **Channel — WhatsApp unavailable** | user.whatsapp_bindings is empty | WhatsApp column overlay: "Link WhatsApp to enable →" |
| **Channel — Push unavailable** | user.push_tokens is empty | Push column overlay: "Enable push in your app to enable →" |
| **Toggle in flight** | PATCH in flight | Checkbox shows a subtle spinner overlay for < 200ms. |
| **Toggle error** | 4xx/5xx | Checkbox reverts to prior state + destructive toast. |
| **Reset-defaults in flight** | PUT in flight | Reset button spinner + matrix disabled. |
| **RTL** | Locale = ar | Whole pane mirrors; table columns mirror; numeric cells stay LTR; channel marks keep canonical orientation. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap. Table header contrast maintained. |
| **Offline** | Network unreachable | Toggles disabled; banner at top "You're offline — settings won't save." Paddle portal button disabled. |

---

## Accessibility

- Every checkbox has a `<label>` composed as "{event} — {channel}" for screen-reader clarity.
- Table cells use `<th scope="col">` for channel columns and `<th scope="row">` for event rows.
- Test-send button announced as "Test send — {channel}".
- Autosave pill announced via `aria-live="polite"` ("Preferences saved").
- Paddle portal button announced as "Manage in Paddle portal, opens in new tab".
- Channel-unavailable overlay announced as button/link with clear destination ("Link WhatsApp — opens WhatsApp linking flow").
- Pagination announces "Page {n} of {m}".
- Focus visible everywhere (two-tone Broadcast focus ring).
- Reset-defaults dialog traps focus, Escape closes, close-on-outside-click.
- Colour-only status differentiation avoided — status column always tint + glyph + label.
- Tap targets ≥ 44×44 CSS px on mobile — checkbox rows are padded to reach that.

---

## Anti-patterns (do not do these)

- ❌ Do not build a plan-picker / plan-comparison table on this screen. Plan changes are Paddle's job — deep-link out.
- ❌ Do not fabricate an "estimated next invoice" calculation. If Paddle doesn't return it, don't display it.
- ❌ Do not autosave the Reset-to-defaults button click. It requires an explicit confirm dialog.
- ❌ Do not silently-disable an unavailable channel column. Show the linking deep-link so the user knows how to fix it.
- ❌ Do not put a "Cancel subscription" button on this screen. Cancellation lives in the Paddle portal.
- ❌ Do not render invoice amounts in the UI font. Every numeric → `<Numeric>` with mono + tabular.
- ❌ Do not color status only by badge tint — always glyph + label.
- ❌ Do not surface the raw Paddle customer_id / subscription_id in the UI. They're implementation details.

---

## Backend contract

**Existing endpoints (reuse):**

- `GET /api/tenant/subscription` — returns:
  ```json
  {
    "tenant_id": "...",
    "plan": { "id": "semsar", "name": "Wingcaster Semsar", "tier": "paid|trial|free" },
    "billing_cycle": "monthly",
    "price": { "amount_minor": 4900, "currency": "USD" },
    "state": "active|trialing|canceled|past_due",
    "renews_at": "2026-10-15T...",
    "cancels_at": null,
    "trial_ends_at": null,
    "payment_method": { "brand": "visa", "last4": "4242" },
    "tax_region": "AE"
  }
  ```
- `GET /api/tenant/invoices?status=&page=&limit=` — returns paged list:
  ```json
  {
    "invoices": [
      {
        "id": "...",
        "invoice_number": "INV-2026-1042",
        "issued_at": "...",
        "amount_minor": 4900,
        "currency": "USD",
        "status": "paid|failed|pending|refunded",
        "download_url_hint": null
      }
    ],
    "page": 1,
    "total_pages": 3,
    "total": 27
  }
  ```
- `GET /api/tenant/invoices/:id/download` — returns signed URL `{ url: "https://..." }`.
- `GET /api/billing/notifications/preferences` — currently returns per-tenant preferences. **Shape extension required** to be a matrix:
  ```json
  {
    "preferences": {
      "invoice_sent":       { "whatsapp": false, "email": true,  "sms": false, "push": false },
      "payment_failed":     { "whatsapp": true,  "email": true,  "sms": false, "push": true },
      "renewal_approaching":{ "whatsapp": false, "email": true,  "sms": false, "push": false },
      "credit_low":         { "whatsapp": false, "email": false, "sms": false, "push": true },
      "credit_exhausted":   { "whatsapp": true,  "email": true,  "sms": true,  "push": true }
    },
    "channel_availability": {
      "whatsapp": true,
      "email":    true,
      "sms":      true,
      "push":     false
    }
  }
  ```
- `PATCH /api/billing/notifications/preferences` — accepts `{ event, channel, enabled }` triple; server merges.
- `PUT /api/billing/notifications/preferences` — full replace (used by Reset-to-defaults).

**New endpoints required (⏳):**

- `POST /api/billing/portal-session` — mints a Paddle customer-portal session URL for the current tenant. Body optional `{ section: "payment-methods" }`. Response `{ url: "https://customer-portal.paddle.com/..." }`. Ownership check: current user must have `role in ('owner','billing_admin')` for the tenant. File as `[BE-BLOCKER-07]` in kickoff §5a.
- `POST /api/billing/notifications/test?channel=<c>` — sends a test notification to the current user's linked address for the given channel. Returns 202. File as `[BE-BLOCKER-08]` if not present.

**Errors surfaced:**
- `403 FORBIDDEN` on portal-session if user lacks billing role — inline banner "Ask your tenant owner to manage billing."
- `409 CHANNEL_UNAVAILABLE` on test-send if user has no linked address — should not be reachable via UI (button hidden); log + toast.
- `429 RATE_LIMITED` on test-send if hammered — toast "Wait a moment before sending another test."

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/settings/BillingPage.tsx`. Rendered inside `<SettingsShell>`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/settings/billing" element={<SettingsShell><BillingPage /></SettingsShell>} />`.
- **Component decomposition:**
  - `SubscriptionCard` — plan name + price + renewal + Paddle button.
  - `PaymentMethodMeta` — masked card + tax region + currency + update link.
  - `InvoiceTable` — filter + table + pagination + download-per-row.
  - `NotificationChannelMatrix` — the cross-tab checkbox grid.
  - `ChannelColumnHeader` — the ChannelMark + label + test-send button.
  - `usePortalSession()` hook — POST + open new tab.
  - `useInvoices()` hook — GET with filter + pagination.
  - `useNotificationPrefs()` hook — GET + optimistic PATCH.
- **New backend surface required:** portal-session mint + test-send route. File as `[BE-BLOCKER-07]` and `[BE-BLOCKER-08]`.
- **Preference-matrix shape extension:** `GET /api/billing/notifications/preferences` today returns a flat structure — needs the event × channel matrix shape above. Coordinate with backend before implementing this UI.
- **Test discipline:**
  - Unit: each component renders + interactive behavior.
  - Integration: subscription → portal-session mock → new-tab open.
  - Real-Postgres: invoice pagination round-trip.
  - Contract: notification-prefs matrix PATCH → GET reflects the toggle.
  - RTL: `screens.rtl.test.tsx` extension.
  - Broadcast: `no-raw-hex.test.ts` stays green.

---

## Broadcast alignment callouts

Delta from anchor — see SHR-SET-001 for shell chrome tokens.

- Pane title `var(--lc-type-heading-1)`; sub `var(--lc-type-body-lg)` `--lc-text-muted`.
- Subscription card raised (`--lc-elevation-sm`), `--lc-radius-lg`, `--lc-surface-raised`.
- Price render — `<Numeric>` `var(--lc-type-display)` mono; currency label `var(--lc-type-body)` `--lc-text-muted`.
- Paddle button `<Button variant="default">` — primary orange fill + external icon; hover darkens.
- Meta card sunken `--lc-surface-sunken`, `--lc-radius-md`, no elevation.
- Invoice table header `--lc-surface-sunken` + `var(--lc-type-overline)` labels; rows separated by `1px --lc-border`.
- Amount + date columns `<Numeric>` mono. Status `<Badge>` per token map (paid/failed/pending/refunded).
- Download button `<Button variant="ghost" size="icon">`, 44×44 tap target.
- Channel matrix header row `--lc-surface-sunken`. ChannelMark 20px + label + Test-send ghost button.
- Checkbox cells centered in cells, 44×44 tap target padding.
- Autosave pill `--lc-status-published-*`, `--lc-radius-pill`, mono? — no, UI font is fine here.
- Reset-defaults confirm dialog `--lc-elevation-lg`.
- Focus rings two-tone via base CSS.
- Motion: portal-session button spinner 120ms fade-in; pill fade 240ms.
- Radii: cards `--lc-radius-lg`; table rounded outside `--lc-radius-md`; buttons `--lc-radius-md`.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before the brief):

```
I'm designing the WingCaster Billing & notifications settings pane (SHR-SET-003) — MENA real-estate B2B SaaS. This is a sub-page INSIDE an already-designed settings shell (SHR-SET-001) — do not re-render the shell, only the right pane content. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind + Broadcast design tokens (semantic --lc-* variables only, no raw hex).

First pass: render the desktop 1440px pane at loaded/active state. Sample data: tenant "Elite Real Estate", plan "Wingcaster Semsar" USD 49/month renewing Oct 15 2026, Visa ending 4242, tax region UAE. Invoice table: 3 rows (Sep/Aug/Jul 2026 all Paid except Jul which is Refunded). Notification matrix: invoice-sent → email only; payment-failed → email+whatsapp+push; credit-exhausted → all four. Push channel column disabled with "Enable push in your app to enable →" overlay.

LTR English only for this pass — I'll ask for RTL Arabic, mobile 375px, trial state, past-due state, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Do not fabricate testimonials or plan-comparison content.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now mobile 375px viewport — sections as Tabs, invoice list as cards, channel matrix as accordion.`
2. `Now the trial state — trial banner above subscription card, tier badge shows Trial.`
3. `Now the past-due state — amber banner above subscription, top invoice row is failed.`
4. `Now the invoice empty state — filter set to Refunded returning zero rows.`
5. `Now the RTL Arabic layout at desktop 1440px. Mirror layout; keep numeric columns LTR; keep channel marks canonical.`
6. `Now dark mode versions of desktop LTR + mobile LTR.`
7. `Now the test-send toast state — user clicked "Test send" on the WhatsApp column and the toast is visible.`

Save each output's JSX to `web/src/components/settings/BillingPage/` and screenshots to `docs/design/mockups/SHR-SET-003-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 7 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/SHR-SET-003/`.
- [ ] Cursor Wave-1 dispatch prompt references this brief + mockup paths.
- [ ] `[BE-BLOCKER-07]` filed — Paddle portal-session mint endpoint.
- [ ] `[BE-BLOCKER-08]` filed — notification test-send endpoint.
- [ ] Notification-prefs matrix shape extension confirmed with backend owner.
- [ ] `no-raw-hex.test.ts` stays green after implementation.
- [ ] RTL screenshot test extended with `SHR-SET-003` scenario.
