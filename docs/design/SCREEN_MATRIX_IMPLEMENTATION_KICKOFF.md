# Screen Matrix — Implementation Workstream Kickoff

**Author:** Architect-owner
**Created:** 2026-09-05
**Status:** DRAFT — awaiting user pick on Phase-1 priority slate (§5).

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

## 5. Proposed Phase-1 slate — 12 screens, ~4-6 weeks

**Rationale:** these unblock the agent signup + first-listing funnel end-to-end, prove the pipeline across 3 personas, and cover 3 major domains (auth, onboarding, listing) that gate everything else.

| # | Screen ID | Persona | Domain | Why in Phase 1 | Backend ready? |
|---|---|---|---|---|---|
| 1 | **SHR-AUT-001** Login (mobile + desktop) | Shared | Auth | Brief done. Every user's first interaction. | ✅ merged |
| 2 | **SHR-AUT-002** Signup — 6 identity paths | Shared | Auth | Gates every new user. Free-trial dedup lands here. | ⏳ B2 blocks (Free-trial dedup Cursor prompt drafted; needs merge) |
| 3 | **SHR-MFA-001-007** MFA enrollment + step-up | Shared | Auth | Signup + delete-account + billing operations depend on step-up. | ✅ merged (auth-2fa.js) |
| 4 | **AGT-ONB-001..005** Agent onboarding | Agent | Onboarding | The "aha moment" — first-listing via WhatsApp intake. | ⏳ B1 blocks (WhatsApp binding Cursor prompt drafted) |
| 5 | **AGT-DSH-001** Dashboard mobile Guided | Agent | Dashboard | Brief done. Every daily-active agent lands here. | ✅ merged (dashboard endpoint) |
| 6 | **AGT-DSH-002** Dashboard mobile Pro | Agent | Dashboard | Toggle variant of DSH-001. Cheap to add. | ✅ same endpoint |
| 7 | **AGT-LST-001** Listing list mobile | Agent | Listing management | Second-most-frequent screen after dashboard. | ✅ merged |
| 8 | **AGT-LST-003** Listing detail mobile Guided | Agent | Listing management | Brief done. Every publish / price-change flows through here. | ✅ merged |
| 9 | **AGT-LST-004** Manual listing composer | Agent | Listing management | Fallback path when WhatsApp intake isn't used. | ✅ merged |
| 10 | **AGT-WLB-001..005** WhatsApp intake tour screens | Agent | Listing management | Bridge between AGT-ONB and the running WhatsApp flow. | ⏳ B1 blocks |
| 11 | **AGT-INB-001..002** Unified inbox list + thread | Agent | Communication | The "Catch" in Capture · Cast · **Catch** · Convert. Highest-frequency return-visit screen. | ✅ merged (conversation module) |
| 12 | **SHR-NAV-001..005** Global nav + mobile tab bar | Shared | Navigation | Every screen depends on this. | ✅ no backend needed |

**Excluded from Phase 1 (deliberately):**
- Every PA screen — internal-only, low daily-active count, deferred to Phase 2.
- Every Agency-admin-specific screen — Phase 1 focuses on the agent path; agency screens are Phase 2.
- Pricing, analytics, reporting, calendar, campaigns, complaints, all AGN-* multi-tenant screens.
- Delete-account and other high-risk-low-frequency screens (brief done for SHR-SET-005 but the actual implementation waits for Phase 2).
- Every "index" or "settings" or "help" screen — Phase 2.

---

## 6. Phase-1 sequencing — 6 waves, ~1 wave per week

Aligns Cursor throughput (roughly one PR of this size per Cursor conversation per few days) with the anchor → supporting cascade.

### Wave 1 — Foundations (SHR-NAV, SHR-AUT-001)
- SHR-NAV-001..005 (nav + mobile tab bar) — one PR. Unblocks every subsequent screen visually.
- SHR-AUT-001 (login) — one PR. Brief already exists.

### Wave 2 — Signup + MFA (SHR-AUT-002, SHR-MFA-*)
- Depends on B2 (free-trial dedup) being merged.
- Signup 6 identity paths — one PR (large, but internally cohesive).
- MFA enrollment + step-up screens — one PR (7 screens, all thematic siblings).

### Wave 3 — Agent dashboard (AGT-DSH-001, AGT-DSH-002)
- Brief for DSH-001 already done. DSH-002 (Pro variant) is a delta on DSH-001.
- One PR covering both. Design AI iteration on DSH-001 first (highest impact).

### Wave 4 — Agent onboarding (AGT-ONB-001..005 + AGT-WLB-001..005)
- Depends on B1 (WhatsApp intake provisioning) being merged.
- ONB + WLB bundled — they're the same funnel from the user's perspective. Two PRs (ONB then WLB) or one big PR — Cursor's call at dispatch time.

### Wave 5 — Listing surface (AGT-LST-001, AGT-LST-003, AGT-LST-004)
- LST-003 brief done. LST-001 and LST-004 need briefs first (Phase A).
- Three PRs (or one bundled). Highest-frequency screens after dashboard.

### Wave 6 — Inbox (AGT-INB-001..002)
- Anchor for the "Catch" narrative.
- Brief needed first. One PR.

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

### D-S-01 — Confirm the Phase-1 slate

Approve §5's 12-screen list, OR swap items. Recommendation: as-is.

### D-S-02 — Confirm the wave sequencing

Approve §6's 6-wave order, OR reorder. Recommendation: as-is. Wave 2 depends on B2 shipping; Wave 4 depends on B1 shipping. If B1/B2 delay, Wave 3 (dashboard) or Wave 5 (listing) can jump the queue.

### D-S-03 — Design AI tool for the product side

Same three options as marketing (D-M-06):
- **(a) v0 by Vercel** — same tool as marketing. Consistency + skill reuse.
- **(b) Framer AI** — richer visual polish but harder Cursor handoff.
- **(c) Manual Figma + freelance designer** — highest quality, slowest.

**Recommendation:** (a) v0. Same reason as marketing.

### D-S-04 — Parallel Cursor tracks

Can we run 2-3 Cursor conversations in parallel on different waves, or serial only? Backend cycle proved parallel is safe; frontend has different collision risks (shared components, shared theme, shared state).

**Recommendation:** parallel for different domains (e.g., Wave 3 Dashboard + Wave 6 Inbox concurrently since they touch different subtrees). Serial within a domain (Wave 4 ONB then Wave 4 WLB).

### D-S-05 — Anchor briefs before Wave 1 or interleaved?

- **(a) Author all 10 remaining Phase-1 briefs upfront**, then start dispatching Cursor. Predictable but delays Cursor start by ~2-3 sessions.
- **(b) Interleave** — author each wave's briefs, dispatch that wave, author next wave's briefs while Cursor works. Faster to start; briefs might drift from what earlier waves reveal.

**Recommendation:** (b) interleave. Learn from Wave 1 before writing Wave 6 briefs.

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

## 12. Backlog beyond Phase 1 (Phase 2+ preview)

Not scoped here, but shape:

- **Phase 2 (~6-10 weeks):** Agency multi-agent screens (AGN-*), Agent CRM (AGT-CRM-*), pricing analytics, campaigns, remaining agent onboarding polish, agent notification preferences.
- **Phase 3 (~4-6 weeks):** PA screens (PA-*), platform admin surface, ops dashboards.
- **Phase 4:** Everything else — obscure config, edge-case flows, admin tools that don't have daily-active users.

Total 320-screen implementation: realistic estimate ~4-6 months from Phase 1 kickoff, assuming this cadence holds.
