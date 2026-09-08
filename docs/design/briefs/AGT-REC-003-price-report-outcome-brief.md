# Screen Brief — AGT-REC-003 · Agent price-report outcome (WF-06 Recipient)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §25 entry `AGT-REC-003`. Week 5 per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 48 + §6 Week 5. Closes the WF-06 (Agent price report) recipient loop after `PA-PVA-009b` (PA review + decision).

**DELTA NOTICE — this brief is a delta on the AGT-REC-004 anchor.** All reusable Broadcast primitives — `<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>` — are defined in `docs/design/briefs/AGT-REC-004-application-outcome-brief.md` §Reusable REC-family patterns. This brief inherits those four components verbatim (props, state map, dot colors, motion tokens, empty-state rules, action-variant discipline, no-destructive-red doctrine). It spells out ONLY per-screen deltas: route, states, copy, backend, and the weighting-signal panel that is unique to price reports.

---

## 🎨 Broadcast alignment

**This brief inherits `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` and every Broadcast callout from the AGT-REC-004 anchor.** Do not restate them. Only per-screen deviations from anchor are listed below.

**Per-screen callouts:**

- **Status hero — APPROVED-AND-INCORPORATED** IS `emphasis="loud"`. The Pro-tier agent authored an authoritative price signal that WingCaster now uses in the platform's pricing model. Full-bleed orange hero, white `CheckCircle2` in a white ring — this is the "your data is now the truth" moment and it deserves the anchor's loud case. Pro-tier agents build reputation through this loop; the celebratory register is intentional.
- **Status hero — APPROVED-AS-SIGNAL-ONLY** uses `emphasis="default"` — sunken surface + `CheckCircle2` in `var(--lc-accent-bold-edge)`. The report is accepted but weighted alongside other signals rather than treated as authoritative. Provisional acceptance — inherits the same visual grammar as REC-002's APPROVED-AND-QUARANTINED per anchor extension.
- **REJECTED-WITH-REASON** uses the anchor's `state="rejected"` surface. Reason from controlled vocabulary rendered as the resolver message. Never red.
- **REQUEST-FOR-MORE-INFO** uses the anchor's `state="more_info"` surface — the ONE legal warning-tint hero in the family.
- **Weighting panel** (unique to this screen — no anchor equivalent) sits between the resolver message and the CTA block. `--lc-surface-sunken` well, `var(--lc-radius-lg)`, padding `var(--lc-space-lg)`. Contains the PA's applied weight (0-100%) visualized as a horizontal bar with tick marks + a plain-language explanation of how the signal is being used. Bar fill uses `var(--lc-accent-bold)` with `var(--lc-accent-bold-edge)` 1px outline (accent-bold-needs-a-boundary rule). Renders in APPROVED-AND-INCORPORATED (weight = 100%) and APPROVED-AS-SIGNAL-ONLY (weight < 100%).
- **Original report accordion** — collapsible `<Accordion>`, header "What you originally reported", closed by default. Body echoes market segment + price bands + methodology notes + attachments. `--lc-surface-raised` + `--lc-elevation-sm`.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-REC-003 |
| Screen name | Agent price-report outcome |
| Persona | Pro-tier Agent — submitter of the price report at AGT-APR-005 |
| Device targets | Mobile 375px (primary — opens from push notification), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Primary: `/reports/prices/:reportId/outcome`. Matrix-legacy alias: `/agent/pricing/reports/:id/outcome` (same component). Notification deep-link: `wingcaster://price-report/:id`. |
| Current state | MISSING — must ship with WF-06 cluster (Week 5, paired with PA-PVA-009/009b). |
| Workflow role | WF-06 role=Recipient. Closes loop after `PA-PVA-009b` decision. |
| Metering | Pro-tier only (metering enforced upstream at AGT-APR-005 submit; this screen renders for anyone who has a report in the system regardless of current tier — a downgraded agent can still see their prior report outcomes). |
| Backend prerequisites | ✅ `agent_price_reports` table (created with WF-06 backend, existing) · ⏳ user-scoped read endpoint `GET /api/users/me/price-reports/:id` — thin alias over existing `GET /api/pricing/my-agent-price-reports/:id`, returns 404 (not 403) for other users' reports · ⏳ Push template `price_report.resolved` (piggybacks on existing dispatcher — one template row NEW) · ⏳ Notification emission at status-transition write |

