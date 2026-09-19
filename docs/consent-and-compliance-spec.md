# Consent & Communication Compliance — Spec

**Status:** Draft — engineering contract + policy framework. **Launch-critical** (gates all marketing sends).
**Date:** 2026-09-19
**Feeds:** Wave 0 `Consent` object + `consent.checkEligibility()`; every send path in Waves 1A/1B.
**Owner sign-off required:** Product + **Legal counsel** (items marked **[LEGAL-CONFIRM]** are framework proposals, not settled law — WingCaster is not receiving legal advice from this document).

---

## 0. Why this is launch-critical
WingCaster sends outbound messages (email/SMS/WhatsApp) to real people, and it will do so **at scale and increasingly AI-generated**. Sending marketing without a valid legal basis is unlawful in every jurisdiction WingCaster operates in, and WhatsApp/Meta will **ban the business number/account** for unsolicited business-initiated messaging. The `Consent` object + a single `checkEligibility()` gate on every send is the control that prevents this. No compliant launch without it.

---

## 1. Jurisdictions in scope (validate with counsel)
WingCaster's operating footprint (per project context: GCC-centric + Lebanon, inbound leads from regional portals) implies at least:

| Jurisdiction | Regime (as we understand it — **[LEGAL-CONFIRM]**) | Practical effect |
|---|---|---|
| **UAE** | Federal Decree-Law No. 45/2021 (PDPL) + sector rules; TDRA rules on electronic marketing | Consent for direct e-marketing; honour opt-out; controller obligations |
| **KSA** | PDPL (in force; SDAIA regulations) | Consent + data-subject rights; restrictions on marketing |
| **Other GCC** (Qatar, Bahrain, Oman, Kuwait) | Per-country data-protection laws | Treat as consent-required by default |
| **Lebanon** | Law 81/2018 (e-transactions & personal data) | Consent + lawful processing |
| **EU/UK data subjects** (if any contact is in EU/UK) | GDPR + **PECR** (e-privacy) | Explicit opt-in for e-marketing; strict |
| **US** (if any) | CAN-SPAM / TCPA | Opt-out (email), prior express consent (SMS) |
| **Platform policy (cross-jurisdiction)** | **WhatsApp Business / Meta** messaging policy | Opt-in required for business-initiated; 24-hour service window; approved templates outside it |

**Design principle:** default to the **strictest applicable rule** per contact, resolved by the contact's `jurisdiction`. Where jurisdiction is unknown, default to consent-required (opt-in) behaviour.

---

## 2. Core enumerations (bind to Wave 0 `Consent` table)

**Purpose** (`consent.purpose`):
- `transactional` — service messages the person's own action necessitates (OTP, inquiry acknowledgement, viewing confirmation/reminder, offer/booking status). Generally lawful without marketing consent under contract/legitimate-interest **[LEGAL-CONFIRM]**.
- `nurture` — 1:1 follow-up tied to an active enquiry/relationship (agent following up on a specific property the lead asked about).
- `marketing` — business-initiated promotion not tied to a live request (new-listing announcements, price-drop blasts, re-engagement).

**Channel** (`consent.channel`): `email · sms · whatsapp` (owned messaging — the consent-gated set). *Public social posts are NOT a consent channel — no per-contact recipient.*

**Status** (`consent.status`): `granted · denied · withdrawn`. (Absence of a row = **unknown** = treated as not-granted for marketing.)

**Legal basis** (`consent.legal_basis`, **[LEGAL-CONFIRM]** vocabulary): `explicit_optin · double_optin · contract · legitimate_interest · soft_optin_existing_customer`.

---

## 3. Purpose × Channel matrix — what each send requires

| Purpose \ Channel | Email | SMS | WhatsApp |
|---|---|---|---|
| **transactional** | Allowed on `contract`/`legitimate_interest`; no marketing opt-in needed. Must still be genuinely transactional (no marketing riders). | Same. | Allowed **inside the 24h service window** (person messaged first) OR via an **approved utility/authentication template**. |
| **nurture** | Requires at least `soft_optin` (existing enquiry relationship) **[LEGAL-CONFIRM]**; honour opt-out. | Prior consent recommended; SMS is high-risk — prefer opt-in. | Requires WhatsApp **opt-in**; outside the 24h window only via approved template. |
| **marketing** | Requires `explicit_optin` (or `soft_optin_existing_customer` where lawful **[LEGAL-CONFIRM]**); one-click unsubscribe mandatory. | Requires **explicit opt-in**. | Requires **explicit opt-in** + approved **marketing template**; never inside a cold contact. |

