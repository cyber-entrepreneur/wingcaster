# PR3 — Unified connect UX + config model

**GATE: do not start until PR1 is merged to `main`.** Cut fresh from `main`
(suggested: `cursor/oauth-pr3-connect-ux`). Parallel-safe with PR2. Design reference:
`oauth-connect-unification.md` §2.1, §2.4. Self-contained below.

**Quality bar:** the connect experience must feel at par with or better than Hootsuite/Sprout/Buffer.

---

## Context

- `PLATFORM_CONNECTION_FIELDS` + `PLATFORM_INTEGRATION_MODEL` live in `backend/src/lib/credentials.js`;
  today each platform is a single model (`enterprise` manual OR `oauth`).
- Config endpoint: `GET /api/social-channels/config` (`server.js:5298`) returns `connection_fields`.
- `sanitizeSocialConnection` (`server.js:5640`) shapes the row sent to the browser (redacts ciphertext).
- Frontend card: `web/src/pages/SocialChannelsPage.tsx` (`PlatformCard`, OAuth popup at `startOAuth`,
  `wingcaster:oauth:done` listener at line 81). API client methods at `web/src/api/client.ts:3404–3563`.
- Broadcast design system: components read `--lc-*` semantic tokens only, never raw hex.

## Goal

Introduce the method model (`supported_methods`/`primary_method`) and make the connect card OAuth-primary
with manual as a graceful, collapsible fallback.

## Deliverables

**Backend**
- Extend `PLATFORM_CONNECTION_FIELDS` so each platform declares `supported_methods` (ordered) +
  `primary_method`. This PR: `x`/`tiktok` → `['oauth','manual']` primary `'oauth'`;
  `facebook`/`instagram`/`linkedin`/`whatsapp` stay manual-primary for now (their OAuth arrives in
  PR4/5/7) but the SHAPE must be present. Update `GET /api/social-channels/config` to return these.
- `sanitizeSocialConnection`: include `connect_method` and a normalized token status
  `{ connected, method, scope, expires_at, health }` so the card shows expiry + reauth state.

**Frontend** (`SocialChannelsPage.tsx` + `api/client.ts`)
- Redesign `PlatformCard` to be OAuth-primary: a prominent "Connect with <Provider>" button when the
  platform supports oauth AND the provider app is configured; a collapsible "Connect manually instead"
  that reveals the EXISTING `enterprise_targets` form (do not remove it). If config reports oauth
  unsupported/unconfigured, present manual as primary — labelled "manual connection", NOT an error state.
- Show connection health: "Connected as <handle>", scope, token expiry, and a "Re-authorise" affordance
  when `health='reauth_required'`. Keep the popup + `wingcaster:oauth:done` flow.
- New styling uses only `--lc-*` semantic tokens (no raw hex).

## Out of scope
- No new backend OAuth providers (X/TikTok are already live; the pattern lands here for the rest).

## Tests
- RTL: card in oauth-primary, manual-fallback, and reauth-required states; manual form still submits.
- **If you add a new named export to `@/api/client` imported at a page top level, ALSO add it to the
  hand-listed client mocks in `web/src/theme/a11y-top-pages.rtl.test.tsx` and `screens.rtl.test.tsx`** (they
  don't `importActual`; a missing export is a green-branch/red-CI-shard failure).

## GLOBAL STANDARDS
- Verify CI the way CI does before ready: from `web/` run `npm ci` → `npx tsc --noEmit` → `npm run build`
  → vitest for touched suites; from `backend/` run tsc + the config-endpoint tests. Ship lockfiles.
- Broadcast tokens only (`--lc-*`), no raw hex.
- Full read of every changed file before ready. Conventional commits. **PR targets `main`.**

## Acceptance checklist
- [ ] `supported_methods`/`primary_method` present for all platforms; config endpoint returns them.
- [ ] `sanitizeSocialConnection` returns `connect_method` + token status (method/scope/expiry/health).
- [ ] `PlatformCard` is OAuth-primary with a collapsible manual fallback that still works; manual-primary
      shown (not as an error) when oauth is unconfigured.
- [ ] Reauth affordance appears on `health='reauth_required'`; `wingcaster:oauth:done` flow intact.
- [ ] Any new `@/api/client` export added to the two hand-listed RTL mocks.
- [ ] web tsc/build/vitest green; backend tsc + config tests green.
- [ ] Every changed file read end-to-end.
