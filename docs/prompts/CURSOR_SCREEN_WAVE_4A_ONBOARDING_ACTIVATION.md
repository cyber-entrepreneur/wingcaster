# Cursor dispatch — Screen Matrix Wave 4A: Agent Activation Funnel

**PR title:** `feat(screen-wave-4a): agent activation funnel — AGT-ONB + AGT-WLB + AGT-ACT (15 screens)`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~8-10 days with parallel agents; ~15-18 days serial

**Rev 1 — 2026-09-08**

**Depends on:**
- **Wave 0, Wave 1, Wave 2 merged.** Agent shell, signup routing, first-listing surfaces exist.
- **Wave 0.5 backend prereqs merged.** Specifically `[BE-BLOCKER-04]` source_channel decomposition (for AGT-ONB-004 celebration screen references) + `[BE-BLOCKER-20]` agent_onboarding_state table.
- **Shared Components Prep merged.** Onboarding family + WhatsApp intake tour family primitives.
- **Week 4 backend bundle merged:**
  - `[BE-BLOCKER-13]` SSE for AGT-WLB-004 real-time draft streaming (or polling fallback if capacity tight)
  - `[BE-BLOCKER-14]` inbound-message poll for AGT-WLB-003
  - `[BE-BLOCKER-15]` onboarding events schema + endpoints
  - `[BE-BLOCKER-16]` `GET /activation-code` idempotency check
  - `[BE-VERIFY-02]` AGT-ONB backend hooks work with PR #50 WhatsApp binding

**Screen Matrix workstream context:** Week 4 of the workflow-cluster dispatch model — the activation funnel. Parallel to **Wave 4B** (MFA + Settings shell).

---

## 1. Why this dispatch

Empty dashboards on day 1 kill activation. AGT-ONB (freeform onboarding) + AGT-ACT (structured activation wizard) + AGT-WLB (WhatsApp intake tour) form the three-tier activation surface: the wizard for structured commitment, the freeform hints for exploration, the WhatsApp tour for the "aha moment" first listing.

**All 15 screens ship together** because they share the `agent_onboarding_state` backend contract + several shared components + the "auto-complete a step from any surface" rule.

## 2. Read these files FIRST

**Wave 4A briefs (15):**
- AGT-ONB-001..005 (5 files under `docs/design/briefs/`)
- AGT-WLB-001..005 (5 files)
- AGT-ACT-001..005 (5 files)

**Anchors that establish the family patterns:**
- [`AGT-ONB-001-onboarding-welcome-brief.md`](../design/briefs/AGT-ONB-001-onboarding-welcome-brief.md) — onboarding family anchor
- [`AGT-WLB-002-activation-code-brief.md`](../design/briefs/AGT-WLB-002-activation-code-brief.md) — WhatsApp handshake anchor
- [`AGT-WLB-004-listing-drafting-brief.md`](../design/briefs/AGT-WLB-004-listing-drafting-brief.md) — live draft canvas anchor (streaming)
- [`AGT-ACT-001-activation-welcome-brief.md`](../design/briefs/AGT-ACT-001-activation-welcome-brief.md) — activation wizard anchor

**Shared references:**
- [`BROADCAST_ALIGNMENT_REFERENCE.md`](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md)
- [`docs/design/BACKEND_BLOCKER_INDEX.md`](../design/BACKEND_BLOCKER_INDEX.md)

## 3. Parallelization directive

**Phase A — spawn concurrently (4 agents):**

1. **AGT-ONB family agent** — build all 5 AGT-ONB screens under `web/src/pages/agent/onboarding/`. Uses `<OnboardingProgressMarker>`, `<IntakePathCard>`, `<OnboardingChecklistCard>` + family from Shared Prep. AGT-ONB-005 is a **first-class dashboard widget** mounted on AGT-DSH-001 Zone 3 conditionally (NOT a standalone route — see AGT-ONB-005 brief §Component vs Route). Touches only `pages/agent/onboarding/` + a small AGT-DSH-001 update to mount AGT-ONB-005.

2. **AGT-WLB family agent** — build all 5 AGT-WLB screens under `web/src/pages/agent/whatsapp-intake/`. Uses `<TourFrame>`, `<StepHero>`, `<WhatsAppHandshakePanel>`, `<LiveDraftCanvas>` + family from Shared Prep. `<LiveDraftCanvas>` supports SSE/polling/fallback modes — implement all three, feature-flag per [BE-BLOCKER-13] state. Touches only `pages/agent/whatsapp-intake/`.

