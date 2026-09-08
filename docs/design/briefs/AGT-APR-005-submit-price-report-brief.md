# Screen Brief — AGT-APR-005 · Submit price report (WF-06 Initiator)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §25 entry `AGT-APR-005`. Week 5 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 50 + §6 Week 5 (WF-05 + WF-06 valuation-review deadlock resolution). Opens the WF-06 (Agent price report) chain that lands on `PA-PVA-009` / `PA-PVA-009b` (PA editorial review) and closes at `AGT-REC-003` (agent-side outcome). Sibling: `AGT-APR-006` (my-submitted-reports list — separate brief).

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii / elevation references below are governed by that reference. Never introduce raw hex, never introduce a `--lc-orange-*` primitive alias, never use a Tailwind palette class that isn't already remapped to a Broadcast semantic in `web/tailwind.config.js`.

**Reuses the two shared primitives introduced by `AGT-APR-004-submit-bad-comparable-report-brief.md`:** `<EvidenceUploader>` (this brief passes `max_files=5`) and `<ContextEchoCard>` (this brief renders for the subject-property or subject-area of the analysis). Neither primitive is redefined here — see AGT-APR-004 §Shared component palette for definitions.

**Screen-specific Broadcast callouts:**

- **Screen shell** — full page, NOT a modal. Route `/reports/prices/new`. Centered max-width 760px column on `--lc-bg-page`. Editorial-composition surfaces are load-bearing here — a Pro agent needs full attention. Modal would signal "quick thing" which is wrong for a thought-leadership submission.
- **Top page hero** — 96px tall band, `--lc-surface-sunken` background, `var(--lc-space-xl)` padding. Left: `Sparkles` glyph 24×24 tinted `--lc-accent-bold-edge` + heading "Submit a price report" `var(--lc-type-heading-1)` + subheading `var(--lc-type-body)` `--lc-text-muted` "Your expert take on market pricing, reviewed by PA and published to your public profile." Right: Pro-tier badge `<Badge>` with `Crown` glyph, `--lc-accent-bold-{bg,fg}` + `--lc-accent-bold-edge` border, label "Pro feature".
- **Section stepper (visual only, not a wizard)** — inline `<ol>` under the hero, 4 numbered dots with connector rules, sections in order: `Subject` → `Recommendation` → `Rationale` → `Publication`. Completed sections get filled dots `var(--lc-accent-bold)` with `var(--lc-accent-bold-edge)` outline; current section is open ring; upcoming sections are muted `var(--lc-border-strong)`. Reads for scanning progress; the page still scrolls as one document — no step-by-step wizard.
- **Section cards** — each of the 4 sections is a `<Card>` with `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)`. Section title `var(--lc-type-heading-2)`. Section helper `var(--lc-type-body-sm)` `--lc-text-muted`. Card padding `var(--lc-space-xl)`. Gap between cards `var(--lc-space-lg)`.
- **Section 1 — Subject** — subject-type selector at top: `<RadioGroup>` as horizontal segmented control, options `Specific property` / `Area or market segment`. Selecting property reveals a property-picker `<Combobox>` fed by `GET /api/listings/search?q=<term>&scope=my_agency` (agent's own or agency's listings) OR "Search all comparables" toggle expanding scope. Selecting area reveals a two-part picker: market `<Select>` (city/emirate — from `editorial_config.markets`) + neighborhood `<Combobox>` scoped to that market. Once selected, the subject renders as a `<ContextEchoCard>` (the shared primitive from APR-004) with property/area details + a "Change" ghost button to re-pick.
- **Section 2 — Recommendation** — price recommendation input group. Currency `<Select>` (AED default, USD, SAR, EGP, LBP, JOD, OMR, BHD, KWD from `editorial_config.currencies`) + amount `<Input type="number">` with `<Numeric>`-styled display + unit `<Select>` (`per-sqft`, `per-sqm`, `total`). All three inputs sit in one horizontal group; the amount is the visually dominant field. Below: `<Slider>` (optional) for confidence range — agent can set a range `[low, high]` around the point recommendation; toggle "Add a range" reveals it. Range renders as an inline visualization: a horizontal bar with the point marker + the range span rendered as a lighter fill.
- **Section 3 — Rationale** — two sub-fields:
  - **Cited comparables** — a `<Combobox>` (multi-select) fed by `GET /api/comparables/search?q=<term>&near=<subject>&limit=20`. Each selected comparable appears as a chip below the picker with: address, price `<Numeric>`, area `<Numeric>`, source `<ChannelMark>`, and a small X to remove. Up to 10 chips. Ordered by relevance (closest / most-recent first).
  - **Analysis** — `<Textarea>` with autosize 6 rows visible, up to 20 rows max. Placeholder helper "Explain your reasoning. What does the data show that the raw price alone misses?" Character counter bottom-right, limit 3000 chars (soft, not hard — this is thought-leadership, not a support ticket). Markdown-subset supported: paragraph, line break, bold, italic, link, unordered list. Preview toggle bottom-right of the textarea flips to a rendered `<div>` view with the same styling PA and the public profile will use.
