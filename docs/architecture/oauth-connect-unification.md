# WingCaster — OAuth 2.0 Authorization Code Unification

Architecture & Cursor Implementation Pack
Author: Architecture (Claude, Opus 4.8) · Date: 2026-09-21 · Status: Approved design, ready to implement

## 0. Mandate & quality bar

Convert every social channel (Facebook, Instagram, LinkedIn, X, TikTok) — and every communication platform where the provider supports it (WhatsApp via Meta, Email via Google & Microsoft) — so the primary connection method is the OAuth 2.0 Authorization Code Flow. The existing manual credential/token-paste path is retained only as a fallback when OAuth is unconfigured or fails, or for providers with no Authorization Code Flow (Telegram bot token, Twilio, SMTP/API-key email).

Quality bar for every PR in this pack: enterprise-grade, at par with or better than best-of-breed platforms (Hootsuite, Sprout Social, Buffer, Later, HubSpot, Salesforce Marketing Cloud). That means: real PKCE, real token refresh, DB-enforced tenant isolation (RLS), single-use CSRF state, encrypted tokens at rest, step-up MFA on credential-rotation surfaces, graceful re-auth UX, and full test + CI coverage. "It works in the happy path" is not the bar.

Roles: Architecture (this document) owns the design, the provider matrix, the PR sequencing, and the acceptance criteria. Cursor implements each PR from the self-contained prompts in §6. Do not deviate from the design without escalating to Architecture.

## 1. What exists today (audited 2026-09-21, cross-verified against code)

Two independent OAuth scaffolds exist; neither is reusable as-is.

- Login OAuth — `backend/src/lib/wave0-nav-routes.js` ("Sign in with Google/Apple/Facebook"). No PKCE. Login-only (404s unknown identities). Frontend half-wired (`auth_url` vs `url` mismatch in `web/src/components/auth/loginApi.ts:135`, no callback page).
- Channel-connect OAuth — `backend/src/server.js:5423–5621` (per-tenant X/TikTok). Fake PKCE (`code_challenge = state`, method=plain, `server.js:5486–5490,5530`). Popup + postMessage.

### Connection-method matrix (today)

| Channel | Today's primary | Token storage | Provider Auth-Code? | Refresh today |
|---|---|---|---|---|
| Facebook | Manual paste `fb_page_id` | env `FACEBOOK_PAGE_ACCESS_TOKEN` + encrypted override | Yes Meta Login (long-lived) | none |
| Instagram | Manual paste `ig_business_account_id` | Meta model | Yes via Meta (IG↔Page) | none |
| LinkedIn | Manual paste `li_author_urn` | env `LINKEDIN_ACCESS_TOKEN` + override | Yes OAuth2 + refresh | none |
| X | OAuth (partial, fake PKCE) | per-tenant encrypted access+refresh | Yes Auth-Code + PKCE + refresh | stored, never used |
| TikTok | OAuth (partial) | per-tenant encrypted access+refresh | Yes Auth-Code + refresh | stored, never used |
| WhatsApp | env `META_ACCESS_TOKEN` system-user | env only | Yes Embedded Signup (heavier) | n/a |
| Email (MS Graph OTP) | app-only client_credentials | env `AZURE_*` | Yes delegated Auth-Code (per-tenant) | app-token re-mint only |
| Email (SMTP/Resend/SendGrid/SES) | API keys | env | No (Gmail/Graph is the OAuth path) | n/a |
| Telegram | per-tenant bot token | encrypted | No | n/a |
| SMS (Twilio) | API keys | env | No | n/a |

### The five gaps (all confirmed)

1. No token refresh anywhere. Refresh tokens are captured, encrypted, stored, and even decrypted into `resolveConnectionCredentials` (`backend/src/lib/credentials.js:170`) — but no code path reads `oauth_refresh_token` or POSTs `grant_type=refresh_token`. X/TikTok tokens die silently on expiry.
2. PKCE is fake — no real S256 verifier anywhere in the repo.
3. `oauth_states` is an untyped JSONB bucket (`legacy_collections`) — no migration, no typed table.
4. No shared OAuth helper — two divergent copies; PKCE, state, exchange all duplicated inline.
5. `marketplace_connections` has NO RLS. Tenant isolation is JS `agent_id` predicates only, no DB backstop (unlike `channel_connections`, which IS RLS-protected — migration 543). This is the known findAll-untenanted-leak pattern. Additionally the OAuth start/callback routes lack the step-up MFA that the manual `/my-connections` paths enforce.

