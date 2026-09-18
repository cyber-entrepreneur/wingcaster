# Screen Brief — AGT-LST-015 · Seller performance report (vendor report)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

New screen, added 2026-09-17, expanded 2026-09-18 with the full 5-page structure. Companion to the `SCREEN_MATRIX_AGENT.md` entry `AGT-LST-015`. This is the **client-facing performance report an agent shares with the property owner (seller/landlord)** — a multi-page "report card" that makes the agent's work visible and justifies their mandate. Distinct surface from AGT-LST-006 (the agent's *private* analytics tab): same underlying metrics, but packaged, client-safe, shareable, and narrative.

Sibling to `AGT-LST-003` (agent listing detail — where "Share performance report" lives), `AGT-LST-006` (private analytics — the internal twin), `AGT-LST-010` (offers — feeds the offers section), and `SHR-PUB-001` (public buyer-facing listing view — a different audience). Reuses the Broadcast KPI-strip, funnel, channel-mark, and TrendMiniChart primitives.

**Design principle (load-bearing): honest by design.** When a listing underperforms, the report says so and explains *why* — because that diagnosis is what earns the price-reduction conversation and the seller's trust. No vanity-only dashboards that always look green.

---

## 🎨 Broadcast alignment

**Inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** No new tokens. No raw hex. Aliased palettes only. Every numeric value wraps in `<Numeric>` (IBM Plex Mono + `tabular-nums`). The shared/public render must pass the same `no-raw-hex` + aliased-palette token-hygiene gate as the app, and a `print.css` path forces light theme + A4 for the printable version.

- Page header band ("letterhead"): `--lc-surface-inverse`, agent identity + property hero.
- KPI tiles: `--lc-surface-raised` + `--lc-elevation-sm`, `var(--lc-radius-lg)`; big number `var(--lc-type-display)`, label `var(--lc-type-overline)` + `--lc-text-muted`.
- Deltas: `--lc-status-published-fg` (up) / `--lc-status-unpublished-fg` (down), never raw green/red.
- Score rail, funnel, posting-log table, benchmark bar reuse existing `PAQueueTable`-family / `TrendMiniChart` / funnel primitives.
- Page navigation: a segmented control or paginated tabs (Overview · Listing Insights · Performance · Market · Plan). On the client render these become swipeable sections (mobile) / anchored scroll (desktop / print expands all).

---

## Meta

**Purpose:** Give the seller a live, trustworthy, multi-page view of how their listing is performing, how hard the agent is working, how it's priced against the market, and what happens next.

**Route (agent-side):** `/listings/:id/report` (owner or agency roles) — the agent configures, writes commentary, sets visibility, shares. Entry from an AGT-LST-003 "Share performance report" action.

**Route (client-side / shared):** `/r/:shareToken` — unauthenticated, tokenized, **restricted** render (confidential fields stripped). Also reachable by QR.

**Persona:** Agent (author/owner or agency admin) configures + shares. Seller/owner (unauthenticated, via link/QR/email) consumes.

**Device:** Mobile + desktop + print. Client render is mobile-first (sellers open on a phone).

**Mode:** both. Guided → one-tap "Share report" with defaults. Pro → section/visibility toggles, ad-strategy toggles, commentary override.

**Current state:** MISSING — net-new. Underlying data mostly exists (see feasibility tags per element); no report packaging, share layer, or client-safe render.

**Feasibility legend:** `[have]` data exists today · `[derive]` computable from existing data · `[source]` needs a new data source/query · `[new]` new instrumentation/field.

---

## PAGE 1 — Seller Overview

Opens with a **one-line "state of play"** (AI-written, agent-editable): *"Strong early interest, priced at market — 2 offers under review."* `[derive]`

- **Row 1 — Property details container** (full width): reference number, name/title, date started (campaign start), listing type, status. `[have]`
- **Row 2 — three columns** (left + right equal, center narrow):
  - **Left — property summary:** list price · aging (days on market / days with agency / days since promotion start) · number of posts across all channels · number of inquiries received. `[have]`
  - **Center (narrow) — property-score rail** (vertical mini-infographic): Quality · Cleanliness · Location Score · **Property Score** (internal evaluator composite). Each a small radial/bar with score + one-word read. `[have: scoring]`
  - **Right — property profile picture** + spec icons beneath (beds, baths, area, parking, etc.). `[have]`
