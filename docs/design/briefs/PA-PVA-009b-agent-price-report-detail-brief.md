# Screen Brief — PA-PVA-009b · Agent-price-report review detail (WF-06 approver-side)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Detail companion to `PA-PVA-009-agent-price-report-queue-brief.md` (the queue). Inherits Broadcast alignment + PA console shell + env-badge behavior + step-up + two-person + audit + keyboard-nav discipline from `PA-MOD-001` (family anchor) and its detail sibling `PA-MOD-002` (approval-detail pattern). This brief captures only the WF-06 detail deltas: full-report reader layout, benchmark-comparison chart, cited-evidence panel, 4-way decision panel (Incorporate / Signal only / Reject / Request info), and two-person handling for high-delta incorporate.

Wave 5 (Week 5 — WF-06 cluster) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 6 §5 rows 45-46 + §6 Week 5. Pairs with `PA-PVA-009` queue + `AGT-APR-005` (submit) + `AGT-APR-006` (my list) + `AGT-REC-003` (outcome).

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`** AND **from `PA-MOD-001-portal-moderation-queue-brief.md` §Broadcast alignment** (PA queue-family anchor). All 7 PA queue-family invariants (env badge always visible, two-person rule for high-delta incorporate, step-up for high-risk, immutable audit, keyboard-first, undo grace on single-row decisions) apply verbatim.

**Screen-specific Broadcast callouts (detail-view specific):**

- **Two-pane layout.** Left pane (60% width, min 720px) = report reader (structured fields + free-form analysis + agent-cited comparables + evidence file list). Right pane (40% width, sticky, min 480px) = benchmark comparison chart + decision panel. Panes separated by `border-left: 1px solid var(--lc-border)`. Panes scroll independently; decision panel stays visible.
- **Sticky sub-header** under the SHR-NAV-001 top bar + PA-NAV-001 env badge + optional TEST warning strip. Contains: back-link `← Price reports queue` (returns to `return_to` if present else `/admin/valuation/price-reports`), report-title breadcrumb (`{agent name} · {segment label}`), current status pill, submitted-at + submitting-agent chip. Height 64px; `background: var(--lc-surface-raised)`; `border-bottom: 1px solid var(--lc-border)`.
- **Report-reader typography.** Section titles `var(--lc-type-heading-3)`; structured-field labels `var(--lc-type-overline)` `var(--lc-text-muted)`; field values `var(--lc-type-body)`; free-form analysis body `var(--lc-type-body-lg)` (16/24) with `max-width: 65ch` for readability; block quotes `border-left: 3px solid var(--lc-accent-bold-edge)` + `padding-inline-start: var(--lc-space-md)`.
- **Comparable-listings table (inside left pane).** Compact `<Table>` — address · price · $/sqft · beds/baths · listing_status · portal source + external link. Each row's price + $/sqft in `<Numeric>` with `tabular-nums`. Row hover reveals `Open in Bazaar` external-link icon.
- **Evidence file list.** Vertical stack of `<Card>` blocks — file name + type icon (PDF / image / spreadsheet) + size + `View` button (opens in new tab with signed URL). Attachments render inline preview for images (max 200px thumb) and PDF (first-page preview via `<embed>` with fallback to icon).
- **Benchmark comparison chart (right pane).** SVG chart component (see §Component palette). X-axis = time (last 90 days of benchmark snapshots); Y-axis = price. Renders benchmark line in `var(--lc-text-muted)` + confidence band (±10% shaded `var(--lc-surface-sunken)`) + agent's recommendation point (large `●` in `var(--lc-action-primary)` at submission-date). If incorporated, adds a second dashed line from submission-date forward showing projected benchmark post-incorporation. Chart height 240px, full pane width.
- **Delta callout block (above chart).** Prominent numeric readout: agent's recommendation vs current benchmark. Two columns of `<Numeric>` prices with currency prefix, delta chip below (same 3-variant styling as queue). Composite risk badge (Tenure + Delta) stacked to the right.
- **Decision panel (below chart, sticky bottom of right pane).** Card with `background: var(--lc-surface-sunken)`, `border: 1px solid var(--lc-border)`, `border-radius: var(--lc-radius-lg)`, `padding: var(--lc-space-lg)`. Contains 4 stacked action buttons top-to-bottom:
  1. `Incorporate into benchmark` — `<Button variant="default">` (primary orange fill) — with high-delta warning inline if `|delta| ≥ 10%`.
  2. `Approve as signal only` — `<Button variant="secondary">`.
  3. `Reject with reason` — `<Button variant="outline">`.
  4. `Request more info` — `<Button variant="outline">`.
  On Pending status: all 4 visible. On any decided status: panel collapses to a summary card showing decision + decider + timestamp + reason/notes + `Reopen` button (elevated PAs only, per policy).
- **Two-person banner (conditional, appears above decision panel when `two_person_required` and PA is initiator).** Amber banner `--lc-status-warning-bg` + `⚠` glyph + copy: "Incorporating this report writes to the pricing benchmark. Because the delta is {X}%, a second approver is required — your decision will create a pending approval request assigned to the on-call PA."
- **Second-approver mode.** When the current PA is a designated second approver (arriving from PA-APR-002 route with `?approval_request_id=...`), the decision panel replaces the 4-way with a 2-way Approve/Decline pair specific to the pending approval request, and a banner at top identifies the initiator PA + their proposed decision.
- **Audit trail sub-panel (below decision panel).** Timeline of prior actions on this report: submitted → any request_info roundtrips → decisions. Each entry: actor avatar + name + action verb + timestamp + reason chip. Font `var(--lc-type-body-sm)`; timestamps `<Numeric>` monospace.
- **Environment badge.** Honors PA-NAV-001 exactly per family anchor. Env-scoped fetch: LIVE reports never surface in TEST detail route and vice-versa; server 404s on cross-env access.

---

## Meta

| | |
|---|---|
| Screen ID | PA-PVA-009b |
| Screen name | Agent-price-report review detail |
| Persona | PA (Platform Admin — elevated for incorporate on high-delta; blocked when `is_own=true`) |
| Device targets | Desktop 1440px ONLY (family invariant; <1024px fallback info block) |
| Locale | English + Arabic (RTL). `[TRANSLATION-PENDING]` for AR in v1. |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/admin/valuation/price-reports/:reportId` (query params: `?return_to=<queue-url>`, `?approval_request_id=<id>` when arriving as second approver) |
| Current state | **PARTIAL.** Backend list route `GET /api/admin/pricing/agent-price-reports` returns records that include the raw report body; no dedicated single-item detail route exists. Review route `POST /api/admin/pricing/agent-price-reports/:id/review` exists and accepts `{ status: 'verified'\|'rejected', notes }`. Needs extensions listed in `PA-PVA-009` §Backend contract. Frontend does NOT exist. |
| Workflow role | WF-06 role = Approval detail (agent-submitted price analysis) |
| Backend prerequisites | ✅ review route exists (needs extension per PA-PVA-009) · ⏳ `[BE-DESIGN-PVA09-06]` per-item detail route `GET /api/admin/pricing/agent-price-reports/:id` returning full report body + comparables + evidence URLs + audit trail + benchmark chart data — NEW · ⏳ `[BE-DESIGN-PVA09-07]` benchmark-snapshot series for chart (last 90 days) — NEW · ⏳ `[BE-DESIGN-PVA09-03]` two-person rule wiring via `fin.approval_requests` (shared with PA-PVA-009) · ⏳ signed-URL vending for evidence files · ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context · ✅ PA-AUD-001 audit sink |
| Cluster | Wave 5 (Week 5 — WF-06) alongside PA-PVA-009 (queue), AGT-APR-005 (submit), AGT-APR-006 (my list), AGT-REC-003 (outcome) |
| Sibling brief | `PA-PVA-008b` (comparable-report review detail) — same two-pane shape, different report body + no benchmark-write side effect |

