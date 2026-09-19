# Event Taxonomy Catalog

**Status:** Draft — the `event_name` vocabulary + emission contract for the Wave 0 `events` table.
**Date:** 2026-09-19
**Feeds:** Wave 0 `events` (append-only spine); Wave 2 `conversions` + `attribution_credits`; the AI learning loop.
**Binds to:** `docs/canonical-object-model.md` §H (Event/Conversion/AttributionCredit) and §I (Decision).

---

## 0. Why freeze this now
Every attribution number, funnel report, and AI-learning feature reads `events`. If the vocabulary is invented ad-hoc per producer, we get 150 near-duplicate names, un-joinable data, and double-counted commissions. This catalog defines the **stable event names**, their **categories**, the **funnel mapping**, and the **idempotency + causality rules** — so Wave 0 seeds the enum and every producer (Journey sends, social publishing, webhooks, CRM) emits the same names.

---

## 1. Naming & versioning conventions
- **Name format:** `object.action`, lowercase, dot-namespaced, **past tense**. E.g. `message.delivered`, `post.published`, `lead.created`, `viewing.booked`, `consent.withdrawn`.
- **`event_category`** ∈ `business · delivery · engagement · system` (Wave 0 enum).
- **`schema_version`** is per `event_name`, integer, starts at `1`. A breaking change to an event's `context` shape → bump the version; never repurpose a name.
- **`source`** = the producer subsystem (`journey · publishing · webhook:meta · webhook:whatsapp · crm · finance · ai`).
- **`actor`** = who/what triggered it (`agent:<id> · contact:<id> · system · ai:<model>`).
- **`object_ref`** = the primary entity (`execution:<id> · property:<id> · contact:<id> · journey_run:<id>`).
- **`occurred_at`** (when it happened, from the source) vs **`ingested_at`** (when we stored it) — always both.
- Adding a new event = a one-line enum migration (its own first-landing migration, per repo rule) + a row in this catalog. Nothing emits an unlisted name.

---

## 2. Idempotency (non-negotiable)
- **Provider-sourced events** (webhooks: Meta/WhatsApp/portal delivery + engagement) set `provider_event_id` = the provider's event/message id. `events.provider_event_id` is `UNIQUE`; ingest is `ON CONFLICT DO NOTHING`. Webhooks retry — this prevents a double-counted open/click/conversion.
- **Internally-produced events** (journey/publishing/system) set `provider_event_id` = a deterministic key `"<source>:<object_ref>:<event_name>:<occurred_at-or-seq>"` so a retried producer can't duplicate.
- **Rule:** no event is written without an idempotency key. Ever.

## 3. Causality (for AI explainability + multi-touch)
- **`correlation_id`** groups all events of one logical operation — a publish fan-out, a journey run, a campaign. Same `correlation_id` across the chain.
- **`causation_event_id`** = the event that directly caused this one (e.g. `lead.created` caused by a `link.clicked`). Producers set it where the cause is known.
- Together they let attribution reconstruct: `decision → execution → post.published → post.impression → link.clicked → lead.created → viewing.booked → transaction.closed`.

---

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
| `message.sent` | Owned-messaging send accepted by provider (email/SMS/WhatsApp) | journey/publishing | `execution_id`, `channel` | provider msg id |
| `message.delivered` | Provider confirms delivery | webhook | `execution_id` | provider event id |
| `message.failed` | Send/delivery failed | journey/publishing/webhook | `execution_id`, `error_class` | deterministic |
| `post.published` | Organic social post live | publishing (path B) | `execution_id`, `platform`, `provider_ref` | provider post id |
| `post.failed` | Publish failed | publishing | `execution_id`, `platform`, `error_class` | deterministic |
| `portal.submitted` | Portal submission accepted / in_review | publishing (path C) | `execution_id`, `portal` | deterministic |
| `ad.delivered` *(FF)* | Paid ad served | webhook (Meta/Google) | `execution_id`, `impressions` | provider event id |

### 4C. `engagement` — recipient/audience actions **[L core, FF for paid]**
Mostly provider webhooks + link tracking.

| event_name | When | Producer | Key context |
|---|---|---|---|
| `email.opened` | Email open pixel | webhook | `execution_id` |
| `email.clicked` | Link in email clicked | webhook / link-tracker | `execution_id`, `url` |
| `message.read` | WhatsApp/SMS read receipt | webhook | `execution_id` |
| `message.replied` | Recipient replies (owned messaging) | webhook / conversations | `execution_id`, `conversation_id` |
| `post.impression` | Organic post view (from insights) | insights poll (`fetchInstagramInsights`-style) | `execution_id`, `platform`, `count` |
| `post.engaged` | Like/comment/share on a post | insights / webhook | `execution_id`, `engagement_type` |
| `link.clicked` | Tracked link/UTM hit (landing/listing page) | web / link-tracker | `property_id?`, `url`, `visitor_ref` |
| `unsubscribe.requested` | Opt-out/STOP/unsubscribe click | webhook / journey | `contact_id`, `channel` → also writes `consent.withdrawn` |

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
| `approval.requested` / `approval.decided` *(1C)* | AI-content gate | approvals | `subject_ref`, decision |
| `decision.made` *(FF)* | A consequential AI decision recorded | ai | links to `Decision`; `outcome_event_id` set later |

\* = emit at launch (needed for suppression audit + basic observability). Others as their producing wave lands.

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
- One catalog, one owner. A new `event_name` requires: a row here + `schema_version` + an enum migration (own first-landing migration). PRs adding an event link this file.
- Prefer **fewer, well-typed** events with rich `context` over many bespoke names.
- `context` is JSONB but documented per event; anything reported/filtered graduates to a column.

## 8. Open questions
1. **Insights cadence:** are `post.impression`/`post.engaged` per-event (webhook) or periodic snapshots? (Likely snapshots — define interval + de-dup, since they're cumulative counts, not discrete events → may store as metric snapshots rather than append events. **[decide before Wave 2]**)
2. **Finance boundary:** exact read/attest contract for `transaction.closed`/`commission.earned` from the ledger.
3. **Anonymous → known:** `link.clicked` with a `visitor_ref` before `lead.created` — stitch on identity resolution (deferred) via `correlation_id`.
4. **Paid events:** Meta/Google ad delivery/engagement webhook mapping (Wave 2, gated on platform approval).
