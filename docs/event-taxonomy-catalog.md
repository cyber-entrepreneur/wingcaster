# Event Taxonomy Catalog — v2

**Status:** Draft — the `event_name` vocabulary + emission contract for the Wave 0 `events` table. **v2 folds in the 2nd external audit; apply before freezing Wave 0's events table.**
**Date:** 2026-09-19
**Feeds:** Wave 0 `events` (append-only spine) + `metric_observations`; Wave 2 `conversions` + `attribution_credits`; the AI learning loop.
**Binds to:** `docs/canonical-object-model.md` §H (Event/Conversion/AttributionCredit) and §I (Decision).

## v2 changelog (from the audit — apply before Wave 0 freeze)
1. **`id` = event identity; add required-unique `idempotency_key`; `provider_event_id`/`provider_message_id` nullable+informational.** (Do NOT add a redundant `event_id` — the PK is the identity.)
2. **`MetricObservation` introduced; cumulative platform metrics removed from Events.** Discrete per-recipient interactions stay events.
3. **Event-level identity refs added** (`subject_identity_id NULL`, `identity_refs JSONB`) — schema now, resolution engine later.
4. **`actor`/`object_ref` split into `actor_type`+`actor_id` / `object_type`+`object_id`.**
5. **Authoritative-producer ownership map added; provenance carried in a documented `context` shape** (columns fast-follow, not now).
6. **Human commercial-action event family added** (agent/lead/viewing follow-up).
- Also: `message.sent`→`message.submitted/delivered/failed`; unsubscribe is scoped (channel×purpose×scope); `execution_id` causal vs `campaign_id` contextual/nullable; AI event family; a **context contract** (no raw PII in `context`); enum→**EventDefinition registry** noted as post-launch evolution.

---

## 0. Why freeze this now
Every attribution number, funnel report, and AI-learning feature reads `events`. If the vocabulary is invented ad-hoc per producer, we get 150 near-duplicate names, un-joinable data, and double-counted commissions. This catalog defines the **stable event names**, their **categories**, the **funnel mapping**, and the **idempotency + causality rules** — so Wave 0 seeds the enum and every producer (Journey sends, social publishing, webhooks, CRM) emits the same names.

---