---

## Purpose

One agent-price-report shown for review, with all evidence the agent submitted visible in one place plus WingCaster's current benchmark for context — so the PA can make a defensible decision to (a) incorporate into benchmark, (b) approve as signal only, (c) reject with reason, or (d) request more info.

This screen is the **decision surface** for WF-06. The queue (`PA-PVA-009`) surfaces the row and inline decisions are possible there for low-friction cases, but any decision requiring the full report body + evidence review happens here. Two-person incorporation for `|delta| ≥ 10%` starts here: the initiator PA's confirm creates a `fin.approval_requests` entry; the second approver reviews on `PA-APR-002` (generic approval detail) with a link back to this screen with `?approval_request_id=…` to render the second-approver mode.

Success outcome: PA reads the full report, cross-references cited comparables + evidence against WingCaster's benchmark chart, picks the correct 4-way decision, and either commits (single-approver path) or files an approval request (two-person path). Every action writes to the immutable audit trail (PA-AUD-001) with actor + timestamp + reason + notes.

---

## Design goals

1. **Read the report before deciding.** The layout forces the PA's eye to the report body first (left pane), the benchmark comparison second (right pane, above the decision panel), and the decision panel last. No decision buttons above the fold.
2. **Every evidence artifact is one click away.** Comparables inline as a table; evidence files as previewable cards; portal-source external links open in new tabs with `rel="noopener noreferrer"`. No hidden accordions.
3. **Benchmark comparison is a chart, not a number.** A time-series chart (last 90 days) gives PA the shape of the segment's benchmark, not just the current point. The agent's recommendation lands on the chart as a large dot so PA sees the visual delta.
4. **Two-person rule is legible before committing.** The high-delta warning banner appears above the decision panel, not inside a modal after clicking. PA sees the two-person requirement while reading, not as an interruption.
5. **Second-approver mode is a different UI.** When arriving with `?approval_request_id=…`, the decision panel becomes a 2-way Approve/Decline specific to the pending request, and the initiator's proposed decision is called out. This prevents accidental "approve a different way" mistakes.
6. **Audit trail is always visible.** Below the decision panel, not on a separate tab. PA never has to hunt for prior context.
7. **Family-pattern coherence.** Sticky sub-header + env badge + step-up modal + keyboard nav match PA-MOD-002 exactly.
8. **Never color-only.** Every delta chip, status pill, tenure/delta badge, decision-panel highlight is tint + glyph + label.

---

## Layout

### Desktop 1440px (only target)

**PA-NAV-001 warning strip** — identical to family (env=TEST → sticky under top bar).

**Sticky sub-header (64px):**
- Left: `← Price reports queue` back-link + breadcrumb `{agent name} · {segment label}` (`var(--lc-type-body)`).
- Center: status pill (`<Badge>` per queue vocabulary — pending_review / verified / incorporated / rejected / request_info / expired / pending_second_approval).
- Right: submitted-at + submitting-agent avatar chip + `?` keyboard-hints icon.

**Two-pane content (below sub-header, `padding-inline: var(--lc-space-2xl)`, `padding-block: var(--lc-space-xl)`):**

**LEFT PANE (60%, min 720px) — Report reader:**

1. **Subject header block** (top of pane, 200px card):
   - Segment label (`var(--lc-type-heading-2)`).
   - Country flag + ISO (`var(--lc-type-body)`).
   - Property type + bedroom range + comparable-listings count (`var(--lc-type-body-sm)` `var(--lc-text-muted)`).
   - Small agent tenure + tier chip inline.

2. **Structured fields section** (`<h2>` "Report parameters" `var(--lc-type-heading-3)`):
   - 2-column grid of label/value pairs — Segment definition · Property type · Bedroom range · Time window analyzed · Analysis basis (transaction data / active listings / mix) · Recommendation type (price point / band).
   - Recommendation callout: currency-prefixed `<Numeric>` price low / point / high (per report structure).

3. **Free-form analysis section** (`<h2>` "Agent's analysis"):
   - Rich-text render (Markdown / prosemirror JSON) of the agent's thesis. `var(--lc-type-body-lg)`, `max-width: 65ch`.
   - Block quotes, lists, headings preserved. External links open in new tab with `rel="noopener noreferrer"`.

4. **Cited comparables section** (`<h2>` "Cited comparables · {N}"):
   - Compact `<Table>` — Address · Price · $/sqft · Beds · Baths · Status · Source portal + link icon.
   - Sort options: price / recency / $/sqft.
   - Empty state: "No comparables cited" muted line.

5. **Evidence attachments section** (`<h2>` "Attached evidence · {N}"):
   - Vertical `<Card>` stack, one per file. Card contents: file-type icon + filename + size + upload timestamp + `View` button.
   - Image files: inline 200px thumb (lazy-loaded).
   - PDFs: first-page preview embed (fallback icon if browser blocks).
   - Empty state: "No evidence files attached" muted line + amber warning glyph.

**RIGHT PANE (40%, min 480px, sticky):**

1. **Delta callout block** (top card, `background: var(--lc-surface-sunken)`, `padding: var(--lc-space-lg)`):
   - Two columns of currency-prefixed `<Numeric>` prices: "Agent's recommendation" / "Current benchmark".
   - Delta chip below (3-variant per queue styling).
   - Composite risk badge stacked to the right (Tenure + Delta).
   - "Benchmark last computed <Numeric>3h</Numeric> ago" `var(--lc-type-caption)` `var(--lc-text-muted)`.

