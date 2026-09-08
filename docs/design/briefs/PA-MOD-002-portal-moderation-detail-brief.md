# Screen Brief — PA-MOD-002 · Portal moderation detail (WF-03 approver-side)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

**Delta brief.** This brief references the anchor `PA-MOD-001-portal-moderation-queue-brief.md` for its Broadcast alignment section, PA-queue-family invariants, backend contract, and reusable component palette. Read the anchor first. Only per-screen deltas are spelled out below.

Companion to `SCREEN_MATRIX_PA.md` §23 entry `PA-MOD-002`. Wave 2 (Week 2 — WF-03 cluster) per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 6 §5 row 39. Ships in the same PR pair as PA-MOD-001.

---

## Broadcast alignment

**Inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`** AND the full Broadcast callout block in `PA-MOD-001-portal-moderation-queue-brief.md` §Broadcast alignment. Read that section — every token there (page shell, env badge, TEST warning strip, status pills, validator lint pills, tenure risk badges, focus rings, motion, radii, elevation, family invariants) applies here unchanged. Deltas only below.

**Deltas from the anchor:**

- This is a single-record surface, not a table. Content lives in a three-region layout on desktop 1440px: **left column** (~60% width) — the listing preview + agent/agency context + history; **right column** (~40%) — validator lint checklist + decision panel (docked, sticky under top bar / TEST warning strip). Below both columns, a full-width tabbed section for `Audit trail` (PA-MOD-003 tab-embedded), `Portal payload preview` (raw JSON), and `Notification preview` (agent-outcome copy).
- **Listing title treated as page title:** `font: var(--lc-type-heading-1)`. Listing address in `var(--lc-type-body-sm)` `var(--lc-text-muted)` below. Portal + country + status pill inline right of the title.
- **Listing preview panel** simulates how the listing will render on the target portal — hero image + gallery thumbs + title + price + specs (beds/baths/area) + description + amenities + agent contact block. Card `var(--lc-surface-raised)` + `var(--lc-elevation-sm)` + `padding: var(--lc-space-xl)`. Preview is illustrative — a real per-portal preview iframe is Phase 2.
- **Validator lint checklist** (right column top): stacked list of every check the per-portal validator ran. Each check row: severity glyph (● ⚠ ✕) + code + human-readable message + expected value + actual value. Failed checks pinned to top of list. Card `var(--lc-surface-raised)` + `var(--lc-elevation-sm)`.
- **Decision panel** (right column below lint, sticky): three primary buttons stacked vertically — `Approve` (`<Button size="lg" variant="default">` full-width, `--lc-action-primary` fill), `Reject` (`<Button size="lg" variant="outline">` full-width, `--lc-border-strong` outline), `Request info` (`<Button size="lg" variant="outline">` full-width, `--lc-status-warning` outline). Panel background `var(--lc-surface-raised)` + `border: 1px solid var(--lc-border)` + `var(--lc-radius-lg)` + `var(--lc-elevation-sm)`; sticky `top: calc(var(--lc-nav-height) + var(--lc-nav-warning-strip-height, 0px) + var(--lc-space-xl))`.
- **Two-person-rule badge** (in decision panel): if `is_own=true` OR the agency of this submission is one the current PA owns, the entire decision panel is replaced with an inline block: `--lc-status-warning-subtle` fill + `AlertTriangle` icon + copy "You can't decide this submission — you are the agent-of-record or agency owner."
- **High-risk step-up notice** (in decision panel, above buttons, if `tenure_risk.tier=high`): `--lc-status-danger-subtle` fill + `Shield` icon + copy "This is a High-risk submission. Step-up required to approve or reject."
- **Rejects on high-risk agencies require PA-APR-003 second approval per two-person rule (D9 governance).** When Reject is clicked on a row where `tenure_risk.tier=high` AND `agency.two_person_reject_required=true`, the Reject modal converts into a `PA-APR-003` action-confirmation flow — the PA's reject decision is recorded as `REJECT_PROPOSED` (not final) and appears in `PA-APR-001` approvals queue for a second PA to confirm. Copy in the modal: "This reject requires a second PA approval. Your reason will be visible to the second approver."
- **Agent + agency context block** (left column below listing preview): 48px avatar + agent name (`var(--lc-type-heading-3)`) + agency name link (opens PA-TEN-001 in new tab) + inline metadata row (portfolio size · WingCaster tenure · prior-decision-summary "12 approved · 1 rejected across all portals in the last 30 days"). Card `var(--lc-surface-raised)`.
- **Listing history on this platform** (left column, collapsible via `<Accordion>` default-closed): list of prior submissions of THIS listing across ALL portals + all statuses; each row `var(--lc-surface-sunken)` `var(--lc-type-body-sm)` with portal chip + status + submitted-at + decided-at + decided-by.
- **Portal payload preview tab** (below main): syntax-highlighted JSON of exactly what will POST to the portal API on approval. Copy-to-clipboard button. `--lc-font-mono` `var(--lc-type-data-sm)`.
- **Notification preview tab** (below main): shows the exact agent-outcome copy that will render on `AGT-REC-001` for each decision (Approve success / Reject with reason / Request info). Helps PA choose a reason that renders coherently to the agent.
- **Audit trail tab** (PA-MOD-003 embedded — below main): timeline of submitted → any prior request-info cycles → moderation decision → portal push → portal callback. `--lc-type-body-sm` timeline with icons.
- **Prev / next navigation** (in sticky sub-header): back-arrow icon + breadcrumb "Portal moderation / {listingTitle}" + queue-position chip "Submission <Numeric>3</Numeric> of <Numeric>18</Numeric> pending" (`<Badge>` accent teal — the only teal usage on this screen; keep small) + prev/next chevron buttons keyboard J/K equivalents. Disabled at queue edge.
- **Motion:** decision panel button hover `--lc-duration-fast`; step-up modal opens `--lc-duration-slow` `--lc-easing-out`; success toast + auto-navigate back to queue `--lc-duration-base`.

---

## Meta

| | |
|---|---|
| Screen ID | PA-MOD-002 |
| Screen name | Portal moderation detail |
| Persona | PA (Platform Admin — not the agent-of-record or agency owner of this submission; server-enforced) |
| Device targets | Desktop 1440px ONLY — same as PA-MOD-001 |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/admin/moderation/portals/:submissionId` (query param: `?return_to=<queue-url>` for back nav; `?tab=payload\|notification\|audit` for deep-links) |
| Current state | MISSING. Backend `GET /:submissionId`, `POST /:submissionId/approve`, `POST /:submissionId/reject`, `POST /:submissionId/request-info` do NOT yet exist per `[BE-BLOCKER-02b]`. |
| Workflow role | WF-03 role = Approval detail |
| Backend prerequisites | Same as PA-MOD-001 — `[BE-BLOCKER-02b]` route family (this brief specifically requires `GET /:submissionId` returning full payload + validator lint expanded + agent/agency context + listing history + portal payload preview + notification preview). Plus `[BE-BLOCKER-07]` per-portal validator, `[BE-DESIGN-02]` tenure risk, `[BE-VERIFY-11]` sibling-queue-position lookup for prev/next, `[BE-VERIFY-12]` agency two_person_reject_required flag. |
| Cluster | Wave 2 (WF-03 cluster) — ships with PA-MOD-001 in same PR pair |

