# Cursor dispatch — Backend Week 4: AGT-ONB + AGT-WLB bundle

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`
**Estimated effort:** ~4-5 days with parallel agents; ~7-8 days serial
**Rev 1 — 2026-09-08**

**Depends on:** Wave 0.5 [BE-BLOCKER-04, 18, 20, 23] merged.

**Unblocks:** Wave 4A (AGT-ONB + AGT-WLB + AGT-ACT).

---

## 1. Scope

4 items per [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md) §3:

- **[BE-BLOCKER-13]** SSE / WebSocket for AGT-WLB-004 real-time draft streaming (2-3 days SSE, 0.5 day polling fallback)
- **[BE-BLOCKER-14]** Inbound-message poll endpoint for AGT-WLB-003 (0.5 day)
- **[BE-BLOCKER-15]** Onboarding events schema + endpoints (1 day)
- **[BE-BLOCKER-16]** `GET /activation-code` idempotency check (0.5 day)

Plus [BE-VERIFY-02]: confirm AGT-ONB backend hooks work with PR #50 WhatsApp binding (grep, cheap).

## 2. Parallelization directive

Spawn 4 concurrent backend agents.

**Agent 1 — BE-BLOCKER-13:** implement BOTH SSE endpoint (preferred) AND 3s-polling endpoint (fallback) for AGT-WLB-004 real-time draft streaming. Feature-flag which is served. Client-side degrades gracefully (SSE preferred, polling accepted, determinate spinner if neither). Branch: `feat/be-wlb-streaming`.

**Agent 2 — BE-BLOCKER-14:** `GET /intake/inbound-status/:bindingId` — returns whether a message has arrived post-activation. 3s poll. Branch: `feat/be-wlb-inbound-poll`.

**Agent 3 — BE-BLOCKER-15:** `onboarding_events` table + `POST /events` (record step-defer / step-complete / auto-complete) + `GET /state`. Cross-family — used by AGT-ONB + AGT-ACT (per Wave 4A brief `activation_state.steps[]` contract). Branch: `feat/be-onboarding-events`.

**Agent 4 — BE-BLOCKER-16:** `GET /activation-code` — returns the user's current active activation code if any, else generates. Prevents multiple codes floating around from repeat visits. Branch: `feat/be-activation-code-idempotency`.

## 3. Non-negotiables

1. SSE degrades to polling degrades to spinner — never crash the client.
2. `onboarding_events` schema matches the `activation_state.steps[]` shared contract from AGT-ACT/AGT-ONB briefs.
3. `GET /activation-code` idempotency prevents generating a new code when one exists — same code returned across visits.
4. Kickoff RESOLVED markers.

## 4. Definition of done

- All 4 branches merged.
- Kickoff marks [BE-BLOCKER-13/14/15/16] RESOLVED.
- Real-Postgres CI green.
- Ping user → dispatches Wave 4A.
