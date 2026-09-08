# Screen Brief — PA-PVA-008b · Bad-comparable-report detail (WF-05 approver-side)

**Layer-2 Delta Brief. INHERITS the PA approval-queue family pattern from `PA-MOD-001-portal-moderation-queue-brief.md` (queue) + `PA-MOD-002` (detail sibling).**

**This brief is a delta.** It only enumerates what differs from PA-MOD-001 (queue-family invariants) and the detail-screen skeleton established by `PA-MOD-002` / `PA-PVA-009b`. Everything not called out here — Broadcast alignment, shell layout, env-badge behavior, two-person rule, immutable-audit write, step-up integration, session-expiry handling, RTL rules, dark-mode rules, focus-ring rules, keyboard-first ergonomics — is inherited unchanged.

Companion to `SCREEN_MATRIX_PA.md` §23 entry `PA-PVA-008b`. Parent queue delta is `PA-PVA-008-bad-comparable-report-queue-brief.md`.

Wave 2 (Week 5 — WF-05 cluster) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 rows 43-44 + §6 Week 5. Pairs with `AGT-APR-003` (comparable detail) + `AGT-APR-004` (report a bad comparable) + `AGT-REC-002` (outcome) + `PA-PVA-008` (queue).

---

## Broadcast alignment

**Inherits the full `§Broadcast alignment` callout block from `PA-MOD-001-portal-moderation-queue-brief.md`.** No overrides. Every color / font / spacing / motion / radii reference resolves through `BROADCAST_ALIGNMENT_REFERENCE.md`.

Screen-specific detail-view Broadcast callouts (additive only, PA-PVA-008b-scoped):