---

## Purpose

A Platform Admin drills into a single portal submission from the queue (PA-MOD-001) to review the listing as it will appear on the target portal and make an approve / reject / request-info decision — with per-portal validator lint results, agent/agency context, and listing history in view.

Where the queue is designed for rapid triage, the detail screen is designed for the submissions that need judgment — usually those with failed validator checks, high tenure risk, unfamiliar agencies, or portal-specific edge cases.

Four PA sub-tasks:

1. **Preview the listing** as it will render on the target portal — hero + gallery + specs + copy + agent contact. Catch obvious quality issues before the portal rejects them.
2. **Read the validator lint** — every automated check the per-portal validator ran, sorted with fails on top. PA can decide "request info" when the fail is fixable by the agent, or "reject" when it's fundamentally incompatible.
3. **Contextualize the applicant** — agent's WingCaster tenure, agency's prior-decision-summary, listing's prior submission history on this and other portals. Signals inform judgment, not verdict.
4. **Decide.** Approve → portal publisher pushes payload → agent sees success. Reject with reason → returns to agent for fix. Request info → returns to agent with a specific fixable-issues list. High-risk-agency rejects trigger PA-APR-003 two-person rule.

Success outcome: decision recorded server-side (append to `fin.approval_requests` + audit log), PA returned to the queue with success toast, next-in-queue keyboard shortcut (`J`) available. If the decision proposed a two-person-rule reject, PA sees "Sent to PA-APR-001 for second approval" toast and the submission moves to `pending_second_approval` state.

---

## Design goals

1. **Reduce the decision to one screen.** Listing preview + validator lint + agent/agency context + decision panel visible without scroll on desktop 1440px.
2. **Decision panel always in reach.** Docked sticky right column; three buttons stacked; two-person-rule and step-up notices inline above buttons when applicable.
3. **Validator lint is authoritative.** Fails pinned top; each fail shows the exact expected-vs-actual so PA can decide whether to reject or request-info. No hidden validator output.
4. **Portal preview is illustrative, not simulated.** Do NOT claim "this is exactly how Bayut will render it." Do label it as "Wingcaster preview of portal render — visit portal directly for final layout." Honesty guardrail.
5. **Two-person rule visible in the UI.** High-risk-agency rejects show the second-approval notice before the reject is fired.
6. **Keyboard continuity from queue.** `J` next Pending submission, `K` previous, `A` approve, `R` reject, `I` request info, `Esc` back to queue.
7. **No fabricated risk scoring.** Tenure risk tier + signals come from `[BE-DESIGN-02]` service; do not paint additional inferred scores.

---

## Layout

### Desktop 1440px

Inside the standard PA console shell (SHR-NAV-001 top bar with PA-NAV-001 env badge; optional TEST warning strip):

**Sticky sub-header (below top bar + optional TEST strip):**
- Left: back-arrow icon button + breadcrumb "Portal moderation / **{listingTitle}**" (listing title is `var(--lc-type-body)`, "Portal moderation" is a `--lc-text-brand` link back to `PA-MOD-001` preserving `?return_to` query params).
- Center: queue-position chip — `<Badge>` "Submission <Numeric>3</Numeric> of <Numeric>18</Numeric> pending" (accent teal, only teal usage on this screen).
- Right: prev / next submission buttons (chevron icons) — keyboard J/K equivalents. Disabled at queue edge.

**Top of main content — heading strip:**
- Listing title `var(--lc-type-heading-1)` + address line `var(--lc-type-body-sm)` `var(--lc-text-muted)` below.
- Inline right of title: portal `<ChannelMark>` + country flag + ISO code + status `<Badge>` pill.

