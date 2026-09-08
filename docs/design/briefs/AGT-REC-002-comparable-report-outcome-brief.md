# Screen Brief — AGT-REC-002 · Comparable-report outcome (WF-05 Recipient)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §25 entry `AGT-REC-002`. Week 5 per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 47 + §6 Week 5. Closes the WF-05 (Report bad comparable) recipient loop after `PA-PVA-008b` (PA review + decision).

**DELTA NOTICE — this brief is a delta on the AGT-REC-004 anchor.** All reusable Broadcast primitives — `<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>` — are defined in `docs/design/briefs/AGT-REC-004-application-outcome-brief.md` §Reusable REC-family patterns. This brief inherits those four components verbatim (props, state map, dot colors, motion tokens, empty-state rules, action-variant discipline, no-destructive-red doctrine). It spells out ONLY per-screen deltas: route, states, copy, backend, and the small-print / evidence panel that is unique to comparable reports.

---

## 🎨 Broadcast alignment

**This brief inherits `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` and every Broadcast callout from the AGT-REC-004 anchor.** Do not restate them. Only per-screen deviations from anchor are listed below.

**Per-screen callouts:**

- **Status hero — APPROVED-AND-QUARANTINED** uses `emphasis="default"` (NOT `loud`). The loud orange hero band is reserved for a resolution the agent is being welcomed into (accepted, incorporated). "Quarantined pending further verification" is provisional — sunken surface + `CheckCircle2` glyph in `var(--lc-accent-bold-edge)` reads as "we heard you, we're acting, but it's not fully closed."
- **Status hero — APPROVED-AND-REMOVED** IS `emphasis="loud"`. The agent stuck their neck out to protect their listings' valuation from bad data. Full-bleed orange, white `CheckCircle2` in a white ring — this is the "we pulled the bad row" moment and deserves the anchor's one loud case.
- **REJECTED-AS-INVALID** uses the anchor's `state="rejected"` surface (`--lc-surface-raised` + `--lc-status-closed-fg` top-border, glyph `XCircle` in closed-fg). Never red. The label copy carries the framing — see §Copy.
- **REQUEST-FOR-MORE-INFO** uses the anchor's `state="more_info"` surface (`--lc-surface-raised` + `--lc-status-warning-fg` top-border, `AlertCircle` glyph). This is the ONE screen in the family where a warning tint is legal — the PA is actively soliciting a next action from the agent.
- **Impact statement panel** (unique to this screen — no anchor equivalent) sits between the resolver message and the CTA block. `--lc-surface-sunken` well, `var(--lc-radius-lg)`, padding `var(--lc-space-lg)`. Contains "N of your listings had valuation recomputed" with a link. Numeric N via `<Numeric>`. Renders ONLY in APPROVED-AND-REMOVED / APPROVED-AND-QUARANTINED.
- **Original report reference card** (also unique) — collapsible `<Accordion>`, header "What you originally reported", closed by default. Body echoes reason chip + notes + evidence thumbnails. `--lc-surface-raised` + `--lc-elevation-sm`.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-REC-002 |
| Screen name | Comparable-report outcome |
| Persona | Agent — submitter of the bad-comparable report at AGT-APR-004 |
| Device targets | Mobile 375px (primary — opens from push notification), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Primary: `/reports/comparables/:reportId/outcome`. Matrix-legacy alias: `/agent/comparable-reports/:id` (same component). Notification deep-link: `wingcaster://comparable-report/:id`. |
| Current state | MISSING — must ship with WF-05 cluster (Week 5, paired with PA-PVA-008/008b). |
| Workflow role | WF-05 role=Recipient. Closes loop after `PA-PVA-008b` decision. |
| Backend prerequisites | ✅ `comparable_reports` table (created with WF-05 backend, existing) · ⏳ user-scoped read endpoint `GET /api/users/me/comparable-reports/:id` — thin alias over existing `GET /api/pricing/my-comparable-reports/:id`, returns 404 (not 403) for other users' reports · ⏳ Push template `comparable_report.resolved` (piggybacks on existing dispatcher — one template row NEW) · ⏳ Notification emission at status-transition write |

---

## Purpose

An agent who submitted a bad-comparable report at `AGT-APR-004` (because a comparable in the valuation set was wrong, duplicated, no longer on-market, or not truly comparable) opens this screen to see what the Platform Administrator did about it. Seven states — PENDING (in PA queue), APPROVED-AND-REMOVED (PA agreed and pulled the row), APPROVED-AND-QUARANTINED (PA agreed but flagged pending further verification, not yet removed), REJECTED-AS-INVALID (PA reviewed and kept the comparable), REQUEST-FOR-MORE-INFO (PA needs specific additional evidence), EXPIRED (30-day PA SLA elapsed without decision), WITHDRAWN (agent recalled the report).

