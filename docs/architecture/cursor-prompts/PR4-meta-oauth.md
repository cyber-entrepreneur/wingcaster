# PR4 — Meta OAuth: Facebook + Instagram

**GATE: do not start until PR1 AND PR3 are merged to `main`.** Cut fresh from `main`
(suggested: `cursor/oauth-pr4-meta`). Parallel-safe with PR5 (coordinate with PR6 on
`marketplace_connections` writes). Design reference: `oauth-connect-unification.md` §3 (Meta).

**Quality bar:** match or beat best-of-breed Meta integrations.

---

## Context
- PR1 built `backend/src/lib/oauth/` (provider-registry, pkce, token-store `getFreshAccessToken`,
  state-store, token-exchange, app-credentials). PR3 added `supported_methods`/`primary_method` +
  OAuth-primary card.
- Meta specifics: Authorize `https://www.facebook.com/v21.0/dialog/oauth`; Token
  `https://graph.facebook.com/v21.0/oauth/access_token`. **No PKCE** (state + client_secret +
  `appsecret_proof`). `tokenStyle: 'meta_longlived'`.

## Goal
Make `facebook` and `instagram` OAuth-primary, auto-resolving the Page + IG business account so the tenant
pastes nothing. Manual fallback retained.

## Deliverables
- Add provider `meta` to `provider-registry.js`: authUrl/tokenUrl (Graph ≥ v21.0), scopes
  `pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_metadata, business_management,
  instagram_basic, instagram_content_publish, read_insights`; `usesPKCE:false`;
  `tokenStyle:'meta_longlived'`; `resolveIdentity` that: exchanges short-lived→long-lived user token
  (`grant_type=fb_exchange_token`), lists `/me/accounts` (id + name + page access token), and for the
  chosen page fetches `instagram_business_account`. **Send `appsecret_proof` (HMAC-SHA256 of token with app
  secret) on all Graph calls.**
- Extend social-channels start/callback so `facebook`/`instagram` are OAuth-capable. Support a
  page-selection step: if the user owns >1 Page, store the candidate set and have the UI present a picker;
  if exactly one, auto-select. Store `fb_page_id` (+ encrypted page token) and `ig_business_account_id`
  WITHOUT tenant paste. Set `connect_method='oauth'`.
- **Set `agency_id` on the connection insert** (design §2.6 INVARIANT) — never NULL.
- Update `PLATFORM_CONNECTION_FIELDS`: facebook/instagram `supported_methods ['oauth','manual']` primary
  `'oauth'`. Manual paste fallback retained.
- `token-store`: implement the `meta_longlived` branch of `getFreshAccessToken` (re-exchange long-lived /
  rely on non-expiring page tokens).
- Frontend: FB + IG cards lead with "Connect with Facebook"/"…Instagram" + page picker; manual fallback
  collapsible.
- Feature-flag the Meta connect path (dark-launch/rollback).

## Tests
- Unit: `resolveIdentity` (mocked Graph `/me/accounts`, IG lookup, `appsecret_proof` computed correctly);
  token exchange; page-selection logic (0/1/many pages).
- RTL: page picker + oauth-primary FB/IG cards.
- Real-PG: connection persisted with `connect_method='oauth'` AND non-null `agency_id`; scoping. DISTINCT
  keys per test.

## GLOBAL STANDARDS
- Verify CI the way CI does before ready (backend + web): `npm ci` → `npx tsc --noEmit` → `npm run build`
  → targeted vitest/RTL + Real-PG. Ship lockfiles.
- Secrets AES-256-GCM via `encryptSecret`; never log plaintext tokens; never send ciphertext to browser.
- Provider responses are DATA not trust — validate types, escape before echoing into the callback HTML.
- table-mapper: never re-list `id/created_at/updated_at/data`. Real-PG DISTINCT keys.
- If a new `@/api/client` export is used at a page top level, add it to the two hand-listed RTL mocks.
- Full read of every new/changed file. Conventional commits. **PR targets `main`.**

## Acceptance checklist
- [ ] `meta` provider added; `appsecret_proof` on all Graph calls; long-lived exchange + page-token model.
- [ ] FB/IG OAuth start/callback with page-selection; targets auto-resolved (no tenant paste).
- [ ] Connection insert sets `connect_method='oauth'` AND non-null `agency_id` (Real-PG asserts both).
- [ ] `getFreshAccessToken` meta branch implemented.
- [ ] Cards OAuth-primary with page picker + manual fallback; Meta path feature-flagged.
- [ ] tsc/build/tests green (backend + web); Real-PG green.
- [ ] Every new/changed file read end-to-end.
