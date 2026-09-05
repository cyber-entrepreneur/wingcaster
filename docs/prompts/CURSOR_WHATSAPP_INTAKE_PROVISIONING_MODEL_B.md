# Cursor dispatch — WhatsApp intake provisioning (Model B, activation codes)

**PR title:** `feat(wa-intake): shared-number WhatsApp intake with activation-code binding (Model B)`

**Base branch:** `main`

**Estimated effort:** ~1 week of Cursor work + review.

**Rev 1 — 2026-09-05.** Decision doc: [docs/design/AGT_ONB_BLOCKER_01_WHATSAPP_NUMBER_PROVISIONING.md](../design/AGT_ONB_BLOCKER_01_WHATSAPP_NUMBER_PROVISIONING.md) — Model B locked with 8 hardenings (H1-H8).

---

## 1. Why this PR

Blocks AGT-ONB-002 (WhatsApp intake tour) and AGT-ONB-003 (first-listing review from a WhatsApp draft). The onboarding "aha moment" — new agent sends photos + voice + pin to a WhatsApp number → AI drafts a listing → agent approves — cannot run today because the current wa-intake pipeline matches inbound messages against ONE agency-level number and requires prior agency membership.

**Model B** ships a shared-number pool WingCaster owns (3 numbers at launch — H3). Agents disambiguate themselves via a short activation code they send as their first WhatsApp message. After binding, subsequent messages from the same phone route to the bound agent(s) — see H2 for multi-binding on shared devices.

---

## 2. Scope

### 2.1 New tables — migrations 314 + 315 (verify at branch time)

Numbers assume nothing else lands first. Read `backend/src/persistence/migrations/` at branch time and pick the next unused integers >= 314 (main is at 313 as of the vendor admin merge).

**`NNN_user_whatsapp_bindings.sql`** — multi-binding per phone (H2):

```sql
CREATE TABLE IF NOT EXISTS public.user_whatsapp_bindings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,             -- normalized to E.164 at write time
  shared_number_index SMALLINT NOT NULL, -- 0..N-1 for the shared-number pool this agent was assigned to
  active_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,           -- soft delete; keeps history for audit
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uwb_phone_active
  ON public.user_whatsapp_bindings (phone_e164, active_from DESC)
  WHERE deactivated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_uwb_user
  ON public.user_whatsapp_bindings (user_id)
  WHERE deactivated_at IS NULL;
```

**Multi-binding semantic:** the phone `+971 50 123 4567` may have multiple active bindings if a shared device is used by two agents. On an incoming message, the "current" binding for that phone is the most-recent `active_from` row where `deactivated_at IS NULL`. Switching between them is a user command (H2 selector reply + H7 `WC-BIND`).

**`NNN_whatsapp_activation_codes.sql`** — expiring codes (H6):

```sql
CREATE TABLE IF NOT EXISTS public.whatsapp_activation_codes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                    -- e.g. "A4K9" — the parseable part (H1 case-insensitive)
  display_code TEXT NOT NULL,            -- e.g. "WC-A4K9-JAMIL" — human-readable version shown in UI
  shared_number_index SMALLINT NOT NULL, -- which pool number to send to
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,       -- default: created_at + 24h (H6)
  claimed_at TIMESTAMPTZ,                -- when the code was successfully bound
  claimed_from_phone TEXT,               -- E.164 of the phone that sent the binding message
  invalidated_at TIMESTAMPTZ,            -- when the user clicked "I didn't get it" (H1)
  invalidated_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wac_active_code
  ON public.whatsapp_activation_codes (code)
  WHERE claimed_at IS NULL AND invalidated_at IS NULL AND expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_wac_user
  ON public.whatsapp_activation_codes (user_id, created_at DESC);
```

The partial unique index ensures the same `code` value isn't handed to two agents simultaneously (race protection during generation).

**Both migrations must:**
- Use `IF NOT EXISTS` (idempotent).
- Include appropriate `GRANT` statements if the app runs as a restricted role (match the pattern in existing migrations).

### 2.2 Shared-number pool configuration (H3)

