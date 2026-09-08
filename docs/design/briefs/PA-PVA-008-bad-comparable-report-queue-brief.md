# Screen Brief — PA-PVA-008 · Bad-comparable-report queue (WF-05 approver-side)

**Layer-2 Delta Brief. INHERITS the PA approval-queue family pattern from `PA-MOD-001-portal-moderation-queue-brief.md`.**

**This brief is a delta.** It only enumerates what differs from PA-MOD-001. Everything not called out here — Broadcast alignment, shell layout, filter-strip anatomy, bulk-action-bar mechanics, table primitives, keyboard shortcuts, empty-state grammar, error handling, RTL rules, dark-mode rules, focus-ring rules, accessibility scaffolding, undo-grace pattern, step-up integration, env-badge behavior, immutable-audit write, session-expiry handling — is inherited unchanged from PA-MOD-001 and its `§Broadcast alignment` callout block.

Companion to `SCREEN_MATRIX_PA.md` §23 entry `PA-PVA-008`. Detail delta is `PA-PVA-008b-bad-comparable-report-detail-brief.md`.

Wave 2 (Week 5 — WF-05 cluster) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 rows 43-44 + §6 Week 5. Pairs with `AGT-APR-003` (comparable detail) + `AGT-APR-004` (report a bad comparable) + `AGT-REC-002` (outcome) + `PA-PVA-008b` (detail).

---

## Broadcast alignment

**Inherits the full `§Broadcast alignment` callout block from `PA-MOD-001-portal-moderation-queue-brief.md`.** No overrides. The PA queue-family invariants (env badge, two-person rule for high-market-impact confirmed removals, bulk-reason discipline, step-up on high-severity, immutable audit, single-row undo grace, keyboard-first) apply verbatim. Every color / font / spacing / motion / radii reference resolves through `BROADCAST_ALIGNMENT_REFERENCE.md`.

Screen-specific Broadcast delta callouts (additive only):

- **Column-set differs from PA-MOD-001.** The portal-chip / validator-lint / tenure-risk / SLA-per-portal cells are replaced with dispute-oriented cells (reason category · comparable snapshot · severity · market-impact · evidence-count). All swapped-in cells still obey tint-plus-glyph-plus-label and `<Numeric>` numeric-render rules.
- **SLA is a single value.** WF-05 has ONE review SLA (48h from submission by default; configurable via `pricing_review_config.sla_hours` per market — Dubai/Abu Dhabi tighter at 24h during high-turnover windows). SLA chip inherits the tri-color pattern (green >24h remaining, amber 6-24h, danger <6h or breached) but sources hours from the pricing-review setting.
- **Filter strip differs** — Portal + Country filters (PA-MOD-001) are replaced by `Reason category` (Any · Wrong price · Wrong area · Already sold · Duplicate · Spam · Other) + `Severity` (Any · Low · Medium · High · Critical) + `Market impact` (Any · None · Low · Medium · High) + `Submitted within`. Search spans reporting agent, reporting agency, comparable property title, comparable address, listing_id last-4, and case ID.
- **Bulk-action bar is PRESENT (per PA-MOD-001 pattern) but scoped to invalidation only.** Primary bulk actions are `Reject as invalid N` (shared reason vocab + notes, required) and `Request more info N` (shared reason vocab + notes, required). Bulk `Confirm and remove` is DELIBERATELY OMITTED — removal is a high-consequence action (re-runs affected valuations, propagates through market pricing pipeline) and must be single-row on PA-PVA-008b. See §Design goals deviation #1.
- **New "Reason category" pill** replaces PA-MOD-001's `Validator lint` cell. `<Badge>` variants: `wrong_price` `--lc-status-warning-{bg,fg,dot}` + ▲ + label "Wrong price"; `wrong_area` `--lc-status-warning-{bg,fg,dot}` + ▲ + "Wrong area"; `already_sold` `--lc-status-closed-{bg,fg,dot}` + ◆ + "Already sold"; `duplicate` `--lc-status-archived-{bg,fg,dot}` + ▢ + "Duplicate"; `spam` `--lc-status-danger-{bg,fg,dot}` + ✕ + "Spam"; `other` `--lc-status-draft-{bg,fg,dot}` + ○ + "Other".
- **New "Severity" pill** replaces PA-MOD-001's `Tenure risk` cell. Derived server-side from the delta magnitude (e.g. reported-price is 40%+ off the agent-submitted price → High; 10-40% off → Medium; <10% → Low) OR from spam/fraud flags (Critical). `<Badge>` variants: Low `--lc-status-published-{bg,fg,dot}` + ● + "Low"; Medium `--lc-status-warning-{bg,fg,dot}` + ▲ + "Medium"; High `--lc-status-danger-{bg,fg,dot}` + ◆ + "High"; Critical `--lc-status-danger-{bg,fg,dot}` + ✕ + "Critical".
- **New "Market-impact" indicator** — small inline chip next to severity, showing how many active valuations reference this comparable and the aggregate magnitude of impact if it were removed. Rendered as `<Numeric>{N}</Numeric> valuations · ±{P}%` in `var(--lc-type-caption)`, with the container tinted per bucket: None `--lc-surface-sunken`; Low `--lc-status-draft-bg`; Medium `--lc-status-warning-bg`; High `--lc-status-danger-bg`. Tooltip on hover: "Removing this comparable will re-run {N} valuations · median move {P}% · max move {Q}%." **This chip is the two-person-rule trigger** — any `market_impact.tier=high` row's confirmed-remove decision on PA-PVA-008b requires PA-APR-003 second approval per D9 governance.
- **New "Comparable snapshot" cell** replaces PA-MOD-001's `Listing thumbnail + title`. Renders the COMPARABLE being reported (not the agent's own listing) — 40×40 thumb + comparable title + area/city secondary line + inline `Source` chip (`agency_owned` `--lc-accent-bold-{bg,fg,edge}` OR `external_scrape` `--lc-surface-sunken` + monogram of source, e.g. "PF" "BAY" "OLX"). If the comparable is an external-scrape row, the thumb is a dashed placeholder + `Globe` lucide icon.
- **New "Reporter" cell** replaces PA-MOD-001's `Agent + agency` cell. 32px avatar + reporting agent name (`var(--lc-type-body)`) + reporting agency name secondary line (`var(--lc-type-caption)` `var(--lc-text-muted)`, links to `PA-TEN-001`). If the same reporter has filed ≥3 reports against the same comparable-owning agency in the last 30 days, a small `⚠` amber dot appears next to the reporter name with tooltip "Reporter has filed {N} reports against {agency} in {D} days · possible pattern." Editorial signal only; not a policy gate.
- **New "Evidence" cell** — `<Badge>` with `Paperclip` lucide icon + `<Numeric>N</Numeric> files`. Zero-evidence rows show amber `⚠` glyph. Tooltip lists filenames + upload timestamps. Kinds accepted per `AGT-APR-004`: screenshot of the correct listing (portal), sale record (DLD/REGA screenshot), photo evidence, portal URL.

