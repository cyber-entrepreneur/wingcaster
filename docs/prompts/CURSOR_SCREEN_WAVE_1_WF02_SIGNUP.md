# Cursor dispatch — Screen Matrix Wave 1: Signup + WF-02 Join-Agency cluster

**PR title:** `feat(screen-wave-1): SHR-AUT-006 signup 6-identity-path + WF-02 join-agency cluster (both sides)`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~5-7 days with parallel agents; ~10-12 days serial

**Rev 1 — 2026-09-08**

**Depends on:**
- **Wave 0 (PR #52 branding + PR #53 nav-chrome) merged.** Wave 1 screens render inside Wave 0's shell components (`AgentAppShell`, `AgencyAppShell`, `<TenantSwitcher>`, `<LanguageSelector>`). Do NOT dispatch Wave 1 until Wave 0 shells are on `main`.
- **Wave 0.5 backend prereqs merged.** Specifically `[BE-BLOCKER-05]` agency free-tier package seed, `[BE-BLOCKER-06]` agency application route rename + schema uplift, `[BE-BLOCKER-07]` agency_invitations table + endpoints, `[BE-BLOCKER-08]` agencies.accepting_applications flag, `[BE-BLOCKER-09]` agency_applications.expires_at + auto-expire cron.

**Screen Matrix workstream context:** Week 1 of the workflow-cluster dispatch model. Resolves the WF-02 join-agency **deadlock cycle** (agent applies to agency, agency reviews, agent sees outcome). See [SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md](../design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) §6 Week 1.

---

## 1. Why this dispatch

Two of the three signup paths (path (b) join-an-agency, path (c) register-as-agency-owner) currently hit dead ends because the applications-review + application-outcome infrastructure doesn't exist. This dispatch ships **all 5 screens as one PR pair** so no half-built loop leaks into production.

**Deadlock resolution:** an agent registers via SHR-AUT-006 path (b) → applies to a specific agency via AGN-MEM-005 → agency reviews via AGN-MEM-002/002b → agent sees outcome via AGT-REC-004. **Every arrow ships together or nothing ships.**

## 2. Read these files FIRST

Every brief for this wave is on disk. Read each in full and follow its contract exactly — copy tables, component palette, state variants, downstream implementation notes.

**Wave 1 briefs (5):**
1. [`docs/design/briefs/SHR-AUT-006-signup-brief.md`](../design/briefs/SHR-AUT-006-signup-brief.md) — Signup 3-path × 6-identity anchor
2. [`docs/design/briefs/AGN-MEM-005-public-join-apply-brief.md`](../design/briefs/AGN-MEM-005-public-join-apply-brief.md) — Public join / apply page anchor
3. [`docs/design/briefs/AGN-MEM-002-applications-queue-brief.md`](../design/briefs/AGN-MEM-002-applications-queue-brief.md) — Applications queue anchor (PA-queue-family sibling)
4. [`docs/design/briefs/AGN-MEM-002b-application-detail-brief.md`](../design/briefs/AGN-MEM-002b-application-detail-brief.md) — Application detail delta
5. [`docs/design/briefs/AGT-REC-004-application-outcome-brief.md`](../design/briefs/AGT-REC-004-application-outcome-brief.md) — Application outcome anchor (REC-family anchor)

**Shared references (mandatory):**
- [`docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md) — token contract
- [`docs/design/BACKEND_BLOCKER_INDEX.md`](../design/BACKEND_BLOCKER_INDEX.md) — verify Wave 0.5 items landed before starting

**Context (do NOT copy from):**
- [`docs/design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md`](../design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) §5 rows 6, 27-30 + §6 Week 1
- `web/src/pages/AgentRegisterPage.tsx` — the existing file the SHR-AUT-006 brief instructs to refactor + rename to `RegisterPage.tsx`

## 3. Parallelization directive

Spawn parallel background agents per Cursor's agent-mode / Composer-background-task capability. Every agent works on a disjoint file set. See §5 coordination table.

**Phase A — spawn concurrently (5 agents):**

1. **SHR-AUT-006 signup agent** — refactor `web/src/pages/AgentRegisterPage.tsx` → `web/src/pages/RegisterPage.tsx` per brief. Build sub-components: `<PathSelector>`, `<OAuthTrio>`, `<IdentityForm>` (extracted as shared primitive under `web/src/components/auth/IdentityForm.tsx` — reused by AGN-MEM-005 guest-signup collapsible per that brief's cross-brief dependency note), `<PathBFields>`, `<PathCFields>`, `<HeroPanel>`, `<TrustFooter>`. Route: `/register` with query params `?path=solo|join|agency` + `?agency=<slug>` + `?plan=<tier>`. Touches only `pages/RegisterPage.tsx` + `components/auth/*`.

2. **AGN-MEM-005 public-apply agent** — build `web/src/pages/PublicAgencyApplyPage.tsx`. Extract `<AgencyIdentityCard>` and `<PersonaChip>` as shared primitives under `web/src/components/agency/` (both flagged for reuse on SHR-PUB-003, AGN-DSH-001 attention cards, etc.). Delegates to `<IdentityForm>` from Agent 1's shared extraction. Route: `/agencies/:agencySlug/apply` + `/join/:invitationCode`. Touches only `pages/PublicAgencyApplyPage.tsx` + `components/agency/AgencyIdentityCard.tsx` + `components/agency/PersonaChip.tsx`.

3. **AGN-MEM-002/002b applications queue+detail agent** — build `web/src/pages/agency/ApplicationsQueuePage.tsx` + `web/src/pages/agency/ApplicationDetailPage.tsx`. Uses the PA-queue-family primitives from Wave 6 briefs (`<PAQueueFilterStrip>`, `<PAQueueTable>`, `<PAQueueKeyboardShortcutsPanel>` — extract preemptively under `web/src/components/queue/` if PA-MOD isn't shipped yet). Note this is the FIRST agency-side surface using the PA-queue-family pattern; extract carefully so PA-MOD-001 can import verbatim later. Touches `pages/agency/Applications*.tsx` + `components/queue/*`.

4. **AGT-REC-004 application-outcome agent** — build `web/src/pages/agent/ApplicationOutcomePage.tsx`. Extracts the REC-family anchor primitives — `<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>` — under `web/src/components/recipient/`. Every future AGT-REC-* screen imports these verbatim. Route: `/applications/:applicationId` (query alias per brief: `/inbox/applications/:applicationId`). Touches `pages/agent/Application*.tsx` + `components/recipient/*`.

5. **WF-02 notification hook agent** — piggybacks on existing push infrastructure (WF-01 + WF-03 already established the dispatcher). Adds ONE new template row: `agency_application.resolved` with 3 variants (approved/rejected/expired). Deep-link scheme: `/applications/:applicationId`. Emits at status-transition transaction in the WF-02 approve/reject/expire code paths (post-Wave-0.5 [BE-BLOCKER-06] refactor). Touches only `backend/src/lib/notifications/templates.js` (or wherever templates live) + WF-02 workflow-state-machine hook.

**Phase B — sequential AFTER Phase A merges (or agents 1-5 report ready):**

6. **WF-02 integration + cross-loop test agent** — end-to-end test: register via path (b) → apply → agency reviews → decision → outcome screen. Real-Postgres test. Test both approval and rejection paths. Test EXPIRED state via clock-mock. Test invitation-code path. Touches only `test/` files.

7. **A11y + visual regression agent** — per-brief a11y checks (tap targets, focus rings, aria-live for status changes, focus traps). Chromatic snapshots across LTR/RTL × light/dark × mobile/tablet/desktop for all 5 screens. Touches only `test/` files.

**Coordination rules:**
- Every Phase-A agent works on a separate branch off `feat/screen-wave-1-wf02-signup`.
- Merge order: Agent 5 (notification template) first (no UI dependencies) → Agent 4 (REC-family anchor primitives — needed by others) → Agents 1, 2, 3 in any order (disjoint file sets).
- Every agent reads its brief BEFORE writing code.
- If any agent produces exports that conflict with another (e.g. differing `Tenant` type definitions), coordinator reconciles before Phase B.
- Extract shared components UP FRONT (not inline in screens) — future waves depend on them existing as importable primitives.

## 4. Non-negotiables

1. **Every brief followed to the letter.** Copy tables, component palette, state variants, DoD checklists.
2. **Shared component extraction is MANDATORY** — `<IdentityForm>`, `<StatusHero>` family, `<AgencyIdentityCard>`, `<PersonaChip>`, `<PortalStatusPill>`-style queue-family primitives. Future waves will re-import them verbatim.
3. **`no-raw-hex.test.ts` green.** Every color is a `--lc-*` token.
4. **RTL verified on all 5 screens** — every screen supports LTR + RTL.
5. **Dark mode + light mode** on every screen.
6. **44px tap-target floor on mobile.**
7. **Every popover / dialog / sheet has focus trap + Escape.**
8. **Cross-loop test** (Phase B agent 6) proves the deadlock is genuinely resolved — approve action on AGN-MEM-002b results in visible outcome on AGT-REC-004.
9. **Zero touches to Wave 0 files** (`components/nav/*`, `app/AppShell*.tsx`, etc.).
10. **PR body must include screenshots** of ~15 state variants + Vercel preview link + cross-loop test log.

## 5. Coordination table

| # | Agent | Branch | Owns | Depends on | Est. days |
|---|---|---|---|---|---|
| 1 | Signup | `feat/wave-1-signup` | `pages/RegisterPage.tsx` + `components/auth/*` | Wave 0.5 [BE-BLOCKER-05] merged | 2-3 |
| 2 | Public apply | `feat/wave-1-agency-apply` | `pages/PublicAgencyApplyPage.tsx` + `components/agency/*` | Wave 0.5 [BE-BLOCKER-06/07/08] merged + Agent 1's `<IdentityForm>` extracted | 1-2 |
| 3 | Applications queue+detail | `feat/wave-1-applications` | `pages/agency/Applications*.tsx` + `components/queue/*` | Wave 0.5 [BE-BLOCKER-06] merged | 2-3 |
| 4 | Application outcome | `feat/wave-1-outcome` | `pages/agent/Application*.tsx` + `components/recipient/*` | Wave 0.5 [BE-BLOCKER-06/09] merged | 1-2 |
| 5 | Notification template | `feat/wave-1-wf02-notification` | template row + hook | Wave 0.5 [BE-BLOCKER-06] merged | 0.5 |
| 6 | Integration test | `feat/wave-1-e2e` | test file only | Agents 1-5 merged | 1 |
| 7 | A11y + visual | `feat/wave-1-quality` | test files only | Agents 1-5 merged | 1 |

## 6. Test discipline

**Unit** (per component): copy strings match brief, state variants render, RTL flips, error paths surfaced.
**Integration** (per screen): API contract matches brief §Backend contract.
**End-to-end** (Phase B Agent 6): full deadlock-resolution test — registration path (b) → application → agency review → outcome view. Both approval and rejection paths. Both invitation-code and slug-search paths. EXPIRED state via clock-mock.
**A11y**: 44px tap floor, focus rings, aria-live for state changes, focus traps in modals + sheets.
**Visual**: ~15 Chromatic snapshots across LTR/RTL × light/dark × mobile/tablet/desktop.
**Real-Postgres**: application lifecycle from creation → resolution end-to-end.

## 7. Definition of done

1. All 5 Wave-1 screens land under one PR pair (frontend PR + integration/quality PR).
2. Shared components (`<IdentityForm>`, REC-family anchors, `<AgencyIdentityCard>`, `<PersonaChip>`, queue-family primitives) extracted + importable by name.
3. Cross-loop test proves both directions of the WF-02 deadlock are resolved.
4. `no-raw-hex.test.ts` + fast + integration + a11y + Real-Postgres CI green.
5. Vercel preview attached; screenshots of 15 state variants in PR body.
6. RTL verified visually on preview.
7. Kickoff §5a updated: mark [BE-BLOCKER-06/07/08/09] as **UI-CONSUMED** (backend items had already merged in Wave 0.5).

## 8. Follow-ups (do NOT include in this PR pair)

- **SHR-AUT-002 sign-in-with-OTP** — separate screen; not part of Wave 1 scope.
- **Agent browse-agencies-accepting-applications directory** — flagged in AGN-MEM-005 brief as Phase-2 enhancement.
- **Agency-side "Reopen application" action** — Phase 2 (v1 is one-shot per applicant per agency).
- **Applicant-agency messaging thread** — piggybacks on AGT-INB but scoped as Phase 2 enhancement (v1 uses `<ResolverMessage>` one-way).

## 9. Out of scope

- Anything in Wave 0's file surface (nav/chrome/shell/env-switcher).
- Any Wave 2+ screen.
- Backend prereqs — all live in Wave 0.5 or the standalone Week-1 backend dispatch.
- Marketing site pricing (separate Prompt-2 track).
- Bulk application actions — deferred to Phase 2 per AGN-MEM-002 brief §anti-patterns.
- Multi-language application content (Arabic-first application form ships English + [TRANSLATION-PENDING] AR mirror per standard MENA copywriter pass).
