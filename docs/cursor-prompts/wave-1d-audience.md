# Wave 1D — Audience (first-class segments + consent-aware membership)

> Prepend `_house-rules.md`. Prerequisite: Wave 0 merged. Migration block: **645–664**.

## MISSION
Extract audiences from inline rules into a **first-class Audience object** with **consent-aware membership**, so a segment reports not just "184 look relevant" but "184 matched / 151 contactable / 22 frequency-capped / 7 opted-out / 4 conflicting." Journeys (1A) and Campaigns consume it.

Read `docs/canonical-object-model.md` §C (Audience, AudienceMembership) — binding.

## BACKGROUND FACTS (verified)
- Today audiences are **inline**: `campaign-builder-shared.ts` `AudienceRule` (`field: status|source|tags|territory`, `operator: is|is_not|contains`, `value`) + `tags_filter[]`. No standalone audience object.
- Contacts/CRM already exist (referenced, not redefined). Consent lives in Wave 0 (`consent.js` / `consent` table).

## SCOPE — BACKEND
1. **Migrations (block 645–664, enum-first):** `audiences` (type(static/dynamic), `rules JSONB`, member_source(crm/followers/lookalike/uploaded), estimated_size, `data JSONB` for provenance) + `audience_memberships` (audience_id, contact_id, `state`(matched/contactable/frequency_capped/opted_out/conflicting), qualified_at, expires_at, inclusion(include/exclude)). RLS on both.
2. **Resolution engine** (`backend/src/domain/audiences/…`):
   - **static** = explicit contact list; **dynamic** = evaluate `rules` against CRM contacts (reuse the existing field/operator vocabulary: status/source/tags/territory + extend for budget/behaviour where data exists).
   - Compute membership **state** using Wave 0 consent: a contact with denied/withdrawn/expired consent for the intended channel/purpose → `opted_out`; otherwise `matched`/`contactable`. (Frequency-capped/conflicting states: leave the enum + a hook, but full frequency/conflict logic is a later wave — set them only when the signal is trivially available, else `contactable`.)
   - Provide `resolveAudience(audienceId, {channel, purpose})` → `{matched, contactable, opted_out, …, memberIds}`.
3. Extract today's inline `audience_rules`/`tags_filter` into `audiences` (expand-contract): a migration/adapter that lifts existing campaign rules into audience rows, leaving the old shape readable.

## SCOPE — FRONTEND
1. Audience builder UI (rule editor over the existing vocabulary) usable standalone and embeddable in the Journey (1A) audience step and Campaign.
2. Show the resolved breakdown (matched/contactable/opted-out/…counts) so the agent sees reach + suppression before use.
3. `--lc-*` tokens only; accessible; responsive.

## OUT OF SCOPE
AI Audience Discovery (later wave) — but leave `data` provenance + a clean `resolveAudience` seam so an AI producer can populate a dynamic audience later. Identity resolution (later). ContactPolicy/frequency engine (later) — only the enum + hook here.

## MODULE ACCEPTANCE CRITERIA
- [ ] Static and dynamic audiences persist and resolve; RLS-isolated.
- [ ] Membership state is **consent-aware** — an opted-out contact is `opted_out`, excluded from `contactable` (proven by test against Wave 0 consent).
- [ ] Existing inline campaign rules lift into `audiences` without breaking current reads (expand-contract).
- [ ] `resolveAudience` returns the matched/contactable/opted-out breakdown consumed by 1A and Campaign.
- [ ] Audience builder UI works standalone and embedded.

## TEST MATRIX (minimum)
1. Migration idempotency + RLS on both tables.
2. Dynamic rule resolution returns the correct contacts.
3. Consent-aware membership: opted-out contact excluded from `contactable`.
4. Inline-rules → audiences extraction parity; old shape still readable.
5. FE: build an audience, see the breakdown, reference it from a journey.