**Emotional stakes:** moderate — this is a workmanlike loop, not an identity moment. But agents who report bad comparables are doing platform-hygiene work that directly affects their own listings' pricing. The screen must respect that: an APPROVED-AND-REMOVED outcome should feel like the agent's diligence paid off; a REJECTED-AS-INVALID must explain the PA's reasoning without being dismissive.

Success outcome per state:
- APPROVED-AND-REMOVED → agent taps "View updated comparable" → lands on `AGT-APR-003` showing the corrected data + affected listings link.
- APPROVED-AND-QUARANTINED → agent sees the row is flagged; can view the quarantine annotation on the comparable.
- REJECTED-AS-INVALID → two respectful onward paths: submit a fresh report with more evidence, or dismiss and move on.
- REQUEST-FOR-MORE-INFO → primary CTA opens `AGT-APR-004` pre-scoped with prior submission + a prompt highlighting what PA asked for.
- PENDING → soft reassurance + Withdraw affordance + SLA line.
- EXPIRED → re-submit affordance; agent's original submission history preserved.
- WITHDRAWN → re-submit affordance.

---

## Design goals

1. **State legible in 200ms.** Same anchor rule — hero glyph + label + timestamp answers "what happened?" before the agent reads a word.
2. **Approved outcomes distinguish loud vs quiet.** REMOVED = loud orange hero (we acted decisively). QUARANTINED = sunken surface (we heard you, action is provisional). The distinction is doctrinally important; do not collapse them.
3. **Rejection respects diligence.** No "Report rejected." Language stays neutral: "The PA team reviewed your report and decided to keep this comparable in place." Reason from controlled vocabulary rendered as the resolver message.
4. **Original submission is a click away, not in your face.** Collapsible `<Accordion>` — the agent knows what they reported; they came here for the outcome, not to re-read their own words.
5. **Impact panel is the payoff.** When the correction lands, the agent wants to know how many of their listings just had their valuations recomputed. That number sells the WF-05 loop harder than any copy.
6. **Anchor discipline.** No new anchor components. If a REC-family visual pattern is needed and doesn't exist, escalate to a REC-004 anchor update — do not introduce a new local pattern here.

---

## Layout

### Mobile 375px (primary)

Single scrolling column. Same top-nav shell as anchor (48px, back arrow + title "Report status" + overflow menu).

1. **Top nav** — reuse anchor.
2. **`<StatusHero>` band** — anchor pattern. State-dependent per §Broadcast + §State variants below.
3. **Reported comparable card** — full-width, `--lc-surface-raised` + `--lc-elevation-sm`, `var(--lc-radius-lg)`. Contents: comparable address (`heading-3`) + market snippet (`body-sm` muted) + source badge (portal name / manual / MLS) + chevron opening the comparable in a `<Sheet>` (bottom-sheet on mobile). Does NOT navigate.
4. **`<OutcomeTimeline>` rail** — 4 events: Submitted → In PA review → Decided → Resolved. Anchor states + colors + pulse rules.
5. **`<ResolverMessage>` card** — anchor pattern. Attribution = PA reviewer (`display_name` + `Platform Administrator` role chip). Body = PA's decision message (Markdown-subset). Empty state = "No message provided" muted.
6. **Impact statement panel** (approved-only, unique to REC-002) — sunken well, "**N of your listings** had valuation recomputed after this correction." + link "View affected listings" → `AGT-LST-001` filtered.
7. **Original report reference** — collapsible accordion, closed by default. Header "What you originally reported" + report ID via `<Numeric>` right-aligned. Body: reason chip + notes paragraph + evidence thumbnails (max 3 shown, "+N more" chip).
8. **`<PrimaryCtaPerState>` block** — sticky bottom bar mobile, anchor rules. See §State → action map.
9. **Contact support link** — reuse anchor wording verbatim.

### Tablet 768px & Desktop 1440px

Same 65/35 split as anchor. Left column: hero (full-width above split), reported comparable card, timeline, resolver message, impact panel, original report accordion, support link. Right sidebar: `<PrimaryCtaPerState>` stack + context helper card + small-print (report ID, submitted-at, decided-at).

### RTL

Full mirror per anchor rules. Reported-comparable card mirrors so source badge lands opposite the address; report ID and timestamps stay LTR bidi-embedded.