### Key file references

- `backend/src/lib/credentials.js` — `PLATFORM_INTEGRATION_MODEL`, `PLATFORM_CONNECTION_FIELDS`, `resolveConnectionCredentials`, AES-256-GCM `encryptSecret`/`decryptSecret`/`tryDecrypt`.
- `backend/src/server.js:5298–5670` — social-channels config/list/upsert/delete + OAuth start/callback + `sanitizeSocialConnection`, `normalizeEnterpriseTargets`.
- `backend/src/lib/social/personal-connections-routes.js` — `/api/social-channels/my-connections/*` (agent-scoped label identities, step-up gated, no tokens).
- `backend/src/lib/social-publishing/platform-dispatch.js` — publish dispatcher; consumes `oauth_access_token` as a static bearer (no refresh).
- `backend/src/lib/publish-readiness.js` — `tenantHasPublishToken`, `assertPublishChannelConfigured` (readiness env-var names diverge from adapter env-var names — reconcile in PR2).
- `backend/src/lib/notifications/{facebook,instagram,linkedin,x,tiktok,telegram,email}.js`, `backend/src/whatsapp.js`, `backend/src/lib/notifications/transports/graph.js`.
- `backend/src/persistence/migrations/007_distribution.sql` (`marketplace_connections` base), `441_personal_channel_accounts.sql`, `543_growth_os_channel_tables.sql` (RLS reference pattern), `012_legacy_collections.sql`.
- `backend/src/persistence/table-mapper.js:411–418` (`marketplace_connections` mapping; settings lives in the `data` JSONB blob), `:979–981` (legacy fallback).
- `web/src/pages/SocialChannelsPage.tsx`, `web/src/api/client.ts:3404–3563` (channel/oauth/personal API methods).

## 2. Target architecture

### 2.1 Connection method model

Every social/comms platform declares:

```
supported_methods: ['oauth', 'manual']   // ordered; first is primary
primary_method:    'oauth'
```

Each `marketplace_connections` row records `connect_method: 'oauth' | 'manual'` so the UI and publish path know which credential shape to use. Manual is auto-surfaced only when: (a) the provider's OAuth app is unconfigured for this environment, or (b) an OAuth attempt failed, or (c) the provider has no Authorization Code Flow.

### 2.2 App-credential model (decision)

Single global WingCaster app per provider is primary (best-of-breed standard), resolved through an app-credential registry rather than hard-coded env reads:

```
resolveAppCredential(provider, { env, region, agencyId? })
  -> { client_id, client_secret, redirect_uri, scopes }
```

Default resolves the global app from config/env (`<PROVIDER>_OAUTH_CLIENT_ID/SECRET`). The signature carries `agencyId` and `region` from day one so a future BYO-app enterprise override or regional/rate-limit sharding drops in without touching call sites. Do not build the BYO UI now; just make the seam exist.

### 2.3 Shared OAuth module — `backend/src/lib/oauth/`

New, single source of truth used by all channels (and eventually refactor login OAuth onto it):

| File | Responsibility |
|---|---|
| `provider-registry.js` | Declarative per-provider config: authUrl, tokenUrl, scopes, usesPKCE, pkceMethod, supportsRefresh, tokenStyle (`bearer` \| `meta_longlived`), authExtraParams, `resolveIdentity(token)`, redirectPath, appCredentialKey. |
| `pkce.js` | Real PKCE: cryptographically random `code_verifier` (43–128 chars) + S256 `code_challenge`. |
| `state-store.js` | Typed `oauth_states` CRUD: create (mint id + store `code_verifier_encrypted`, agent_id, agency_id, platform, redirect_uri, return_to, elevated, nonce, expires_at), consumeOnce (atomic single-use + expiry + platform/agency match), GC of expired rows. |
| `token-exchange.js` | Generic `authorization_code` and `refresh_token` grants; provider auth style (Basic header vs body secret vs client_key); robust error mapping. |
| `token-store.js` | `persistTokens(connection, tokenSet)` (encrypt access+refresh, store scope/expiry/user id); `getFreshAccessToken(connection)` — the single seam that checks expires_at, refreshes when stale (provider-aware), re-encrypts, and returns a valid token. Concurrency-safe (no thundering-herd refresh). |
| `app-credentials.js` | `resolveAppCredential(provider, ctx)` registry described in §2.2. |
| `index.js` | Public surface: `buildAuthorizeUrl`, `handleCallback`, `getFreshAccessToken`, `startConnect`. |