**Left column (60%) — listing + context + history:**

- **Listing preview panel** (top of column):
  - Hero image (16:9, `var(--lc-radius-lg)`, `object-fit: cover`, fallback dashed placeholder).
  - Gallery thumbstrip (up to 8 thumbs, 64×64 each, `var(--lc-radius-md)`, click to swap hero).
  - Price row: `<Numeric>` price + currency ISO + price-basis (per year, per month, sale).
  - Specs row: beds · baths · area (m²) — each numeric wrapped in `<Numeric>`.
  - Amenities chips (up to 12 shown; more collapse to "+N more").
  - Description block — preserves line breaks, `var(--lc-type-body-lg)`.
  - Agent contact block at bottom: phone masked (reveal on click, audited), WhatsApp deep-link, email masked.
  - Above panel: label "PORTAL PREVIEW — {portalDisplayName}" in `var(--lc-type-overline)`.
  - Below panel: caption "Wingcaster preview of portal render — visit portal directly for final layout." in `var(--lc-type-caption)` `var(--lc-text-muted)`.
- **Agent + agency context block** (below preview):
  - 48px avatar + agent name (`var(--lc-type-heading-3)`) + agency name link (opens PA-TEN-001 new tab).
  - Metadata row: WingCaster tenure ("Agent since <Numeric>Jan 2024</Numeric>"), portfolio size ("<Numeric>27</Numeric> listings"), prior-decision-summary ("<Numeric>12</Numeric> approved · <Numeric>1</Numeric> rejected across all portals in the last 30 days").
- **Listing history on this platform** (below context, collapsible `<Accordion>` default-closed):
  - Header "Prior submissions of this listing (<Numeric>N</Numeric>)".
  - Body: table of prior submissions across ALL portals — columns portal, submitted-at, status, decided-at, decided-by. Rows `var(--lc-surface-sunken)`.

**Right column (40%) — validator lint + decision panel:**

- **Validator lint checklist** (top):
  - Header "Per-portal validator · {portalDisplayName}" in `var(--lc-type-overline)`.
  - Aggregate summary row: pass/warn/fail counts with glyphs.
  - Stacked list: each check row shows severity glyph + code + human message + (for fails/warns) expected vs actual side-by-side.
  - Fails pinned top; then warns; then passes (collapsible "Show N passing checks" default-collapsed).
  - Card `var(--lc-surface-raised)` + `var(--lc-elevation-sm)`.
- **Decision panel** (below lint, sticky):
  - Tenure risk banner top: risk tier badge + inline explanation.
  - If applicable: two-person-rule notice OR step-up notice (see §Broadcast deltas).
  - Three buttons stacked: Approve → Reject → Request info.
  - Small caption below buttons: "Every decision is audit-logged and visible on the submission audit trail."
  - Panel `var(--lc-surface-raised)` + `var(--lc-elevation-sm)` + `var(--lc-radius-lg)`; sticky.

**Below-main tabbed section (full-width, below both columns):**

- Tabs: `Portal payload` (default) · `Notification preview` · `Audit trail` (this is PA-MOD-003).
- **Portal payload panel:** syntax-highlighted JSON of the exact payload that will POST to the portal API on approve. Copy-to-clipboard button.
- **Notification preview panel:** three previews shown side-by-side — Approve success (AGT-REC-001 outcome copy), Reject with reason (with the currently-selected reason substituted in), Request info (with currently-selected reason).
- **Audit trail panel (PA-MOD-003):** timeline: submitted → prior request-info cycles → this moderation decision (pending) → (post-decision) portal push → portal callback. Each event: icon + timestamp + actor + short description. Export-to-PDF button.

### Below-min-viewport fallback (<1024px)