2. **Benchmark comparison chart** (below callout, 240px height):
   - SVG line chart, last 90 days benchmark price + confidence band + agent's recommendation dot.
   - X-axis: date ticks every 15 days. Y-axis: price with currency prefix.
   - Legend: benchmark line, confidence band, agent's recommendation, projected post-incorporation (dashed).
   - Hover on any date: `<Tooltip>` shows exact benchmark value + delta from agent's recommendation.
   - Empty state (no snapshots yet for this segment): placeholder message "Benchmark series not yet available for this segment. Consider Signal only for the first incorporation."

3. **Two-person banner** (conditional — `two_person_required=true` AND current PA is initiator):
   - `background: var(--lc-status-warning-bg)`, `color: var(--lc-status-warning-fg)`, `padding: var(--lc-space-md)`, `border-radius: var(--lc-radius-md)`.
   - Glyph `⚠` + copy per §Explicit copy.

4. **Decision panel** (sticky bottom-of-pane, expands to fit):
   - Card with `background: var(--lc-surface-raised)`, `border: 1px solid var(--lc-border)`, `padding: var(--lc-space-lg)`.
   - **Pending status:** 4 buttons stacked, top-to-bottom:
     - `Incorporate into benchmark` — primary orange, high-delta subtext if applicable.
     - `Approve as signal only` — secondary.
     - `Reject with reason` — outline, `X` icon prefix.
     - `Request more info` — outline, `MessageCircle` icon prefix.
   - **Decided status:** summary card with decision verb + decider name + timestamp + reason chip + notes excerpt + `Reopen` button (only if `elevated_actions_policy` permits).
   - **Pending second approval status:** message "Awaiting second approver ({name})" + link to the `fin.approval_requests` detail on PA-APR-002.
   - **Second-approver mode** (`?approval_request_id=...` present, current PA is not initiator, request is pending):
     - Header banner "Second-approver review" `background: var(--lc-accent-bold-bg)`.
     - Initiator info: "{Initiator PA} proposed: **Incorporate into benchmark**" + their notes.
     - 2 buttons: `Approve request` (primary) / `Decline request` (outline).

5. **Audit trail sub-panel** (below decision panel, may need to scroll):
   - Vertical timeline. Each entry: avatar + name + action verb + relative timestamp + reason chip.
   - Font `var(--lc-type-body-sm)`; timestamps in `<Numeric>` mono.
   - Empty for reports still pending initial decision (only the submission entry).

### Below-min-viewport fallback (<1024px)

Same info block as family: "PA console requires a desktop screen (1024px or wider)."

---

## Explicit copy (English)

| Slot | Copy |
|---|---|
| Back-link | ← Price reports queue |
| Breadcrumb template | {agent} · {segment} |
| Status pill labels | Pending review · Verified · Incorporated · Rejected · Request info · Expired · Pending second approval |
| Section — parameters | Report parameters |
| Section — analysis | Agent's analysis |
| Section — comparables template | Cited comparables · {N} |
| Section — evidence template | Attached evidence · {N} |
| Field — segment | Segment definition |
| Field — property type | Property type |
| Field — bedroom range | Bedroom range |
| Field — time window | Time window analyzed |
| Field — analysis basis | Analysis basis |
| Field — recommendation type | Recommendation type |
| Field — recommendation | Recommendation |
| Empty comparables | No comparables cited |
| Empty evidence | No evidence files attached — ask for evidence before incorporating |
| Evidence view button | View |
| Comparables — column address | Address |
| Comparables — column price | Price |
| Comparables — column psqft | $/sqft |
| Comparables — column beds | Beds |
| Comparables — column baths | Baths |
| Comparables — column status | Status |
| Comparables — column source | Source |
| Comparables — open in bazaar | Open in Bazaar ↗ |
| Delta callout — agent | Agent's recommendation |
| Delta callout — benchmark | Current benchmark |
| Delta callout — computed at | Benchmark last computed {T} ago |
| Chart legend — benchmark | Benchmark (90 days) |
| Chart legend — confidence | Confidence band ±10% |
| Chart legend — recommendation | Agent's recommendation |
| Chart legend — projected | Projected post-incorporation |
| Chart empty | Benchmark series not yet available for this segment. Consider Signal only for the first incorporation. |
| Two-person banner | Incorporating this report writes to the pricing benchmark. Because the delta is {X}%, a second approver is required — your decision will create a pending approval request assigned to the on-call PA. |
| Decision — incorporate | Incorporate into benchmark |
| Decision — incorporate subtext | Writes an authoritative signal into the pricing benchmark for {segment}. Affects agent pricing tools and Bazaar segment badges. |
| Decision — signal only | Approve as signal only |
| Decision — signal only subtext | Marks verified and visible to Bazaar and agents as a considered opinion. Benchmark does NOT change. |
| Decision — reject | Reject with reason |
| Decision — request info | Request more info |
| Decision summary — decided by | Decided by {name} on {date} |
| Decision summary — reason chip | Reason: {reason} |
| Decision summary — notes label | Notes |
| Decision summary — reopen | Reopen |
| Pending 2nd approval | Awaiting second approver: {name} · Open approval request → |
| Second-approver banner | Second-approver review |
| Second-approver initiator template | {initiator} proposed: **{decision}** |
| Second-approver approve | Approve request |
| Second-approver decline | Decline request |
| Incorporate confirm modal title | Approve and incorporate into benchmark? |
| Incorporate confirm modal body | This report will be marked verified AND written as an authoritative signal into the pricing benchmark for {segment}. Continue? |
| Incorporate confirm modal high-delta body | Delta is {X}% — a second approver is required. On confirm, this becomes a pending approval request assigned to the on-call PA. |
| Incorporate confirm modal confirm | Incorporate |
| Signal-only confirm modal title | Approve as signal only? |
| Signal-only confirm modal body | This report will be marked verified and visible to Bazaar and agents as a considered opinion. The pricing benchmark will NOT change. |
| Signal-only confirm modal confirm | Approve as signal only |
| Reject modal title | Reject price report |
| Reject modal reason label | Reason (shown to the agent) |
| Reject modal reason vocab | Insufficient evidence · Thesis not supported by comps · Duplicate report · Cited data unverifiable · Out-of-scope segment · Off-topic · Other |
| Reject modal notes label | Notes for the agent (optional) |
| Reject modal notes helper | The agent sees this in their outcome inbox. Be specific about what to fix. |
| Reject modal confirm | Reject |
| Request info modal title | Request more info |
| Request info modal reason vocab | Need additional comparables · Cite source of transaction data · Clarify thesis assumptions · Attach evidence files · Narrow segment definition · Other |
| Request info modal notes label | Additional context (optional) |
| Request info modal confirm | Send request |
| Audit — submitted | submitted the report |
| Audit — request-info | requested more info |
| Audit — resubmitted | resubmitted after request-info |
| Audit — verified | approved as signal only |
| Audit — incorporated | approved and incorporated into benchmark |
| Audit — rejected | rejected with reason |
| Audit — second-approval-approved | approved the incorporation request |
| Audit — second-approval-declined | declined the incorporation request |
| Own-report banner | You are the submitting agent — you cannot review this report. Decision panel disabled. |
| Step-up prompt template | Confirm your identity to {action} this {tier}-risk report. |
| Loading | Loading price report… |
| Env-switch loading | Switching to {env}. Reloading report… |
| Error banner | Couldn't load this report. |
| 404 body | This price report doesn't exist or is in a different environment. |
| Retry | Retry |

