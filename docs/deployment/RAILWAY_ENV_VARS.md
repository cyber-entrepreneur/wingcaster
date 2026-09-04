# Railway env-var reference — Wingcaster

Curated inventory of every environment variable the backend reads at boot or at runtime, grouped by feature. Source of truth is the code — `grep -rhoE "process\.env\.[A-Z_][A-Z0-9_]+" backend/src | sort -u` returns 150 distinct names as of this doc. This file explains **which ones you need to set**, in what order, and what happens if you don't.

Companion to [RAILWAY_SERVICE_CHECKLIST.md](RAILWAY_SERVICE_CHECKLIST.md) (per-service tab configuration) and [POSTGIS_RAILWAY_SETUP.md](POSTGIS_RAILWAY_SETUP.md) (database provisioning).

---

## Tier 0 — App will not boot without these

Set these on the `wingcaster` service before first deploy.

| Var | Value / how to get it |
|---|---|
| `DATABASE_URL` | `postgresql://${{postgis.POSTGRES_USER}}:${{postgis.POSTGRES_PASSWORD}}@postgis.railway.internal:5432/${{postgis.POSTGRES_DB}}` — Railway variable-reference syntax |
| `JWT_SECRET` | 32+ char random. `openssl rand -base64 32` |
| `CREDENTIALS_ENCRYPTION_KEY` | 32-byte base64 key. `openssl rand -base64 32`. Used to encrypt per-tenant credential blobs at rest — rotating it invalidates every stored credential, so pick once and never rotate casually |
| `NODE_ENV` | `production` |

`PORT` is injected by Railway — do NOT set.

---

## Tier 1 — Auth / OTP delivery (Microsoft Graph)