### 2.4 Connect flow (per tenant)

```
[Connect with <Provider>]
  → POST /api/social-channels/oauth/:platform/start   (authMiddleware + requireElevated step-up)
      · resolveAppCredential(provider, {env, region, agencyId})
      · mint PKCE verifier + S256 challenge (if usesPKCE)
      · persist oauth_state { agent_id, agency_id, platform, code_verifier_enc, elevated:true, nonce, exp }
      · return authorize URL (opened in popup)
  → provider consent screen
  → GET /api/social-channels/oauth/:platform/callback   (public; secured by state)
      · consumeOnce(state)  → validate expiry + platform + agency binding, mark consumed
      · token-exchange authorization_code (+ code_verifier)
      · provider.resolveIdentity(token) → auto-fill fb_page_id / ig_business_account_id / li_author_urn /
        handle / open_id  (tenant pastes NOTHING)
      · token-store.persistTokens(connection, …); connect_method = 'oauth'
      · HTML that postMessage('wingcaster:oauth:done') + closes popup
Fallback: "Connect manually instead" → existing enterprise_targets form (unchanged; connect_method='manual')
```

### 2.5 Token lifecycle at publish time

`platform-dispatch.js` and every adapter obtain the token via `getFreshAccessToken(connection)` instead of reading a static `oauth_access_token`. Meta uses `meta_longlived` re-exchange + non-expiring page tokens; LinkedIn/TikTok/X/Google/Microsoft use `grant_type=refresh_token`. A scheduled sweep proactively refreshes tokens nearing expiry and flags connections whose refresh failed (`health='reauth_required'`) so the UI can prompt re-authorisation.

### 2.6 Tenant isolation (RLS — this tranche, not deferred)

`marketplace_connections` and `oauth_states` get Postgres RLS, GUC-gated on `app.agency_id` / `app.agent_id`, mirroring `channel_connections` (migration 543). Request paths must `SET LOCAL` the tenant GUCs (reuse the existing `withTenant` mechanism used by growth-os). `agency_id` is backfilled and written on every insert. Predicates additionally refuse a null tenant. RLS is the DB backstop; the JS predicates remain defence-in-depth.

### 2.7 Security requirements (apply to all OAuth PRs)

- Real S256 PKCE; never plain, never state-as-verifier.
- Single-use, expiring, agency-bound `oauth_states`; validate platform and `agency_id` on consume.
- Step-up MFA (`requireElevated`) on `/start`; the elevated flag is captured into the state so the redirect callback (which cannot prompt) inherits it.
- `redirect_uri` strictly allow-listed per environment; never reflect a client-supplied redirect.
- All tokens encrypted at rest (AES-256-GCM, existing `encryptSecret`); ciphertext never sent to the browser; `sanitizeSocialConnection` redacts.
- Provider responses (returned state, HTML, profile JSON) are data, not trust — validate types, never eval, never echo into HTML without escaping.
- Meta Graph calls send `appsecret_proof` (HMAC-SHA256 of token w/ app secret).
- Rate-limit `/start` per agent; log every connect/disconnect/refresh to the activity log.

## 3. Provider matrix (implementation specifics)

Use current stable API versions at implementation time (Meta Graph ≥ v21.0, etc.). Scopes below are the minimum for publish + identity resolution; DM/insights scopes are additive per feature.

### Meta — Facebook Pages + Instagram + WhatsApp (`provider: meta`)