---

## Copy (English) — deltas from anchor

Fill Arabic during MENA copywriter pass — mark `[TRANSLATION-PENDING]`.

| Slot | Copy |
|---|---|
| Top nav title | Report status |
| Status hero — PENDING label | Awaiting Platform Administrator review |
| Status hero — PENDING timestamp | Submitted {relative} · {absolute} |
| Status hero — APPROVED-AND-REMOVED label | We removed this comparable |
| Status hero — APPROVED-AND-REMOVED timestamp | Decided {relative} · {absolute} |
| Status hero — APPROVED-AND-QUARANTINED label | We flagged this comparable for further verification |
| Status hero — APPROVED-AND-QUARANTINED timestamp | Decided {relative} · {absolute} |
| Status hero — REJECTED-AS-INVALID label | We reviewed your report and kept the comparable in place |
| Status hero — REJECTED-AS-INVALID timestamp | Decided {relative} · {absolute} |
| Status hero — REQUEST-FOR-MORE-INFO label | The reviewer needs a bit more from you |
| Status hero — REQUEST-FOR-MORE-INFO timestamp | Requested {relative} · {absolute} |
| Status hero — EXPIRED label | This report timed out |
| Status hero — EXPIRED timestamp | Expired {relative} · {absolute} |
| Status hero — WITHDRAWN label | You withdrew this report |
| Status hero — WITHDRAWN timestamp | Withdrawn {relative} · {absolute} |
| Reported comparable card — chevron aria | View this comparable |
| Timeline — event 1 label | Submitted |
| Timeline — event 2 label | In Platform Administrator review |
| Timeline — event 2 empty | Not yet picked up |
| Timeline — event 3 label | Decided |
| Timeline — event 3 pending | Awaiting decision |
| Timeline — event 4 (removed) | Comparable removed |
| Timeline — event 4 (quarantined) | Comparable flagged |
| Timeline — event 4 (rejected) | Kept in place |
| Timeline — event 4 (more-info) | More info requested |
| Timeline — event 4 (expired) | Timed out |
| Timeline — event 4 (withdrawn) | Withdrawn |
| Resolver role chip | Platform Administrator |
| Impact panel — removed | **{N} of your listings** had valuation recomputed after this correction. |
| Impact panel — quarantined | **{N} of your listings** now show a "data under review" flag on their valuation. |
| Impact panel — link | View affected listings |
| Impact panel — zero-affected fallback | No listings of yours use this comparable in their valuation set. |
| Original report accordion header | What you originally reported |
| Original report — reason chip prefix | Reason: |
| Original report — evidence label | Evidence |
| PENDING detail — SLA line | Typical PA review: **48 hours** · Report expires **{expires_on}** |
| PENDING detail — reassurance | We'll notify you the moment a reviewer decides. |
| REJECTED detail — encouragement | If you have new evidence — a price disclosure, a listing withdrawal notice, a corrected sale record — you can submit a fresh report. |
| REQUEST-FOR-MORE-INFO detail | The reviewer flagged: **{missing_evidence_summary}**. Add it and we'll re-open the review. |
| EXPIRED detail | This report timed out after 30 days without a decision. You can submit a fresh report; your original is preserved in your history. |
| WITHDRAWN detail | You withdrew this report on **{withdrawn_on}**. You can submit a fresh report anytime. |
| CTA — primary (pending, disabled chip) | Awaiting reviewer |
| CTA — primary (approved-removed) | View updated comparable |
| CTA — primary (approved-quarantined) | View flagged comparable |
| CTA — primary (rejected-as-invalid) | Submit a new report |
| CTA — primary (more-info) | Provide the requested info |
| CTA — primary (expired) | Submit a new report |
| CTA — primary (withdrawn) | Submit a new report |
| CTA — secondary (approved-removed) | View affected listings |
| CTA — secondary (approved-quarantined) | View affected listings |
| CTA — secondary (rejected) | Close and continue |
| CTA — secondary (more-info) | View original submission |
| CTA — secondary (expired) | Close and continue |
| CTA — secondary (withdrawn) | Close and continue |
| CTA — tertiary (pending) | Withdraw report |
| CTA — tertiary (more-info) | Withdraw report |
| Withdraw dialog title | Withdraw your report? |
| Withdraw dialog body | The reviewer will stop looking at this. You can submit a fresh report anytime. |
| Withdraw dialog confirm | Withdraw |
| Withdraw dialog cancel | Keep report open |

---