---

## Purpose

A Pro-tier agent who submitted a price report at `AGT-APR-005` (their expert view on a market segment's current pricing — e.g. "1BR apartments in Downtown Dubai are trading at AED 1.4-1.6M net-net right now") opens this screen to see what the Platform Administrator did with it. Seven states — PENDING (in PA queue), APPROVED-AND-INCORPORATED (PA accepted as authoritative signal at 100% weight), APPROVED-AS-SIGNAL-ONLY (PA accepted but weighted < 100% alongside other data), REJECTED-WITH-REASON (PA declined the signal), REQUEST-FOR-MORE-INFO (PA needs methodology clarification or additional data), EXPIRED (PA SLA elapsed), WITHDRAWN (agent recalled).

**Emotional stakes:** moderate-to-high. Price reports are the Pro-tier agent's platform for market authority — an APPROVED-AND-INCORPORATED outcome means their signal is now shaping WingCaster's platform-level pricing model and (per matrix note on SHR-PUB-002) may be featured on their public agent profile. This is thought-leadership currency. The screen must respect that: incorporation reads as "you shaped the market view"; signal-only reads as "we heard you, we weighted you"; rejection reads as "here's specifically why the methodology or data didn't clear the bar" — never dismissive.

Success outcome per state:
- APPROVED-AND-INCORPORATED → agent taps "View live signal" → lands on the market-pricing surface where their report is now visible.
- APPROVED-AS-SIGNAL-ONLY → agent sees the weight applied + can view how the platform is using the signal.
- REJECTED-WITH-REASON → two respectful onward paths: revise-and-resubmit or dismiss.
- REQUEST-FOR-MORE-INFO → primary CTA opens `AGT-APR-005` pre-loaded with prior submission + a prompt highlighting what PA needs.
- PENDING → soft reassurance + Withdraw affordance + SLA line.
- EXPIRED / WITHDRAWN → re-submit affordance; history preserved.

---

## Design goals

1. **State legible in 200ms.** Anchor rule — hero glyph + label + timestamp is the answer.
2. **Incorporated vs signal-only is doctrinally load-bearing.** INCORPORATED = loud orange (your data is now authoritative). SIGNAL-ONLY = sunken (accepted at a weight). Never collapse them — Pro-tier agents will read the visual difference as a status signal on their own reputation.
3. **The weighting panel earns its space.** Pro-tier agents want to know exactly how their signal is being used. A visualized weight bar (0-100%) with a one-line explanation is worth more than three paragraphs of prose.
4. **Rejection cites reason.** Controlled-vocabulary rejection reason (methodology unclear / insufficient sample / conflicts with recent transactions / outside PA competency / other) rendered as the resolver message — never a generic "declined."
5. **Original submission is a click away, not in your face.** Accordion pattern per REC-002 — the agent knows what they submitted; they came here for the outcome.
6. **Anchor discipline.** No new anchor components. Any REC-family visual pattern needed but missing → escalate to REC-004 anchor update.

---

## Layout

### Mobile 375px (primary)

Single scrolling column. Same top-nav shell as anchor.

1. **Top nav** — reuse anchor. Title: "Price report status".
2. **`<StatusHero>` band** — anchor pattern. State-dependent.
3. **Report identity card** — full-width, `--lc-surface-raised` + `--lc-elevation-sm`, `var(--lc-radius-lg)`. Contents: report title (`heading-3`, e.g. "1BR apartments · Downtown Dubai · Sep 2026") + market snippet (`body-sm` muted) + submitted timestamp via `<Numeric>` + chevron opening the full report in a `<Sheet>`.
4. **`<OutcomeTimeline>` rail** — 4 events: Submitted → In PA review → Decided → Resolved. Anchor states + colors + pulse.
5. **`<ResolverMessage>` card** — anchor pattern. Attribution = PA reviewer with "Platform Administrator" role chip. Body = PA's decision message.
6. **Weighting panel** (approved-only, unique to REC-003) — sunken well:
   - Line 1: "Applied weight: **{weight}%**" (Numeric)
   - Horizontal bar 0-100% with tick marks at 25/50/75/100. Fill accent-bold with edge outline.
   - Line 2 plain-language: "Your signal is being used as **{authoritative | weighted alongside other signals}** in {market_segment_label}."
   - Line 3 (INCORPORATED only): "Signal is live on the platform pricing model from {effective_on}."
7. **Original report accordion** — closed by default. Header "What you originally submitted" + report ID via `<Numeric>` right-aligned. Body: market segment chip + price-band table + methodology paragraph + attachments (max 3 shown, "+N more" chip).
8. **`<PrimaryCtaPerState>` block** — sticky bottom bar mobile, anchor rules.
9. **Contact support link** — anchor wording.

### Tablet 768px & Desktop 1440px

Same 65/35 split as anchor. Left column: hero, report identity card, timeline, resolver message, weighting panel, original report accordion, support link. Right sidebar: `<PrimaryCtaPerState>` stack + context helper card + small-print (report ID, submitted-at, decided-at, effective-on).

### RTL

Full mirror per anchor. Weighting-bar fill still LTR-oriented (percentages are magnitude, not sequence) but tick labels and percent numeral stay LTR bidi-embedded.

---

## Copy (English) — deltas from anchor

Fill Arabic during MENA copywriter pass — mark `[TRANSLATION-PENDING]`.

| Slot | Copy |
|---|---|
| Top nav title | Price report status |
| Status hero — PENDING label | Awaiting Platform Administrator review |
| Status hero — PENDING timestamp | Submitted {relative} · {absolute} |
| Status hero — APPROVED-AND-INCORPORATED label | Your price signal is now live |
| Status hero — APPROVED-AND-INCORPORATED timestamp | Incorporated {relative} · {absolute} |
| Status hero — APPROVED-AS-SIGNAL-ONLY label | Your signal is accepted as one of several inputs |
| Status hero — APPROVED-AS-SIGNAL-ONLY timestamp | Decided {relative} · {absolute} |
| Status hero — REJECTED-WITH-REASON label | We reviewed your report and won't publish it |
| Status hero — REJECTED-WITH-REASON timestamp | Decided {relative} · {absolute} |
| Status hero — REQUEST-FOR-MORE-INFO label | The reviewer needs a bit more from you |
| Status hero — REQUEST-FOR-MORE-INFO timestamp | Requested {relative} · {absolute} |
| Status hero — EXPIRED label | This report timed out |
| Status hero — EXPIRED timestamp | Expired {relative} · {absolute} |
| Status hero — WITHDRAWN label | You withdrew this report |
| Status hero — WITHDRAWN timestamp | Withdrawn {relative} · {absolute} |
| Report identity card — chevron aria | View this price report |
| Timeline — event 1 label | Submitted |
| Timeline — event 2 label | In Platform Administrator review |
| Timeline — event 2 empty | Not yet picked up |
| Timeline — event 3 label | Decided |
| Timeline — event 3 pending | Awaiting decision |
| Timeline — event 4 (incorporated) | Signal live |
| Timeline — event 4 (signal-only) | Weighted into pricing |
| Timeline — event 4 (rejected) | Not published |
| Timeline — event 4 (more-info) | More info requested |
| Timeline — event 4 (expired) | Timed out |
| Timeline — event 4 (withdrawn) | Withdrawn |
| Resolver role chip | Platform Administrator |
| Weighting panel — weight-line label | Applied weight: |
| Weighting panel — bar aria | Signal weight bar |
| Weighting panel — usage (incorporated) | Your signal is being used as **authoritative** in {market_segment_label}. |
| Weighting panel — usage (signal-only) | Your signal is being **weighted alongside other signals** in {market_segment_label}. |
| Weighting panel — live-on (incorporated) | Signal is live on the platform pricing model from **{effective_on}**. |
| Original report accordion header | What you originally submitted |
| Original report — market segment prefix | Market segment: |
| Original report — attachments label | Attachments |
| PENDING detail — SLA line | Typical PA review: **72 hours** · Report expires **{expires_on}** |
| PENDING detail — reassurance | We'll notify you the moment a reviewer decides. |
| REJECTED detail — encouragement | You can revise the methodology or add supporting data and submit a fresh report. Your original is preserved in your history. |
| REJECTED detail — reason prefix | Reviewer noted: |
| REQUEST-FOR-MORE-INFO detail | The reviewer flagged: **{missing_info_summary}**. Add it and we'll re-open the review. |
| EXPIRED detail | This report timed out after 30 days without a decision. You can submit a fresh report; your original is preserved in your history. |
| WITHDRAWN detail | You withdrew this report on **{withdrawn_on}**. You can submit a fresh report anytime. |
| CTA — primary (pending, disabled chip) | Awaiting reviewer |
| CTA — primary (approved-incorporated) | View live signal |
| CTA — primary (approved-signal-only) | View how it's used |
| CTA — primary (rejected-with-reason) | Revise and resubmit |
| CTA — primary (more-info) | Provide the requested info |
| CTA — primary (expired) | Submit a fresh report |
| CTA — primary (withdrawn) | Submit a fresh report |
| CTA — secondary (approved-incorporated) | View on your public profile |
| CTA — secondary (approved-signal-only) | View original submission |
| CTA — secondary (rejected) | Close and continue |
| CTA — secondary (more-info) | View original submission |
| CTA — secondary (expired) | Close and continue |
| CTA — secondary (withdrawn) | Close and continue |
| CTA — tertiary (pending) | Withdraw report |
| CTA — tertiary (more-info) | Withdraw report |
| Withdraw dialog title | Withdraw your price report? |
| Withdraw dialog body | The reviewer will stop looking at this. You can submit a fresh report anytime. |
| Withdraw dialog confirm | Withdraw |
| Withdraw dialog cancel | Keep report open |

---

## Component palette

Same as anchor. No net-new primitives on this screen. Deltas:
- **Report identity card** — `Card` + `Sheet` for the drill-in (mirrors anchor's agency card).
- **Original report accordion** — `Accordion` single-item.
- **Weighting panel** — plain `<section>` inside `--lc-surface-sunken` well; horizontal bar built from two `<div>`s (track + fill) with `role="meter"` and `aria-valuenow / aria-valuemin / aria-valuemax`. Tick marks are absolute-positioned `<span>` in `--lc-border-strong`.

---

## Interactions

- **On load:** `GET /api/users/me/price-reports/:reportId`. 404 → not-found fallback per anchor. 200 → render per state.
- **Poll for state change:** 60s + focus revalidate. Hero cross-fade at `var(--lc-duration-base)` on transition.
- **Report identity card chevron:** opens `<Sheet>` with the full report — no route change.
- **Primary CTA (approved-incorporated) "View live signal":** navigates to the market-pricing surface (`AGT-APR-001?highlight_signal_id=…`) with the agent's signal highlighted.
- **Primary CTA (approved-signal-only) "View how it's used":** navigates to a "How this signal is weighted" explainer surface (fallback: same route as View live signal with a `?weighted=true` query flag if explainer page not yet built).
- **Primary CTA (rejected) "Revise and resubmit":** navigates to `AGT-APR-005?resumeReportId=…` — form pre-loaded with prior submission; server treats submission as a fresh report on save.
- **Primary CTA (more-info) "Provide the requested info":** navigates to `AGT-APR-005?resumeReportId=…&mode=more_info` — form pre-loaded with missing-info prompt banner.
- **Primary CTA (expired / withdrawn) "Submit a fresh report":** navigates to `AGT-APR-005?forReportId=…`.
- **Secondary "View on your public profile":** navigates to `SHR-PUB-002` (public agent profile) scrolled to the signal section.
- **Tertiary "Withdraw report" (PENDING / MORE-INFO):** opens `AlertDialog` → POST `/api/users/me/price-reports/:id/withdraw` → state flips to WITHDRAWN → hero cross-fades.
- **Timeline live-updating:** anchor pulse rules.
- **Contact support link:** routes to `SHR-SUP-001` with pre-filled context "Price report ID: {id}". Never `mailto:`.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Initial fetch | Skeleton mirror per anchor. |
| **Not found (404)** | Bad reportId or foreign report | Anchor fallback + Back to My Reports button. |
| **Network error** | Fetch failed | Anchor retry fallback. |
| **PENDING** | `status = 'pending'` | Sunken hero, live-pulse "Decided" dot, disabled CTA chip + Withdraw tertiary. SLA "72 hours". |
| **PENDING — in-review** | `status = 'pending' AND picked_up_at IS NOT NULL` | "In PA review" event shows completed dot + timestamp. |
| **APPROVED-AND-INCORPORATED** | `status = 'approved' AND weight = 100` | LOUD orange hero. All 4 dots complete. Weighting panel shows 100% fill + "authoritative" copy + effective-on line. Primary "View live signal". |
| **APPROVED-AS-SIGNAL-ONLY** | `status = 'approved' AND weight < 100` | Sunken hero + `CheckCircle2` in `--lc-accent-bold-edge`. Weighting panel shows weight fill + "weighted alongside other signals" copy. Primary "View how it's used". |
| **REJECTED-WITH-REASON** | `status = 'rejected'` | Anchor rejected surface. Resolver message carries controlled-vocabulary reason. Primary "Revise and resubmit" + secondary "Close and continue". |
| **REQUEST-FOR-MORE-INFO** | `status = 'more_info_requested'` | Anchor `more_info` surface. Resolver message specifies what's missing. Primary "Provide the requested info" + tertiary Withdraw. |
| **EXPIRED** | `status = 'expired'` | Hourglass muted hero. Re-submit primary + Close secondary. |
| **WITHDRAWN** | `status = 'withdrawn'` | Muted hero. Re-submit primary + Close secondary. |
| **SUPERSEDED** | `status = 'closed_as_duplicate' AND superseded_by_report_id IS NOT NULL` | Anchor `superseded` state (`Layers` glyph). Copy: "You submitted another report about the same market segment. This one is closed as a duplicate." + link. |
| **Push-update arrived while viewing** | State changed on backend | Anchor cross-fade + `aria-live` announcement. |
| **RTL** | Locale = ar | Full mirror per anchor. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap. |

**Net-new state variants beyond anchor:** `APPROVED-AS-SIGNAL-ONLY` is a NEW distinction within the `approved` family that requires `emphasis="default"` on the anchor's `<StatusHero>` for an approved state — same anchor extension already flagged by REC-002 (QUARANTINED). One shared anchor amendment PR covers both REC-002 and REC-003. `SUPERSEDED` uses the anchor's existing state map entry — no anchor change required.

---

## Accessibility

Anchor rules apply verbatim. Deltas:
- Weighting panel bar has `role="meter"`, `aria-valuenow="{weight}"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Signal weight applied by Platform Administrator"`.
- Weight percentage announced as "{weight} percent" not "{weight}%" (screen reader consistency).
- Weighting-panel tick marks are decorative (`aria-hidden="true"`) — the meter value carries the semantic weight.
- Original report accordion uses `<Accordion>` semantics.
- Live effective-on date via `<Numeric>` with `aria-label` expanding relative → absolute.

---

## Backend contract

**Endpoint:** `GET /api/users/me/price-reports/:reportId`

**Response 200:**
```json
{
  "report": {
    "id": "apr_01H8...",
    "status": "pending" | "approved" | "rejected" | "more_info_requested" | "expired" | "withdrawn" | "closed_as_duplicate",
    "weight": 100 | 75 | 50 | 25 | 0 | null,
    "superseded_by_report_id": null | "apr_01H8...",
    "title": "1BR apartments · Downtown Dubai · Sep 2026",
    "market_segment_label": "Downtown Dubai · 1BR apartments",
    "price_bands": [{"label": "Net-net low", "value_aed": 1400000}, ...],
    "methodology_notes": "Based on 14 direct transactions in Aug 2026...",
    "attachments": [{ "kind": "spreadsheet" | "document" | "chart", "signed_url": "..." }],
    "submitted_at": "2026-09-01T10:22:00Z",
    "picked_up_at": "2026-09-02T14:00:00Z" | null,
    "decided_at": "2026-09-04T09:12:00Z" | null,
    "resolved_at": "2026-09-04T09:12:00Z" | null,
    "effective_on": "2026-09-05T00:00:00Z" | null,
    "expires_at": "2026-10-01T10:22:00Z",
    "sla_hours": 72
  },
  "resolver": {
    "user_id": "usr_01H8...",
    "display_name": "PA-Karim",
    "role_label": "Platform Administrator",
    "avatar_url": "..." | null,
    "message": "Methodology is sound and the transaction sample is strong..." | null,
    "rejection_reason_code": null | "methodology_unclear" | "insufficient_sample" | "conflicts_with_recent_transactions" | "outside_pa_competency" | "other",
    "more_info_summary": null | "Please attach the transaction ledger you referenced..."
  } | null,
  "signal_placement": {
    "live_signal_url": "/market-pricing/signals/sig_01H8..." | null,
    "public_profile_url": "/agents/sara-karim#signals" | null
  } | null
}
```

Server-side scope by caller's `user_id` — foreign reports return **404** (not 403). Existing endpoint `GET /api/pricing/my-agent-price-reports/:id` (per matrix) is the source; add thin `/api/users/me/price-reports/:id` alias for user-scoped-endpoint symmetry.

**Action endpoints:**
- `POST /api/users/me/price-reports/:id/withdraw` — valid when status ∈ `pending | more_info_requested`; flips to `withdrawn`.

**30-day auto-expire:** cron OR write-time check flips `pending` (and `more_info_requested` after 14 additional days) to `expired`; emits `price_report.expired` notification. File `[BE-BLOCKER-12] agent_price_reports.expires_at + auto-expire cron` in kickoff §5a if not already tracked.

**Notification hook:** ONE new push template `price_report.resolved` with variants per terminal status (`incorporated` / `signal_only` / `rejected` / `more_info` / `expired`). Piggybacks on existing dispatcher — no new infra. Deep-link: `wingcaster://price-report/:id` → `/reports/prices/:id/outcome`.

---

## Downstream implementation

- **File to create:** `web/src/pages/PriceReportOutcomePage.tsx`.
- **Route:** `<Route path="/reports/prices/:reportId/outcome" element={<PriceReportOutcomePage />} />` + legacy alias `/agent/pricing/reports/:id/outcome`.
- **Reuses (no new anchor components):**
  - `web/src/components/recipient/StatusHero.tsx`
  - `web/src/components/recipient/OutcomeTimeline.tsx`
  - `web/src/components/recipient/ResolverMessage.tsx`
  - `web/src/components/recipient/PrimaryCtaPerState.tsx`
- **New screen-local components:**
  - `web/src/components/reports/prices/ReportIdentityCard.tsx`
  - `web/src/components/reports/prices/OriginalReportAccordion.tsx`
  - `web/src/components/reports/prices/WeightingPanel.tsx`
- **Data hook:** `web/src/hooks/usePriceReportOutcome.ts` — fetch + 60s poll + focus revalidate.
- **Anchor extension needed:** same amendment as REC-002 — add optional `emphasis="default"` example to anchor's `<StatusHero>` approved-state row so APPROVED-AS-SIGNAL-ONLY can render without a doctrine violation. One shared anchor amendment PR covers REC-002 (QUARANTINED) + REC-003 (SIGNAL-ONLY).
- **Test discipline:** unit tests for the 3 screen-local components + state-parameterized integration tests covering all 8 state variants (pending, pending-in-review, approved-incorporated, approved-signal-only, rejected, more-info, expired, withdrawn, superseded) + withdraw dialog flow + RTL snapshot + `no-raw-hex.test.ts` green + `role="meter"` accessibility assertion on the weighting panel.

---

## Broadcast alignment callouts

All anchor callouts apply verbatim. Screen-specific reminders:
- LOUD orange hero band is legal ONLY for APPROVED-AND-INCORPORATED. SIGNAL-ONLY uses sunken. Never confuse the two.
- Weight percentage via `<Numeric>` — never in UI font.
- Weighting-bar fill `var(--lc-accent-bold)` ALWAYS with `var(--lc-accent-bold-edge)` 1px outline (accent-bold-needs-a-boundary rule). Track `var(--lc-border)`.
- Attachments NEVER render user content without sandbox — same `no-referrer` + `loading="lazy"` + revoke-signed-URLs-after-15min rules as REC-002.
- No `variant="destructive"` on any button. Withdraw is ghost.
- Effective-on date via `<Numeric>` inside the weighting panel — mono + tabular-nums.
- "View on your public profile" secondary CTA is `variant="outline"`, NOT text link — it deserves the affordance since it's the reputational payoff of the incorporated state.

---

## Handoff to v0

Framing prompt (paste before this brief):

```
I'm designing WingCaster's "Agent price-report outcome" screen (AGT-REC-003) — MENA real-estate B2B SaaS, mobile-first, Pro-tier agent persona. It's the recipient screen for WF-06 (Pro agent submits an expert price report on a market segment → Platform Administrator reviews → agent sees outcome here). Seven states: PENDING, APPROVED-AND-INCORPORATED (100% weight, live signal), APPROVED-AS-SIGNAL-ONLY (weighted <100% alongside other data), REJECTED-WITH-REASON, REQUEST-FOR-MORE-INFO, EXPIRED, WITHDRAWN. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen is a DELTA on the AGT-REC-004 anchor (Agency application outcome). Reuse the four anchor components verbatim: StatusHero, OutcomeTimeline, ResolverMessage, PrimaryCtaPerState. Only three screen-local components are new: ReportIdentityCard, OriginalReportAccordion, WeightingPanel (a horizontal 0-100% bar with tick marks and plain-language usage explanation).

First pass: mobile 375px, state = APPROVED-AND-INCORPORATED. LOUD Broadcast-orange hero, "Your price signal is now live". Report identity card ("1BR apartments · Downtown Dubai · Sep 2026"). Timeline with 4 completed events. Resolver message from "PA-Karim, Platform Administrator" confirming incorporation. Weighting panel: 100% fill, "authoritative in Downtown Dubai · 1BR apartments", live-on-2026-09-05 line. Original report accordion closed by default. Sticky bottom CTA: primary "View live signal" + secondary "View on your public profile".

LTR English only for this pass. Follow the copy table exactly.

DESIGN BRIEF FOLLOWS:
```

Iteration order:
1. Mobile, APPROVED-AS-SIGNAL-ONLY (sunken hero, weight-bar at ~50%, "weighted alongside other signals", primary "View how it's used").
2. Mobile, REJECTED-WITH-REASON (neutral hero, controlled-vocab reason in resolver message, primary "Revise and resubmit").
3. Mobile, REQUEST-FOR-MORE-INFO (warning-tint hero, PA's missing-info prompt, primary "Provide the requested info").
4. Mobile, PENDING (sunken hero, pulsing "Decided" node, disabled chip + Withdraw tertiary, SLA "72 hours").
5. Desktop 1440px, APPROVED-AND-INCORPORATED (sticky sidebar CTA + context helper + small-print with effective-on date).
6. RTL Arabic mobile, APPROVED-AND-INCORPORATED (weight-bar orientation preserved LTR since percent is magnitude).
7. Dark mode desktop, APPROVED-AS-SIGNAL-ONLY.
8. Withdraw confirm dialog over PENDING.

Save JSX to `web/src/components/reports/prices/OutcomeScreen/` + screenshots to `docs/design/mockups/AGT-REC-003-<state>.png`.

---

## Definition of done

- [ ] Anchor amendment PR merged first (shared with REC-002): `<StatusHero>` gains `emphasis="default"` example on approved-state row.
- [ ] v0 has produced all 8 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-5 dispatch prompt references this brief + AGT-REC-004 anchor + AGT-REC-002 sibling + mockup paths.
- [ ] `[BE-BLOCKER-12]` (agent_price_reports.expires_at + auto-expire cron) filed in kickoff §5a if not already tracked.
- [ ] Push template `price_report.resolved` filed as a Week-5 backend task.
- [ ] User-scoped alias endpoint `GET /api/users/me/price-reports/:id` filed as a Week-5 backend task.
