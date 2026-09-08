# Cursor dispatch — Backend Week 3: WF-04 account-recovery bundle (SECURITY-CRITICAL)

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`
**Estimated effort:** ~10-12 days with parallel agents; ~18-22 days serial
**Rev 1 — 2026-09-08**

**Depends on:** Wave 0.5 [BE-BLOCKER-19] scheduled-deletion public endpoints (merged).

**Unblocks:** Wave 3 (WF-04 account-recovery cluster).

**⚠️ SECURITY-CRITICAL:** [BE-BLOCKER-22] fixes an existing two-person-rule bypass. Must land before PA-ACR-002 UI ships or the UI exposes a security downgrade to admins.

---

## 1. Scope

2 items per [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md) §3:

- **[BE-BLOCKER-22]** ⚠️ Refactor `POST /:caseId/approve` at `backend/src/server.js:7041` through cast-vote endpoint (1-2 days)
- **[BE-BLOCKER-21]** WF-04 account-recovery backend bundle (13 items — ~15-18 days)

## 2. Parallelization directive

**Agent 1 (SECURITY, dispatch FIRST) — BE-BLOCKER-22:** refactor `POST /api/admin/account-recovery/:caseId/approve` at `backend/src/server.js:7041`. Currently executes on single admin action — BYPASS of two-person rule. New shape: replace approve/reject with cast-vote pattern via `fin.approval_requests`. First vote records vote; second vote (from different admin) commits the recovery execution. Rollback test: attempting old direct-approve returns 410 Gone with migration guidance. Branch: `feat/be-acr-security-refactor`. **Merge before Agent 2 spawns to avoid touching the same file concurrently.**

**Agents 2-6 (after Agent 1 merged) — BE-BLOCKER-21 (13 items split into 5 agents):**

- **Agent 2** — list-response extension + single-case GET + reveal-audit endpoint (20/hr rate limit): endpoints for PA-ACR-001 queue + PA-ACR-002 detail. Branch: `feat/be-acr-endpoints-core`.
- **Agent 3** — evidence upload + storage + authenticated evidence-image proxy: file storage integration + signed URLs + access-audit on retrieval. Branch: `feat/be-acr-evidence`.
- **Agent 4** — account_value_tier derivation + env-scoping audit: business-logic classification for the two-person tier gate + env context propagation. Branch: `feat/be-acr-tier-env`.
- **Agent 5** — undo-approve endpoint + withdraw-vote + cancel-info-request + request-info endpoint: PA-ACR-002 additional actions. Branch: `feat/be-acr-actions`.
- **Agent 6** — masked/PII CSV export + two-person cast-vote + escalation wiring: reporting + cast-vote plumbing that Agent 1's refactor established. Branch: `feat/be-acr-export-vote`.

## 3. Migration allocation

Sequential from current highest at branch time.

## 4. Non-negotiables

1. **Agent 1 lands and is merged to main BEFORE Agents 2-6 start.** They import the cast-vote helper from Agent 1's refactor.
2. **PII CSV export requires elevated_token from SHR-MFA-007 step-up.**
3. **Evidence images NEVER served over unsigned URLs** — always authenticated proxy.
4. **Reveal-audit rate limit** is 20 reveals/hour/PA to prevent audit-log spam attacks.
5. **cast-vote self-approval rejection**: submitter cannot vote on their own case; server 403.
6. **Kickoff §5a RESOLVED markers** for both blockers.

## 5. Definition of done

- 6 branches merged sequentially (Agent 1 first, then 2-6 in any order).
- Kickoff marks [BE-BLOCKER-21/22] RESOLVED.
- Security-critical refactor verified: attempt to hit old `/approve` endpoint returns 410 Gone.
- Real-Postgres CI green.
- Ping user → dispatches Wave 3.