New CFG keys in `public.platform_config` (the table PR #43 created — DO NOT confuse with `platform_configuration` from PR #44):

- `WHATSAPP_INTAKE_SHARED_NUMBERS` — JSON array of `{ e164: "+971...", label: "primary" }` entries. **Floor: 3 numbers at launch.**
- `WHATSAPP_INTAKE_PER_AGENT_DAILY_CAP` — integer, default `500`. Per-agent messages-per-day cap.
- `WHATSAPP_INTAKE_TIER_ALERT_PERCENT` — integer, default `70`. When a number's daily send count exceeds this % of its Meta tier cap, emit an ops alert (log at WARN + `audit_log` entry — do NOT dispatch a notification; ops watches logs).
- `WHATSAPP_INTAKE_CODE_TTL_HOURS` — integer, default `24`. Code expiry window.

Seed defaults in a companion migration (or the same one — Cursor's call). Runtime reads env first, then this table, then hardcoded fallback — same pattern as `getDispatchConfig()` in `backend/src/lib/notifications/dispatch.js`.

### 2.3 New module: `backend/src/modules/whatsapp-listings/binding/`

Add a sub-module under the existing `whatsapp-listings` module (do NOT create a top-level new module — keeps wa-intake logic co-located).

Files:
- `binding/service.js` — code generation, code validation, binding creation, binding lookup, binding deactivation.
- `binding/routes.js` — HTTP endpoints (see §2.5).
- `binding/webhook-parser.js` — new inbound-message pre-processor that handles activation codes and WC-* commands BEFORE the existing wa-intake pipeline runs.
- `binding/round-robin.js` — deterministic `shared_number_index = hash(user_id) % pool_size`. Same agent always assigned to the same number.
- `binding/tests/*.test.js` (fast + Postgres).

### 2.4 Activation-code generation (H1)

- 4-character alphanumeric code drawn from a case-insensitive alphabet excluding ambiguous chars: `[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]` (no 0/1/O/I). ~32^4 ≈ 1M combinations — more than enough for 24h TTL.
- Display code format: `WC-<CODE>-<HUMAN_HINT>`. The hint is derived from the agent's first name (first 6 chars, uppercased, stripped of non-alphanumeric). E.g. `WC-A4K9-JAMIL`. Purely cosmetic — parser ignores the `WC-` prefix and the `-HINT` suffix per H1.
- Uniqueness: retry generation up to 5 times if the unique index blocks (extremely rare for 32^4 space).
- Parsing rules (in `binding/webhook-parser.js`):
  - Case-insensitive: `a4k9` = `A4K9`.
  - Prefix `WC-` optional.
  - Suffix `-<HINT>` optional.
  - Whitespace trimmed.
  - Numeric-only autocorrect: if the code came through as `WC-4K9` (character dropped), auto-suggest via reply — do NOT auto-accept.

### 2.5 New HTTP endpoints

All under `/api/auth/whatsapp/`, guarded by `authMiddleware`.

- `POST /activation-code` — generates a fresh code for `req.user.id`. Invalidates any prior active code for the same user (`invalidated_reason = 'REGENERATED'`). Returns `{ display_code, shared_number_e164, expires_at }`. Called by AGT-ONB-002 on mount AND on the "I didn't get it" button (H1).
- `GET /binding-status` — returns `{ bound: boolean, phone_e164?: string, bound_at?: string }` for `req.user.id`. Called by AGT-ONB-002 as a poll (every 3s, backoff to 10s after 60s, cap at 24h to match TTL).
- `GET /bindings` — returns the current user's active bindings `[{ id, phone_e164, active_from, last_used_at }]`. Powers AGT-SET-* device management (Phase-2 screen, but data endpoint ships now).
- `DELETE /bindings/:id` — soft-deletes a binding (`deactivated_at = NOW()`). Verifies ownership. Powers manual unbind from AGT-SET-*.

### 2.6 Webhook parser extension

Add to `backend/src/modules/whatsapp-listings/application/webhook.js` (the existing entry point) a pre-processor step that runs BEFORE the existing intake pipeline:

```
[inbound message received]
  ↓
[dedup by message_id (existing claim step — DO NOT change)]
  ↓
[NEW: bindingParser(from, text)]
  ├→ if text matches activation-code pattern → attempt bind, reply confirmation, STOP (don't run intake)
  ├→ if text matches WC-* command → run command handler, reply, STOP
  └→ else fall through to existing intake pipeline
```

**Binding-parser flow:**

1. Extract candidate code from `text` per §2.4 parsing rules.
2. Look up active code in `whatsapp_activation_codes` where `code = <parsed>` AND `claimed_at IS NULL` AND `invalidated_at IS NULL` AND `expires_at > NOW()`.
3. If found:
   - Check H2 multi-binding: if `phone_e164` already has an active binding to a DIFFERENT user, reply with the selector prompt (see H2) and store a pending-selection state on the code row. Do NOT bind yet. Continue on the next inbound `1` or `2` from that phone.
   - Otherwise, insert `user_whatsapp_bindings` row, mark code `claimed_at = NOW(), claimed_from_phone = <from>`, reply `"You're linked. Send photos, a voice note, and a location pin to start your first listing."` (short — this is a WhatsApp message, not marketing copy).
4. If NOT found AND the phone has NO existing active binding: reply H1 hint text — `"Please send your activation code. It looks like WC-XXXX-YOURNAME. Tap 'Get a new code' in the WingCaster app if you don't have one."`
5. If NOT found AND the phone HAS an existing active binding: fall through to the existing intake pipeline (this is a normal message from a bound agent).

### 2.7 WC-* commands (H7)

Reserved keywords, case-insensitive, prefix `WC-` required (distinguishes from listing text that happens to start with `BIND` etc.):

| Command | Behavior |
|---|---|
| `WC-BIND` | Adds THIS phone as an additional binding for the sender's already-authenticated account. Requires an in-app-generated code paste — user first requests a bind code from AGT-SET-* (later screen), then sends `WC-BIND <code>` from the new phone. |
| `WC-UNBIND` | Deactivates the CURRENT binding for THIS phone (the most-recent active row for the sender's `phone_e164`). Reply confirms which account was unbound. |
| `WC-LIST` | Replies with the phones currently bound to the sending agent's account, most-recent first. Format: `1. +971 XX XXX XXXX — last used 2h ago` (max 5 phones per reply, cursor pagination not needed at this scale). |
| `WC-TRANSFER` | Reserved for a future device-migration flow. In v1, replies `"Coming soon. Contact support to change your primary WhatsApp number."` |

Do NOT implement `WC-TRANSFER` beyond the placeholder reply — it needs a proper re-auth flow that's out of scope here.

### 2.8 Round-robin assignment (H3)

`shared_number_index = fnv1a_hash(user_id) % pool_size`. Same user always gets the same number — makes debugging trivial and lets an agent memorize "their" number.

Reads pool size from `WHATSAPP_INTAKE_SHARED_NUMBERS` at request time (cached with 30s TTL, same pattern as dispatch config cache).

If pool size changes (a number is added/removed), some agents' `shared_number_index` will shift. This is acceptable at low scale; when pool changes AFTER production traffic, an ops-only migration will need to update existing binding rows. **Do NOT scope that migration in this PR** — leave a comment in `binding/round-robin.js` explaining the future work.

### 2.9 Per-agent daily cap (H3)

Before responding to an inbound message from a bound agent (in the existing intake pipeline, not the binding parser), check if that agent has sent >= `WHATSAPP_INTAKE_PER_AGENT_DAILY_CAP` messages in the rolling 24h window (via a count on `whatsapp_listing_processed_messages` filtered by binding's `user_id`).

If capped: reply `"You've hit today's WingCaster message limit. Try again tomorrow."` and STOP. Do NOT drop silently. Do NOT bill AI credits for a capped message.

### 2.10 Tier-utilization alerting (H3)

Nightly worker (add to `wa_listings/queue` — reuse the existing pattern) that aggregates yesterday's send count per `shared_number_index`, computes % of the configured Meta tier cap, and:
- Emits a `WARN` log entry with structured fields per number.
- Writes an `audit_log` row with `type: 'whatsapp_intake_tier_alert'` if any number > `WHATSAPP_INTAKE_TIER_ALERT_PERCENT` (default 70).

The Meta tier cap per number is a CFG key `WHATSAPP_INTAKE_TIER_CAP_PER_NUMBER` (default `10000` — Tier 2).

Do NOT ship a dashboard or email notification for this — ops watches logs.

### 2.11 Janitor: expired-code cleanup (H6)

Extend the existing credits janitor OR add a light new janitor:
- Every 1h, `UPDATE whatsapp_activation_codes SET invalidated_at = NOW(), invalidated_reason = 'EXPIRED' WHERE expires_at <= NOW() AND claimed_at IS NULL AND invalidated_at IS NULL`.
- Advisory lock: reuse existing janitor lock class or add `WHATSAPP_INTAKE_JANITOR = 1030` (verify no collision in `backend/src/fin/foundation/advisory-locks.js`).

### 2.12 H4 — Model C monetization framing (docs only, no code)

Add a section to `docs/design/AGT_ONB_BLOCKER_01_WHATSAPP_NUMBER_PROVISIONING.md` marking that H4 (Model C monetization framing on the marketing site's Pricing page) is a Phase-2 concern surfaced when paid tiers ship + 10 paid subscribers have upgraded (H8 trigger). No code in this PR.

---

## 3. Non-negotiables

1. **3-shared-numbers floor** in `WHATSAPP_INTAKE_SHARED_NUMBERS` at launch. Reject boot if fewer.
2. **Multi-binding per phone** (H2). No `UNIQUE (phone_e164)` constraint.
3. **Case-insensitive, prefix-optional, suffix-optional code parsing** (H1).
4. **24h code TTL enforced by janitor + partial unique index**.
5. **Per-agent daily cap enforced BEFORE billing** — capped messages don't consume AI credits.
6. **Round-robin is deterministic per `user_id`** — same agent → same number, always.
7. **Reserved `WC-*` keywords** — parser must not confuse listing text with commands. Prefix required.
8. **Migration numbers verified at branch time** — main is at 313 as of PR #44 merge; assume 314+ if nothing else lands first. Read the migrations dir.
9. **Fast + Real-Postgres CI green**.

---

## 4. Test discipline

- **Fast tests** in `binding/tests/`:
  - Code parser: case-insensitive, prefix/suffix optional, whitespace trimmed, malformed rejected.
  - Round-robin: deterministic for given `user_id` and pool size.
  - Command router: `WC-BIND` / `WC-UNBIND` / `WC-LIST` / `WC-TRANSFER` correctly recognized; listing text NOT matched.
- **Real-Postgres tests** in `binding/tests/*.postgres.test.js`:
  - Code generation → send from phone → binding created → subsequent message routes to bound agent.
  - Expired code rejected + user gets hint reply.
  - Two agents on the same phone: bind A, then bind B → selector prompt → reply `2` → subsequent messages route to B.
  - `WC-LIST` returns the correct binding set.
  - `WC-UNBIND` deactivates the correct binding; next message from that phone gets the "please send activation code" hint.
  - Per-agent daily cap enforced; capped message replies with limit text and doesn't hit AI adapters.
  - Janitor invalidates codes past 24h.
  - Round-robin distributes 100 agents across 3 numbers approximately evenly.

---

## 5. Definition of done

1. Migrations 314 + 315 (or whatever integers land) create the two tables.
2. Binding sub-module wired into `whatsapp-listings/index.js` via `createModule`.
3. Webhook pre-processor runs BEFORE the existing intake pipeline; existing intake tests still green.
4. 4 HTTP endpoints (§2.5) live under `/api/auth/whatsapp/`.
5. WC-BIND/UNBIND/LIST/TRANSFER command router live.
6. Round-robin + per-agent daily cap enforced.
7. Janitor entry live with advisory lock.
8. Fast + Real-Postgres CI green.
9. Manual smoke plan in the PR body:
   - Provision 3 sandbox WABA numbers, put them in `WHATSAPP_INTAKE_SHARED_NUMBERS` env var.
   - Sign up as a test agent, hit `POST /api/auth/whatsapp/activation-code`, verify the returned number and code.
   - Send the code from a real phone to the returned number, verify binding lands + confirmation reply.
   - Send a listing (photos + voice + pin), verify the existing intake pipeline processes it as normal.
   - Send `WC-LIST`, verify reply.
   - Send `WC-UNBIND`, verify reply + subsequent message gets the hint.

---

## 6. Follow-ups (do NOT include in this PR)

- **AGT-ONB-002 + AGT-ONB-003 screen implementation** — this backend PR unblocks them, but the actual React screens come in a per-screen Cursor prompt after v0 Design AI iterates on the anchor briefs. See `docs/design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md`.
- **AGT-SET-* device-management screen** — the `GET /bindings` and `DELETE /bindings/:id` endpoints ship in this PR; the UI comes later.
- **Ops dashboard for tier utilization** — logs are enough for v1 (H3).
- **Model C provisioning (dedicated numbers per paid agent)** — deferred to H8 trigger (paid tiers + 10 paid subscribers).
- **WC-TRANSFER flow** — needs a proper re-auth path; out of scope here.
- **Model C marketing copy** (H4) — a follow-up Cursor prompt against the wingcaster-www repo when the Kimi-content port is complete.

---

## 7. Out of scope

- Any change to the marketing site (`wingcaster-www`).
- Any change to how the existing wa-intake pipeline extracts listings, generates thumbnails, or writes drafts — this PR only adds the pre-processor for binding.
- Any change to `credits/*` — the per-agent daily cap is enforced upstream of credit reservation, so no changes to the credit engine are required.
- Any UI work — this is backend-only.
- Real Meta WABA provisioning ops work — 3 sandbox numbers are enough for CI and smoke; production number acquisition is an ops task, not code.