Same info block as PA-MOD-001: "PA console requires a desktop screen."

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Breadcrumb root | Portal moderation |
| Queue-position chip template | Submission {position} of {total} pending |
| Prev button aria-label | Previous pending submission |
| Next button aria-label | Next pending submission |
| Portal preview header | PORTAL PREVIEW — {portalDisplayName} |
| Portal preview caption | Wingcaster preview of portal render — visit portal directly for final layout. |
| Gallery empty state | No additional photos submitted. |
| Agent context WingCaster tenure | Agent since {monthYear} |
| Agent context portfolio | {N} listings |
| Agent context prior-decision summary | {A} approved · {R} rejected across all portals in the last 30 days |
| History accordion label | Prior submissions of this listing ({N}) |
| History empty | This listing has no prior portal submissions. |
| Validator lint header | Per-portal validator · {portalDisplayName} |
| Validator lint aggregate | {P} pass · {W} warn · {F} fail |
| Validator lint expected label | Expected |
| Validator lint actual label | Actual |
| Validator lint show-passing | Show {N} passing checks |
| Validator lint hide-passing | Hide passing checks |
| Decision panel — risk tier low | Low tenure risk |
| Decision panel — risk tier medium | Medium tenure risk |
| Decision panel — risk tier high | High tenure risk |
| Decision panel — step-up notice | This is a High-risk submission. Step-up required to approve or reject. |
| Decision panel — two-person-rule notice | This reject requires a second PA approval. Your reason will be visible to the second approver. |
| Decision panel — own-submission block | You can't decide this submission — you are the agent-of-record or agency owner. |
| Approve button | Approve — publish to {portalDisplayName} |
| Reject button | Reject with reason |
| Request-info button | Request info from agent |
| Decision audit caption | Every decision is audit-logged and visible on the submission audit trail. |
| Approve confirm modal title | Approve submission for {portalDisplayName}? |
| Approve confirm modal body | On approval, WingCaster will push this listing to {portalDisplayName} immediately. |
| Approve confirm modal button | Approve and publish |
| Approve confirm modal cancel | Cancel |
| Reject modal title | Reject submission |
| Reject modal reason label | Reason (shown to agent) |
| Reject modal reason vocab | Portal outage · Fails portal validation · Duplicate listing · Suspected fraud · Insufficient photos · Compliance conflict · Other |
| Reject modal notes label | Notes for the agent (optional) |
| Reject modal notes placeholder | Add context — the agent will see this in their outcome inbox. |
| Reject modal notes helper | Kind and clear beats terse. |
| Reject modal — two-person notice | This submission requires a second PA to confirm your reject. Your reason and notes will be visible to the second approver. |
| Reject modal button (standard) | Reject |
| Reject modal button (two-person) | Send to second approver |
| Reject modal cancel | Cancel |
| Request-info modal title | Request info from agent |
| Request-info modal reason vocab | Missing trakheesi number · Photo count below minimum · Description too short · Category mapping unclear · Broker license expired · Other |
| Request-info modal notes label | What the agent needs to fix |
| Request-info modal notes placeholder | Be specific — the agent will use this to correct and resubmit. |
| Request-info modal button | Send request |
| Tab — payload | Portal payload |
| Tab — notification | Notification preview |
| Tab — audit | Audit trail |
| Payload copy-to-clipboard | Copy JSON |
| Payload copied toast | Payload copied to clipboard. |
| Notification preview approve label | Agent sees on approve |
| Notification preview reject label | Agent sees on reject |
| Notification preview request-info label | Agent sees on request info |
| Audit trail export | Export PDF |
| Toast — approved | Approved {listingTitle} for {portalDisplayName}. |
| Toast — rejected (standard) | Rejected {listingTitle}. |
| Toast — rejected (two-person) | Reject sent to a second approver for {listingTitle}. |
| Toast — request-info | Requested info on {listingTitle}. |
| Toast — undo link | Undo |
| Toast — auto-nav-next | Loading next pending submission… |
| Error — load | Couldn't load this submission. |
| Error — retry | Retry |
| Error — already-decided | This submission was already decided by {actor} on {when}. |
| Error — session-expired | Your session expired. Please sign in again. |
| Error — portal-api-down | The portal API is currently unavailable. Your decision will be queued and pushed when the portal reconnects. |

---

## Component palette (shadcn / Radix / lucide-react)

Same primitives as PA-MOD-001 (`Button`, `Badge`, `Dialog`, `AlertDialog`, `Select`, `Textarea`, `Tabs`, `Accordion`, `Tooltip`, `Sheet`, `Sonner` toast, `Avatar`, `ChannelMark`, `<Numeric>`, SHR-MFA-007). Additional primitives specific to this screen:

| Element | Primitive |
|---|---|
| Listing gallery hero + thumbstrip | Custom composite — hero `<img>` + thumb row of `<button>` |
| JSON payload viewer | `<pre><code>` with syntax-highlight (use existing app util if present, else prism-react-renderer via CDN allow-list) |
| History accordion | `Accordion` + `AccordionItem` |
| Validator lint expandable pass list | `Collapsible` |
| Copy-to-clipboard | `Button variant="ghost" size="sm"` + `Copy` icon (lucide) |
| Icons additions | `Copy`, `Shield`, `AlertTriangle`, `ChevronDown`, `ChevronUp`, `ArrowLeft`, `Image`, `Phone`, `Mail`, `MessageCircle`, `Download` |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:

- **Env:** LIVE (green badge, no warning strip).
- **Sticky sub-header:** "Portal moderation / **3BR apartment · Dubai Marina**" · "Submission 3 of 18 pending" chip (teal) · prev/next chevrons.
- **Heading strip:** Title **"3BR apartment · Dubai Marina"** + address "Marina Gate 2, Tower A, Apt 1204" + Property Finder AE channel chip + 🇦🇪 AE + Pending status pill.
- **Left column — listing preview panel:**
  - Hero image placeholder (16:9) labeled "Hero — 1920×1080".
  - Gallery thumbstrip: 8 thumbs labeled "1…8".
  - Price row: **AED 2,850,000** · Sale.
  - Specs: 3 beds · 3 baths · 168 m².
  - Amenities chips: Pool · Gym · Concierge · Parking · Balcony · Marina view · Furnished · Chiller free · +4 more.
  - Description block: "Beautiful 3BR corner unit on the 24th floor of Marina Gate 2, floor-to-ceiling windows facing the marina and the yacht club. Fully furnished with high-end brands. Ready to move in. Chiller included in service charge. …"
  - Agent contact: phone masked "+971 5* *** **12", WhatsApp deep-link, email masked "s***@***.com".
- **Left column — agent + agency context:**
  - Avatar SM · **Sara Al Mansouri** · Elite Real Estate Dubai (link).
  - Metadata: "Agent since Jan 2024 · 27 listings · 12 approved · 1 rejected across all portals in the last 30 days".
- **Left column — history accordion (closed):**
  - Header "Prior submissions of this listing (3)".
- **Right column — validator lint:**
  - Header "Per-portal validator · Property Finder AE".
  - Aggregate: "6 pass · 0 warn · 0 fail".
  - Collapsed "Show 6 passing checks".
