# Jurisdiction Requirements Research — listing authorization & anti-fraud

_Sibling to `PORTAL_LIST_RESEARCH_2026-09-04.md`. That doc catalogues **per-portal** field
requirements (what Bayut/PF/etc. demand). **This** doc catalogues **per-jurisdiction** legal
requirements (what a country's law demands for a property located there), which is the
anti-fraud driver. Portal-specific fields stay in the portal registry and are **not**
duplicated here._

Last updated: 2026-09-22 · Owner: WingCaster product/eng · Review cadence: quarterly.

---

## Why this exists

WingCaster distributes listings to external portals **and** to its own surfaces (agent/agency
profile, white-label sites, Real Estate Bazaar). A fraudulent or unauthorized listing harms
buyers, the destination sites, and WingCaster. The control that prevents it is **not** "is the
agent licensed" alone — it is a set of per-property, per-jurisdiction checks that prove:

1. the lister is **authorized** to market this specific property (Layer B), and
2. the property **exists and is owned** as claimed (Layer C), and
3. the advertisement is **permitted** to run on the destination (Layer D).

## The organizing principle: 4 requirement layers, 3 different drivers

Every requirement belongs to exactly one layer, and each layer is driven by a different thing.
This is what stops "Trakheesi" from leaking across everything.

| Layer | Question it answers | Driven by | Collected at |
|---|---|---|---|
| **A. Broker standing** | Are you allowed to broker here at all? | Where the **agent** is licensed | Onboarding |
| **B. Listing authorization** | Is it up for sale, by the owner, via you? | Where the **property** is | Per listing |
| **C. Property existence / title** | Is it real, and whose is it? | Where the **property** is | Per listing |
| **D. Advertising permit** | Can this ad run on this channel? | The **destination** (jurisdiction + portal) | Per publish |
| E. Fraud mapping (derived) | Which fraud case does each control address? | — | — |
| F. Governance | Source + confidence per cell | — | — |

## Governance rules (these bind the whole model)

1. **No unsourced cell ships as enforcement.** A row with `confidence: Low` or no
   `expertSignoff` can be **collected** (upload/attest) but **cannot drive a hard gate** or a
   "Registry-verified" badge.
2. **Verification strength is explicit.** `verifyApi: null` means the field is self-declared →
   it earns **"Authorised"** at best, never **"Registry-verified"**.
3. **Verification ladder:** `unverified → authorised → registry_verified`.
   - `authorised` = all required, **sourced** controls for the property's jurisdiction are
     present + self-attested.
   - `registry_verified` = a regulator API confirmed the permit/deed (future PR; unreachable
     today by design).

### Sourcing rules — what counts as authoritative, per layer

| Source type | A (standing) | B (authorization) | C (title) | D (permit) |
|---|---|---|---|---|
| Regulator portal / official gazette / statute | ✅ hard-gate | ✅ hard-gate | ✅ hard-gate | ✅ hard-gate |
| Government e-service help page (regulator-owned) | ✅ | ✅ | ✅ | ✅ |
| Law-firm / Big-4 legal summary | ⚠️ Medium — collect-only | ⚠️ | ⚠️ | ⚠️ |
| Portal help-center (Bayut/PF) | ❌ | ❌ | ❌ | ✅ **only** Layer-D portal fields |
| News article | ⚠️ corroboration only | ⚠️ | ⚠️ | ⚠️ |
| Agency blog / SEO content | ❌ never | ❌ | ❌ | ❌ |

A cell may only be marked `gateEligible: true` when at least one **✅** source backs it.

---

## Per-market questionnaire (what a researcher answers per country)

Every answer needs a **source + confidence**.

**Layer A — Broker standing:** (1) licence to broker + issuing body; (2) separate office
licence + body; (3) mandatory or unregulated; (4) verifiable against a public registry/API?

**Layer B — Listing authorization:** (5) document authorizing a broker to market a specific
property + governing body; (6) parties/signatures; (7) legally required to advertise or good
practice; (8) captured as signed doc / reference number / both; (9) validation authority/API;
(10) off-plan variant (developer authorization).

**Layer C — Existence & ownership:** (11) document proving the unit exists + owner (ready vs
off-plan) + authority; (12) registry it's verified against; (13) verification API + what it
confirms (ownership / encumbrance / sold / attributes); (14) API access model; (15) fallback.

**Layer D — Advertising permit:** (16) per-ad permit? name + authority; (17) **scope: all
advertising incl. owned channels, or portals only?**; (18) per-listing or per-portal +
verifiable; (19) portal-registry cross-link.

**Layer E — Fraud mapping:** (20) which fraud case (not-authorized / not-sellable /
not-there); (21) enforcement point; (22) gate strength (self-declared / upload / API); (23)
badge earned.

**Layer F — Governance:** (24) source citations (regulator/official only); (25) last-verified
· confidence (H/M/L) · expert sign-off · review cadence.

---

## Findings by market (2026-09 authoritative pass)

Confidence: **H** = regulator-sourced, gate-eligible · **M** = corroborated but needs local
expert sign-off before it can hard-gate · **—** = no such requirement.

### UAE — Dubai · **gate-eligible**
- **D. Permit:** **Trakheesi** advertising permit (unique number per advert), issued by
  **DLD** through the Trakheesi e-service, supervised by **RERA**. **Scope: ALL marketing** —
  portals, **the agency's own website**, social, SMS/email, billboards, open houses, launches.
  Valid ~60 days. Obtainable **only by a DLD-licensed broker/company/developer** via their
  business account; the owner authorizes the broker. **verifyApi: Dubai REST / DLD Listing
  Validation API** → confidence **H**.
- **C. Title:** **Title Deed** (ready) / **Oqood** (off-plan, DLD-registered); verifiable via
  Dubai REST. **B. Authorization:** owner↔broker **Form A** (off-plan → developer authorization).
- **A. Standing:** RERA **BRN** (broker) under a brokerage with **ORN** + DED trade licence.
- Sources: dubailand.gov.ae/en/eservices/real-estate-ad-permit, propertyfinder.ae/blog/trakheesi,
  bayut.com/mybayut/trakheesi, dubailand.gov.ae/en/eservices/api-gateway.

### UAE — Abu Dhabi · **gate-eligible**
- **D. Permit:** **Madhmoun** permit via **ADREC**'s **DARI** platform (mandatory since Jul
  2025) + broker **BLN** required on **all listings, social, portals, contracts**; the owner
  must approve the broker's request. **verifyApi: DARI.** Confidence **H**.
