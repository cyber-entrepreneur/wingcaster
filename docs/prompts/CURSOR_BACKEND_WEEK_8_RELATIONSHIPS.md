# Cursor dispatch — Backend Week 8+: contact_relationships bundle

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`
**Estimated effort:** ~2-3 days
**Rev 1 — 2026-09-08**

**Depends on:** Wave 0.5 [BE-BLOCKER-04] source_channel decomposition merged.

**Unblocks:** Wave 8+ (AGT-CTC-007 relationships editor).

---

## 1. Scope

1 item per [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md) §3:

- **[BE-BLOCKER-36]** `contact_relationships` CRUD routes (2-3 days)

Table already exists in migration 028 (rich schema). No route handlers exist today.

## 2. Parallelization directive

Single-agent — 7 endpoints under one branch.

**Agent 1 — BE-BLOCKER-36:** implement 7 endpoints in `backend/src/lib/contacts/relationships-routes.js`:

1. `GET /api/contacts/:contactId/relationships/mine` — list agent's OWN relationships with this contact
2. `GET /api/contacts/:contactId/relationships/other` — list OTHER agents' relationships with this contact, PII-masked per `<PIIMask>` discipline
3. `POST /api/contacts/:contactId/relationships` — create pending relationship (party_type + relationship_type + exclusivity + scope + starts_at + ends_at). Consent workflow triggered — email sent to contact with signed HMAC link
4. `PATCH /api/contacts/:contactId/relationships/:id` — update pending relationship (scope, ends_at, etc.). Rejected on active/confirmed status
5. `DELETE /api/contacts/:contactId/relationships/:id` — delete pending only. Server rejects delete on active/confirmed
6. `POST /api/contacts/:contactId/relationships/:id/resend-consent-link` — regenerate + resend consent HMAC link
7. `GET /public/relationships/consent?token=<HMAC>` — public consent landing page endpoint. Verifies token, shows relationship terms, contact clicks Accept/Reject. Accept flips `contact_relationships.status = 'confirmed'` + writes to `consent_record`

Consent link piggybacks existing HMAC-token infra (`backend/src/lib/webhook-verify.js`) with new `type='relationship_consent'` variant.

Branch: `feat/be-contact-relationships-crud`.

## 3. Non-negotiables

1. **PII masking** on cross-agent list endpoint — never leak other agents' clients in plaintext to the requesting agent.
2. **Consent link is public + token-signed** — no session cookie needed; only signed token authorizes access.
3. **Consent link is single-use** — after accept or reject, token becomes invalid.
4. **State machine enforced server-side** — pending → confirmed | rejected; confirmed → active (on `starts_at`); active → ended (on `ends_at`).
5. **Consent-record write is atomic with status flip** — no orphaned "confirmed but no consent_record" rows.
6. Kickoff RESOLVED marker.

## 4. Definition of done

- Branch merged.
- Kickoff marks [BE-BLOCKER-36] RESOLVED.
- Real-Postgres CI green.
- Ping user → dispatches Wave 8+ AGT-CTC-007.
