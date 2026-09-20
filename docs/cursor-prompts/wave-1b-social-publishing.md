# Wave 1B — Social publishing consolidation (make the button actually post)

> Prepend `_house-rules.md`. Prerequisite: Wave 0 merged. Migration block: **665–669** (only if you add views; this module is mostly logic).

## MISSION
Today the dashboard "Promote" button uses the **weak** publish path (only WhatsApp live-sends; Instagram via an IG-only retry worker; Facebook/X/TikTok/Telegram never actually post), while the **capable** path that really publishes to all platforms is **orphaned with no UI**. Fix this: **consolidate every social publish onto the real path, wire the UI to it, record everything as canonical Executions (Wave 0), and make ALL connected platforms deliver.**

Read `docs/campaign-and-social-publishing-reconciliation.md` Part 2 (the three-paths table + Diagram 1) — binding.

## BACKGROUND FACTS (verified — study before coding)
- **Path A (weak, currently wired):** `POST /api/properties/:id/distribute-own` (`backend/src/server.js:5763`), called by `web/src/components/dashboard/PromoteDistributeModal.tsx` via `api.distributeOwn`. Writes `distributions` rows; WhatsApp = live `sendListingToWhatsApp`; IG/Telegram/TikTok/X = `pending_retry`.
- **Path B (real, orphaned):** `POST /api/listings/:id/publish-social` (`server.js:5932`) → real Graph adapters `publishInstagramFeed/Reel/Story/Carousel`, `publishFacebookPagePost/Photo`, `publishXTweet` (+ TikTok/LinkedIn). Two credential models via `resolveConnectionCredentials` / `PLATFORM_INTEGRATION_MODEL` (enterprise env-token vs tenant OAuth). `api.publishSocial` exists (`client.ts:2532`) but **no component calls it**.
- **Retry worker** `retryDistributionDelivery` (`server.js:5007`, booted `server.js:8853`) implements **Instagram only** (`"Retry publishing is not implemented for <platform>"` at `server.js:5093`).
- **Path C (portals):** `submit-to-fi` → `submitPortalPublishingJob` → `publishing_jobs`+`distribution_jobs` `in_review` (PA-MOD-001). Leave portals as-is except: represent them as `Execution(kind=portal_submit, status=in_review)` via Wave 0.

## SCOPE
1. **Route the UI to path B.** Rewire `PromoteDistributeModal` (and the listings composer publish step if it publishes) to call the real publish path for organic social. Migrate WhatsApp's live-send into the same consolidated flow.
2. **Record canonically.** Every publish creates a fan-out of **canonical Executions** (one per platform, `kind=social_post`) via Wave 0 `executions.js`, with `execution_attempts` per provider try. Retire path A's bespoke `distributions` retry queue (or reduce it to a thin adapter that writes canonical) — expand-contract, no data loss, old rows preserved/migrated.
3. **All platforms deliver.** Replace the IG-only retry gap: dispatch to every **connected** platform through its real adapter (IG/FB/X/TikTok/LinkedIn/Telegram + WhatsApp). A platform that isn't connected fails that Execution with a clear reason; a connected one must actually attempt the real API. No `"not implemented"` for a platform we claim to support.
4. **Scheduling** points at the consolidated path (today `scheduled-publish-worker.js` routes to the portal path). Due social posts run through the same canonical publish.
5. **Eligibility (the compliance line):**
   - **Public posts** (IG/FB/X/TikTok/LinkedIn feed) → check **`channels` connection health** only. No per-contact consent.
   - **WhatsApp listing-to-a-recipient** send → this IS messaging to a person → **must** pass `consent.checkEligibility({contactId, channel:'whatsapp', purpose:'marketing'})` (Wave 0).
6. Emit **Events** (Wave 0 `events.js` `ingestEvent`, under `withTenant`) for publish outcomes — `post.published`/`post.failed`/`message.submitted`/`message.delivered`/`message.failed` per the taxonomy — so 2C attribution can consume them. Resolve the tenant before ingest (strict RLS).
7. **Connection state via Wave 0 `channels.js`** (canonical `channel_connections`, kept current by Wave 0's forward-sync triggers): use `getChannelConnection`/`resolveCapabilities`/health for routing and the "is this platform connected?" check. Actual provider **credential resolution stays via the existing `resolveConnectionCredentials`** path (creds live behind `credentials_ref`); don't duplicate secrets into canonical tables.

## OUT OF SCOPE
Paid ads (Wave 2). Portal submission internals beyond representing them as canonical Executions. Creative rendering (1C) — consume a `creative_id`/media URL if provided, else today's `media_urls`/`property.photos`.

## MODULE ACCEPTANCE CRITERIA
- [ ] Pressing Promote in the UI actually publishes to **every connected platform** via real adapters (not just WhatsApp+IG).
- [ ] Each publish is recorded as canonical `Execution(kind=social_post)` + attempts; `distributions` rows migrated/preserved (expand-contract).
- [ ] Scheduling runs social posts through the consolidated path.
- [ ] WhatsApp recipient send is consent-gated; public posts are not (verified by test).
- [ ] No `"retry publishing not implemented"` path remains for a supported connected platform.
- [ ] Publish outcomes emit delivery Events.

## TEST MATRIX (minimum)
1. Publish fan-out to N connected platforms → N Executions, correct per-platform status; unconnected platform → failed Execution with reason.
2. Adapter calls are exercised (mock the HTTP layer, assert the real adapter path is taken — not a stub).
3. WhatsApp send blocked when consent denied; IG post NOT blocked by consent.
4. Scheduled social post fires through the consolidated path.
5. Legacy `distributions` data preserved/migrated; existing routes still respond (expand-contract).