- Distinct system from Dubai — do not assume Trakheesi covers Abu Dhabi.
- Sources: help.dari.ae (ADREC), propertyfinder.ae/partnerhub (BLN).

### KSA · **gate-eligible**
- **D. Permit:** real-estate **advertisement licence** number, generated on the **Fal**
  platform (REGA); usable across channels. **REGA advertisement-licence inquiry service**
  verifies validity (fraud reduction). Confidence **H**.
- **A. Standing:** Fal brokerage licence. Sources: rega.gov.sa (Fal + advert-licence services).

### Kuwait · capture-only (M)
- Ads limited to **licensed brokerage companies**; **no property may be advertised without a
  "property identification letter" from the Municipality.** Authority: MOCI / Municipality.
  Needs local-expert sign-off + a verify path before it can hard-gate. Source: moci.gov.kw,
  Kuwait Times.

### Qatar · capture-only (M)
- **Advertising licence** (developers) via **Aqarat.gov.qa** (RERA); brokerage RERA licence
  mandatory. Resale-broker per-ad specifics need expert sign-off. Source: aqarat.gov.qa.

### Bahrain · capture-only (M)
- **RERA Bahrain** (Law 27/2017): brokers/agencies licensed; **developers need advertising
  licences + must register projects.** Resale per-ad specifics TBD. Source: rera.gov.bh.