- **Row 3 — three equal columns:**
  - **Left — agent's summary report:** AI proposes a draft; agent can accept, edit, or opt out and write their own. This is the §6 "agent's brief" from the original spec, now page-1 hero placement. `[derive + new field]`
  - **Center — top qualitative feedback:** up to **6 double-line comments** ("what people said" from viewing feedback / inquiry notes). Positive-to-negative mix is the agent's editorial call. `[have: viewing feedback]`
  - **Right — market activity & performance overview:** a compact snapshot linking forward to Page 4. `[derive]`
- **Additions (proposed):**
  - **Momentum arrow** — interest accelerating/cooling (views this week vs last). `[have]`
  - **"Listings like yours" pace context** — *"homes like yours here take ~45 days; you're on day 12."* `[source: area DOM benchmark]`
  - **Campaign health score** — single composite 0–100 headline (reach × engagement × conversion vs peers). `[derive]`

---

## PAGE 2 — Listing Insights

**Two columns.**

**Left column:**
- **Row 1 — Marketing approach** (each a checklist with a check per item actually done):
  - Listing on websites — public boards + own agency board (sub-list per site, checkbox each). `[have: distribution_attempts]`
  - Social media posts — sub-list of every channel, checkbox each. `[have]`
  - Network · Email marketing · Direct messaging (WhatsApp / Telegram / Signal) — checklist. `[have partial: WhatsApp; Telegram/Signal need channel tracking]`
- **Row 2 — Ads (optional, only if agent flags ad strategy is on):** the seller sees value-for-money — where ads ran + spend + what it bought (cost per 1,000 impressions, cost per qualified lead). `[have if ad spend tracked]`
- **Row 3 — Targeting:** geographies + audience being targeted. `[have if campaign targeting stored]`

**Right column:**
- **Ad creative thumbnails** — showcase of the designs made for the property. `[source: creative assets]`
- **Links to live posts** — one link per platform where it was posted, as many as possible, so the seller can click through and *see* their property advertised. `[have: distribution_attempts URLs]`

- **Additions (proposed):**
  - **Effort log / activity timeline** — every dated agent action (posted, refreshed, boosted, returned 12 buyer calls, hosted a viewing). *Highest commission-justifying element in the report.* `[have: distribution_attempts + viewings + lead activity]`
  - **Media quality checklist** — photos ✓(14) · video ✓ · floor plan ✗ · virtual tour ✗, with "adding a floor plan lifts inquiries ~X%." `[have + derive]`

---

## PAGE 3 — Performance Infographics dashboard

- **Row 1 — Traffic overview:** total impressions · total views · **new views since last report** · traffic-source pie (with "new this week" indication) · engagement overview by channel and by type. `[have]`
- **Row 2 — Ad performance** (only if ads active): engagement + leads attributable to paid. `[have if ad metrics tracked]`
- **Row 3 — Inquiry analysis:** showings, feedback summary, inquiry→viewing→offer breakdown. Plus the **offers-vs-benchmark-vs-asking** graph (asking line, similar-sold benchmark band, each live offer as a marker). `[have + derive]`

- **Additional dashboards (proposed, ranked by seller value):**
  1. **Views-over-time trend line** with re-boost markers overlaid — shows the natural listing-decay curve and proves the agent fights it. `[have]`
  2. **Funnel vs peer-benchmark overlay** — your impressions→views→saves→inquiries→viewings→offers next to a "typical listing like yours," exposing exactly where it leaks. `[have + source: peer benchmark]`
  3. **Saves-to-views ratio** (interest *quality*) vs benchmark. `[have]`
  4. **Repeat-viewer count** — people who came back 2+ times (predicts offers). `[derive]`
  5. **When-people-look heatmap** (day-of-week × time-of-day). `[derive]`
  6. **Interest geography** — local / other-city / expat / overseas. `[source: viewer geo]`
  7. **Channel quality-vs-volume quadrant** — which channel drives *qualified* leads vs noise (also substantiates the "shielded" number). `[have]`
  8. **"Shielded" visual** — N inquiries received, Q qualified, N−Q absorbed by the agent, framed as buyer-noise the seller never had to touch. `[derive — depends on agent maintaining lead status]`

---

## PAGE 4 — Market activity (area context)

