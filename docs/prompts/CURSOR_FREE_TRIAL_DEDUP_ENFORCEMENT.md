# Cursor dispatch — Free-trial dedup enforcement (backend)

**PR title:** `feat(auth): enforce one-time free-trial claim per identity (email + phone + username)`

**Base branch:** `main`

**Estimated effort:** 2-3 days of Cursor work + review. Focused single-purpose PR.

**Rev 1 — 2026-09-05.** Requirement doc: [docs/design/MARKETING_WEBSITE_KICKOFF.md §6c](../design/MARKETING_WEBSITE_KICKOFF.md).

---

## 1. Why this PR

The marketing site (`wingcaster-www`) promises: **one free listing per identity, one time ever.** Identity = email + phone + username. A returning user (same email OR phone OR username) does NOT get another free trial.

The backend has NO enforcement today. Without this PR, anyone can register a throwaway email and claim another free listing forever, and the trial economics collapse.

**What "identity" means:**
- **Email:** `LOWER(TRIM(email))`. Gmail-style aliases (`user+tag@`) NOT stripped in v1 — treat as distinct. If abuse is observed later, add alias normalization in a follow-up.
- **Phone:** E.164 (already the normalization the app uses).
- **Username:** case-folded (`String.prototype.toLocaleLowerCase()` with fold via ICU / Unicode NFKC), whitespace trimmed. Arabic usernames must fold correctly.

**A user is blocked from claiming free-trial IF** any of the three normalized values matches a prior claim. Match on any single dimension is enough.

---

## 2. Scope

### 2.1 New table — migration 314+ (verify at branch time)

Read `backend/src/persistence/migrations/` at branch time and pick the next unused integer >= 314 (main is at 313 as of the vendor admin merge). If [CURSOR_WHATSAPP_INTAKE_PROVISIONING_MODEL_B.md](CURSOR_WHATSAPP_INTAKE_PROVISIONING_MODEL_B.md) lands first, this PR rebases to whatever's next available.

**`NNN_free_trial_claims.sql`:**

```sql
CREATE TABLE IF NOT EXISTS public.free_trial_claims (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Hashed identity dimensions — SHA-256 hex over normalized values.
  -- Hashing is required so we can delete the underlying user account
  -- without losing the "already claimed" enforcement (soft-delete-inclusive
  -- per the marketing promise) AND to reduce PII surface if this table leaks.
  email_hash TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  username_hash TEXT NOT NULL,
  -- Audit fields for support recovery. These CAN be nulled or purged for
  -- privacy compliance without invalidating the enforcement (the hashes stay).
  original_user_id TEXT,        -- reference to the user account at claim time
  original_email TEXT,          -- raw email at claim time (for support cases)
  original_phone TEXT,          -- raw phone at claim time
  original_username TEXT,       -- raw username at claim time
  -- Optional soft-delete for support-driven "grant another trial" edge cases.
  -- Never expose an endpoint that sets this — must be a manual DB write with
  -- a written support ticket referenced.
  waived_at TIMESTAMPTZ,
  waived_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ftc_email_hash
  ON public.free_trial_claims (email_hash)
  WHERE waived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ftc_phone_hash
  ON public.free_trial_claims (phone_hash)
  WHERE waived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ftc_username_hash
  ON public.free_trial_claims (username_hash)
  WHERE waived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ftc_original_user
  ON public.free_trial_claims (original_user_id);
```

**Why partial unique indexes** (WHERE `waived_at IS NULL`): a support-waived claim shouldn't block a new claim on the same identity. The waive path is manual (no code endpoint) and expected to be extremely rare.

**Why hashes not raw values on the unique index:** privacy posture. If the table leaks or is subpoenaed for one identity, the raw PII for OTHER identities isn't queryable except by pre-computing hashes. The audit fields DO retain raw values for support cases but can be purged separately without breaking enforcement.

### 2.2 Normalization + hashing helpers

New file: `backend/src/lib/auth/identity-normalize.js`:

```js
// All exports pure functions, no I/O.

export function normalizeEmail(email) {
  if (typeof email !== 'string') return null
  const trimmed = email.trim().toLowerCase()
  return trimmed || null
  // NOTE: gmail-style +tag aliases are NOT stripped in v1. Treat as distinct.
  // Future: if abuse observed, add alias stripping here + a data-migration
  // to fold historical rows.
}

export function normalizePhone(phone) {
  // Delegate to the existing E.164 normalizer used at signup.
  // If none exists yet, create a shared one — do NOT duplicate the logic.
  // The important invariant: two inputs that would authenticate the same
  // account must normalize to the same value.
}

export function normalizeUsername(username) {
  if (typeof username !== 'string') return null
  // NFKC fold, then toLocaleLowerCase(). Arabic + Latin fold both correctly
  // under NFKC + toLocaleLowerCase() on Node 22.
  const normalized = username.normalize('NFKC').trim().toLocaleLowerCase()
  return normalized || null
}

export function hashIdentity(value) {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex')
}
```