3. **AGT-ACT family agent** — build all 5 AGT-ACT screens under `web/src/pages/agent/activation/`. Wizard uses shared `activation_state.steps[]` backend contract (per [BE-BLOCKER-15]). Auto-complete a step from any source — never re-ask, never surveillance-banner. AGT-ACT-004 (portal credentials) has soft dependency on Wave 2 [BE-DESIGN-01] portal_registry; render as Locked variant with helper "Available soon" if registry empty. Touches only `pages/agent/activation/`.

4. **Cross-family state hook agent** — build `useOnboardingState()` SWR hook under `web/src/hooks/`. Consumed by all 15 screens + AGT-DSH-001. Contract per AGT-ONB-001 §Backend contract. Handles auto-complete resolution (checks whether a step was completed via a different surface). Touches only `hooks/useOnboardingState.ts` + a wrapper stub in `components/onboarding/` if not already extracted from Shared Prep.

**Phase B — sequential AFTER Phase A merges:**

5. **AGT-DSH-001 mount agent** — small update to mount `<OnboardingChecklistCard>` in Zone 3 conditionally. Touches only `pages/agent/DashboardPage.tsx`.

6. **Cross-funnel integration test** — end-to-end: new agent signs up → lands on AGT-ONB-001 → picks a path → follows either AGT-WLB (WhatsApp) or AGT-ACT (wizard) → first listing published → AGT-ONB-004 celebration → AGT-ONB-005 checklist on dashboard reflects progress. Test auto-complete rule (completing step via AGT-ACT auto-marks corresponding AGT-ONB step + vice versa).

7. **A11y + Chromatic agent** — per-brief a11y + snapshots. Extra attention on AGT-WLB-004 streaming states (progress announcement) and AGT-ONB-005 dashboard-embedded mode.

## 4. Non-negotiables

1. **Every brief followed exactly.**
2. **AGT-ONB-005 is a widget, not a route** — mount on AGT-DSH-001; supports full-screen + collapsed variants per Pro mode.
3. **Auto-complete rule enforced across all three families** — completing a step via any surface marks it Complete everywhere. Never re-ask; never surveillance-banner (subdued `Completed via {source}` caption only).
4. **`<LiveDraftCanvas>` graceful degradation** — SSE preferred, polling acceptable, determinate spinner fallback if neither available.
5. **AGT-ACT-004 renders Locked if portal_registry empty** — do not block Week 4 dispatch on Wave 2 having landed [BE-DESIGN-01]/[BE-BLOCKER-01].
6. **`no-raw-hex.test.ts` green + RTL + dark + a11y.**
7. **`activation_state.steps[]` contract shared across all three families.**
8. **Zero touches to Wave 0/1/2/3/Shared Prep files.**

## 5. Coordination table

| # | Agent | Branch | Owns | Est. days |
|---|---|---|---|---|
| 1 | AGT-ONB | `feat/wave-4a-onb` | `pages/agent/onboarding/` + AGT-DSH-001 checklist mount | 3-4 |
| 2 | AGT-WLB | `feat/wave-4a-wlb` | `pages/agent/whatsapp-intake/` | 3-4 |
| 3 | AGT-ACT | `feat/wave-4a-act` | `pages/agent/activation/` | 3-4 |
| 4 | State hook | `feat/wave-4a-state-hook` | `hooks/useOnboardingState.ts` | 1 |
| 5 | Dashboard mount | `feat/wave-4a-dsh-mount` | AGT-DSH-001 update | 0.5 |
| 6 | Integration test | `feat/wave-4a-e2e` | test file | 1-2 |
| 7 | A11y + visual | `feat/wave-4a-quality` | test files | 1 |

## 6. Definition of done

1. All 15 screens + hook + dashboard mount land.
2. Auto-complete rule proved via integration test.
3. Streaming graceful degradation verified.
4. Vercel preview shows all 15 screens working.
5. CI + Chromatic green.
6. Blocker index: mark [BE-BLOCKER-04/13/14/15/16/20] + [BE-VERIFY-02] as **UI-CONSUMED**.

## 7. Out of scope

- Wave 4B (MFA + Settings shell).
- Any Wave 5+ screen.
- Backend prereqs.