> **The spam line (from the reconciliation doc):** WingCaster must never send business-initiated marketing to a contact who hasn't opted in for that channel+purpose. "Appearing in a stranger's inbox" is only legitimate via **paid** Google Demand Gen (Gmail placement), never via owned email.

---

## 4. Inbound leads — what an enquiry does and does NOT grant
Leads flow IN from portals (PF, Bayut, Dubizzle, Aqar…), Bazaar, and social (per `[[project_wingcaster_vs_bazaar]]`). Critical distinctions:

- A person submitting an **enquiry about a specific property** → establishes a basis for **`transactional` + `nurture` about that enquiry** (they initiated contact; contract/legitimate-interest) **[LEGAL-CONFIRM]**. For WhatsApp this also opens the **24-hour service window** if *they* messaged first.
- It does **NOT** grant **`marketing`** consent (unrelated new-listing blasts, portfolio promos). That still needs an explicit opt-in.
- **Source matters for proof:** store the inbound source + payload as `proof_ref` (which portal, timestamp, the enquiry text). The `source_channel`/source label WingCaster already captures per conversation feeds this.

**Consequence for Journeys (1A):** a nurture journey triggered by `new_lead`/`inquiry` may run **transactional/nurture** sends about that enquiry; a `marketing` journey (business-initiated blast) must filter its audience to contacts with `marketing` consent for the channel — enforced by `checkEligibility`.

---

## 5. `checkEligibility()` — the decision contract (Wave 0 implements this)

**Signature:** `checkEligibility({ contactId, channel, purpose, now? }) → { allowed: boolean, reason_code, required_action?, window_expires_at? }`

