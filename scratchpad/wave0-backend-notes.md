# Wave 0 backend notes (Phase-A agent #1)

Date: 2026-09-08  
Branch: `feat/screen-wave-0-nav-chrome`  
Scope: `backend/src/**` only

## Pre-existing (kept / extended)

| Item | Status |
|---|---|
| `POST /api/auth/login` | Existed (email+password only). Extended to accept `identifier_type` ∈ `{email,username,phone}` + `identifier`, while keeping legacy `email` body. |
| `GET /api/auth/me` | Exists. Unchanged. |
| `PUT /api/auth/me` | Exists (agent profile fields). Left alone; locale uses new `PATCH /api/users/me`. |
| `GET /api/auth/tenant-context` | Exists (raw memberships). Kept; Wave 0 UI uses the new tenants list shape. |
| `GET /api/notifications` | Exists (consumer_notifications). Kept; popover uses `/api/auth/me/notifications`. |
| Social OAuth (`/api/social-channels/oauth/...`) | Exists for X/TikTok channels — unrelated to login OAuth. |
| Migration 028 tenant model | Exists (`tenants`, `tenant_memberships`). Did **not** include `users.active_tenant_id` or `users.preferred_locale` (contrary to brief assumption). |
| Fin session env | `sessionEnvironment(req)` already read `req.user.fin_environment`; extended to accept lowercase `live`/`test` JWT claims. |

## Added

| Endpoint / piece | File(s) |
|---|---|
| `GET /api/auth/me/tenants` | `lib/wave0-nav-routes.js` |
| `POST /api/auth/switch-tenant` | same |
| `PATCH /api/users/me` (`preferred_locale`) | same |
| `GET /api/auth/me/notifications` | same |
| `POST /api/auth/me/notifications/mark-all-read` | same |
| `POST /api/search` (persona-scoped) | same |
| `POST /api/admin/env/switch` | same |
| `POST /api/auth/oauth/:provider/start\|callback` (google\|apple\|facebook) | same |
| `X-Wingcaster-Env` on every response | `lib/session-env.js` middleware, wired in `server.js`; CORS `exposedHeaders` |
| Columns `users.active_tenant_id`, `users.preferred_locale`, `users.username` + `auth_oauth_identities` | migration `316_wave0_nav_user_prefs.sql` |
| JWT claims `active_tenant_id`, `env`, `fin_environment` | `buildAuthSession` in `server.js`; `authMiddleware` mirrors onto `req.user` |

## Tests

- `src/lib/wave0-nav-routes.test.js` — route contract / auth gates / OAuth dev mode / env header
- Command: `npx vitest run src/lib/wave0-nav-routes.test.js`

## Notes / non-blockers

- Login OAuth in production requires `GOOGLE_OAUTH_*`, `APPLE_OAUTH_*`, `FACEBOOK_OAUTH_*` (or `FACEBOOK_APP_ID`/`SECRET`). Without them, non-production returns `dev: true` + `dev_code` for local handshake tests.
- OAuth callback does **not** auto-provision accounts (returns `oauth_account_not_found`); links to an existing verified user by prior identity row or email.
- No billing/credit/package routes touched.