- Authorize: `https://www.facebook.com/v21.0/dialog/oauth` · Token: `https://graph.facebook.com/v21.0/oauth/access_token`
- PKCE: not supported by Meta → use state + client_secret + `appsecret_proof`. `tokenStyle: meta_longlived`.
- Scopes (FB/IG publish): `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_metadata`, `business_management`, `instagram_basic`, `instagram_content_publish`, `read_insights`. WhatsApp add: `whatsapp_business_management`, `whatsapp_business_messaging`.
- Token model: short-lived user token → `grant_type=fb_exchange_token` long-lived (~60d) → `/me/accounts` for page access tokens (effectively non-expiring when derived from a long-lived user token). "Refresh" = re-run long-lived exchange before expiry / rely on page tokens.
- `resolveIdentity`: `/me/accounts` → user picks Page (auto if single) → store `fb_page_id` + encrypted page token; `/{page-id}?fields=instagram_business_account` → store `ig_business_account_id`.
- WhatsApp: Meta Embedded Signup (adds WABA + phone-number registration on top of the OAuth token). Heavier; PR7.

### LinkedIn (`provider: linkedin`)

- Authorize: `https://www.linkedin.com/oauth/v2/authorization` · Token: `https://www.linkedin.com/oauth/v2/accessToken`
- PKCE: optional (LinkedIn uses client_secret); implement standard flow. Refresh: `grant_type=refresh_token` (access ~60d, refresh ~365d; requires programmatic-access approval).
- Scopes: `openid profile email w_member_social` (member posts); org pages add `w_organization_social r_organization_social rw_organization_admin`.
- `resolveIdentity`: OIDC `GET /v2/userinfo` → `sub` → `urn:li:person:{sub}`; org via `/rest/organizationAcls`.

### X / Twitter (`provider: x`)

- Authorize: `https://twitter.com/i/oauth2/authorize` · Token: `https://api.twitter.com/2/oauth2/token`
- PKCE: required, S256. Confidential client → HTTP Basic on token endpoint. Refresh: `offline.access` → `grant_type=refresh_token`.
- Scopes: `tweet.read tweet.write users.read offline.access` (+ `dm.read dm.write` for DMs).
- `resolveIdentity`: `GET /2/users/me` → id + handle.

### TikTok (`provider: tiktok`)

- Authorize: `https://www.tiktok.com/v2/auth/authorize/` · Token: `https://open.tiktokapis.com/v2/oauth/token/`
- Uses `client_key`/`client_secret`. PKCE: supported/recommended. Refresh: `grant_type=refresh_token`.
- Scopes: `user.info.basic,video.publish,video.upload`.
- `resolveIdentity`: token response `open_id`; `/v2/user/info/` for handle.

### Google — Gmail/email (`provider: google`)

- Authorize: `https://accounts.google.com/o/oauth2/v2/auth` (`access_type=offline`, `prompt=consent`) · Token: `https://oauth2.googleapis.com/token`
- PKCE: recommended (S256). Refresh: `grant_type=refresh_token`.
- Scopes: `openid email profile https://www.googleapis.com/auth/gmail.send` (+ `gmail.readonly`/`gmail.modify` for inbound).
- Send: Gmail API `users.messages.send` or SMTP XOAUTH2.

### Microsoft — Outlook/Graph delegated (`provider: microsoft`)