- **Detail-screen shell** — this is an ARBITRATION surface (not a reading surface like PA-PVA-009b, nor a validation surface like PA-MOD-002). Content lives in a three-region layout on desktop 1440px: **left column** (~52% width) — the comparable-in-question side-by-side with the reporter's stated correction + evidence gallery; **right column** (~48%) — market-impact panel + decision panel (docked, sticky under top bar / optional TEST warning strip). Below both columns, a full-width tabbed section for `Affected valuations` (paginated list of valuations that reference this comparable), `Audit trail` (PA-AUD-001 embedded), and `Reporter history` (this reporter's prior reports + outcomes).
- **Comparable title treated as page title:** `font: var(--lc-type-heading-1)` — the COMPARABLE title, not the report title (reports don't carry human titles; the comparable is the subject). Below the title: reason-category pill + severity pill + market-impact chip inline, then address line in `var(--lc-type-body-sm)` `var(--lc-text-muted)`.
- **Side-by-side comparison card** (left column, top): a two-panel `Card` with `--lc-surface-raised` + `--lc-elevation-sm` + `padding: var(--lc-space-xl)`. Left panel = "As currently in the pricing pool" — comparable's fields as stored in `comparables` (price, area, beds/baths, status, listed-at, last-updated, source). Right panel = "Reporter's claim" — reporter's stated observed values for the same fields, with the CHANGED fields highlighted using `--lc-status-warning-bg` background wash + `--lc-status-warning-fg` text. Unchanged fields stay `--lc-text-primary`. If reporter's claim = "the listing is already sold", the right panel shows a single row "Status: sold" + observed sale date if provided + sale-record evidence chip.
- **Delta ribbon** across the top of the side-by-side card: `var(--lc-status-warning-bg)` fill + `--lc-status-warning-fg` ink + copy "Δ {reportedField}: {currentValue} → {observedValue} ({deltaPct}%)" — the machine's plain-English summary of what changed. Uses `<Numeric>` for values.
- **Evidence gallery** (left column, below side-by-side): grid of evidence thumbnails (portal screenshots, sale records, photos). Each thumbnail 160×120 with `var(--lc-radius-md)`; click opens `Dialog` viewer at native resolution. If evidence is a URL (portal link), render as a `<Card>` with `ExternalLink` icon + URL preview + "Open in new tab" button (opens with `rel="noopener noreferrer"`). If evidence file count = 0, show an amber inline block "Reporter provided no evidence beyond the claim. Consider `Request more info` before deciding."
- **Reporter context strip** (left column, above side-by-side): 40px avatar + reporter name (link to reporter profile in new tab) + reporting agency (link to PA-TEN-001 in new tab) + submitted-at relative + tooltip full timestamp + review-SLA chip + reporter-pattern amber-dot-with-tooltip (from queue). If `reporter.pattern_flag=true`, an amber inline banner spans this strip: "This reporter has filed {N} reports against {agency} in {D} days. Read for pattern before deciding."
- **Comparable-owning agency strip** (left column, above side-by-side, RIGHT of reporter strip separated by `--lc-border`): 40px avatar (or agency logo) + owning-agency name (link to PA-TEN-001 in new tab) + comparable-source chip (`agency_owned` OR external-portal monogram) + last-listed-at + `Open in source` link (opens the comparable's canonical source page in a new tab). If external-scrape, an additional muted line "Scraped {N} days ago via {sourceName}."
- **Market-impact panel** (right column, top; `Card` with `--lc-surface-raised` + `--lc-elevation-sm`):
  - Section title: "Market impact if removed"
  - Aggregate: large `<Numeric>{N}</Numeric>` valuations affected + tri-color tier chip (None · Low · Medium · High) matching queue chip
  - Row: "Median price move" `<Numeric>{P}</Numeric>%` (signed)
  - Row: "Max price move (single valuation)" `<Numeric>{Q}</Numeric>%`
  - Row: "Valuations across markets" — small bar chart or list of top-5 markets by affected count (uses existing chart primitive if present, else a text list)
  - Note (muted): "Confirming and removing this comparable will trigger a recalculation job across the affected valuations. Reporter and comparable-owning agent will both be notified."
  - **If `market_impact.tier=high`**: amber inline banner `--lc-status-warning-bg` + `Users` lucide icon + copy "This is a high-market-impact removal. A second PA approval is required per two-person rule."
- **Decision panel** (right column, below market-impact, sticky):
  - Section title: "Arbitration decision"
  - `Confirm and remove` — primary filled button, `Trash2` icon, full-width; disabled with tooltip if `is_own=true` OR (`market_impact.tier=high` AND session lacks recent step-up)
  - `Confirm and quarantine` — outline warning variant, `Pause` icon, full-width; sub-line "Hold out of pricing pool while the comparable-owning agent corrects the row." + optional `quarantine_hours` numeric input (default 72h, min 24, max 168)
  - Divider
  - `Reject as invalid` — outline, `X` icon
  - `Request more info` — outline, `MessageCircle` icon
  - Below: single-checkbox "Confirm I have reviewed the evidence" (defaults unchecked; MUST be checked for `Confirm and remove` + `Confirm and quarantine` + `Reject as invalid`; NOT required for `Request more info` — that action is corrigible).
  - Note (muted): "All decisions are audit-logged. Reasons and notes are shown to the reporter on their outcome inbox; the comparable-owning agent sees a courteous notice with appeal path on confirmed decisions."
- **Two-person-rule affordance:** when `Confirm and remove` is clicked on a row where `market_impact.tier=high` AND `requires_two_person=true`, the confirmation dialog converts into a `PA-APR-003`-style action-confirmation flow — the decision is recorded as `REMOVE_PROPOSED` (not final) and appears in `PA-APR-001` approvals queue for a second PA to confirm. Modal copy: "This removal requires a second PA approval. Your reason will be visible to the second approver. Recalculation will NOT run until the second approval lands." Once the second approval fires (out-of-band), the comparable is removed and the recalc job enqueues.
- **Motion:** decision panel button hover `--lc-duration-fast`; evidence-viewer modal opens `--lc-duration-slow` `--lc-easing-out`; success toast + auto-navigate back to queue `--lc-duration-base`; on confirm-remove success, the delta-ribbon does a single `--lc-easing-emphasis` shrink-and-fade to signal the removal has committed (WF-05 broadcast moment; NOT the signal lamp — that's reserved for "listing went live").

---

## Meta

| | |
|---|---|
| Screen ID | PA-PVA-008b |
| Screen name | Bad-comparable-report detail |
| Persona | PA (elevated — comparable-review capable; NOT the reporter, NOT an agent at the comparable-owning agency; server-enforced. High-market-impact confirmed removals require a second PA per two-person rule via PA-APR-003.) |
| Device targets | Desktop 1440px primary (1024px minimum — decision panel becomes bottom-sticky) |
| Locale | English + Arabic (RTL); side-by-side field labels bilingual per WingCaster comparable schema (address_line renders in the source locale with bidi isolation) |
| Theme | Light + Dark |
| Route | `/admin/valuation/comparable-reports/:reportId` (optional `?return_to=<queue-url>` for back-navigation; `?tab=affected\|audit\|reporter-history` for deep-links) |
| Current state | MISSING. Depends on `[BE-CMR-01..10]` route family (see PA-PVA-008). Specifically requires `GET /:reportId` returning full payload + side-by-side field diff + evidence + market-impact breakdown + reporter-history summary + affected-valuations list. |
| Workflow role | WF-05 role = Approval detail |
| Backend prerequisites | ⏳ `[BE-CMR-01]` list-response extension (shared) · ⏳ `[BE-CMR-11]` `GET /:reportId` single-item endpoint (NEW — separate from list) · ⏳ `[BE-CMR-02]` decision endpoints · ⏳ `[BE-CMR-04]` market-impact scoring service · ⏳ `[BE-CMR-05]` two-person-rule via PA-APR-003 · ⏳ `[BE-CMR-08]` recalculation trigger · ⏳ `[BE-CMR-09]` undo-decision endpoint · ⏳ `[BE-CMR-12]` `GET /:reportId/affected-valuations` paginated list · ⏳ `[BE-CMR-13]` `GET /:reportId/reporter-history` last-10 reports by this reporter with outcomes · ⏳ `[BE-CMR-14]` `GET /:reportId/audit-trail` embedded PA-AUD-001 timeline · ✅ SHR-MFA-007 step-up · ✅ PA-NAV-001 env context · ✅ PA-AUD-001 audit writer |
| Cluster | Wave 2 (WF-05 cluster) — ships in same PR pair as PA-PVA-008 |

---

## Purpose

Platform Admin opens a specific pending bad-comparable report to read the reporter's claim side-by-side with the currently-stored comparable, evaluate the evidence, weigh the market impact, and take an arbitration decision — Confirm and remove / Confirm and quarantine / Reject as invalid / Request more info.

Because a confirmed removal re-runs every valuation that references the comparable (potentially thousands during a market launch), and because it produces a courteous notice to a comparable-owning agent who may push back, this screen is the ARBITRATION surface. The queue is triage; this is where PA reads.

Four PA sub-tasks:

1. **Read the diff** — the side-by-side card shows exactly what the reporter claims is wrong. Delta ribbon summarizes the machine's read. Evidence gallery lets PA verify the reporter's claim against portal screenshots, sale records, and photos.
2. **Contextualize both sides** — reporter's history (has this reporter reported this agency 4 times this month?) and comparable-owning agency's context (agency-owned or scraped? if scraped, how stale?) inform the arbitration frame.
3. **Weigh market impact** — the right-column panel shows how many valuations reference this comparable and by how much they'll move if it's removed. High-impact removals trigger two-person rule.
4. **Decide.** Confirm-remove tombstones the comparable and enqueues the recalc; confirm-quarantine holds it out of the pool during a fix window; reject-as-invalid restores confidence in the pool for the reporter's counter-claims; request-more-info re-queues the case.

Success outcome: decision recorded server-side (append to `comparable_reports.status` + audit log via PA-AUD-001 + on remove: enqueue `recalculationJobService`); PA returned to the queue with success toast; next-in-queue keyboard shortcut (`J`) available. If the decision proposed a two-person-rule removal, PA sees "Sent to PA-APR-001 for second approval" toast and the report moves to `pending_second_approval` state.

---

## Design goals

Inherits PA-MOD-001 + PA-MOD-002 goals (density, decision-in-reach, keyboard continuity, no fabricated scoring, env-context, no color-alone status). Deltas / additions specific to WF-05 arbitration:

1. **Side-by-side is the whole point.** The reader's eyes go straight to the delta ribbon and the highlighted changed fields. Any layout that buries the diff behind expanders defeats the arbitration frame.
2. **Both parties visible before the decision.** Reporter context strip + comparable-owning agency strip live above the diff — PA never decides without seeing WHO is arbitrating against WHOM.
3. **Market impact is the second-largest thing on screen after the diff.** Sticky right column; tier badge visible without scroll. The market-impact-tier drives the two-person rule; making it prominent prevents the "I didn't realize it was high-impact" post-hoc mistake.
4. **Confirm-remove is loud, quarantine is quiet, reject-as-invalid is neutral, request-info is corrigible.** Button hierarchy matches the consequence: filled primary for the loud removal, outline warning for quarantine (recoverable), outline neutral for reject + request-info.
5. **Two-person rule is visible BEFORE the click.** High-impact rows show the amber banner in the market-impact panel — PA sees "second approval required" as they read, not as a surprise in a modal.
6. **Recalculation consequence is stated in copy.** Confirm-remove copy names the recalc job and the notifications; PA cannot claim they weren't told.
7. **Affected-valuations list is inspectable but not modal.** The tab below the fold shows the exact valuations that will re-run. PA can spot-check "yes, these are the ones I expect" before deciding.

---

## Layout

### Desktop 1440px (primary)

**PA-NAV-001 warning strip + top bar** — inherited unchanged.

**Sticky sub-header (below top bar + optional TEST strip):**
- Left: `‹ Back to queue` link (uses `return_to`; falls back to `/admin/valuation/comparable-reports?status=pending`). Aria-label "Back to bad-comparable-report queue".
- Center: queue-position chip — `<Badge>` "Report <Numeric>3</Numeric> of <Numeric>14</Numeric> pending" (accent teal, only teal use on this screen; keep small).
- Right: prev / next report chevron buttons (J/K keyboard equivalents). Disabled at queue edge. + `Copy link` icon (copies canonical detail URL, toast "Link copied to clipboard.").

**Top of main content — heading strip:**
- Comparable title `var(--lc-type-heading-1)` (the comparable being reported, e.g. "2BR Marina apartment · AED 2.4M").
- Below title, inline: reason-category pill + severity pill + market-impact chip + status pill.
- Address line `var(--lc-type-body-sm)` `var(--lc-text-muted)`.

**Two context strips (left+right, above side-by-side card):**
- Left: reporter context strip — avatar + name + agency + submitted-at + SLA chip + reporter-pattern amber-dot-with-tooltip (if applicable).
- Right: comparable-owning-agency strip — avatar/logo + agency + source chip + last-listed-at + `Open in source` link.
- If `reporter.pattern_flag=true`: amber banner spans below the two strips: "This reporter has filed {N} reports against {agency} in {D} days. Read for pattern before deciding."

**Left column (52%) — side-by-side + evidence + reporter's message:**

1. **Side-by-side comparison card:**
   - Delta ribbon top: `Δ {reportedField}: {currentValue} → {observedValue} ({deltaPct}%)`
   - Two-panel body: "As currently in the pricing pool" (left) vs "Reporter's claim" (right); changed fields highlighted with warning tint.
   - Fields shown: price · price_normalized_usd · currency · property_type · bedrooms · bathrooms · area_sqm · condition · furnished · view_type · payment_method · status · last-updated-at · source.
2. **Reporter's stated message** (below side-by-side): the free-text `reason` field the reporter typed on AGT-APR-004. Rendered in `var(--lc-type-body-lg)`, preserves line breaks, quoted style with `--lc-border-strong` left border.
3. **Evidence gallery:**
   - Section header: "Evidence · <Numeric>N</Numeric> files"
   - Grid of thumbnails (image previews) or URL cards (for portal links).
   - Zero-evidence amber inline block.
4. **Related reports on this comparable** (collapsible `<Accordion>`, default-closed): list of any prior or concurrent reports filed against THIS comparable (last 90 days). Each row: reporter · reason category · status · decided-at. Prevents PA from deciding a duplicate report in isolation.

**Right column (48%, sticky, `position: sticky; top: var(--lc-space-3xl)`):**

1. **Market-impact panel** (top, `Card` with `--lc-elevation-sm`):
   - Title "Market impact if removed"
   - Aggregate `<Numeric>` valuations + tier chip
   - Median move · Max move · Top-5-markets breakdown
   - Two-person-rule amber banner (if `tier=high`)
   - Note about recalculation + notifications
2. **Decision panel** (below market-impact, `Card` with `--lc-elevation-md`, slightly heavier to signal weight):
   - Title "Arbitration decision"
   - Buttons stacked: Confirm and remove (filled primary) · Confirm and quarantine (outline warning) · divider · Reject as invalid · Request more info
   - Read-confirm checkbox
   - Audit note

**Below-main tabbed section (full-width, below both columns):**

- Tabs: `Affected valuations` (default) · `Audit trail` (PA-AUD-001 embedded) · `Reporter history`
- **Affected valuations panel:** paginated table of the exact valuations that reference this comparable. Columns: valuation_id · agency · listing address · current valuation · projected valuation post-remove · Δ%. Rows link to PA-PVA-002 valuation detail in new tab.
- **Audit trail panel:** timeline — reported → any prior request-info cycles → this arbitration decision (pending) → (post-decision) recalc job enqueued → recalc job completed. Each event: icon + timestamp + actor + short description. Export-to-PDF button.
- **Reporter history panel:** this reporter's last 10 filed reports with outcomes (Confirmed removed · Confirmed quarantined · Rejected · Awaiting info). Helps PA calibrate whether this reporter's claims typically hold up.

### <1280px

Right column collapses into a bottom-sticky decision bar with buttons in a horizontal strip; market-impact panel becomes an expandable drawer opened from `Show impact breakdown` link.

### <1024px

"PA console requires a desktop screen." block — inherited from PA-MOD-001.

---

## Explicit copy (English) — deltas only

Inherits copy from PA-MOD-001 + PA-MOD-002. WF-05-specific deltas:

| Slot | Copy |
|---|---|
| Breadcrumb — root | Valuation admin |
| Breadcrumb — parent | Comparable reports |
| Back button | ‹ Back to queue |
| Queue-position chip | Report {n} of {total} pending |
| Copy-link toast | Link copied to clipboard. |
| Reporter-pattern banner | This reporter has filed {N} reports against {agency} in {D} days. Read for pattern before deciding. |
| Comparable-owning-agency last-listed | Last listed {ago} on {sourceName} |
| Comparable-owning-agency scraped | Scraped {days} days ago via {sourceName} |
| Comparable-owning-agency open-source | Open in source ↗ |
| Delta ribbon template | Δ {field}: {currentValue} → {observedValue} ({deltaPct}%) |
| Side-by-side left header | As currently in the pricing pool |
| Side-by-side right header | Reporter's claim |
| Side-by-side field — price | Price |
| Side-by-side field — area | Area (m²) |
| Side-by-side field — status | Status |
| Reporter's message header | Reporter's message |
| Evidence gallery header | Evidence · {N} files |
| Evidence zero block | Reporter provided no evidence beyond the claim. Consider `Request more info` before deciding. |
| Related-reports accordion header | Related reports on this comparable ({N}) |
| Market-impact panel title | Market impact if removed |
| Market-impact — aggregate label | Valuations affected |
| Market-impact — median label | Median price move |
| Market-impact — max label | Max price move (single valuation) |
| Market-impact — markets label | Valuations across markets |
| Market-impact — note | Confirming and removing this comparable will trigger a recalculation job across the affected valuations. Reporter and comparable-owning agent will both be notified. |
| Market-impact — two-person banner | This is a high-market-impact removal. A second PA approval is required per two-person rule. |
| Decision panel title | Arbitration decision |
| Decision — confirm-remove | Confirm and remove |
| Decision — confirm-quarantine | Confirm and quarantine |
| Decision — quarantine-hours label | Quarantine window (hours) |
| Decision — quarantine-hours helper | Default 72 hours. Min 24, max 168. |
| Decision — reject | Reject as invalid |
| Decision — request-info | Request more info |
| Decision — read-confirm checkbox | I have reviewed the evidence. |
| Decision — audit note | All decisions are audit-logged. Reasons and notes are shown to the reporter on their outcome inbox; the comparable-owning agent sees a courteous notice with appeal path on confirmed decisions. |
| Own-case decision block | You can't decide this report — you are the reporter or an agent at the comparable's agency. |
| Confirm-remove modal title | Remove this comparable from the pricing pool? |
| Confirm-remove modal body | This comparable will be tombstoned and a recalculation job will re-run {N} affected valuations. The comparable-owning agency ({agencyName}) will be notified with an appeal path. |
| Confirm-remove modal two-person | This removal requires a second PA approval. Your reason will be visible to the second approver. Recalculation will NOT run until the second approval lands. |
| Confirm-remove modal confirm | Remove now |
| Confirm-remove modal cancel | Cancel |
| Confirm-quarantine modal title | Quarantine this comparable? |
| Confirm-quarantine modal body | This comparable will be held out of the pricing pool for {H} hours while {agencyName} corrects the row. Valuations will NOT re-run automatically; the row rejoins the pool automatically at the end of the window. |
| Confirm-quarantine modal confirm | Quarantine for {H}h |
| Reject-as-invalid modal title | Reject this report as invalid |
| Reject-as-invalid modal reason label | Reason (shown to the reporter) |
| Reject-as-invalid modal reason vocab | Comparable is correct as reported · Insufficient evidence · Duplicate of a resolved report · Vexatious pattern · Out of scope · Other |
| Reject-as-invalid modal notes label | Notes for the reporter (required) |
| Reject-as-invalid modal confirm | Reject report |
| Request-info modal title | Request more info from the reporter |
| Request-info modal checklist label | What should the reporter attach or clarify? |
| Request-info modal checklist vocab | Attach portal URL · Attach sale record · Attach photo evidence · Clarify which field is wrong · Clarify observation date · Other |
| Request-info modal notes label | Notes for the reporter |
| Request-info modal confirm | Send request |
| Confirm-remove toast (single-PA) | Removed comparable. Recalculating {N} valuations… |
| Confirm-remove toast (two-person-proposed) | Sent to PA-APR-001 for second approval. Recalculation will run when it lands. |
| Confirm-quarantine toast | Quarantined for {H}h. Comparable rejoins the pool automatically. |
| Reject-as-invalid toast | Rejected report — {reason}. |
| Request-info toast | Sent info request to {reporterName}. |
| Undo link | Undo |
| Undo blocked toast | Can't undo — recalculation has committed. |
| Read-confirm error | Confirm you have reviewed the evidence before deciding. |
| Already-decided block | This report has already been {status} by {decidedBy} on {decidedAt}. |
| Affected-valuations tab | Affected valuations |
| Audit-trail tab | Audit trail |
| Reporter-history tab | Reporter history |

---

## Component palette — deltas only

Inherits palette from PA-MOD-001 + PA-MOD-002. WF-05-specific:

| Element | Primitive |
|---|---|
| Side-by-side comparison card | Custom two-panel `<div>` inside `Card`; changed fields wrapped in `<mark>` styled with `--lc-status-warning-bg` |
| Delta ribbon | Custom banner `<div>` at top of side-by-side card |
| Reporter context strip | Composite `<div>` with `Avatar` + link + `Badge` (SLA chip) + `ReporterPatternDot` (imported from PA-PVA-008) |
| Comparable-owning-agency strip | Composite `<div>` with `Avatar` + link + source chip + `ExternalLink` icon button |
| Reporter's message | `<blockquote>` styled with `--lc-border-strong` left border |
| Evidence gallery | Grid of `<button>` thumbnails + `Dialog` viewer modal |
| Related-reports accordion | `Collapsible` |
| Market-impact panel | `Card` with breakdown rows + `MarketImpactChip` (imported from PA-PVA-008) |
| Two-person-rule banner | Custom `<div>` with `Users` icon inside market-impact panel |
| Decision panel | `Card` with `--lc-elevation-md` |
| Confirm-remove modal | `AlertDialog` — with two-person conversion when applicable |
| Confirm-quarantine modal | `Dialog` with numeric `Input` for hours |
| Reject-as-invalid modal | `Dialog` with `Select` (vocab) + `Textarea` (required) |
| Request-info modal | `Dialog` with `Checkbox` multiselect (vocab) + `Textarea` |
| Affected-valuations panel | `Table` (paginated) inside `Tabs` |
| Audit-trail panel | Timeline `<ol>` inside `Tabs` |
| Reporter-history panel | `Table` inside `Tabs` |
| Read-confirm checkbox | `Checkbox` |
| Icons added | `Trash2`, `Pause`, `X`, `MessageCircle`, `Users`, `ExternalLink`, `Paperclip`, `AlertTriangle`, `Copy` |

---

## Sample content (for v0 / mockup)

Show desktop 1440px, LIVE env, single report open (Ahmed Khan's already-sold Villa report from PA-PVA-008 sample row 2):

- **Breadcrumb:** "‹ Back to queue" · queue-position "Report 2 of 14 pending" · Copy link
- **Heading strip:** "Villa · Saadiyat" (title) · pills [Already sold · High · **34 valuations · ±11% (High impact)** · Pending] · address "Saadiyat Beach, Abu Dhabi"
- **Context strips:**
  - Left: Ahmed Khan ⚠ (amber dot) · *Abu Dhabi Prime* · Submitted 1h ago · 46h 58m left · reporter-pattern banner "Ahmed has filed 4 reports against Saadiyat Homes in 21 days."
  - Right: Saadiyat Homes (owning agency) · **OLX** external chip · Scraped 12 days ago via OLX · "Open in source ↗"
- **Side-by-side card:**
  - Delta ribbon: "Δ status: active → sold (observed 2026-08-14)"
  - Left panel "As currently in the pricing pool": Price AED 5,200,000 · Area 380 m² · Beds 4 · Baths 5 · Status **Active** · Last updated 2026-09-02 · Source OLX
  - Right panel "Reporter's claim": Price AED 5,200,000 · Area 380 m² · Beds 4 · Baths 5 · Status **Sold** (highlighted warning) · Sale date **2026-08-14** (highlighted warning) · Sale record attached
- **Reporter's message:** "This villa was sold on 14 August per the DLD record I've attached. Still showing active on OLX and pulling into my Saadiyat comps median. Please remove."
- **Evidence gallery:** 3 files — DLD record screenshot (thumbnail) · OLX current listing screenshot (thumbnail) · photo of the sold placard on the property (thumbnail)
- **Market-impact panel:** 34 valuations · **High** · Median move −11.2% · Max move −18.7% (single valuation) · Top-5 markets: Saadiyat (22), Yas (7), Al Reem (3), Al Raha (1), Al Bateen (1) · Two-person amber banner active
- **Decision panel:** Confirm and remove (filled primary, DISABLED until read-confirm) · Confirm and quarantine (72h default) · Reject as invalid · Request more info · read-confirm checkbox unchecked · audit note
- **Below-fold tabs:** Affected valuations tab open showing paginated list of the 34 valuations

Second variant: **Confirm-remove modal with two-person conversion active** — modal reads "This removal requires a second PA approval…" with confirm text "Propose removal".

Third variant: **Own-case block** — decision panel shows the block copy; all action buttons disabled.

Fourth variant: **Rejected/decided state (read-only)** — status pill "Rejected"; decision panel replaced with "This report has already been rejected by {PA} on {date}." + reason + notes.

Do NOT fabricate reporter confidence scores or removal probabilities. Every field above corresponds to a real payload attribute.

---

## Interactions

**On page load:**
- Fetch `GET /api/admin/pricing/reports/:reportId` scoped to current env.
- In parallel: `GET .../:reportId/affected-valuations?page=1`, `GET .../:reportId/reporter-history?limit=10`, `GET .../:reportId/audit-trail`.
- Show skeleton for heading + side-by-side + right column while loading.
- On 404: full-page "Report not found or already withdrawn." + back-to-queue link.
- On 403: "You need comparable-review access to view this page." + back link.
- On `is_own=true`: page renders in read-only mode; decision panel shows own-case block.

**On read-confirm checkbox:** toggles enabled state of Confirm-remove + Confirm-quarantine + Reject-as-invalid. Request more info remains enabled regardless (corrigible).

**On Confirm and remove click:**
- If read-confirm not checked: shake + inline error.
- If own-case: never reachable (button disabled).
- Step-up if `market_impact.tier=high` OR PA's session step-up expired.
- Opens `AlertDialog` per copy. If two-person applies, modal converts and confirm button text = "Propose removal".
- Confirm → `POST /:reportId/confirm-remove` with `{ notes }`. On 202: toast "Removed comparable. Recalculating {N} valuations…" + Undo (5s). On two-person: toast "Sent to PA-APR-001 for second approval." + auto-navigate back to queue after 2s.
- On success: delta-ribbon shrink-and-fade animation.

**On Confirm and quarantine click:** read-confirm required · Dialog with `quarantine_hours` input · POST `/confirm-quarantine` with `{ notes, quarantine_hours }` · toast · stay on page.

**On Reject as invalid click:** read-confirm required · Dialog with reason + notes · POST `/reject-as-invalid` · toast · navigate back to queue after 2s.

**On Request more info click:** Dialog with checklist multiselect + notes · POST `/request-info` · toast · stay on page (PA may want to open the next pending report via breadcrumb-back).

**On Undo (5s window, single-row only):** `POST /:reportId/undo-decision` — reverses. If recalc job has committed (>5s and job started): toast "Can't undo — recalculation has committed."

**On evidence thumbnail click:** opens evidence-viewer modal with the file rendered inline.

**On affected-valuations row click:** opens PA-PVA-002 valuation detail in new tab.

**On env-switch mid-page:** redirect to queue (report is env-scoped).

**On keyboard shortcut (detail-view):**
- `R` — confirm-remove
- `Q` — confirm-quarantine
- `X` — reject-as-invalid
- `I` — request more info
- `C` — copy link
- `J` — next pending report
- `K` — previous pending report
- `Esc` — back to queue
- `?` — shortcuts sheet

---

## State variants — deltas only

Inherits PA-MOD-001 + PA-MOD-002 variants. Detail-view additions:

| Variant | Trigger | Behavior |
|---|---|---|
| **Ready — pending** | Fetch 200, status=pending, is_own=false | Decision panel enabled (subject to read-confirm). |
| **Ready — high-impact** | `market_impact.tier=high` | Two-person amber banner in market-impact panel; Confirm-remove modal converts on click. |
| **Ready — own-case** | `is_own=true` | All decision buttons disabled; block copy shown; page renders read-only for inspection. |
| **Ready — already-decided** | `status ≠ pending` | Decision panel replaced with "already {status} by {PA} on {date}" + reason + notes + read-only. |
| **Ready — pending_second_approval** | Prior PA proposed removal | Yellow banner spans page top: "Awaiting second PA approval — proposed by {PA1} on {date}." Original PA sees "Recall proposal" button (fires `POST /:reportId/recall-proposal`); other PAs see "Confirm this removal" primary button. |
| **Confirm-remove in-flight** | POST fired | Buttons disabled + spinner in Confirm-remove button; delta-ribbon still shown. |
| **Confirm-remove success (single-PA)** | 202 | Status flips to `confirmed_removed`; toast + Undo (5s); auto-navigate back to queue after 2s. |
| **Confirm-remove success (two-person-proposed)** | 202 with `REMOVE_PROPOSED` | Status flips to `pending_second_approval`; toast; auto-navigate. |
| **Undo blocked** | Undo click after recalc-committed | Toast "Can't undo — recalculation has committed." |
| **Zero-evidence** | `evidence.file_count=0` | Amber inline block above evidence-gallery header; not a decision blocker. |
| **Reporter-pattern flagged** | `reporter.pattern_flag=true` | Amber banner spans below context strips. |
| **Related-reports present** | Server returns prior reports on same comparable | Accordion header shows count; PA-visible warning if a related report was already resolved with a different outcome. |
| **Env-switch mid-flow** | PA-NAV-001 env change | Redirect to queue in new env. |

---

## Accessibility

Inherits from PA-MOD-001 + PA-MOD-002. **PA-PVA-008b-specific additions:**

- Side-by-side card is `role="table"` with `<caption>` "Comparison of currently stored comparable vs reporter's claim." Highlighted (changed) cells carry `aria-label="Changed by reporter — {oldValue} to {newValue}"`.
- Delta ribbon `role="status"` `aria-live="polite"` — SR announces "Delta: {field} changed from {currentValue} to {observedValue}, {deltaPct} percent."
- Market-impact panel two-person banner is `role="alert"` on high-impact rows (announces once on load).
- Decision panel buttons carry `aria-describedby` linking to the read-confirm checkbox when disabled ("Enable this button by confirming you have reviewed the evidence.").
- Confirm-remove `AlertDialog` uses `aria-describedby` naming the recalculation-count and notification consequence.
- Two-person-conversion modal explicitly announces "This decision requires a second approval" via `aria-live="polite"`.
- Evidence gallery thumbnails carry `aria-label="Evidence file {N}: {filename} — {size} — click to view."` Viewer modal traps focus.

---

## Anti-patterns (do not do these)

Inherits from PA-MOD-001 + PA-MOD-002. **PA-PVA-008b-specific additions:**

- Do NOT allow `Confirm and remove` without the read-confirm checkbox.
- Do NOT allow `Confirm and remove` on high-market-impact rows without either (a) step-up + two-person conversion OR (b) a second PA's approval already recorded.
- Do NOT hide the market-impact tier from the decision surface — it must be visible in the same viewport as the decision panel.
- Do NOT let the delta ribbon disappear during the confirmation modal — the diff must stay legible while PA is reading the modal copy.
- Do NOT permit Undo after the recalc job has committed — the client must respect the server's `RECALC_COMMITTED` refusal.
- Do NOT show the comparable-owning-agency link as a hostile action (avoid destructive tinting) — this is an arbitration, not a takedown.
- Do NOT surface the reporter-pattern amber banner as a policy verdict — it's a signal PA reads; the banner copy stays informational.

---

## Backend contract

**Single-item endpoint — `[BE-CMR-11]`:** `GET /api/admin/pricing/reports/:reportId` — NEW.

**Response 200** (extends the queue payload with detail-only blocks):

```json
{
  "id": "cmr_abc123",
  "created_at": "…",
  "sla_hours_remaining": 46.9,
  "status": "pending",
  "reason_category": "already_sold",
  "severity": "high",
  "reporter": { "…": "…", "pattern_flag": true, "pattern_signals": { "reports_against_agency_last_30d": 4, "days_window": 21 } },
  "comparable": {
    "id": "cmp_saadiyat_villa",
    "title": "Villa · Saadiyat",
    "address_line": "Saadiyat Beach, Abu Dhabi",
    "thumb_url": null,
    "source": "external_scrape",
    "source_display": "OLX",
    "source_url": "https://www.olx.ae/…",
    "owning_agency": { "id": "…", "name": "Saadiyat Homes", "tenant_url": "…" },
    "current_fields": {
      "price": 5200000, "currency": "AED", "property_type": "villa",
      "bedrooms": 4, "bathrooms": 5, "area_sqm": 380,
      "status": "active", "last_updated_at": "2026-09-02T…", "scraped_days_ago": 12
    }
  },
  "reporter_claim": {
    "reported_field": "status",
    "observed_value": "sold",
    "observed_at": "2026-08-14",
    "reason_text": "This villa was sold on 14 August per the DLD record …",
    "field_diffs": [ { "field": "status", "current": "active", "observed": "sold" }, { "field": "sale_date", "current": null, "observed": "2026-08-14" } ]
  },
  "evidence": { "file_count": 3, "files": [ { "filename": "dld_record.png", "…": "…" } ] },
  "market_impact": {
    "tier": "high",
    "valuations_affected": 34,
    "pct_move_median": -11.2,
    "pct_move_max": -18.7,
    "top_markets": [ { "market": "Saadiyat", "count": 22 }, { "market": "Yas", "count": 7 } ]
  },
  "related_reports": [ { "id": "…", "reporter": "…", "reason_category": "…", "status": "…", "decided_at": "…" } ],
  "is_own": false,
  "requires_two_person": true,
  "env": "live"
}
```

**Companion endpoints:**
- `GET /:reportId/affected-valuations?page=1&pageSize=25` — `[BE-CMR-12]`, paginated list for the tab.
- `GET /:reportId/reporter-history?limit=10` — `[BE-CMR-13]`, reporter's last 10 reports with outcomes.
- `GET /:reportId/audit-trail` — `[BE-CMR-14]`, PA-AUD-001 embedded timeline.

**Decision endpoints — `[BE-CMR-02]`:**
- `POST /:reportId/confirm-remove` — `{ notes }`. On single-PA path: tombstones comparable + enqueues `recalculationJobService`. On two-person path: records `REMOVE_PROPOSED`, appends to `PA-APR-001`, returns `202` with `{status: "pending_second_approval", approval_request_id: "…"}`.
- `POST /:reportId/confirm-quarantine` — `{ notes, quarantine_hours }`.
- `POST /:reportId/reject-as-invalid` — `{ reason_code, notes }`.
- `POST /:reportId/request-info` — `{ reason_code, notes, requested_evidence: [...] }`.
- `POST /:reportId/undo-decision` — reverses within 5s if recalc not committed; refuses `RECALC_COMMITTED` otherwise.
- `POST /:reportId/recall-proposal` — original proposer withdraws pending second-approval (before second PA acts).

**Prerequisites (shared with PA-PVA-008 § Backend contract):**
- `[BE-CMR-11]` `GET /:reportId` endpoint — ~1 day.
- `[BE-CMR-12]` affected-valuations endpoint (walks `valuationService` for references) — ~1 day.
- `[BE-CMR-13]` reporter-history endpoint — ~0.5 day.
- `[BE-CMR-14]` audit-trail endpoint (reuses PA-AUD-001 writer for reads) — ~0.5 day.
- All `[BE-CMR-01..10]` from PA-PVA-008 apply to this brief as well.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/valuation/BadComparableReportDetailPage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/admin/valuation/comparable-reports/:reportId" element={<BadComparableReportDetailPage />} />` behind `PAConsoleGuard` (capability pack `comparable-review`).
- **Component reuse:**
  - `MarketImpactChip` — imported from PA-PVA-008 (or promoted to shared `web/src/components/ui/`).
  - `ReporterPatternDot` — imported from PA-PVA-008.
  - `PA-APR-003` action-confirmation flow — reused for two-person conversion.
  - `PA-AUD-001` audit-trail component — embedded in the tab.
- **New components:**
  - `BadComparableReportDetailPage.tsx` — page shell + data + env context.
  - `SideBySideDiffCard.tsx` — the two-panel comparison with delta ribbon; **reusable in future WingCaster diff surfaces (e.g. price-history reviews)**.
  - `EvidenceGallery.tsx` — grid + viewer modal.
  - `AffectedValuationsTab.tsx` — paginated table.
  - `ReporterHistoryTab.tsx` — table.
  - `ArbitrationDecisionPanel.tsx` — decision panel with the four buttons + read-confirm + two-person branching.
- **Data layer:**
  - Hook: `useBadComparableReport(reportId, env)`.
  - Hook: `useAffectedValuations(reportId, page)`.
  - Mutation hooks: `useConfirmRemove`, `useConfirmQuarantine`, `useRejectAsInvalid`, `useRequestInfo`, `useUndoDecision`, `useRecallProposal`.
- **Test discipline:**
  - Unit: `SideBySideDiffCard` renders diffs correctly (single-field, multi-field, no-diff edge); `MarketImpactChip` tier rendering; `ArbitrationDecisionPanel` read-confirm gating.
  - Integration: page load × read-confirm × confirm-remove single-PA happy path × confirm-remove two-person conversion × confirm-quarantine with custom hours × reject-as-invalid × request-info × undo-within-grace × undo-blocked-after-recalc × own-case block × already-decided read-only × recall-proposal × env-switch mid-flow × 404 × 403.
  - RTL + Broadcast (`no-raw-hex.test.ts`) + real-Postgres pending → confirmed_removed → recalc-enqueued end-to-end (via `recalculationJobService`).
  - Accessibility: axe-core on loaded + read-confirm-checked + modal-open + two-person-conversion + own-case-block states.
- **Perf:** side-by-side card renders synchronously; evidence gallery lazy-loads image thumbnails; affected-valuations tab lazy-loads on tab select.
- **Copy/i18n:** all strings in `web/src/locales/en/paComparableReportDetail.json` + `ar/paComparableReportDetail.json`. `[TRANSLATION-PENDING]` in AR.

---

## Broadcast alignment callouts (short)

**Refer to PA-MOD-001 §Broadcast alignment callouts as the anchor.** All page-shell, sub-header, focus-ring, radii, elevation, motion, and no-raw-hex rules apply UNCHANGED.

PA-PVA-008b-specific overlays:
- Side-by-side card highlighted (changed) fields use `--lc-status-warning-bg` + `--lc-status-warning-fg`; unchanged fields stay `--lc-text-primary` on `--lc-surface-raised`. Never tint an unchanged field.
- Delta ribbon uses `--lc-status-warning-bg` full-width band across the card top; numeric values via `<Numeric>`.
- Reporter-pattern amber banner uses `--lc-status-warning-bg` + `--lc-status-warning-fg` + `⚠` glyph — same visual weight as market-impact two-person banner (both are "read this before deciding" signals).
- Market-impact two-person banner uses `--lc-status-warning-bg` + `Users` lucide icon — never danger red; this is a policy notice, not a violation.
- Confirm-and-remove button uses filled primary variant (`--lc-action-primary`) — the loud action; hover `--lc-action-primary-hover` (darker).
- Confirm-and-quarantine button uses outline warning variant (`--lc-status-warning` outline).
- Decision panel `--lc-elevation-md` (heavier than market-impact panel's `--lc-elevation-sm`) — signals decision weight.
- Delta-ribbon shrink-and-fade on successful remove uses `--lc-easing-emphasis` at `--lc-duration-slow`; single trigger only, not repeating. Reserved for this WF-05 moment.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Platform Admin (PA) bad-comparable-report detail screen (PA-PVA-008b) — MENA real-estate B2B SaaS admin surface. Desktop 1440px primary. This is where a Platform Admin reads a single "this comparable is wrong" report side-by-side with the currently-stored comparable, weighs market impact, and arbitrates — Confirm and remove / Confirm and quarantine / Reject as invalid / Request more info (WF-05 approver-side). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, all tokens Broadcast semantic (--lc-*).

This is a DELTA brief inheriting from PA-MOD-001 (queue) + PA-MOD-002 (detail sibling). Critical differences: SIDE-BY-SIDE diff card is the primary reading surface; market-impact tier drives two-person rule (high-impact confirmed-removes require a second PA); four decision buttons on the decision panel (not three); reporter-pattern amber banner surfaces coordinated reporting.

First pass: render the desktop 1440px layout with LIVE env badge (green), a Pending high-impact report open (sample content = Ahmed Khan's already-sold Villa report from PA-PVA-008 sample row 2). Show the sub-header with "Report 2 of 14 pending" chip, the two context strips + reporter-pattern amber banner, the side-by-side card with delta ribbon "Δ status: active → sold (observed 2026-08-14)", the evidence gallery with 3 thumbnails, the market-impact panel with two-person amber banner active, the decision panel with all four buttons + read-confirm checkbox unchecked. Below the fold, Affected valuations tab open showing 5 sample rows.

LTR English only for this pass — I'll ask for two-person-conversion modal, own-case block, already-decided read-only, TEST env, RTL, dark as follow-ups.

Follow the copy table exactly. Do NOT fabricate confidence scores or removal probabilities. Every value maps to a defined backend payload attribute.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. Read-confirm checkbox checked → Confirm-remove button enabled (primary filled).
2. Confirm-remove modal open with two-person conversion active — body reads "This removal requires a second PA approval…" and confirm button "Propose removal".
3. Own-case block — decision panel replaced with block copy, all buttons disabled.
4. Already-decided read-only — status pill "Rejected", decision panel replaced with "already rejected by {PA} on {date}" summary.
5. Pending_second_approval state — yellow banner across the page; other PA sees "Confirm this removal" primary; proposer sees "Recall proposal".
6. Zero-evidence variant — evidence gallery replaced with amber "no evidence" block; consider `Request more info`.
7. TEST env — amber badge + full-width warning strip; decision panel copy adjusted.
8. Confirm-quarantine dialog open — numeric input for hours (default 72), notes textarea.
9. Reject-as-invalid dialog open — Select for reason vocab, Textarea for notes.
10. Audit-trail tab open showing full timeline.
11. Reporter-history tab open showing this reporter's last 10 outcomes.
12. RTL Arabic at desktop 1440px with `[TRANSLATION-PENDING]`; side-by-side card MIRRORS (current on right, reporter's claim on left).
13. Dark mode version of pass 1.

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-PVA-008b/` + screenshot to `docs/design/mockups/PA-PVA-008b-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 13 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/PA-PVA-008b/`.
- [ ] Cursor Wave-2 Week-5 dispatch prompt references this brief + the mockup paths + the paired PA-PVA-008 brief.
- [ ] `[BE-CMR-11..14]` filed in kickoff §5a (in addition to `[BE-CMR-01..10]` from PA-PVA-008).
- [ ] `SideBySideDiffCard` primitive shipped as a reusable UI component (documented for reuse in future WingCaster diff surfaces).
- [ ] `ArbitrationDecisionPanel` component shipped with the two-person-conversion flow tested end-to-end against PA-APR-001/003.
- [ ] Recalculation-trigger integration verified — a `confirm-remove` on a low-impact row in a test-env session enqueues `recalculationJobService` and the returned job ID is visible in `/admin/pricing/recalculation-jobs`.