- Number of inquiries in the area · number of properties sold · **average price per sqm** (only when genuinely comparable — if no like-for-like, omit the average rather than mislead). `[source: area market data]`
- **Additions (proposed):**
  - **Active competition set** — the other homes a buyer is comparing this against right now (count, price band, key specs). `[source: competitive query]`
  - **Recently *sold* comparables** — what actually transacted and at what final price (ends "my price is fine" standoffs). `[have: valuation comparables]`
  - **Absorption rate + supply/demand tilt** — buyer's / balanced / seller's market, with the number behind it. `[derive from area data]`
  - **New competing listings since last report** — explains an area-wide slowdown that isn't the agent's fault. `[source]`

---

## PAGE 5 — Next Week Plan

- **Recommendation** — data-tied, not generic: *"saves high, inquiries low → photos attract but price/headline deters; recommend a price review or new hero image."* `[derive]`
- **Scheduled activities (upcoming week):** marketing · buyer follow-ups · showcasings · refresh posts and listings. `[new: agent task input]`
- **Additions (proposed):**
  - **Seller decision buttons** — approve a price adjustment / approve an ad budget / approve an open house, right from the report (turns a passive PDF into a two-way workflow). `[new]`
  - **Agent commitments with dates** — "promised → delivered" carried into the next report for accountability. `[new]`

---

## Share model (confirmed)

One revocable share token per listing-report, four delivery paths:
1. **Anyone with the link** — unguessable `wc_rpt_<random>`, route `/r/:shareToken`, copy-link. **Restricted view** (confidential fields stripped).
2. **Specific emails** — per-recipient tokens (revocable + attributable), delivered via Microsoft Graph transport ([[project_otp_transport]]).
3. **Print / PDF** — print.css render + server PDF (reuses AGT-LST-006 "Export PDF (Pro)").
4. **QR code** — encodes the share URL, for flyers / window cards / in-person; native share on the Capacitor app.

**Liveness:** live for as long as the property is listed (seller re-opens the same link, sees current numbers). On sold/archived/delisted → frozen final snapshot with a "Campaign ended" banner (never a 404). Revocable any time; Pro section-level visibility toggles.

**Client-safe invariants (confirmed):**
- **Address:** area-only by default (e.g., "Achrafieh, Beirut"); agent opt-in for full address. Confidential fields never on the shared render.
- **Offer amounts:** hidden by default; shown only if the agent flips a per-report toggle (otherwise offers show as "1 offer, ~3% below ask" without the raw figure).
- No buyer/inquirer PII anywhere — everything people-level is aggregated to counts. Never a name, phone, or message.
- Internal-only fields (private notes, lead scores, contact records, offer identities) never exposed; only the agent's chosen commentary + aggregate numbers show.
- Tokenized routes unauthenticated by design but rate-limited, non-enumerable, no write surface, no session.

---

## Data sources (confirmed present unless tagged `[source]`/`[new]`)

| Report element | Source |
|---|---|
| Impressions / views / clicks / likes / saves / comments | analytics engagement feed (same as AGT-LST-006 `PerformanceTab`) |
| Posting log + live post links (channel + date) | `distribution_attempts.published_at` + URLs (+ campaign runs) |
| Property score / quality / cleanliness / location | property scoring (`property_scores_fresh`) |
| Benchmarked price + sold comparables | valuation benchmark service + comparables |
| Declared interests / leads / qualified leads / shielded | inquiries + `viewings.outcome` + lead-status maintenance (agent-dependent) |
| Viewings + feedback comments | `viewings` table + outcomes/notes |
| Offers (opt-in section) | `property_offers` (AGT-LST-010) |
| Agent's brief / tasks / commitments | new report record fields |
| Area market data / competition / absorption | `[source]` — area market query, may need a new aggregation |
| Ad spend / creatives / targeting | `[source]` — depends on ad-campaign tracking depth |

---

## "Calls shielded" — definition (confirmed)

A **deduced noise-absorption number**: of the N inquiries the platform routed to the agent, only Q were qualified; **shielded = N − Q**. Narrative: *"You received N inquiries; I qualified them so you didn't have to — (N−Q) were noise, Q were real."* **Dependency:** accuracy requires the agent to maintain each lead's status. The report (agent-side) must nudge when leads are untriaged: *"6 leads still unqualified — triage them to keep your seller report accurate."* If reliable call-tracking exists later, extend to include intercepted calls; until then scope to inquiries and label honestly.

---

## State variants
loading · empty (campaign just started — encouraging "your campaign just started" state, not blank) · error · shared-live · shared-frozen (campaign ended) · revoked (polite "no longer shared" page, never a raw 404).

---