## Component palette

Same as anchor. No net-new primitives on this screen. Deltas:
- **Reported comparable card** — `Card` + `Sheet` for the drill-in (mirrors anchor's agency card + bottom-sheet pattern).
- **Original report accordion** — `Accordion` (shadcn) single-item, `type="single" collapsible`. Evidence thumbnails: `Card` grid with `AspectRatio 1:1`, `Skeleton` fallback for signed-URL loading.
- **Impact panel** — plain `<section>` inside a `--lc-surface-sunken` well, uses `<Numeric>` for N.

---

## Interactions

- **On load:** `GET /api/users/me/comparable-reports/:reportId`. 404 → not-found fallback per anchor. 200 → render per state.
- **Poll for state change:** 60s poll + React-Query window-focus revalidation. On state transition, cross-fade hero at `var(--lc-duration-base)`.
- **Reported comparable card chevron:** opens `<Sheet>` with the comparable data (post-correction if resolved) — no route change.
- **Primary CTA (approved-removed / approved-quarantined) "View updated comparable":** navigates to `AGT-APR-003?comparableId=…` showing the corrected row + "This comparable was corrected on {date}" banner.
- **Primary CTA (rejected / expired / withdrawn) "Submit a new report":** navigates to `AGT-APR-004?forComparableId=…` — server treats it as a fresh report; prior report preserved in history.
- **Primary CTA (more-info) "Provide the requested info":** navigates to `AGT-APR-004?resumeReportId=…` — form pre-loaded with prior submission, missing-evidence prompt banner at top.
- **Secondary "View affected listings":** navigates to `AGT-LST-001?affectedByCorrectionId=…` filtered view.
- **Tertiary "Withdraw report" (PENDING / MORE-INFO):** opens `AlertDialog` → POST `/api/users/me/comparable-reports/:id/withdraw` → state flips to WITHDRAWN → hero cross-fades.
- **Timeline live-updating:** "In PA review" flips from muted to complete the moment PA picks up the ticket in `PA-PVA-008b`. Anchor pulse rules.
- **Contact support link:** routes to `SHR-SUP-001` with pre-filled context "Comparable report ID: {id}". Never `mailto:`.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Initial fetch in flight | Skeleton mirror per anchor. |
| **Not found (404)** | Bad reportId or report belongs to different user | Anchor fallback: "This report doesn't exist or isn't yours." + Back to My Reports button. |
| **Network error** | Fetch failed | Anchor retry fallback. |
| **PENDING** | `status = 'pending'` | Sunken hero, live-pulse "Decided" timeline dot, disabled CTA chip + Withdraw tertiary. SLA line "48 hours". |
| **PENDING — in-review** | `status = 'pending' AND picked_up_at IS NOT NULL` | Same as PENDING but "In PA review" event shows completed dot + timestamp. |
| **APPROVED-AND-REMOVED** | `status = 'approved' AND action = 'removed'` | LOUD orange hero. All 4 timeline dots complete. Impact panel with N-listings-recomputed. Primary "View updated comparable". |
| **APPROVED-AND-QUARANTINED** | `status = 'approved' AND action = 'quarantined'` | Sunken hero + `CheckCircle2` in `--lc-accent-bold-edge`. Impact panel with "data-under-review flag" copy. Primary "View flagged comparable". |
| **REJECTED-AS-INVALID** | `status = 'rejected'` | Anchor rejected surface. Resolver message carries controlled-vocabulary reason. Primary "Submit a new report" + secondary "Close and continue". |
| **REQUEST-FOR-MORE-INFO** | `status = 'more_info_requested'` | Anchor `more_info` surface. Resolver message specifies what's missing. Primary "Provide the requested info" + tertiary Withdraw. |
| **EXPIRED** | `status = 'expired'` | Hourglass muted hero. Re-submit primary + Close secondary. |
| **WITHDRAWN** | `status = 'withdrawn'` | Muted hero. Re-submit primary + Close secondary. |
| **SUPERSEDED** | `status = 'closed_as_duplicate' AND superseded_by_report_id IS NOT NULL` | Anchor `superseded` state surface (`Layers` glyph). Copy: "You submitted another report about the same comparable. This one is closed as a duplicate; the other one is where the outcome will land." + link to that report. |
| **Push-update arrived while viewing** | State changed on backend | Anchor cross-fade + polite `aria-live` announcement. |
| **RTL** | Locale = ar | Full mirror per anchor. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap. |

**Net-new state variants beyond anchor:** `SUPERSEDED` uses the anchor's already-defined `superseded` state map entry — no anchor change required. `APPROVED-AND-QUARANTINED` is a NEW distinction within the `approved` family (uses `emphasis="default"` instead of `loud`) — flag as anchor extension: add an optional `emphasis="default"` example to the anchor's approved-state row so REC-002/003 can inherit cleanly.

---

## Accessibility

Anchor rules apply verbatim. Deltas:
- Original report accordion uses `<Accordion>` semantics — `aria-expanded`, focus-visible chevron rotates 90° at `var(--lc-duration-base)`.
- Impact panel N is announced as "{N} listings" (not "{N}") — bidirectional text handling for RTL Arabic ordinal digits.
- Evidence thumbnail grid is a `role="list"` with each thumbnail a `role="listitem"` link; `alt` describes evidence kind (screenshot / document / photo).

---

## Backend contract

**Endpoint:** `GET /api/users/me/comparable-reports/:reportId`

**Response 200:**
```json
{
  "report": {
    "id": "cmr_01H8...",
    "status": "pending" | "approved" | "rejected" | "more_info_requested" | "expired" | "withdrawn" | "closed_as_duplicate",
    "action": null | "removed" | "quarantined",
    "superseded_by_report_id": null | "cmr_01H8...",
    "reason_code": "wrong_price" | "duplicate" | "not_comparable" | "removed_from_market" | "other",
    "notes": "The unit was withdrawn on 2026-08-30...",
    "evidence": [{ "kind": "screenshot" | "document" | "photo", "signed_url": "..." }],
    "submitted_at": "2026-09-01T10:22:00Z",
    "picked_up_at": "2026-09-02T14:00:00Z" | null,
    "decided_at": "2026-09-03T09:12:00Z" | null,
    "resolved_at": "2026-09-03T09:12:00Z" | null,
    "expires_at": "2026-10-01T10:22:00Z",
    "sla_hours": 48
  },
  "comparable": {
    "id": "cmp_01H8...",
    "address_label": "The Address Downtown, unit 2312",
    "market_label": "Downtown Dubai · Residential",
    "source_label": "Bayut" | "OLX" | "Manual" | "MLS",
    "url": "/comparables/cmp_01H8..."
  },
  "resolver": {
    "user_id": "usr_01H8...",
    "display_name": "PA-Layla",
    "role_label": "Platform Administrator",
    "avatar_url": "..." | null,
    "message": "We verified the listing was withdrawn on 2026-08-30 and removed it..." | null
  } | null,
  "impact": {
    "affected_listings_count": 4,
    "affected_listings_link": "/listings?affected_by_correction_id=cmr_01H8..."
  } | null
}
```

Server-side scope check by caller's `user_id` — foreign reports return **404** (not 403). Existing endpoint `GET /api/pricing/my-comparable-reports/:id` (per matrix) is the source; add thin `/api/users/me/comparable-reports/:id` alias for user-scoped-endpoint symmetry across the AGT-REC family.

**Action endpoints:**
- `POST /api/users/me/comparable-reports/:id/withdraw` — only valid when status ∈ `pending | more_info_requested`; flips to `withdrawn`.

**30-day auto-expire:** cron OR write-time check flips `pending` (and `more_info_requested` after 14 additional days per PA convention) to `expired`; emits `comparable_report.expired` notification. **Backend prerequisite surfaced:** file as `[BE-BLOCKER-11] comparable_reports.expires_at + auto-expire cron` if not already tracked — check kickoff §5a during Week-5 dispatch.

**Notification hook:** ONE new push template `comparable_report.resolved` with variants per terminal status. Piggybacks on WF-01/03 dispatcher — no new infra. Deep-link: `wingcaster://comparable-report/:id` → `/reports/comparables/:id/outcome`.

---

## Downstream implementation

- **File to create:** `web/src/pages/ComparableReportOutcomePage.tsx`.
- **Route:** `<Route path="/reports/comparables/:reportId/outcome" element={<ComparableReportOutcomePage />} />` + legacy alias `/agent/comparable-reports/:id`.
- **Reuses (no new anchor components):**
  - `web/src/components/recipient/StatusHero.tsx`
  - `web/src/components/recipient/OutcomeTimeline.tsx`
  - `web/src/components/recipient/ResolverMessage.tsx`
  - `web/src/components/recipient/PrimaryCtaPerState.tsx`
- **New screen-local components:**
  - `web/src/components/reports/comparables/ReportedComparableCard.tsx`
  - `web/src/components/reports/comparables/OriginalReportAccordion.tsx`
  - `web/src/components/reports/comparables/ImpactPanel.tsx`
- **Data hook:** `web/src/hooks/useComparableReportOutcome.ts` — fetch + 60s poll + focus revalidate.
- **Anchor extension needed:** add optional `emphasis="default"` example to the anchor's `<StatusHero>` approved-state row so APPROVED-AND-QUARANTINED can render without a doctrine violation. File as a Week-5 anchor amendment PR **before** REC-002 lands.
- **Test discipline:** unit tests for the 3 screen-local components + state-parameterized integration tests covering all 8 state variants (pending, pending-in-review, approved-removed, approved-quarantined, rejected, more-info, expired, withdrawn, superseded) + withdraw dialog flow + RTL snapshot + `no-raw-hex.test.ts` green.

---

## Broadcast alignment callouts

All anchor callouts apply verbatim. Screen-specific reminders:
- LOUD orange hero band is legal ONLY for APPROVED-AND-REMOVED. QUARANTINED uses sunken. Never confuse the two.
- Impact panel N via `<Numeric>` — never in UI font.
- Evidence thumbnails NEVER render user content without a sandbox; use `<img referrerpolicy="no-referrer" loading="lazy">` and revoke signed URLs after 15 min per platform policy.
- No `variant="destructive"` on any button. Withdraw is ghost.
- Impact panel link uses `var(--lc-text-brand)` inline link style — never a full `<Button>` (would double-focal-point with the primary CTA).

---

## Handoff to v0

Framing prompt (paste before this brief):

```
I'm designing WingCaster's "Comparable-report outcome" screen (AGT-REC-002) — MENA real-estate B2B SaaS, mobile-first. It's the recipient screen for WF-05 (agent reports a bad comparable → PA reviews → agent sees outcome here). Seven states: PENDING, APPROVED-AND-REMOVED, APPROVED-AND-QUARANTINED, REJECTED-AS-INVALID, REQUEST-FOR-MORE-INFO, EXPIRED, WITHDRAWN. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen is a DELTA on the AGT-REC-004 anchor (Agency application outcome). Reuse the four anchor components verbatim: StatusHero, OutcomeTimeline, ResolverMessage, PrimaryCtaPerState. Only three screen-local components are new: ReportedComparableCard, OriginalReportAccordion, ImpactPanel.

First pass: mobile 375px, state = APPROVED-AND-REMOVED. LOUD Broadcast-orange hero, "We removed this comparable". Reported comparable card ("The Address Downtown, unit 2312", source badge "Bayut"). Timeline with 4 completed events. Resolver message from "PA-Layla, Platform Administrator" confirming removal. Impact panel: "4 of your listings had valuation recomputed" + link. Original report accordion closed by default. Sticky bottom CTA: primary "View updated comparable" + secondary "View affected listings".

LTR English only for this pass. Follow the copy table exactly.

DESIGN BRIEF FOLLOWS:
```

Iteration order:
1. Mobile, APPROVED-AND-QUARANTINED (sunken hero, quarantined copy, primary "View flagged comparable").
2. Mobile, REJECTED-AS-INVALID (neutral hero, resolver reason, primary "Submit a new report").
3. Mobile, REQUEST-FOR-MORE-INFO (warning-tint hero, PA's missing-evidence prompt, primary "Provide the requested info").
4. Mobile, PENDING (sunken hero, pulsing "Decided" node, disabled chip + Withdraw tertiary).
5. Desktop 1440px, APPROVED-AND-REMOVED (sticky sidebar CTA + context helper).
6. RTL Arabic mobile, APPROVED-AND-REMOVED.
7. Dark mode desktop, REJECTED-AS-INVALID.
8. Withdraw confirm dialog over PENDING.

Save JSX to `web/src/components/reports/comparables/OutcomeScreen/` + screenshots to `docs/design/mockups/AGT-REC-002-<state>.png`.

---

## Definition of done

- [ ] Anchor amendment PR merged first: `<StatusHero>` gains `emphasis="default"` example on approved-state row.
- [ ] v0 has produced all 8 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-5 dispatch prompt references this brief + AGT-REC-004 anchor + mockup paths.
- [ ] `[BE-BLOCKER-11]` (comparable_reports.expires_at + auto-expire cron) filed in kickoff §5a if not already tracked.
- [ ] Push template `comparable_report.resolved` filed as a Week-5 backend task.
- [ ] User-scoped alias endpoint `GET /api/users/me/comparable-reports/:id` filed as a Week-5 backend task.