**Precedence (evaluate top-down; first match wins):**
1. **Global do-not-contact / `withdrawn`** for (contact, channel) → `DENY_WITHDRAWN`.
2. **Channel connection unhealthy** (no connected sender for the channel) → `DENY_CHANNEL_UNHEALTHY`. *(eligibility, not consent, but the send can't happen)*
3. **`purpose = transactional`:**
   - email/sms → `ALLOW` (`OK_TRANSACTIONAL`) provided content is genuinely transactional.
   - whatsapp → within 24h service window → `ALLOW` (`OK_SERVICE_WINDOW`, return `window_expires_at`); else if approved utility/auth template → `ALLOW` (`OK_TEMPLATE`); else `DENY_WHATSAPP_WINDOW_CLOSED_NO_TEMPLATE`.
4. **`purpose ∈ {nurture, marketing}`:** require a `granted`, non-expired consent row for (contact, channel, purpose) satisfying the §3 legal-basis rule for the contact's `jurisdiction`:
   - none/`denied` → `DENY_NO_CONSENT`;
   - expired → `DENY_EXPIRED`;
   - whatsapp granted but outside window and no approved **marketing** template → `DENY_WHATSAPP_NO_TEMPLATE`;
   - jurisdiction forbids this basis → `DENY_JURISDICTION_RESTRICTED`;
   - else → `ALLOW` (`OK_CONSENT_GRANTED`).
5. **Frequency/pressure cap** (ContactPolicy — later wave): hook returns `DENY_FREQUENCY_CAPPED`. For launch this hook exists and defaults to allow.

**Reason codes (stable set):** `OK_TRANSACTIONAL · OK_SERVICE_WINDOW · OK_TEMPLATE · OK_CONSENT_GRANTED · DENY_WITHDRAWN · DENY_NO_CONSENT · DENY_EXPIRED · DENY_OPTED_OUT · DENY_WHATSAPP_NO_TEMPLATE · DENY_WHATSAPP_WINDOW_CLOSED_NO_TEMPLATE · DENY_JURISDICTION_RESTRICTED · DENY_CHANNEL_UNHEALTHY · DENY_FREQUENCY_CAPPED`.

**Every send in 1A (Journey `send` node) and 1B (WhatsApp recipient send) calls this and records the reason_code on the resulting Execution/JourneyNodeRun.** A denied result is a first-class outcome (`suppressed`), never a silent drop and never an error that's swallowed.

---

## 6. WhatsApp — the strictest channel (get this exactly right)
- **Opt-in required** for any business-initiated message; capture the opt-in with proof (where/when/what wording).
- **24-hour customer service window:** if the user messages the business, you may reply freely for 24h; outside it, only **approved templates**.
- **Template categories:** `utility`/`authentication` (transactional) vs `marketing` — marketing templates require the marketing opt-in and are subject to Meta review + per-message pricing.
- WingCaster already sends listing cards via WhatsApp Cloud API (`sendListingToWhatsApp`) — that path **must** route through `checkEligibility({channel:'whatsapp'})` and choose window-vs-template accordingly. Today it does not; 1B fixes this.
- OTP already goes via **Microsoft Graph email** (`[[project_otp_transport]]`), not WhatsApp — keep OTP transport as-is; it's `transactional`.

---

## 7. Capture, proof, lifecycle
- **Capture sources** (`consent.source`): `signup_checkbox · preference_center · whatsapp_optin_keyword · inbound_enquiry · imported(with basis) · double_optin_email`.
- **Proof** (`consent.proof_ref`): pointer to an immutable record — form snapshot, opt-in message id, portal enquiry payload, double-opt-in click event. **Required** for `explicit_optin`/`double_optin`.
- **Double opt-in for email marketing** (recommended, **[LEGAL-CONFIRM]** whether mandatory per jurisdiction): granted only after the confirmation click event exists.
- **Lifecycle & history:** consent is **append-only** (never overwrite); the "current" state per (contact, channel, purpose) is the latest row, exposed via a view. Withdrawal writes a `withdrawn` row; it does not delete history (proof of prior state matters).
- **Expiry:** `expires_at` optional; where a jurisdiction imposes a validity period, set it and `DENY_EXPIRED` past it. **[LEGAL-CONFIRM]** per-jurisdiction durations.
- **Withdrawal / unsubscribe:** every marketing message carries a one-click opt-out (email unsubscribe, WhatsApp "STOP", SMS "STOP"); processing an opt-out writes `withdrawn` and takes effect immediately (before the next send).

---

## 8. Data-subject rights (design hooks — depth is fast-follow)
- **Access / portability:** a contact's consent history is queryable for DSAR responses.
- **Erasure:** hard-delete path (separate from soft-delete) that removes PII while retaining a minimal lawful proof-of-consent-withdrawal record **[LEGAL-CONFIRM]**.
- **Preference center:** a per-contact page to view/adjust channel×purpose consents (fast-follow UI; the data model supports it now).

---

## 9. Mapping to Wave 0 `Consent` table (what to build now)
Wave 0 already creates `consent(id · contact_id · channel · purpose · status · legal_basis · source · captured_at · expires_at · jurisdiction · proof_ref · data)`. This spec adds the following **[for Wave 0 / a fast-follow tightening]**:
- **Current-state view** `consent_current` = latest row per (contact_id, channel, purpose).
- **`checkEligibility()`** implemented exactly per §5 (this is the launch-critical function; ship it in Wave 0 with the full reason-code set and the WhatsApp window logic).
- WhatsApp **service-window** state: derive the 24h window from the last inbound WhatsApp message time (from the conversations subsystem) — `checkEligibility` reads it; no new table needed if the inbound timestamp is available.
- Seed `legal_basis`/`purpose`/`status` enums via the enum-first migration.

---

## 10. Open decisions — for Product + Legal to confirm before/at launch
1. **[LEGAL-CONFIRM]** Exact regime + marketing rules per operating country (UAE/KSA/other GCC/Lebanon), and whether any EU/UK/US data subjects exist (triggers GDPR/PECR/CAN-SPAM).
2. **[LEGAL-CONFIRM]** Does a portal enquiry lawfully support `nurture` about that property without separate opt-in? (Our proposed default: yes for that enquiry; no for unrelated marketing.)
3. **[LEGAL-CONFIRM]** Is `soft_optin_existing_customer` available for email marketing in each jurisdiction, or is `explicit_optin` always required?
4. **[LEGAL-CONFIRM]** Consent validity/expiry durations per jurisdiction.
5. **[PRODUCT]** Default when `jurisdiction` is unknown → we propose strictest (opt-in required). Confirm.
6. **[PRODUCT]** Preference-center + DSAR UI: launch or fast-follow? (Data model supports either.)
7. **[OPS]** WhatsApp marketing template library — draft + submit for Meta approval now (external clock, like the ad approvals).

---

## 11. What this unblocks
- Wave 0 can implement `checkEligibility` to a precise contract (not a guess).
- Waves 1A/1B wire every owned-messaging send through it → compliant sending at launch.
- The audience membership `opted_out` state (1D) reads the same consent source → truthful reach counts.
- The WhatsApp template + opt-in work becomes an explicit external-clock task to start now.