## v2 / stretch (flagged, not v1)
- **Predictive close estimate** — "at current pace, expected offer in ~3–5 weeks; expected sale range $X–$Y." Only once data supports an honest, caveated number.
- Telegram/Signal direct-messaging tracking, viewer-geography, and area competition/absorption may each need a data source stood up first — sequence per the `[source]` tags.

---

## Core architecture — standard form, template-driven render (confirmed 2026-09-18)

**The data-entry form is standard regardless of which template/layout the agent uses.** The agent enters the platform property **reference number**; the report engine pulls every field (metrics, posting log, score, benchmark, photos, agent brief) into whatever slots the chosen template — a built-in one, the agent's saved custom layout, or a tier-2 designed layout — exposes. Template = presentation; data pull = fixed pipeline keyed off the reference number. This separation is load-bearing: it lets branding and custom layouts vary freely without ever forking the data contract.

---

## Enhancement tier 1 — Agent branding (all paid tiers)

Applies the agent/agency identity to the **standard** report template (no layout design needed):
- **Colors:** primary, secondary, highlight/accent (mapped onto the report's `--lc-*` slots at render — a scoped theme override, still passing token-hygiene since values come from a validated brand palette, not raw hex sprinkled in components). Also: text-on-brand contrast auto-checked (WCAG AA) so a bad brand color can't make the report unreadable.
- **Logo:** agent/agency logo in the letterhead (+ optional watermark on the client render).
- **Font:** a font choice from an allowlisted, license-cleared set (self-hosted or Google Fonts per the artifact font rules); never arbitrary uploads in v1 (licensing + rendering risk).
- Branding is saved on the agent/agency profile and reused across every report. `[new: branding profile fields + scoped theme]`

## Enhancement tier 2 — Custom report builder (higher tier only)

A WYSIWYG page designer that lets higher-tier agents design their own report layout, which the standard data pull then fills. Capabilities requested:
- **Page-layout picker** — ≥15 preset layouts (3-row, halves, four-quadrant, header+2col, sidebar, hero+grid, etc.); pick one per page as a starting grid.
- **Data field catalog** — a list of every available field/metric/section to drop in.
- **Drag-and-drop** placement onto the page grid; **resize** by dragging edges; **snapping** to neighbors/grid; **multi-page** (add as many pages as wanted); reorder.
- **Per-field title** — a label the agent sets for each dropped field.
- **Rich text control** — font family / size / style (bold, italic, both) / color / effects (underline, double-underline) / alignment (left, center, right) / justification / line-spacing; text direction/orientation (critical for Arabic RTL).
- **Bullets** — add/remove/manage bulleted lists.
- **Images** — fixed (standard branding asset) or property-specific (pulled by reference number).
- Save as a **reusable template** the agent applies to future reports.

**Product read (honest):** this is not a screen — it is a mini page-design product (a Canva/Google-Docs-layout-editor for reports). It is a multi-month, multi-PR workstream in its own right: a serializable layout schema, a canvas engine (drag/resize/snap), a rich-text model, an image-asset pipeline, a render-from-schema engine that must produce identical output on screen **and** in the PDF/print path, and RTL correctness throughout. It should be **gated to a higher subscription tier**, **phased after** tier-1 branding + the standard templated report ship and prove valuable, and **spec'd on its own** before any code. Recommend: v1 = standard report + tier-1 branding + a handful (3–5) of built-in fixed layouts the agent selects (no free-form design); the full builder = a separate initiative (call it AGT-LST-015b) scoped later. Building the free-form designer up front would dwarf the rest of Wave 1 and delay the seller-report value that tier-1 already delivers.

---

## Wave slotting
Wave 1 (Agent gap-closure), **Listings+Publishing slice**, sequenced **after** AGT-LST-006 (private analytics) — the report reads the same metric feed, so finishing -006 first de-risks -015. Ships as its own full-stack PR(s):
1. Report data model + reference-number data pull + agent-side report + agent brief/commentary.
2. Share-token model + client route + share sheet + print/QR.
3. **Tier-1 branding** (colors/logo/font as a scoped theme on the standard template) + 3–5 built-in fixed layouts.
Depends on AGT-LST-010 (offers) for the optional offers section. `[source]`/`[new]`-tagged elements (ads, area market, geography, predictive) land as follow-ups so v1 ships on data we already have.
**Tier-2 custom report builder → separate initiative AGT-LST-015b, higher tier, spec'd + scoped on its own after v1 ships.**
