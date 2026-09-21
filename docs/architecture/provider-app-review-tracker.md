# WingCaster — Provider OAuth App-Review Tracker

**Companion to** `docs/architecture/oauth-connect-unification.md` (§7).
Owner: _[assign]_ · Created: 2026-09-21 · Target go-live: **2026-09-30**

> **Why this exists:** OAuth-primary connect is gated by each provider approving WingCaster's app for the
> **publish/refresh scopes**. Code readiness ≠ provider approval. Several reviews take **weeks to months**
> and must be started **in parallel with PR1**, not after. Manual-fallback connect is NOT blocked by any
> of this — only the OAuth-primary path is. Keep this file updated as submissions move; reference it from
> the connect PRs.

**Single global WingCaster app per provider** (per the architecture decision) — one submission per
provider covers all tenants. Tenants authorize through it; they do not submit their own apps.

---

## Status at a glance

| # | Provider | Covers channels | Review type | Lead time (typical) | Priority | Status | Owner | Submitted | Decision |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Google** (Gmail) | Email (send/inbound) | OAuth verification + **CASA security assessment** (restricted scopes) | **Weeks–months** (longest) | 🔴 Start first | ☐ Not started | | | |
| 2 | **Meta** (FB/IG) | Facebook, Instagram | Business Verification + App Review (Advanced Access) | **1–4 weeks** (+ verification) | 🔴 Start first | ☐ Not started | | | |
| 3 | **Meta** (WhatsApp) | WhatsApp | Above + WABA + display-name + phone approval | **2–4 weeks** | 🟠 High | ☐ Not started | | | |
| 4 | **TikTok** | TikTok | Content Posting API audit (Direct Post) | **1–3 weeks** | 🟠 High | ☐ Not started | | | |
| 5 | **LinkedIn** | LinkedIn | Community Management API / Marketing Developer Platform | **2–6 weeks** | 🟠 High | ☐ Not started | | | |
| 6 | **X / Twitter** | X | Paid API tier (no classic review; tier + use-case) | **Days** (procurement) | 🟡 Medium | ☐ Not started | | | |
| 7 | **Microsoft** (Entra) | Email (Outlook/Graph) | Publisher Verification (+ optional certification); admin consent | **Days–weeks** | 🟡 Medium | ☐ Not started | | | |

**Status legend:** ☐ Not started · ◐ In prep · ⧗ Submitted · 🔍 In review · ✅ Approved · ✖ Rejected (see notes)

**Sequencing rationale:** Google CASA and Meta Business Verification have the longest and least
controllable lead times → begin both the day PR1 starts. X and Microsoft are the lightest and can be done
close to launch.

---

## Shared prerequisites (needed by most providers — prepare once, up front)

- ☐ **Public privacy policy URL** (must describe OAuth data use, retention, deletion).
- ☐ **Terms of Service URL**.
- ☐ **Public homepage** for WingCaster (provider reviewers visit it).
- ☐ **App display name, icon/logo** (square, high-res), support email.
- ☐ **Verified business entity** (legal name, address, domain — used by Meta/Google/Microsoft verification).
- ☐ **Production OAuth redirect URIs** registered (per environment: preview + production Railway domains).
- ☐ **Data-deletion / de-authorization endpoint** (Meta requires a data-deletion callback; good practice
  for all). Tracked as a follow-up PR in the architecture doc §7.
- ☐ **Demo/test tenant + screencast** showing each requested permission actually in use (reviewers require
  this for Meta, TikTok, Google, LinkedIn). Record once the connect UI (PR3/PR4) is demoable.
- ☐ **Scope-justification text** per permission (why WingCaster needs it) — reused across submissions.

---

## 1. Google (Gmail) — 🔴 longest lead, start first

**Console:** Google Cloud Console → APIs & Services → OAuth consent screen + Credentials.
**Scopes triggering review:** `gmail.send` (and `gmail.readonly`/`gmail.modify` if inbound) are
**restricted scopes** → require OAuth app verification **and** an annual **CASA (Cloud Application
Security Assessment)** security review.

Checklist:
- ☐ Create/confirm the Google Cloud project + OAuth client (Web application).
- ☐ Configure OAuth consent screen: External, publishing status, scopes, authorized domains.
- ☐ Privacy policy + homepage on a verified domain (Search Console domain verification).
- ☐ Add restricted scopes + written justification per scope.
- ☐ Record demo video showing the exact scope usage end-to-end.
- ☐ Submit for verification → respond to Google's brand + scope review.
- ☐ Complete **CASA assessment** (Tier 2 for restricted scopes) via an authorized assessor — budget cost
  and calendar time; this is the slow gate.
- ☐ Confirm annual re-assessment reminder is set.

**Notes/blockers:** _[running log]_

---

## 2. Meta — Facebook + Instagram — 🔴 start first

**Console:** Meta for Developers → App Dashboard + Meta Business Suite (Business Verification).
**Permissions triggering Advanced Access review:** `pages_show_list`, `pages_read_engagement`,
`pages_manage_posts`, `pages_manage_metadata`, `business_management`, `instagram_basic`,
`instagram_content_publish`, `read_insights`.

Checklist:
- ☐ Create the Meta app (Business type) under the WingCaster Business account.
- ☐ **Business Verification** in Business Settings (legal docs, domain, phone) — start immediately, it's
  independent of app review and often the longest step.