Tests in `identity-normalize.test.js`: cover empty, whitespace, Arabic, Latin uppercase, gmail-alias-NOT-stripped, E.164 normalization equivalence.

### 2.3 Claim-check service

New file: `backend/src/lib/auth/free-trial-claims.js`:

```js
// Exports two operations:
//
//   assertNoPriorClaim({ email, phone, username }) → throws
//     FreeTrialAlreadyClaimedError if any hash matches an unwaived row.
//     Includes { blockingDimensions: ['email' | 'phone' | 'username', ...] }
//     for callers that need to disambiguate the message.
//
//   recordClaim({ userId, email, phone, username }) → inserts a row.
//     Race-safe: catches unique-constraint violations and re-throws as
//     FreeTrialAlreadyClaimedError. Uses the same normalization + hash
//     helpers as assertNoPriorClaim, so a stale value can't slip through.

export class FreeTrialAlreadyClaimedError extends Error {
  constructor(blockingDimensions) {
    super('This identity has already claimed the free trial')
    this.code = 'FREE_TRIAL_ALREADY_CLAIMED'
    this.blockingDimensions = blockingDimensions
  }
}
```

`recordClaim` MUST run inside the same transaction as user creation (see §2.4) — if user creation succeeds but the claim insert fails, we've given the trial without recording it, which is the exact bug this PR fixes.

### 2.4 Signup integration

Amend the existing signup endpoint(s) — grep `backend/src/` for `/api/auth/register` and `/api/auth/signup` and any variants; the codebase has multiple identity paths (per SHR-AUT-001 there are 6 signup paths):

```
[signup request arrives]
  ↓
[validate input, verify OTP/password, etc — EXISTING logic]
  ↓
[BEGIN transaction]
  ├→ assertNoPriorClaim({ email, phone, username })  ← FAILS FAST if already claimed
  ├→ create users row (EXISTING logic)
  ├→ recordClaim({ userId, email, phone, username })
  └→ [COMMIT]
  ↓
[grant free trial (existing free-tier entitlement logic)]
```

**On `FreeTrialAlreadyClaimedError`:** signup MUST NOT proceed. Return HTTP 409 with body:

```json
{
  "error": "This identity has already claimed the WingCaster free trial",
  "code": "FREE_TRIAL_ALREADY_CLAIMED",
  "blocking_dimensions": ["email"]
}
```

The frontend uses `blocking_dimensions` to prompt the specific recovery path — "sign in with this email" vs "we found an account with this phone number, sign in?" — but MUST NOT leak which dimension matched to a non-owner (the error message stays generic; the `blocking_dimensions` field is behind an auth-lite check, see §2.6).

### 2.5 Safety net — first-listing check

Add the same `assertNoPriorClaim` check inside the free-tier listing-post flow, keyed by the AUTHENTICATED user's current email/phone/username. This is a **defensive redundancy** — if the signup check ever fails to run (bug, race, code-path drift), the first-listing check catches it.

Location: grep for the entitlement resolution logic that grants free-tier consumption. If the free tier is a package with an entitlement, add the check inside `checkEntitlement` or its caller — Cursor picks the right seam.

If this check fires post-signup, log at ERROR level (not just WARN) — it means the signup check is bypassed somewhere and needs urgent investigation.

### 2.6 Response-shape security

**Do NOT leak account existence to an unauthenticated caller.** The signup response returns `code: 'FREE_TRIAL_ALREADY_CLAIMED'` — the message doesn't say "your email is registered" (which would enable enumeration).

The `blocking_dimensions` field IS informative. To prevent enumeration abuse:
- Rate-limit `/api/auth/signup` per IP per hour (probably already exists — verify).
- Consider: return `blocking_dimensions: null` for the FIRST failure per IP per hour, and only start returning the specific dimensions after the user has demonstrated they own the identity by requesting an OTP. Cursor's call — err on the side of privacy if unsure.

### 2.7 Support-waive path (no endpoint)

Do NOT ship an HTTP endpoint to waive a claim. Waiving is manual:

```sql
UPDATE public.free_trial_claims
   SET waived_at = NOW(), waived_reason = 'Support ticket #12345: user lost access to original email'
 WHERE id = '<claim-id>';
```

Document this in the PR body + a comment in `free-trial-claims.js`.

Justification: automated waive paths are the exact abuse vector this whole PR closes.

### 2.8 Backfill for existing users

If ANY user in the current `users` table already claimed the free tier before this migration lands (check by counting users with a free-tier entitlement or credit grant), the migration must backfill `free_trial_claims` rows for them, so those identities are correctly blocked from re-claiming.

Backfill logic: for each existing user with a free-tier grant, compute the three hashes from their current email/phone/username and insert a `free_trial_claims` row. Wrap in a single transaction. If the backfill fails, the migration fails cleanly.