- Authorize: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` · Token: `.../common/oauth2/v2.0/token`
- PKCE: recommended (S256). Refresh: `offline_access` → `grant_type=refresh_token`.
- Scopes: `offline_access openid email profile User.Read Mail.Send Mail.ReadWrite`.
- Send: Graph `POST /me/sendMail`. Keep the existing app-only client-credentials Graph transport for platform OTP (`transports/graph.js`) untouched — this is a separate, per-tenant delegated mailbox connection.

### No Authorization Code Flow → manual only

Telegram (bot token), Twilio SMS (API keys), SMTP/Resend/SendGrid/SES (keys). These keep the manual form; label them "manual connection" (not a failure state).

## 4. PR sequence & dependencies

Migrations land first and tiny (avoids Real-PG CI breakage on parallel PRs). Every PR targets `main`.

| PR | Title | Depends on |
|---|---|---|
| 0 | Migrations: typed `oauth_states` + `connect_method`/`agency_id` columns | — |
| 1 | Shared `lib/oauth/` core + real PKCE; refactor X/TikTok onto it | 0 |
| 2 | Token refresh at publish time (`getFreshAccessToken` seam) | 1 |
| 3 | Unified connect UX + config model (`supported_methods`/`primary_method`, manual-fallback card) | 1 |
| 4 | Meta OAuth — Facebook + Instagram (auto-resolve targets) | 1, 3 |
| 5 | LinkedIn OAuth (+ refresh, author-URN resolution) | 1, 3 |
| 6 | Tenant-scoping: RLS on `marketplace_connections` + `oauth_states` + step-up on OAuth routes | 0, 1 |
| 7 | WhatsApp via Meta Embedded Signup | 4 |
| 8 | Email OAuth — Google + Microsoft delegated (per-tenant mailbox); manual key fallback | 1 |

Core social deliverable = PR 0–6. PR 6 (RLS) is required in this tranche, not a fast-follow. PR 7–8 (comms) can proceed in parallel once PR1/PR4 land.

## 5. Global engineering standards (every PR must satisfy)

- Verify CI the way CI does. Before opening the PR run, from the affected package(s): `npm ci`, `npx tsc --noEmit` (web + backend), `npm run build`, and the relevant test suites. Do not claim green from a shortcut that skips typecheck. Ship `package-lock.json` with any `package.json` change.
- Migrations first & isolated. Any new column / table / constraint ships in PR0 (or its own tiny migration PR) that lands before dependent feature PRs. Never bundle a shared-constraint migration inside a feature PR.
- Real-PG tests for every persistence path (RLS, token store, state store, connection upsert). Use distinct unique-window keys per test to avoid unique-constraint collisions across sibling tests.
- Tenant safety. No `findAll` + JS filter on an un-RLS'd shared table for tenant data. Scope in SQL; refuse null tenant. After PR6, rely on RLS + defence-in-depth predicates.
- Secrets. All tokens/secrets AES-256-GCM encrypted at rest via existing `encryptSecret`. Never log plaintext tokens. Never return ciphertext to the browser.
- No secret weakening for tests. If a Real-PG gate 403s, diagnose gate-vs-seed; never soften a production gate to make a test pass.
- Full-read QA. Author is responsible for an end-to-end read of every new file before marking ready.
- Conventional commits, PR body ends with the standard generated-with attribution, PR targets `main`.
- Feature-flag each new provider connect behind a config flag so it can be dark-launched and rolled back without a revert.
- Model: composer-2.5. Do not use Opus or gpt-5.6-sol (blocked until 2026-10-18).
- Keep PRs draft until CI is green and mergeability is CLEAN. Do not merge unless asked.
- Re-check migration max on `origin/main` before numbering. Known occupants: SEO 790–792, experiments 750–751, access requests 810 (`#368`). Use the next free numbers above the current max. Do not reuse 481 or collide with 790–810.

## 6. Cursor implementation prompts

### PR0 — Migrations: typed oauth_states + connection columns

SCHEMA ONLY — no behavior change, no route edits.

1. A migration creating a typed `oauth_states` table with columns: `id TEXT PK`, `agent_id TEXT`, `agency_id TEXT`, `platform TEXT NOT NULL`, `code_verifier_encrypted TEXT`, `redirect_uri TEXT`, `return_to TEXT`, `elevated BOOLEAN DEFAULT false`, `nonce TEXT`, `consumed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT now()`, `expires_at TIMESTAMPTZ NOT NULL`. Index on `(platform)`, and on `(expires_at)` for GC. Follow existing migration numbering/format. Do NOT enable RLS yet (PR6 does, after code sets GUCs) — but design columns so RLS on `agency_id`/`agent_id` is trivial to add.
2. Register `oauth_states` in `backend/src/persistence/table-mapper.js` (typed columns above; anything not a column rides the `data` JSONB blob). It currently falls through to `legacy_collections` — replace that with a real mapping.
3. Add columns to `marketplace_connections`: `connect_method TEXT` (values `'oauth'|'manual'`, nullable for legacy rows) and ensure `agency_id` is populated — add a backfill from the owning agent's agency for existing rows. Register `connect_method` in the table-mapper column list.
4. Real-PG test proving: `oauth_states` round-trips typed columns; `marketplace_connections` carries `connect_method` + `agency_id`. Use distinct keys per test.

