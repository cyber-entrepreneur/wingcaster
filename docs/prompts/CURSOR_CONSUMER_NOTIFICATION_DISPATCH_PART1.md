# Cursor dispatch — Consumer notification dispatch PART 1 (email / SMS / WhatsApp / in-app)

**PR title:** `fix(notifications): wire consumer notification dispatch — email / SMS / WhatsApp / in-app (part 1 of 2)`

**Base branch:** `main`

**Estimated effort:** 3-4 days of Cursor work + review.

**Runs in parallel with:** any backend PR. PART2 (push+FCM) depends on this landing first.

**Rev 2 — 2026-09-04:** revised after architect-owner review. Extracted from server.js into dedicated module. Added rate-limiting + batching. Recipient validation per channel. Retry policy defined. `metadata` field documented. Push+FCM split into PART2.

---

## 1. Why this PR

Per the backend placeholder audit §P0-7, `dispatchConsumerNotification` in `backend/src/server.js:3055-3062` is a placeholder returning `{ ok: false, status: 'pending', error: 'Channel ${channel} dispatch not yet wired' }` for every channel. Consumer-side notifications (saved-search alerts, price-drop alerts, new-listing alerts) fail silently. `consumer_notification_retries` queue accumulates forever with no delivery.

This PR (Part 1) wires 4 of the 5 channels using transports that already exist in the codebase:
- **Email** → `lib/notifications/email.js :: sendEmail` (Graph / Resend / SendGrid / SMTP all wired)
- **SMS** → `lib/notifications/sms.js` (Twilio)
- **WhatsApp** → `whatsapp.js :: sendWhatsAppText`
- **In-app** → `public.notifications` table write

**Push** is deliberately deferred to PART2 due to FCM complexity (JWT signing + OAuth token cache + iOS APNS relay).

**Non-goals:**
- No push notifications (PART2).
- No new transport integrations.
- No frontend work.
- No consumer_notification_retries schema changes beyond what §2.5 requires.

---

## 2. Scope

### 2.1 Extract dispatch into a dedicated module (added per review)

Per architect-owner review: server.js is the application's throat; adding a 5-way switch + wrappers + retry logic there is bloat.

**Move all dispatch logic to `backend/src/lib/notifications/dispatch.js`** (new file). Server.js only imports + registers routes. Follows the existing pattern (`email.js`, `sms.js`, `whatsapp.js`, `instagram.js` all in `lib/notifications/`).

Exported surface from `dispatch.js`:
- `dispatchConsumerNotification({ channel, recipient, subject, body, html, metadata })` — main entry
- `processPendingNotificationRetries({ limit })` — retry worker tick
- Internal per-channel dispatchers not exported (private to module)

### 2.2 Main dispatcher shape

```js
export async function dispatchConsumerNotification({ channel, recipient, subject, body, html, metadata } = {}) {
  const normalizedChannel = String(channel || '').toLowerCase()

  // Recipient validation FIRST — cheap failures fast
  const validationError = validateRecipientForChannel(normalizedChannel, recipient)
  if (validationError) return { ok: false, status: 'skipped', code: 'INVALID_RECIPIENT', error: validationError }

  // Rate-limit + cooldown check
  const rateLimitError = await checkRateLimit(normalizedChannel, recipient, metadata)
  if (rateLimitError) return { ok: false, status: 'pending', code: 'RATE_LIMITED', error: rateLimitError, retry_after: rateLimitError.retry_after_ms }

  switch (normalizedChannel) {
    case 'email':    return dispatchEmail({ recipient, subject, body, html, metadata })
    case 'sms':      return dispatchSms({ recipient, body, metadata })
    case 'whatsapp': return dispatchWhatsApp({ recipient, body, metadata })
    case 'in_app':   return dispatchInApp({ recipient, subject, body, metadata })
    case 'push':     return { ok: false, status: 'skipped', code: 'PUSH_DEFERRED_TO_PART2', error: 'Push notifications not yet wired' }
    default:         return { ok: false, status: 'failed', code: 'UNKNOWN_CHANNEL', error: `Unknown channel: ${channel}` }
  }
}
```

