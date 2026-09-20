# Wave 2F — SEO / Owned-Web — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 + Wave 1 merged to `main`. Migration max **649**; your block **790–809**. **Verified: no SEO/structured-data code exists — greenfield.**
- **⚠️ FIRST resolve the Bazaar boundary** (below) before building — do not duplicate a public listing page if Bazaar owns it.

---

## HOUSE RULES

### WHO YOU ARE
Senior engineer on **WingCaster** — B2B real-estate marketing SaaS. Backend **Node ESM + PostgreSQL multi-tenant RLS**, vitest (Real-PG via `npm run test:pg:docker`). Frontend **React+Vite+TS**, `--lc-*` semantic tokens only.

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md` (Part 4c). 3. `docs/event-taxonomy-catalog.md` (v2). 4. the existing code named below.

### BUILD ON WAVE 0 + WAVE 1 (both on `main`) — exact contract, do not re-invent
- **Wave 0 access layer `backend/src/lib/growth-os/`** — use exports (esp. `executions.js` for `Execution(kind='seo_page')`); no raw SQL against canonical tables.
- **`withTenant(agencyId, agentId, fn)` MANDATORY** for tenant-scoped read/write; RLS strict (mig 551); outside it the app role sees zero rows; propagation via `AsyncLocalStorage`.
- **New tenant tables copy the strict-RLS pattern EXACTLY** (mig 551 + 543); un-RLS'd reads SQL-scoped by tenant (throw if missing) — never `findAll` unbounded.
- **Wave 1 on `main`:** `backend/src/domain/{journeys,creative,audiences}`, `backend/src/lib/social-publishing`.
- **Events** via `ingestEvent` (idempotent, v2 vocab, under `withTenant`). **Migration max on `main` is 649.**

### ABSOLUTE NON-NEGOTIABLES (any violation = PR rejected)
1. No stubs/`TODO`/`throw 'not implemented'`/placeholders/mock-in-real-path; all implemented + tested.
2. Expand-contract only; no destructive schema; cutover explicit + testful.
3. Idempotent migrations; run twice cleanly.
4. Shared enum/CHECK additions in their OWN first-landing migration.
5. RLS mandatory + STRICT on new tenant tables (copy mig 551), via `withTenant`.
6. Never weaken a gate/permission/test to go green; diagnose `403` (wrong-table gate vs missing seed).
7. `agency_id`/`agent_id TEXT … ON DELETE SET NULL`; money `BIGINT` micros + `currency`; ids `TEXT` uuid+prefix; `TIMESTAMPTZ`; `data JSONB` for non-predicate attrs only.
8. FE: `--lc-*` tokens only; match patterns; WCAG AA + responsive.
9. Tests part of "done": unit + Real-PG; FE component tests.
10. Verify like CI, report truthfully; green ≠ correct.

### REPO CONVENTIONS
ESM; `Object.assign(new Error(msg), { code })`; logger. Migrations `NNN_*.sql` (max 649; your block). Register tables in `table-mapper.js`. API client `web/src/api/client.ts`; routes `backend/src/server.js`.

### VERIFICATION (paste real output)
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker`. `web/`: `npm ci` → `npm run build` → `npm run test`. Narrow to new `*.postgres.test.js` for true pass/fail.

### DELIVERABLE / PR FORMAT
Branch off `main`; small landable PRs; each green; targeting `main`; PR body with pasted CI output; link the object model. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop, state the conflict, propose the minimal expand-contract fix, continue, report assumptions.

---

## MODULE: SEO / OWNED-WEB (structured listing pages)

### ⚠️ FIRST: resolve the Bazaar boundary
Public listing pages likely live on **Real Estate Bazaar** (the consumer product), not the WingCaster B2B app. **Before building, confirm where the public listing page is served.** If Bazaar owns the page, this wave = WingCaster produces the SEO *inputs* (structured metadata, content recommendations, `Execution(kind=seo_page)` records) and Bazaar renders them. If unclear, STOP and raise it — do not build a duplicate public page in the WingCaster app.

### MISSION
Make listings **earn** organic search: SEO-optimised, indexable listing pages with structured data, sitemaps, and per-listing meta tooling. SEO is **earned, not a send** — modelled as `Execution(kind=seo_page)` for the *act* of (re)generating/optimising a page. Read reconciliation Part 4c + `docs/canonical-object-model.md` (owned-web layer).

### SCOPE — BACKEND
1. **Migrations (790–809):** listing SEO metadata (`seo_pages` or listing-page metadata: `id · property_id · slug · title · meta_description · canonical_url · og_tags JSONB · schema_jsonld JSONB · status · indexed_at`), keyed to properties. Strict RLS where tenant-scoped.
2. **Structured data:** generate valid `schema.org/RealEstateListing` (or `Product`/`Residence`) JSON-LD from property data; canonical URLs; OG/Twitter tags. Validate the JSON-LD.
3. **Sitemaps + robots:** generate/refresh XML sitemaps for published listings (coordinate with the Bazaar boundary).
4. **`Execution(kind='seo_page')`** records the (re)generation/optimisation act via `executions.js`; emits appropriate Events.
5. **SEO tooling:** per-listing recommendations (title/meta length, keyword presence, alt text, content score) — HubSpot/Yoast-style, server-side.

### SCOPE — FRONTEND
1. Per-listing SEO panel: editable title/meta/slug, JSON-LD preview, OG preview, recommendations/score.
2. If WingCaster-served: the indexable listing page (SSR/meta correct). If Bazaar-served: the panel writes metadata Bazaar consumes.

### OUT OF SCOPE
Paid search (2A/Google Ads). Off-page SEO/backlinks. Rank tracking (fast-follow). Building a public consumer page if Bazaar owns it.

### ACCEPTANCE CRITERIA
- [ ] Bazaar boundary resolved + documented before building.
- [ ] Valid `schema.org` JSON-LD + canonical + OG per listing (validated).
- [ ] Sitemap generation for published listings.
- [ ] `Execution(kind=seo_page)` records the act; SEO recommendations computed.
- [ ] Tenant-isolated where applicable via `withTenant`.

### TEST MATRIX
1. JSON-LD validity for a sample listing (schema.org RealEstateListing).
2. Canonical/OG/meta correctness + length rules.
3. Sitemap includes only published, indexable listings.
4. Recommendation/score computation.
5. `Execution(kind=seo_page)` + Events emitted.