## 1. Naming & versioning conventions
- **Name format:** `object.action`, lowercase, dot-namespaced, **past tense**. E.g. `message.delivered`, `post.published`, `lead.created`, `viewing.booked`, `consent.withdrawn`.
- **`event_category`** ∈ `business · delivery · engagement · system` (Wave 0 enum).
- **Event identity:** the table's `id` PK **is** the globally-unique event id (no separate `event_id`).
- **`idempotency_key`** — required, `UNIQUE`. Distinct from the provider's id (see §2). This is the dedup key.
- **`provider_event_id` / `provider_message_id`** — nullable, informational (the provider's native ids); never the dedup key by themselves.
- **`schema_version`** — per `event_name`, integer from `1`. Breaking `context` change → bump; never repurpose a name.
- **`source`** = producer subsystem (`journey · publishing · webhook:meta · webhook:whatsapp · crm · finance · ai`).
- **`actor_type` + `actor_id`** (NOT a formatted string): `actor_type ∈ agent·contact·system·ai`, `actor_id` the id (or model name for ai).
- **`object_type` + `object_id`** (NOT `execution:exec_123`): the primary entity, e.g. `object_type=execution, object_id=exec_…`.
- **Identity refs:** `subject_identity_id NULL` (the future `Identity` anchor) + `identity_refs JSONB` (namespaced handles: `{email, phone, whatsapp, crm_contact, anonymous_web, meta_lead, portal_lead}`). Populate what's known **now**; resolution engine is deferred. This avoids re-migrating a full events table to add identity later.
- **`occurred_at`** (source time) vs **`ingested_at`** (store time) — always both.
- **Provenance** (in `context`, documented shape; graduates to columns when AI produces facts): `{assertion_method: manual|rule|ai|import, confidence?, model_version?, verified_by?}`.
- **Context contract (enforced):** `context` JSONB holds **references + approved analytical attributes only — never raw sensitive payloads** (message bodies, phone numbers, notes). No shadow-CRM in the event table.
- **Governance:** for launch, a new event = a first-landing enum migration + a catalog row; nothing emits an unlisted name. **Post-launch this graduates to an `EventDefinition` registry** (name·category·schema·owner·pii_class·retention_class·status) so vocabulary isn't coupled to DDL forever. The enum is workable now, not permanent architecture.

---

## 2. Idempotency (non-negotiable)
- Every event has an `idempotency_key` (`UNIQUE`); ingest is `ON CONFLICT (idempotency_key) DO NOTHING`.
- **Provider-sourced events** (webhooks): `idempotency_key = "<source>:<provider_event_id>"`, and store the raw `provider_event_id`/`provider_message_id` too. Webhooks retry — this prevents a double-counted open/click/conversion.
- **Internally-produced events** (journey/publishing/system): `idempotency_key = "<source>:<object_type>:<object_id>:<event_name>:<occurred_at-or-seq>"` so a retried producer can't duplicate.
- **Rule:** no event is written without an `idempotency_key`. Ever. (Identity ≠ dedup key ≠ provider id — three distinct concepts, three distinct fields.)

## 3. Causality (for AI explainability + multi-touch)
- **`correlation_id`** groups all events of one logical operation — a publish fan-out, a journey run, a campaign. Same `correlation_id` across the chain.
- **`causation_event_id`** = the event that directly caused this one (e.g. `lead.created` caused by a `link.clicked`). Producers set it where the cause is known.
- Together they let attribution reconstruct: `decision → execution → post.published → post.impression → link.clicked → lead.created → viewing.booked → transaction.closed`.

---

## 3B. Events vs MetricObservation (snapshots are NOT events)
A polled cumulative counter is **not** an event. Instagram insights returning `impressions=12,431` then `14,923` is one growing counter, not 27,354 impressions — summing snapshots in the append-only stream corrupts attribution and ML. So:
- **Discrete per-recipient interactions → Events** (each is one occurrence with a provider id): `email.opened`, `email.clicked`, `message.read`, `message.replied`, `link.clicked`, `unsubscribe.requested`.
- **Cumulative platform counters → `MetricObservation`** (a separate table): impressions, reach, likes, shares, saves, video views.

**`MetricObservation`** (new — schema in Wave 0, ingestion in Wave 2): `id · subject_type · subject_id · execution_id? · metric_name · metric_value · aggregation_type(cumulative/gauge) · period_start · period_end · observed_at · source · provider_ref · dimensions JSONB`. Attribution reads Events for causal touchpoints and MetricObservation for reach/spend context — never conflates them.

## 4. The catalog

### 4A. `business` — funnel-progressing facts (the commission moat) **[L]**
These drive `Conversion` + `AttributionCredit`. Value-bearing ones carry `value_micros`+`currency`.

| event_name | When | Producer | Key context | Value? | Funnel → |
|---|---|---|---|---|---|
| `lead.created` | A new contact/enquiry enters (inbound portal/Bazaar/social, or manual) | crm / webhook | `source_channel`, `property_id?` | — | → lead |
| `lead.qualified` | Lead marked qualified (agent or scoring) | crm / ai | `score?`, `reason` | — | lead → qualified |
| `viewing.booked` | A viewing/appointment is scheduled | crm | `property_id`, `scheduled_at` | — | qualified → viewing |
| `viewing.completed` | Viewing marked done | crm | `property_id` | — | viewing |
| `offer.made` | An offer/application submitted | crm | `property_id` | `value_micros` (offer amt) | viewing → offer |
| `reservation.created` | Unit reserved/booked | crm | `property_id` | `value_micros` | offer → reservation |
| `transaction.closed` | Deal closed | crm / finance | `property_id` | `value_micros` (GTV) | reservation → transaction |
| `commission.earned` | Commission recognised | **finance** (ledger is source of truth) | `transaction_ref` | `value_micros` (commission) | transaction → commission |

> `transaction.closed` / `commission.earned` values are **attested from the finance ledger**, not guessed by marketing — define the read boundary (canonical-model open Q#3). This is what makes "marketing ROI = commission" real.

### 4B. `delivery` — did it go out **[L]**
Emitted by the publishing/journey send paths (Wave 1B/1A) per Execution.

| event_name | When | Producer | Key context | Idempotency |
|---|---|---|---|---|
| `message.submitted` | WingCaster successfully hands the message to the provider (email/SMS/WhatsApp) | journey/publishing | `execution_id`, `channel` | provider msg id |
| `message.delivered` | Provider reports delivery | webhook | `execution_id` | provider event id |
| `message.failed` | Terminal send/delivery failure | journey/publishing/webhook | `execution_id`, `error_class` | deterministic |
| `post.published` | Organic social post live | publishing (path B) | `execution_id`, `platform`, `provider_ref` | provider post id |
| `post.failed` | Publish failed | publishing | `execution_id`, `platform`, `error_class` | deterministic |
| `portal.submitted` | Portal submission accepted / in_review | publishing (path C) | `execution_id`, `portal` | deterministic |
| `ad.delivered` *(FF)* | Paid ad served (discrete delivery notice; **cumulative impressions → MetricObservation**) | webhook (Meta/Google) | `execution_id` | provider event id |

> **Removed the ambiguous `message.sent`.** "Sent" conflated attempted/accepted/transmitted. `message.submitted` = we handed it off; `message.delivered` = provider confirmed; `message.failed` = terminal. Add `message.queued`/`message.accepted` later only if SLA reporting needs them.

### 4C. `engagement` — recipient/audience actions **[L core, FF for paid]**
Mostly provider webhooks + link tracking.

| event_name | When | Producer | Key context |
|---|---|---|---|
| `email.opened` | Discrete email open (webhook) | webhook | `execution_id` |
| `email.clicked` | Discrete link-in-email click | webhook / link-tracker | `execution_id`, `url` |
| `message.read` | WhatsApp/SMS read receipt | webhook | `execution_id` |
| `message.replied` | Recipient replies (owned messaging) | webhook / conversations | `execution_id`, `conversation_id` |
| `link.clicked` | Tracked link/UTM hit (landing/listing page) | web / link-tracker | `property_id?`, `url`, `identity_refs.anonymous_web` |
| `unsubscribe.requested` | Opt-out/STOP/unsubscribe click | webhook / journey | `contact_id`, **scope**: `channel` + `purpose` (+ `agency_id`) → writes a **scoped** `consent.withdrawn`, not global suppression |

> **Cumulative post metrics moved to `MetricObservation`** (§3B): `post.impressions`, `post.reach`, `post.likes`, `post.shares`, `post.saves`, `video.views` are gauge/cumulative observations, not events.
> **`unsubscribe` scope:** "unsubscribe from this newsletter" ≠ "never contact me anywhere." The withdrawal is per `channel × purpose × scope`, matching the Consent model (`docs/consent-and-compliance-spec.md` §2).

### 4D. `system` — internal/operational **[L for the starred ones]**
Operational + governance + AI. Not funnel events, but power observability, suppression audit, and the Decision loop.

| event_name | When | Producer | Notes |
|---|---|---|---|
| `execution.created` * | Execution row created | executions.js | |
| `execution.retried` | Retry attempted | publishing/journey | |
| `consent.granted` * | Consent captured | consent.js | writes alongside `consent` row |
| `consent.withdrawn` * | Opt-out processed | consent.js | the suppression audit trail |
| `journey.entered` * | Contact enters a journey run | journey engine | `journey_run_id` |
| `journey.node.suppressed` * | Send blocked by eligibility | journey engine | carries the `checkEligibility` `reason_code` |
| `journey.exited` | Run ends (completed/exited) | journey engine | |
| `channel.connection.expired` | A channel token expired | channels.js | ops alert |
| `approval.requested` / `approval.decided` *(1C)* | AI-content gate | approvals | `object=creative`, decision |
| `decision.made` *(FF)* | A consequential AI decision recorded | ai | `object=decision` (rich record lives in the `Decision` object, not the event) |
| `decision.executed` *(FF)* | The decided action was carried out | ai/executions | `object=decision`, `execution_id` |
| `decision.overridden` *(FF)* | A human overrode the AI decision | agent | `object=decision`, `override_reason` — **high-value training signal** |
| `decision.outcome.observed` *(FF)* | The decision's outcome resolved | system | `object=decision`, `outcome_event_id` |

\* = emit at launch (needed for suppression audit + basic observability). Others as their producing wave lands.

> **Event vs Decision:** the event only records *that* a decision occurred; the candidates/reasons/confidence/constraints live in the `Decision` object (D15 §I). `decision.overridden` + a later `decision.outcome.observed` is the closed learning loop — if the AI said "don't contact," the agent contacted anyway, and it converted, that override is priceless training data.

### 4E. `business` — human commercial actions (WingCaster-specific; **[L]** the starred) 
Agents are part of the causal chain. Without these, attribution/AI credits the ad when the real driver was speed-to-lead.

| event_name | When | Producer | Why it matters |
|---|---|---|---|
| `lead.assigned` * | Lead routed to an agent | crm | routing latency |
| `lead.accepted` | Agent accepts the lead | crm | ownership |
| `lead.contacted` * | First agent outreach to the lead | crm/journey | **speed-to-lead** — the key RE conversion predictor |
| `agent.call.started` / `agent.call.completed` | Agent phone contact | crm/telephony | effort + response time |
| `agent.message.sent` | Agent 1:1 message (not a journey blast) | conversations | manual touch |
| `agent.note.created` | Agent logs a note | crm | qualitative signal |
| `viewing.followup.completed` | Post-viewing follow-up done | crm | nurture effort |

These let the learning engine discover, from WingCaster's own graph, e.g. *"leads contacted within 5 minutes convert to viewings X% more often for this segment"* — not industry folklore.

---

## 5. Funnel → Conversion mapping (for Wave 2 attribution)
`business` events materialise `Conversion` rows (from_stage → to_stage):

`impression`(engagement) → `click`(link.clicked) → `lead`(lead.created) → `qualified`(lead.qualified) → `viewing`(viewing.booked) → `offer`(offer.made) → `reservation`(reservation.created) → `transaction`(transaction.closed) → `commission`(commission.earned)

Each Conversion is attributed across the `execution_id`s found on the correlated engagement/delivery events via `AttributionCredit` × model. **Wave 0 only writes Events; Conversion/AttributionCredit are Wave 2** — but the event fields (`execution_id`, `campaign_id`, `correlation_id`, `causation_event_id`) must be populated now so Wave 2 has the data.

---

## 6. Mapping to existing signals (so nothing is reinvented)
- Existing `logActivity` types (`distribution_published/failed/queued_retry/draft`) → map to `post.published` / `post.failed` / `execution.retried`.
- Existing `distributions` view/lead/click counters → derive from `post.impression` / `link.clicked` / `lead.created` going forward.
- `fetchInstagramInsights` (and FB/X equivalents) → periodic `post.impression` / `post.engaged` ingestion (snapshot cadence — see open Q).
- Conversations subsystem (inbound DMs/comments, `source_channel`) → `message.replied`, and the WhatsApp inbound timestamp feeds the `checkEligibility` 24h window (consent spec §6).

---

## 7. Governance
- One catalog, one owner. A new `event_name` requires: a row here + `schema_version` + an enum migration (own first-landing migration). PRs adding an event link this file. (Post-launch: the `EventDefinition` registry replaces the enum — §1.)
- Prefer **fewer, well-typed** events with rich (but PII-safe — §1 context contract) `context` over many bespoke names.
- **Authoritative producer per fact (one, not many).** Prevents three conflicting "transaction closed"s. Consumers read; only the owner emits:

| Fact | Authoritative producer |
|---|---|
| `lead.created·qualified·assigned·accepted·contacted` | CRM |
| `viewing.*`, `offer.made`, `reservation.created` | CRM |
| `transaction.closed`, `commission.earned` | **Finance** (ledger) |
| `message.*`, `post.*`, `portal.*`, `ad.*` | Publishing/Journey (Wave 1A/1B, 2A) |
| `email.*`, `link.clicked`, engagement | Webhook/link-tracker |
| `consent.*`, `unsubscribe.requested` | Consent (Wave 0) |
| `decision.*` | AI |
| `agent.*` | CRM/conversations |

## 5B. `execution_id` is causal; `campaign_id` is contextual
Attribution keys off `execution_id` (the touchpoint). `campaign_id` is context and **nullable** — a standalone Instagram post (no campaign, per P1) that drives a transaction still attributes through its `execution_id`. **Never fabricate a `campaign_id`** just because a report wants one.

## 8. Open questions
1. ~~Insights cadence / snapshots~~ **Resolved (v2):** cumulative metrics → `MetricObservation` (§3B), not Events. Remaining sub-decision: the `MetricObservation` polling interval + dedup key (Wave 2).
2. **Finance boundary:** exact read/attest contract for `transaction.closed`/`commission.earned` from the ledger.
3. **Anonymous → known:** stitch `link.clicked`'s `identity_refs.anonymous_web` to a `contact` on identity resolution (deferred) — schema (`subject_identity_id`/`identity_refs`) is in place now so no event backfill is needed later.
4. **Paid events:** Meta/Google ad delivery/engagement webhook mapping (Wave 2A, gated on platform approval); cumulative ad metrics → MetricObservation.
5. **EventDefinition registry:** when to graduate from the enum (post-launch); include pii_class + retention_class then.