Arabic strings: `[TRANSLATION-PENDING]`.

---

## Component palette

| Element | Primitive |
|---|---|
| Sticky sub-header | Custom `<header>` styled with Broadcast tokens |
| Back-link | `<Button variant="ghost">` + `ChevronLeft` icon |
| Status pill | `<Badge>` per queue vocabulary |
| Two-pane layout | Custom grid with `grid-template-columns: 60% 40%` |
| Subject header card | `<Card>` |
| Structured fields grid | Definition-list pattern (`<dl>` + `<dt>` + `<dd>`) |
| Free-form analysis | `<Prose>` wrapper (markdown/prosemirror render) |
| Comparables table | `<Table>` |
| Evidence file card | `<Card>` per file |
| Image evidence preview | `<img loading="lazy">` |
| PDF evidence preview | `<embed type="application/pdf">` with icon fallback |
| Delta callout | `<Card>` with 2-column `<dl>` inside |
| Delta chip | Custom `<Badge>` — 3 variants per queue |
| Composite risk cell | Stacked `<Badge>` — tenure + delta |
| Benchmark chart | Custom SVG chart component `<BenchmarkChart>` (D3-free — use pre-computed points from backend to avoid a lib dependency) |
| Chart tooltip | `<Tooltip>` on chart-line hit-test regions |
| Two-person banner | Custom `<div>` styled `--lc-status-warning-bg` |
| Decision panel | `<Card>` sticky-bottom |
| Incorporate confirm | `AlertDialog` with high-delta variant |
| Signal-only confirm | `AlertDialog` |
| Reject / Request info modal | `Dialog` (Select for reason + Textarea for notes) |
| Audit trail | Vertical `<ol>` with icon + text per entry |
| Own-report banner | `<Alert>` variant `warning` |
| Step-up | Embedded `SHR-MFA-007` modal |
| Toasts | `Sonner` |
| Numeric renders | `<Numeric>` primitive |
| Icons | `lucide-react` — `ChevronLeft`, `ExternalLink`, `FileText`, `Image`, `File`, `Download`, `X`, `MessageCircle`, `Check`, `AlertTriangle`, `HelpCircle` |

---

## Sample content (for v0 / mockup)

Desktop 1440px, LIVE env, report `aprt_abc123` (row 1 from PA-PVA-009 §Sample content):

- **Sub-header:** back-link "← Price reports queue" · breadcrumb "Sara Al Mansouri · Dubai Marina · 2-3BR apartments" · status Pending review · submitted "2h ago" · Sara avatar chip.
- **Left pane subject header:** "Dubai Marina · 2-3BR apartments" title · "🇦🇪 AE · Apartments · 2-3 bedrooms · 18 comparable listings" · agent chip "Sara Al Mansouri · Pro Elite · 5y 2mo".
- **Report parameters (2-col grid):**
  - Segment definition: Dubai Marina neighborhood, buildings completed post-2015
  - Property type: Apartments
  - Bedroom range: 2-3 bedrooms
  - Time window analyzed: Q2-Q3 2026 (6 months)
  - Analysis basis: Mix of transaction data + active listings
  - Recommendation type: Price band
  - Recommendation: **AED 1,750,000 – 1,950,000** (point: **AED 1,850,000**)
- **Agent's analysis (free-form, ~4 paragraphs, `max-width: 65ch`):** lead paragraph about post-Expo demand shift, second on Marina Gate tower premium, third citing transaction record from 3 recent Dubizzle sales, fourth on projected Q4 trajectory. One inline block-quote from a REIDIN transaction summary.
- **Cited comparables (table, 12 rows):**
  1. Marina Gate 2, Apt 1204 · AED 1,875,000 · AED 2,050/sqft · 3 beds · 3 baths · Active · Property Finder ↗
  2. Marina Gate 3, Apt 802 · AED 1,780,000 · AED 1,970/sqft · 2 beds · 2.5 baths · Sold Aug 2026 · REIDIN ↗
  3. Marina Vista Tower A, Apt 2205 · AED 1,920,000 · AED 2,110/sqft · 3 beds · 3 baths · Under offer · Bayut ↗
  4-12. Additional rows following the same pattern.
- **Attached evidence (5 cards):**
  1. `dubizzle_transaction_export_q3_2026.pdf` · 2.4 MB · view button + first-page thumb.
  2. `marina_gate_broker_email_thread.pdf` · 780 KB · view button + thumb.
  3. `reidin_market_report_dubai_marina_sept.pdf` · 6.1 MB · view button + thumb.
  4. `benchmark_calc_worksheet.xlsx` · 340 KB · spreadsheet icon.
  5. `marina_photo_survey.jpg` · 1.8 MB · inline 200px image thumb.
- **Right pane delta callout:** "Agent's recommendation: AED 1,850,000" · "Current benchmark: AED 1,562,500" · delta chip "▲ +18.4% above benchmark" · Risk stack "Tenure Low · Delta High" · "Benchmark last computed 3h ago".
- **Benchmark chart:** 90-day series with visible upward trend; ±10% confidence band; agent's recommendation dot clearly above the upper confidence bound; legend below.
- **Two-person banner:** amber, "Incorporating this report writes to the pricing benchmark. Because the delta is 18.4%, a second approver is required — your decision will create a pending approval request assigned to the on-call PA."
- **Decision panel:** 4 buttons stacked — Incorporate (primary, with subtext + two-person notice inline) · Approve as signal only (secondary) · Reject with reason (outline + X) · Request more info (outline + MessageCircle).
- **Audit trail:** one entry — "Sara Al Mansouri submitted the report · 2h ago".

