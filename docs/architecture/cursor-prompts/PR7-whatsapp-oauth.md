# PR7 — WhatsApp via Meta Embedded Signup

**GATE: do not start until PR4 is merged to `main`.** Cut fresh from `main`
(suggested: `cursor/oauth-pr7-whatsapp`). Parallel-safe with PR8. Design reference:
`oauth-connect-unification.md` §3 (Meta/WhatsApp).

**Quality bar:** match best-of-breed WhatsApp BSP onboarding (Embedded Signup, not manual token paste).

---

## Context
- PR4 added the `meta` provider + Graph plumbing (`appsecret_proof`, long-lived tokens) to `lib/oauth/`.
- Current WhatsApp is env/manual only: `backend/src/whatsapp.js` reads `META_ACCESS_TOKEN`,
  `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`; publish gates on `isWhatsAppConfigured()`.
- First-connect fires a `whatsapp_welcome` email (`server.js:5387`) — preserve it.

## Goal
Add a Meta Embedded Signup OAuth onboarding so a tenant connects their own WhatsApp Business Account and
phone number without pasting IDs/tokens. Manual/env path retained as fallback.

## Deliverables
- Extend the `meta` provider to support the WhatsApp Embedded Signup flow: OAuth with
  `whatsapp_business_management` + `whatsapp_business_messaging`, then register/select the WABA and phone
  number, exchanging for a durable system-user-style token. Store `wa_phone_number_id` +
  `wa_business_account_id` + encrypted token per tenant WITHOUT manual paste. `connect_method='oauth'`.
  **Set `agency_id` on insert** (design §2.6 INVARIANT).
- Keep the existing env/manual path (`backend/src/whatsapp.js`) as fallback. In the publish path, prefer a
  tenant's OAuth-connected token ahead of the global env token.
- `PLATFORM_CONNECTION_FIELDS`: whatsapp `['oauth','manual']` primary `'oauth'`.
- Frontend: card leads with "Connect WhatsApp Business"; manual (phone-number-ID paste) collapsible.
  Preserve the `whatsapp_welcome` email on first connect.
- Feature-flag the WhatsApp connect path.

## Tests
- Unit: embedded-signup token/WABA/phone resolution (mocked Graph); tenant-token-over-env preference.
- RTL: the WhatsApp card (oauth-primary + manual fallback).
- Real-PG: persist with `connect_method='oauth'` + non-null `agency_id` + scoping. DISTINCT keys.

## GLOBAL STANDARDS
- Verify CI the way CI does before ready (backend + web): `npm ci` → `npx tsc --noEmit` → `npm run build`
  → targeted vitest/RTL + Real-PG. Ship lockfiles.
- Secrets AES-256-GCM via `encryptSecret`; never log plaintext tokens. Provider responses are DATA not
  trust. table-mapper: never re-list `id/created_at/updated_at/data`.
- New `@/api/client` export at a page top level → add to the two hand-listed RTL mocks.
- Full read of every new/changed file. Conventional commits. **PR targets `main`.**

## Acceptance checklist
- [ ] Embedded Signup OAuth connects WABA + phone; targets/token stored without manual paste.
- [ ] Connection insert sets `connect_method='oauth'` + non-null `agency_id`.
- [ ] Tenant OAuth token preferred over global env in publish; manual/env fallback retained.
- [ ] `whatsapp_welcome` first-connect email preserved; card OAuth-primary + manual fallback;
      feature-flagged.
- [ ] tsc/build/tests green (backend + web); Real-PG green.
- [ ] Every new/changed file read end-to-end.