Each `dispatchX` wrapper:
1. Calls the underlying transport (`email.js`, `sms.js`, `whatsapp.js`)
2. Maps transport response to `{ ok, status, provider, provider_message_id, code, error }` shape
3. On transport-unconfigured: returns `{ ok: false, status: 'skipped', code: '<TRANSPORT>_UNCONFIGURED' }` (NOT retryable)
4. On transient failure (5xx, rate limit, timeout): returns `{ ok: false, status: 'pending', retry_after }` (retryable)
5. On permanent failure (bad recipient format from transport, 4xx content violation): returns `{ ok: false, status: 'failed', code, error }` (NOT retryable; goes to dead-letter)

### 2.3 Per-channel recipient validation (added per review)

Per architect-owner review: caller can pass an email to `channel='whatsapp'` — dispatcher must validate BEFORE calling transport.

```js
function validateRecipientForChannel(channel, recipient) {
  if (!recipient) return 'recipient is required'
  switch (channel) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(recipient)) ? null : 'invalid email format'
    case 'sms':
      // E.164: +CountryCode + digits, 8-15 total
      return /^\+[1-9]\d{7,14}$/.test(String(recipient)) ? null : 'invalid E.164 phone (expected +CCDDDDDDDD)'
    case 'whatsapp':
      // WhatsApp accepts E.164 OR Business ID (numeric string 12-16 chars)
      return /^(\+[1-9]\d{7,14}|[1-9]\d{11,15})$/.test(String(recipient)) ? null : 'invalid WhatsApp recipient'
    case 'in_app':
      // Expect a user id (e.g., 'usr_...' or UUID)
      return /^[a-zA-Z0-9_-]{3,64}$/.test(String(recipient)) ? null : 'invalid user id'
    default:
      return `no validator for channel ${channel}`
  }
}
```

### 2.4 In-app notifications target (added per review — specify table)

Per architect-owner review: "In-app → write to notifications table (already exists)" was vague. Target is `public.notifications`.

**Verify at PR start:** does `public.notifications` have columns `type`, `user_id`, `title`, `body`, `metadata JSONB`, `created_at`? If the `type` CHECK constraint doesn't include `'consumer'`, extend it in migration `305d_notifications_type_consumer.sql`:
```sql
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('system', 'consumer', 'workflow', 'billing'));  -- adjust to include existing valid values
```
(Grep existing valid types first — the CHECK may already include what we need.)

`dispatchInApp` writes `{ type: 'consumer', user_id: recipient, title: subject, body, metadata, created_at: NOW() }`.

### 2.5 Retry policy — defined (added per review)

Per architect-owner review: "after max retries" wasn't specified.

**Retry policy:**
- `max_retries = 5`
- Backoff: exponential — `2^N` minutes (2, 4, 8, 16, 32 min between attempts)
- Max age: **24 hours** (a saved-search alert delivered 25h late is stale and useless — discard even if retries remain)
- After max retries OR max age: write `status = 'dead_letter'` to `consumer_notification_retries` OR to `consumer_notifications` (whichever surfaces to PA-NDL-001)

**Verify** `consumer_notification_retries` schema supports `attempt_count`, `next_retry_at`, `created_at`, `status` (with `dead_letter` as an allowed value). If schema needs extension, add migration `305e_notification_retries_dead_letter.sql`.

### 2.6 Rate limiting + batching (added per review)

Consumer notifications can be high volume — a saved search matching 10,000 users generates 10,000 emails instantly. Would DoS your own transport providers.

**Rate limits (CFG keys — seed defaults):**
- `NOTIFICATION_PER_TENANT_PER_HOUR` — default `1000`
- `NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES` — default `60` (same recipient + same alert_type within window is suppressed as duplicate)
- `NOTIFICATION_BATCH_SIZE` — default `100`
- `NOTIFICATION_INTER_BATCH_DELAY_MS` — default `100`

Batch dispatcher: when the retry worker or the saved-search-alert runner has > `NOTIFICATION_BATCH_SIZE` pending items, send in chunks with `NOTIFICATION_INTER_BATCH_DELAY_MS` between chunks.

