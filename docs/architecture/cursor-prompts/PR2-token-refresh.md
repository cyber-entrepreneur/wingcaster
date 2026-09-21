# PR2 — Token refresh at publish time

**GATE: do not start until PR1 is merged to `main`.** Cut fresh from `main`
(suggested: `cursor/oauth-pr2-refresh`). Parallel-safe with PR3. Design reference:
`oauth-connect-unification.md` §2.5. Self-contained below.

**Quality bar:** enterprise-grade, at par with or better than best-of-breed platforms.

---

## Context

- PR1 added `backend/src/lib/oauth/token-store.js` with `getFreshAccessToken(connection)` (expiry check +
  provider-aware refresh + re-encrypt), but it is **not yet wired into the publish path**.
- The dispatcher `backend/src/lib/social-publishing/platform-dispatch.js` and
  `backend/src/lib/publishing/publish-social-channel.js` currently read `creds.oauth_access_token` as a
  **static** bearer for `x`/`tiktok` — an expired token just fails at the provider.
- Env-name divergence to reconcile: `backend/src/lib/publish-readiness.js` requires
  `META_APP_SECRET`/`META_PAGE_TOKEN`, but the fb/ig adapters read `FACEBOOK_PAGE_ACCESS_TOKEN` /
  `INSTAGRAM_PAGE_ACCESS_TOKEN`. Readiness must check the SAME names the adapters consume.
- A scheduled-job pattern exists (see the metadata-refresh job near `server.js:836`).

## Goal

Close the "refresh token stored but never used" gap for the live OAuth platforms (X, TikTok), and add a
proactive refresh sweep.

## Deliverables

- In `platform-dispatch.js` and `publish-social-channel.js`, replace the direct
  `creds.oauth_access_token` read for `x` and `tiktok` with `getFreshAccessToken(connection)` from
  `lib/oauth/token-store.js`.
- On refresh failure: set the connection `health = 'reauth_required'` and throw a typed
  `REAUTH_REQUIRED` error the UI can surface (do not silently fail).
- Reconcile `publish-readiness.js` env-var names to match the adapters' actual reads; add a clear error if
  misconfigured. Do not otherwise change enterprise-model behaviour.
- Add a scheduled sweep (reuse the existing job mechanism) that proactively refreshes tokens within a
  configurable window of expiry and flags connections whose refresh failed. Idempotent, tenant-safe, logged.

## Out of scope
- No new providers, no UI redesign (PR3 handles the reauth affordance; here just set the health flag +
  typed error).

## Tests
- Unit: dispatch calls `getFreshAccessToken` for x/tiktok; `REAUTH_REQUIRED` mapping on refresh failure;
  readiness passes/fails on the reconciled env names; the sweep's select-and-refresh logic (mocked
  provider) incl. the failure→flag path.
- Real-PG: the `health='reauth_required'` transition persists. DISTINCT keys per test.

## GLOBAL STANDARDS
- Verify CI the way CI does before ready, from `backend/`: `npm ci` → `npx tsc --noEmit` →
  `npm run build` → targeted vitest + Real-PG. Ship `package-lock.json` with any `package.json` change.
- Real-PG tests use DISTINCT unique keys per test.
- Secrets: AES-256-GCM via `encryptSecret`; never log plaintext tokens.
- No secret weakening for tests (diagnose gate-vs-seed).
- Full read of every changed file before ready. Conventional commits. **PR targets `main`.**

## Acceptance checklist
- [ ] x/tiktok publish paths obtain the token via `getFreshAccessToken`; no static `oauth_access_token`
      read remains for OAuth platforms.
- [ ] Refresh failure → `health='reauth_required'` + typed `REAUTH_REQUIRED` surfaced to the caller.
- [ ] `publish-readiness.js` checks the same env names the adapters consume.
- [ ] Proactive refresh sweep added, idempotent, tenant-safe, logged; failure path flags the connection.
- [ ] tsc/build/tests green; Real-PG proves the health transition.
- [ ] Every changed file read end-to-end.
