# Canonical Object Model (D15) — v2

> Growth-OS spine. Wave 0 landed the objects below. Later waves add Campaign,
> Journey, Audience, Creative, Conversion, AttributionCredit, Experiment, Decision.

**Status:** Binding contract for Growth-OS Wave 0+.  
**IDs:** TEXT, app-generated `uuidv4()` with type prefix (`chn_`, `chnd_`, `exec_`, `exa_`, `evt_`, `cns_`).  
**Money:** BIGINT minor units (`value_micros`) + `currency` TEXT.  
**Timestamps:** TIMESTAMPTZ.  
**Escape hatch:** every table has `data JSONB NOT NULL DEFAULT '{}'`; anything queried/joined/reported is a real column.

## Objects (Wave 0)

### ChannelDefinition
Global catalog row for a platform.

| Field | Notes |
|---|---|
| id | `chnd_…` |
| platform | unique (case-insensitive) |
| kind | `owned_messaging` · `organic_social` · `paid` · `portal` |
| global_capabilities | JSONB |

### ChannelConnection
Tenant binding to a ChannelDefinition.

| Field | Notes |
|---|---|
| id | `chn_…` |
| channel_definition_id | FK |
| agency_id / agent_id | tenancy |
| integration_model | TEXT |
| credentials_ref | **pointer only** (`secret:…`) — never raw tokens |
| provider_account_id | |
| rate_limits / tenant_capabilities | JSONB |
| health | `connected` · `disconnected` · `expired` · `error` |

### Execution
One outbound unit of work (message, social post, paid ad, portal submit, SEO page).

| Field | Notes |
|---|---|
| id | `exec_…` |
| kind | `message` · `social_post` · `paid_ad` · `portal_submit` · `seo_page` |
| status | `draft` · `scheduled` · `in_review` · `queued` · `processing` · `published` · `failed` · `cancelled` |
| campaign_id / creative_id / audience_id / journey_node_run_id | nullable TEXT; **FK added when those tables land** |
| channel_connection_id | FK nullable |
| subject_type / subject_id | e.g. property |
| scheduled_at / recurrence / provider_ref / published_at / completed_at | |

### ExecutionAttempt
Mirror of legacy `distribution_attempts`.

| Field | Notes |
|---|---|
| id | `exa_…` |
| execution_id | FK |
| status / response / error_message / error_class / attempted_at | |

### Event
Immutable-ish analytics/business event. `provider_event_id` UNIQUE; ingest is `ON CONFLICT DO NOTHING`.

| Field | Notes |
|---|---|
| id | `evt_…` |
| event_name / event_category | category ∈ `business` · `delivery` · `engagement` · `system` |
| schema_version / source / actor / object_ref / context | |
| occurred_at / ingested_at | |
| contact_id / execution_id / campaign_id / channel_connection_id | nullable |
| value_micros / currency | money |
| provider_event_id | UNIQUE when not null |
| correlation_id / causation_event_id | |

**Partitioning:** monthly range partitioning on `occurred_at` conflicts with Postgres requiring partition keys in UNIQUE indexes (`provider_event_id`). Wave 0 uses a **single table** + `growth_os_ensure_events_partition()` helper (no-op) until a composite uniqueness model is adopted.

### Consent
Append-only consent history; current state per `(contact_id, channel, purpose)` via `consent_current` view (latest `captured_at`).

| Field | Notes |
|---|---|
| id | `cns_…` |
| contact_id / channel / purpose | purpose ∈ `marketing` · `transactional` · `nurture`; channel ∈ `email` · `sms` · `whatsapp` |
| status | `granted` · `denied` · `withdrawn` |
| legal_basis | `explicit_optin` · `double_optin` · `contract` · `legitimate_interest` · `soft_optin_existing_customer` |
| source / captured_at / expires_at / jurisdiction / proof_ref | |

**History model:** append-only rows; `setConsent()` always inserts. View `consent_current` = `DISTINCT ON (contact_id, channel, purpose) … ORDER BY captured_at DESC`.

`checkEligibility({ contactId, channel, purpose, now? })` → `{ allowed, reason_code, required_action?, window_expires_at? }` per `docs/consent-and-compliance-spec.md` §5 (precedence: withdrawn → channel health → transactional/WhatsApp window → nurture/marketing consent → frequency cap).

## Maps to existing schema

| Legacy | Canonical |
|---|---|
| `platform_accounts` + `marketplace_connections` | `channel_definitions` (dedupe by platform) + `channel_connections` |
| `distribution_jobs` (app collection `distributions` is a DAL alias — **no physical `distributions` table**) + `publishing_jobs` + `scheduled_publications` | `executions` |
| `distribution_attempts` | `execution_attempts` |
| (historical events) | **out of scope** for Wave 0 backfill |

Deterministic backfill IDs: `chn_pa_<id>`, `chn_mc_<id>`, `exec_dj_<id>`, `exec_pj_<id>`, `exec_sp_<id>`, `exa_<id>`, `chnd_<md5(lower(platform))>`.

Forward-sync: AFTER INSERT OR UPDATE triggers on legacy tables upsert canonical rows. No reverse triggers. Application write-site cutover is a later wave.