- **Right column — decision panel (sticky):**
  - Tenure risk banner: "Low tenure risk" badge (green).
  - Three buttons stacked: **Approve — publish to Property Finder AE** (orange fill), **Reject with reason** (outline), **Request info from agent** (amber outline).
  - Caption "Every decision is audit-logged…".
- **Below-main tabs (default = Portal payload):**
  - Portal payload JSON syntax-highlighted (~30 lines shown).
  - Tab bar: Portal payload (active) · Notification preview · Audit trail.
- **Two side variants to screenshot as separate v0 iterations:**
  - **Reject modal open** — reason Select showing "Insufficient photos" highlighted, notes textarea with placeholder, Reject button enabled.
  - **High-risk two-person-rule variant** — different sample row (Riyadh off-plan submission), tenure risk banner "High tenure risk" (red), step-up notice + two-person-rule notice visible above buttons. Reject button copy changes to "Send to second approver".

Do NOT fabricate portal-side approval likelihood, agent quality scores, or listing quality ratings not returned by the backend contract.

---

## Interactions

**On page load:**
- Fetch `GET /api/admin/moderation/portals/:submissionId` scoped to current env.
- If PA is the agent-of-record OR agency owner: decision panel replaced with own-submission block; audit still visible.
- If `is_already_decided`: show "This submission was already decided by {actor} on {when}." banner + hide decision panel; content still viewable read-only.

**On prev/next button click OR J/K keypress:**
- Server sibling lookup — `GET /:submissionId/sibling?direction=next|prev&filter=<same-as-queue>` — returns next pending submission ID.
- Navigate to `/admin/moderation/portals/:nextId?return_to=<same>`.

**On Approve button click:**
- If step-up required (high-risk OR agency policy): SHR-MFA-007 prompt. On success, proceed.
- Open AlertDialog "Approve submission for {portalDisplayName}?" confirm.
- On confirm: fire `POST /:submissionId/approve`.
- On success: toast "Approved {name} for {portal}." with Undo (5s). Auto-navigate to next pending submission after 2s (Undo cancels the auto-nav).
- On portal-api-down 503: toast "Portal API unavailable. Decision queued for retry."

**On Reject button click:**
- Own-submission guard.
- Step-up if high-risk.
- Open Reject modal. Reason Select (from vocab) + Notes textarea.
- If `tenure_risk.tier=high` AND `agency.two_person_reject_required=true`: modal shows two-person notice; button copy becomes "Send to second approver"; on confirm the reject is recorded as `REJECT_PROPOSED` and PA-APR-001 gets the entry.
- Otherwise: on confirm, fire `POST /:submissionId/reject` with `{ reason_code, notes }`.
- Same optimistic toast + Undo + auto-nav pattern (Undo NOT available for two-person rejects — the two-person queue is the "undo" mechanism).

**On Request info click:**
- Own-submission guard.
- Open Request-info modal. Reason Select + Notes textarea (both required).
- Confirm fires `POST /:submissionId/request-info` with `{ reason_code, notes }`.
- Toast "Requested info on {name}." with Undo. Auto-nav to next pending after 2s.

**On tab click (Portal payload / Notification preview / Audit trail):**
- Update `?tab=<x>` URL param.
- Content region swaps. State preserved on back/forward.

**On Copy JSON:**
- Fire `navigator.clipboard.writeText(payloadJson)`. Toast "Payload copied to clipboard." at `--lc-duration-fast`.

**On history accordion open:**
- Fetch prior submissions if not preloaded (`GET /:submissionId/history`). Show 10-row skeleton while loading.

**On agent contact reveal click (phone / email):**
- Fire `POST /:submissionId/reveal-contact` (audited server-side). Reveal masked value on success.

**On external agency link click:**
- Opens PA-TEN-001 in new tab with `rel="noopener noreferrer"`.

**On env-switch mid-flow (PA-NAV-001):**
- If any modal open OR reason typed: confirm-cancel prompt. On confirm: navigate to `PA-MOD-001` queue in new env (this specific submission may not exist in new env).

**On keyboard shortcut:**
- `J` next pending · `K` prev · `A` approve · `R` reject · `I` request info · `Esc` back to queue · `T` cycle tab (Portal payload → Notification → Audit).

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial loading** | Route mount | Skeleton left+right columns. Env badge / prev-next disabled. |
| **Ready — pending decidable** | Load complete, not-own, not-decided | Full detail rendered. Decision panel active. |
| **Ready — own-submission** | `is_own=true` OR agency-owned by PA | Decision panel replaced with own-submission block. |
| **Ready — already decided** | Server returns `decision != null` | Read-only mode; banner explains who decided when; audit trail tab pre-selected. |
| **Ready — high-risk decidable** | tenure_risk.tier=high, not-own | Step-up notice visible above buttons; step-up prompt fires on click. |
| **Ready — high-risk + two-person-reject** | high-risk AND agency.two_person_reject_required=true | Reject modal shows two-person notice; button copy changes. |
| **Approve in progress** | Approve confirmed | Approve button spinner; all other buttons disabled. |
| **Reject / Request-info modal open** | Button clicked | Modal traps focus; reason autofocused; confirm disabled until valid. |
| **Approve success** | POST 200 | Toast + Undo + auto-nav-next after 2s. |
| **Reject success (standard)** | POST 200 | Toast + Undo + auto-nav-next. |
| **Reject success (two-person)** | POST 200 with `state=REJECT_PROPOSED` | Toast "Reject sent to a second approver for {name}." No Undo (2-person queue is the mechanism). Auto-nav-next. |
| **Portal-api-down at approve time** | POST 503 | Toast "Portal API unavailable. Decision queued for retry." Decision recorded as `approved_pending_publish`; queue shows a portal-error state later if push fails after N retries. |
| **Step-up required** | 401 or client policy | SHR-MFA-007 opens; on success re-fires action. |
| **Backend error 500** | POST fails | Destructive toast; buttons re-enable. |
| **Session expired** | 401 non-step-up | Redirect to `SHR-AUT-001`. |
| **Insufficient permission** | 403 | Full-page block. |
| **Submission not found** | 404 | Full-page block "Submission not found or archived." + back to queue link. |
| **Env-switch mid-flow** | PA-NAV-001 change | Confirm-cancel → nav to queue in new env. |
| **TEST env** | env=TEST | PA-NAV-001 warning strip renders; decision panel gets small "TEST" chip. |
| **Contact reveal in progress** | Reveal click | Value swaps to spinner briefly; audited call. |
| **Undo grace (single-decision)** | Toast visible | Undo link clickable for 5s; page pauses auto-nav-next; on Undo, decision reverses server-side + returns to detail. |
| **RTL** | Locale = ar | Columns mirror; decision panel becomes left column; prev/next chevrons swap direction. Numerals stay LTR via bidi. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap. |