Side variants to render as separate v0 iterations:
- **Decided (incorporated) state:** decision panel collapsed to summary card with decider + timestamp + Reopen; audit trail shows submission + incorporation + second-approver approval; status pill Incorporated.
- **Pending second approval state:** banner replaces decision panel with "Awaiting second approver: Priya Sharma · Open approval request →".
- **Second-approver mode:** decision panel replaced with 2-way Approve/Decline + initiator context banner.
- **TEST env with warning strip.**
- **Own-report block:** decision panel disabled with amber banner.

Do NOT fabricate benchmark chart values, agent rating scores, or comparable data not returned by the backend.

---

## Interactions

**On page load:**
- Fetch `GET /api/admin/pricing/agent-price-reports/:reportId` scoped to env. In parallel, fetch chart series `GET /api/admin/pricing/benchmarks/:segmentId/series?window=90d`.
- Show two-pane skeleton (left = 3 section skeletons; right = callout skeleton + chart skeleton + decision panel skeleton).
- On success: render both panes. On 404: full-page 404 block with "This price report doesn't exist or is in a different environment."
- On 403 (`OWN_REPORT`): full page loads normally BUT decision panel is disabled with the own-report banner.

**On back-link click:** navigate to `return_to` param if present, else `/admin/valuation/price-reports`.

**On evidence View button:** open signed URL in new tab (`rel="noopener noreferrer"`). Signed URL vended by `GET /api/admin/pricing/agent-price-reports/:reportId/evidence/:evidenceId/url`.

**On comparable-row external link:** open portal URL in new tab.

**On chart hover:** tooltip shows exact benchmark value + delta from agent's recommendation for that date.

**On Incorporate button:**
- Own-report guard → button disabled with tooltip.
- If composite risk = High: step-up required (SHR-MFA-007).
- If `|delta| ≥ 10%`: modal shows high-delta variant with two-person notice. On Confirm → `POST /api/admin/pricing/agent-price-reports/:id/review` with `{ status: 'verified', incorporate: true, notes }`. Server creates `fin.approval_requests` entry. Page status swaps to `pending_second_approval`; decision panel replaced with "Awaiting second approver" message + link to PA-APR-002.
- If `|delta| < 10%`: modal shows standard body. On Confirm → same POST. Server commits benchmark write. Page reloads to decided state. Toast "Incorporated {segment} report by {agent}. Benchmark refresh queued." with `Undo` (5s).
- On grace expiry: server commits. On Undo: fire `POST .../undo-review` — reverts status + rolls back benchmark write.

**On Signal only button:**
- Own-report + step-up gates.
- Modal shows standard body. On Confirm → POST with `{ status: 'verified', incorporate: false, notes }`. Page reloads to decided state. Toast + Undo grace.

**On Reject button:**
- Own-report + step-up gates.
- Reject modal opens. Reason + notes required. On Confirm → POST with `{ status: 'rejected', reason_code, notes }`. Page reloads to decided. Toast + Undo grace.

**On Request info button:**
- Own-report guard.
- Modal opens. Reason + notes required. On Confirm → POST with `{ status: 'request_info', reason_code, notes }`. Page reloads; status pill swaps to `request_info`; agent sees on `AGT-REC-003` + can resubmit which re-enters PA-PVA-009 queue with `resubmit_of` reference.

**On Reopen (decided-state only, elevated PAs):**
- Confirmation modal: "Reopen this report? Its decision will be reverted and it re-enters the pending queue."
- On Confirm → `POST .../reopen`. Page reloads.

**On second-approver Approve request:**
- Confirmation modal: "Approve incorporation request?"
- On Confirm → `POST /api/admin/approvals/:approval_request_id/approve`. Server commits benchmark write. Page redirects to the report in `incorporated` state OR back to PA-APR-001 if `return_to` was set.

**On second-approver Decline request:**
- Confirmation modal with reason Textarea (required).
- On Confirm → `POST /api/admin/approvals/:approval_request_id/decline` with `{ reason }`. Report status reverts to `pending_review`; audit trail records the decline; initiator PA sees a notification.

**On env-switch mid-flow (PA-NAV-001):**
- If a modal is open with unsaved reason text: confirm-cancel prompt "You have unsaved reason notes. Switch anyway?".
- On confirm: env switches; page 404s (cross-env access blocked); redirect to `/admin/valuation/price-reports` in new env.

**On keyboard shortcut:**
- `A` incorporate · `S` signal only · `R` reject · `I` request info · `Esc` close modal · `?` shortcuts sheet · `B` back to queue · `E` focus first evidence card.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial loading** | Page mount | Two-pane skeleton (3 section blocks left, callout + chart + decision panel right). |
| **Ready — pending** | Load complete, status = pending_review | 4-way decision panel active. Two-person banner if `two_person_required`. |
| **Ready — pending second approval** | status = pending_second_approval | Decision panel replaced with "Awaiting second approver" message + link to approval-request detail. |
| **Ready — verified (signal only)** | status = verified, incorporated = false | Decision panel collapsed to summary; Reopen button (elevated only). |
| **Ready — incorporated** | status = verified, incorporated = true | Decision panel collapsed; audit trail shows benchmark-write timestamp; chart shows the projected post-incorporation dashed line. |
| **Ready — rejected** | status = rejected | Decision panel collapsed to summary card with reason chip + notes excerpt. |
| **Ready — request info (awaiting agent)** | status = request_info | Decision panel collapsed to summary; audit trail shows the request; message "Awaiting agent resubmission". |
| **Ready — expired** | status = expired | Decision panel collapsed; message "This report expired without review after 30 days." |
| **Second-approver mode** | `?approval_request_id=…` present + current PA is not initiator + request is pending | Decision panel replaced with 2-way Approve/Decline + initiator context banner. |
| **Own-report block** | server returns `is_own=true` | Full page renders; decision panel disabled with amber banner. |
| **Incorporate confirm modal open** | Incorporate clicked | Modal traps focus; high-delta or standard variant per delta. |
| **Signal-only confirm open** | Signal only clicked | Modal traps focus. |
| **Reject / Request info modal open** | Corresponding button clicked | Modal with Select + Textarea. Confirm disabled until reason + notes ≥5 chars. |
| **Step-up prompt** | 401 STEP_UP_REQUIRED or client-side policy match | SHR-MFA-007 modal; on success re-fire pending action; on cancel silent abort. |
| **Two-person incorporate confirmed** | Confirm on high-delta | Toast "Incorporation request created. Awaiting second approver." Page state swaps to pending_second_approval. |
| **Undo grace period** | After single-row decision toast | 5s window; row-header pulse-border `--lc-accent-bold-edge`; hover shows "Undo within {N}s". |
| **Undo triggered** | Undo link clicked within 5s | Server rolls back decision (+ benchmark write if incorporate happened); page reverts to pending_review; toast dismisses. |
| **Chart series empty** | No 90-day benchmark snapshots for segment | Chart placeholder + guidance line "Consider Signal only for the first incorporation." |
| **Evidence 403 / signed-URL expired** | View button 403 | Toast "Preview link expired. Refresh page." + Refresh action. |
| **Reopen confirmation** | Reopen clicked in decided state | Confirmation modal; on confirm reverts to pending_review + audit entry. |
| **Env-switch mid-decision** | PA-NAV-001 fires with modal open | Confirm-cancel prompt if unsaved reason text. |
| **404 (report not in env or deleted)** | GET returns 404 | Full-page 404 block. |
| **Backend error 500** | GET or POST 500 | Error banner in the affected pane with Retry. |
| **Session expired** | 401 non-step-up | Redirect to SHR-AUT-001 login with return-to. |
| **Insufficient permission** | 403 non-own-report | Full-page block "You need price-report review access to view this page." |
| **TEST-env warning strip** | env=TEST | Persistent strip renders under top bar per PA-NAV-001. |
| **RTL** | Locale = ar | Two-pane order mirrored (decision panel on left); comparables table columns mirror; numerals stay LTR via bidi isolation. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; chart line colors adjust via token references. |