---

## Meta

| | |
|---|---|
| Screen ID | PA-PVA-008 |
| Screen name | Bad-comparable-report queue |
| Persona | PA (Platform Admin — comparable-review capable; the two-person rule blocks confirmed-removes on high-market-impact rows AND blocks any decision on reports where the PA is the reporting agent OR is an agent at the comparable-owning agency; server-enforced) |
| Device targets | Desktop 1440px ONLY — inherits PA console desktop-first rule |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/admin/valuation/comparable-reports` (query params: `?status=pending\|confirmed_removed\|confirmed_quarantined\|rejected\|awaiting_info\|expired`, `?category=wrong_price\|wrong_area\|already_sold\|duplicate\|spam\|other`, `?severity=low\|medium\|high\|critical`, `?impact=none\|low\|medium\|high`, `?within=24h\|7d\|30d\|all`, `?q=<reporter-or-agency-or-comparable-title-or-caseid>`, `?page=<n>`) |
| Current state | MISSING (UI). Backend `GET /api/admin/pricing/reports` VERIFIED EXISTS at `backend/src/modules/property-valuation/interface/admin-routes.js:379`. Existing single-review endpoint `POST /api/admin/pricing/reports/:id/review` at line 386 accepts only `{status: reviewed\|dismissed\|actioned, notes}` — a generic tri-state that does NOT map to the WF-05 decision vocabulary (confirm-remove / confirm-quarantine / reject / request-info). Response shape needs extension; new decision endpoints required. See §Backend contract. |
| Workflow role | WF-05 role = Approval queue (bad-comparable-report review) |
| Backend prerequisites | ✅ `GET /api/admin/pricing/reports` (list — needs extension per `[BE-CMR-01]`) · ✅ `POST /:id/review` (exists — DEPRECATE; replaced by four decision endpoints per `[BE-CMR-02]`) · ⏳ `[BE-CMR-02]` decision endpoints (`/confirm-remove`, `/confirm-quarantine`, `/reject-as-invalid`, `/request-info`) · ⏳ `[BE-CMR-03]` bulk endpoints (`/bulk-reject-as-invalid`, `/bulk-request-info`) · ⏳ `[BE-CMR-04]` market-impact scoring service (which active valuations reference this comparable + magnitude) · ⏳ `[BE-CMR-05]` two-person-rule integration with `PA-APR-003` (high-market-impact confirmed removals recorded as `REMOVE_PROPOSED` → PA-APR-001) · ⏳ `[BE-CMR-06]` `is_own` detection (PA = reporter OR PA = agent at comparable-owning agency) · ⏳ `[BE-CMR-07]` env-scoping (`X-Wingcaster-Env` header on list + all POST decision endpoints) · ⏳ `[BE-CMR-08]` recalculation trigger (on confirmed-remove: enqueue `recalculationJobService` for affected valuations, reuses existing pipeline at line 292) · ⏳ `[BE-CMR-09]` undo-grace endpoint (`POST /:id/undo-decision` — refuses if recalculation job has committed) · ⏳ `[BE-CMR-10]` CSV export (`GET /api/admin/pricing/reports.csv?<same-query>`) · ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context · ✅ PA-AUD-001 audit writer |
| Cluster | Wave 2 (Week 5 — WF-05 cluster) alongside PA-PVA-008b (detail); pairs with AGT-APR-003 (comparable detail), AGT-APR-004 (report a bad comparable), AGT-REC-002 (outcome) |

---

## Purpose

Platform Admin reviews the queue of "bad comparable data" reports that agents have submitted via `AGT-APR-004` — a comparable listing that shows up in an agent's own market-pricing view but is factually wrong (price is stale, area is wrong, the listing is actually sold-and-not-updated, it's a duplicate of another comparable already in the pool, or it's outright spam).

The queue exists because WingCaster's market-pricing pipeline pulls comparables from a mix of agency-owned listings and external portal scrapes (`comparableService` + `scraperService`). Bad rows in that pool corrupt every valuation that references them — a wrong-price comparable pulled from OLX will drag the median psqm for a neighborhood off by percentage points, which pushes the agent's own listing's algorithmic pricing off, which loses the agent the deal. Agents flag these directly from `AGT-APR-003` (comparable detail). PA arbitrates.

Unlike WF-06 (agent price reports, editorial content moderation), WF-05 is **dispute arbitration** — the report is not thought-leadership; it's a claim by one agent that a comparable owned/scraped elsewhere is wrong. The decision has immediate market-pricing consequences: confirming the report REMOVES the comparable from the pool (or quarantines it pending correction), and every valuation that referenced it re-runs.

The queue serves three PA cadences:

1. **Continuous triage** — pending reports clear within the 48h SLA (24h in high-turnover markets). Aging chips make SLA-at-risk rows scannable.
2. **Weekly hygiene** — confirmed / rejected / awaiting-info views for pattern-spotting (a spike in `already_sold` reports for one portal source means the scraper's sold-detection is stale; a spike in `spam` reports from one reporter against one agency means either a real fraud pattern OR a possibly-vexatious reporter — Reporter-pattern amber dot flags the latter for PA judgment).
3. **Bulk cleanup during launch waves** — during a market launch or after a scraper glitch produces a wave of already-sold rows, PA batch-rejects the reports that duplicate an existing decision OR batch-requests-more-info from a cohort of reporters whose evidence was thin.

Success outcome: PA moves a report from `pending` to `confirmed_removed` (comparable removed from pool → `recalculationJobService` enqueues affected valuations → reporter sees success on AGT-REC-002 with a "X valuations refreshed" nudge → comparable-owning agent sees a courteous notice with appeal path), `confirmed_quarantined` (comparable held out of pool pending correction — used when the row is fixable but shouldn't influence pricing during the fix window), `rejected` with reason (reporter sees rejection with actionable message on AGT-REC-002), or `awaiting_info` (reporter can attach more evidence via `AGT-APR-004` and case re-enters queue). Zero pending past SLA. High-market-impact confirmed removals always double-signed via PA-APR-003.

---

## Design goals (deltas vs PA-MOD-001)

Inherits PA-MOD-001's eight design goals verbatim. Deltas / additions:

1. **Bulk confirm-remove is DELIBERATELY OMITTED.** Removal re-runs valuations across the market. A single wrong bulk-confirm during a launch wave could invalidate thousands of valuations. Bulk is scoped to `Reject as invalid` and `Request more info` only. Confirmed removals live on PA-PVA-008b, one at a time, with the two-person rule for high-market-impact rows.
2. **Market-impact visibility is the pre-flight signal.** The market-impact chip in the queue tells PA "this decision compounds" before they even open the detail. High-impact rows sort upward by default (in addition to SLA-at-risk).
3. **Reporter-pattern amber dot surfaces coordinated reporting without punishing it.** If the same reporter has filed 3+ reports against the same agency in 30 days, PA sees a hint. It's a signal, not a verdict — legitimate market-quality reporters may cluster around a specific agency's stale-scrape source; genuine vexatious patterns look identical at the row level. PA reads context on PA-PVA-008b.
4. **Reporting agent vs comparable-owning agency both surfaced.** Every row shows who filed the report AND (in tooltip on the comparable snapshot cell) which agency owns the reported comparable, so PA can eyeball the arbitration frame before opening the detail. This is the arbitration-shape that separates WF-05 from every other PA queue.
5. **Removal is loud, quarantine is quiet, reject is neutral.** On PA-PVA-008b the Confirm-and-remove button is FILLED primary (matches PA-PVA-009's Publish); Confirm-and-quarantine is OUTLINE warning; Reject-as-invalid and Request-more-info are OUTLINE neutral. In this queue, row actions are LIMITED to `Open` (opens PA-PVA-008b) — the four decision affordances live on the detail so PA can read the evidence first.

---

## Layout (deltas vs PA-MOD-001)

Header, filter strip, bulk-action bar shell, table skeleton, pagination, empty state, sub-1024px fallback — all inherited from PA-MOD-001 unchanged in structure. Deltas:

**Header subtitle template:**
"{N} pending · {K} at-risk (breach in {T}) · {H} high-impact awaiting 2-person · {M} confirmed this week · {J} rejected this week"

**Filter strip Row 2 — inline selects (changed):**
- `Reason category` (Select — Any · Wrong price · Wrong area · Already sold · Duplicate · Spam · Other)
- `Severity` (Select — Any · Low · Medium · High · Critical)
- `Market impact` (Select — Any · None · Low · Medium · High)
- `Submitted within` (Select — Last 24h · Last 7 days (default) · Last 30 days · All time)
- Search `<Input>` — placeholder "Search reporter, agency, comparable title, or case ID…"

**Bulk-action bar — right-side buttons (changed):**
- `Reject as invalid N` (outline — required shared reason vocab + notes ≥5 chars)
- `Request more info N` (outline — required shared reason vocab + notes)
- **NO `Confirm and remove N` button.** (Per design goal #1.)
- **NO `Confirm and quarantine N` button.** (Same rationale.)

**Table columns (desktop, LTR):**
1. Row-select checkbox (32px)
2. Submitted — relative time + review-SLA chip below (default sort: `[market_impact desc, sla_remaining asc, submitted_at asc]` — high-impact + at-risk float top)
3. Reporter — avatar + reporter name + reporter-pattern amber dot (if ≥3 reports against same agency in 30d) + reporting agency secondary line
4. Comparable snapshot — 40×40 thumb (or dashed placeholder for external-scrape) + comparable title + area/city secondary line + `Source` chip (agency_owned OR external portal monogram); tooltip on cell shows comparable-owning agency name + link to PA-TEN-001 in new tab
5. Reason category — `<Badge>` (Wrong price · Wrong area · Already sold · Duplicate · Spam · Other) with glyph + label
6. Severity — `<Badge>` (Low · Medium · High · Critical) with glyph + label
7. Market impact — chip with `<Numeric>{N}</Numeric> valuations · ±{P}%` + tier tint; tooltip breaks down median + max move
8. Evidence — `<Numeric>N</Numeric> files` chip; zero shows ⚠ amber; tooltip lists filenames
9. Status — `<Badge>` pill (Pending · Confirmed (removed) · Confirmed (quarantined) · Rejected · Awaiting info · Expired) — always tint + glyph + label
10. Row actions on hover — `Open` only (per design goal #5). No inline Confirm / Reject / Request-info; those live on PA-PVA-008b.

Row height stays ~72px baseline.

Row click (non-checkbox) → navigate to `PA-PVA-008b` at `/admin/valuation/comparable-reports/:reportId` preserving query in `return_to`.

**Empty state (Pending tab, 0 rows) — copy delta:**
- Title: "No bad-comparable reports awaiting review"
- Body: "When agents flag a comparable that's wrong, they land here for your review. Widen the 'Submitted within' filter if you expected reports."
- Secondary CTA: "Review pricing sources →" (deep-links to `/admin/pricing/sources` — PA-PVA-004).

---

## Explicit copy (English) — deltas only

Inherits copy table from PA-MOD-001. WF-05-specific deltas:

| Slot | Copy |
|---|---|
| Page title | Bad-comparable-report queue |
| Subtitle template | {N} pending · {K} at-risk (breach in {T}) · {H} high-impact awaiting 2-person · {M} confirmed this week · {J} rejected this week |
| TEST-env warning strip | TEST ENVIRONMENT — decisions here do not remove real comparables or re-run real valuations. |
| Status tab — pending | Pending |
| Status tab — confirmed_removed | Confirmed (removed) |
| Status tab — confirmed_quarantined | Confirmed (quarantined) |
| Status tab — rejected | Rejected |
| Status tab — awaiting_info | Awaiting info |
| Status tab — expired | Expired |
| Filter — category label | Reason category |
| Filter — category options | Any category · Wrong price · Wrong area · Already sold · Duplicate · Spam · Other |
| Filter — severity label | Severity |
| Filter — severity options | Any · Low · Medium · High · Critical |
| Filter — impact label | Market impact |
| Filter — impact options | Any · None · Low · Medium · High |
| Filter — within label | Submitted within |
| Filter — within options | Last 24 hours · Last 7 days · Last 30 days · All time |
| Search placeholder | Search reporter, agency, comparable title, or case ID… |
| Column — submitted | Submitted |
| Column — reporter | Reporter · Agency |
| Column — comparable | Comparable |
| Column — category | Reason |
| Column — severity | Severity |
| Column — impact | Market impact |
| Column — evidence | Evidence |
| Column — status | Status |
| Row action — open | Open |
| SLA remaining green | {H}h left |
| SLA remaining amber | {H}h left · at risk |
| SLA remaining red | Review SLA breached by {H}h |
| Reporter-pattern tooltip | Reporter has filed {N} reports against {agency} in {D} days · possible pattern. |
| Comparable-source chip — agency-owned | Agency-owned |
| Comparable-source chip — external | {sourceMonogram} · external |
| Market-impact chip template | {N} valuations · ±{P}% |
| Market-impact tooltip | Removing this comparable will re-run {N} valuations · median move {P}% · max move {Q}%. |
| Evidence chip template | {N} files |
| Evidence chip zero | 0 files ⚠ |
| Bulk-bar summary template | {N} across {C} reason categories · {H} High-severity · {M} High-impact |
| Bulk-bar reject-as-invalid | Reject as invalid {N} |
| Bulk-bar request-info | Request more info {N} |
| Bulk-bar step-up notice | Step-up required for high-severity or high-impact bulk decisions. |
| Bulk reject-as-invalid modal title | Reject {N} reports as invalid |
| Bulk reject-as-invalid reason label | Reason (shown to each reporter) |
| Bulk reject-as-invalid reason vocab | Comparable is correct as reported · Insufficient evidence · Duplicate of a resolved report · Vexatious pattern · Out of scope · Other |
| Bulk reject-as-invalid notes label | Notes for the reporters (required) |
| Bulk reject-as-invalid confirm | Reject all {N} |
| Bulk request-info modal title | Request more info on {N} reports |
| Bulk request-info reason vocab | Attach portal URL · Attach sale record · Attach photo evidence · Clarify which field is wrong · Clarify observation date · Other |
| Empty pending — title | No bad-comparable reports awaiting review |
| Empty pending — body | When agents flag a comparable that's wrong, they land here for your review. Widen the 'Submitted within' filter if you expected reports. |
| Empty pending — CTA | Review pricing sources → |
| Own-case block | You can't act on this row — you are the reporter or an agent at the comparable's agency. |

---

## Component palette — deltas only

Inherits palette from PA-MOD-001. WF-05-specific:

| Element | Primitive |
|---|---|
| Portal chip · Country flag | **REMOVED** (WF-05 has no portal dimension) |
| Validator lint pill row | **REMOVED** |
| Tenure risk badge | **REMOVED** |
| Reporter cell | **NEW** — `Avatar` + name + reporter-pattern amber dot (a small `--lc-status-warning-dot` circle with tooltip) + agency secondary line |
| Comparable snapshot cell | **NEW** — 40×40 thumbnail (or dashed placeholder + `Globe` icon for external-scrape) + title + area/city + `Source` chip |
| Reason category pill | `<Badge>` with 6-variant token set |
| Severity pill | `<Badge>` with 4-variant token set |
| Market-impact chip | Custom `<span>` with tier-tinted background + `<Numeric>` + `<Tooltip>` |
| Evidence-count chip | `<Badge>` with `Paperclip` icon + `<Numeric>` |
| Bulk confirm-remove / quarantine buttons | **NOT USED** (bulk is reject-as-invalid + request-info only) |
| Bulk reject-as-invalid modal | `Dialog` with `Select` (reason vocab) + `Textarea` (notes, required) |
| Bulk request-info modal | `Dialog` with `Select` (reason vocab) + `Textarea` (notes, required) |
| Row action — Open | `<Button size="sm" variant="outline">` — outline `--lc-border` |

Everything else (page title, env badge, TEST strip, status tabs, filter selects, search input, table shell, avatar, row hover, focus ring, pagination, empty-state block, error banner, toast, tooltip, keyboard hints Sheet, icons) inherits from PA-MOD-001.

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:

- **Env:** LIVE (green badge, no warning strip).
- **Header:** "Bad-comparable-report queue" title, subtitle "14 pending · 3 at-risk (breach in 2h) · 2 high-impact awaiting 2-person · 38 confirmed this week · 9 rejected this week".
- **Filter strip:** `Pending` tab active (counter 14), Confirmed removed (28), Confirmed quarantined (10), Rejected (9), Awaiting info (3), Expired (0); Reason `Any category`; Severity `Any`; Market impact `Any`; Within "Last 7 days"; search empty.
- **Table with 8 sample rows (all Pending):**
  1. Submitted "22m ago · 47h 38m left" · Reporter "SM" **Sara Al Mansouri** / *Elite Real Estate Dubai* · Comparable thumb + **"2BR Marina apartment · AED 2.4M"** *Marina Gate, Dubai Marina · agency_owned* · Wrong price · Medium · **12 valuations · ±4%** (Low impact) · 2 files · Pending
  2. Submitted "1h ago · 46h 58m left" · Reporter "AK" **Ahmed Khan** ⚠ / *Abu Dhabi Prime* · Comparable thumb (dashed) + **"Villa · Saadiyat"** *Saadiyat Beach · OLX · external* · Already sold · High · **34 valuations · ±11%** (High impact) · 3 files · Pending
  3. Submitted "3h ago · 44h 47m left" · Reporter "LG" **Layla Georges** / *Beirut Homes* · Comparable thumb + **"3BR Ashrafieh"** *Sursock, Beirut · agency_owned* · Wrong area · Low · **4 valuations · ±1%** (Low impact) · 1 file · Pending
  4. Submitted "5h ago · 42h 47m left" · Reporter "MR" **Mohammed Al Rashid** / *Riyadh Off-Plan Partners* · Comparable thumb (dashed) + **"Off-plan tower · North Riyadh"** *NORA · Bayut · external* · Duplicate · Low · **1 valuation · ±0%** (None) · 0 files ⚠ · Pending
  5. Submitted "8h ago · 39h 47m left" · Reporter "NA" **Noura Al Amri** ⚠ / *Sharjah Coastal Realty* · Comparable thumb + **"Studio · Al Majaz"** *Al Majaz 3, Sharjah · agency_owned* · Spam · **Critical** · **8 valuations · ±3%** (Medium impact) · 4 files · Pending
  6. Submitted "12h ago · 35h 47m left" · Reporter "YT" **Youssef Tarek** / *New Cairo Properties* · Comparable thumb (dashed) + **"Duplex · New Cairo"** *5th Settlement · Aqarmap · external* · Wrong price · High · **21 valuations · ±7%** (Medium impact) · 5 files · Pending
  7. Submitted "18h ago · 29h 47m left" · Reporter "FS" **Fatima Suleiman** / *Muscat Waterfront* · Comparable thumb + **"Townhouse · Muscat Hills"** *Muscat Hills · agency_owned* · Already sold · Medium · **7 valuations · ±2%** (Low impact) · 2 files · Pending
  8. Submitted "42h ago · 5h 47m left · at risk" (amber) · Reporter "OZ" **Omar Zayed** / *Amman Skyline* · Comparable thumb (dashed) + **"Penthouse · Abdoun"** *Abdoun · PropertyFinder · external* · Wrong price · **High** · **45 valuations · ±14%** (High impact) · 3 files · Pending
- **Row 2 (Ahmed Khan) in hover state:** row background `--lc-surface-sunken`; `Open` action button visible on the right. Reporter-pattern amber ⚠ dot visible next to name; tooltip "Reporter has filed 4 reports against Saadiyat Homes in 21 days · possible pattern."
- **Pagination footer:** "1–8 of 14" · prev disabled · next enabled · Rows per page 25.
- **Side variants to screenshot:**
  - **Bulk selection active:** rows 1, 3, 7 checked. Bulk-action bar visible: "3 selected · 3 across 3 reason categories · 0 High-severity · 0 High-impact · Clear selection" left; only `Reject as invalid 3` + `Request more info 3` right (no bulk confirm-remove/quarantine).
  - **High-impact filter applied:** rows 2 + 8 only.
  - **Empty state:** Pending tab with 0 rows.

Do NOT fabricate reporter confidence scores, agent reputation numbers, or removal probabilities not returned by the backend contract. Every field above corresponds to a real payload attribute from §Backend contract.

---

## Interactions

Deltas from PA-MOD-001 §Interactions:

- **On page load:** fetch `GET /api/admin/pricing/reports?status=pending&within=7d&page=1&pageSize=25` scoped to current env (`X-Wingcaster-Env` header per PA-NAV-001) — expects extended response per `[BE-CMR-01]`.
- **On row hover:** row background swaps to `--lc-surface-sunken`; `Open` action button fades in at right. NO inline confirm-remove / confirm-quarantine / reject / request-info buttons (per design goal #5).
- **On row click** (non-checkbox): navigate to `PA-PVA-008b` at `/admin/valuation/comparable-reports/:reportId?return_to=<current-url>`.
- **On Bulk Reject as invalid** (`Reject as invalid N` click): opens `Dialog` with `Select` (reason vocab, required) + `Textarea` (notes, required ≥5 chars). Own-case rows in the selection are silently excluded server-side; pre-submit warning surfaces if any exist ("N rows will be skipped — you are the reporter or agent at the comparable's agency."). Step-up required if any selected row is High-severity OR High-impact OR count >5. Confirm fires `POST /api/admin/pricing/reports/bulk-reject-as-invalid` with `{ report_ids: [...], reason_code, notes }`. Commits immediately (no undo on bulk); toast + partial-failure drawer if 207.
- **On Bulk Request more info** (`Request more info N` click): same flow with request-info reason vocab; POST `/bulk-request-info`. Transitions each row to `awaiting_info`; reporter sees the reason via AGT-REC-002.
- **On sort change**: default sort `[market_impact desc, sla_remaining asc, submitted_at asc]`; PA can override to `submitted_at desc`, `severity desc`, or `agent_name asc` via column-header click.
- **On CSV export**: fires `GET /api/admin/pricing/reports.csv?<same-query>`. Columns: `report_id, submitted_at, reporter_name, reporter_agency, comparable_id, comparable_title, comparable_source, comparable_agency, reason_category, severity, market_impact_tier, valuations_affected, valuations_pct_move_median, evidence_count, status, decided_at, decided_by, decision_reason, decision_notes`.
- **On env-switch mid-flow:** SAME as anchor (queue refetches; selection cleared).
- **On keyboard shortcut:** `J` next · `K` prev · `Enter` open · `X` select · `Shift+A` select-all-visible · `.` refresh · `?` shortcuts · `Esc` close/clear. `A` and `R` inline-decision shortcuts from PA-MOD-001 are DISABLED here — no inline decisions in this queue.

Everything else (initial loading skeleton, status-tab change, filter change, search debounce, pagination, error → Retry, session expiry → SHR-AUT-001, insufficient permission → 403 block, RTL, dark mode) inherits from PA-MOD-001.

---

## State variants

Deltas from PA-MOD-001 §State variants:

| Variant | Trigger | Behavior |
|---|---|---|
| **Ready — pending default** | Load complete | Table renders sorted `[market_impact desc, sla_remaining asc, submitted_at asc]`; row 1 focused for keyboard nav. |
| **Bulk-selection with confirm-remove attempted** | User keyboard-shortcuts a confirm-remove | Blocked with toast "Confirm-remove decisions are single-row only — open the case on PA-PVA-008b." |
| **Own-case row** | Server returns `is_own=true` | Row selectable but excluded from bulk POST server-side; Open action available (PA can still open for read-only inspection); pre-submit warning surfaces on bulk. |
| **High-impact-in-selection** | Server: any selected row has `market_impact.tier=high` | Bulk-bar step-up notice amber + step-up prompt fires on confirm. |
| **Reporter-pattern amber dot** | Server returns `reporter.pattern_flag=true` on a row | Small amber dot rendered next to reporter name; tooltip lists count + days + agency. |
| **Awaiting-info tab** | Tab change | Rows show state "Awaiting info" and last-info-requested timestamp; `Open` action available (PA can withdraw the request or upgrade to reject). |
| **Confirmed-removed tab** | Tab change | Rows show `decided_at`, `decided_by`, and a `Recalc job` chip linking to the recalculation-jobs page filtered to that job ID (if applicable). |
| **Confirmed-quarantined tab** | Tab change | Rows show `decided_at`, `decided_by`, and a `Quarantine expires in {H}h` chip if a quarantine-window was set. |
| **TEST-env warning strip** | env=TEST | Copy: "TEST ENVIRONMENT — decisions here do not remove real comparables or re-run real valuations." |
| **Bulk POST 207 partial** | Some rows failed | Destructive toast + failure drawer listing failed rows with error codes (`OWN_CASE`, `ALREADY_DECIDED`, `STEP_UP_REQUIRED`, `MARKET_IMPACT_UPGRADED_TO_TWO_PERSON`). |

Everything else (initial loading, empty variants, search-no-results, backend 500, session expired, permission denied, dark mode, RTL, loading-pagination, loading-filter-change) inherits from PA-MOD-001.

---

## Accessibility

Inherits from PA-MOD-001 §Accessibility. **PA-PVA-008-specific additions:**

- Reporter-pattern amber dot has `aria-label="Reporter has filed {N} reports against {agency} in {D} days — possible pattern."` — SR announces once on row focus.
- Market-impact chip renders `<Numeric>` count with `aria-label="{N} valuations affected, median move {P} percent, {tier} impact."` — SR reads the aggregate on cell focus.
- Bulk-action bar surfaces "Step-up required for high-severity or high-impact bulk decisions." via `aria-live="polite"` when the selection first crosses that threshold.
- Comparable-snapshot cell tooltip on comparable-owning agency name is keyboard-reachable via `Tab` inside the cell and announces "Owned by {agencyName} — opens PA-TEN-001 in a new tab."

---

## Anti-patterns (do not do these)

Inherits from PA-MOD-001 anti-patterns. **PA-PVA-008-specific additions:**

- Do NOT expose a bulk-confirm-remove or bulk-confirm-quarantine affordance — WF-05 is single-row for confirmed decisions by policy.
- Do NOT show the reporter-pattern amber dot without the tooltip explanation — a bare warning glyph reads as an accusation.
- Do NOT hide the market-impact chip on rows with `tier=none` — render "0 valuations · ±0%" muted, so the column always occupies the same visual weight (prevents "no chip" reading as "not analyzed yet").
- Do NOT sort the queue by pure recency alone by default — the `[market_impact desc, sla_remaining asc, submitted_at asc]` compound sort is the whole point of surfacing high-impact rows.
- Do NOT permit `POST /:id/review` (the legacy generic endpoint) from this UI — every decision must fire the WF-05-specific endpoint per `[BE-CMR-02]`.

---

## Backend contract

**List endpoint:** `GET /api/admin/pricing/reports` — **EXISTS** at `backend/src/modules/property-valuation/interface/admin-routes.js:379`. Currently returns `dal.findAll('comparable_reports', () => true)` — a flat array with no filtering, pagination, or extended fields.

**`[BE-CMR-01]` List-response extension** — required for this UI:

```json
{
  "reports": [
    {
      "id": "cmr_abc123",
      "created_at": "2026-09-07T12:04:11Z",
      "sla_hours_remaining": 47.6,
      "sla_hours_total": 48.0,
      "status": "pending",
      "reason_category": "wrong_price",
      "severity": "medium",
      "reporter": {
        "id": "usr_xyz789",
        "display_name": "Sara Al Mansouri",
        "avatar_url": "https://…",
        "agency": { "id": "agy_dubai_elite", "name": "Elite Real Estate Dubai", "tenant_url": "/admin/tenants/agy_dubai_elite" },
        "pattern_flag": false,
        "pattern_signals": null
      },
      "comparable": {
        "id": "cmp_marina_gate_2br",
        "title": "2BR Marina apartment · AED 2.4M",
        "address_line": "Marina Gate, Dubai Marina",
        "thumb_url": "https://…",
        "source": "agency_owned",
        "source_display": "Agency-owned",
        "owning_agency": { "id": "agy_marina_ventures", "name": "Marina Ventures", "tenant_url": "/admin/tenants/agy_marina_ventures" }
      },
      "reported_field": "price",
      "reported_value": 2400000,
      "observed_value": 3400000,
      "delta_pct": -29.4,
      "market_impact": {
        "tier": "low",
        "valuations_affected": 12,
        "pct_move_median": 4.0,
        "pct_move_max": 7.8
      },
      "evidence": {
        "file_count": 2,
        "files": [
          { "filename": "portal_screenshot.png", "uploaded_at": "2026-09-07T12:04:20Z", "size_bytes": 218430, "content_type": "image/png" }
        ]
      },
      "is_own": false,
      "requires_two_person": false,
      "env": "live"
    }
  ],
  "pagination": { "page": 1, "page_size": 25, "total": 14, "has_next": false },
  "counts": {
    "pending": 14,
    "pending_at_risk": 3,
    "high_impact_awaiting_two_person": 2,
    "confirmed_removed_this_week": 28,
    "confirmed_quarantined_this_week": 10,
    "rejected_this_week": 9,
    "awaiting_info_this_week": 3,
    "expired_this_week": 0
  }
}
```

**Query params:** `status`, `category`, `severity`, `impact`, `within`, `q`, `page`, `pageSize`, `sort` — semantics per PA-MOD-001. Default sort `market_impact:desc,sla_remaining:asc,submitted_at:asc`.

**Decision endpoints — `[BE-CMR-02]`** (NEW; replace the generic `/review`):
- `POST /api/admin/pricing/reports/:reportId/confirm-remove` — body `{ notes }`. Server-side: sets status=`confirmed_removed`, tombstones the comparable in `comparableService`, enqueues `recalculationJobService` for the affected valuations. If `market_impact.tier=high` AND `is_own=false`, records as `REMOVE_PROPOSED` and appends to `PA-APR-001` for second-approval per `[BE-CMR-05]`.
- `POST /:reportId/confirm-quarantine` — body `{ notes, quarantine_hours? }`. Sets status=`confirmed_quarantined`, flags the comparable in-pool but excluded from pricing pool during window.
- `POST /:reportId/reject-as-invalid` — body `{ reason_code, notes }`. Sets status=`rejected`.
- `POST /:reportId/request-info` — body `{ reason_code, notes, requested_evidence: [...] }`. Sets status=`awaiting_info`; sends notification to reporter via AGT-REC-002.

**Bulk endpoints — `[BE-CMR-03]`:**
- `POST /api/admin/pricing/reports/bulk-reject-as-invalid` — body `{ report_ids: [...], reason_code, notes }`. Response 200 or 207 with `succeeded[]` + `failed[{id, error}]`.
- `POST /api/admin/pricing/reports/bulk-request-info` — body `{ report_ids: [...], reason_code, notes, requested_evidence?: [...] }`.

**Undo — `[BE-CMR-09]`:** `POST /:reportId/undo-decision` — reverses last decision if within 5s (per queue-family invariant) AND recalculation job has NOT committed. Refuses with `RECALC_COMMITTED` otherwise (single-row confirm-remove will not undo once the recalc job started).

**CSV export — `[BE-CMR-10]`:** `GET /api/admin/pricing/reports.csv?<same-query>`.

**Prerequisites to file in kickoff §5a:**
- `[BE-CMR-01]` list-response extension — ~2 days.
- `[BE-CMR-02]` four decision endpoints — ~3 days (removal endpoint carries the recalculation-trigger integration).
- `[BE-CMR-03]` two bulk endpoints — ~1 day.
- `[BE-CMR-04]` market-impact scoring service — ~3 days (walk `valuationService` for references to each comparable + compute median/max move on hypothetical removal).
- `[BE-CMR-05]` two-person-rule integration with `PA-APR-003` — ~1 day.
- `[BE-CMR-06]` `is_own` detection — ~0.5 day.
- `[BE-CMR-07]` env-scoping audit — ~0.5 day.
- `[BE-CMR-08]` recalculation trigger (reuses existing `recalculationJobService.enqueue`) — ~0.5 day.
- `[BE-CMR-09]` undo-decision endpoint — ~1 day.
- `[BE-CMR-10]` CSV export — ~1 day.

Total new backend surface for the PA-PVA-008+008b pair: ~12-14 days.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/valuation/BadComparableReportQueuePage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/admin/valuation/comparable-reports" element={<BadComparableReportQueuePage />} />` behind `PAConsoleGuard` (capability pack `comparable-review`).
- **Top-nav entry:** update PA top nav "Valuation → Comparable reports" with a badge counter tied to `pending` count (poll every 60s).
- **Component reuse (from PA-MOD-001 anchor):**
  - `PAQueueFilterStrip` — reused with WF-05-specific `filterSchema`.
  - `PAQueueTable` — reused with column slot API.
  - `PAQueueBulkBar` — reused with `actions=['reject_as_invalid', 'request_info']` prop (no confirm-remove/quarantine in bulk mode).
  - `PAQueueBulkReasonDialog` — reused for reject-as-invalid + request-info.
  - `PAQueueKeyboardShortcutsPanel` — reused with WF-05 shortcut map (no `A`/`R` inline-decision keys).