---

## Accessibility

- Page has a single `<h1>` (listing title). Sub-header labelled `aria-label="Submission navigation"`.
- Prev / next buttons have real `aria-label`s.
- Queue-position chip is `role="status"`.
- Decision panel is a `<section aria-labelledby="decision-heading">`; heading visually hidden but present.
- Approve / Reject / Request-info buttons have full accessible names (e.g. "Approve — publish to Property Finder AE"). Not icon-only.
- Two-person-rule notice + step-up notice are `role="note"` inside the decision panel, associated to buttons via `aria-describedby`.
- Own-submission block is `role="status"` announcing the reason.
- Modals trap focus + Esc close + reason-typed cancel confirmation.
- Tabs are `role="tablist"` + `role="tab"` + `role="tabpanel"`; arrow keys navigate; Enter/Space activate.
- Copy JSON button announces "Payload copied to clipboard" via `role="status"` toast.
- Contact reveal buttons announce "Phone number revealed" via `aria-live="polite"`.
- Validator lint check rows are `<li>` inside `<ul>`; severity glyph + code + message all in DOM (no icon-only status).
- Skip-to-content link jumps past sub-header into main.
- Focus rings two-tone via base CSS.
- Every icon-only button has an `aria-label`.

---

## Anti-patterns (do not do these)

- Do NOT claim the portal preview is authoritative — always caption "Wingcaster preview, visit portal directly for final".
- Do NOT allow the PA to decide their own submission via any hidden path — server-enforced, UI-hidden.
- Do NOT auto-fire approve or reject on any shortcut without confirmation — J/K nav is safe; A/R/I trigger the confirm modal, not the decision.
- Do NOT show fabricated portal-approval likelihood or "AI recommendation" — no such service in v1; would train PA to distrust the queue.
- Do NOT skip the two-person-rule notice on high-risk agency rejects. It changes the operator's action mental model.
- Do NOT allow Undo on two-person-rule rejects — the second-approver queue IS the undo mechanism.
- Do NOT reveal the agent's phone / email without recording a contact-reveal audit event. Every reveal is server-audited.
- Do NOT co-mingle LIVE and TEST payloads. Env header required.
- Do NOT reload the page on tab change — client-side.
- Do NOT show empty tabs — if audit trail has no events yet (impossible for a submitted item), render "No events yet" not a blank panel.
- Do NOT lose the queue context — the sub-header's back link must preserve the return_to param so PA returns to the same filtered/paged queue view.
- Do NOT skip the two-tone focus ring on any element, including the JSON payload viewer's copy button.
- Do NOT display the JSON payload in a non-monospace font.
- Do NOT paint the decision panel background with `--lc-action-primary`. That token is reserved for the Approve button fill only.
- Do NOT ship the mobile viewport as anything other than the "PA console requires a desktop screen" info block.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Stripe Radar / Reviews detail** — left-column context + right-column decision panel + reason-vocab modal.
- **GitHub PR review** — inline validator lint checklist analogous to CI checks; approve/request-changes buttons stacked.
- **Sentry issue detail** — audit-trail tab pattern with timeline of events.
- **Linear issue detail** — sticky right panel with quick actions + related history collapsible.
- **AGN-MEM-002b application detail (WingCaster)** — direct family pattern predecessor; same two-column shell + sticky decision panel + keyboard continuity.

Do NOT match:

- Salesforce record detail (over-tabbed, low decision affordance).
- Kanban card modal (wrong pattern for a persistent detail route).

---

## Backend contract

**Detail endpoint:** `GET /api/admin/moderation/portals/:submissionId`

