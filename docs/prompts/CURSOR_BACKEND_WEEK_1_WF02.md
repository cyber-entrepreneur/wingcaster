# Cursor dispatch — Backend Week 1: WF-02 agency-invitations bundle

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`
**Estimated effort:** ~3-4 days with parallel agents; ~7 days serial
**Rev 1 — 2026-09-08**

**Depends on:** Wave 0.5 [BE-BLOCKER-05] agency free-tier package seed (merged in #58 · 0856d3c).

**Unblocks:** Wave 1 (SHR-AUT-006 signup + WF-02 cluster).

---

## 1. Scope

4 blockers per [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md) §3:

- **[BE-BLOCKER-06]** Agency application route rename + schema uplift (1 day)
- **[BE-BLOCKER-07]** `agency_invitations` table + endpoints (1-1.5 days)
- **[BE-BLOCKER-08]** `agencies.accepting_applications` boolean (0.5 day)
- **[BE-BLOCKER-09]** `agency_applications.expires_at` + 30-day auto-expire cron (0.5 day)

## 2. Parallelization directive

Spawn 4 concurrent backend agents — one per blocker. All touch backend only (zero UI collision with Wave 0 or Wave 1 if dispatched together).

**Agent 1 — BE-BLOCKER-06:** rename `POST /api/agencies/apply` at `backend/src/server.js:7152` to `POST /api/agencies/:slug/applications`. Extend `agency_applications` schema with: `applicant_user_id`, `current_listings_count`, `portfolio_url`, `availability`, `referral_source`, `profile_share_consent`, `invitation_code`, `expected_response_by`. Migration + route + tests. Branch: `feat/be-agency-application-uplift`.

**Agent 2 — BE-BLOCKER-07:** new `agency_invitations` table (id, agency_id, code, created_by, expires_at, single_use bool, used_at, revoked_at) + `GET /api/invitations/:code` + `POST /api/invitations/:code/accept`. Migration + routes + tests. Branch: `feat/be-agency-invitations`.

**Agent 3 — BE-BLOCKER-08:** add `agencies.accepting_applications BOOLEAN NOT NULL DEFAULT true`. Migration + owner-toggle exposure on `PATCH /api/agencies/:id`. Tests. Branch: `feat/be-agencies-accepting-flag`.

**Agent 4 — BE-BLOCKER-09:** add `agency_applications.expires_at TIMESTAMPTZ`. Backfill = created_at + 30 days for existing rows. Daily cron in `backend/src/workers/` flipping pending → expired for rows past their expires_at. Migration + cron worker + tests. Branch: `feat/be-agency-app-expiry`.

## 3. Migration allocation

At branch time, `ls backend/src/persistence/migrations/ | tail -1`. Assign sequential integers (324+ if Wave 0.5's 323 is highest). Coordinator agent resolves any collision.

## 4. Non-negotiables

1. Idempotent migrations.
2. Real-Postgres tests for every route.
3. Zero touches to `web/` files.
4. Update [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md) marking each blocker RESOLVED with merge SHA.

## 5. Definition of done

- All 4 branches merged to `main`.
- Kickoff §5a marks [BE-BLOCKER-06/07/08/09] RESOLVED.
- Real-Postgres CI green on `main`.
- Ping user with merge SHAs → dispatches Wave 1.