If NO users have free-tier grants yet (which is likely — free tier is a new marketing-site concept), skip the backfill and log a note.

---

## 3. Non-negotiables

1. **Three unique indexes** on `email_hash`, `phone_hash`, `username_hash`. Match on ANY one blocks the claim.
2. **Enforcement runs in the SAME transaction as user creation.** No "user created but claim not recorded" state.
3. **Soft-delete inclusive.** Even if `users` row is hard-deleted, `free_trial_claims` row persists — the promise is "per identity, ever", not "per active account".
4. **Race-safe.** Two concurrent signups for the same identity: one succeeds, the other gets `FREE_TRIAL_ALREADY_CLAIMED` from the unique-constraint violation catch.
5. **Hashed identity, not raw.** Raw values only in audit columns which can be nulled later without breaking enforcement.
6. **No HTTP waive endpoint.** Manual DB write only.
7. **Backfill existing users** if any hold a free-tier grant.
8. **Migration number verified at branch time** — see §2.1.
9. **Fast + Real-Postgres CI green.**

---

## 4. Test discipline

- **Fast tests** (`identity-normalize.test.js`):
  - Empty, whitespace, Arabic, uppercase Latin, mixed-case, Unicode NFKC fold, gmail-alias-NOT-stripped, E.164 equivalence.
- **Fast tests** (`free-trial-claims.test.js` — no DB):
  - `FreeTrialAlreadyClaimedError` shape correct.
  - `recordClaim` propagates unique-violation as `FreeTrialAlreadyClaimedError` with correct `blockingDimensions`.
- **Real-Postgres tests** (`free-trial-claims.postgres.test.js`):
  - Fresh identity signs up → row inserted, second signup with SAME email blocked → 409 + `code: 'FREE_TRIAL_ALREADY_CLAIMED'` + `blocking_dimensions: ['email']`.
  - Same email different phone/username → blocked (email match).
  - Different email, same phone → blocked (phone match).
  - Different email, same phone, different username → blocked (phone match).
  - All three different → allowed.
  - Case variance on email (Alice@X vs alice@X) → blocked.
  - Case variance on username → blocked.
  - Arabic username case fold → blocked.
  - Hard-delete the user, retry signup with same identity → still blocked (soft-delete-inclusive).
  - Waived claim (manual UPDATE) → signup succeeds.
  - Concurrent signup race: two workers try same identity at same time → exactly one succeeds; the other gets `FREE_TRIAL_ALREADY_CLAIMED`. Use a real Postgres SERIALIZABLE test or the existing race-test pattern.
  - First-listing safety-net check (§2.5) fires if a bypass is simulated (mock the signup check to no-op) → listing rejected + ERROR log.
  - Backfill migration correctly seeds rows for existing free-tier users (if any).

---

## 5. Definition of done

1. Migration NNN creates the table + three partial unique indexes.
2. `identity-normalize.js` + tests.
3. `free-trial-claims.js` + tests.
4. Signup endpoint(s) integrated per §2.4.
5. First-listing safety-net check per §2.5.
6. Backfill logic per §2.8.
7. Fast + Real-Postgres CI green.
8. PR body includes:
   - The SQL waive command (§2.7) so support has it in a searchable place.
   - Note on the rate-limit / enumeration-prevention decision (§2.6).
   - Explicit list of every signup endpoint modified (SHR-AUT-001 has 6 identity paths — Cursor confirms all are covered).

---

## 6. Follow-ups (do NOT include in this PR)

- **Gmail-alias normalization** — if abuse observed, add `+tag` stripping + a data-migration to fold historical rows.
- **Frontend signup error handling** — the frontend already handles auth errors; adding a specific `FREE_TRIAL_ALREADY_CLAIMED` treatment (with a "sign in instead?" CTA) is a per-screen PR against the product frontend.
- **Marketing-site pricing FAQ copy** — Kimi content port ([CURSOR_PORT_KIMI_CONTENT_TO_MDX.md](CURSOR_PORT_KIMI_CONTENT_TO_MDX.md)) can now reference this enforcement mechanism as a real, shipped guardrail.
- **Free-trial "what happens after 1 listing?" UX** — auto-upgrade / freeze / downgrade is still a product decision (see [MARKETING_WEBSITE_KICKOFF.md §6c](../design/MARKETING_WEBSITE_KICKOFF.md)). Not scoped here.
- **Support tooling** — an admin UI for waiving claims (with two-person approval, since it's a rare exception path). Follow-up when support volume justifies it.

---

## 7. Out of scope

- Any frontend change (product or marketing site).
- Any change to the free-tier feature quota itself — that's already in `credits/features.js` and its registry seed.
- Any change to Paddle billing or paid-tier enforcement.
- The "what happens after 1 listing" UX decision.
- Deduplication of email `+tag` aliases (Phase 2 if needed).