Cooldown key: `hash(tenant_id + recipient + alert_type)` — TTL matches `NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES`.

Seed CFG keys in `305f_notification_rate_limit_defaults.sql`.

### 2.7 `metadata` field purpose (added per review)

Per architect-owner review: `metadata` is passed but no per-channel dispatcher uses it. Document its purpose so it's not dead weight.

`metadata` reserved for:
- `deep_link_url` — where to navigate the user when they tap the notification (in-app, push)
- `tracking_token` — attribution back to the source event (saved-search-id, campaign-id, listing-id)
- `alert_type` — used for cooldown deduplication (see §2.6)
- `priority` — for dispatcher scheduling (default 'normal', 'urgent' skips cooldown)
- Future: `action_buttons`, `image_url`, etc.

Add JSDoc + example to `dispatch.js`.

### 2.8 Dead-letter surfacing

After max retries or max age, item's `status = 'dead_letter'`. PA-NDL-001 (PA notifications dead-letter queue — currently MISSING in PA matrix, but the backend supports the read via `GET /api/admin/notifications/dead-letter` which already exists).

`dispatchConsumerNotification` writes an audit-log entry on transitions to `dead_letter` so PA can trace.

### 2.9 Update `processPendingNotificationRetries`

Currently around `server.js:3065-3100`. Move to `dispatch.js`. Update to:
- Distinguish `pending` (retry with backoff) vs `skipped` (do NOT retry — audit and drop OR surface to admin as misconfiguration)
- Emit dead-letter transition per §2.5

---

## 3. Non-negotiables

1. **`skipped` vs `pending` distinction** matters — never retry a `skipped` item, always retry a `pending` item with backoff.
2. **Recipient validation per channel** at dispatcher level, not transport level (§2.3).
3. **Dead-letter surfacing** — after max retries OR max age, `status='dead_letter'` + audit-log entry.
4. **No changes to `email.js` / `sms.js` / `whatsapp.js`** — call their existing exports.
5. **Extract dispatch to `lib/notifications/dispatch.js`** — server.js only imports + registers.
6. **Rate limits + batching** MUST be enforced (§2.6) — this prevents self-DoS.
7. **`metadata` field** documented with JSDoc + example (§2.7).

---

## 4. Test discipline

- **Fast + Real-Postgres suites green** (existing + new).
- **New tests** in `backend/src/lib/notifications/dispatch.postgres.test.js`:
  - Per-channel happy path (email / SMS / WhatsApp / in-app)
  - Per-channel recipient validation: reject mismatched formats with `skipped` status
  - Unconfigured transport: returns `skipped`, not retried
  - Transient failure: returns `pending` with `retry_after`, IS retried
  - Permanent failure (4xx from transport): `failed`, surfaces to dead-letter
  - Retry policy: after 5 attempts OR 24h, transition to `dead_letter`
  - Rate limit: per-tenant cap enforced
  - Cooldown: same recipient + alert_type within window returns `skipped` with cooldown code
  - Batch chunking: 200-item queue processed in 2 chunks with delay between
  - Push channel returns `PUSH_DEFERRED_TO_PART2` `skipped` code

---

## 5. Definition of done

1. `dispatch.js` module extracted; server.js imports it.
2. All 4 channels (email / SMS / WhatsApp / in-app) route correctly.
3. Unconfigured transports return `skipped`, not `pending`.
4. Dead-letter surfacing works — after max retries OR max age, `status='dead_letter'` set + audit entry.
5. Per-channel recipient validation rejects mismatched formats upfront.
6. Retry policy (5 attempts, 2^N min backoff, 24h max age) enforced.
7. Rate limits + cooldowns + batching per §2.6.
8. `metadata` documented.
9. Migrations 305d (notifications type enum) + 305e (retries dead_letter enum) + 305f (rate-limit CFG defaults) as needed.
10. Push channel returns explicit deferred-to-part2 code.
11. Fast + Real-Postgres CI green.

---

## 6. Handoff to PART2

Once this PR is merged, PART2 replaces the `case 'push':` branch in `dispatchConsumerNotification` with a real dispatcher backed by FCM.