Guardrails: existing X/TikTok OAuth writes rows to the legacy `oauth_states` bucket TODAY. Since states are short-lived (10 min) a clean cutover is acceptable, but confirm no in-flight reader breaks: keep the read path (`server.js:5507`) working against the new typed table. Do not touch `server.js` OAuth logic beyond what the table rename/typing forces. Run backend `npm ci && npx tsc --noEmit && npm test` for the persistence suite. Migrations-first, its own PR, targets main. Also copy this architecture doc into the repo at `docs/architecture/oauth-connect-unification.md` if that path does not already exist (docs-only addition is allowed in this PR).

### PR1 — Shared lib/oauth/ core + real PKCE; refactor X/TikTok onto it

Depends on PR0. Build `backend/src/lib/oauth/`:

- `provider-registry.js`: declarative config for providers `x`, `tiktok` (this PR), with the SHAPE ready for meta/linkedin/google/microsoft: `{ authUrl, tokenUrl, scopes, usesPKCE, pkceMethod, supportsRefresh, tokenStyle, authExtraParams, resolveIdentity(token), redirectPath, appCredentialKey }`.
- `pkce.js`: cryptographically-random `code_verifier` (43–128 chars, RFC 7636) + S256 `code_challenge`. Unit tests with known vectors. THIS REPLACES the fake `plain`/state-as-verifier hack at `server.js:5486-5490, 5530` — remove it.
- `app-credentials.js`: `resolveAppCredential(provider, { env, region, agencyId })` → `{ client_id, client_secret, redirect_uri, scopes }`. Default reads global env (`X_OAUTH_CLIENT_ID/SECRET`, `TIKTOK_CLIENT_KEY/SECRET`) but the signature MUST carry `agencyId`+`region`. Do not build BYO UI.
- `state-store.js`: `create()` (mint id, store `code_verifier_encrypted` via existing `encryptSecret`, agent_id, agency_id, platform, redirect_uri, return_to, elevated, nonce, expires_at), `consumeOnce()` (atomic single-use: reject if missing/expired/consumed/platform-mismatch/agency-mismatch; mark `consumed_at`), `gcExpired()`. Uses the typed `oauth_states` table from PR0.
- `token-exchange.js`: `exchangeCode({provider, code, codeVerifier, redirectUri})` and `refreshToken({provider, refreshToken})` — X = HTTP Basic; TikTok = `client_key`+`client_secret` in body. Robust error mapping (never leak secrets).
- `token-store.js`: `persistTokens(connection, tokenSet)` and `getFreshAccessToken(connection)` — checks `expires_at`, refreshes when within a safety window, re-encrypts, returns valid token. Concurrency-safe (per-connection in-process lock).
- `index.js`: `buildAuthorizeUrl`, `startConnect`, `handleCallback`, `getFreshAccessToken`.

Refactor `server.js:5423-5621` (X/TikTok start/callback) to use this module. BEHAVIOR-PRESERVING for the happy path EXCEPT: (a) real PKCE now, (b) states in the typed table, (c) step-up flag captured (wiring of `requireElevated` is PR6 — just thread the `elevated` field). Keep the popup postMessage `'wingcaster:oauth:done'` contract intact (`SocialChannelsPage.tsx:81`).

