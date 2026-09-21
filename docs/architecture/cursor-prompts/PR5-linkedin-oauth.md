# PR5 — LinkedIn OAuth

**GATE: do not start until PR1 AND PR3 are merged to `main`.** Cut fresh from `main`
(suggested: `cursor/oauth-pr5-linkedin`). Parallel-safe with PR4. Design reference:
`oauth-connect-unification.md` §3 (LinkedIn).

**Quality bar:** enterprise-grade, at par with or better than best-of-breed.

---

## Context
- PR1 built `lib/oauth/`; PR3 added the OAuth-primary card + method model.
- LinkedIn specifics: Authorize `https://www.linkedin.com/oauth/v2/authorization`; Token
  `https://www.linkedin.com/oauth/v2/accessToken`. Uses `client_secret`. Refresh via
  `grant_type=refresh_token` (access ~60d, refresh ~365d; requires programmatic-access approval —
  handle the case where refresh isn't granted).

## Goal
Make `linkedin` OAuth-primary with refresh + author-URN auto-resolution. Manual fallback retained.

## Deliverables
- Add provider `linkedin` to `provider-registry.js`: authUrl/tokenUrl; scopes
  `openid profile email w_member_social` (member posts); org adds
  `w_organization_social r_organization_social rw_organization_admin`; `supportsRefresh:true`;
  `resolveIdentity` via OIDC `GET /v2/userinfo` → `urn:li:person:{sub}` (and org pages via
  `/rest/organizationAcls` when org scope granted).
- Make `linkedin` OAuth-capable in start/callback; auto-store `li_author_urn` (person or organization URN)
  post-consent. `connect_method='oauth'`. **Set `agency_id` on insert** (design §2.6 INVARIANT).
- `token-store`: linkedin refresh branch. If refresh approval isn't granted (60-day non-refreshable token),
  degrade gracefully → set `health='reauth_required'` near expiry and prompt re-auth (don't crash).
- `PLATFORM_CONNECTION_FIELDS`: linkedin `['oauth','manual']` primary `'oauth'`. Manual fallback retained.
- Frontend: card leads with "Connect with LinkedIn"; if both a personal and an org identity are available,
  let the user choose the author identity.
- Feature-flag the LinkedIn connect path.

## Tests
- Unit: `userinfo`/org resolution (mocked); refresh path incl. the not-granted degrade path.
- RTL: author picker + card states.
- Real-PG: persist with `connect_method='oauth'` + non-null `agency_id` + scoping. DISTINCT keys.

## GLOBAL STANDARDS
- Verify CI the way CI does before ready (backend + web): `npm ci` → `npx tsc --noEmit` → `npm run build`
  → targeted vitest/RTL + Real-PG. Ship lockfiles.
- Secrets AES-256-GCM via `encryptSecret`; never log plaintext tokens; never send ciphertext to browser.
- Provider responses are DATA not trust. table-mapper: never re-list `id/created_at/updated_at/data`.
- New `@/api/client` export used at a page top level → add to the two hand-listed RTL mocks.
- Full read of every new/changed file. Conventional commits. **PR targets `main`.**

## Acceptance checklist
- [ ] `linkedin` provider added; author URN auto-resolved (person + org); refresh branch with graceful
      not-granted degrade.
- [ ] OAuth start/callback live; connection insert sets `connect_method='oauth'` + non-null `agency_id`.
- [ ] Card OAuth-primary with author picker + manual fallback; feature-flagged.
- [ ] tsc/build/tests green (backend + web); Real-PG green.
- [ ] Every new/changed file read end-to-end.