**Response 200:** superset of the queue-row payload plus:
```json
{
  "submission": {
    "id": "psub_abc123",
    /* …all fields from PA-MOD-001 queue row… */
    "listing_preview": {
      "hero_image_url": "…",
      "gallery": ["…", "…"],
      "price": { "amount_minor": 285000000, "currency": "AED", "basis": "sale" },
      "specs": { "beds": 3, "baths": 3, "area_m2": 168 },
      "amenities": ["pool", "gym", …],
      "description": "…",
      "agent_contact": {
        "phone_masked": "+971 5* *** **12",
        "email_masked": "s***@***.com",
        "whatsapp_deeplink": "https://wa.me/…"
      }
    },
    "agent_context": {
      "wingcaster_tenure_month": "2024-01",
      "portfolio_size": 27,
      "prior_decision_summary_30d": { "approved": 12, "rejected": 1, "request_info": 0 }
    },
    "agency": {
      /* …plus… */
      "two_person_reject_required": true
    },
    "validator_lint": {
      "checks": [
        {
          "code": "trakheesi_number_present",
          "severity": "pass" | "warn" | "fail",
          "message": "Trakheesi number present.",
          "expected": "Non-empty string matching DLD format",
          "actual": "1234567890"
        }
      ]
    },
    "portal_payload_preview": { /* exact JSON that will POST to portal on approve */ },
    "notification_previews": {
      "approve": "Your listing '3BR apartment · Dubai Marina' has been published to Property Finder AE.",
      "reject": "Your listing was not published to Property Finder AE. Reason: {reason_code_label}. Notes: {notes}",
      "request_info": "Your listing needs an update before Property Finder AE will publish it. Reason: {reason_code_label}. Notes: {notes}"
    },
    "is_own": false,
    "is_already_decided": false,
    "step_up_required": false,
    "env": "live"
  }
}
```

**Sibling lookup:** `GET /:submissionId/sibling?direction=next|prev&<same-queue-filters>` → `{ next_submission_id: "psub_def456" | null }`.

**History:** `GET /:submissionId/history` → `[{ portal_code, submitted_at, status, decided_at, decided_by }, …]`.

**Audit trail:** `GET /:submissionId/audit` → timeline events.

**Contact reveal:** `POST /:submissionId/reveal-contact` → `{ phone_full, email_full }` (audited).

**Actions:** same as PA-MOD-001 — `POST /:submissionId/approve` `.../reject` `.../request-info` `.../undo-approve` `.../undo-reject`. Reject with `{ reason_code, notes }` — if agency.two_person_reject_required + tenure_risk=high, server responds `{ state: "REJECT_PROPOSED", approval_request_id: "apr_…" }` instead of finalizing; PA-APR-001 shows the entry.

**Prerequisites (deltas from PA-MOD-001):**

- `[BE-VERIFY-11] Sibling-queue-position lookup — NEW.** Endpoint `GET /:submissionId/sibling?direction=…&<queue-filters>` for J/K navigation. ~1 day backend. **File in kickoff §5a.**
- `[BE-VERIFY-12] Agency two_person_reject_required flag — NEW.** Boolean column on `agencies` (or derived from tenure-risk × agency-policy). Confirm schema + surface in `GET /:submissionId` payload. ~0.5 day.
- `[BE-VERIFY-13] Contact-reveal audit endpoint — NEW.** `POST /:submissionId/reveal-contact` must audit-log the reveal + return unmasked values only to the requesting PA. ~1 day.
- `[BE-VERIFY-14] Portal payload preview generation — NEW.** Server must serialize the exact per-portal payload it would POST on approve, so PA can inspect. Requires per-portal serializer functions (paired with the validator modules from `[BE-BLOCKER-07]`). ~1 day per portal serializer × 8 = 8 days (if not already covered by the publisher adapter work in `[BE-BLOCKER-01]`).
- `[BE-VERIFY-15] Notification preview substitution — NEW.** Server or client renders the exact copy the agent will see with reason_code + notes substituted. Client-side substitution acceptable if server exposes template strings. ~0.5 day.
- All other prereqs (`[BE-BLOCKER-02b]` route family, `[BE-BLOCKER-07]` validators, `[BE-DESIGN-02]` tenure risk) shared with PA-MOD-001.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/admin/moderation/PortalModerationDetailPage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `<Route path="/admin/moderation/portals/:submissionId" element={<PortalModerationDetailPage />} />` behind `PAConsoleGuard` (`portal-moderation` capability pack).
- **Component decomposition:**
  - `PortalModerationDetailPage.tsx` — page shell + data fetching + URL/tab state + env context.
  - `PortalListingPreviewPanel.tsx` — hero + gallery + specs + amenities + description + agent contact.
  - `AgentAgencyContextBlock.tsx` — avatar + name + agency link + metadata row.
  - `ListingHistoryAccordion.tsx` — collapsible prior submissions.
  - `ValidatorLintChecklist.tsx` — stacked check rows with pinning.
  - `ModerationDecisionPanel.tsx` — tenure risk + notices + three action buttons.
  - `PortalPayloadTab.tsx` — JSON viewer + Copy button.
  - `NotificationPreviewTab.tsx` — three side-by-side previews.
  - `AuditTrailTab.tsx` — timeline (this is `PA-MOD-003` embedded).
  - Reuses `PAQueueBulkApproveDialog` from PA-MOD-001 for single-approve AlertDialog (variant).
  - Reuses `PAQueueBulkReasonDialog` from PA-MOD-001 for single-reject / single-request-info Dialog (variant).
- **Data layer:**
  - Hook: `usePortalModerationDetail(submissionId, env)`.
  - Hook: `useSubmissionSibling(submissionId, direction, filters)` — for J/K.
  - Optimistic-update helpers reuse the PA-MOD-001 pattern.
- **Test discipline:**
  - Unit: each sub-component renders variants.
  - Integration: full detail load × approve happy path × reject standard × reject two-person → PA-APR-001 shows the proposal × request-info × step-up × own-submission block × already-decided read-only × portal-api-down at approve × contact reveal audits × tab deep-links × J/K sibling nav × env-switch mid-flow.
  - RTL + dark + Broadcast + accessibility (axe-core).
- **Perf:**
  - Prefetch sibling on hover of prev/next.
  - Load below-main tabs lazily.

---

## Broadcast alignment callouts (deltas from anchor only)

- Listing preview panel: `var(--lc-surface-raised)` + `var(--lc-elevation-sm)` + `var(--lc-radius-lg)` + `padding: var(--lc-space-xl)`.
- Hero image: `var(--lc-radius-lg)`; gallery thumbs: `var(--lc-radius-md)`.
- Amenities chips: `<Badge variant="outline">` + `var(--lc-radius-pill)`.
- Description body: `var(--lc-type-body-lg)` for legibility.
- Agent contact reveal buttons: `<Button variant="ghost" size="sm">` with `Eye` icon.
- Validator lint checklist: card `var(--lc-surface-raised)`; individual check rows use `--lc-status-*` per severity + glyph.
- Decision panel sticky `top: calc(var(--lc-nav-height) + var(--lc-nav-warning-strip-height, 0px) + var(--lc-space-xl))`.
- Approve button `<Button size="lg" variant="default">` full-width, `--lc-action-primary` fill.
- Reject button `<Button size="lg" variant="outline">` full-width, `--lc-border-strong` outline.
- Request-info button `<Button size="lg" variant="outline">` full-width, `--lc-status-warning` outline.
- Two-person-rule notice: `--lc-status-warning-subtle` fill + `Shield` icon.
- Step-up notice: `--lc-status-danger-subtle` fill + `AlertTriangle` icon.
- Own-submission block: `--lc-status-warning-subtle` fill + `AlertTriangle`, replaces the entire decision panel.
- Queue-position chip: teal `--lc-accent` + `--lc-accent-bold-edge` outline — the ONLY teal usage on this screen.
- JSON payload viewer: `var(--lc-surface-sunken)` + `var(--lc-font-mono)` + `var(--lc-type-data-sm)` + `var(--lc-radius-md)`.
- Motion: decision panel button hover `--lc-duration-fast`; step-up modal `--lc-duration-slow` `--lc-easing-out`; success toast + auto-nav-next `--lc-duration-base`; tab switch `--lc-duration-fast`.
- All other tokens (page shell, env badge, TEST warning strip, focus rings, status pills, validator lint pills, tenure risk badges, elevation, radii) inherited from PA-MOD-001 callout block unchanged.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat AFTER the PA-MOD-001 pass so v0 has the family pattern. Framing prompt:

```
I'm designing the WingCaster Platform Admin (PA) portal moderation detail screen (PA-MOD-002) — the single-submission review surface that PA-MOD-001 queue drills into (WF-03 approver-side). Desktop 1440px ONLY. Same PA console shell as PA-MOD-001 (env badge in top bar; optional TEST warning strip). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind, Broadcast semantic tokens (--lc-*).

