# PR1 — Shared `lib/oauth/` core + real PKCE; refactor X/TikTok onto it

**GATE: do not start until PR0 (#371) is merged to `main`.** Cut this branch fresh from `main`
(suggested: `cursor/oauth-pr1-core`). Design reference: `docs/architecture/oauth-connect-unification.md`
§2.3–2.4, §3. Full design context there; this prompt is self-contained.

**Quality bar:** enterprise-grade, at par with or better than best-of-breed platforms (Hootsuite, Sprout
Social, Buffer, HubSpot). "Works in the happy path" is not the bar.

---

## Context (what exists in `main` after PR0)

- PR0 added the typed `oauth_states` table (migration 793), its table-mapper entry, and a `connect_method`
  column on `marketplace_connections` (migration 794).
- Today's X/TikTok OAuth lives inline in `backend/src/server.js:5423–5621` with **fake PKCE**
  (`code_challenge = state`, `method=plain` at `server.js:5486–5490,5530`) — replace it.
- AES-256-GCM helpers exist: `encryptSecret`/`decryptSecret`/`tryDecrypt` in `backend/src/lib/credentials.js`.
- OAuth app creds are global env today: `X_OAUTH_CLIENT_ID/SECRET`, `TIKTOK_CLIENT_KEY/SECRET`
  (`server.js:5425–5445`).
- Front-end popup listens for `postMessage({type:'wingcaster:oauth:done'})` at
  `web/src/pages/SocialChannelsPage.tsx:81` — keep that contract.
- Refresh tokens are stored but never used (`credentials.js:170` decrypts `oauth_refresh_token`, no
  consumer) — you build the seam here; wiring into publish is PR2.

## Goal

Create `backend/src/lib/oauth/` as the single source of truth for channel OAuth, with **real** PKCE and a
token-refresh seam, then refactor the X/TikTok start/callback onto it (behaviour-preserving except the
security fixes).

## Deliverables — `backend/src/lib/oauth/`

- `provider-registry.js` — declarative config for `x` and `tiktok` now, with the SHAPE ready for
  meta/linkedin/google/microsoft later: `{ authUrl, tokenUrl, scopes, usesPKCE, pkceMethod,
  supportsRefresh, tokenStyle, authExtraParams, resolveIdentity(token), redirectPath, appCredentialKey }`.
- `pkce.js` — cryptographically-random `code_verifier` (43–128 chars, RFC 7636) + S256 `code_challenge`.
  **This replaces the fake plain/state-as-verifier hack** — delete that from server.js.
- `app-credentials.js` — `resolveAppCredential(provider, { env, region, agencyId })` →
  `{ client_id, client_secret, redirect_uri, scopes }`. Default reads global env
  (`X_OAUTH_CLIENT_ID/SECRET`, `TIKTOK_CLIENT_KEY/SECRET`). The signature MUST carry `agencyId` + `region`
  so a future BYO-app override drops in without touching callers. Do NOT build BYO UI.
- `state-store.js` — uses the typed `oauth_states` table:
  - `create()` — mint id; store `code_verifier_encrypted` (via `encryptSecret`), `agent_id`, `agency_id`,
    `platform`, `redirect_uri`, `return_to`, `elevated`, `nonce`, `expires_at`.
  - `consumeOnce()` — atomic single-use: reject if missing / expired / already consumed / platform
    mismatch / agency mismatch; mark `consumed_at`.
  - `gcExpired()`.
- `token-exchange.js` — `exchangeCode({provider, code, codeVerifier, redirectUri})` and
  `refreshToken({provider, refreshToken})`. Per-provider auth style (X = HTTP Basic; TikTok =
  `client_key`+`client_secret` in body). Robust error mapping; never leak secrets in errors.
- `token-store.js` — `persistTokens(connection, tokenSet)` (encrypt access+refresh, store
  scope/expiry/user id on `marketplace_connections.settings.credentials`) and
  **`getFreshAccessToken(connection)`** — checks `expires_at`, refreshes within a safety window
  (provider-aware), re-encrypts, returns a valid token. Concurrency-safe: no duplicate-refresh stampede
  (per-connection in-process lock/promise-cache).
- `index.js` — public surface: `buildAuthorizeUrl`, `startConnect`, `handleCallback`, `getFreshAccessToken`.

## Refactor

Rewire `server.js:5423–5621` (X/TikTok start/callback) onto `lib/oauth`. Behaviour-preserving for the
happy path EXCEPT: (a) real S256 PKCE, (b) states in the typed table, (c) thread the `elevated` field into
state (requireElevated wiring is PR6). Keep the `wingcaster:oauth:done` popup contract.

**REQUIRED (tenant-safety — see design §2.6 INVARIANT):** every `marketplace_connections` INSERT in the
refactored OAuth write path (the callback create at `server.js:5587`) MUST resolve and set `agency_id`
from the connecting agent's agency. Migration 794 backfilled existing rows only; a new row left with
`agency_id = NULL` becomes unreachable under PR6's agency-scoped RLS.

## Out of scope
- Do NOT wire refresh into the publish path (that's PR2) — but `getFreshAccessToken` must exist + be tested.
- Do NOT add meta/linkedin/google/microsoft providers here (later PRs) — just leave the registry shape ready.

## Tests
- Unit: pkce vectors (verifier length/charset, S256 challenge); provider-registry; token-exchange with
  mocked fetch (X Basic-auth header, TikTok body creds); `getFreshAccessToken` — expired→refreshed,
  fresh→passthrough, refresh-failure→typed error/health flag; concurrency (two callers, one refresh).
- Real-PG: `state-store.consumeOnce` single-use + expiry + platform-mismatch + agency-mismatch rejection;
  OAuth-created connection row has non-null `agency_id`. Use DISTINCT keys per test.

## GLOBAL STANDARDS (apply to this PR)
- **Verify CI the way CI does** before marking ready, from `backend/`: `npm ci` → `npx tsc --noEmit` →
  `npm run build` → the targeted vitest + Real-PG suites. Never claim green from a shortcut that skips
  typecheck. Ship `package-lock.json` with any `package.json` change.
- Real-PG tests use DISTINCT unique keys per test (avoid unique-window collisions).
- Secrets: AES-256-GCM via existing `encryptSecret`; never log plaintext tokens; never return ciphertext
  to the browser.
- No secret weakening for tests: diagnose gate-vs-seed; never soften a production gate to pass a test.
- **table-mapper:** never re-list `id/created_at/updated_at/data` in a mapping's `columns` array — the DAL
  prepends them; re-listing causes a duplicate-column INSERT 500 only Real-PG catches.
- Full end-to-end read of every new file before marking ready.
- Conventional commits; PR body ends with the standard generated-with attribution; **PR targets `main`**.

## Acceptance checklist (Cursor: self-verify all before opening the PR)
- [ ] `lib/oauth/` modules created with the exact surface above; `index.js` exports the four public fns.
- [ ] Real S256 PKCE; the `plain`/state-as-verifier code is deleted from server.js.
- [ ] X/TikTok start/callback refactored onto `lib/oauth`; `wingcaster:oauth:done` popup contract intact.
- [ ] OAuth callback create sets non-null `agency_id` (Real-PG asserts it).
- [ ] `getFreshAccessToken` implemented + unit-tested (expired/fresh/failure/concurrency); NOT yet wired
      into publish.
- [ ] `resolveAppCredential(provider, {env,region,agencyId})` seam present; default reads global env.
- [ ] `npm ci && npx tsc --noEmit && npm run build` pass in `backend/`; targeted + Real-PG suites green.
- [ ] Every new file read end-to-end.