---

## Accessibility

- Single `<h1>` in sub-header (visually hidden, "Price report by {agent} for {segment}"). `<h2>` per left-pane section; `<h3>` for sub-sections.
- Sticky sub-header `role="banner"`.
- Two panes ordered in DOM as left-pane first, right-pane second (SR reads report body before decision panel). Layout achieves visual placement via CSS grid.
- Comparables `<table>` with `<caption>` "Comparables cited by the agent". Every column `scope="col"`. Numeric cells announced as prices via `<Numeric>`.
- Evidence cards `role="article"`; View button `aria-label="View {filename}"`.
- Chart has `role="img"` + `aria-label` summarizing the shape ("Benchmark rose from AED X to AED Y over 90 days; agent's recommendation of AED Z sits {above/below/within} the confidence band"). Full data available via `<figcaption>` or `<details>` fallback table.
- Delta callout uses `<dl>` structure. Delta chip announces "eighteen point four percent above benchmark".
- Two-person banner `role="status"` `aria-live="polite"`.
- Decision panel buttons in a logical tab order (Incorporate → Signal only → Reject → Request info). Each button `aria-describedby` its own subtext for context.
- Modals trap focus; Esc closes; click-outside dismisses with confirmation if reason text was typed.
- Audit trail `<ol>` (chronological order); each entry announces "actor + action + relative time".
- Focus visible via two-tone Broadcast ring — do not override.
- Every icon-only button has `aria-label`.
- Keyboard-first: all decisions reachable without pointer (A/S/R/I mapping mirrored in `?` sheet).
- Skip-to-decision-panel link at top of page for keyboard users who want to bypass reading (elevated PAs revisiting).

---

## Anti-patterns

- Do NOT place decision buttons above the report body — PA must read before deciding.
- Do NOT hide the two-person banner behind a modal. It appears above the decision panel while the PA is still reading.
- Do NOT allow Incorporate without confirming the high-delta warning if `|delta| ≥ 10%`.
- Do NOT auto-approve or auto-reject based on any single signal (tenure, tier, delta).
- Do NOT paint the incorporate button in danger red — this is an approval, not a destructive action. Primary orange fill.
- Do NOT let a PA incorporate their own report. Server 403 `OWN_REPORT`; UI disables + banner.
- Do NOT show a rejection reason color-alone. Always chip + label.
- Do NOT reload the whole page after each decision — SPA state update + status pill swap + audit trail append.
- Do NOT allow Undo on a decision after the second approver has committed (two-person path). Undo grace is single-approver only.
- Do NOT surface signed URLs directly in the DOM — always render View button that requests a fresh signed URL on click (short-lived, 5-minute).
- Do NOT collapse the audit trail behind a tab — always visible below decision panel.
- Do NOT co-mingle LIVE and TEST data — server 404s on cross-env; UI never renders a report in the wrong env.
- Do NOT allow chart interactions to trigger any state change. Chart is read-only.
- Do NOT paint the confidence band in a signal color — it's context, not signal. Use `--lc-surface-sunken` fill with `opacity: 0.6`.

---

## Reference designs

- **PA-MOD-002** (this codebase) — two-pane decision detail predecessor; sticky sub-header + decision panel pattern.
- **Stripe Radar review detail** — evidence + decision in one screen.
- **GitHub PR review page** — audit-trail below decision surface.
- **Linear issue detail** — sticky right-rail with meta + actions.

Do NOT match: multi-tab admin detail (loses cross-context visibility); Salesforce case detail (over-dense).

---

## Backend contract

**Per-item detail:** `GET /api/admin/pricing/agent-price-reports/:reportId` — **NEW** (`[BE-DESIGN-PVA09-06]`).

Env-scoped via `X-Wingcaster-Env`. 404 for cross-env or missing.

**Response 200:**
```json
{
  "id": "aprt_abc123",
  "submitted_at": "2026-09-08T10:04:11Z",
  "status": "pending_review",
  "agent": { "id": "usr_xyz789", "display_name": "Sara Al Mansouri", "avatar_url": "…", "tier": "pro_elite", "tenure_days": 1888 },
  "agency": { "id": "agy_dubai_elite", "name": "Elite Real Estate Dubai", "tenant_url": "/admin/tenants/agy_dubai_elite" },
  "subject": {
    "segment_label": "Dubai Marina · 2-3BR apartments",
    "segment_id": "seg_dxb_marina_apt_23br",
    "country_code": "AE", "country_flag_emoji": "🇦🇪",
    "property_type": "apartment", "bedroom_range": "2-3", "comparable_listings_count": 18
  },
  "parameters": {
    "segment_definition": "Dubai Marina neighborhood, buildings completed post-2015",
    "time_window": "Q2-Q3 2026 (6 months)",
    "analysis_basis": "mix_transactions_and_active_listings",
    "recommendation_type": "band"
  },
  "recommendation": { "price_low": 1750000, "price_point": 1850000, "price_high": 1950000, "currency": "AED" },
  "analysis": { "format": "prosemirror", "body": { /* prosemirror doc */ } },
  "cited_comparables": [
    { "id": "cmp_1", "address": "Marina Gate 2, Apt 1204", "price": 1875000, "currency": "AED", "price_per_sqft": 2050, "beds": 3, "baths": 3, "status": "active", "source_portal": "property_finder", "source_url": "https://…" }
  ],
  "evidence_files": [
    { "id": "ev_1", "filename": "dubizzle_transaction_export_q3_2026.pdf", "mime": "application/pdf", "size_bytes": 2411520, "uploaded_at": "2026-09-08T10:03:44Z" }
  ],
  "benchmark_delta": {
    "benchmark_price_point": 1562500, "benchmark_currency": "AED",
    "delta_pct": 18.4, "delta_direction": "above", "delta_tier": "high",
    "benchmark_computed_at": "2026-09-08T07:04:00Z", "stale": false
  },
  "tenure_risk": { "tier": "low", "score": 0.09, "signals": ["agency_age_days:1240", "prior_rejection_ratio:0.01"] },
  "composite_risk_tier": "high",
  "review": null,
  "audit_trail": [
    { "actor": { "id": "usr_xyz789", "name": "Sara Al Mansouri", "role": "agent" }, "action": "submitted", "at": "2026-09-08T10:04:11Z", "reason": null, "notes": null }
  ],
  "is_own": false, "step_up_required": true, "two_person_required": true,
  "resubmit_of": null, "env": "live"
}
```

