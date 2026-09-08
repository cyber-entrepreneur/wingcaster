# Screen Brief — PA-PVA-009 · Agent-price-report review queue (WF-06 approver-side)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Delta brief in the **PA approval-queue family**. Inherits the full Broadcast alignment block, shell chrome, keyboard-nav grammar, bulk-decision discipline, and state-variant catalogue from `PA-MOD-001-portal-moderation-queue-brief.md` (the family anchor). This brief captures only the WF-06 deltas — column composition, decision vocabulary, backend contract, and the incorporate-vs-signal-only distinction that separates this queue from the sibling comparable-report queue (`PA-PVA-008`).

Companion detail brief: `PA-PVA-009b-agent-price-report-detail-brief.md`.

Wave 5 (Week 5 — WF-06 cluster) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 6 §5 rows 45-46 + §6 Week 5. Pairs with agent-side `AGT-APR-005` (submit) + `AGT-APR-006` (my list) + `AGT-REC-003` (outcome).

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`** AND **from `PA-MOD-001-portal-moderation-queue-brief.md` §Broadcast alignment** (the PA queue-family anchor block). Every rule in the anchor applies here unchanged unless a **DELTA** line below overrides it. All 7 PA queue-family invariants (env badge always visible, two-person rule, bulk-reason discipline, step-up for high-risk, immutable audit, 5s undo grace on single-row only, keyboard-first) apply verbatim.

**Screen-specific Broadcast deltas from the PA-MOD-001 anchor:**

- **Column deltas.** The Portal + Country + Validator-lint cells are replaced by three WF-06-specific cells: (i) Subject property / market segment, (ii) Agent's recommended price + delta from benchmark, (iii) Sources cited (comparables count + evidence file count). Everything else (env badge, filter strip shell, bulk bar, keyboard nav, pagination, empty state) is unchanged.
- **Recommendation-delta cell.** Renders `<Numeric>` price (AED / SAR / EGP / LBP / USD per subject-market currency) + arrow-glyph delta chip: `▲ +8.4%` above benchmark uses `--lc-status-warning-{bg,fg,dot}`, `▼ -6.1%` below uses `--lc-accent-bold-{bg,fg}` + `--lc-accent-bold-edge` boundary, `~ ±2%` in-band uses `--lc-status-published-{bg,fg,dot}` + `●` glyph. Chip label always spells the direction ("+8.4% above benchmark" / "in benchmark band") — never color-alone. Delta magnitude drives high-risk-tier auto-flagging: `|delta| ≥ 15%` promotes the row to High-risk regardless of tenure signal.
- **Decision vocabulary is 4-way, not 3-way.** Where PA-MOD-001 uses Approve / Reject / Request info, this queue uses **Approve-and-incorporate** (primary — writes the report as an authoritative pricing signal + stamps `status=verified` + fires benchmark-refresh worker), **Approve-as-signal-only** (secondary — stamps `status=verified` but does NOT write to the pricing-benchmark table; the report is visible to Bazaar/agent surfaces as a considered opinion but does not move the benchmark), **Reject-with-reason** (stamps `status=rejected` + agent-visible reason), and **Request-more-info** (leaves `status=pending_review` + writes agent-visible fix hint; agent can resubmit which re-enters this queue). The two Approve variants share a common step-up gate; only Approve-and-incorporate on a High-delta row (`|delta| ≥ 10%`) triggers a two-person rule (`fin.approval_requests` per WF-06 policy — see §Backend contract).
- **Row-action button set on hover (Pending rows only).** `Incorporate` (primary orange outline `--lc-action-primary`) · `Signal only` (secondary outline `--lc-border-strong`) · `Reject` (outline `--lc-border-strong` + `X` icon) · `Request info` (outline `--lc-status-warning`) · `Open`. All 5 buttons visible on hover; keyboard equivalents are `A` incorporate, `S` signal-only, `R` reject, `I` request info, `Enter` open detail. `?` sheet reflects the WF-06-specific mapping.
- **Tenure + delta risk composite.** Tenure risk badge remains (from `[BE-DESIGN-02]`), but the effective decision-risk that gates step-up + two-person is `max(tenure_tier, delta_tier)` where delta_tier is derived server-side (`|delta| < 5% → low`, `5–10% → medium`, `10–15% → high`, `≥ 15% → high + auto-flag`). The queue renders BOTH badges side-by-side in the Risk cell so PA can see which signal drove the composite tier.
- **Bulk decisions.** Bulk Approve-and-incorporate is **disallowed in v1** — each incorporate write must be reviewed individually because it moves the benchmark. Bulk Approve-as-signal-only IS allowed (count-confirm modal per PA-MOD-001 pattern). Bulk Reject + Bulk Request-info follow PA-MOD-001 exactly (shared reason vocab + notes).
- **Filter strip additions.** Beyond the family-standard Status / Country / Within / Search, this queue adds: `Market segment` Select (fed from server-side facet — e.g. "Dubai Marina · 2-3BR apartments"), `Recommendation delta` Select (Any · Within band ±5% · Above 5-10% · Above 10%+ · Below 5-10% · Below 10%+), `Agent tier` Select (Any · Pro · Pro Elite — only Pro-tier + above agents can submit price reports per `AGT-APR-005` gating). `Portal` filter from PA-MOD-001 is REMOVED (irrelevant here).
- **Status pill vocabulary.** `pending_review` `--lc-status-draft` ○ · `verified` `--lc-status-published` ● · `incorporated` `--lc-accent-bold-{bg,fg}` + `--lc-accent-bold-edge` + `◆` (subset of verified where a benchmark write happened) · `rejected` `--lc-status-closed` ✕ · `request_info` `--lc-status-warning` ▲ · `expired` `--lc-status-archived` ▢ (auto-expired after 30 days pending). Tint + glyph + label as always.
- **Numeric discipline.** Every currency price, %-delta, comparable count, evidence-file count, tenure-days, submission-index → `<Numeric>` + `tabular-nums`. Currency symbol precedes the numeric run per locale (e.g. `AED <Numeric>1,850,000</Numeric>`).
- **Environment badge.** Honors PA-NAV-001 exactly per family anchor. Env-scoped: LIVE and TEST price-reports NEVER co-mingle; `X-Wingcaster-Env` header binds every list + action call.

---

## Meta

| | |
|---|---|
| Screen ID | PA-PVA-009 |
| Screen name | Agent-price-report review queue |
| Persona | PA (Platform Admin — cannot review reports submitted by their own agent-of-record identity; server-enforced) |
| Device targets | Desktop 1440px ONLY (PA console family invariant — mobile fallback is the info-block per PA-MOD-001) |
| Locale | English + Arabic (RTL) — both mandatory. `[TRANSLATION-PENDING]` for AR strings in v1. |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/valuation/price-reports` (query params: `?status=pending_review\|verified\|incorporated\|rejected\|request_info\|expired`, `?segment=<facet>`, `?country=<iso>`, `?delta=in_band\|above_5\|above_10\|below_5\|below_10`, `?tier=pro\|pro_elite`, `?within=24h\|7d\|30d\|all`, `?q=<agent-or-segment>`, `?page=<n>`) |
| Current state | **PARTIAL.** Backend routes verified in `backend/src/modules/property-valuation/interface/admin-routes.js`: `GET /api/admin/pricing/agent-price-reports` (line 351) + `POST /api/admin/pricing/agent-price-reports/:id/review` (line 358, accepts `{ status: 'verified'\|'rejected', notes }`). The list route returns raw records with no pagination, filters, or joins; the review route has no `incorporate` mode and does NOT write to any pricing-benchmark surface. Frontend does NOT exist. |
| Workflow role | WF-06 role = Approval queue (agent-submitted price analysis) |
| Backend prerequisites | ✅ list route exists (needs pagination + filter params + joined agent/tenure/delta payload — see §Backend contract) · ✅ review route exists (needs extension for `incorporate` mode + benchmark-write side effect + `request_info` status) · ⏳ `[BE-DESIGN-PVA09-01]` benchmark-write side effect on incorporate — NEW · ⏳ `[BE-DESIGN-PVA09-02]` benchmark-delta computation service — NEW · ⏳ `[BE-DESIGN-02]` tenure-risk scoring (shared with PA-MOD-001) · ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context · ⏳ `[BE-DESIGN-PVA09-03]` two-person rule wiring via `fin.approval_requests` for high-delta incorporate |
| Cluster | Wave 5 (Week 5 — WF-06) alongside PA-PVA-009b (detail), AGT-APR-005 (submit), AGT-APR-006 (my list), AGT-REC-003 (outcome) |
| Sibling brief | `PA-PVA-008` (comparable-report review queue) — same shell, different report shape + different backend module |

