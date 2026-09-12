# Screen Matrix — Implementation Workstream Kickoff

**Author:** Architect-owner
**Created:** 2026-09-05
**Last revised:** 2026-09-12 (Rev 9.3 — Backend Week 8+ BE-BLOCKER-36 marked RESOLVED in §5a with merge SHA `de84b7f536f071c725dc07b8e93bd9e9b5e05d18` / PR #134. Companion catalog: [BACKEND_BLOCKER_INDEX.md](BACKEND_BLOCKER_INDEX.md).)

**Rev 8 — 2026-09-06.** User resolved every remaining open decision. D-S-03/04/05/06/07/09 all APPROVED. AGT-ACT-001..005 added (slate 53 → 58). Branding-cleanup PR bundled into Wave 0. Blue Door removed. Agent-matrix backend-prereq retrofit scheduled.

**Rev 7 — 2026-09-06.** D-S-01 + D-S-10 APPROVED. Doc status DRAFT → APPROVED. 53-screen Rev-6 slate locked; Week 0..8+ cluster dispatch locked. D-S-02 SUPERSEDED by D-S-10.

**Rev 6 — 2026-09-06.** Absorbed fifth audit (feedback log governance) + user directive for dynamic portal catalog. Added [BE-BLOCKER-03/04], [BE-DESIGN-01] dynamic `portal_registry`, locked portal list per D19 PF-Group critical path. Restructured Week 2 with 4 backend prereqs. Added PA-POR-001..003 to Week 6.

**Rev 5 — 2026-09-06.** Absorbed fourth independent audit: full four-persona cross-matrix. Identified fifth deadlock cycle (WF-04). Restructured §6 from persona-domain waves to workflow-cluster Week 0..8+ dispatch per PA matrix D5 model.
**Status:** **APPROVED 2026-09-06** — user locked D-S-01 (53-screen Rev-6 slate) + D-S-10 (Week 0..8+ workflow-cluster dispatch). Wave 0 brief authoring begins next.

Companion documents:
- [SCREEN_MATRIX_SHARED.md](SCREEN_MATRIX_SHARED.md) — 46 shared screens
- [SCREEN_MATRIX_AGENT.md](SCREEN_MATRIX_AGENT.md) — 93 agent screens
- [SCREEN_MATRIX_AGENCY.md](SCREEN_MATRIX_AGENCY.md) — 67 agency screens
- [SCREEN_MATRIX_PA.md](SCREEN_MATRIX_PA.md) — 114 PA screens
- [SCREEN_MATRIX_FEEDBACK.md](SCREEN_MATRIX_FEEDBACK.md) — running feedback log
- Anchor briefs at [docs/design/briefs/](briefs/) — 4 done (SHR-AUT-001 login, SHR-SET-005 delete-account, AGT-DSH-001 dashboard, AGT-LST-003 listing detail)
- [BROADCAST_ALIGNMENT_REFERENCE.md](briefs/BROADCAST_ALIGNMENT_REFERENCE.md) — governs every brief

---

## 1. What this workstream is

**Take the 320 screens catalogued across the 4 Screen Matrices and actually build them.** The product-side frontend today is Broadcast-themed and structurally sound, but only a handful of screens are production-ready. The rest exist as depth-(b) catalog entries in the four matrices with no React implementation.

**IS:**
- Per-screen Cursor implementation prompts that produce React screens on the existing `web/` app.
- Per-screen v0 (or equivalent) Design AI iterations for visual density on the highest-priority anchors.
- Per-screen architect-owner review before merge — same discipline as every backend PR this cycle.
- Extending the four anchor Screen Briefs pattern into a per-domain set (probably ~30 more briefs across the 4 matrices).

**IS NOT:**
- A single massive "build all 320 screens" PR. Every screen is its own PR, batched into per-domain groups.
- Backend work. This workstream consumes the existing backend surface; it doesn't add endpoints.
- Marketing website (`wingcaster-www`) — separate workstream, already in flight in another chat.
- Design system changes to Broadcast — tokens are locked from PR #41.

---

## 2. Scope inventory

By matrix, screens catalogued today:

| Matrix | Screens | Anchor briefs | % complete |
|---|---|---|---|
| Shared (auth, MFA, nav, error, legal, public, settings) | 46 | 2 (SHR-AUT-001, SHR-SET-005) | ~4% |
| Agent (mobile-first, Guided + Pro dual mode) | 93 | 2 (AGT-DSH-001, AGT-LST-003) | ~2% |
| Agency (desktop-first, multi-agent, 4 canonical roles) | 67 | 0 | 0% |
| PA (desktop-only, platform admin) | 114 | 0 | 0% |
| **Total** | **320** | **4** | **~1%** |

The 4 anchor briefs are the pattern proof. Every subsequent brief follows their format (Meta → Purpose → Design goals → Layout → Explicit copy → Component palette → Sample content → Interactions → State variants → Accessibility → Anti-patterns → Reference designs → Downstream implementation → Broadcast alignment callouts).

---

## 3. Delivery model (three-phase per-screen pipeline)

Same "Design AI first, then Cursor" model established for the marketing website. Applied per screen:

### Phase A — Brief (human authored)

- Author a depth-(b) brief for each screen following the anchor pattern. Lives under `docs/design/briefs/<ID>-<slug>-brief.md`.
- Anchor screens (the highest-value one per domain) get the fullest treatment; supporting screens can reference the anchor's Broadcast alignment section and only spell out per-screen deltas.
- **Who writes:** me (architect-owner). Estimated cadence: 3-5 briefs per session depending on complexity.

### Phase B — Design AI (v0 or Framer AI)

- For anchor screens: feed the brief into v0 / Framer AI to generate visual mockups.
- Iterate 2-3 rounds until the mockup lands the "loud + fast" Broadcast character.
- Supporting screens (variants, list/detail pairs, empty/error states of an anchor): skip Design AI if the anchor's visual language is enough.
- **Who runs:** user, from a paste-able brief I generate per anchor.

### Phase C — Cursor implementation

- Per-screen Cursor prompt: `CURSOR_SCREEN_<ID>.md` under `docs/prompts/`.
- Prompt references the brief + the Design AI output + the existing product components.
- Cursor opens a PR against the product repo.
- Architect-owner review → merge.

**Pipeline latency estimate per anchor screen:** 2-3 days brief → 1 day v0 iteration (user) → 3-5 days Cursor + review. Per supporting screen: 1-2 days total (skip Phase B).

---

## 4. Prioritization framework

Not all 320 screens are equal. Pick the next slate by:

1. **User-visible frequency** — how often will a real agent/PA/agency-admin see this screen per day? (AGT-DSH-001 dashboard = every session; PA-CFG-999 obscure config = maybe monthly.)
2. **Unblocks a real user flow** — is anyone stuck without it? (AGT-ONB-* blocks agent signup; AGT-LST-004 blocks first-listing.)
3. **Depends on backend that's already merged** — no point implementing a screen whose API doesn't exist. Cross-reference with what's on main.
4. **Multiplier effect** — building the anchor of a domain unlocks the visual language for that whole domain (12-20 supporting screens).

---

## 5. Phase-1 slate — 58 screens, ~13-17 weeks

**Rev 8 — 2026-09-06.** User added AGT-ACT-001..005 activation-wizard family (Phase-1 add-on decision per session close). Timeline pushes +1 week for the activation-wizard bundled PR in Wave 4.


**Rev 5 — 2026-09-06.** Fourth independent audit (full four-persona: Shared × Agent × Agency × PA) surfaced a fifth deadlock cycle + verified every Agent→PA blocker + one critical backend blocker:
- **WF-04 (Account recovery) — DEADLOCK.** SHR-AUT-005d + PA-ACR-001/002 all MISSING. Support ops non-functional. Pulled all three into Phase 1.
- **WF-03 (Portal moderation) — full four-screen deadlock + backend blocker.** AGT-PUB-006 (Rev-3) + PA-MOD-001/002 pulled. **Additional non-UI action:** `lib/notifications/realestate.js` throws NOT_IMPLEMENTED — portal publishers are stubs. WF-03 needs backend implementation alongside the UI. Flagged as [BE-BLOCKER-01] in §5a.
- **WF-05 + WF-06 (Valuation review) — deadlock resolved by pulling both sides.** PA-PVA-008/008b/009/009b + AGT-REC-002/003 all pulled in. Reversed Rev-4 partial deferral.
- **Two-person-rule UI cluster** — PA-APR-003 (action confirmation), PA-APR-005 (escalation), PA-APR-006 (recall) all MISSING. Framework exists (PA-APR-001/002 EXISTS), execute/escalate/recall UI does not. Pulled all three.
- **PA-NAV-001** env switcher (LIVE/TEST) — foundational for every PA financial flow. Pulled to Week 0 alongside SHR-NAV-* triad.

**Strategic risk (from audit §7):** the PA matrix has heavy framework investment (env switcher, coordinated dispatch, two-person rule design) but the executable screens completing user workflows are MISSING. Risk: 8-12 weeks of PA infrastructure without shipping moderation/recovery/valuation. **Mitigation baked into §6:** strict cluster-order dispatch, no framework-only builds without the executable-screen cluster it enables.

**Rev 4 — 2026-09-06.** Third audit (cross-matrix Shared × Agent × Agency) confirmed two deadlock cycles + five undeclared Agency-side blockers:
- **WF-02 (Join agency) — 4-screen cluster ALL MISSING.** Without this cluster, registration paths (b) "Join an agency" and (c) "Register as agency owner" from SHR-AUT-006 are literal dead ends. Pulled: AGN-MEM-005, AGN-MEM-002, AGN-MEM-002b, AGT-REC-004.
- **WF-31 (Ownership transfer) — 3-screen cluster ALL MISSING.** Enterprise governance table stakes. Pulled: AGN-SET-005, AGN-SET-005b, AGT-REC-006.
- **AGN-ROL-001 + AGN-ROL-002** — capability-pack UI. Packs implemented in code, no surface for admins to see what Finance/Marketer/Read-Only/Custom enable. Pulled.
- **AGN-DSH-002** — agency onboarding checklist. Same activation-loss problem as AGT-ONB. Pulled.
- **Reversed Rev-3 deferral of AGT-REC-004/006** — audit correctly argued paired-both-sides is the fix, not deferral.

**Rev 3 — 2026-09-06.** Second audit (Agent matrix): AGT-PUB-003/006 (revenue protection) + AGT-SET-002 (mode toggle) + AGT-CTC-007 (relationships editor).

**Rev 2 — 2026-09-06.** First audit (Shared matrix): tenant switcher + bottom tab bar + language selector; MFA operational flows; Settings shell.

Slate progression: original 12 → Rev-2 22 → Rev-3 26 → **Rev-4 36**. Timeline: 4-6 → 8-10 → 9-11 → **12-15 weeks**. Honest cost of what the audits surfaced.

**Rationale:** unblock the agent signup + first-listing funnel end-to-end; make agency membership actually usable (tenant switcher); ship the MENA launch requirement (language selector); complete MFA so enrollment isn't a false security promise; deliver GDPR delete-account.

| # | Screen ID | Persona | Domain | Why in Phase 1 | Backend ready? |
|---|---|---|---|---|---|
| 1 | **SHR-NAV-001..002** Top bar + side drawer | Shared | Navigation | Every screen depends on it. | ✅ no backend |
| 2 | **SHR-NAV-003** Agent bottom tab bar | Shared | Navigation | **P0 (independent audit).** Mobile-first is aspirational without it. | ✅ no backend |
| 3 | **SHR-NAV-006** Language selector | Shared | Navigation | **P0 (independent audit).** MENA launch blocker. RTL CSS layer exists, no toggle. | ✅ no backend |
| 4 | **SHR-NAV-008** Tenant switcher | Shared | Navigation | **P0 (independent audit).** Migration 028 creates multi-tenant rows; no UI = agency persona dead-end. | ✅ merged (identity.js) |
| 5 | **SHR-AUT-001** Login | Shared | Auth | Brief done. Every user's first interaction. | ✅ merged |
| 6 | **SHR-AUT-002** Signup — 6 identity paths | Shared | Auth | Gates every new user. Free-trial dedup lands here. | ✅ merged (PR #49) |
| 7 | **SHR-MFA-001..003, 007** MFA enrollment + step-up | Shared | Auth | Signup + delete-account + billing ops depend on step-up. | ✅ merged (auth-2fa.js) |
| 8 | **SHR-MFA-004** 2FA challenge at sign-in | Shared | Auth | **P0 (independent audit).** Enrolling 2FA without being able to use it = false security promise. | ✅ backend exists |
| 9 | **SHR-MFA-004b** Backup-code sign-in | Shared | Auth | **P0 (independent audit).** Recovery path. | ✅ backend exists |
| 10 | **SHR-MFA-005** Backup-codes viewer | Shared | Auth | **P0 (independent audit).** User can't retrieve codes without it. | ✅ backend exists |
| 11 | **SHR-MFA-006** Disable 2FA | Shared | Auth | **P0 (independent audit).** Reversal path required by security policy. | ✅ backend exists |
| 12 | **SHR-SET-001** Settings home | Shared | Settings | **P1 (independent audit).** Self-service entry-point. | ✅ no new backend |
| 13 | **SHR-SET-002** Account / profile | Shared | Settings | **P1 (independent audit).** Currently no dedicated page. | ✅ merged |
| 14 | **SHR-SET-003** Billing / notification prefs | Shared | Settings | **P1 (independent audit).** Backend endpoint exists, no UI. | ✅ merged |
| 15 | **SHR-SET-004** Sessions & devices | Shared | Settings | **P1 (independent audit).** Enterprise security expectation. | ✅ merged |
| 16 | **SHR-SET-005..005d** Delete account | Shared | Settings | **P1 (independent audit).** GDPR right-to-erasure. Brief done. | ✅ merged |
| 17 | **AGT-SET-002** Mode toggle (Guided ↔ Pro) | Agent | Settings | **P0 (audit #2).** Without it, D3 dual-mode is invisible. | ✅ no backend |
| 18 | **AGT-DSH-001** Dashboard mobile Guided | Agent | Dashboard | Brief done. Every daily-active agent lands here. | ✅ merged |
| 19 | **AGT-DSH-002** Dashboard mobile Pro | Agent | Dashboard | Toggle variant of DSH-001. Cheap to add. | ✅ same endpoint |
| 20 | **AGT-ONB-001..005** Agent onboarding | Agent | Onboarding | The "aha moment" — first-listing via WhatsApp. | ✅ merged (PR #50) |
| 21 | **AGT-LST-001, 003, 004** Listing list / detail / composer | Agent | Listing mgmt | LST-003 brief done. Highest-frequency screens after dashboard. | ✅ merged |
| 22 | **AGT-WLB-001..005** WhatsApp intake tour | Agent | Listing mgmt | Bridges ONB to running WhatsApp flow. | ✅ merged (PR #50) |
| 23 | **AGT-PUB-003** Publish outcome / receipt | Agent | Publishing | **P0 (audit #2).** Revenue-protection — agents pay credits, must see what happened. | ✅ merged (publishing module) |
| 24 | **AGT-PUB-006** Portal submission tracker | Agent | Publishing | **P0 (audit #2).** Trust surface for portal syndication. | ✅ merged |
| 25 | **AGT-INB-001..002** Unified inbox list + thread | Agent | Communication | The "Catch" — highest-frequency return-visit screen. | ✅ merged (conversation module) |
| 26 | **AGT-CTC-007** Contact relationships editor | Agent | CRM | **P1 (audit #2).** Schema exists (contact_relationships); CRM can't function without mandate/representation tracking. | ✅ merged |
| 27 | **AGN-MEM-005** Public join / apply page | Agency | Membership | **P0 (audit #3).** WF-02 initiator. Without it, registration paths (b) + (c) dead-end. | ✅ merged |
| 28 | **AGN-MEM-002** Applications queue (agency-side) | Agency | Membership | **P0 (audit #3).** WF-02 approver surface. | ✅ merged |
| 29 | **AGN-MEM-002b** Application detail (agency-side) | Agency | Membership | **P0 (audit #3).** WF-02 review + accept/reject. | ✅ merged |
| 30 | **AGT-REC-004** Application outcome (agent-side) | Agent | Recipient | **P0 (audit #3).** WF-02 closes the loop. Reversed from Rev-3 deferral. | ✅ merged |
| 31 | **AGN-SET-005** Ownership transfer initiator | Agency | Settings | **P0 (audit #3).** WF-31 start. | ✅ merged |
| 32 | **AGN-SET-005b** Ownership transfer accept | Agency | Settings | **P0 (audit #3).** WF-31 recipient. | ✅ merged |
| 33 | **AGT-REC-006** Ownership transfer outcome (agent-side) | Agent | Recipient | **P0 (audit #3).** WF-31 closes the loop. Reversed from Rev-3 deferral. | ✅ merged |
| 34 | **AGN-ROL-001** Roles overview | Agency | Roles | **P1 (audit #3).** Capability packs invisible without UI. | ✅ merged |
| 35 | **AGN-ROL-002** Role permissions detail | Agency | Roles | **P1 (audit #3).** Explains what each pack actually enables. | ✅ merged |
| 36 | **AGN-DSH-002** Agency onboarding checklist | Agency | Dashboard | **P0 (audit #3).** Agency activation driver — paid conversion depends on this. | ✅ merged |
| 37 | **PA-NAV-001** Environment switcher (LIVE / TEST) | PA | Navigation | **P0 (audit #4).** Foundational for every PA financial flow. | ✅ no backend |
| 38 | **PA-MOD-001** Portal moderation queue | PA | Moderation | **P0 (audit #4).** WF-03 approver surface. Blocked by [BE-BLOCKER-01]. | ⏳ backend needed |
| 39 | **PA-MOD-002** Portal moderation detail | PA | Moderation | **P0 (audit #4).** WF-03 evaluate + accept/reject. Blocked by [BE-BLOCKER-01]. | ⏳ backend needed |
| 40 | **SHR-AUT-005d** Scheduled account-deletion confirmation | Shared | Auth | **P0 (audit #4).** WF-04 initiator terminator. | ✅ merged |
| 41 | **PA-ACR-001** Account recovery queue | PA | Support | **P0 (audit #4).** WF-04 approver surface. | ✅ backend exists |
| 42 | **PA-ACR-002** Account recovery detail | PA | Support | **P0 (audit #4).** WF-04 evaluate + approve. | ✅ backend exists |
| 43 | **PA-PVA-008** Bad-comparable-report queue | PA | Valuation | **P0 (audit #4).** WF-05 approver surface. | ✅ backend exists |
| 44 | **PA-PVA-008b** Bad-comparable-report detail | PA | Valuation | **P0 (audit #4).** WF-05 evaluate. | ✅ backend exists |
| 45 | **PA-PVA-009** Agent-price-report queue | PA | Valuation | **P0 (audit #4).** WF-06 approver surface. | ✅ backend exists |
| 46 | **PA-PVA-009b** Agent-price-report detail | PA | Valuation | **P0 (audit #4).** WF-06 evaluate. | ✅ backend exists |
| 47 | **AGT-REC-002** Comparable-report outcome (agent-side) | Agent | Recipient | **P0 (audit #4).** WF-05 closes loop. Reversed from Rev-4 deferral. | ✅ backend exists |
| 48 | **AGT-REC-003** Price-report outcome (agent-side) | Agent | Recipient | **P0 (audit #4).** WF-06 closes loop. Reversed from Rev-4 deferral. | ✅ backend exists |
| 49 | **AGT-APR-004** Agent submits bad-comparable report | Agent | Approval initiator | **P0 (audit #4).** WF-05 initiator; MISSING today. | ✅ backend exists |
| 50 | **AGT-APR-005** Agent submits price report | Agent | Approval initiator | **P0 (audit #4).** WF-06 initiator; PARTIAL today (Pro-tier). | ✅ backend exists |
| 51 | **PA-APR-003** Two-person action confirmation | PA | Approval | **P0 (audit #4).** Framework has no execute surface without this. | ✅ backend exists |
| 52 | **PA-APR-005** Two-person escalation | PA | Approval | **P1 (audit #4).** Approvers cannot defer today. | ✅ backend exists |
| 53 | **PA-APR-006** Two-person recall | PA | Approval | **P1 (audit #4).** Submitters cannot withdraw today. | ✅ backend exists |
| 54 | **AGT-ACT-001** Activation wizard — welcome | Agent | Activation | **P1 (Rev 8).** Post-signup structured onboarding entry point. | ✅ no backend |
| 55 | **AGT-ACT-002** Activation wizard — WhatsApp connect | Agent | Activation | **P1 (Rev 8).** Bridges to Model B WhatsApp binding (PR #50). | ✅ merged (PR #50) |
| 56 | **AGT-ACT-003** Activation wizard — first listing | Agent | Activation | **P1 (Rev 8).** Bridges to AGT-LST-004 manual composer or AGT-WLB WhatsApp intake. | ✅ merged |
| 57 | **AGT-ACT-004** Activation wizard — portal credentials | Agent | Activation | **P1 (Rev 8).** Bridges to AGT-CHN-001. Blocked until [BE-DESIGN-01] dynamic portal registry deploys (Week 2). | ⏳ Week 2 backend |
| 58 | **AGT-ACT-005** Activation wizard — invite team (agency-owner variant) | Agent + Agency | Activation | **P1 (Rev 8).** Bridges to WF-02 join-agency initiator flow. Only shown for agency-owner registration path. | ✅ merged |

## 5a. Non-UI blockers (backend / data / infrastructure prerequisites)

### Backend Week 3 (WF-04) — RESOLVED 2026-09-09

Dispatch [CURSOR_BACKEND_WEEK_3_WF04.md](../prompts/CURSOR_BACKEND_WEEK_3_WF04.md). All RESOLVED:

- BE-BLOCKER-22 — two-person cast-vote for account-recovery approve — **RESOLVED — `3e32c62d6cae931cdc02f7f38784054a97dccaba` — 2026-09-09 — PR #80**
- BE-BLOCKER-21 — WF-04 account-recovery backend bundle — **RESOLVED — `27ddf6da1e019f7f304596ac2d83b52c01f2bcbc` — 2026-09-09 — PR #82** (Agents 2–6: PRs #81–#85)

### Backend Week 5 (WF-05 + WF-06) — RESOLVED 2026-09-09

All RESOLVED:

- BE-BLOCKER-24 — `comparable_reports.expires_at` + auto-expire cron — **RESOLVED — `311885fb5773359dcf8e13a4e42f468c201bb605` — 2026-09-09 — PR #93**
- BE-BLOCKER-25 — `agent_price_reports.expires_at` + auto-expire cron — **RESOLVED — `311885fb5773359dcf8e13a4e42f468c201bb605` — 2026-09-09 — PR #93** (shared cron with BE-24)
- BE-BLOCKER-26 — WF-06 PA-PVA-009 backend bundle — **RESOLVED — `ef1e627b5db8ac4c6011db1cfb4cc18f9b046ce9` — 2026-09-09 — PR #95**
- BE-BLOCKER-27 — Seed `valuation.price_reports.submit` on Pro tiers — **RESOLVED — `8bdebaa09d08593d030a5dc145458460c83bec3a` — 2026-09-09 — PR #87**
- BE-BLOCKER-28 — WF-05 PA-PVA-008 backend bundle — **RESOLVED — `65ca361ac9801ec4fbfc274cf8e600704a0b4447` — 2026-09-09 — PR #92** (core `#98` `b46884acddf726658973cc32bb39166dce2334e7`; decisions `#97` `f66c43520aafbca3a28437ed882820cde9c82195`)

### Backend Week 8+ (contact relationships) — RESOLVED 2026-09-12

- BE-BLOCKER-36 — `contact_relationships` CRUD routes — **RESOLVED — `de84b7f536f071c725dc07b8e93bd9e9b5e05d18` — 2026-09-12 — PR #134**

**[BE-BLOCKER-01] Portal publishers stubbed.** `backend/src/lib/notifications/realestate.js` throws `NOT_IMPLEMENTED`. WF-03 (portal submission → moderation → outcome) cannot function end-to-end without real portal-publisher integration for the Phase-1 portal list (from `PORTAL_LIST_RESEARCH_2026-09-04.md`). Scope of the fix: implement per-portal publishers for at least the Phase-1 must-have list (Bayut, Property Finder, Dubizzle for UAE; Aqar.fm for KSA — coordinate with B3 portal list). Estimated effort: 2-3 weeks of Cursor work per portal + integration tests. **This is not a screen; it's a required backend prerequisite for Week 2 (WF-03 cluster).**

**[BE-VERIFY-01] `distribution_attempts.status` failure-class enumeration.** AGT-PUB-003/006 need to render 6 failure classes (auth-expired, portal-rules-violation, portal-down, quota-exceeded, invalid-content, unknown-error). Verify the schema carries these values before Week 2 dispatch. Grep the migrations + `lib/publishing/*` to confirm.

**[BE-VERIFY-02] AGT-ONB-BLOCKER-01 backend decision. RESOLVED 2026-09-09.** Onboarding flow needs the WhatsApp model (Model B shared-number activation-code already shipped in PR #50). Confirmed binding APIs (`activation-code`, `binding-status`, bindings CRUD) are grep-compatible for AGT-ONB/WLB.

**[BE-BLOCKER-02] Agency-scoped audit-log endpoint.** AGN-AUD-001 explicitly flagged that today's audit-log endpoint is PA-scoped only. Needs an agency-scoped variant before AGN-AUD frontend work. Not in Phase 1 slate but noted for Phase 2.

**[BE-BLOCKER-03] `distribution_attempts` failure-class enumeration.** `007_distribution.sql:51` — `status TEXT` with no CHECK, no enum, no structured `error_class` field. AGT-PUB-003/006 cannot render 6 failure classes (auth-expired, portal-rules-violation, portal-down, quota-exceeded, invalid-content, unknown-error) without schema migration adding a CHECK-constrained `error_class` column + backend classifier + backfill. Estimated 1-2 days. **Slot: Week 2 (before AGT-PUB-003/006 dispatch).**

**[BE-BLOCKER-10] Publishing-job aggregation endpoint.** `GET /api/publishing/jobs/:id` (composes distribution_attempts + portal_registry + credit reservations for the AGT-PUB-003 receipt) + retry POST endpoints + `publishing_job.completed` push notification template do not exist today. Depends on [BE-BLOCKER-03] error_class + [BE-DESIGN-01] portal_registry landing first. Estimated 3-5 days. **Slot: Week 2 (after BE-BLOCKER-03 and BE-DESIGN-01, before AGT-PUB-003 dispatch).**

**Wave 2 shared components added:** `<PortalReceiptCard>` (per-portal receipt row — reused by AGT-PUB-006), `<AggregateOutcomeHero>` (StatusHero adapter with 3-pill counter), `<CreditsSummary>` (credits-reconciliation block), `<PortalStatusPill>` (6-status enum used by both AGT-PUB-003 receipt cards and AGT-PUB-006 tracker rows — extract under `web/src/components/ui/portal-status-pill.tsx`). Extract all as shared primitives.

**[BE-BLOCKER-11] Publishing tracker endpoints.** `GET /api/publishing/tracker` (list, cursor-paginated, filterable by portal + status + listing + date range) + `GET /api/publishing/tracker/summary` (KPI aggregate for the tracker page's top strip) do not exist today. AGT-PUB-006 depends on these. Estimated 2-3 days. **Slot: Week 2 (parallel with BE-BLOCKER-10).**

**[BE-BLOCKER-12] `portal_submission.status_changed` push template.** New template row with 5 status-transition variants (SUBMITTED / IN_REVIEW / LIVE / REJECTED / FAILED / EXPIRED), deep-linking to AGT-PUB-003 in retrospective mode. Piggybacks on existing WF-01/WF-03 push infrastructure. Estimated 0.5 day. **Slot: Week 2.**

**[BE-BLOCKER-13] SSE/WebSocket for AGT-WLB-004 real-time draft streaming. RESOLVED — `03d1aeb` (#96) 2026-09-09.** SSE `/progress` + poll `/state` + `WHATSAPP_DRAFT_PROGRESS_MODE` flag. Client degrades SSE → poll → spinner.

**[BE-BLOCKER-14] Inbound-message poll endpoint for AGT-WLB-003. RESOLVED — `5d66c9a` (#94) 2026-09-09.** `GET /api/intake/inbound-status/:bindingId`.

**[BE-BLOCKER-15] Onboarding events schema + endpoints. RESOLVED — `e449e7f` (#100) 2026-09-09.** `onboarding_events` + `agent_activation_state` + `GET/POST /api/agent/activation_state*` + tour event POSTs.

**[BE-BLOCKER-16] `GET /activation-code` idempotency check. RESOLVED — `4ddcaaa` (#88) 2026-09-09.** Idempotent GET; POST remains explicit regenerate.

**Wave 4 shared components added:** `<TourFrame>` (5-dot progress + safe-exit chrome), `<StepHero>`, `<BenefitList>`, `<WhatsAppHandshakePanel>` (code + shared-number + QR + copy + tel-link + countdown), `<LiveDraftCanvas>` (SSE/polling-aware streaming field grid), `<SignalLampBadge>`, `<InboundMessageSummary>`, `<ListingPreviewCard>` (reused by AGT-LST-003). Extract under `web/src/components/onboarding/whatsapp/`.

**[BE-BLOCKER-17] Per-portal validator modules.** New `backend/src/lib/portal-validators/` module — one file per portal code (`bayut.js`, `property_finder.js` with country variants, `dubizzle.js`, `olx.js`, `aqar.js`, `wasalt.js`, `aqarmap.js`, `3akarat.js`). Each exports `validate(listing, portalContext) → { checks: [{ code, severity, message, expected, actual }] }`. Rules sourced from PORTAL_LIST_RESEARCH §C (trakheesi_number + broker_orn for Bayut UAE; agency_license + broker_id for PF UAE; advertiser_license Fal for Bayut KSA; developer_registration for Aqarmap primary/off-plan; per-country PF variants). Runs pre-queue-render + server-side pre-approve hard gate. Estimated ~1 day per validator × 8 initial = 8 days + 1 day per new portal thereafter. **Slot: Week 2 (parallel with BE-BLOCKER-01 PF Group publisher).**

**[BE-DESIGN-02] Tenure-risk scoring service.** PA-MOD-001 queue displays a risk tier per submission (informs the two-person-rule gate). Needs a scoring service considering agent tenure, prior rejections, agency reputation, listing anomaly signals. Estimated 3-5 days. **Slot: Week 2 (can ship with a stub returning "unknown" for v1 if capacity tight).**

**[BE-BLOCKER-27] `user_sessions` table + JWT `jti` + revocation middleware.** WingCaster today uses stateless JWT with `token_version` bumping — no per-session tracking. SHR-SET-004 sessions & devices needs: new `user_sessions` migration (jti, user_id, device_label, ip, ua, created_at, last_active_at, revoked_at), `jti` claim on every JWT, middleware to check `revoked_at IS NOT NULL` per request, 3 new routes (`GET /api/auth/sessions`, `DELETE /api/auth/sessions/:jti`, `DELETE /api/auth/sessions/all-except-current`). Security-adjacent — do NOT ship SHR-SET-004 UI without this. Estimated 3-4 days. **Slot: Week 4 (BLOCKING).**

**[BE-BLOCKER-26] Notification test-send endpoint.** `POST /api/billing/notifications/test-send` — sends a test message on the selected channel. Estimated 0.5 day. **Slot: Week 4.**

**[BE-BLOCKER-25] Paddle portal-session mint endpoint.** `POST /api/billing/portal-session` returns a signed Paddle customer-portal deep-link URL for SHR-SET-003. Uses paddle-customer-portal skill contract. Estimated 0.5 day. **Slot: Week 4.**

**[BE-BLOCKER-24] Avatar upload + delete endpoints.** `POST /api/users/me/avatar` (multipart) + `DELETE /api/users/me/avatar`. Store to existing asset infra. Estimated 1 day. **Slot: Week 4.**

**[BE-BLOCKER-38] AGT-CMP scheduling backend (soft — grep to confirm).** AGT-CMP-002/003/004 KPI truthfulness silently depends on a scheduling worker + `campaign_delivery_attempts` persistence + notification-template resolution stack. Grep `backend/src/modules/` for `campaign_delivery` and `scheduler` before Wave 3+ dispatch. If stub, file as blocker with ~5-7 day estimate. **Slot: Week 8+ (Phase 2 campaigns).**

**[BE-BLOCKER-37] AGT-LAI-002 `ai_refinement_sessions` table.** Refinement loop's Revert-without-recharge promise requires per-session variant history. Options: dedicated `ai_refinement_sessions` table OR JSONB variant history on the calling entity. Estimated 1-2 days. **Slot: Week 8+ if AGT-LAI-002 enters Phase 1; otherwise Phase 2.**

**[MATRIX-DRIFT-01] AGT-WLB naming collision.** `SCREEN_MATRIX_AGENT.md` has AGT-WLB-001 as a White-Label surface entry, but Rev-6 kickoff + Wave-4 briefs use AGT-WLB-001..005 for WhatsApp intake tour. Resolution: extend the matrix with a new AGT-WLB "WhatsApp intake tour" section covering 001..005, and either rename the existing White-Label AGT-WLB-001 to AGT-WLS-001 (White-Label Site) or move it to AGT-WLA. **Owner:** architect-owner. **Slot:** before Wave 4 dispatch (blocking).

**[MATRIX-DRIFT-03] SHR-AUT-007 (OAuth account link) + SHR-AUT-008 (username claim) not on disk.** Feedback log line 134 (2026-09-04) flagged these as new-screen requirements from the D9 signup-path decision; no matrix section, no brief, no Cursor prompt. May be needed downstream of SHR-AUT-006 signup dispatch when OAuth returns an already-linked identity or a claimed username. **Owner:** architect-owner. **Slot:** before Wave 1 dispatch OR defer to Phase 2 (user call).

**[MATRIX-DRIFT-02] AGT-ACT and AGT-VLA missing matrix sections.** Briefs exist for AGT-ACT-001..005 (activation wizard, Phase-1 add-on per Rev 8) but no matrix section. AGT-VLA-* referenced from AGT-LST but no matrix section. **Owner:** architect-owner. **Slot:** before Wave 4 dispatch (blocking for AGT-ACT).

**[BE-BLOCKER-36] `contact_relationships` CRUD routes. RESOLVED — `de84b7f536f071c725dc07b8e93bd9e9b5e05d18` (#134) 2026-09-12.** Seven endpoints shipped (`backend/src/lib/contacts/relationships-routes.js`): list-mine, list-other-redacted, create, patch, delete-pending, resend-consent-link, public consent landing (`GET /public/relationships/consent?token=…` + accept/reject). Consent link uses `signed-token.js` purpose `relationship_consent` (same HMAC family as `webhook-verify.js`). Unblocks Wave 8+ AGT-CTC-007.

**[BE-BLOCKER-35] `portal_registry` schema extensions + state tables.** [BE-DESIGN-01] core schema covers `id/code/display_name/country_codes[]/adapter_class_name/publisher_config/inbound_config/is_active`. PA-POR-002 form additionally writes: `description`, `logo_url`, `primary_language`, `validator_ref`, `effective_from`, `deprecated_at`. Plus two new tables: `portal_registry_pending_activations` (state machine for activation approvals) + `portal_activation_history` (for PA-POR-003 timeline). Estimated 1.5 days. **Slot: Week 6 (bundled with [BE-DESIGN-01] Week 2 or as an extension migration in Week 6).**

**PA-POR activation rule:** PA can register a "coming soon" STUB row immediately with `is_active=false` — visible/filterable across PA-POR-001. Server-side gates block `is_active=true` flip until `backend/src/lib/notifications/portals/<code>.js` adapter file AND `backend/src/lib/portal-validators/<code>.js` validator file exist and satisfy the base-class contract, at which point a second PA approves the WF-20 activation flip via PA-APR-003.

**[BE-BLOCKER-34] Unified `/execute` endpoint + 7 supporting tickets.** Current stubs at `backend/src/fin/admin/routes.js:282-288` (`POST /:id/approve` + `/:id/reject`) return `notImplemented('DL-166')`. PA-APR-003 specifies a NEW unified `POST /api/admin/approvals/:id/execute` endpoint consolidating both stubs, plus 7 supporting tickets (type-to-confirm phrase generation, value-tier evaluation, risk-signals aggregation, ledger-impact preview, self-approval rejection, idempotency, audit-write). Estimated 3-4 days. **Slot: Week 6 (before PA-APR-003 dispatch).** **Type-to-confirm is tiered** — universal consent checkbox on every execute, but the type-to-confirm text field (server-generated 4-word Diceware, exact-match) renders ONLY when `value_tier=high_value`. Over-applying to standard/elevated is an explicit anti-pattern — trains PAs to type-past the throttle and destroys the signal.

**[BE-BLOCKER-33] PA-APR-005/006 backend routes.** `fin/admin/routes.js` currently exposes only `/approve` + `/reject` (PR #44) — `/escalate` and `/withdraw` routes MISSING. Needs: `POST /api/admin/fin/approvals/:id/escalate` (body: `{targetUserId, rationale, notify_channels[]}`), `POST /api/admin/fin/approvals/:id/withdraw` (body: `{reason}`), `GET /api/admin/fin/approvals/:id/eligible-escalation-targets` (list of PA admins with authority to approve this request-type), companion migration adding `WITHDRAWN` enum + `escalated_to_user_id` + `escalation_rationale` columns to `fin.approval_requests`. Estimated 2 days. **Slot: Week 6 (before PA-APR-005/006 dispatch).**

**[BE-BLOCKER-32] PA-PKG backend prereqs (7 items).** Beyond Prompt 1's admin routes: env-scoped package catalog audit (0.5d), feature-registry live fetch audit (0.5d), own-submission detection on package versions (0.5d), undo-reject endpoint for 5-second grace (0.5d), marketing revalidation confirm ping/SSE (1d — non-blocking with client fallback), cross-env package clone helper for TEST-env seeding (1d — non-blocking Phase-1 add-on), submitter-only recall endpoint (1d), arbitrary-version diff endpoint (1d — non-blocking with client fallback). Total ~6 days. **Slot: Week 6 (bundled with PA-PKG frontend dispatch).** [UX-DECISION-01]: bulk approval on package versions DEFERRED to Phase 2.

**Wave 6 PA-PKG note:** PA-PKG-001..007 pre-Rev-6 numbering collapsed to Rev-6 four-screen slate (queue+detail are one brief, seed-modal absorbs into anchor, feature-registry admin + deprecate flow stay Phase-2).

**[BE-BLOCKER-31] WF-31 ownership-transfer backend bundle.** Backend does NOT exist — only guard messages "Ownership requires the ownership transfer workflow" reject role changes. Needs: `ownership_transfer_requests` table + 8 routes (`/state`, `/otp/send`, `/initiate`, `/accept`, `/decline`, `/cancel`, `/acknowledge`, `/reverse`), 14-day request-expiry cron, 30-day reversal-window enforcement, 5 notification templates (initiator-accepted, target-invited, target-declined, transfer-executed, reversal-window-expiring). Reuses SHR-MFA-007 step-up + email-OTP infra with new `purpose='ownership_transfer_initiate'` tag. Estimated 4-5 days. **Slot: Week 7 (before AGN-SET-005 dispatch).** New shared component: `<OwnershipTransferChallenge>` at `web/src/components/agency/OwnershipTransferChallenge.tsx` (composed 3-factor: password step-up + email OTP + typed agency-name).

**[BE-BLOCKER-30] `agency_onboarding_state` table + endpoints.** Distinct from `agent_onboarding_state` (BE-BLOCKER-20) — different keys (`agency_id` vs `user_id`), different checklist shape (branding/invites/billing/portal/listing/roles/2FA), different auto-detection joins (agencies/agency_invitations/paddle_customers). Same user can own an agency AND be an agent under another with unrelated checklists — piggybacking would force a scope discriminator + polymorphic JSONB for no real reuse. Estimated 1 day. **Slot: Week 7 (before AGN-DSH-002 dispatch).**

**[BE-BLOCKER-29] Capability packs — schema + endpoints.** D1 Path B chose JSONB capability_packs on `tenant_memberships`. Today only `role IN ('owner', 'admin', 'member', 'guest')` exists. Needs: `capability_packs JSONB` column, seed pack definitions (Finance / Marketer / Read-only / Custom), `GET /api/agency/capability-packs[/:id]`, `PATCH /api/agency/members/:userId/capability-packs`. Estimated 3-4 days. **Slot: Week 7 (before AGN-ROL-001/002 dispatch).** Two-person infra (`fin.approval_requests`) already exists for pack edits granting Financial capabilities.

**[BE-BLOCKER-28] WF-05 PA-PVA-008 backend bundle (12-14 days). RESOLVED — `65ca361ac9801ec4fbfc274cf8e600704a0b4447` (#92) 2026-09-09** (core `#98` / decisions `#97`). Existing `GET /api/admin/pricing/reports` (list only, no filters/pagination) + `POST /:id/review` (generic tri-state). Needs: list-response extension (masking flags + market impact + evidence + reporter/comparable objects + is_own + env + pagination + counts), REPLACE generic `/review` with four WF-05 decision endpoints (`/confirm-remove`, `/confirm-quarantine`, `/reject-as-invalid`, `/request-info`) + bulk-reject-as-invalid + bulk-request-info + undo endpoints + affected-valuations endpoint + reporter-history endpoint + audit-trail endpoint + single-item `GET /:reportId`. **Slot: Week 5 (parallel with BE-BLOCKER-26 WF-06 bundle).**

**Wave 5 WF-05 family deviations from PA-MOD-001 (justified):** (1) Bulk confirm-remove OMITTED — removal re-runs valuations across market; bad bulk-confirm could invalidate thousands. Bulk is Reject-invalid + Request-info only. (2) No inline row Approve/Reject — all four decision affordances live on -008b detail, mirroring PA-ACR arbitration discipline. (3) Two-person rule triggered by market-impact tier (not tenure risk); high-impact confirmed removals record as `REMOVE_PROPOSED` and surface in PA-APR-001 for a second PA, with recalculation deferred until second approval lands. (4) Reporter-pattern amber dot as new WF-05 signal for coordinated reporting (informational, not policy gate).

**[BE-BLOCKER-27] Seed `valuation.price_reports.submit` feature code on Pro tiers. RESOLVED — `8bdebaa09d08593d030a5dc145458460c83bec3a` (#87) 2026-09-09.** New migration (numbered per actual state at branch time — Prompt 1 packages-marketing-fields takes 316; use next unused ≥317) seeding the feature onto Pro-tier package versions in the existing `package_feature_flags` registry from PRs #33-#39. Gates AGT-APR-005 tier check. Estimated 0.5 day. **Slot: Week 5 (before AGT-APR-005 dispatch).**

**Wave 5 shared components added:** `<EvidenceUploader>` (file-upload grid with progress/error tiles, `max_files` prop) at `web/src/components/forms/EvidenceUploader.tsx`, `<ContextEchoCard>` (read-only "here's what you're acting on" reassurance card) at `web/src/components/forms/ContextEchoCard.tsx`. Both used by AGT-APR-004/005 and reusable by future PA-CRD-005 grant initiator. Build once in a prep PR ahead of Week 5 WF-05+WF-06 cluster.

**[BE-BLOCKER-26] WF-06 PA-PVA-009 backend bundle (8 items). RESOLVED — `ef1e627b5db8ac4c6011db1cfb4cc18f9b046ce9` (#95) 2026-09-09.** Backend PARTIAL: `GET /api/admin/pricing/agent-price-reports` (list — no pagination/filters/joins) + `POST /:id/review` (accepts `{status: 'verified'|'rejected', notes}` — no `request_info`, no `incorporate` semantics). Needs: list-route pagination + filters + joins, per-item detail route, benchmark-series route, extend `POST /:id/review` with `incorporate: boolean` (true → benchmark write; single-approver commit when |delta|<10%, otherwise two-person via `fin.approval_requests`), benchmark-refresh worker enqueue, benchmark writer in the module, `request_info` state. Estimated 5-7 days. **Slot: Week 5 (parallel with WF-05 backend).**

**[BE-BLOCKER-25] `agent_price_reports.expires_at` + auto-expire cron. RESOLVED — `311885fb5773359dcf8e13a4e42f468c201bb605` (#93) 2026-09-09.** WF-06 EXPIRED state needs schema column + daily cron flipping pending → expired. Estimated 0.5 day. **Slot: Week 5.**

**[BE-BLOCKER-24] `comparable_reports.expires_at` + auto-expire cron. RESOLVED — `311885fb5773359dcf8e13a4e42f468c201bb605` (#93) 2026-09-09.** WF-05 EXPIRED state needs schema column + daily cron. Estimated 0.5 day. **Slot: Week 5.**

**Wave 5 REC-family anchor extension:** `<StatusHero>` needs new `emphasis="default"` variant on approved states (for REC-002 APPROVED-AND-QUARANTINED and REC-003 APPROVED-AS-SIGNAL-ONLY) — sunken surface with `CheckCircle2` in `--lc-accent-bold-edge`. One PR to AGT-REC-004 anchor covers both. Screen-local panels added: `ImpactPanel` (REC-002), `WeightingPanel role="meter"` (REC-003), shared `OriginalReportAccordion` pattern. New endpoints: `GET /api/users/me/comparable-reports/:id` and `/price-reports/:id` (thin aliases for /api/users/me/* convention symmetry). Two new push templates: `comparable_report.resolved`, `price_report.resolved`.

**[BE-BLOCKER-23] `GET /api/settings/index` server-side capability-gated menu.** SHR-SET-001 uses server-only capability gating (never reads `session.role` client-side) — endpoint returns only the groups + items the caller may see. Estimated 0.5 day. **Slot: Week 4 (before SHR-SET-001 dispatch).**

**Wave 4 Settings shared components:** `<SettingsShell>` + `<SettingsSidebar>` + `<SettingsNavGroup>` + `<SettingsNavItem>` + mobile pair `<SettingsCardList>` + `<SettingsCardRow>` under `web/src/components/settings/`. SHR-SET-002/003/004/005 register as child routes under `/settings/*` and specify only right-pane content deltas.

**[BE-BLOCKER-22] Two-person-rule bypass in existing account-recovery approve endpoint.** **RESOLVED — `3e32c62d6cae931cdc02f7f38784054a97dccaba` — 2026-09-09 — PR #80.** `POST /:caseId/approve` at `backend/src/server.js:7041` currently bypasses two-person and executes on single admin action. **Security-adjacent.** Must refactor through a cast-vote endpoint before PA-ACR-002 UI ships or the UI will expose a security downgrade to admins. Estimated 1-2 days refactor + tests. **Slot: Week 3 (BLOCKING).**

**[BE-BLOCKER-21] WF-04 account-recovery backend bundle (13 items).** **RESOLVED — `27ddf6da1e019f7f304596ac2d83b52c01f2bcbc` — 2026-09-09 — PR #82** (Agents 2–6: PRs #81–#85). From PA-ACR-001/002 briefs: list-response extension, request-info endpoint, evidence upload + storage, account_value_tier derivation, env-scoping audit, reveal-audit endpoint (20/hr rate limit), undo-approve endpoint, masked/PII CSV export, single-case GET, two-person cast-vote + escalation wiring, authenticated evidence image proxy, withdraw-vote, cancel-info-request. Total ~15-18 backend days. **Slot: Week 3 (bundled — many are needed by PA-ACR-002 detail view).**

**Wave 3 PA-ACR shared components added:** `<PIIMask>` (reusable across PA-USR/PA-SUP/PA-KYC), `<TwoPersonProgress>` (reusable across every WF-07/08/17-25/27-28 second-approval surface), `<Timeline>` (shared with PA-AUD-001). Extract as shared primitives. Note: WF-04 does NOT use PAQueueBulkBar (single-case only for PII safety) — this deliberate deviation is documented in PA-ACR-001 brief.

**[BE-BLOCKER-20] `agent_onboarding_state` table + endpoints.** `GET/PATCH /api/user/onboarding-state` for step/path/checklist/dismissed_forever state persistence. Required by all 5 AGT-ONB screens + AGT-DSH-001 checklist mount. Estimated 1 day. **Slot: Week 4 (must ship with AGT-ONB PR).**

**[BE-BLOCKER-19] Public token-authed scheduled-deletion endpoints + email templates + reminder cron.** `GET /api/auth/scheduled-deletion/:token` + `POST /:token/cancel` (no session-cookie auth — token-signed only). Reuses existing HMAC token infra (new `purpose` enum `scheduled_deletion_view`; TTL 60 days). Three email templates via Microsoft Graph (T+0/T-7/T-1) + daily reminder cron with idempotency via `reminders_sent` on `deletion_requests`. Estimated 2-3 days. **Slot: Week 3.**

**[BE-VERIFY-19] Partial-PATCH for draft fields (AGT-ONB-003 inline edit).** Nice-to-have — recommend fast-follow. Ship AGT-ONB-003 with jump-to-full-editor for Week 4 if not ready.

**[BE-VERIFY-20] `bound_at` on binding-status response.** Nice-to-have for AGT-ONB celebration timestamp accuracy.

**Wave 4 onboarding shared components:** `<OnboardingProgressMarker>` (used by AGT-ONB-001/002/003/004), `<IntakePathCard>` (AGT-ONB-001 + -004 next-actions), `<ActivationCodeBanner>` (AGT-ONB-002, reused by AGT-SET-004), `<OnboardingStepper>` + `<SignalLampDot>`, `<DraftListingPreview>` (AGT-ONB-003, reused by AGT-WLA-002), `<CelebrationHeader tone>` (AGT-ONB-003 subdued + -004 loud), `<PublishingOverlay>`, `<OnboardingChecklistCard>` + `<OnboardingPill>` + `<ProgressRing>` + `<SparkleBurst>` (AGT-ONB-005), `<OfflineBanner>`, `useOnboardingState()` SWR hook. **Note:** AGT-ONB-005 is a **first-class dashboard widget** mounted on AGT-DSH-001 Zone 3 conditionally, NOT a standalone route. AGT-DSH-001 brief needs a small update in the same PR.

**[BE-BLOCKER-18] Regenerate-backup-codes endpoint.** `POST /api/auth/2fa/backup-codes/regenerate` does not exist. SHR-MFA-005 requires it. Estimated 0.5 day. **Slot: Week 4 (must land with MFA screen dispatch).**

**[BE-VERIFY-18] Backup-codes fetch endpoint.** By design (codes shown exactly once at verify time), no endpoint exists to fetch existing codes post-enrollment. SHR-MFA-005 is a regenerate-only surface. Verify this remains the intended contract before implementation.

**Wave 4 MFA shared components:** `<OtpInput>` (6-cell — used by MFA-003/004/007), `<BackupCodeInput>` (auto-formatting — MFA-004b/006/007), `<RateLimitBanner>`, `<TrustFooter>` (reused across MFA-004/004b/AUT-001/AUT-006), `<StepUpModal>` + `<StepUpProvider>` + `useStepUp` hook (invoked by MFA-005/006, SET-004/005, PA credit surfaces, AGN ownership transfer), `<TwoFactorStatusHero>`, `<MethodRow>`, `<BackupCodesRow>` (reused in SHR-SET-004 sessions surface), `<EnrollmentStepper>`, `<PasswordGateCard>`, `<RevealableSecret>`, `<BackupCodeGrid>` (+ `web/src/print.css` addition for backup-codes print support).

**[BE-VERIFY-09..17] PA-MOD-001/002 verifications:**
- `[BE-VERIFY-09]` per-portal SLA config on `portal_registry.publisher_config`
- `[BE-VERIFY-10]` undo-approve / undo-reject endpoints (for 5-second undo grace)
- `[BE-VERIFY-11]` `is_own` detection (agent-of-record + tenant-owner join)
- `[BE-VERIFY-12]` env-scoped queue audit
- `[BE-VERIFY-13]` sibling-queue-position lookup for J/K keyboard nav
- `[BE-VERIFY-14]` agency `two_person_reject_required` flag exposure
- `[BE-VERIFY-15]` contact-reveal audit endpoint
- `[BE-VERIFY-16]` portal payload preview serialization
- `[BE-VERIFY-17]` notification-preview substitution
- **Slot:** Week 2, pre-dispatch grep + confirmation for each.

**PA approval-queue-family reusable components (locked pattern for PA-ACR, PA-PVA, PA-APR):**
- `<PAQueueFilterStrip>` — filter row (env-badge + status + submitted-within + risk-tier + custom-filters slot)
- `<PAQueueTable>` — filterable table + row-selection + row-click-to-detail
- `<PAQueueBulkBar>` — bulk-action floating bar (approve / reject / assign)
- `<PAQueueBulkApproveDialog>` + `<PAQueueBulkReasonDialog>` — bulk-action confirmations
- `<PAQueueKeyboardShortcutsPanel>` — J/K/A/R/I/Enter/X/Shift+A/./?/Esc reference panel
- 7 family invariants: env-badge-always-visible; env-scoped data; two-person rule; bulk-reject-requires-reason + bulk-approve-count-confirm; step-up for high-risk + bulk>5; immutable audit; 5s undo grace for single-row only; keyboard-first.

**[BE-BLOCKER-09] `agency_applications.expires_at` + 30-day auto-expire cron.** Matrix references an EXPIRED state for WF-02 applications but the schema has no `expires_at` column and no cron/write-time transition from `pending → expired`. Surfaced by AGT-REC-004 brief. Needs migration adding column + a small cron worker running daily that flips pending applications older than 30 days. Estimated 0.5 day. **Slot: Week 1 (bundled with WF-02 cluster).**

**[BE-BLOCKER-08] `agencies.accepting_applications` boolean.** No gate today for whether an agency is currently accepting join applications. AGN-MEM-005 public-apply page needs this to render an "agency not accepting applications" state and to filter the "browse agencies accepting applications" list. Migration + owner toggle exposed on AGN-SET-001. Estimated 0.5 day. **Slot: Week 1.**

**[BE-BLOCKER-07] `agency_invitations` table + endpoints.** No infrastructure today for shareable invitation links (`/join/:invitationCode` path in AGN-MEM-005 + SHR-AUT-006 path b). Needs new table (id, agency_id, code, created_by, expires_at, single_use bool, used_at, revoked_at), `GET /api/invitations/:code`, `POST /api/invitations/:code/accept`. Estimated 1-1.5 days. **Slot: Week 1 (may push to Week 1.5 if capacity tight).**

**[BE-BLOCKER-06] Agency application route rename + schema uplift.** Legacy route `POST /api/agencies/apply` at `backend/src/server.js:7152` doesn't fit AGN-MEM-005's contract. Rename to `POST /api/agencies/:slug/applications`. Extend `agency_applications` schema with: `applicant_user_id`, `current_listings_count`, `portfolio_url`, `availability`, `referral_source`, `profile_share_consent`, `invitation_code`, `expected_response_by`. Estimated 1 day. **Slot: Week 1 (before AGN-MEM-005 dispatch).**

**[BE-VERIFY-03..08] Wave-1 approver-side verifications (from AGN-MEM-002/002b briefs):**
- `[BE-VERIFY-03]` bulk-approve / bulk-reject endpoint existence
- `[BE-VERIFY-04]` undo grace-period support (commit delay OR undo endpoints — required for 5-second undo UX)
- `[BE-VERIFY-05]` per-agency step-up policy exposure (drives conditional SHR-MFA-007 gate on approve)
- `[BE-VERIFY-06]` risk-signals payload shape (may be empty for v1)
- `[BE-VERIFY-07]` queue-position + siblings computation (needed for J/K keyboard nav across queue)
- `[BE-VERIFY-08]` contact-reveal audit-log wiring
- **Slot:** Week 1, pre-dispatch grep + confirmation for each. Any that come back MISSING become new [BE-BLOCKER-*] entries.

**Wave-1 shared-component extractions (from AGN-MEM-005 + REC-004 briefs):** `<AgencyIdentityCard>`, `<PersonaChip>`, `<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>` need to be built as shared primitives (not page-scoped) because they're reused across SHR-PUB-003, AGN-DSH-001 attention cards, and all future REC-family screens (REC-002/003/005/006). Also: SHR-AUT-006's `<IdentityForm>` should be exposed as a shared primitive so AGN-MEM-005's guest-signup collapsible can reuse it. Cursor Wave-1 dispatch prompt must explicitly instruct extraction.

**[BE-BLOCKER-05] Agency free-tier package seed.** `product_packages` currently seeds only `target_audience='agent'` free-tier via migration 304. SHR-AUT-006 path (c) — "Agency owner registering a new agency" — needs a new agency-target free-tier package seeded via migration 316+ so agency owners registering can be auto-provisioned into a subscription. Without this, path (c) fails at signup or requires post-signup manual PA intervention. Estimated 0.5 day (migration + seed row + test). **Slot: Week 1 (before SHR-AUT-006 signup PR dispatch).**

**[BE-BLOCKER-04] `conversations.source_channel` decomposition.** `005_conversations.sql:10` — single `source_channel TEXT` column conflates transport-channel with source. OQ2 answer at [SCREEN_MATRIX_FEEDBACK.md:186-189](SCREEN_MATRIX_FEEDBACK.md) locked (2026-09-04) that channel + source are TWO independent attributes. Schema decomposition was never done. Blast radius: 14 files reference `source_channel` (InboxPage.tsx lines 37/404/405/449 explicitly confirmed via AGT-INB-001 brief investigation; CommandCenterPage.tsx, orchestrator.js, api/client.ts, table-mapper.js, etc.). Blocks AGT-INB-001/002/005, AGN-ROU-002, AGT-CTC-002, AGT-LST-006, AGN-REP-002/003. Migration: split into `channel TEXT` (WhatsApp/Email/SMS/IG DM/etc.) + `source TEXT` (Direct/Bazaar/Bayut/PF/etc.), backfill from existing single column, update all 14 code sites with dual-read fallback during migration window. Estimated 3-5 days. **Slot: Week 4 (bundled with AGT-ONB dispatch, since AGT-ONB-004 celebration screen references Bazaar/portal sources).**

**[BE-DESIGN-01] Dynamic portal registry (user directive 2026-09-06).** User confirmed: backend must support adding new portals on the fly. Current state: `backend/src/lib/notifications/realestate.js` hardcodes a `PORTALS` map (4 entries: olx, property_finder, bayut, dubizzle); `credits/features.js` hardcodes feature codes per portal. **Design:**
- New table `portal_registry` — columns: `id`, `code`, `display_name`, `country_codes TEXT[]`, `adapter_class_name`, `publisher_config JSONB`, `inbound_config JSONB`, `is_active`, `created_at`, `updated_at`.
- Publisher adapter pattern — `backend/src/lib/notifications/portals/<code>.js` extending `PortalPublisher` base. Adding a portal = drop in a new adapter file + insert a `portal_registry` row.
- Dynamic feature registration — `credits/features.js` reads from `portal_registry` at boot; each active portal auto-registers a `PUBLISHING_REALESTATE_<CODE>` feature.
- New PA screen family — PA-POR-001 (portal list), PA-POR-002 (add/edit portal), PA-POR-003 (portal activation history). Same pattern as PA-PKG-*.
- Metering: keep single `publishing.realestate.<code>` feature per portal + add `country_code` dimension on metered event (per PORTAL_LIST_RESEARCH §132 Option 2). PA-POR-002 form accepts country-code list.
- **Cost:** ~1 week backend (schema + adapter refactor + feature dynamic-load) + ~1 week Cursor for PA-POR-* screens (~3 screens). **Slot: Week 2 backend alongside portal-publisher stubs; PA-POR-* frontend into Wave 3.6 (parallel to PA-PKG-*).**
- **Rationale:** doing this from day one avoids retrofit cost. Cheap to start dynamic; expensive to migrate a hardcoded catalogue later.

**[PORTAL-LIST-LOCK 2026-09-06] Portal list authoritative source.** Per user direction 2026-09-06, portal list is **LOCKED** to [PORTAL_LIST_RESEARCH_2026-09-04.md](PORTAL_LIST_RESEARCH_2026-09-04.md) with the D19-restructured Property-Finder-Group critical-path model. Confirmed orderings:
- **UAE:** Bayut / Property Finder / Dubizzle (top 3 stop).
- **KSA:** Aqar / Bayut KSA / Wasalt.
- **Egypt:** Property Finder Egypt / Aqarmap / OLX Egypt.
- **Lebanon:** Property Finder Lebanon / OLX Lebanon / 3akarat.net. Blue Door → Phase 2 unverified (D-S-07 recommendation removal stands until user reconfirms it as a real integrated channel).
- **Phase-1 backend critical-path per D19:** Property Finder Group only (covers UAE/KSA/EG/LB/JO/QA/KW/BH/OM with one commercial agreement + one adapter, potentially country-variant). Other portals ship as `portal_registry` rows with adapters implemented in Phase 2 as BD lands per-portal deals.
- Feedback-log stale draft (§L205-229 in SCREEN_MATRIX_FEEDBACK.md) is SUPERSEDED and marked so in the log.

**Standing correction on independent audit's speculation:** the reviewer suggested SHR-PUB pages might be "legacy from a prior Real Estate Bazaar consumer portal build." **This is wrong.** Per project memory ([[project_wingcaster_vs_bazaar]]), WingCaster and Real Estate Bazaar are separate products; SHR-PUB pages are WingCaster's agent lead-capture surface, not consumer browsing. Keep the pages, fix the branding bug on SHR-AUT-006, don't demote the domain.

**Excluded from Phase 1 (deliberately):**
- Every Agency-admin-specific *screen* — Phase 1 focuses on the agent path (tenant switcher unblocks agency membership, but the agency-role-specific screens are Phase 2).
- Pricing, analytics, reporting, calendar, campaigns, complaints, all AGN-* multi-tenant screens.
- Every "index" or "help" screen — Phase 2.
- **AGT-REC-005** only (was Rev-4 "AGT-REC-002/003/005") — 002 and 003 pulled into Phase 1 per Rev 5 (paired with PA-PVA-008/009). AGT-REC-005 remains deferred; blocked on SHR-AUT-005c which is EXISTS but paired with SHR-AUT-005d which is now in Phase 1. Revisit at Week 3 end.
- ~~**AGT-ACT-\*** agent activation / first-run flow~~ — **APPROVED as Phase-1 Wave-4 add-on (Rev 8).** Now rows 54-58 in §5 slate.
- **Every PA screen except PA-PKG-\* (see §11a)** — internal-only, low daily-active count, deferred to Phase 2.

**Strategic build-order note (from audit #2):** the reviewer diagnosed a build-order inversion — monetization plumbing (Paddle subscription mgmt, credit top-up, channel-connect) shipped before activation surfaces (onboarding, publishing outcomes, workflow feedback loops). The Rev-3 slate corrects this by pulling AGT-ONB, AGT-PUB-003/006, and AGT-CTC-007 into Phase 1 alongside the nav-chrome P0s. Every future wave planning decision should apply the same lens: **activation → value → monetization**, in that order.

---

## 6. Phase-1 sequencing — workflow-cluster dispatch (Week 0..8+)

**Rev 5 — 2026-09-06.** Replaced the Rev-1..4 persona-domain waves with the audit #4's workflow-cluster dispatch model. Rationale: cross-matrix workflows deadlock unless both sides ship in the same window (see WF-02, WF-03, WF-04, WF-05, WF-06, WF-31). Persona-domain waves force serial builds that create the deadlock. Cluster dispatch ships both sides in one PR pair per week and matches the PA matrix's own D5 decision.

**Cadence assumption:** ~1 cluster per calendar week with 2-3 parallel Cursor tracks. Solo-user + Cursor cadence realistically 1 cluster per 1.5 weeks → total 12-16 weeks Phase 1.

### Week 0 — Infrastructure (blocks everything)
- SHR-NAV-001..002 (top bar + side drawer) + SHR-NAV-003 (agent bottom tab bar) + SHR-NAV-006 (language selector) + SHR-NAV-008 (tenant switcher) — one PR.
- PA-NAV-001 (env switcher LIVE / TEST) — one PR.
- SHR-AUT-001 (login) — one PR. Brief exists.
- **[BRANDING-CLEANUP-01]** bundled into Wave 0 per user directive (Rev 8): fix `web/src/lib/usePageTitle.ts:3` default suffix "Real Estate Bazaar" → "WingCaster"; audit all 41 caller sites for explicit suffix overrides; delete `web/rebrand.py` (dead script from prior codebase merge); mark `web/docs/design-architecture-*.md`, `feature-capability-audit.md`, `marketplace-domain-model.md`, `tickets/*.md` as legacy prior-project docs (NOT WingCaster architecture) or delete them. Ships as a separate small PR alongside Wave 0 nav-chrome.
- **Unblocks:** every multi-tenant surface, mobile navigation, RTL, all PA financial flows, correct browser-tab titles across 41 pages.

### Week 1 — WF-02 Join agency (deadlock resolution)
- AGN-MEM-005 (public join / apply) + AGN-MEM-002 (queue) + AGN-MEM-002b (detail) + AGT-REC-004 (agent outcome) — one PR pair (Agency PR + Agent PR).
- SHR-AUT-002 (signup 6 identity paths) — one PR, ships alongside since paths (b) + (c) route into WF-02.
- **Unblocks:** registration paths (b) and (c). Agency membership becomes real.

### Week 2 — WF-03 Portal moderation (deadlock resolution + 3 backend prerequisites)
- **[BE-DESIGN-01] Dynamic portal registry** — implement `portal_registry` table + adapter pattern + dynamic feature registration. Portal list becomes DB-driven, not hardcoded. ~1 week backend.
- **[BE-BLOCKER-01] Property Finder Group publisher adapter** — implement first real portal adapter (PF UAE + PF KSA + PF Egypt + PF Lebanon country variants) plugged into the registry. Per D19, PF Group is the Phase-1 critical path. Other portal adapters land in Phase 2 as BD deals close. ~2-3 weeks backend for PF adapter; other portals cost incremental (~3-5 days per portal) once adapter pattern is proven.
- **[BE-BLOCKER-03] Schema migration** — add `error_class` column to `distribution_attempts` with CHECK constraint enumerating 6 failure classes + backend classifier + backfill. ~1-2 days. Must land BEFORE AGT-PUB-003/006 dispatch.
- **[BE-BLOCKER-02b] PA-MOD routes** — new `/api/admin/moderation/*` routes for portal-submission review queue + detail actions. Grep confirmed missing. ~3-5 days backend.
- **UI:** AGT-PUB-003 (outcome receipt) + AGT-PUB-006 (portal tracker) + PA-MOD-001 (queue) + PA-MOD-002 (detail) — one PR pair (Agent + PA).
- **PA-POR-* frontend deferred to Wave 3.6** (see below).
- **Unblocks:** primary metered revenue surface; enables per-country pricing dimension on metering.

### Week 3 — WF-04 Account recovery (support ops rescue)
- SHR-AUT-005d (scheduled deletion confirmation) + PA-ACR-001 (queue) + PA-ACR-002 (detail) — one PR pair (Shared + PA).
- **Unblocks:** account-recovery support ops.

### Week 4 — WF-01 Onboarding + AGT-ACT wizard + MFA + Settings shell + [BE-BLOCKER-04]
- **[BE-BLOCKER-04] `conversations.source_channel` decomposition** — split single column into `channel` + `source`, backfill, update all 14 code sites, dual-read migration window. ~3-5 days. Must land before AGT-INB dispatch in Week 8+; slotted here because AGT-ONB-004 celebration screen already references Bazaar/portal sources.
- [BE-VERIFY-02] confirm onboarding backend hooks work with PR #50 WhatsApp binding. **RESOLVED 2026-09-09.**
- [BE-BLOCKER-13/14/15/16] AGT-ONB + AGT-WLB backend bundle. **RESOLVED 2026-09-09** (#96 / #94 / #100 / #88).
- AGT-ONB-001..005 + AGT-WLB-001..005 — one PR (bundled per Rev-3 rationale; same funnel). AGT-ONB-BLOCKER-01 was resolved by PR #50 shipping Model B.
- **AGT-ACT-001..005** activation wizard — one PR. New screen family. AGT-ACT-004 (portal credentials) has a soft dependency on [BE-DESIGN-01] dynamic portal registry from Week 2 — if Week 2 slips, ship AGT-ACT-004 in Wave 8+.
- SHR-MFA-001..003, 007 (enrollment + step-up) + SHR-MFA-004, 004b, 005, 006 (operational flows) — one PR.
- SHR-SET-001..005d (settings home + account + billing prefs + sessions + delete account) — one PR.
- **Unblocks:** agent activation funnel (structured + free-form) + false-security-promise fix + GDPR compliance + inbox source-badge separation.

### Week 5 — WF-05 + WF-06 Valuation review (deadlock resolution)
- AGT-APR-004 + AGT-APR-005 (agent initiators) + AGT-REC-002 + AGT-REC-003 (agent outcomes) + PA-PVA-008/008b/009/009b (PA queues + details) — one PR pair (Agent + PA).
- **Unblocks:** WF-05 + WF-06 feedback loops. Agents stop submitting into a black hole.

### Week 6 — Two-person-rule UI + PA-PKG-* admin + PA-POR-* portal admin
- PA-APR-003 (action confirmation) + PA-APR-005 (escalation) + PA-APR-006 (recall) — one PR.
- PA-PKG-001..004 (package admin) — one PR (per §11a; depends on backend Prompt 1 deploy).
- **PA-POR-001..003** (portal list + add/edit + activation history) — one PR (per [BE-DESIGN-01]; depends on Week 2 dynamic registry deploy). New screen family — needs briefs authored in a dedicated session.
- **Unblocks:** WF-20 execute/escalate/recall + PA-managed pricing surface + PA-managed portal catalog (add portals on the fly).

### Week 7 — WF-31 Ownership transfer (deadlock resolution) + Agency governance
- AGN-SET-005 (initiator) + AGN-SET-005b (recipient) + AGT-REC-006 (agent outcome) — one PR pair.
- AGN-ROL-001 + AGN-ROL-002 (role management UI) — one PR.
- AGN-DSH-002 (agency onboarding checklist) — one PR.
- **Unblocks:** enterprise governance + capability-pack visibility + agency activation.

### Week 8+ — Activation + polish
- AGT-DSH-001 + AGT-DSH-002 (dashboard Guided + Pro variant, tablet+desktop-only per D-S-06) — one PR.
- AGT-SET-002 (mode toggle) — one PR (small).
- AGT-LST-001, 003, 004 (listing surface) — one bundled PR or three.
- AGT-INB-001..002 (inbox anchor for "Catch") — one PR.
- AGT-CTC-007 (contact relationships editor) — one PR.
- Mobile-first pass on top 8 agent screens if scope allows.
- **Unblocks:** full v1 experience.

### Post-Week-8 open items
- AGT-ACT-* activation wizard (D-S undecided; slots here if Phase-1 add-on chosen).
- AGT-REC-005 revisit (was deferred; SHR-AUT-005d now ships in Week 3 which unblocks it).
- Mobile-first pass on remaining Agent screens (Phase 2 unless promoted).

---

## 7. Non-negotiables

1. **Every screen uses Broadcast tokens only.** No raw hex, no unaliased Tailwind colors — `no-raw-hex.test.ts` (product-side equivalent) must stay green.
2. **Every screen supports LTR + RTL.** Arabic mirror verified per screen.
3. **Every screen supports Light + Dark modes.**
4. **Every mobile screen honors 44px tap floor + safe area insets** (Capacitor iOS/Android).
5. **Two-tone focus rings** on every interactive element.
6. **Numerals in IBM Plex Mono with `tabular-nums`** — `<Numeric>` component wrapper.
7. **Status pills are never color-alone** — glyph + label + color per Broadcast rule.
8. **Every screen has a corresponding brief in `docs/design/briefs/`** before Cursor dispatch. No "just build it from the matrix entry."
9. **Every PR gets architect-owner review** — same discipline as backend.

---

## 8. Cadence + resource assumptions

- **Briefs (Phase A):** I author ~3-5 briefs per focused session. Phase 1 needs ~10 new briefs (existing 4 cover LST-003, DSH-001, AUT-001, SET-005). Estimated 2-3 sessions to draft the Wave 1-6 briefs.
- **Design AI (Phase B):** user runs v0 per anchor. ~1 hour per anchor for a first pass, iterate over a day or two.
- **Cursor (Phase C):** 3-5 days per PR + review. 6 waves × ~1 PR per wave = ~6 weeks minimum, assuming serial dispatch. With parallel Cursor conversations (like we did for the backend work), 4-5 weeks is realistic.

**Realistic Phase-1 timeline: 4-6 weeks calendar time** assuming user + Cursor + I keep pace and no scope creep.

---

## 9. Open decisions — need your input

Numbered D-S-* to keep them distinct from other decision series.

### D-S-01 — Confirm the Phase-1 slate — **APPROVED 2026-09-06**

User locked the 53-screen Rev-6 slate (§5) as final scope for Phase 1. No further screen additions without explicit revision. Removals allowed only via a new D-S entry.

### D-S-02 — Confirm the wave sequencing — SUPERSEDED by D-S-10

Rev-2 wave sequencing (Waves 1..6 persona-domain) was replaced by the Rev-5 Week 0..8+ workflow-cluster model. See D-S-10 for the active decision.

### D-S-03 — Design AI tool for product side — **APPROVED 2026-09-06: v0 by Vercel**

Matches marketing site tooling; skill reuse. Used for anchor screens; skipped for supporting variants where the anchor's visual language suffices.

### D-S-04 — Parallel Cursor tracks — **APPROVED 2026-09-06: yes**

Multiple Cursor conversations can run in parallel on different domains. Serial within a domain to avoid collision on shared components.

### D-S-05 — Anchor briefs before Wave 0 or interleaved — **REVERSED 2026-09-06: batch upfront**

Original recommendation of "interleave" was wrong for user's scale (solo reviewer, needs parallel dispatch). Reversed: **author all Phase-1 anchor briefs upfront** in a batch pass before any Wave 1+ Cursor dispatch. Wave-0 briefs already exist on disk (10 of ~30 anchors total). Remaining ~20 anchor briefs to write across Waves 1-8+. Enables parallel Cursor tracks (D-S-04) starting Week 0, no per-wave brief-authoring bottleneck.

### D-S-06 — Pro mode on 375px mobile — **APPROVED 2026-09-06: tablet + desktop only (≥768px)**

Pro variants (AGT-DSH-002, AGT-LST-002, and all D3 focused-domain Pro screens) render only on viewports ≥768px. Mobile stays Guided. Briefs must state this breakpoint explicitly.

### D-S-07 — Blue Door channel verification — **APPROVED 2026-09-06: remove for now**

Blue Door removed from AGT-INB-005 source badge list and from PORTAL_LIST_RESEARCH Phase-2 lineup. Reintroduce if user reconfirms it as a real integrated Lebanese channel with a verified URL + inbound mechanism.

### D-S-08 — Cross-matrix build sequencing — ANSWERED (Rev 4)

Question was: run independent-audit passes on Agency + PA matrices before finalizing Phase-2 sequencing?

**Answered by user action** — audits #2 (Agent) and #3 (cross-matrix Shared × Agent × Agency) both delivered. Cross-matrix audit surfaced two deadlock cycles (WF-02, WF-31) and five previously-undeclared Agency-side blockers, all now absorbed into Rev-4 slate.

**Still pending:** PA-matrix audit (fourth pass). AGT-REC-002, 003, 005 remain in Phase 2 blocked on unverified PA screens. If PA audit gets run, its findings may pull additional PA-* screens into Phase 1 similar to how audit #3 pulled AGN-* screens in.

### D-S-10 — Adopt Week 0..8+ cluster dispatch — **APPROVED 2026-09-06**

User locked the Week 0..8+ workflow-cluster dispatch model documented in §6. Cross-matrix workflows ship both sides in the same week. Cursor prompts are authored per Week/cluster, not per persona.

### D-S-09 — Agent-matrix backend-prerequisite discipline retrofit — **APPROVED 2026-09-06: yes**

One dedicated session to retrofit `SCREEN_MATRIX_AGENT.md` with explicit backend-prerequisite rows on the ~15 most-complex flows (AGT-PUB, AGT-AI, AGT-CMP, AGT-VLA, AGT-CTC-007 relationships editor, etc.), following the AGN-REP data-pipeline-spike + AGN-AUD "do NOT build frontend until endpoint exists" pattern. Ships before Wave-3 dispatch to prevent frontend built on missing backend fields.

---

## 10. Immediate next step

Once D-S-01 through D-S-05 are answered:

1. **I author the Wave 1 briefs** — SHR-NAV-001..005 anchor + SHR-AUT-001 (already exists, just reviewed for delta) + supporting brief refinements.
2. **You run v0 on SHR-NAV-001 and SHR-AUT-001** to get the visual anchors nailed.
3. **I draft the Wave 1 Cursor prompt** — `CURSOR_SCREEN_WAVE_1_FOUNDATIONS.md`.
4. **You dispatch to Cursor.** PR opens against the product repo (`cyber-entrepreneur/wingcaster`), architect-owner review, merge.
5. **Rinse for Wave 2** in parallel with Wave 1's review cycle.

---

## 11. Explicitly out of scope

- Every PA screen (Phase 2).
- Every Agency multi-tenant screen (Phase 2).
- Every Phase-2 domain — pricing analytics, calendar, campaigns, complaints, help, changelog.
- Marketing website (`wingcaster-www` — separate workstream).
- Backend endpoint additions (this workstream consumes what's on main).
- Broadcast design system changes (tokens locked from PR #41).
- Real Arabic content for screen copy — same rule as marketing: MENA copywriter pass in a separate PR per screen batch.

---

## 11a. Priority insertion — PA-PKG-* pulled into Phase 1 (2026-09-06)

**Trigger:** the marketing site's pricing tiers must be PA-editable, not static. That requires PA-PKG-001..004 (list, edit, approve, history) to ship before the marketing site can go fully live. Pulled forward from Phase-2 backlog.

**Sequencing insertion:** slot PA-PKG-* as **Wave 3.5** (between Dashboard and Onboarding). Fits naturally because:
- Backend dependency is `CURSOR_PACKAGES_MARKETING_FIELDS.md` — independent of B1/B2/AGT-* work.
- Frontend uses the same Broadcast + Arabic + role-guard patterns as the other admin surfaces already on main.
- Effort estimate: ~5 days Cursor + review. Adds one wave to the Phase-1 calendar (now 7 waves, ~5-7 weeks vs original 6 waves / 4-6 weeks).

**Cursor prompt:** [docs/prompts/CURSOR_PA_PACKAGE_EDIT_UI.md](../prompts/CURSOR_PA_PACKAGE_EDIT_UI.md) — dispatchable after the backend companion (`CURSOR_PACKAGES_MARKETING_FIELDS.md`) and the marketing-site companion (`CURSOR_WWW_PRICING_FROM_API.md`) both merge.

## 12. Backlog beyond Phase 1 (Phase 2+ preview)

Not scoped here, but shape:

- **Phase 2 (~6-10 weeks):** Agency multi-agent screens (AGN-*), Agent CRM (AGT-CRM-*), pricing analytics, campaigns, remaining agent onboarding polish, agent notification preferences.
- **Phase 3 (~4-6 weeks):** PA screens (PA-*), platform admin surface, ops dashboards.
- **Phase 4:** Everything else — obscure config, edge-case flows, admin tools that don't have daily-active users.

Total 320-screen implementation: realistic estimate ~4-6 months from Phase 1 kickoff, assuming this cadence holds.