- **New components:**
  - `BadComparableReportQueuePage.tsx` — page shell + data + URL state + env context.
  - `BadComparableReportRow.tsx` — one row (reporter cell, comparable snapshot cell, category, severity, market-impact chip, evidence, status, Open).
  - `MarketImpactChip.tsx` — reusable across PA-PVA-008b + future price-impact surfaces.
  - `ReporterPatternDot.tsx` — reusable across future PA support surfaces.
- **Data layer:**
  - Hook: `useBadComparableReportsQuery({ status, category, severity, impact, within, q, page, pageSize, sort, env })`.
  - Bulk-mutation hooks: `useBulkRejectAsInvalid`, `useBulkRequestInfo`.
- **Test discipline:**
  - Unit: `MarketImpactChip` render tiers; `ReporterPatternDot` tooltip; row-sort composite key `[impact, sla, submitted]`.
  - Integration: page load × filter × tab-swap × bulk-reject happy path × bulk-request-info × own-case block × high-impact step-up × env-switch mid-flow × 403.
  - RTL + Broadcast (`no-raw-hex.test.ts`) + real-Postgres pending → confirmed_removed → recalc-enqueued end-to-end (covered by pair brief).
  - Accessibility: axe-core on loaded + bulk-selected + modal-open states.
- **Copy/i18n:** all strings in `web/src/locales/en/paComparableReports.json` + `ar/paComparableReports.json`. `[TRANSLATION-PENDING]` in AR.

