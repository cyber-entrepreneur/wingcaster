# Cursor dispatch — Backend Week 6: WF-20 unified execute + PA-PKG + PA-POR bundle

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`
**Estimated effort:** ~7-9 days with parallel agents; ~13-16 days serial
**Rev 1 — 2026-09-08**

**Depends on:** Wave 0.5 [BE-DESIGN-01] portal_registry merged. Prompt 1 packages-marketing-fields (PR #51) merged.

**Unblocks:** Wave 6 (Two-person UI + PA-PKG + PA-POR).

---

## 1. Scope

4 items per [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md) §3:

- **[BE-BLOCKER-32]** PA-PKG backend prereqs (7 items — ~6 days)
- **[BE-BLOCKER-33]** PA-APR-005/006 backend routes (2 days)
- **[BE-BLOCKER-34]** Unified `/execute` endpoint + 7 supporting tickets (~3-4 days)
- **[BE-BLOCKER-35]** `portal_registry` schema extensions + state tables (2-3 days)

## 2. Parallelization directive

Spawn 4 concurrent backend agents.

**Agent 1 — BE-BLOCKER-34 (WF-20 unified /execute):** new `POST /api/admin/approvals/:id/execute` at `backend/src/fin/admin/routes.js`, consolidating the two stubs currently at lines 282-288 (`/approve` + `/reject` returning `notImplemented('DL-166')`). Supporting: type-to-confirm phrase generation (Diceware 4-word), value-tier evaluation (standard / elevated / high_value gate), risk-signals aggregation, ledger-impact preview, self-approval rejection (server 403), idempotency (idempotency-key header), audit-write. **Type-to-confirm ONLY high_value** — anti-pattern to over-apply per [[pa-queue-family-invariants]]. Branch: `feat/be-wf20-execute-unified`.

**Agent 2 — BE-BLOCKER-33 (WF-20 escalate + withdraw):** `POST /:id/escalate` (body: `{targetUserId, rationale, notify_channels[]}`) + `POST /:id/withdraw` (body: `{reason}`) + `GET /:id/eligible-escalation-targets`. Migration adds `WITHDRAWN` enum + `escalated_to_user_id` + `escalation_rationale` columns to `fin.approval_requests`. Branch: `feat/be-wf20-escalate-withdraw`.

**Agent 3 — BE-BLOCKER-32 (PA-PKG 7-item bundle):** env-scoped catalog audit + feature-registry live fetch audit + own-submission detection on package versions + undo-reject endpoint (5-second grace) + marketing revalidation confirm ping/SSE (non-blocking with client fallback) + cross-env clone helper for TEST seeding (Phase-1 add-on) + submitter-only recall endpoint + arbitrary-version diff endpoint. Branch: `feat/be-pa-pkg-bundle`.

**Agent 4 — BE-BLOCKER-35 (portal_registry extensions + state tables):** extend `portal_registry` with `description`, `logo_url`, `primary_language`, `validator_ref`, `effective_from`, `deprecated_at`. New tables `portal_registry_pending_activations` (server-side gate state machine for is_active flips) + `portal_activation_history` (per PA-POR-003 timeline). Branch: `feat/be-portal-registry-extensions`.

## 3. Non-negotiables

1. **Type-to-confirm tiered** — only high_value. Never over-apply.
2. **Self-approval rejection at server** — submitter cannot execute their own request; 403 with descriptive error.
3. **Idempotency** via `Idempotency-Key` header on `/execute` — retries safe.
4. **`portal_registry` `is_active=true` flip requires state-machine check** — adapter + validator files must exist per BE-BLOCKER-35 state table.
5. **Undo-reject 5-second grace** — server accepts undo within 5 seconds of reject; after that, hard-committed.
6. Kickoff RESOLVED markers.

## 4. Definition of done

- All 4 branches merged.
- Kickoff marks [BE-BLOCKER-32/33/34/35] RESOLVED.
- Real-Postgres CI green.
- Ping user → dispatches Wave 6.
