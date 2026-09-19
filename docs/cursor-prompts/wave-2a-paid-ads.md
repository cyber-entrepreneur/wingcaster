# Wave 2A — Paid Ads (Meta + Google incl. Gmail/Demand Gen) — connect-ready shells

> Prepend `_house-rules.md`. Prerequisite: Waves 0+1 merged. Migration block: **700–719**.

## MISSION
Add the **Paid** channel kind end-to-end **as connect-ready shells**: the full object model, targeting/budget/objective UI, and real integration code behind D15 — so the moment Meta/Google **business verification + app review** complete (external clock, already started in parallel), paid ads light up. Nothing is faked; features ship behind flags that are OFF until approval.

Read `docs/campaign-and-social-publishing-reconciliation.md` Part 4 (4a/4b) and `docs/canonical-object-model.md` §C/§E. **Verified: no paid-ads code exists today — this is greenfield.**

## SCOPE — BACKEND
1. **Channels:** `ChannelDefinition(kind='paid')` rows for `meta_ads`, `google_ads` (Gmail placement is a Google **Demand Gen** format, NOT a separate channel). `ChannelConnection` with `integration_model` + `credentials_ref` (OAuth to the tenant's ad account; never store raw tokens).
2. **Executions:** `Execution(kind='paid_ad')` carrying objective · budget_micros/currency · targeting(JSONB: geography/demographics/audience_ref) · schedule · provider_ref (ad/campaign id). Use Wave 0 `executions.js`.
3. **Adapters** behind a provider interface (mirror 1C's Creative-Asset-Service pattern): `metaAdsAdapter`, `googleAdsAdapter` implementing create-campaign/adset/ad, budget, status. Real API calls (Meta Marketing API, Google Ads API). **Feature-flagged OFF** until credentials + approval exist; a call without approval returns a clear `PROVIDER_NOT_APPROVED` — never a stub success.
4. Emit `ad.delivered` + engagement Events (`docs/event-taxonomy-catalog.md` §4B/4C) so 2C attribution consumes them.
5. **Objective vocabulary** (enum, first-landing migration): `awareness · traffic · engagement · leads · conversions` mapped per-provider.

## SCOPE — FRONTEND
1. Paid-campaign builder: objective → budget → audience (reuse 1D `audiences` / lookalike) → creative (reuse 1C `creatives`) → review. A distinct authoring surface under the Campaign umbrella (not merged with organic/journey editors).
2. Connection UI under Settings → Channels for Meta/Google ad accounts (OAuth), health/approval state surfaced.
3. Honest states: if the provider isn't approved/connected, show "connect + pending approval," not a fake "publish."

## OUT OF SCOPE
Going live before external approval. Non-paid channels. Attribution math (2C consumes the Events you emit).

## ACCEPTANCE CRITERIA
- [ ] Meta + Google paid channels modelled; `Execution(kind=paid_ad)` with objective/budget/targeting persists.
- [ ] Adapters make real API calls when connected+approved; return `PROVIDER_NOT_APPROVED` (no stub success) otherwise — proven by test.
- [ ] Gmail reach implemented as a Google **Demand Gen** format, not a separate "email blast" (compliance: no unsolicited owned-email).
- [ ] Paid Executions emit `ad.delivered`/engagement Events per the taxonomy.
- [ ] Everything ships behind flags OFF; no fake publishes; RLS on all new rows.

## TEST MATRIX
1. Migration idempotency + RLS.
2. Paid Execution create → correct objective/budget/targeting; adapter called only when approved (mock HTTP; assert real path).
3. Unapproved → `PROVIDER_NOT_APPROVED`, no `ad.delivered` Event.
4. Events emitted match taxonomy names/idempotency.
5. FE: builder produces a valid paid Execution; unapproved state rendered honestly.