- **Section 4 — Publication** — three sub-groups:
  - **Evidence uploader** — `<EvidenceUploader>` primitive, `max_files=5`, accepts JPG/PNG/HEIC/PDF/CSV/XLSX. Helper: "Attach the data behind your analysis — CSVs, developer decks, sold-price screenshots. PA reviews faster with sources they can verify."
  - **Publication scope** — `<RadioGroup>` (3 vertical rows, each a card): `Public — on my profile` (default; `Globe2` glyph) / `Agency-only — visible inside {Agency}` (auto-disabled if agent has no agency; `Building2` glyph) / `Private — my reference only` (`Lock` glyph). Each option has helper copy underneath explaining the audience.
  - **Confidence + urgency** — two segmented controls stacked:
    - Confidence: `Analytical estimate` / `Data-supported` / `Verified with source` (3 segments, mirrors AGT-APR-004's confidence but with editorial framing).
    - Urgency: `Standard` / `Time-sensitive — market is moving` (2 segments). Time-sensitive urgency puts the report at the front of the PA queue but requires a one-sentence justification field that appears below when selected.
- **Submit footer** — full-width footer strip below the last section card. `--lc-surface-raised` + top-border `--lc-border` + upward `--lc-elevation-sm`. Left: "Save as draft" `<Button variant="ghost">` (writes to `agent_price_reports` with `status='draft'`, no PA notification). Right: "Submit for PA review" `<Button variant="default" size="lg">`. Between them: small helper "Your draft autosaves every 30s." On submit, primary button shows `Loader2` + "Sending to PA…".
- **Success confirmation state** — the whole page swaps to a `<StatusHero>` (borrowed from the REC-004 anchor) with `state="pending"` and label "Report received — under PA editorial review", plus SLA line ("Typical editorial review: 48 hours"), publication-scope pill echo, and two CTAs: `<Button variant="default">` "View my reports" (routes to `AGT-APR-006`) + `<Button variant="outline">` "Start another report".
- **Upsell state** (agent's tier is below the gate — see §Tier gating) — the whole page body is replaced with an upsell card. Hero glyph `Crown` tinted `--lc-action-primary`, heading "Price reports are a Pro feature", body "Establish yourself as a market voice — Pro-tier agents publish price analyses to their public profile with WingCaster's editorial team.", plus two CTAs: `<Button variant="default">` "See Pro plans" (routes to `AGT-SUB-002` plan comparison with the WF-06 feature pre-highlighted) + `<Button variant="ghost">` "Learn more" (opens a docs sheet).
- **Motion** — subject-type select animates the picker in below with `var(--lc-duration-base)` `<Collapsible>` height transition. Comparable chip add / remove animates with `var(--lc-duration-fast)` opacity+translate. Preview toggle cross-fades between edit and preview at `var(--lc-duration-base)`. Success-state cross-fade `var(--lc-duration-base)`. Respect `prefers-reduced-motion` → skip transitions, instant swap.
- **Focus rings + 44px tap floor** — automatic via base CSS. Do NOT override.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-APR-005 |
| Screen name | Submit price report |
| Persona | **Pro-tier agent ONLY** (any tenant carrying the `valuation.price_reports.submit` feature flag on its active package version — see §Tier gating). Non-Pro agents see the upsell state. |
| Device targets | Mobile 375px (secondary — most Pro reports are drafted on desktop), tablet 768px, desktop 1440px (primary) |
| Locale | English + Arabic (RTL) — both mandatory. Report body may be authored in either language independently of the UI locale (mixed-language markets are normal). |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/reports/prices/new` (query params: `?subject_type=property\|area`, `?listing_id=<id>` OR `?market=<slug>&neighborhood=<slug>` to pre-fill subject, `?draft_id=<id>` to resume a saved draft). Edit route uses the same page: `/reports/prices/:reportId/edit` (only valid when status ∈ draft / needs_revision / approved_with_edits per WF-06 chain). |
| Current state | PARTIAL — `web/src/pages/AgentPricingPage.tsx` renders a legacy pricing entry surface. This brief supersedes with the WF-06-aligned submission form. |
| Workflow role | WF-06 role=Initiator. Feeds `PA-PVA-009` queue. Outcome delivered at `AGT-REC-003`. |
| Backend prerequisites | ⏳ `agent_price_reports` table (new — see §Backend contract) · ⏳ `POST /api/reports/prices` (create) · ⏳ `PATCH /api/reports/prices/:id` (draft autosave + edit) · ⏳ `POST /api/reports/prices/:id/submit` (draft → pending) · ⏳ Tier-gating check `has_feature(user_tenant_id, 'valuation.price_reports.submit')` server-side · ✅ Comparable search endpoint (existing per `AGT-APR-004`) · ✅ Listing search endpoint (existing) · ⏳ Shared `<EvidenceUploader>` primitive + `POST /api/uploads/evidence/sign` (blocked by `[BE-BLOCKER-05b]` filed in `AGT-APR-004`) · ⏳ `editorial_config` table (markets, currencies, sla_hours, per-market editorial-strictness) · ⏳ Push template `agent_price_report.received` (single variant, agent's own submission confirmation) · ✅ `package_feature_flags` table (existing — supports the tier gate; see §Tier gating) |

---

## Purpose

A Pro-tier agent authors a considered market-pricing analysis — a signed piece of expert content — and submits it to PA for editorial review. Approved reports (Public scope) land on the agent's public profile at `SHR-PUB-002` as evidence of thought leadership, feed WingCaster's public insights corpus at `wingcaster.com/insights`, and (for `Public` scope) may be featured on `Bazaar` consumer surfaces where the analysis is relevant.

The report is NOT a bug report (see AGT-APR-004 for that) — it's editorial content. Emotional register: high effort, high pride. A Pro agent invests time in these; the form must honor that. The PA reviewer is looking for accuracy + tone + market-safety, not moderation.

The WF-06 chain: agent submits here → row lands in `agent_price_reports` with `status=pending` → surfaces on `PA-PVA-009` (queue) → PA reads on `PA-PVA-009b` → outcome one of `approved_for_publication` / `published` (Public scope, auto-published) / `approved_agency_only` / `approved_private` / `approved_with_edits` (PA suggested edits — agent reviews at REC-003) / `needs_revision` (PA wants changes — agent revises and resubmits via this same page in edit mode) / `rejected` (PA declines). Agent sees the outcome at `AGT-REC-003`.

Success outcome: report is `pending` with PA and the agent has received a confirmation state on this page with the SLA + publication-scope echo + link to their reports list.

---

## Design goals

1. **The screen respects the effort.** Full-page composition surface. Section cards with heading + helper copy that treat each part of the report as a distinct authorial move (subject / recommendation / rationale / publication). No cramped modal, no minimal wizard.
2. **Reuse the shared primitives.** `<EvidenceUploader>` and `<ContextEchoCard>` land in AGT-APR-004 first; this screen reuses them verbatim. Consistency across agent submission forms.
3. **Progressive disclosure without hiding intent.** Subject picker reveals subject-type-specific pickers. Publication-scope selection reveals scope-specific helpers. Time-sensitive urgency reveals justification. But every section is visible on the page — no wizard steps that hide upcoming decisions from the agent.
4. **Draft-first.** Every form input autosaves every 30 seconds as `status='draft'` if the agent has typed anything. Save-as-draft button explicit for those who want to close and come back later. Draft resumption via `?draft_id=<id>` query param OR from `AGT-APR-006` list.
5. **Publication scope is a first-class field, not a footnote.** The scope choice determines how the report will feel to the agent's public presence — Public is the payoff, Agency-only is a safer test, Private is a personal record. Each option has helper copy explaining who sees what.
6. **Tier-gate is a considered upsell, not a shame gate.** Non-Pro agents landing here see an upsell that leads with the value ("Establish yourself as a market voice") not the friction ("You can't use this feature"). Route to plan comparison with WF-06 pre-highlighted.
7. **RTL-first for MENA.** Full mirror. Section stepper flows right-to-left. Subject pickers mirror. Preview mode of the textarea renders in the AR direction if the agent typed AR. Currency + numeric fields stay LTR bidi-embedded.

---

## Tier gating

**This screen is gated by the `valuation.price_reports.submit` feature flag on the tenant's active package version.**

- **Uses the existing `package_feature_flags` registry** from the packages/features work (PRs #33-#39, `backend/src/persistence/migrations/302_packages_data_model.sql` + `304_packages_free_tier_seed.sql`). No new gate machinery is introduced — this brief only requires a NEW feature flag row to be seeded onto Pro-tier package versions.
- **Backend gate:** on every request to `POST /api/reports/prices` (and the PATCH / submit endpoints), the handler resolves the caller's active tenant → active package version → checks `SELECT enabled FROM package_feature_flags WHERE package_version_id = $1 AND feature_code = 'valuation.price_reports.submit'`. If not enabled OR row missing, returns 403 `FEATURE_NOT_ENABLED` with `{ feature: 'valuation.price_reports.submit', upsell_route: '/plans?highlight=wf06' }`.
- **Frontend gate:** on route entry, the page fetches `GET /api/users/me/features` (or reads the cached feature set from the session context). If `valuation.price_reports.submit` is not present or `false`, render the upsell state instead of the form. Never render the form and then 403 on submit — that's a bad UX.
- **Seed migration required:** a new migration (call it `316_packages_wf06_feature.sql`) inserts `package_feature_flags` rows for every Pro-tier package version with `feature_code='valuation.price_reports.submit'`, `enabled=true`. File as `[BE-BLOCKER-06e] WF-06 feature-flag seed` — Week 5 dependency. Free-tier and lower-tier packages simply do NOT get the row (absence = disabled).
- **Feature-code naming convention:** matches the existing convention seen in migration 304 (`crm.contacts`, `crm.tasks`, `crm.opportunities`, `listings.crud`). The dot-separated `<domain>.<action>` shape is the project standard.

---

## Layout

### Desktop 1440px (primary)

Centered max-width 760px column, `--lc-bg-page` background, `var(--lc-space-2xl)` top padding, `var(--lc-space-4xl)` bottom padding.

1. **Top page hero** — 96px tall band with `Sparkles` glyph left, heading + subheading center-aligned to left column, Pro-tier badge right.
2. **Section stepper** — inline `<ol>` under the hero, 4 numbered dots with connector rules and section labels (Subject · Recommendation · Rationale · Publication).
3. **Section 1 card — Subject** — heading, helper, subject-type segmented control, revealed picker, `<ContextEchoCard>` echo once selected.
4. **Section 2 card — Recommendation** — heading, helper, price group (currency + amount + unit), optional range toggle + slider.
5. **Section 3 card — Rationale** — heading, helper, cited-comparables combobox + chip list, analysis textarea with preview toggle + char counter.
6. **Section 4 card — Publication** — heading, helper, evidence uploader, publication-scope radio cards, confidence + urgency segmented controls (+ conditional justification input).
7. **Sticky footer** — sits at bottom of viewport (`position: sticky; bottom: 0`), Save-as-draft left / autosave helper center / Submit right.

### Tablet 768px

Same column layout at max-width 640px. Section cards padding `var(--lc-space-lg)`. Section stepper wraps to 2 rows if needed.

### Mobile 375px

Full-width column, no centered max-width. Section cards padding `var(--lc-space-md)`. Section stepper renders vertically (each step on its own row with connector rule between). Price group stacks vertically (currency select on its own row, amount on its own row, unit select on its own row). Cited-comparables chip list wraps aggressively; chips truncate address at 20 chars. Sticky footer bar becomes primary-full-width + Save-as-draft as a text link above.

### RTL

Full mirror. Section stepper flows right-to-left with connector rules mirrored. Section card content order mirrors. Subject picker + comparable picker items mirror. Price group order mirrors (currency on the right, amount center, unit on the left). Preview mode renders in author's chosen text direction (an AR-language body renders RTL even if UI locale is EN, and vice versa — `dir="auto"` on the preview `<div>`). Sticky footer buttons: Save-as-draft on right, Submit on left. Cited-comparable chips flow right-to-left.

### Edit mode `/reports/prices/:reportId/edit`

Same layout, hydrated with the report's existing fields. Two behavioral changes:
- Top page hero heading swaps to "Edit price report" + subheading swaps to state-appropriate helper ("PA requested revisions on your report — see notes below." for `needs_revision`).
- If PA left revision notes, render a `<Callout>` at the top of the page (below hero, above section stepper) with `AlertCircle` glyph tinted `--lc-status-warning-fg`, background `--lc-status-warning-bg`, heading "PA feedback on your last submission", body = PA's notes rendered via the same Markdown-subset renderer used in `<ResolverMessage>`.
- Submit button copy changes to "Resubmit for PA review".

### Success state (post-submit)

Whole page body swaps to `<StatusHero state="pending">` with label "Report received — under PA editorial review". Below: SLA line "Typical editorial review: 48 hours" + publication-scope echo pill + two CTAs (`View my reports` primary, `Start another report` outline). Top page hero + section stepper remain visible; only the section-card stack + sticky footer swap.

### Upsell state (non-Pro tier)

Whole page body swaps to a centered upsell card at max-width 560px, `<Card>` with `--lc-elevation-md`, padding `var(--lc-space-2xl)`. Hero glyph `Crown` 40×40 tinted `--lc-action-primary` centered. Heading "Price reports are a Pro feature" `var(--lc-type-heading-1)`. Body "Establish yourself as a market voice — Pro-tier agents publish price analyses to their public profile with WingCaster's editorial team." `var(--lc-type-body)`. Three-bullet list of what Pro unlocks (with `Check` glyphs): "Publish to your public agent profile" / "WingCaster editorial team review" / "Featured on Bazaar consumer surfaces". Two CTAs: `<Button variant="default" size="lg">` "See Pro plans" + `<Button variant="ghost">` "Learn more".

---

## Reused shared components

**Not redefined here — see `AGT-APR-004-submit-bad-comparable-report-brief.md` §Shared component palette.**

- `<EvidenceUploader>` — this brief passes `max_files=5`, `accepted_types=['image/jpeg', 'image/png', 'image/heic', 'application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']` (adds XLSX vs the APR-004 set).
- `<ContextEchoCard>` — this brief renders it for the selected subject (property or area).

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Page hero heading | Submit a price report |
| Page hero subheading | Your expert take on market pricing, reviewed by PA and published to your public profile. |
| Pro badge label | Pro feature |
| Section 1 title | 1. Subject |
| Section 1 helper | What is this report about? |
| Subject-type — property | Specific property |
| Subject-type — area | Area or market segment |
| Property picker label | Search a listing |
| Property picker placeholder | Address, portal-ID, or agent… |
| Property scope toggle | Search all comparables, not just my agency |
| Area picker — market label | Market |
| Area picker — neighborhood label | Neighborhood |
| Area picker — neighborhood placeholder | Search neighborhoods in {market}… |
| Change subject button | Change |
| Section 2 title | 2. Recommendation |
| Section 2 helper | What is your price recommendation? |
| Currency label | Currency |
| Amount label | Amount |
| Unit label | Unit |
| Unit — per-sqft | per sqft |
| Unit — per-sqm | per sqm |
| Unit — total | Total |
| Add range toggle | Add a confidence range |
| Range low label | Low estimate |
| Range high label | High estimate |
| Section 3 title | 3. Rationale |
| Section 3 helper | What supports your recommendation? |
| Cited-comparables label | Cited comparables (up to 10) |
| Cited-comparables placeholder | Search comparables near {subject}… |
| Cited-comparables empty helper | Add comparables that anchor your analysis. |
| Analysis label | Analysis |
| Analysis placeholder | Explain your reasoning. What does the data show that the raw price alone misses? |
| Analysis counter format | {n} / 3000 |
| Analysis preview toggle — edit | Edit |
| Analysis preview toggle — preview | Preview |
| Section 4 title | 4. Publication |
| Section 4 helper | How should PA handle publication? |
| Evidence label | Evidence (optional, up to 5 files) |
| Evidence helper | Attach the data behind your analysis — CSVs, developer decks, sold-price screenshots. PA reviews faster with sources they can verify. |
| Publication scope label | Where should this appear? |
| Scope — public — title | Public — on my profile |
| Scope — public — helper | Live on your public agent profile at wingcaster.com/agents/{slug} and eligible for the WingCaster insights feed. |
| Scope — agency — title | Agency-only — visible inside {agency_name} |
| Scope — agency — helper | Live inside your agency's workspace only. Not shown publicly. |
| Scope — agency — disabled helper | You need to be a member of an agency workspace to publish agency-only reports. |
| Scope — private — title | Private — my reference only |
| Scope — private — helper | Kept as your own reference. Not shared with anyone. |
| Confidence label | How confident are you? |
| Confidence — analytical | Analytical estimate |
| Confidence — data | Data-supported |
| Confidence — verified | Verified with source |
| Urgency label | Timing |
| Urgency — standard | Standard |
| Urgency — time-sensitive | Time-sensitive — market is moving |
| Urgency justification label | Why is this time-sensitive? (one sentence) |
| Urgency justification placeholder | e.g. Developer announced a new tower launch this morning. |
| Save-as-draft button | Save as draft |
| Autosave helper | Your draft autosaves every 30 seconds. |
| Autosave — just saved | Saved. |
| Autosave — saving | Saving… |
| Autosave — failed | Autosave failed. Check your connection. |
| Submit button — idle | Submit for PA review |
| Submit button — in-flight | Sending to PA… |
| Submit button — edit mode idle | Resubmit for PA review |
| Success — hero label | Report received — under PA editorial review |
| Success — SLA line | Typical editorial review: 48 hours |
| Success — scope echo — public | Scope: **Public** — on your profile |
| Success — scope echo — agency | Scope: **Agency-only** — visible inside {agency_name} |
| Success — scope echo — private | Scope: **Private** — your reference only |
| Success — body | Thanks. PA will review your report and let you know the outcome on your inbox. |
| Success — primary CTA | View my reports |
| Success — secondary CTA | Start another report |
| Edit-mode PA feedback callout title | PA feedback on your last submission |
| Upsell hero heading | Price reports are a Pro feature |
| Upsell body | Establish yourself as a market voice — Pro-tier agents publish price analyses to their public profile with WingCaster's editorial team. |
| Upsell bullet 1 | Publish to your public agent profile. |
| Upsell bullet 2 | WingCaster editorial team review. |
| Upsell bullet 3 | Featured on Bazaar consumer surfaces. |
| Upsell CTA — primary | See Pro plans |
| Upsell CTA — secondary | Learn more |
| Network error toast | Couldn't save — check your connection and try again. |
| Comparable-limit reached toast | You've cited 10 comparables — the max for one report. |

---

## Sample content (for v0 / mockup)

Show the desktop 1440px layout with:

- **Hero:** heading, subheading, Pro badge.
- **Section stepper:** Sections 1-3 complete (filled dots), Section 4 current (open ring), all with labels.
- **Section 1 — Subject:** subject-type set to `Area or market segment`. Market picker set to `Dubai`. Neighborhood picker set to `Dubai Marina`. Below: `<ContextEchoCard>` showing "Dubai Marina" + subtitle "Dubai, UAE" + meta row "3,124 active listings · avg AED 1,850/sqft · Q3 2026" with `MapPin` glyph. Change ghost button top-right.
- **Section 2 — Recommendation:** currency `AED` selected, amount `1,650` (rendered via `<Numeric>`), unit `per sqft` selected. Range toggle enabled: slider showing low `AED 1,500` / high `AED 1,800`.
- **Section 3 — Rationale:** cited comparables chip list with 4 chips (Marina Heights T2 · AED 2.85M · 1,120 sqft · Bayut; Torch Tower · AED 3.2M · 1,340 sqft · Property Finder; Cayan Tower · AED 4.1M · 1,700 sqft · Bayut; Marina Gate 1 · AED 2.9M · 1,050 sqft · Dubizzle). Analysis textarea filled with a 3-paragraph analysis (~400 words) — sample: "Q3 2026 has seen Dubai Marina's sqft-price band contract meaningfully. The four comparables cited above bracket the Marina's mid-tier at AED 1,650/sqft, down from Q2 2026's AED 1,780/sqft mean. Three drivers explain the softening..." Preview toggle set to `Edit`. Counter shows `412 / 3000`.
- **Section 4 — Publication:** evidence uploader with 2 uploaded tiles (`Q3-marina-comparables.csv`, 42 KB, complete; `Marina-supply-Q3.pdf`, 1.2 MB, complete) + add-tile. Publication scope: `Public — on my profile` selected (orange border + check glyph). Confidence: `Data-supported` selected. Urgency: `Standard` selected.
- **Sticky footer:** Save-as-draft (left, ghost) + autosave helper center ("Saved.") + Submit for PA review (right, primary orange, enabled).

Iteration order for v0 after first pass:

1. Same desktop viewport, freshly opened, no subject picked, Section 1 stepper current, all subsequent sections rendered but visually muted / inputs disabled, Submit disabled.
2. Same desktop viewport, subject-type = `Specific property`, property picker with a listing selected (`<ContextEchoCard>` showing "Villa 8, Emirates Hills Sector L" + AED 32M · 8 BR · 12,000 sqft), rest of the form empty.
3. Same desktop viewport, submit in-flight, primary button shows Loader2 + "Sending to PA…", form disabled.
4. Same desktop viewport, success state — StatusHero "Report received — under PA editorial review" + SLA line + scope echo "Scope: Public — on your profile" + View-my-reports primary + Start-another-report outline.
5. Same desktop viewport, edit mode with PA feedback callout at top ("Add a chart or table · Add a sources section · Correct the Cayan Tower area figure — see notes below"), form pre-filled with the previous submission's content, submit button copy "Resubmit for PA review".
6. Same desktop viewport, upsell state (non-Pro tier) — full page body replaced with the upsell card.
7. Mobile 375px, same section-4 in-progress state as pass 1, showing vertical section stepper + stacked price group + wrapped chip list.
8. RTL Arabic mirror at desktop 1440px, same in-progress state as pass 1, `[TRANSLATION-PENDING]` copy where AR is missing.
9. Dark mode desktop, same in-progress state as pass 1.
10. Analysis textarea in Preview mode (Section 3 zoomed) — showing the rendered Markdown-subset with paragraphs, one bold phrase, one link.

Save each output's JSX to `web/src/components/reports/SubmitPriceReportPage/` + screenshot to `docs/design/mockups/AGT-APR-005-<state>.png`.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Page hero | Custom `<header>` block with `Sparkles` glyph + heading + `<Badge>` |
| Section stepper | Custom `<ol>` with dot / label / connector-rule pattern |
| Section card | `Card` with `CardHeader` + `CardContent` |
| Subject-type segmented control | `RadioGroup` styled as segmented control |
| Property picker | `Command` combobox (shadcn `<Combobox>`) fed by `/api/listings/search` |
| Market select | `Select` fed by `editorial_config.markets` |
| Neighborhood combobox | `Command` combobox fed by `/api/neighborhoods/search?market=<slug>` |
| Subject echo | `<ContextEchoCard>` (reused from APR-004) |
| Price currency select | `Select` |
| Price amount input | `Input type="number"` with `<Numeric>` display |
| Price unit select | `Select` |
| Range toggle | `Switch` primitive |
| Range slider | `Slider` (dual-thumb) |
| Cited-comparables picker | `Command` multi-select combobox |
| Cited-comparable chip | Custom chip built from `Badge variant="outline"` + `<Numeric>` + `<ChannelMark>` + close button |
| Analysis textarea | `Textarea` with autosize + preview toggle (custom `<Tabs>`) + `<CharacterCounter>` |
| Analysis preview | Custom `<div>` rendering Markdown-subset via `react-markdown` with explicit allowlist (paragraph, bold, italic, link, ul, li, br) |
| Evidence uploader | `<EvidenceUploader>` (reused from APR-004, `max_files=5`) |
| Publication scope | `RadioGroup` + `RadioGroupItem` styled as cards |
| Confidence segmented control | `RadioGroup` styled as segmented control |
| Urgency segmented control | `RadioGroup` styled as segmented control |
| Urgency justification | `Input` (revealed via `Collapsible`) |
| Sticky footer | Custom `<div position: sticky; bottom: 0>` |
| Save-as-draft button | `Button variant="ghost"` |
| Submit button | `Button variant="default" size="lg"` |
| Success state | `<StatusHero state="pending">` (reused anchor from REC-004) |
| Edit-mode PA feedback callout | `Alert` variant="warning" with Markdown-subset renderer |
| Upsell card | `Card` with hero glyph + heading + body + bulleted list + CTAs |
| Toasts | `Sonner` |
| Loading | `Skeleton` shape mirroring hero + stepper + section cards (during initial feature-check fetch) |
| Numerics (price, area, count) | `<Numeric>` |
| Channel marks | `<ChannelMark>` |
| Icons | `lucide-react` — Sparkles, Crown, Globe2, Building2, Lock, MapPin, Check, X, Plus, Loader2, AlertCircle, Edit3 |

---

## Interactions

**On page load:**
- Fetch `GET /api/users/me/features`. During fetch, page renders `<Skeleton>` for the entire body.
- If `valuation.price_reports.submit` is NOT enabled → render upsell state; do NOT fetch anything else.
- If enabled → render form. If `?draft_id=<id>` present, fetch `GET /api/reports/prices/:draftId` and hydrate. If `?listing_id` or `?market&neighborhood` present, pre-select the subject.

**On subject-type select:**
- Picker reveals via `<Collapsible>` height transition `var(--lc-duration-base)`.
- Switching subject-type collapses the old picker + clears any selected subject.

**On subject select:**
- Picker collapses; `<ContextEchoCard>` renders with the selected property or area's data.
- Section 1 stepper dot flips to `complete`; Section 2 becomes `current`.

**On price amount input:**
- Live-format thousands separator (respecting locale — `,` for EN, Arabic-Indic digit-group separator for AR).
- Blur validates: must be >0 for total unit, >0 for per-sqft/per-sqm units.
- If range enabled: amount must fall between low and high; if not, inline warning "Amount must be within the range you set."

**On range toggle:**
- Reveals dual-thumb slider. Default range = amount ± 10% (clamped to sensible bounds). Agent can drag either thumb.

**On cited-comparable add:**
- Combobox opens with server-fed suggestions (nearby comparables ranked by relevance).
- Selecting adds a chip below; combobox closes (agent must re-open to add another).
- Chip shows address + price + area + source. Truncate address at 30 chars desktop / 20 chars mobile.
- Cap at 10 chips. Adding an 11th shows toast "You've cited 10 comparables — the max for one report."

**On analysis textarea input:**
- Autosize as agent types up to 20 rows.
- Character counter updates every keystroke. Flips color at 90% and 100%. Past 100%, submit disables + toast on submit tap.
- Autosave debounces to fire 30s after last keystroke (or 60s max even if typing continuously). Autosave PATCH to `/api/reports/prices/:draft_id` (creates draft on first autosave if no `draft_id` yet, returns id which the page then holds).

**On preview toggle:**
- Cross-fades between edit and preview at `var(--lc-duration-base)`. Preview renders Markdown-subset via `react-markdown` with allowlist (paragraph, bold, italic, link, ul, li, br). Preview `<div>` has `dir="auto"` so Arabic-authored content renders RTL even if UI locale is EN.

**On evidence add / remove:**
- Same behavior as AGT-APR-004 (see that brief's §Interactions).

**On publication scope select:**
- Instant flip. Selecting `Agency-only` is disabled with tooltip if agent is not a member of an agency workspace.

**On urgency select:**
- Selecting `Time-sensitive` reveals justification input via `<Collapsible>`. Justification is required (submit disables until filled) when time-sensitive is selected.

**On Save-as-draft click:**
- Immediate PATCH to `/api/reports/prices/:draft_id` with `status='draft'`. Toast on success "Draft saved." Navigate to `AGT-APR-006` sub-tab `my-price-reports` filtered to `status=draft`.

**On Submit for PA review click:**
- Client-side validation: subject selected, amount > 0, analysis ≥ 100 chars (soft floor with inline helper "Editorial reports need more depth — add at least a paragraph."), publication scope selected, all uploads complete, justification present if time-sensitive.
- If any validation fails: submit disables + fields with issues highlight. No toast (passive disabled).
- On valid: POST `/api/reports/prices/:draft_id/submit` (if draft) OR `POST /api/reports/prices` (if never autosaved). Body per §Backend contract. Submit shows `Loader2` + "Sending to PA…". Form disabled.
- On 201 success: page body swaps to success state; `agent_price_report.received` push template fires; source `AGT-APR-006` list refreshes.
- On 403 `FEATURE_NOT_ENABLED` (defense-in-depth): page swaps to upsell state.
- On 400 validation errors: submit re-enables + field-level errors highlighted inline.
- On 500 / network: destructive toast + submit re-enables.

**On page unload with unsaved changes:**
- `beforeunload` warns "Your draft may not be saved — leave anyway?" Only if there are changes since last autosave.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial fetch loading** | Page loading, feature-check in flight | Skeleton shape for hero + stepper + section cards. |
| **Upsell — non-Pro** | `valuation.price_reports.submit` disabled OR missing | Body replaced with upsell card + See-Pro-plans primary + Learn-more ghost. |
| **Empty — Pro, no draft** | Feature enabled, no `?draft_id`, no pre-fill | Full form rendered, no fields filled. Section stepper: Section 1 current, all others muted. Submit disabled. |
| **Draft resumed** | `?draft_id=<id>` present | Hydrate all fields from draft. Section stepper reflects filled sections. Submit enabled if valid. |
| **Subject picked** | Subject selected | `<ContextEchoCard>` rendered. Section 2 becomes current. |
| **Autosave in flight** | 30s idle after keystroke | Autosave helper "Saving…" with `Loader2` glyph. |
| **Autosave complete** | PATCH success | Autosave helper "Saved." briefly, then muted timestamp "Saved 45s ago". |
| **Autosave failed** | PATCH error | Autosave helper "Autosave failed. Check your connection." in `--lc-status-warning-fg`. |
| **Range enabled** | Toggle on | Slider reveals. Amount snaps within range. |
| **Range disabled** | Toggle off | Slider hides; low/high fields discarded. |
| **Analysis too short** | Analysis < 100 chars | Submit disabled + inline helper "Editorial reports need more depth — add at least a paragraph." |
| **Analysis too long** | Analysis > 3000 chars | Counter flips red; submit disabled. |
| **Analysis preview** | Preview tab active | Textarea replaced with rendered Markdown-subset `<div>`. |
| **Evidence uploading** | Any file uploading | Submit disabled + helper "Waiting for uploads to finish…" |
| **Time-sensitive selected** | Urgency = time-sensitive | Justification input reveals. Submit disabled until justification present. |
| **Submitting** | POST in flight | Submit shows `Loader2` + "Sending to PA…". Form disabled. |
| **Success** | POST 201 | Body swaps to success state. |
| **Feature disabled at submit** | POST 403 | Body swaps to upsell state (defense in depth). |
| **Validation errors** | POST 400 | Submit re-enables + inline field errors. |
| **Network error** | POST failed | Destructive toast + submit re-enables. |
| **Edit mode — needs revision** | `/:reportId/edit` with prior status `needs_revision` | PA feedback callout at top; form pre-filled; submit copy "Resubmit for PA review". |
| **Edit mode — approved with edits** | `/:reportId/edit` after PA suggested edits | PA feedback callout at top (edits shown as unified diff link "Compare against PA's suggested version"); form pre-filled; submit copy "Resubmit with my changes". |
| **Offline** | Network unreachable | Top-of-page thin banner "You're offline — autosave is paused." Submit disabled. Draft-save disabled. |
| **RTL** | Locale = ar | Full mirror per §Layout. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap automatically; Pro-tier accent-bold badge + orange upsell CTA still legible. |

---

## Accessibility

- Page hero renders as `<header>`. Pro-tier badge `aria-label="Pro-tier feature"`.
- Section stepper is `<ol>`; each step is `<li>` with `aria-current="step"` on the current section, `aria-label="Section {n}, {title}, {complete/current/upcoming}"`.
- Every section is `<section aria-labelledby="section-{n}-heading">` with its heading as the accessible name.
- Every form control has a visible `<label>`. Placeholders never replace labels.
- Subject-type / publication-scope / confidence / urgency are `RadioGroup` primitives with keyboard nav (arrow keys move between options, Enter/Space selects).
- Property / comparable / neighborhood pickers use `Command` combobox — full keyboard support (arrows to navigate, Enter to select, Escape to close, typing filters).
- Cited-comparable chips are `<button>` with `aria-label="Remove {address}"` for the close X.
- Analysis textarea's `aria-describedby` points to the counter helper + preview toggle state. Character counter announces at 90% and 100% thresholds via `aria-live="polite"` on a dedicated region.
- Preview toggle is a `<Tabs>` primitive with `role="tablist"`.
- Evidence uploader accessibility per shared primitive spec.
- Sticky footer buttons — Submit's `aria-describedby` points to the current disabled-reason ("Submit disabled: pick a subject first" / "Submit disabled: analysis is too short" / "Submit disabled: waiting for uploads" / etc.).
- Success state's `<StatusHero>` becomes the new focused region; announcement "Report received — under PA editorial review" reads once.
- Upsell state — hero glyph has `aria-hidden`; heading is the accessible name of the state. CTAs are `<button>` / `<a role="button">`.
- Motion respects `prefers-reduced-motion` → skip section stepper animations, collapsible reveals, preview cross-fade, success cross-fade.
- All tap targets ≥ 44×44 CSS pixels including chip close buttons and preview tabs.
- Focus rings visible on every interactive element (two-tone Broadcast focus ring, do not override).
- Autosave failures announced via `aria-live="polite"` — screen-reader-friendly.
- No color-only signalling — every state uses glyph + label + surface tint together.

---

## Anti-patterns (do not do these)

- ❌ Do not put this in a modal. Composition surface — full page. A modal signals "quick thing"; a price report is not a quick thing.
- ❌ Do not gate the form by rendering it and then 403-ing on submit. Check the feature flag on route entry; render the upsell state if disabled. Never show a full form the agent can't submit.
- ❌ Do not use "Restricted" or "Locked" verbs in the upsell. Lead with the value ("Establish yourself as a market voice"), not the friction.
- ❌ Do not require evidence attachments. Some analyses are pure reasoning from cited comparables — that's valid.
- ❌ Do not put publication scope in an "Advanced" collapsed section. It's the most consequential choice the agent makes on this form; it's first-class in Section 4.
- ❌ Do not autosave secrets or draft to `localStorage`. Every autosave is server-side to `agent_price_reports` with `status='draft'`. Local drafts leak between browsers and get lost.
- ❌ Do not use `variant="destructive"` red on any button. Submit is not destruction; save-as-draft is not destruction.
- ❌ Do not fabricate PA's SLA. "Typical editorial review: 48 hours" reads from a real backend-configured `editorial_config.default_sla_hours` field.
- ❌ Do not enable submit while any evidence upload is in progress.
- ❌ Do not silently strip fields on backend validation failure. Return field-level errors; render inline.
- ❌ Do not auto-redirect after submit. Success state renders IN PLACE; agent taps View-my-reports or Start-another-report.
- ❌ Do not render the analysis preview with `dangerouslySetInnerHTML` without sanitization. Use `react-markdown` with an explicit allowlist. Never trust agent input.
- ❌ Do not seed the WF-06 feature flag onto non-Pro package versions "for testing" — the gate must hold. Test via a dedicated fixture tenant.
- ❌ Do not conflate "Pro tier" with "Pro-Verified" or "Editorial-Verified" — those are additional PA-conferred distinctions surfaced on `AGT-REC-003` (per PA-PVA-009 brief), not gates for THIS screen. Anyone with the `valuation.price_reports.submit` feature flag can submit; PA can then confer higher labels on approval.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **Medium's story-editor** — clean composition surface with a live preview toggle is the closest analog for our Rationale section.
- **Substack post editor** — publication-scope UX (free / paid / private) is directly analogous to our Public / Agency-only / Private choice.
- **Notion Doc "Publish to web" flow** — the scope-with-helper-copy pattern for each publication option is closest to what we want.
- **LinkedIn "Share an article" flow** — the section-card composition surface + author's identity strip.
- **Ghost editor** — the section-stepper-plus-scrolling-page pattern (visual progress, no wizard).
- **Stripe pricing-page A/B upsell** — the tone of "unlock value" (not "you can't use this") is closest to our upsell state.

Do NOT match:

- Contentful's editor (too utilitarian; no composition dignity).
- Salesforce's report-builder (too enterprise-heavy; overwhelming form).
- Twitter/X's Article composer (too consumer-toy; wrong register for professional analysis).

---

## Backend contract

**Endpoint (create):** `POST /api/reports/prices`

**Endpoint (draft autosave / edit):** `PATCH /api/reports/prices/:id`

**Endpoint (submit draft):** `POST /api/reports/prices/:id/submit`

All three routes hit the same table with different write patterns.

**Request body (submit):**
```json
{
  "subject": {
    "type": "property" | "area",
    "property_listing_id": "lst_01H8XZ..." | null,
    "area": { "market_slug": "dubai", "neighborhood_slug": "dubai-marina" } | null
  },
  "recommendation": {
    "currency": "AED",
    "amount_minor": 165000,
    "unit": "per_sqft" | "per_sqm" | "total",
    "range": { "low_minor": 150000, "high_minor": 180000 } | null
  },
  "rationale": {
    "cited_comparable_ids": ["cmp_01H8...", "cmp_01H8..."],
    "analysis_markdown": "Q3 2026 has seen Dubai Marina's sqft-price band contract meaningfully..."
  },
  "publication": {
    "scope": "public" | "agency_only" | "private",
    "evidence_file_ids": ["evd_01H8...", "evd_01H8..."],
    "confidence": "analytical" | "data_supported" | "verified",
    "urgency": "standard" | "time_sensitive",
    "urgency_justification": "Developer announced a new tower launch this morning." | null
  },
  "client_context": {
    "source_screen": "AGT-APR-005",
    "locale": "en" | "ar"
  }
}
```

**Response 201:**
```json
{
  "report": {
    "id": "rpt_01H8ZB...",
    "status": "pending",
    "submitted_at": "2026-09-08T14:22:00Z",
    "expected_sla_hours": 48,
    "expires_at": "2026-10-08T14:22:00Z",
    "publication": { "scope": "public" }
  },
  "outcome_url": "/agent/pricing/reports/rpt_01H8ZB.../outcome"
}
```

**Response 403 `FEATURE_NOT_ENABLED`:**
```json
{
  "error": "FEATURE_NOT_ENABLED",
  "message": "This feature requires a Pro-tier subscription.",
  "feature": "valuation.price_reports.submit",
  "upsell_route": "/plans?highlight=wf06"
}
```

**Response 400 field validation:**
```json
{
  "error": "VALIDATION_FAILED",
  "field_errors": {
    "subject.type": "required",
    "recommendation.amount_minor": "must_be_positive",
    "rationale.analysis_markdown": "too_short",
    "publication.urgency_justification": "required_when_time_sensitive"
  }
}
```

**Migration (new):**
```sql
CREATE TABLE public.agent_price_reports (
  id                              TEXT PRIMARY KEY,
  author_user_id                  TEXT NOT NULL REFERENCES public.users(id),
  author_tenant_id                TEXT NOT NULL REFERENCES public.tenants(id),
  subject_type                    TEXT NOT NULL CHECK (subject_type IN ('property', 'area')),
  subject_listing_id              TEXT REFERENCES public.listings(id),
  subject_market_slug             TEXT,
  subject_neighborhood_slug       TEXT,
  currency                        TEXT NOT NULL,
  recommendation_amount_minor     BIGINT NOT NULL CHECK (recommendation_amount_minor > 0),
  recommendation_unit             TEXT NOT NULL CHECK (recommendation_unit IN ('per_sqft', 'per_sqm', 'total')),
  range_low_minor                 BIGINT,
  range_high_minor                BIGINT,
  cited_comparable_ids            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  analysis_markdown               TEXT NOT NULL,
  evidence_file_ids               TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  publication_scope               TEXT NOT NULL CHECK (publication_scope IN ('public', 'agency_only', 'private')),
  confidence                      TEXT NOT NULL CHECK (confidence IN ('analytical', 'data_supported', 'verified')),
  urgency                         TEXT NOT NULL DEFAULT 'standard' CHECK (urgency IN ('standard', 'time_sensitive')),
  urgency_justification           TEXT,
  status                          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved_for_publication','approved_with_edits','approved_agency_only','approved_private','published','needs_revision','rejected','withdrawn')),
  resolver_user_id                TEXT REFERENCES public.users(id),
  resolver_message                TEXT,
  decision_code                   TEXT,
  pa_edits_diff                   TEXT,
  featured_on_profile             BOOLEAN NOT NULL DEFAULT false,
  published_url_slug              TEXT,
  published_at                    TIMESTAMPTZ,
  revision_of                     TEXT REFERENCES public.agent_price_reports(id),
  submitted_at                    TIMESTAMPTZ,
  viewed_at                       TIMESTAMPTZ,
  decided_at                      TIMESTAMPTZ,
  resolved_at                     TIMESTAMPTZ,
  expires_at                      TIMESTAMPTZ,
  source_screen                   TEXT,
  locale                          TEXT NOT NULL DEFAULT 'en',
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_apr_author_status ON public.agent_price_reports (author_user_id, status);
CREATE INDEX idx_apr_status_submitted ON public.agent_price_reports (status, submitted_at DESC) WHERE status = 'pending';
CREATE INDEX idx_apr_published ON public.agent_price_reports (published_at DESC) WHERE status = 'published';
CREATE INDEX idx_apr_author_drafts ON public.agent_price_reports (author_user_id, updated_at DESC) WHERE status = 'draft';
```

**Feature-flag seed (new):**
```sql
-- 316_packages_wf06_feature.sql
INSERT INTO public.package_feature_flags (id, package_version_id, feature_code, enabled, data)
SELECT
  gen_random_uuid()::text,
  pv.id,
  'valuation.price_reports.submit',
  true,
  '{"tier":"pro","seed":"wf06"}'::jsonb
FROM public.product_package_versions pv
JOIN public.product_packages p ON pv.package_id = p.id
WHERE p.tier IN ('pro', 'pro_verified', 'growth')  -- confirm exact tier list against product-packages seed at seed-time
  AND pv.state = 'DRAFT'  -- flags must be inserted while version is DRAFT per 302's child-immutability trigger
ON CONFLICT (package_version_id, feature_code) DO NOTHING;
```

**Backend prerequisites surfaced (NOT already tracked):**
- `agent_price_reports` table + create/patch/submit handlers + Pro-tier gate. File as `[BE-BLOCKER-06e] WF-06 price-report submission + feature seed` — Week 5 dependency.
- Feature-flag seed migration (`316_packages_wf06_feature.sql`) — part of the same blocker.
- `editorial_config` table (markets, currencies, default_sla_hours, per-market strictness) — File as `[BE-DESIGN-06f] editorial config table` — needed for market/currency dropdowns, SLA rendering. Week 5.
- Neighborhood search endpoint `GET /api/neighborhoods/search?market=<slug>&q=<term>` — if not already present. File as `[BE-DESIGN-06g] neighborhood search` — Week 5.
- Shared `<EvidenceUploader>` service — inherits from `[BE-BLOCKER-05b]` filed in AGT-APR-004.
- Push template `agent_price_report.received` (agent's own submission confirmation, single variant, deep-links to `/agent/pricing/reports/:id/outcome`). Week 5.

---

## Notification hook

**Trigger:** report row transitions from `status='draft'` (or absent) to `status='pending'` via `POST /api/reports/prices/:id/submit` or `POST /api/reports/prices`.

**Piggybacks on existing push infrastructure** — same as REC-004's `agency_application.resolved` template. No new dispatcher.

**Template:** `agent_price_report.received`
- Title: "Report received"
- Body: "PA will review your price report on {subjectTitle}. Typical editorial review: 48 hours."
- Deep-link: `wingcaster://price-report/:id` → `/agent/pricing/reports/:id/outcome` (renders `AGT-REC-003`)
- Emit at status transition (same transaction).

A second template `agent_price_report.resolved` fires when PA decides — that's owned by `AGT-REC-003`'s brief, not this one.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to refactor:** `web/src/pages/AgentPricingPage.tsx` — extract legacy pricing surface into `web/src/pages/AgentPricingLegacyPage.tsx` (keep for migration window) and create new `web/src/pages/SubmitPriceReportPage.tsx` at `/reports/prices/new`.
- **Route:** add to `web/src/App.tsx`:
  - `<Route path="/reports/prices/new" element={<SubmitPriceReportPage />} />`
  - `<Route path="/reports/prices/:reportId/edit" element={<SubmitPriceReportPage />} />`
- **Component decomposition:**
  - `web/src/components/reports/SubmitPriceReportPage/index.tsx` — page shell with hero + stepper + section stack + sticky footer.
  - `web/src/components/reports/SubmitPriceReportPage/SectionSubject.tsx`
  - `web/src/components/reports/SubmitPriceReportPage/SectionRecommendation.tsx`
  - `web/src/components/reports/SubmitPriceReportPage/SectionRationale.tsx` (with the Analysis textarea + preview toggle sub-component)
  - `web/src/components/reports/SubmitPriceReportPage/SectionPublication.tsx`
  - `web/src/components/reports/SubmitPriceReportPage/UpsellCard.tsx`
- **Reused primitives (from AGT-APR-004):**
  - `web/src/components/forms/EvidenceUploader.tsx`
  - `web/src/components/forms/ContextEchoCard.tsx`
- **Data hooks:**
  - `web/src/hooks/useFeatureFlags.ts` — returns the caller's feature-flag set (fetch on session context; cache).
  - `web/src/hooks/useSubmitPriceReport.ts` — mutation for create + patch + submit.
  - `web/src/hooks/useDraftAutosave.ts` — 30s debounced autosave hook.
- **Test discipline:**
  - Unit: each section component renders with / without pre-filled data, respects validation rules.
  - Unit: `UpsellCard` renders with correct CTAs + routes.
  - Integration: full submission flow (new draft → autosave → subject → recommendation → rationale → publication → submit → success state).
  - Integration: upsell flow (non-Pro tier hits route, sees upsell, taps See-Pro-plans, routes to `/plans?highlight=wf06`).
  - Integration: draft resume via `?draft_id=`.
  - Integration: edit mode with `needs_revision` PA feedback callout.
  - Integration: time-sensitive urgency + justification required.
  - Real-Postgres: end-to-end (Pro agent submits → row lands in `agent_price_reports` → PA queue at `PA-PVA-009` shows it → PA decides → agent sees at `AGT-REC-003`).
  - Real-Postgres: non-Pro agent tries to submit → server 403 defense-in-depth check.
  - RTL: verified via `screens.rtl.test.tsx` extension.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **Feature-flag seed:** integration test asserts `316_packages_wf06_feature.sql` idempotently seeds flag onto Pro-tier versions only.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Page hero band `--lc-surface-sunken` + `Sparkles` glyph tinted `--lc-accent-bold-edge` + Pro-tier `<Badge>` with `--lc-accent-bold-{bg,fg}` + `--lc-accent-bold-edge` border.
- Section cards `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)`.
- Section stepper dots: complete `var(--lc-accent-bold)` filled + `var(--lc-accent-bold-edge)` outline; current open ring `var(--lc-accent-bold-edge)` stroke; upcoming `var(--lc-border-strong)` open ring.
- Segmented controls selected `var(--lc-action-primary)` + `--lc-action-primary-text`. Unselected `--lc-surface-sunken` + `var(--lc-text-primary)`.
- Publication-scope selected card `var(--lc-action-primary)` 2px border + `--lc-surface-selected` background.
- Slider track `--lc-border-strong`; fill inside range `--lc-action-primary`; thumbs `--lc-surface-raised` + 2px `--lc-action-primary` border.
- Cited-comparable chip `<Badge variant="outline">` with `--lc-border`; close X `--lc-text-muted`.
- Textarea + inputs `--lc-border-strong` + `--lc-surface-raised`.
- Preview `<div>` uses `--lc-type-body-lg`; bold/italic use standard weights; links `--lc-text-brand`.
- Evidence uploader per shared spec (reused from APR-004).
- Save-as-draft `variant="ghost"` — `var(--lc-text-muted)` label.
- Submit button `var(--lc-action-primary)` fill; hover DARKER to `var(--lc-action-primary-hover)`.
- Success state `<StatusHero>` reuses REC-004 anchor with `state="pending"` calm surface.
- Upsell state hero glyph `Crown` tinted `--lc-action-primary`; primary CTA `--lc-action-primary` fill; secondary CTA `variant="ghost"`.
- PA feedback callout `--lc-status-warning-bg` + `--lc-status-warning-fg` glyph — the ONE calm-warning surface on this screen (not urgent, not destructive).
- Numeric fields (price, area, char counter, autosave timestamp) via `<Numeric>`.
- Source badges on cited-comparable chips via `<ChannelMark>` — 20-28px, matched `-on` ink pair.
- Focus rings two-tone via base CSS. Do not override.
- Motion: section reveal `var(--lc-duration-base)`; chip add/remove `var(--lc-duration-fast)`; preview toggle `var(--lc-duration-base)` cross-fade. Respect `prefers-reduced-motion`.
- Radii: cards `var(--lc-radius-lg)`; inputs `var(--lc-radius-md)`; buttons `var(--lc-radius-md)`; publication-scope selected card same as unselected `var(--lc-radius-lg)`; Pro-tier badge `var(--lc-radius-pill)`.
- No `variant="destructive"` on any button. Editorial submission is not destruction.
- No 12+px rounding anywhere. Broadcast is intentionally tight.
- No soft/blurred shadows. Elevation is offset per Broadcast reference.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster "Submit price report" screen (AGT-APR-005) — MENA real-estate B2B SaaS. This is the full-page (NOT modal) composition surface where a Pro-tier agent authors a signed market-pricing analysis for editorial review by WingCaster's PA team, ultimately published to the agent's public profile. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen REUSES two shared primitives introduced by the sibling brief AGT-APR-004 (submit bad-comparable report): <EvidenceUploader> and <ContextEchoCard>. Consider them already implemented — reference them by name; don't re-implement.

The screen is tier-gated via the `valuation.price_reports.submit` feature flag (existing packages/features registry in the codebase). Non-Pro agents landing here see an upsell state, not the form. The form itself is a single-page scroll with a visual section stepper (Subject / Recommendation / Rationale / Publication) — NOT a wizard.

First pass: render the DESKTOP 1440px layout for Pro-tier agent with all 4 sections filled and ready to submit. Page hero with Sparkles glyph + "Submit a price report" heading + subheading + Pro badge on the right. Visual section stepper below with sections 1-3 complete + section 4 current. Section 1 (Subject) showing "Area or market segment" chosen with Dubai / Dubai Marina picker + ContextEchoCard echoing "Dubai Marina · Dubai, UAE · 3,124 active listings · avg AED 1,850/sqft · Q3 2026". Section 2 (Recommendation) with AED 1,650 per sqft + range enabled showing slider 1,500-1,800. Section 3 (Rationale) with 4 cited-comparable chips + a 3-paragraph analysis textarea filled with a 400-word Dubai Marina Q3 outlook. Section 4 (Publication) with 2 evidence files uploaded + Publication scope "Public — on my profile" selected + Confidence "Data-supported" + Urgency "Standard". Sticky footer with Save-as-draft (ghost) + autosave helper "Saved." + Submit for PA review (primary orange enabled).

LTR English only for this pass — I'll ask for empty/mobile/RTL/dark/edit-mode/upsell/success/preview as separate follow-ups.

Follow the copy table in the brief exactly. Use only Broadcast semantic tokens — no raw hex.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:

1. `Same desktop viewport, freshly opened by a Pro agent, no subject picked. Section stepper: Section 1 current, all others muted. All downstream fields rendered but inputs disabled. Submit disabled.`
2. `Same desktop viewport, subject-type = Specific property, property picker with "Villa 8, Emirates Hills Sector L" selected in the ContextEchoCard (AED 32M · 8 BR · 12,000 sqft), rest of the form empty.`
3. `Same desktop viewport, submit in-flight. Primary button shows Loader2 + "Sending to PA…", entire form disabled.`
4. `Same desktop viewport, success state. Body swaps to pending StatusHero "Report received — under PA editorial review" + SLA line "Typical editorial review: 48 hours" + scope echo "Scope: Public — on your profile" + View-my-reports primary + Start-another-report outline.`
5. `Same desktop viewport, edit mode /reports/prices/:id/edit for a report that PA sent back for revisions. PA feedback callout at top of the page below the hero: "Add a chart or table · Add a sources section · Correct the Cayan Tower area figure — see notes below." Form pre-filled. Submit button copy "Resubmit for PA review".`
6. `Same desktop viewport, UPSELL STATE (agent is not Pro tier). Full page body replaced with the upsell card. Hero glyph Crown tinted orange. Heading "Price reports are a Pro feature". Body + three-bullet list of what Pro unlocks. See-Pro-plans primary + Learn-more ghost.`
7. `Mobile 375px, same section-4-in-progress state as pass 1. Vertical section stepper. Price group stacked. Chip list wrapped. Sticky footer with Submit full-width + Save-as-draft above as text link.`
8. `RTL Arabic mirror at desktop 1440px, same in-progress state as pass 1. Use [TRANSLATION-PENDING] where AR is missing.`
9. `Dark mode desktop, same in-progress state as pass 1. Verify Pro badge accent-bold + orange upsell CTA still legible.`
10. `Analysis textarea in Preview mode zoomed on Section 3 — showing the rendered Markdown-subset paragraphs + one bold phrase + one link.`

Save each output's JSX to `web/src/components/reports/SubmitPriceReportPage/` + screenshot to `docs/design/mockups/AGT-APR-005-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 10 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-5 dispatch prompt references this brief + the mockup paths + the two reused shared primitives (`<EvidenceUploader>`, `<ContextEchoCard>` from AGT-APR-004).
- [ ] `[BE-BLOCKER-06e]` (agent_price_reports table + write handlers + tier gate + feature-flag seed migration) filed in kickoff §5a.
- [ ] `[BE-DESIGN-06f]` (editorial_config table) filed in kickoff §5a.
- [ ] `[BE-DESIGN-06g]` (neighborhood search endpoint) filed in kickoff §5a.
- [ ] Push template `agent_price_report.received` filed as a Week-5 backend task.
- [ ] AGT-REC-003 brief (already written) verified as receiving the outcome from this flow.
- [ ] AGT-APR-006 brief (my-submitted-reports list — sibling) authored in a follow-up session; must include a draft-resumption entry-point that deep-links to `/reports/prices/new?draft_id=<id>` OR `/reports/prices/:reportId/edit`.
- [ ] Legacy `web/src/pages/AgentPricingPage.tsx` behavior preserved during migration window (route rename to `/agent/pricing-legacy` OR content re-scoped) — flag as a Cursor migration note.