First pass: render the desktop 1440px layout with LIVE env, "Submission 3 of 18 pending" chip, the 3BR Dubai Marina listing preview on the left, agent+agency context block below, history accordion collapsed. Right column: validator lint (6 pass · 0 warn · 0 fail, collapsed passing list) + sticky decision panel (Low tenure risk banner, three stacked buttons Approve/Reject/Request info). Below-main tabs: Portal payload (active, showing JSON) · Notification preview · Audit trail.

LTR English only for this pass — I'll ask for Reject modal, High-risk two-person variant, TEST env, own-submission block, RTL Arabic, and dark mode as separate follow-ups.

Follow the copy table exactly. Do NOT claim the portal preview is authoritative — always caption it as a Wingcaster-side preview. Do NOT fabricate any portal-approval likelihood scoring.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now the Reject modal open — reason Select "Insufficient photos" highlighted, notes textarea empty, Reject button enabled.`
2. `Now the High-risk two-person-rule variant — different sample (Riyadh off-plan submission), tenure risk banner shows High (red), step-up notice + two-person-rule notice visible above buttons. Reject button copy = "Send to second approver".`
3. `Now the TEST env — badge amber TEST + full-width warning strip under top bar.`
4. `Now the own-submission variant — decision panel replaced with "You can't decide this submission" block; audit trail tab pre-selected below.`
5. `Now Notification preview tab active — three side-by-side previews (Approve / Reject / Request info) with sample reason "Insufficient photos" substituted.`
6. `Now Audit trail tab active — timeline of events including a prior request-info cycle 3 days ago.`
7. `Now RTL Arabic at desktop 1440px — mirror the whole layout; decision panel becomes left column; chevrons swap.`
8. `Now dark mode of pass 1.`

Save each output's JSX to `docs/design/mockups/v0-outputs/PA-MOD-002/` + screenshot to `docs/design/mockups/PA-MOD-002-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 8 iteration states.
- [ ] Screenshots + JSX committed under `docs/design/mockups/` and `docs/design/mockups/v0-outputs/PA-MOD-002/`.
- [ ] Cursor Wave-2 dispatch prompt references this brief + the mockup paths + the paired PA-MOD-001 brief.
- [ ] `[BE-VERIFY-11..15]` filed in kickoff §5a.
- [ ] Reuse of `PAQueueBulkApproveDialog` + `PAQueueBulkReasonDialog` from PA-MOD-001 confirmed in the Cursor prompt.
- [ ] PA-MOD-003 audit trail tab treated as embedded here (no separate route in v1 — per matrix note "Route: tab in PA-MOD-002").