---

## Broadcast alignment callouts (short)

**Refer to PA-MOD-001 §Broadcast alignment callouts as the anchor.** All page-shell, header, filter, table, pagination, empty-state, loading-skeleton, focus-ring, radii, elevation, motion, and no-raw-hex rules apply UNCHANGED.

PA-PVA-008-specific overlays:
- Reason-category badge palette maps six categories to five status-token sets (warning · closed · archived · danger · draft) — never fabricate new tint pairs; reuse the semantic tokens.
- Severity Critical uses the same `--lc-status-danger-{bg,fg,dot}` as High but with the ✕ glyph (High uses ◆) so screen-only-color viewers still distinguish. Never rely on tint alone.
- Market-impact chip tint per tier — None `--lc-surface-sunken`; Low `--lc-status-draft-bg`; Medium `--lc-status-warning-bg`; High `--lc-status-danger-bg`. Text stays `--lc-text-primary` for AA contrast.
- Reporter-pattern amber dot uses `--lc-status-warning-dot` (small 8px circle) — never the danger-red dot; this is a signal not a violation.
- Comparable-snapshot cell dashed-placeholder for external-scrape rows uses `--lc-border-strong` dashed + `Globe` lucide icon centered in `--lc-text-muted`.
- Bulk-bar tokens: same as anchor; no confirm-remove/quarantine buttons present.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) bad-comparable-report queue screen (PA-PVA-008) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is where a Platform Admin reviews reports that agents filed against comparable listings in WingCaster's market-pricing pool (the comparable's price/area/status is wrong, it's a duplicate, or it's spam) — WF-05 approver-side. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