### Oman · capture-only (M)
- Brokerage/marketing licence from **Ministry of Housing & Urban Planning** under the new
  **Real Estate Regulation Law 79/2025**; per-ad permit specifics still settling. Source: gov.om.

### Egypt · capture-only (M)
- New brokerage law (eff. **18 Jan 2026**): broker **registration** (FRA / GOEIC) — an
  identity/accountability regime, **not a per-ad permit**. Rely on Layer C (title / الشهر
  العقاري) + Layer B. Source: propertyfinder.eg/blog.

### Jordan · capture-only (M)
- **No rigid agent-licensing system and no per-ad permit.** Property authority is the
  **Department of Lands & Survey (DLS)** (title deeds); agencies register with the Ministry of
  Industry, Trade & Supply. Rely on Layer C (DLS title) + Layer B. Source: dls.gov.jo, ARAB MLS.

### Lebanon (home market) · capture-only (M, expert)
- **No central real-estate advertising-permit or broker-licensing regime.** Legitimacy is the
  **Land Registry title (إفادة عقارية) + notary**. Rely on Layer C + Layer B. Needs a Lebanese
  legal-expert pass to confirm.

### International (NL / UK / US / West) · —
- **No per-ad government permit.** The control is the agent/brokerage licence (Layer A) + MLS
  membership. A "Trakheesi-type" per-ad permit is essentially a Gulf phenomenon.

**How other platforms enforce it:** GCC portals gatekeep licensed accounts and validate the
permit against the regulator (Dubai REST/Trakheesi, REGA inquiry, DARI). International
aggregators mostly **do not** enforce local permits — they lean on "verified agent/developer"
badges, KYC/AML, and device/IP fraud signals, and push ownership verification onto the buyer.
That non-enforcement is the fraud gap WingCaster's control closes.

---

## The data schema code consumes

Keyed by ISO country code; the **driver** is explicit; portal fields stay in the portal
registry.

```
JurisdictionRequirements[countryCode] = {
  regulators:          [{ name, role }],
  brokerCredentials:   [{ key, label, authority, verifyApi|null, required }],   // Layer A
  listingAuthorization:{ docKey, label, authority, capture, verifyApi|null,
                         requiredForAdvertising, offPlanVariant },              // Layer B
  ownership:           { readyDocKey, offPlanDocKey, authority, verifyApi|null,
                         verifiable: ['ownership'|'encumbrance'|'sold'|'attributes'],
                         fallback },                                            // Layer C
  advertisingPermit:   { key, label, authority, scope:'all_advertising'|'portals_only'|null,
                         perListing, verifyApi|null, gateEligible },            // Layer D
  provenance:          { sources[], lastVerified, confidence, expertSignoff, reviewEvery }
}
```

`propertyVerificationFor(countryCode)` (code) returns **only** the `advertisingPermit` fields
where `gateEligible === true` — the derived selector that can never launder a Low-confidence
cell into enforcement.

## Fraud → control → enforcement → badge (Layer E)

| Fraud case | Control | Layer | Enforcement point | Gate strength | Badge |
|---|---|---|---|---|---|
| Lister not authorized to sell | Owner authorization (Form A / dev auth) | B | publish | upload/attest (until sourced+API) | Authorised |
| Property doesn't exist / mis-described | Title Deed / Oqood | C | publish | upload/attest → API later | Authorised → Registry-verified |
| Ad runs illegally / unlicensed | Trakheesi/Madhmoun/Fal permit no. | D | publish (portals + own surfaces) | **hard-gate (sourced)** → API later | Authorised → Registry-verified |
| Sold-many-times / stale | Dup/sold detection by permit/deed/address | C/D | post-publish | — (later PR) | — |

## Roadmap (later PRs, documented not built)
- Regulator-API cross-check → `registry_verified` (Dubai REST/DLD, REGA inquiry, DARI).
- Duplicate/sold detection by permit / deed / address.
- In-app + geotagged media capture + reverse-image check for stolen photos.
- Periodic availability attestation + auto-expiry of stale listings.