Tests: unit (pkce vectors, provider-registry, token-exchange with mocked fetch, getFreshAccessToken refresh path incl. expired→refreshed and refresh-failure→health flag). Real-PG for state-store `consumeOnce` single-use + expiry + agency-mismatch rejection. Do NOT wire refresh into the publish path yet (that's PR2).

### PR2 — Token refresh at publish time

Depends on PR1. Close the "refresh token stored but never used" gap for X and TikTok.

- In `platform-dispatch.js` and `publish-social-channel.js`, replace the direct read of `creds.oauth_access_token` with `getFreshAccessToken(connection)` for x and tiktok. On refresh failure, set connection `health='reauth_required'` and throw typed `REAUTH_REQUIRED`.
- Reconcile env-var-name divergence: `publish-readiness.js` requires `META_APP_SECRET`/`META_PAGE_TOKEN` while fb/ig adapters read `FACEBOOK_PAGE_ACCESS_TOKEN` / `INSTAGRAM_PAGE_ACCESS_TOKEN`. Make readiness check the SAME names the adapters actually consume.
- Scheduled sweep (reuse metadata-refresh job pattern at `server.js:836`) that proactively refreshes tokens within N of expiry and flags refresh failures. Idempotent, tenant-safe, logged.

### PR3 — Unified connect UX + config model

Depends on PR1.

Backend: extend `PLATFORM_CONNECTION_FIELDS` so each platform declares `supported_methods` and `primary_method`. This PR: x/tiktok → `['oauth','manual']` primary `'oauth'`; fb/ig/linkedin/whatsapp remain manual-primary for now but the SHAPE must be present. `GET /api/social-channels/config` returns these. `sanitizeSocialConnection` includes `connect_method` and token status `{ connected, method, scope, expires_at, health }`.

Frontend (`SocialChannelsPage.tsx` + `client.ts`): OAuth-primary PlatformCard with prominent "Connect with Provider"; collapsible "Connect manually instead" revealing existing enterprise_targets form. If oauth unsupported/unconfigured, show manual as primary labeled "manual connection". Show health, expiry, "Re-authorise" when `health='reauth_required'`. Keep popup + `'wingcaster:oauth:done'`. `--lc-*` tokens only. If adding a named export to `@/api/client` used at page top level, ALSO add it to hand-listed client mocks in `a11y-top-pages.rtl.test.tsx` and `screens.rtl.test.tsx`.

### PR4 — Meta OAuth: Facebook + Instagram

Depends on PR1, PR3. Add provider `meta`: Graph ≥ v21.0, scopes listed in §3, `usesPKCE:false`, `tokenStyle:'meta_longlived'`, `resolveIdentity` (short→long-lived, `/me/accounts`, IG business account). `appsecret_proof` on all Graph calls. Page picker if >1 page; auto-select if one. Store `fb_page_id` + encrypted page token and `ig_business_account_id` without paste. `connect_method='oauth'`. Manual fallback retained. Feature-flag.

### PR5 — LinkedIn OAuth

Depends on PR1, PR3. Provider `linkedin` with refresh, OIDC userinfo → `urn:li:person:{sub}`, org via organizationAcls. Author picker if person + org. Feature-flag. Handle refresh-approval-not-granted with re-auth prompt.

### PR6 — Tenant-scoping: RLS + step-up

Depends on PR0, PR1. REQUIRED this tranche. RLS on `marketplace_connections` and `oauth_states`, GUC-gated on `app.agency_id` / `app.agent_id`, modelled on migration 543. Own tiny migration. Every read/write path `SET LOCAL` via `withTenant`. `requireElevated()` on OAuth `/start`; callback honors `elevated` captured in state. Convert remaining `findAll`+JS-filter on `marketplace_connections` to tenant-scoped SQL. Real-PG: cross-tenant blocked, owner allowed, null-GUC denied. Never weaken a gate.

### PR7 — WhatsApp via Meta Embedded Signup

Depends on PR4. Extend meta provider: Embedded Signup, WABA + phone number, durable token. Store `wa_phone_number_id` + `wa_business_account_id` + encrypted token. Env/manual path in `whatsapp.js` remains fallback; OAuth connection preferred. Preserve `whatsapp_welcome` email. Feature-flag.

### PR8 — Email OAuth: Google + Microsoft

Depends on PR1. Per-tenant delegated mailbox. Providers `google` and `microsoft` with PKCE S256 + offline refresh. New transport sends via Gmail API / Graph `/me/sendMail` when a mailbox is connected; else existing SMTP/Resend/SendGrid chain. DO NOT change app-only client-credentials Graph transport for platform OTP (`transports/graph.js`). Feature-flag google and microsoft independently. Real-PG RLS scoping depends on PR6 landing.

## 7. Open compliance/product notes

Provider app review is the critical-path external dependency. Publishing scopes on Meta, LinkedIn, X, and TikTok require app review that can take weeks. Start submissions in parallel with PR1 — code readiness does not imply provider approval.

Data-deletion / de-authorization callbacks (Meta data deletion, provider webhook on token revocation) are a follow-up once PR4/PR7 land.

BYO-app enterprise override is deferred (seam exists per §2.2).