The email dispatcher at [backend/src/lib/notifications/email.js:36](../../backend/src/lib/notifications/email.js#L36) auto-detects Microsoft Graph first when the four Azure vars are present. That's the intended production transport for Wingcaster.

| Var | Value / how to get it |
|---|---|
| `AZURE_TENANT_ID` | From Azure AD → the tenant you'll send mail from |
| `AZURE_CLIENT_ID` | From an Azure AD app registration with `Mail.Send` application permission (admin-consented) |
| `AZURE_CLIENT_SECRET` | The secret for that app registration |
| `MAIL_FROM` | The sender mailbox — must be a mailbox the app has been granted access to send as |
| `EMAIL_FROM` | Same as `MAIL_FROM` for other transports; set both to the same value |
| `GRAPH_SAVE_TO_SENT` | Optional, `true` / `false`. If true, the Graph transport saves each outbound to the sender mailbox's Sent Items |
| `EMAIL_PROVIDER` | Optional. Setting `graph` forces the Graph transport explicitly; leaving blank auto-detects and picks Graph when the four Azure vars are all set |

The dispatcher rejects mail with `EMAIL_UNCONFIGURED` if none of the transports is fully configured — OTP login, 2FA step-up, verification codes, dunning notices, and platform notifications all go through this same path.

**Alternate transports** (only if Microsoft Graph is not an option): `RESEND_API_KEY` + `RESEND_FROM_EMAIL`, or `SENDGRID_API_KEY` + `SENDGRID_FROM_EMAIL`, or the `SMTP_*` set (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM_EMAIL`), or the `SES_*` set. `SES` currently throws `SES_NOT_IMPLEMENTED` — the AWS SDK is not wired.

| Var | Purpose |
|---|---|
| `TOTP_ISSUER` | Human-readable name shown in Authenticator apps when a user enrolls TOTP 2FA. Set to `Wingcaster` |
| `SUPPORT_EMAIL` | Reply-to for OTP mails and lockout-recovery flows |
| `ADMIN_EMAIL` | The bootstrap platform admin |

---

## Tier 2 — Payments

Today: Stripe purchase-intents only.

| Var | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Server-side API key (test or live) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the notification destination |
| `STRIPE_PUBLISHABLE_KEY` | Frontend key for card entry |

Subscription / metered Stripe + Paddle Billing + manual-receipt paths (OMT / Whish / Monty / Bank Transfer / PayPal) are pending — see the pending-work notes in the refreshed HANDOVER.

---

## Tier 3 — Public URLs, CORS, proxy

| Var | Purpose |
|---|---|
| `APP_URL` | Canonical URL of the app; used in mail links |
| `PUBLIC_APP_URL` | Same idea for frontend |
| `PUBLIC_API_URL` | Public backend URL — used to compose Twilio inbound webhook URLs when running behind a proxy |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `FORCE_HTTPS` | `true` in production behind Railway's TLS terminator |
| `TRUST_PROXY` | `true` when behind Railway's proxy so `req.ip` reflects the real client |

---

## Tier 4 — Rate limits, sessions, retention

| Var | Purpose |
|---|---|
| `RATE_LIMIT_AUTH_MAX` | Max auth-endpoint attempts per window |
| `RATE_LIMIT_GENERAL_MAX` | Max requests per window for other endpoints |
| `WEBHOOK_TIMESTAMP_WINDOW_SECONDS` | Reject webhooks whose signature timestamp is older than this |
| `ACTIVITY_LOG_RETENTION_DAYS` | Days to keep activity log rows before pruning |
| `AUDIT_LOG_RETENTION_DAYS` | Days to keep audit-event rows |

---

## Tier 5 — Background workers

Every worker has an `_ENABLED` toggle and an `_INTERVAL_MS` cadence. Set `_ENABLED=false` on services that shouldn't run the worker (e.g., only one instance runs the billing scheduler).

- `BILLING_SCHEDULER_ENABLED`, `BILLING_SCHEDULER_INTERVAL_MS`, `BILLING_SCHEDULER_BATCH_SIZE`
- `CAMPAIGN_SCHEDULER_ENABLED`, `CAMPAIGN_SCHEDULER_INTERVAL_MS`, `CAMPAIGN_SCHEDULER_BATCH_SIZE`, `CAMPAIGN_AUTO_DISPATCH_ENABLED`
- `DISTRIBUTION_RETRY_WORKER_ENABLED`, `DISTRIBUTION_RETRY_WORKER_INTERVAL_MS`, `DISTRIBUTION_RETRY_WORKER_BATCH_SIZE`, `DISTRIBUTION_RETRY_MAX_ATTEMPTS`, `DISTRIBUTION_RETRY_BASE_DELAY_MS`
- `NOTIFICATION_RETRY_WORKER_ENABLED`, `NOTIFICATION_RETRY_WORKER_INTERVAL_MS`, `NOTIFICATION_RETRY_WORKER_BATCH_SIZE`
- `CONSUMER_AUTOMATION_WORKER_ENABLED`, `CONSUMER_AUTOMATION_WORKER_INTERVAL_MS`
- `COMMENT_CLASSIFIER_AI_ENABLED`, `COMMENT_CLASSIFIER_INTERVAL_MS`, `COMMENT_CLASSIFIER_BATCH_SIZE`
- `AREA_INTELLIGENCE_ENABLED`, `AREA_INTELLIGENCE_AI_PROVIDER`
- `AREA_INTELLIGENCE_SCORING_WORKER_ENABLED`, `AREA_INTELLIGENCE_SCORING_WORKER_INTERVAL_MS`
- `AREA_INTELLIGENCE_GOOGLE_REFRESH_WORKER_ENABLED`, `AREA_INTELLIGENCE_GOOGLE_REFRESH_WORKER_INTERVAL_MS`
- `MARKET_PRICING_ENABLED`, `MARKET_PRICING_WORKER_ENABLED`, `MARKET_PRICING_WORKER_INTERVAL_MS`, `MARKET_PRICING_JOB_BATCH_SIZE`, `MARKET_PRICING_JOB_MAX_ATTEMPTS`, `MARKET_PRICING_JOB_POLL_INTERVAL_MS`, `MARKET_PRICING_TREND_WORKER_INTERVAL_MS`, `MARKET_PRICING_ANALYSIS_EXPIRY_DAYS`

`BILLING_MODULE_ENABLED` gates the entire fin.* billing subsystem — leave unset (default false) until you're ready to expose billing endpoints and workers.

---

## Tier 6 — Social channels

Set only the ones you plan to activate.

**Meta / Facebook / Instagram:**
- `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_GRAPH_VERSION`
- `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `FACEBOOK_VERIFY_TOKEN`, `FACEBOOK_PROVIDER`
- `INSTAGRAM_PAGE_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `INSTAGRAM_SHARE_REEL_TO_FEED`

**TikTok:** `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_WEBHOOK_SECRET`

**X / Twitter:** `X_API_KEY`, `X_API_KEY_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `X_BEARER_TOKEN`, `X_OAUTH_CLIENT_ID`, `X_OAUTH_CLIENT_SECRET`, `X_WEBHOOK_SECRET`

**LinkedIn:** `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN`, `LINKEDIN_API_VERSION`

**WhatsApp:** `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_DEFAULT_RECIPIENT`, `WHATSAPP_LISTINGS_AI_PROVIDER`, `WHATSAPP_LISTINGS_FALLBACK_AI_PROVIDERS`, `WHATSAPP_LISTINGS_OPENAI_API_KEY`, `WHATSAPP_LISTINGS_GEMINI_API_KEY`

---

## Tier 7 — SMS (Twilio)

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_SMS_WEBHOOK_URL`

If behind Railway's proxy and Twilio's webhook URL is a route on your service, set `PUBLIC_API_URL` and let the app compose the URL.

---

## Tier 7b — Push (FCM)

Consumer push (iOS via APNS relay, Android native, FCM web tokens) is dispatched by [backend/src/lib/notifications/push.js](../../backend/src/lib/notifications/push.js). JWT signing and the OAuth access-token cache are handled by `google-auth-library` inside `firebase-admin` — do not mint tokens by hand.

| Var | Purpose |
|---|---|
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase service-account JSON key. Base64-encode it to fit in an env var; the process accepts raw JSON as well and decodes in-process. |
| `FCM_PROJECT_ID` | Optional. Inferred from the service account JSON `project_id` when unset. |

If these are missing, push dispatches return `skipped` with code `PUSH_UNCONFIGURED` and are **not** retried. The rest of notification dispatch (email / SMS / WhatsApp / in-app) is unaffected.

---

## Tier 8 — AI providers

Provider selection uses per-feature env vars like `LISTINGS_AI_PROVIDER`, `MARKET_PRICING_AI_PROVIDER`, `AREA_INTELLIGENCE_AI_PROVIDER`, `WHATSAPP_LISTINGS_AI_PROVIDER`. Fallback ordering uses `MARKET_PRICING_FALLBACK_AI_PROVIDERS`, `WHATSAPP_LISTINGS_FALLBACK_AI_PROVIDERS`.

Depending on which providers you enable per-feature, set some subset of `OPENAI_API_KEY`, `GEMINI_API_KEY` (or `WHATSAPP_LISTINGS_GEMINI_API_KEY`), `ANTHROPIC_API_KEY`.

**Metered AI producers** (`createAiPost`, `rateProperty`):
- `AI_PROVIDER_PRIMARY` (default `openai`)
- `AI_PROVIDER_FALLBACK` (default `anthropic`)
- `OPENAI_MODEL_POST_CREATION` (default `gpt-4o-mini`)
- `OPENAI_MODEL_PROPERTY_RATING` (default `gpt-4o-mini`)
- `ANTHROPIC_MODEL_POST_CREATION` (default `claude-haiku-4-5`, resolved to `claude-haiku-4-5-20251001` for pricing)
- `ANTHROPIC_MODEL_PROPERTY_RATING` (default `claude-haiku-4-5`, resolved to `claude-haiku-4-5-20251001` for pricing)

---

## Tier 9 — External data / integrations

- `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_BUDGET_USD_MONTHLY`, `GOOGLE_MAPS_RATE_LIMIT_PER_MINUTE`
- `GOVERNMENT_RECORDS_API_URL`, `GOVERNMENT_RECORDS_API_KEY`
- `SAYRAFA_API_URL`, `SAYRAFA_API_KEY` — Lebanese central-bank exchange rate feed
- `MARKET_PRICING_BASE_CURRENCY`, `MARKET_PRICING_DEFAULT_CURRENCY_RATE_SOURCE`, `MARKET_PRICING_CURRENCY_RATE_SOURCES`, `MARKET_PRICING_DEFAULT_PARALLEL_RATE`, `MARKET_PRICING_RATE_FRESH_HOURS`, `MARKET_PRICING_RATE_MAX_STALE_HOURS`
- `BANNERBEAR_API_KEY`, `BANNERBEAR_PROJECT_API_KEY`, `BANNERBEAR_WEBHOOK_URL`, `BANNERBEAR_FORCE_SYNCHRONOUS`
- `IMAGE_FETCH_MAX_BYTES`, `IMAGE_FETCH_TIMEOUT_MS`
- `VIEWING_REMINDER_LEAD_MINUTES`, `VIEWING_NO_SHOW_GRACE_MINUTES`

---

## Tier 10 — Observability, verbosity

- `LOG_LEVEL`, `BILLING_LOG_LEVEL`, `LISTINGS_AI_LOG_LEVEL`, `SOCIAL_CARDS_LOG_LEVEL`

---

## Postgres tuning

- `PG_CONNECTION_TIMEOUT_MS`
- `PG_SSL`
- `TEST_DATABASE_URL` — only for local test runs against a real Postgres

---

## Do NOT set

- `PORT` — Railway injects
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` on the `wingcaster` service — those live on the `postgis` service only
- `VITEST` — vitest sets this itself during test runs
- `SMOKE_ADMIN_EMAIL` — used only by smoke-test scripts, never in production

---

## Removed in the strip (no longer read anywhere)

PR #24 (commit `d4d475c`) removed the entire cutover ceremony. As a result these variables — if present on Railway from an earlier era — are dead and can be deleted with no effect:

- `FIN_CUTOVER_SKIP_ATTESTATION_GATE`
- Any other `FIN_CUTOVER_*` name (grep confirms zero references remain in code or docs)

Leaving them set costs nothing; removing them tidies the Variables tab.