**Benchmark chart series:** `GET /api/admin/pricing/benchmarks/:segmentId/series?window=90d` — **NEW** (`[BE-DESIGN-PVA09-07]`).

Returns `{ points: [{ date, price, confidence_low, confidence_high }], currency }`. Empty `points: []` when segment is not yet tracked — the chart renders its empty state.

**Evidence signed URL:** `GET /api/admin/pricing/agent-price-reports/:reportId/evidence/:evidenceId/url` — **NEW**. Returns `{ url, expires_at }`. URL valid 5 minutes.

**Review action:** `POST /api/admin/pricing/agent-price-reports/:id/review` — existing, extension per `PA-PVA-009` §Backend contract.

Body: `{ status: 'verified' | 'rejected' | 'request_info', incorporate?: boolean, reason_code?, notes? }`.

**Approval-request wiring (high-delta incorporate):** When `status='verified'`, `incorporate=true`, and `|delta| ≥ 10%`, server creates a `fin.approval_requests` row (via `[BE-DESIGN-PVA09-03]`, shared with queue brief) instead of committing. Response: `{ pending_second_approval: true, approval_request_id }`.

**Second-approver action:** `POST /api/admin/approvals/:approval_request_id/approve` / `.../decline` — existing PA-APR family. On approve of a WF-06 incorporation: server commits benchmark write + updates report status to `incorporated` + enqueues benchmark-refresh worker.

**Reopen:** `POST /api/admin/pricing/agent-price-reports/:id/reopen` — **NEW** (`[BE-DESIGN-PVA09-08]`). Elevated PAs only; reverts status to `pending_review`, writes audit entry, rolls back benchmark write if `incorporated=true`.

**Undo:** `POST /api/admin/pricing/agent-price-reports/:id/undo-review` — **NEW** (shared with queue brief `[BE-DESIGN-PVA09-04]`). 5s single-approver window.