---

## Purpose

Platform Admin reviews Pro-tier and Pro-Elite agents' considered price-analysis reports on defined market segments (e.g. "Dubai Marina · 2-3BR apartments, Q3 2026 comps"). Each report is the agent's structured expert opinion: a recommended price band, an analytical thesis, cited comparables, evidence attachments (portal screenshots, transaction records, appraisal PDFs), and — critically — a delta from WingCaster's current internal benchmark for that segment.

The queue serves three PA responsibilities:

1. **Enrich the pricing corpus.** When an incorporate-quality report lands (evidence solid, thesis sound, delta plausible), PA approves-and-incorporates so the report becomes an authoritative pricing signal that feeds `pricing_benchmarks` (and, downstream, everything from Bazaar segment badges to `AGT-LST-013` price-suggestion tools). Incorporation is a benchmark write; it must be deliberate.
2. **Publish considered opinions without moving the benchmark.** Not every good report should move the benchmark — a report from a new-to-segment agent may be well-reasoned and worth publishing to Bazaar/agent surfaces as an opinion, without WingCaster staking benchmark accuracy on it. That is Approve-as-signal-only.
3. **Reject noise, request fixes.** Rejection carries an agent-visible reason (from a controlled vocab); Request-info opens a dialogue where PA asks for missing evidence or clarification and the agent can resubmit.

WF-06 is deliberately lower-cadence than WF-03 (portal moderation): expected volume in v1 is single-digit reports per day per country, but each decision has downstream benchmark impact. Density-per-decision matters less than **decision quality per row** — that is why bulk-incorporate is disallowed and why the detail screen (`PA-PVA-009b`) is intentionally rich.

Success outcome: PA moves a report from `pending_review` to `verified` (with or without `incorporated=true`), `rejected` with reason (agent sees on `AGT-REC-003`), or `request_info` (agent sees actionable hint + can resubmit). Zero reports past the 30-day auto-expiry SLA. Every incorporate write writes to `fin.approval_requests` for the two-person audit trail when `|delta| ≥ 10%`.

---

## Design goals