- ☐ Add Facebook Login + Instagram Graph products; register redirect URIs.
- ☐ Set privacy policy URL, **data deletion callback URL**, app icon, category.
- ☐ Verify the app domain(s).
- ☐ Request Advanced Access for each permission with use-case notes + screencast (a reviewer must see
  publishing to a Page and to an IG business account).
- ☐ Provide test Page + IG business account + test user credentials for the reviewer.
- ☐ Submit App Review; iterate on any rejections (common; budget a round or two).

**Notes/blockers:** _[running log]_

---

## 3. Meta — WhatsApp — 🟠 high

**Console:** Meta for Developers (WhatsApp product) + WhatsApp Manager.
Builds on #2 (same Meta app + business verification). Adds messaging-permission review and account setup.

Checklist:
- ☐ Advanced Access for `whatsapp_business_management`, `whatsapp_business_messaging`.
- ☐ Create/link a **WhatsApp Business Account (WABA)**.
- ☐ Register a phone number; complete **display-name approval**.
- ☐ Configure Embedded Signup (PR7) for tenant onboarding; register the config.
- ☐ Message-template approval process understood (for template sends).
- ☐ Confirm messaging tier / rate limits.

**Notes/blockers:** _[running log]_

---

## 4. TikTok — 🟠 high

**Console:** TikTok for Developers → Manage apps.
**Trigger:** Login Kit + **Content Posting API** (Direct Post) require an audit/approval; sandbox
available for pre-approval testing.

Checklist:
- ☐ Register the app; add Login Kit + Content Posting API products.
- ☐ Configure scopes `user.info.basic`, `video.publish`, `video.upload`; register redirect URI + verify.
- ☐ Build/test against **sandbox** first (works before approval).
- ☐ Prepare demo + use-case description for the Content Posting audit (Direct Post especially).
- ☐ Submit for review; iterate.
- ☐ Confirm production quota after approval.

**Notes/blockers:** _[running log]_

---

## 5. LinkedIn — 🟠 high

**Console:** LinkedIn Developer Portal → Apps (must be linked to a verified Company Page).
**Trigger:** `w_member_social` (Share on LinkedIn) is self-serve; **refresh tokens + organization posting
+ broader read** require the **Community Management API / Marketing Developer Platform** application and
approval. Without it, tokens are 60-day and non-refreshable.

Checklist:
- ☐ Create the app; associate + verify the WingCaster **Company Page**.
- ☐ Add "Sign In with LinkedIn using OpenID Connect" + "Share on LinkedIn" products.
- ☐ Register redirect URIs.
- ☐ Apply for **Community Management API / Marketing Developer Platform** (for refresh tokens + org
  posting) with business justification.
- ☐ Provide use-case + demo as requested.
- ☐ Confirm which token lifetimes you'll get (refresh vs 60-day) and reflect in `token-store` behavior.

**Notes/blockers:** _[running log]_

---

## 6. X / Twitter — 🟡 medium (procurement, not classic review)

**Console:** X Developer Portal → Projects & Apps.
**Trigger:** OAuth 2.0 **write** access + DMs require a **paid API tier** (Basic/Pro). This is a
subscription + use-case attestation rather than a lengthy human review, but it has cost and account setup.

Checklist:
- ☐ Create/confirm developer account + Project + App.
- ☐ Select the appropriate **paid tier** for tweet.write (+ DM scopes if used); confirm monthly write caps
  vs expected volume.
- ☐ Enable OAuth 2.0, set redirect URIs, note **PKCE required (S256)** — already handled in PR1.
- ☐ Complete developer-agreement / use-case attestation.
- ☐ Confirm rate limits for the chosen tier.

**Notes/blockers:** _[running log]_

---

## 7. Microsoft (Entra ID) — Email/Outlook — 🟡 medium

**Console:** Microsoft Entra admin center → App registrations.
**Trigger:** Delegated `Mail.Send` / `Mail.ReadWrite` for a per-tenant mailbox rely on **user + admin
consent**, not a Microsoft "app review" like Graph *application* permissions. For a multi-tenant app,
**Publisher Verification** (via a Microsoft Partner/MPN account) is strongly recommended (removes the
"unverified" consent warning); Microsoft 365 Certification is optional and heavier.

Checklist:
- ☐ Register a **multi-tenant** app (`common` authority); add delegated scopes
  `offline_access openid email profile User.Read Mail.Send Mail.ReadWrite`.
- ☐ Register redirect URIs; enable PKCE (S256, handled in PR8).
- ☐ Complete **Publisher Verification** (MPN/Partner account linked) to avoid unverified-app warnings.
- ☐ Document the **admin-consent** workflow for tenants whose org requires it.
- ☐ Decide whether to pursue Microsoft 365 App Certification (optional; defer unless needed).
- ☐ **Do not disturb** the existing app-only client-credentials Graph app used for platform OTP — this is
  a separate, new delegated registration.

**Notes/blockers:** _[running log]_

---

## Cross-cutting risks

- **The 2026-09-30 date:** OAuth-primary connect for a given channel cannot go live until that provider
  approves. Base-platform launch (manual fallback) is unaffected. Recommend framing OAuth-primary as
  channel-by-channel enablement gated on approval, dark-launched behind the per-provider feature flags
  (architecture doc §5.9). Enable each channel's OAuth as its approval lands.
- **Rejections are normal** (especially Meta) — budget one or two iteration rounds per submission.
- **Annual obligations:** Google CASA re-assessment and any Microsoft certification recur — set reminders.
- **De-authorization / data-deletion callbacks** (Meta-required) should ship before Meta approval — track
  as the follow-up PR noted in the architecture doc §7.
```