**Prerequisites to file in kickoff §5a:**
- `[BE-DESIGN-PVA09-06]` per-item detail route. ~2 days.
- `[BE-DESIGN-PVA09-07]` benchmark-snapshot series for chart. ~2 days.
- `[BE-DESIGN-PVA09-08]` reopen route. ~1 day.
- Signed-URL evidence vending — confirm existing pattern in `backend/src/modules/property-valuation` or file as ~1 day new.
- `[BE-DESIGN-PVA09-03]` two-person rule wiring — SHARED with `PA-PVA-009`.
- `[BE-DESIGN-PVA09-04]` undo-review — SHARED with `PA-PVA-009`.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/valuation/AgentPriceReportDetailPage.tsx`.
- **Route registration:** `web/src/App.tsx` — add behind `PAConsoleGuard` with `pricing-admin` capability pack.
- **New per-screen components:**
  - `AgentPriceReportDetailPage.tsx` — page shell + dual data fetches + URL state (`return_to`, `approval_request_id`).
  - `PriceReportSubjectHeader.tsx` — subject block at top of left pane.
  - `PriceReportParametersGrid.tsx` — structured-fields definition list.
  - `PriceReportAnalysisRender.tsx` — prosemirror/markdown render wrapped in `<Prose>`.
  - `PriceReportComparablesTable.tsx` — table of cited comparables.
  - `PriceReportEvidencePanel.tsx` — evidence card stack with signed-URL fetch on click.
  - `PriceReportDeltaCallout.tsx` — right-pane delta callout.
  - `BenchmarkChart.tsx` — SVG chart (D3-free — pre-computed points from backend). **REUSABLE** — file under `web/src/components/pricing/` for reuse in PA-PVA-002.
  - `PriceReportDecisionPanel.tsx` — 4-way panel with sticky-bottom behavior + status-driven variants (pending, decided, pending 2nd approval, second-approver mode, own-report block).
  - `PriceReportAuditTrail.tsx` — timeline component. **REUSABLE** across PA-PVA-008b and future PA detail briefs.
  - `PriceReportTwoPersonBanner.tsx` — amber banner.
- **Data layer:**
  - `useAgentPriceReportDetail(reportId)` — fetch detail + chart series in parallel.
  - `useEvidenceSignedUrl(reportId, evidenceId)` — on-demand signed-URL fetch.
  - `usePriceReportReview()` mutation — reused from queue brief.
  - `useApprovalRequestAction()` mutation for second-approver Approve/Decline.
- **Reuse from queue brief:** `PriceReportDeltaChip.tsx`, `PriceReportCompositeRiskCell.tsx`, `PriceReportIncorporateDialog.tsx`, `PriceReportSignalOnlyDialog.tsx`, `PriceReportRejectDialog.tsx`, `PriceReportRequestInfoDialog.tsx`. These live under `web/src/components/valuation/`.
- **Test discipline:**
  - Unit: each sub-component; chart with sample point set; decision panel per-status-variant.
  - Integration: full page load × incorporate low-delta happy path × incorporate high-delta → approval-request creation × second-approver mode × signal-only × reject with reason × request-info × own-report block × step-up × env-switch mid-flow × undo-within-grace × reopen from decided state.
  - RTL: page in Arabic locale; two-pane mirror.
  - Broadcast: `no-raw-hex.test.ts` must stay green.
  - Real-Postgres: at least one end-to-end path incorporating a low-delta report → benchmark row appears.
  - Accessibility: axe-core scan of loaded + modal-open + step-up-open + second-approver-mode.
- **Perf:**
  - Chart renders from pre-computed points — no client-side aggregation.
  - Skeleton within 100ms of route mount.
  - PDF preview embed lazy — only mount when card scrolls into view.
- **Copy/i18n:** `web/src/locales/en/paPriceReports.json` (shared with queue) + `ar/paPriceReports.json`.

---

## Broadcast alignment callouts (detail deltas)

All PA-MOD-001 + PA-MOD-002 callouts apply verbatim. Detail-specific additions:

- Two-pane grid: `display: grid; grid-template-columns: 60% 40%`; separator `border-left: 1px solid var(--lc-border)`.
- Left-pane section titles `var(--lc-type-heading-3)`; body `var(--lc-type-body)`; free-form analysis `var(--lc-type-body-lg)` with `max-width: 65ch`.
- Right-pane callout: `background: var(--lc-surface-sunken)`, `border-radius: var(--lc-radius-lg)`, `padding: var(--lc-space-lg)`.
- Benchmark chart: line stroke `var(--lc-text-muted)`; confidence band fill `var(--lc-surface-sunken)` at `opacity: 0.6`; agent's recommendation dot `var(--lc-action-primary)` fill `var(--lc-focus-ring-contrast)` stroke 2px; projected dashed line `var(--lc-action-primary)` at `stroke-dasharray: 4 4`.
- Two-person banner: `background: var(--lc-status-warning-bg)`, `color: var(--lc-status-warning-fg)`, `border-radius: var(--lc-radius-md)`, `padding: var(--lc-space-md)`, `⚠` glyph prefix.
- Decision panel card: `background: var(--lc-surface-raised)`, `border: 1px solid var(--lc-border)`, `border-radius: var(--lc-radius-lg)`, `padding: var(--lc-space-lg)`; sticky via `position: sticky; bottom: var(--lc-space-lg)`.
- Decision buttons: Incorporate `<Button variant="default">`, Signal only `<Button variant="secondary">`, Reject / Request info `<Button variant="outline">`. Each has subtext in `var(--lc-type-caption)` `var(--lc-text-muted)`.
- Second-approver banner: `background: var(--lc-accent-bold-bg)`, `color: var(--lc-accent-bold-fg)`, `border: 1px solid var(--lc-accent-bold-edge)` (mandatory boundary per Broadcast rule).
- Own-report banner: `background: var(--lc-status-warning-bg)`, `color: var(--lc-status-warning-fg)`.
- Audit trail: vertical `<ol>` with `padding-inline-start: 0`; each `<li>` `display: flex; gap: var(--lc-space-sm)`; avatar 24px; text `var(--lc-type-body-sm)`.
- Evidence card: `background: var(--lc-surface-raised)`, `border: 1px solid var(--lc-border)`, `border-radius: var(--lc-radius-md)`, `padding: var(--lc-space-md)`, `<Card>` elevation `var(--lc-elevation-sm)`.
- All numeric prices, deltas, timestamps, tenure-days, comparable/evidence counts via `<Numeric>` (mono + tabular-nums).
- Focus rings two-tone via base CSS — do not override.
- Motion: sub-header sticky offset transitions `--lc-duration-fast`; modal open `--lc-duration-slow` `--lc-easing-out`; decision panel collapse-to-summary after decision `--lc-duration-base` `--lc-easing-in-out`; NO signal-lamp motif.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin agent-price-report review detail page (PA-PVA-009b) — MENA real-estate B2B SaaS admin surface. Desktop 1440px ONLY. This is the WF-06 decision surface: one Pro-tier agent's considered market-segment price report, with all cited comparables and evidence in one pane, WingCaster's current benchmark comparison chart in the other, and a 4-way decision panel (Incorporate into benchmark / Approve as signal only / Reject with reason / Request more info). Two-person rule triggers for incorporate when |delta| ≥ 10%.

Same sticky sub-header + env badge + step-up + audit-trail discipline as PA-MOD-002 (the detail-family sibling). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

First pass: render the desktop 1440px layout for report aprt_abc123 (Sara Al Mansouri · Dubai Marina · 2-3BR apartments · +18.4% above benchmark · high-delta so two-person required). LIVE env green badge in top bar. Status pending review. Two-pane: 60% left (subject header + parameters grid + free-form analysis + 12-row cited-comparables table + 5-card evidence stack), 40% right sticky (delta callout showing agent's AED 1,850,000 vs benchmark AED 1,562,500 + risk stack + 90-day chart with agent's dot above upper confidence band + amber two-person banner + 4-button decision panel + audit trail with 1 entry).

LTR English only for this pass — RTL Arabic, dark mode, decided-incorporated state, pending-second-approval state, second-approver mode, own-report block, TEST env, empty benchmark chart, and each of the 4 confirm dialogs as separate iterations.

Follow the copy table exactly. Do NOT fabricate benchmark values, chart shapes, or comparable data — sample content in the brief maps to a defined backend payload.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Decided-incorporated state — decision panel collapsed to summary card (decider + timestamp + Reopen button); status pill Incorporated; audit trail shows submission + initiator's incorporation-request + second-approver's approval; chart shows projected dashed line.`
2. `Pending-second-approval state — banner replaces decision panel with "Awaiting second approver: Priya Sharma · Open approval request →".`
3. `Second-approver mode — arriving with ?approval_request_id=… — decision panel replaced with 2-way Approve/Decline plus initiator context banner "Sara Al Mansouri proposed: Incorporate into benchmark".`
4. `Incorporate confirm dialog open (high-delta variant with two-person notice).`
5. `Signal-only confirm dialog open.`
6. `Reject dialog open — Reason Select (Thesis not supported by comps highlighted), Notes textarea empty, Confirm disabled.`
7. `Request info dialog open — Reason Select (Need additional comparables highlighted).`
8. `Own-report block — decision panel disabled with amber banner "You are the submitting agent".`
9. `TEST env with warning strip.`
10. `Empty benchmark chart state — no snapshots yet, placeholder + Consider Signal only guidance.`
11. `RTL Arabic at desktop 1440px — [TRANSLATION-PENDING] placeholders, MIRROR the two-pane layout.`
12. `Dark mode version of pass 1.`

Save outputs under `docs/design/mockups/v0-outputs/PA-PVA-009b/` + screenshots at `docs/design/mockups/PA-PVA-009b-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 produced all 12 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-PVA-009b/`.
- [ ] Cursor Wave-5 dispatch prompt references this brief + `PA-PVA-009` queue + PA-MOD-002 detail-family anchor.
- [ ] `[BE-DESIGN-PVA09-06..08]` filed in kickoff §5a.
- [ ] `[BE-DESIGN-PVA09-03]` (two-person wiring) + `[BE-DESIGN-PVA09-04]` (undo) confirmed shared with `PA-PVA-009`.
- [ ] Reusable component names (`BenchmarkChart`, `PriceReportAuditTrail`) reserved for reuse in PA-PVA-002 and PA-PVA-008b.
- [ ] Signed-URL evidence-vending pattern confirmed against existing property-valuation module or filed as new backend task.