This is a DELTA brief inheriting from PA-MOD-001 (portal moderation queue) — same page shell, same env badge, same filter strip pattern, same table skeleton, same keyboard nav, same bulk-bar mechanics. Critical differences: bulk is scoped to reject-as-invalid + request-info only (NO bulk confirm-remove — that's single-row on PA-PVA-008b); the market-impact chip is a first-class column; reporter-pattern amber dot flags coordinated reporting.

First pass: render the desktop 1440px layout with LIVE env badge (green), Pending tab active (counter 14), 8 sample rows all Pending (mix of severity + impact tiers, mix of MENA markets), row 2 in hover state showing Open button + reporter-pattern amber dot with tooltip. Pagination footer "1–8 of 14".

LTR English only for this pass — I'll ask for bulk-selection, high-impact filter, TEST env, empty, RTL, dark as follow-ups.

Follow the copy table exactly. Do NOT invent reporter scores or removal probabilities.

DESIGN BRIEF FOLLOWS:
```

Iteration order:
1. Bulk-selection active — rows 1, 3, 7 checked; bulk-bar with `Reject as invalid 3` + `Request more info 3` (no confirm-remove/quarantine buttons visible).
2. Bulk Reject-as-invalid dialog open — Select for reason vocab, Textarea empty, Confirm disabled.
3. High-impact filter applied — rows 2 + 8 only.
4. TEST env — amber badge + full-width warning strip.
5. Empty state — Pending tab, 0 rows.
6. Awaiting-info tab active with 3 sample rows showing "Requested 4h ago" secondary line.
7. Keyboard shortcuts drawer open.
8. RTL Arabic at desktop 1440px with `[TRANSLATION-PENDING]`.
9. Dark mode version of pass 1.

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-PVA-008/` + screenshot to `docs/design/mockups/PA-PVA-008-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 9 iteration states (ready-pending LIVE, bulk-selection, bulk-reject-modal, high-impact-filter, TEST env, empty, awaiting-info tab, keyboard drawer, RTL, dark).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-PVA-008/`.
- [ ] Cursor Wave-2 Week-5 dispatch prompt references this brief + the mockup paths + the paired PA-PVA-008b brief.
- [ ] `[BE-CMR-01..10]` filed in kickoff §5a.
- [ ] `PAQueueBulkBar` extended to accept `actions` prop restricting the button set (needed here + will be reused).
- [ ] `MarketImpactChip` primitive shipped as a reusable UI component.
- [ ] `ReporterPatternDot` primitive shipped as a reusable UI component.
- [ ] Delta brief `PA-PVA-008b-bad-comparable-report-detail-brief.md` referenced from Wave-2 Week-5 dispatch prompt.
