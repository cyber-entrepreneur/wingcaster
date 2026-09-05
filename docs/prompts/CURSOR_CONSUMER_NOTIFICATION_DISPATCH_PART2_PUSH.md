# Cursor dispatch — Consumer notification dispatch PART 2 (push notifications via FCM)

**PR title:** `feat(notifications): wire push notifications via FCM + user_push_tokens (part 2 of 2)`

**Base branch:** `main`

**Estimated effort:** 3-4 days of Cursor work + review.

**Depends on:** PART1 has merged (2026-09-04, squash `6c9127c`). This PR replaces the `case 'push':` branch that currently returns `PUSH_DEFERRED_TO_PART2` with a real dispatcher.

**Rev 3 — 2026-09-05:** migration renumbered from `305g_` to `312_` (lettered files are operator-only and skipped by the runner; numbers 307/308/309 taken by PART1, 310 by property_ai_ratings, 311 reserved for the pending vendor-admin PR #44). Exact on-main stub snippet included for the replace.

**Rev 2 — 2026-09-04:** revised after architect-owner review. Explicit FCM complexity acknowledgement (JWT signing, OAuth token cache, iOS APNS relay). Global-unique push tokens (evict on cross-user re-registration). FCM-not-configured fallback to `skipped` (does not block the PR on FCM setup).

---

## 1. Why this PR

Push notifications close the loop on consumer notification dispatch. PART1 shipped email/SMS/WhatsApp/in-app. This PR adds push via FCM (Firebase Cloud Messaging), which serves both iOS (via APNS relay) and Android natively.

Split from PART1 because FCM HTTP v1 API has non-trivial infrastructure:
- Service-account JSON key
- JWT signing + OAuth2 access-token generation
- Token cache with 1-hour refresh
- Optional iOS-specific config for APNS relay

Getting all four right during PART1's timeline risked delaying delivery of the other 4 channels. Split isolates this risk.

---

## 2. Scope

### 2.1 New file: `backend/src/lib/notifications/push.js`

Uses `google-auth-library` + `firebase-admin` (add to `package.json`):
- `google-auth-library` handles the JWT + OAuth token cache + refresh automatically
- `firebase-admin` provides the FCM messaging API on top

**Exported surface:**
```js
export function isPushConfigured(): boolean
export async function sendPushNotification({ userId, title, body, data, priority }): Promise<{ ok, provider_message_id, tokens_sent, tokens_invalidated }>
```

`sendPushNotification`:
1. If `!isPushConfigured()`: throw `PUSH_UNCONFIGURED`
2. Look up all device tokens for `userId` from `user_push_tokens`
3. If zero tokens: return `{ ok: false, code: 'NO_TOKENS_FOR_USER' }`
4. Build FCM `Message` per platform (iOS APNS payload for iOS tokens, Android notification for Android tokens, web push for web tokens)
5. Batch send via `messaging.sendEach()` (handles up to 500 tokens per call)
6. Handle per-token responses:
   - `messaging/invalid-argument`, `messaging/registration-token-not-registered` → delete the token row (§2.4 stale-token cleanup)
   - Other errors → log, keep the token, mark send as partial-failure
7. Return `{ ok: true, provider: 'fcm', tokens_sent: N, tokens_invalidated: M }`

### 2.2 New migration `312_user_push_tokens.sql`

> **Numbering rule (established by PART1's 307/308/309 comments):** the runner skips `NNN[letter]_*.sql` (operator-only down-migrations). Auto-applied files are numeric only. Current taken numbers on main: 307/308/309 (PART1 notifications), 310 (property_ai_ratings). PR #44 has 311 reserved. This migration uses **312**.

```sql
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token TEXT NOT NULL,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ,
  UNIQUE (token)  -- global unique per review: a device token maps to ONE user at a time
);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_platform ON user_push_tokens(platform);
```

**Global unique on `token`** per architect-owner review — prevents a shared device (family tablet, kiosk) from silently delivering notifications to the wrong user after re-login.

### 2.3 Registration API

`POST /api/auth/push-token` — Capacitor app calls on login.
- Body: `{ token, platform, device_id }`
- Auth: `authMiddleware` — must be a signed-in user
- Behavior:
  1. `INSERT INTO user_push_tokens (user_id, platform, token, device_id) ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, last_used_at = NOW(), platform = EXCLUDED.platform`
  2. On conflict, the old `user_id` is REPLACED — the device now belongs to the new user (evict-on-reregister per review)
  3. Return `{ ok: true, id }`

`DELETE /api/auth/push-token/:id` — user removes a device (they lost the phone).
`DELETE /api/auth/push-token/all` — user signs out of all devices.
`GET /api/auth/push-tokens` — user sees their registered devices (for the AGT-SET / SHR-SET session-management screen when built).

### 2.4 Stale-token cleanup

On FCM response `INVALID_ARGUMENT` or `NOT_FOUND` for a token, `sendPushNotification` deletes the row immediately (invalid tokens never recover). Logged for observability.

### 2.5 Dispatcher integration

On main today, [backend/src/lib/notifications/dispatch.js:480-486](backend/src/lib/notifications/dispatch.js:480) is:

```js
case 'push':
  return {
    ok: false,
    status: 'skipped',
    code: 'PUSH_DEFERRED_TO_PART2',
    error: 'Push notifications not yet wired',
  }
```

Replace with:

```js
case 'push':
  if (!isPushConfigured()) {
    return {
      ok: false,
      status: 'skipped',
      code: 'PUSH_UNCONFIGURED',
      error: 'FCM credentials not set — configure FCM_SERVICE_ACCOUNT_JSON env var',
    }
  }
  result = await dispatchPush({ recipient, subject, body, metadata })
  break
```

(Note: `push` must go through the same `result / recordCooldown / return result` tail the other channels use — hence `result = ... ; break` rather than `return`. Cooldown recording matters when a caller registers an `alert_type` for a push burst.)

Also update the test at [backend/src/lib/notifications/dispatch.postgres.test.js:81-92](backend/src/lib/notifications/dispatch.postgres.test.js:81) — the assertion is `code: 'PUSH_DEFERRED_TO_PART2'`; change it to a new test that mocks `isPushConfigured() === false` and asserts `code: 'PUSH_UNCONFIGURED'`, plus a separate test with `isPushConfigured() === true` and a mocked `sendPushNotification` for the happy path.

`dispatchPush`:
- `recipient` is a `user_id` (validated by PART1's `validateRecipientForChannel`)
- Calls `sendPushNotification({ userId: recipient, title: subject, body, data: metadata })`
- Maps response to standard `{ ok, status, provider, provider_message_id }` shape

### 2.6 FCM-not-configured fallback (added per review)

Per architect-owner review: if FCM credentials are missing, don't block the PR — `dispatchPush` returns `{ ok: false, status: 'skipped', code: 'PUSH_UNCONFIGURED' }` cleanly. This lets the PR ship + merge even if the ops team hasn't provisioned FCM yet.

Skipped items are NOT retried per PART1's contract — no retry loop against a permanently-unconfigured transport.

### 2.7 Env vars

Update `docs/deployment/RAILWAY_ENV_VARS.md`:
- `FCM_SERVICE_ACCOUNT_JSON` — the JSON key contents (base64-encoded to fit in an env var, decoded in-process)
- `FCM_PROJECT_ID` — inferred from the service account JSON but overridable

---

## 3. Non-negotiables

1. **Global unique on `user_push_tokens.token`** — a device token maps to ONE user at a time.
2. **Evict-on-reregister** — new registration with an existing token REPLACES the old user_id.
3. **Stale-token cleanup on send failure** — invalid-token responses from FCM delete the row.
4. **FCM-unconfigured returns `skipped`** — not `pending`, not `failed`. Never retry.
5. **Use `google-auth-library` + `firebase-admin`** — don't roll your own JWT signing.
6. **Per-token error handling in batch send** — some tokens can fail while others succeed; that's a partial success, not a full failure.

---

## 4. Test discipline

- **Fast + Real-Postgres suites green**.
- **New tests** in `backend/src/lib/notifications/push.postgres.test.js`:
  - FCM unconfigured: returns `skipped`, no retry
  - Happy path: sendPushNotification succeeds, provider_message_id returned
  - No tokens for user: returns `NO_TOKENS_FOR_USER`
  - Batch: 200 tokens sent in one call
  - Invalid token: deleted from DB, partial-success returned
  - Global-unique constraint: re-registering an existing token updates the row (not INSERT-conflict-error)
  - Evict cross-user: user A registers token T, user B registers token T, user A no longer receives pushes for T
  - Registration API: 401 unauth, 201 create, 200 conflict-update, 204 delete
- Mock the FCM API in tests (no real network) but verify one real token manually in staging.

---

## 5. Definition of done

1. `lib/notifications/push.js` module created.
2. Migration `312_user_push_tokens.sql` applied. Schema has global unique on `token`.
3. `POST/DELETE/GET /api/auth/push-token(s)` routes wired.
4. Dispatcher's `case 'push':` branch replaced with real dispatcher.
5. FCM-unconfigured returns `skipped` (does not block merge if ops hasn't provisioned FCM).
6. Stale-token cleanup on invalid FCM responses.
7. Env vars documented in `RAILWAY_ENV_VARS.md`.
8. `google-auth-library` + `firebase-admin` added to `package.json`.
9. Fast + Real-Postgres CI green.
10. Manual smoke test in staging with a real Android token if FCM is provisioned; otherwise skipped path verified via `PUSH_UNCONFIGURED`.

---

## 6. Follow-up (do NOT include in this PR)

- **Web push** — service worker + VAPID keys. Web platform in `user_push_tokens` is scaffolded but the sender path for web (WebPush protocol, not FCM) needs its own implementation.
- **Notification preferences per channel** — user should opt in/out of push independently of email/SMS. Backend `notification_preferences` already supports this; frontend AGT-NPF-002 already exists.
- **Rich push** (images, action buttons) — deferred to when Agent notifications matrix designs them.