1. **Decision quality over triage speed.** Fewer rows, richer per-row context. Row height ~76px (slightly taller than PA-MOD-001's 72px) to accommodate the delta chip + composite risk badge.
2. **Delta is the primary scan signal.** Sorting default is `|delta| desc` so the biggest benchmark-moving proposals surface first. PA can pick the low-hanging in-band reports first (bulk-Signal-only friendly) then chew through the high-delta rows one at a time.
3. **Composite risk = max(tenure, delta).** Show BOTH badges so PA sees which signal drove the tier. A Pro-Elite agent with 5-year tenure but a +18% delta is still a High-risk decision.
4. **Incorporate is intentional; signal-only is safe.** The two primary CTAs are visually distinct — Incorporate uses the primary-orange outline; Signal-only uses the secondary outline. Never let PA fat-finger an incorporate.
5. **Bulk actions are safe by construction.** Bulk incorporate is disallowed. Bulk signal-only allowed with count-confirm. Bulk reject + bulk request-info follow PA-MOD-001 exactly.
6. **Env-context is unambiguous.** Env badge always visible; TEST persistent warning strip runs across the queue. Reports tagged with tenant-env; LIVE-vs-TEST data never co-mingle.
7. **Family-pattern coherence.** Same shell, filters, bulk bar, keyboard nav, pagination, empty state, focus-ring, undo-grace as PA-MOD-001. A PA who has learned one queue knows all of them.
8. **Never color-only.** Every delta chip, status pill, tenure badge, delta-tier badge is tint + glyph + label per Broadcast rule.

---

## Layout

### Desktop 1440px (only target)

Same single-column stack as PA-MOD-001 inside the PA console shell (SHR-NAV-001 top bar + PA-NAV-001 env badge; no side drawer). All deltas relative to the anchor:

**PA-NAV-001 warning strip** — identical (env=TEST → sticky under top bar).

**Header block:**
- Title "Agent-price-report review" (`var(--lc-type-heading-1)`).
- Subtitle template: "<Numeric>N</Numeric> pending · <Numeric>H</Numeric> high-delta (≥10%) · <Numeric>M</Numeric> incorporated · <Numeric>V</Numeric> signal-only · <Numeric>J</Numeric> rejected this month" (`var(--lc-type-body-sm)` `var(--lc-text-muted)`).
- Right utility buttons: `Refresh`, `Export CSV`, `?` keyboard hints — identical to PA-MOD-001.

**Filter strip:**
- Row 1: status tabs — `Pending review` (default) / `Verified` (aggregates incorporated + signal-only) / `Incorporated` / `Rejected` / `Request info` / `Expired`. Counter chip per tab.
- Row 2: `Country` Select · `Market segment` Select (server-side facet, top-20 segments with active reports; typeahead beyond) · `Recommendation delta` Select (Any · In band ±5% · Above 5-10% · Above 10%+ · Below 5-10% · Below 10%+) · `Agent tier` Select (Any · Pro · Pro Elite) · `Submitted within` Select (24h / 7d default / 30d / All) · `<Input>` search with `Search` icon prefix — placeholder "Search agent, agency, or market segment…", debounced 200ms.

**Bulk-action bar (conditional):**
- Same shell as PA-MOD-001. Left "<Numeric>N</Numeric> selected · Clear selection". Center "<Numeric>N</Numeric> across <Numeric>S</Numeric> segments · <Numeric>H</Numeric> High-risk composite". Right buttons: `Signal only N` (primary) · `Reject N` (secondary) · `Request info N` (secondary). **No `Incorporate N` button** — the button is absent from the bulk bar with a `<Tooltip>` on the info-glyph icon explaining "Incorporate must be reviewed one report at a time — it writes to the pricing benchmark."

**Table:**
- Columns (LTR; mirror in RTL):
  1. Row-select checkbox (32px)
  2. Submitted — relative time (default secondary sort: newest first within delta buckets)
  3. Agent + tier + tenure (avatar + agent name + agency line + `Pro` / `Pro Elite` chip + tenure "3y 4mo" in `<Numeric>` `var(--lc-text-muted)`)
  4. Subject property / segment (segment label bold + "N comparable listings" secondary + country flag emoji + ISO)
  5. Agent's recommendation + delta (currency-prefixed `<Numeric>` price + delta chip below)
  6. Sources cited (comparable count + evidence file count — e.g. "6 comps · 3 files" as `<Numeric>` runs joined by "·")
  7. Composite risk (Tenure badge + Delta badge stacked or side-by-side, whichever fits the ~200px cell width)
  8. Status (`<Badge>` per status vocabulary)
  9. Row actions on hover (Pending rows) — Incorporate · Signal only · Reject · Request info · Open
- Row height ~76px.
- Row click (anywhere except checkbox / row-actions) → navigate to `PA-PVA-009b` at `/admin/valuation/price-reports/:reportId` preserving `return_to`.
- Sticky header.

**Pagination footer:** identical to PA-MOD-001. Default sort: `|delta| desc`; secondary sort options in Select (Newest · Oldest · Delta ↑ · Delta ↓ · Tenure ↑).

### Empty state (Pending tab, 0 rows)

Centered stack:
- Illustration placeholder (200px, `--lc-surface-sunken`, dashed `--lc-border-strong`).
- Title: "No agent price reports awaiting review"
- Body: "Pro-tier agents can submit market-segment price analyses from their listing detail. Reports land here when submitted."
- Secondary CTA: "Review Pro-tier submission gating →" — deep-links to `/admin/valuation/config` (PA-PVA-002).

### Below-min-viewport fallback (<1024px)

Same info block as PA-MOD-001: "PA console requires a desktop screen (1024px or wider)."

---

## Explicit copy (English)

| Slot | Copy |
|---|---|
| Page title | Agent-price-report review |
| Subtitle template | {N} pending · {H} high-delta (≥10%) · {M} incorporated · {V} signal-only · {J} rejected this month |
| Status tab — pending | Pending review |
| Status tab — verified | Verified |
| Status tab — incorporated | Incorporated |
| Status tab — rejected | Rejected |
| Status tab — request-info | Request info |
| Status tab — expired | Expired |
| Filter — country label | Country |
| Filter — segment label | Market segment |
| Filter — segment any option | Any segment |
| Filter — delta label | Recommendation delta |
| Filter — delta options | Any · In band (±5%) · Above 5-10% · Above 10%+ · Below 5-10% · Below 10%+ |
| Filter — tier label | Agent tier |
| Filter — tier options | Any · Pro · Pro Elite |
| Filter — within label | Submitted within |
| Filter — within options | Last 24 hours · Last 7 days · Last 30 days · All time |
| Search placeholder | Search agent, agency, or market segment… |
| Column — submitted | Submitted |
| Column — agent | Agent · Tier · Tenure |
| Column — subject | Subject · Segment |
| Column — recommendation | Recommendation · Δ benchmark |
| Column — sources | Sources |
| Column — risk | Composite risk |
| Column — status | Status |
| Row action — incorporate | Incorporate |
| Row action — signal-only | Signal only |
| Row action — reject | Reject |
| Row action — request-info | Request info |
| Row action — open | Open |
| Delta chip — above template | ▲ +{X}% above benchmark |
| Delta chip — below template | ▼ −{X}% below benchmark |
| Delta chip — in-band template | ~ ±{X}% in band |
| Composite risk — high | High (delta) / High (tenure) / High (both) |
| Sources template | {C} comps · {F} files |
| Bulk-bar N selected | {N} selected |
| Bulk-bar summary template | {N} across {S} segments · {H} High-risk composite |
| Bulk-bar clear | Clear selection |
| Bulk-bar signal-only | Signal only {N} |
| Bulk-bar reject | Reject {N} |
| Bulk-bar request-info | Request info {N} |
| Bulk incorporate blocked tooltip | Incorporate must be reviewed one report at a time — it writes to the pricing benchmark. |
| Bulk signal-only modal title | Publish {N} reports as signal-only? |
| Bulk signal-only modal body | Each report will be marked verified and visible to Bazaar and agents as a considered opinion. The benchmark will NOT change. |
| Bulk signal-only modal confirm | Publish {N} as signal-only |
| Bulk reject modal reason vocab | Insufficient evidence · Thesis not supported by comps · Duplicate report · Cited data unverifiable · Out-of-scope segment · Off-topic · Other |
| Bulk request-info modal reason vocab | Need additional comparables · Cite source of transaction data · Clarify thesis assumptions · Attach evidence files · Narrow segment definition · Other |
| Incorporate confirm modal title | Approve and incorporate into benchmark? |
| Incorporate confirm modal body | This report will be marked verified AND written as an authoritative signal into the pricing benchmark for {segment}. This affects agent pricing tools and Bazaar segment badges. |
| Incorporate confirm modal high-delta body | Delta is {X}% — a second approver is required. On confirm, this becomes a pending approval request assigned to the on-call PA. |
| Incorporate confirm modal confirm | Incorporate |
| Incorporate confirm modal cancel | Cancel |
| Signal-only confirm modal title | Approve as signal-only? |
| Signal-only confirm modal body | This report will be marked verified and visible to Bazaar and agents as a considered opinion. The pricing benchmark will NOT change. |
| Signal-only confirm modal confirm | Approve as signal-only |
| Reject modal title | Reject price report |
| Reject modal reason label | Reason (shown to the agent) |
| Reject modal notes label | Notes for the agent (optional) |
| Reject modal notes helper | The agent sees this in their outcome inbox. Be specific about what to fix. |
| Reject modal confirm | Reject |
| Request info modal title | Request more info |
| Request info modal reason label | What do you need? (shown to the agent) |
| Request info modal notes label | Additional context (optional) |
| Request info modal confirm | Send request |
| Empty pending title | No agent price reports awaiting review |
| Empty pending body | Pro-tier agents can submit market-segment price analyses from their listing detail. Reports land here when submitted. |
| Empty pending CTA | Review Pro-tier submission gating → |
| Empty other-tab title | No {status} reports in this range |
| Empty other-tab body | Try widening the 'Submitted within' filter. |
| Loading | Loading price reports… |
| Env-switch loading | Switching to {env}. Reloading queue… |
| Error banner | Couldn't load reports. Try again. |
| Retry | Retry |
| Pagination template | {start}–{end} of {total} |
| Incorporated toast | Incorporated {segment} report by {agent}. Benchmark refresh queued. |
| Incorporated toast (two-person) | Incorporation request created. Awaiting second approver. |
| Signal-only toast | Published {segment} report by {agent} as signal-only. |
| Rejected toast | Rejected {segment} report — {reason}. |
| Request-info toast | Requested info on {segment} report. |
| Signal-only bulk toast | Published {N} reports as signal-only. |
| Rejected bulk toast | Rejected {N} reports. |
| Undo toast link | Undo |
| Own-report block | You can't act on this row — you are the submitting agent. |
| Step-up prompt template | Confirm your identity to {action} this {tier}-risk report. |

Arabic strings: `[TRANSLATION-PENDING]` per family policy.

---

## Component palette

Same primitive set as PA-MOD-001 with these adjustments:

| Element | Primitive |
|---|---|
| Delta chip | Custom small `<Badge>` — 3 variants (above / below / in-band) with arrow glyph prefix |
| Composite risk cell | Two stacked `<Badge>` — tenure tier + delta tier |
| Agent tier chip | `<Badge>` — Pro (`--lc-surface-sunken` + `--lc-text-heading`) or Pro Elite (`--lc-accent-bold-{bg,fg}` + `--lc-accent-bold-edge` boundary) |
| Recommendation cell | Currency prefix `<span>` + `<Numeric>` price + delta chip below |
| Sources cell | Two `<Numeric>` runs joined by "·" |
| Segment cell | Segment label `var(--lc-type-body)` + "N comparable listings" `var(--lc-type-caption)` `var(--lc-text-muted)` + flag emoji + ISO |
| Incorporate confirm | `AlertDialog` (single-row) — high-delta variant renders the second-approver warning inline |
| Signal-only confirm | `AlertDialog` (single-row) — count-confirm variant for bulk |
| Reject / Request info modal | `Dialog` (Select for reason + Textarea for notes) |
| Bulk incorporate blocked | Info tooltip on disabled button + hidden from bulk bar entirely |

All other primitives (tabs, selects, table, checkbox, avatar, bulk bar, pagination, `?` sheet, `<Numeric>`, toasts, step-up embed) inherit from PA-MOD-001 unchanged.

---

## Sample content (for v0 / mockup)

Desktop 1440px, LIVE env, Pending tab active (counter 7), subtitle "7 pending · 3 high-delta (≥10%) · 12 incorporated · 21 signal-only · 4 rejected this month". Sort by `|delta| desc`.

Sample rows (all Pending):
1. Submitted "2h ago" · **Sara Al Mansouri** / Elite Real Estate Dubai · Pro Elite · 5y 2mo · **Dubai Marina · 2-3BR apartments** *18 comparable listings · 🇦🇪 AE* · **AED 1,850,000** *▲ +18.4% above benchmark* · **12 comps · 5 files** · Risk: Tenure Low · Delta High · Pending review
2. Submitted "5h ago" · **Mohammed Al Rashid** / Riyadh Off-Plan Partners · Pro · 1y 8mo · **North Riyadh · Off-plan towers** *9 comparable listings · 🇸🇦 SA* · **SAR 3,200,000** *▲ +12.1% above benchmark* · **8 comps · 3 files** · Risk: Tenure Medium · Delta High · Pending review
3. Submitted "8h ago" · **Layla Georges** / Beirut Homes · Pro · 3y 1mo · **Ashrafieh · 2BR apartments** *14 comparable listings · 🇱🇧 LB* · **USD 285,000** *▼ −11.2% below benchmark* · **11 comps · 4 files** · Risk: Tenure Low · Delta High · Pending review
4. Submitted "1d ago" · **Ahmed Khan** / Abu Dhabi Prime · Pro Elite · 4y 6mo · **Saadiyat Island · Villas** *6 comparable listings · 🇦🇪 AE* · **AED 12,400,000** *▲ +7.2% above benchmark* · **7 comps · 2 files** · Risk: Tenure Low · Delta Medium · Pending review
5. Submitted "1d ago" · **Fatima Suleiman** / Muscat Waterfront · Pro · 2y 3mo · **Muscat Hills · Townhouses** *4 comparable listings · 🇴🇲 OM* · **OMR 285,000** *~ ±3.1% in band* · **5 comps · 2 files** · Risk: Tenure Low · Delta Low · Pending review
6. Submitted "2d ago" · **Noura Al Amri** / Sharjah Coastal Realty · Pro · 4mo · **Al Majaz · Studios** *22 comparable listings · 🇦🇪 AE* · **AED 620,000** *~ ±1.8% in band* · **9 comps · 3 files** · Risk: Tenure Medium · Delta Low · Pending review
7. Submitted "3d ago" · **Youssef Tarek** / New Cairo Properties · Pro · 2y 9mo · **5th Settlement · Duplexes** *11 comparable listings · 🇪🇬 EG* · **EGP 8,500,000** *▼ −4.2% below benchmark* · **6 comps · 2 files** · Risk: Tenure Low · Delta Low · Pending review

Row 1 in hover state: all 5 row-action buttons visible (Incorporate primary-orange outline, Signal only, Reject, Request info, Open).

Pagination: "1–7 of 7" · Rows per page 25.

Side variants to render as separate v0 iterations:
- **Bulk selection:** rows 5, 6, 7 checked (all Delta Low + Tenure Low/Medium). Bulk bar: "3 selected · 3 across 3 segments · 0 High-risk composite · Clear selection" left; `Signal only 3` / `Reject 3` / `Request info 3` right. Info-glyph next to bulk bar with hover tooltip about incorporate.
- **Incorporate confirm — high-delta variant:** dialog over row 1, showing the two-person notice.
- **Empty state:** Pending tab 0 rows.
- **TEST env with warning strip.**

Do NOT fabricate benchmark values, agent rating scores, or delta computations not returned by the backend. Every field maps to a §Backend contract attribute.

---

## Interactions

**Page load / env-switch / status-tab change / filter change / search / row hover / row click / lint hover / row-select / select-all / keyboard shortcut / Export CSV / env-change-confirmation** — identical to PA-MOD-001 §Interactions. See anchor.

**Inline Incorporate (Pending row, hover):**
- Own-report guard first (server returns `is_own=true` → button disabled + tooltip).
- If composite risk = High: step-up (SHR-MFA-007) required. On success proceed.
- If `|delta| ≥ 10%`: two-person rule triggers — the confirm modal renders the "second approver required" variant, and on Confirm the request is filed to `fin.approval_requests` (Pending on second approver) instead of committing immediately. Row status swaps to `pending_second_approval` badge (`--lc-status-warning` ▲); toast "Incorporation request created. Awaiting second approver."
- If `|delta| < 10%` and permissions OK: modal shows standard incorporate body. On Confirm, fire `POST /api/admin/pricing/agent-price-reports/:id/review` with `{ status: 'verified', incorporate: true, notes }`. Optimistic row → `incorporated` badge. Toast "Incorporated {segment} report by {agent}. Benchmark refresh queued." with `Undo` (5s).
- On grace expiry: server commits benchmark-refresh worker enqueue. On Undo: fire `POST .../undo-review` (see [BE-DESIGN-PVA09-04]) which reverts status + rolls back benchmark write if it happened.

**Inline Signal only (Pending row):**
- Own-report + step-up if High-risk composite (same gate as Incorporate).
- Confirm modal (single-row body).
- On Confirm: `POST .../review` with `{ status: 'verified', incorporate: false, notes }`. Row → `verified` badge. Toast + Undo grace.

**Inline Reject:**
- Own-report guard.
- Step-up if High-risk composite.
- Reject modal (Select reason + Textarea notes required ≥5 chars).
- On Confirm: `POST .../review` with `{ status: 'rejected', reason_code, notes }`. Row → `rejected`. Toast + Undo.

**Inline Request info:**
- Modal (Select reason + Textarea notes ≥5 chars).
- On Confirm: `POST .../review` with `{ status: 'request_info', reason_code, notes }`. Row → `request_info`. Agent sees on `AGT-REC-003` + can resubmit which re-enters Pending.

**Bulk Signal only:**
- Own-report rows silently excluded server-side.
- AlertDialog per §Explicit copy. Step-up if any High-risk composite in selection OR count > 5.
- `POST /api/admin/pricing/agent-price-reports/bulk-review` with `{ ids: [...], status: 'verified', incorporate: false }`. Commits immediately (family invariant — no Undo on bulk).
- Toast + failure-drawer on 207 partial.

**Bulk Reject / Request info:** same as PA-MOD-001 with WF-06 reason vocabs.

**Bulk Incorporate:** blocked — button absent, info-glyph tooltip explains why.

---

## State variants

All 24 state variants from PA-MOD-001 apply verbatim. WF-06-specific additions:

| Variant | Trigger | Behavior |
|---|---|---|
| **Pending second approval** | Incorporate confirmed on high-delta row | Row status `pending_second_approval` badge; only `Open` action available for the initiator; second PA sees the two-person request in PA-APR-001 queue. |
| **Second approval — approved** | Second PA approves via PA-APR-002 | Row updates to `incorporated`; benchmark-refresh worker enqueues; initiator + second approver both audited. |
| **Second approval — declined** | Second PA declines | Row reverts to `pending_review` with `request_info`-style note surfaced to initiator PA. |
| **Bulk incorporate attempted (via keyboard)** | User presses `A` after multi-select | Toast (assertive) "Incorporate must be reviewed one report at a time." No state change. |
| **Delta cell — computation stale** | Backend returns `benchmark_delta_stale=true` | Delta chip renders with a small clock-glyph + tooltip "Benchmark last computed {T} ago. Refresh queued." — sort still uses cached delta. |
| **Segment facet empty** | Backend returns no active segments | Segment Select shows "No active segments" + typeahead-only mode. |

---

## Accessibility

Inherit PA-MOD-001 §Accessibility verbatim. WF-06-specific additions:

- Delta chip announces direction + magnitude + benchmark reference ("above benchmark by eighteen point four percent").
- Composite risk cell announces both signals with which drove the tier ("High risk composite; delta drives tier; tenure is Low").
- Incorporate confirm modal has `aria-describedby` pointing at the body copy so SR reads the benchmark-impact warning before the confirm button gets focus.
- Bulk-bar disabled Incorporate button is not present — the info glyph is a `<button>` with `aria-label="Why can't I bulk-incorporate?"` opening a Popover with the explanation.

---

## Anti-patterns

All PA-MOD-001 anti-patterns apply. WF-06 additions:

- Do NOT enable bulk Incorporate in v1. Every incorporate is a per-row deliberate decision.
- Do NOT paint delta color-alone. Always arrow-glyph + signed % + "above/below/in band" label.
- Do NOT hide the delta magnitude for High-risk rows — the number IS the signal.
- Do NOT auto-approve any row based on tenure or tier. Pro Elite + 5y tenure is not a green light.
- Do NOT collapse the composite-risk cell to a single badge. PA needs to see which signal drove the tier.
- Do NOT surface the benchmark value directly in the queue — it's the delta that matters at the row level; the raw benchmark comparison lives in `PA-PVA-009b` detail.
- Do NOT allow Undo on bulk (family invariant).
- Do NOT co-mingle LIVE and TEST reports.
- Do NOT let PA incorporate their own report. Server enforces `is_own=true` block; UI disables the button.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Stripe Radar reviews queue** — decision quality over speed; per-row rich context.
- **PA-MOD-001 (this codebase)** — direct family predecessor; shell + filters + bulk + keyboard nav + undo grace inherited unchanged.
- **PA-PVA-008 (sibling brief, when authored)** — same shell, different report shape.
- **GitHub review-changes-requested state** — the Request-info pattern maps 1:1.

Do NOT match: Salesforce case queue, kanban boards, Gmail Priority Inbox (see PA-MOD-001 anti-references).

---

## Backend contract

**List endpoint:** `GET /api/admin/pricing/agent-price-reports` (existing, needs extension).

**Current state:** Returns raw `agent_price_reports` records sorted by `created_at desc`. No pagination, no filters, no joined agent/tenure/delta data.

**Required extensions ([BE-DESIGN-PVA09-01]):**
- Query params: `status`, `country`, `segment`, `delta` (bucket), `tier`, `within`, `q`, `page`, `pageSize` (default 25, max 100), `sort` (`delta_abs:desc` default | `submitted_at:desc` | `submitted_at:asc` | `tenure:desc`).
- Server-side join to agent (name, avatar, tier), agency (name, tenant link), tenure-risk service ([BE-DESIGN-02], shared with PA-MOD-001), and benchmark-delta service ([BE-DESIGN-PVA09-02]).
- Env-scoped via `X-Wingcaster-Env` header.
- Returns pagination metadata + counts block (pending, pending_high_delta, incorporated_this_month, signal_only_this_month, rejected_this_month).

**Response 200 (target shape):**
```json
{
  "reports": [
    {
      "id": "aprt_abc123",
      "submitted_at": "2026-09-08T10:04:11Z",
      "agent": { "id": "usr_xyz789", "display_name": "Sara Al Mansouri", "avatar_url": "…", "tier": "pro_elite", "tenure_days": 1888 },
      "agency": { "id": "agy_dubai_elite", "name": "Elite Real Estate Dubai", "tenant_url": "/admin/tenants/agy_dubai_elite" },
      "subject": {
        "segment_label": "Dubai Marina · 2-3BR apartments",
        "segment_id": "seg_dxb_marina_apt_23br",
        "country_code": "AE",
        "country_flag_emoji": "🇦🇪",
        "comparable_listings_count": 18
      },
      "recommendation": {
        "price_low": 1750000, "price_high": 1950000, "price_point": 1850000,
        "currency": "AED"
      },
      "benchmark_delta": {
        "benchmark_price_point": 1562500, "benchmark_currency": "AED",
        "delta_pct": 18.4, "delta_direction": "above",
        "delta_tier": "high", "benchmark_computed_at": "2026-09-08T09:00:00Z", "stale": false
      },
      "sources": { "comparable_count": 12, "evidence_file_count": 5 },
      "tenure_risk": { "tier": "low", "score": 0.09, "signals": ["agency_age_days:1240", "prior_rejection_ratio:0.01"] },
      "composite_risk_tier": "high",
      "status": "pending_review",
      "review": null,
      "is_own": false,
      "step_up_required": true,
      "two_person_required": true,
      "env": "live"
    }
  ],
  "pagination": { "page": 1, "page_size": 25, "total": 7, "has_next": false },
  "counts": { "pending": 7, "pending_high_delta": 3, "incorporated_this_month": 12, "signal_only_this_month": 21, "rejected_this_month": 4 }
}
```

**Single action:** `POST /api/admin/pricing/agent-price-reports/:id/review` (existing, needs extension).

Current body: `{ status: 'verified' | 'rejected', notes }`.

**Required extensions ([BE-DESIGN-PVA09-01]):**
- Accept `status ∈ { 'verified', 'rejected', 'request_info' }` (add `request_info`).
- Accept `incorporate: boolean` when `status = 'verified'`. When true AND `|delta| < 10%`: write benchmark signal immediately + enqueue benchmark-refresh worker. When true AND `|delta| ≥ 10%`: create `fin.approval_requests` row instead of committing; return `{ pending_second_approval: true, request_id }`.
- Accept `reason_code` when `status ∈ { 'rejected', 'request_info' }`.
- 401 `STEP_UP_REQUIRED` → client fires SHR-MFA-007 + retries.
- 403 `OWN_REPORT` when the reviewing PA is the submitting agent.

**Bulk action ([BE-DESIGN-PVA09-05]):** `POST /api/admin/pricing/agent-price-reports/bulk-review` — accepts `{ ids, status, incorporate: false, reason_code?, notes? }`. `incorporate: true` rejected with 400 (bulk incorporate disallowed).

**CSV export:** `GET /api/admin/pricing/agent-price-reports.csv?<same-query>` — columns `report_id, submitted_at, agent, agency, tier, tenure_days, segment, country, recommendation, currency, benchmark, delta_pct, composite_risk, status, decided_at, decided_by, decision_reason, decision_notes`.

**Undo:** `POST /api/admin/pricing/agent-price-reports/:id/undo-review` ([BE-DESIGN-PVA09-04]) — 5-second single-row grace; rolls back status + benchmark write if incorporate happened.

**Prerequisites to file in kickoff §5a:**
- `[BE-DESIGN-PVA09-01]` list + review endpoint extensions (pagination, filters, joined payload, `request_info` + `incorporate` modes). ~3-4 days.
- `[BE-DESIGN-PVA09-02]` benchmark-delta computation service (per-segment benchmark price + delta computation per report on read). ~3 days.
- `[BE-DESIGN-PVA09-03]` two-person rule wiring — file `fin.approval_requests` for high-delta incorporate; second approver's approval triggers the benchmark write. ~2 days.
- `[BE-DESIGN-PVA09-04]` undo-review endpoint. ~1 day.
- `[BE-DESIGN-PVA09-05]` bulk-review endpoint (verified + rejected + request-info; incorporate disallowed). ~1 day.
- `[BE-DESIGN-02]` tenure-risk scoring — SHARED with PA-MOD-001.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/valuation/AgentPriceReportQueuePage.tsx`.
- **Route registration:** `web/src/App.tsx` — add behind `PAConsoleGuard` with `pricing-admin` capability pack.
- **Reuse the PA queue-family components from PA-MOD-001:** `PAQueueFilterStrip`, `PAQueueTable`, `PAQueueBulkBar`, `PAQueueBulkReasonDialog`, `PAQueueKeyboardShortcutsPanel`. Extend `PAQueueBulkBar` with a `blockedActions` prop for the "Incorporate blocked" info glyph.
- **New per-screen components:**
  - `AgentPriceReportRow.tsx` — the row-composition slot for the reusable `PAQueueTable`.
  - `PriceReportDeltaChip.tsx` — 3-variant delta chip.
  - `PriceReportCompositeRiskCell.tsx` — stacked tenure + delta badges.
  - `PriceReportIncorporateDialog.tsx` — AlertDialog with high-delta variant.
  - `PriceReportSignalOnlyDialog.tsx` — AlertDialog with count-confirm variant for bulk.
- **Top-nav entry:** update PA top nav to add "Valuation → Price reports" with pending-count badge.
- **Data layer:**
  - `useAgentPriceReportQuery({ status, country, segment, delta, tier, within, q, page, pageSize, sort, env })`.
  - `usePriceReportReview()` mutation with optimistic update + undo queue.
  - `useMarketSegmentFacet()` for segment filter Select.
- **Test discipline:** same shape as PA-MOD-001 tests + WF-06-specific paths — incorporate → benchmark-refresh mock, high-delta → two-person approval-request creation, bulk-incorporate → blocked-button assertion, undo-review → benchmark-write rollback.
- **Copy/i18n:** `web/src/locales/en/paPriceReports.json` + `ar/paPriceReports.json`.

---

## Broadcast alignment callouts (WF-06 deltas)

All PA-MOD-001 callouts apply verbatim. Additions:

- Delta chip variants:
  - Above: `background: var(--lc-status-warning-bg)`, `color: var(--lc-status-warning-fg)`, `border-radius: var(--lc-radius-pill)`, glyph `▲`.
  - Below: `background: var(--lc-accent-bold-bg)` (teal), `color: var(--lc-accent-bold-fg)`, `border: 1px solid var(--lc-accent-bold-edge)` (mandatory boundary per Broadcast rule), glyph `▼`.
  - In-band: `background: var(--lc-status-published-bg)`, `color: var(--lc-status-published-fg)`, glyph `~`.
- Agent tier chip:
  - Pro: `background: var(--lc-surface-sunken)`, `color: var(--lc-text-heading)`, `border: 1px solid var(--lc-border)`.
  - Pro Elite: `background: var(--lc-accent-bold-bg)`, `color: var(--lc-accent-bold-fg)`, `border: 1px solid var(--lc-accent-bold-edge)`.
- Incorporate confirm button: `<Button variant="default">` (primary orange fill) with `--lc-action-primary` hover DARKER.
- Signal-only confirm button: `<Button variant="secondary">` (`--lc-action-secondary` fill).
- Row action buttons: Incorporate outline `--lc-action-primary`; Signal only outline `--lc-border-strong`; Reject outline `--lc-border-strong`; Request info outline `--lc-status-warning`; Open outline `--lc-border`.
- All numeric prices in `--lc-font-mono` + `tabular-nums` via `<Numeric>`; currency prefix in UI font.
- Radii, elevation, focus rings, motion — inherited from PA-MOD-001 unchanged.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin agent-price-report review queue (PA-PVA-009) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is where a Platform Admin reviews Pro-tier agents' considered price-analysis reports on market segments (WF-06 approver-side). Same shell + filters + bulk bar + keyboard nav + undo grace as PA-MOD-001 (the family anchor); WF-06 deltas are the column set (subject-segment / recommendation + benchmark-delta / sources / composite tenure+delta risk) and a 4-way decision vocab (Incorporate / Signal only / Reject / Request info) — with bulk Incorporate DISALLOWED.

Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass: render the desktop 1440px layout with the LIVE env badge in top bar (green), Pending review tab active (counter 7), sort by |delta| desc, 7 sample rows (see brief §Sample content). Row 1 in hover state showing all 5 row-action buttons on the right. Bulk-action bar hidden. Pagination footer "1–7 of 7".

LTR English only for this pass — RTL Arabic, dark mode, TEST env, bulk-selection, empty state, incorporate confirm dialog, signal-only bulk dialog, reject dialog as separate iterations.

Follow the copy table exactly. Do NOT fabricate benchmark values, agent rating scores, or delta computations. Every field maps to a defined backend attribute.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Bulk selection: rows 5, 6, 7 checked. Bulk bar visible with "3 selected · 3 across 3 segments · 0 High-risk composite · Clear selection" left; Signal only 3 / Reject 3 / Request info 3 right. Info glyph next to bulk bar. NO Incorporate button.`
2. `Incorporate confirm dialog open over row 1 (high-delta variant with second-approver notice).`
3. `Signal-only bulk confirm dialog open over the bulk-selection state.`
4. `Reject dialog open — Reason Select shown (Thesis not supported by comps highlighted), Notes textarea empty, Confirm disabled.`
5. `TEST env with amber warning strip.`
6. `Empty state — Pending tab 0 rows.`
7. `Verified tab active, 5 sample rows in verified/incorporated mix. Row actions show Open only.`
8. `Keyboard-shortcuts drawer open with WF-06 mapping (A incorporate, S signal-only, R reject, I request info).`
9. `RTL Arabic at desktop 1440px, [TRANSLATION-PENDING] placeholders, MIRROR layout.`
10. `Dark mode version of pass 1.`

Save outputs under `docs/design/mockups/v0-outputs/PA-PVA-009/` + screenshots at `docs/design/mockups/PA-PVA-009-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 produced all 10 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-PVA-009/`.
- [ ] Cursor Wave-5 dispatch prompt references this brief + PA-PVA-009b + PA-MOD-001 anchor.
- [ ] `[BE-DESIGN-PVA09-01..05]` filed in kickoff §5a.
- [ ] `[BE-DESIGN-02]` (tenure-risk) confirmed shared with PA-MOD-001.
- [ ] Reused component names (`PAQueueFilterStrip`, `PAQueueTable`, `PAQueueBulkBar`, `PAQueueBulkReasonDialog`, `PAQueueKeyboardShortcutsPanel`) confirmed intact; `blockedActions` prop extension on `PAQueueBulkBar` reviewed.
- [ ] Delta brief `PA-PVA-009b-agent-price-report-detail-brief.md` referenced from Wave-5 dispatch.
