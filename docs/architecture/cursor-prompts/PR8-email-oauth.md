# PR8 — Email OAuth: Google + Microsoft (per-tenant delegated mailbox)

**GATE: do not start until PR1 is merged to `main`.** (RLS assertions in tests depend on PR6 having landed
— if PR6 isn't merged yet, land the connect flow behind the feature flag and add the RLS assertions once
PR6 is in.) Cut fresh from `main` (suggested: `cursor/oauth-pr8-email`). Parallel-safe with PR7. Design
reference: `oauth-connect-unification.md` §3 (Google/Microsoft).

**Quality bar:** at par with or better than best-of-breed (send-as-your-domain via OAuth, auto refresh).
This is a **net-new product surface**: a per-tenant connected mailbox.

---

## Context
- PR1 built `lib/oauth/` (registry/pkce/token-store/exchange/state-store/app-credentials).
- Existing email lives in `backend/src/lib/notifications/email.js` (SMTP/Resend/SendGrid/SES by API key)
  and `transports/graph.js` (Microsoft Graph **app-only client-credentials**, used for platform OTP).
- **DO NOT change `transports/graph.js`** — the new per-tenant mailbox is a SEPARATE delegated flow.

## Goal
Let a tenant connect their own Gmail or Outlook mailbox via delegated Authorization Code + refresh, and
send outbound (and optionally read inbound) as that mailbox. Manual SMTP/API-key config remains the
fallback.

## Deliverables
- Add providers `google` and `microsoft` to `provider-registry.js`, delegated Authorization Code +
  PKCE(S256) + offline refresh:
  - google: authorize `https://accounts.google.com/o/oauth2/v2/auth` with `access_type=offline` +
    `prompt=consent`; token `https://oauth2.googleapis.com/token`; scopes
    `openid email profile https://www.googleapis.com/auth/gmail.send` (+ `gmail.readonly`/`gmail.modify`
    only if inbound ships). `resolveIdentity` → email + display name.
  - microsoft: authorize `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`; token
    `.../common/oauth2/v2.0/token`; scopes `offline_access openid email profile User.Read Mail.Send`
    (+ `Mail.ReadWrite` only if inbound ships). `resolveIdentity` → email + display name.
- New connect surface (reuse the shared connect flow) to link a tenant mailbox; store encrypted
  access+refresh; `connect_method='oauth'`. **Set `agency_id` on insert** (design §2.6 INVARIANT).
- `token-store`: `getFreshAccessToken` refresh branches for google + microsoft.
- New email transport: when a tenant has a connected mailbox, send via Gmail API `users.messages.send` /
  Graph `POST /me/sendMail` as that mailbox; otherwise fall back to the existing provider chain in
  `email.js`. Manual fallback = existing SMTP/API-key config.
- Feature-flag `google` and `microsoft` INDEPENDENTLY.

## Out of scope / guardrails
- Do NOT touch the app-only `transports/graph.js` OTP path.
- Request only the scopes whose features ship this round (send-only is the lighter provider-review path).

## Tests
- Unit: authorize-URL builders (google incl. `access_type=offline`+`prompt=consent`); token + refresh for
  both; send via mocked Gmail/Graph; connected-mailbox-over-fallback selection.
- Real-PG: mailbox connection persist + non-null `agency_id` + RLS scoping (depends on PR6).
- RTL if a settings UI is added.

## GLOBAL STANDARDS
- Verify CI the way CI does before ready (backend + web if UI): `npm ci` → `npx tsc --noEmit` →
  `npm run build` → targeted vitest/RTL + Real-PG. Ship lockfiles.
- Secrets AES-256-GCM via `encryptSecret`; never log plaintext tokens; never send ciphertext to browser.
- No secret weakening for tests. table-mapper: never re-list `id/created_at/updated_at/data`.
- New `@/api/client` export at a page top level → add to the two hand-listed RTL mocks.
- Full read of every new/changed file. Conventional commits. **PR targets `main`.**

## Acceptance checklist
- [ ] `google` + `microsoft` providers added (delegated, PKCE S256, offline refresh); `resolveIdentity`
      returns the mailbox address.
- [ ] Tenant mailbox connect flow stores encrypted access+refresh; `connect_method='oauth'` + non-null
      `agency_id`.
- [ ] New transport sends as the connected mailbox; falls back to SMTP/API-key chain; OTP `graph.js`
      untouched.
- [ ] google + microsoft feature-flagged independently.
- [ ] tsc/build/tests green; Real-PG green (or RLS assertions queued for post-PR6 if PR6 not yet merged).
- [ ] Every new/changed file read end-to-end.
