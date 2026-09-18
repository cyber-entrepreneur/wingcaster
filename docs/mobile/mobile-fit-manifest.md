# Mobile-fit manifest

Every `.tsx` file under `web/src/pages/` on `main` (as of 2026-09-17, count: **194**) is classified below for the Capacitor iOS + Android build. The classification decides which screens are wrapped into the native shell's route map, which stay strictly web, and which are sub-components that inherit their parent's decision.

## Legend

| Tag | Meaning | Ships in iOS + Android app? |
|---|---|---|
| **MP** | Mobile-primary — daily driver on the phone; drives all Capacitor build decisions | Yes, first-class |
| **MS** | Mobile-secondary — usable on the phone but low-frequency; kept simple, no phone-specific optimization | Yes, second-class |
| **AUTH** | Authentication surface — required on every platform | Yes |
| **WEB** | Web-only — desktop-first admin console, or public/SEO surface | No |
| **SUB** | Sub-component of a parent page (routes.tsx, shared.tsx, component leaf) — inherits parent classification, not a route itself | Inherits |
| **DEV** | Developer/inspector tooling — never ships | No |

An **MP** or **MS** screen does not mean it looks identical to the web view. Where the brief already ships a mobile design (e.g., `AGT-LST-001-listing-list-mobile-brief.md`), the same responsive React renders in Capacitor. Where the design is desktop-only, we plan a mobile-adapted view before flipping the screen from **WEB** to **MP/MS** in a later revision.

## Summary counts

| Bucket | Count | Ships on phone |
|---|---|---|
| MP — Mobile-primary | 46 | Yes |
| MS — Mobile-secondary | 33 | Yes |
| AUTH — Auth surfaces | 8 | Yes |
| WEB — Web-only | 45 | No |
| SUB — Sub-components (inherit) | 60 | Inherits |
| DEV — Dev/inspector | 2 | No |
| **Total** | **194** | — |

Effective phone route target: **87 top-level screens** (MP + MS + AUTH) plus their sub-components (~48 of the 60 SUBs inherit from mobile parents).

---

## MP — Mobile-primary (46)

Daily-driver screens for the field agent. These MUST work on a phone — bottom-tab nav, thumb-first controls, native camera / push / biometrics wired.

| File | Notes |
|---|---|
| [AgentDashboardPage.tsx](web/src/pages/AgentDashboardPage.tsx) | Home tab. Widgets, activation banner, quick actions. |
| [InboxPage.tsx](web/src/pages/InboxPage.tsx) | Unified inbox — WhatsApp + portal inquiries. Push-notification target. |
| [ContactsPage.tsx](web/src/pages/ContactsPage.tsx) | Contact list — search, filter, CRUD from phone. |
| [ContactDetailPage.tsx](web/src/pages/ContactDetailPage.tsx) | Contact detail — call / WhatsApp / email deep links. |
| [ListingsPage.tsx](web/src/pages/ListingsPage.tsx) | Listing list — brief `AGT-LST-001` is already mobile-first. |
| [ListingProfilePage.tsx](web/src/pages/ListingProfilePage.tsx) | Listing detail — photo gallery, share sheet, edit. |
| [OpportunitiesPage.tsx](web/src/pages/OpportunitiesPage.tsx) | Deal pipeline — kanban → mobile card-list. |
| [TasksPage.tsx](web/src/pages/TasksPage.tsx) | Task list — check off from phone. |
| [CommandCenterPage.tsx](web/src/pages/CommandCenterPage.tsx) | Global search + quick actions. |
| [AgentProfilePage.tsx](web/src/pages/AgentProfilePage.tsx) | Own profile / avatar / bio. |
| [SocialChannelsPage.tsx](web/src/pages/SocialChannelsPage.tsx) | WhatsApp / IG / TikTok channel status — reconnect flows. |
| [NotificationPreferencesPage.tsx](web/src/pages/NotificationPreferencesPage.tsx) | Push toggle wired via Capacitor push plugin. |
| [PreferencesPage.tsx](web/src/pages/PreferencesPage.tsx) | Locale / theme / RTL. |
| [SettingsPage.tsx](web/src/pages/SettingsPage.tsx) | Settings hub — routes into MFA / passkeys / sessions. |
| [agent/PortalTrackerPage.tsx](web/src/pages/agent/PortalTrackerPage.tsx) | Multi-portal publish tracker — status chips, retry. |
| [agent/PortalSubmitPage.tsx](web/src/pages/agent/PortalSubmitPage.tsx) | Submit to portal — mobile-primary because listings are captured in the field. |
| [agent/PublishOutcomePage.tsx](web/src/pages/agent/PublishOutcomePage.tsx) | Publish result / receipt after portal submit. |
| [agent/PublishReceiptPage.tsx](web/src/pages/agent/PublishReceiptPage.tsx) | Shareable publish receipt. |
| [agent/dashboard/AgentDashboardModeMount.tsx](web/src/pages/agent/dashboard/AgentDashboardModeMount.tsx) | Dashboard mode dispatcher. |
| [agent/dashboard/ProDashboard.tsx](web/src/pages/agent/dashboard/ProDashboard.tsx) | Pro dashboard — mobile-primary responsive. |
| [agent/listings/ManualListingComposerPage.tsx](web/src/pages/agent/listings/ManualListingComposerPage.tsx) | **Capacitor Camera plugin critical.** Photo capture, GPS-tagged address. |
| [agent/activation/ActivationWelcomePage.tsx](web/src/pages/agent/activation/ActivationWelcomePage.tsx) | Activation step 1. |
| [agent/activation/ActivationWhatsAppPage.tsx](web/src/pages/agent/activation/ActivationWhatsAppPage.tsx) | Connect WhatsApp — QR / deep link. |
| [agent/activation/ActivationFirstListingPage.tsx](web/src/pages/agent/activation/ActivationFirstListingPage.tsx) | Activation step 3 — first listing. |
| [agent/activation/ActivationPortalCredentialsPage.tsx](web/src/pages/agent/activation/ActivationPortalCredentialsPage.tsx) | Portal credentials — biometric-gated on native. |
| [agent/activation/ActivationWorkingHoursPage.tsx](web/src/pages/agent/activation/ActivationWorkingHoursPage.tsx) | Working hours. |
| [agent/activation/ActivationInviteTeamPage.tsx](web/src/pages/agent/activation/ActivationInviteTeamPage.tsx) | Invite team — native share sheet. |
| [agent/onboarding/WelcomePage.tsx](web/src/pages/agent/onboarding/WelcomePage.tsx) | Onboarding welcome. |
| [agent/onboarding/WhatsAppIntakeTourPage.tsx](web/src/pages/agent/onboarding/WhatsAppIntakeTourPage.tsx) | WhatsApp intake tour — mobile-native fit. |
| [agent/onboarding/FirstListingReviewPage.tsx](web/src/pages/agent/onboarding/FirstListingReviewPage.tsx) | Review AI-drafted first listing. |
| [agent/onboarding/CelebrationPage.tsx](web/src/pages/agent/onboarding/CelebrationPage.tsx) | Onboarding complete. |
| [agent/whatsapp-intake/WhatsAppConnectPage.tsx](web/src/pages/agent/whatsapp-intake/WhatsAppConnectPage.tsx) | Native deep link into WhatsApp. |
| [agent/whatsapp-intake/ActivationCodePage.tsx](web/src/pages/agent/whatsapp-intake/ActivationCodePage.tsx) | Show 6-digit code. |
| [agent/whatsapp-intake/FirstMessageWaitingPage.tsx](web/src/pages/agent/whatsapp-intake/FirstMessageWaitingPage.tsx) | Waiting for first message. |
| [agent/whatsapp-intake/ListingDraftingPage.tsx](web/src/pages/agent/whatsapp-intake/ListingDraftingPage.tsx) | AI drafting from WhatsApp thread. |
| [agent/whatsapp-listings/AgentWhatsAppListingsPage.tsx](web/src/pages/agent/whatsapp-listings/AgentWhatsAppListingsPage.tsx) | Agent's WhatsApp listing drafts inbox. |
| [agent/contacts/RelationshipsEditorPage.tsx](web/src/pages/agent/contacts/RelationshipsEditorPage.tsx) | Contact relationships editor — MP because contacts are managed in the field. |
| [agent/reports/BadComparableReportPage.tsx](web/src/pages/agent/reports/BadComparableReportPage.tsx) | Report bad comparable — mobile trigger from a listing. |
| [agent/reports/PriceReportPage.tsx](web/src/pages/agent/reports/PriceReportPage.tsx) | Submit price report — mobile trigger. |
| [agent/reports/BadComparableOutcomePage / ComparableReportOutcomePage.tsx](web/src/pages/agent/reports/ComparableReportOutcomePage.tsx) | Report submitted outcome. |
| [agent/reports/PriceReportOutcomePage.tsx](web/src/pages/agent/reports/PriceReportOutcomePage.tsx) | Price report outcome. |
| [agent/ApplicationOutcomePage.tsx](web/src/pages/agent/ApplicationOutcomePage.tsx) | Agency-application result. |
| [agent/OwnershipTransferOutcomePage.tsx](web/src/pages/agent/OwnershipTransferOutcomePage.tsx) | Ownership-transfer accept/decline outcome. |
| [AreaProfilePage.tsx](web/src/pages/AreaProfilePage.tsx) | Neighbourhood profile — market data + share. |
| [NeighborhoodValuatorPage.tsx](web/src/pages/NeighborhoodValuatorPage.tsx) | Instant valuation — mobile-primary tool. |
| [CrmAnalyticsPage.tsx](web/src/pages/CrmAnalyticsPage.tsx) | Analytics dashboard — mobile-readable summary; deeper drill-downs desktop-first but the summary tab ships MP. |

---

## MS — Mobile-secondary (33)

Usable on the phone but low-frequency. Not the primary target — no phone-specific optimization beyond responsive layout — but they must render correctly at 375px.

| File | Notes |
|---|---|
| [CampaignsPage.tsx](web/src/pages/CampaignsPage.tsx) | Campaign list — read on mobile, edit on desktop. |
| [CampaignBuilderPage.tsx](web/src/pages/CampaignBuilderPage.tsx) | Campaign builder — mobile view-only; edit UX kept desktop. |
| [MessageTemplatesPage.tsx](web/src/pages/MessageTemplatesPage.tsx) | Message templates — read/select on mobile, edit on desktop. |
| [MyCreditsPage.tsx](web/src/pages/MyCreditsPage.tsx) | Own credit balance. |
| [MyCreditNotesPage.tsx](web/src/pages/MyCreditNotesPage.tsx) | Credit notes list. |
| [MyInvoicesPage.tsx](web/src/pages/MyInvoicesPage.tsx) | Invoices list. |
| [MySubscriptionPage.tsx](web/src/pages/MySubscriptionPage.tsx) | Subscription status / upgrade. |
| [HistoricalTransactionsPage.tsx](web/src/pages/HistoricalTransactionsPage.tsx) | Transaction history. |
| [PlansPage.tsx](web/src/pages/PlansPage.tsx) | Plan picker. |
| [AgentPricingPage.tsx](web/src/pages/AgentPricingPage.tsx) | Agent pricing tiers. |
| [AgencyPricingPage.tsx](web/src/pages/AgencyPricingPage.tsx) | Agency pricing tiers. |
| [IntegrationSettingsPage.tsx](web/src/pages/IntegrationSettingsPage.tsx) | External integrations — set once, mostly desktop, but toggles reachable on mobile. |
| [RoutingSettingsPage.tsx](web/src/pages/RoutingSettingsPage.tsx) | Inquiry routing rules. |
| [WhiteLabelBuilderPage.tsx](web/src/pages/WhiteLabelBuilderPage.tsx) | White-label site builder — read-only view on mobile. |
| [WidgetBuilderPage.tsx](web/src/pages/WidgetBuilderPage.tsx) | Widget builder — read-only view on mobile. |
| [AgencyManagementPage.tsx](web/src/pages/AgencyManagementPage.tsx) | Agency HQ dashboard. |
| [agency/AgencyOnboardingPage.tsx](web/src/pages/agency/AgencyOnboardingPage.tsx) | Agency onboarding. |
| [agency/ApplicationsQueuePage.tsx](web/src/pages/agency/ApplicationsQueuePage.tsx) | Agent applications queue — approve on mobile. |
| [agency/ApplicationDetailPage.tsx](web/src/pages/agency/ApplicationDetailPage.tsx) | Application detail. |
| [agency/AgencyOwnershipTransferInitiatorPage.tsx](web/src/pages/agency/AgencyOwnershipTransferInitiatorPage.tsx) | Initiate transfer. |
| [agency/AgencyOwnershipTransferAcceptPage.tsx](web/src/pages/agency/AgencyOwnershipTransferAcceptPage.tsx) | Accept transfer. |
| [agency/settings/AgencySecurityPolicyPage.tsx](web/src/pages/agency/settings/AgencySecurityPolicyPage.tsx) | Admin-enforced MFA policy (H1). |
| [agency/settings/RolesOverviewPage.tsx](web/src/pages/agency/settings/RolesOverviewPage.tsx) | Agency roles. |
| [agency/settings/RolePermissionsDetailPage.tsx](web/src/pages/agency/settings/RolePermissionsDetailPage.tsx) | Role detail. |
| [agency/whatsapp-listings/AgencyWhatsAppListingsPage.tsx](web/src/pages/agency/whatsapp-listings/AgencyWhatsAppListingsPage.tsx) | Agency WhatsApp inbox. |
| [settings/AccountPage.tsx](web/src/pages/settings/AccountPage.tsx) | Account settings. |
| [settings/PasswordPage.tsx](web/src/pages/settings/PasswordPage.tsx) | Change password. |
| [settings/BillingPage.tsx](web/src/pages/settings/BillingPage.tsx) | Billing. |
| [settings/SessionsPage.tsx](web/src/pages/settings/SessionsPage.tsx) | Active sessions / revoke. |
| [settings/ApiTokensPage.tsx](web/src/pages/settings/ApiTokensPage.tsx) | PAT management. |
| [settings/DataExportPage.tsx](web/src/pages/settings/DataExportPage.tsx) | GDPR self-serve export. |
| [settings/DeleteAccountPage.tsx](web/src/pages/settings/DeleteAccountPage.tsx) | Account deletion. |
| [settings/SettingsHomePage.tsx](web/src/pages/settings/SettingsHomePage.tsx) | Settings hub. |

---

## AUTH — Authentication surfaces (8)

Required on every platform.

| File | Notes |
|---|---|
| [LoginPage.tsx](web/src/pages/LoginPage.tsx) | Sign-in. Biometric autofill on native. |
| [RegisterPage.tsx](web/src/pages/RegisterPage.tsx) | Register — email + OTP. |
| [AgentRegisterPage.tsx](web/src/pages/AgentRegisterPage.tsx) | Agent-flavoured register. |
| [ForgotPasswordPage.tsx](web/src/pages/ForgotPasswordPage.tsx) | Forgot password. |
| [ResetPasswordPage.tsx](web/src/pages/ResetPasswordPage.tsx) | Reset password. |
| [AccountRecoveryPage.tsx](web/src/pages/AccountRecoveryPage.tsx) | Account recovery start. |
| [AccountRecoveryCompletePage.tsx](web/src/pages/AccountRecoveryCompletePage.tsx) | Recovery complete. |
| [PublicAgencyApplyPage.tsx](web/src/pages/PublicAgencyApplyPage.tsx) | Public agency-join application — auth-adjacent, first-time user surface. |

Plus MFA challenge surfaces (see next section).

### MFA & security (subset of MS but all MP-priority for auth)

| File | Notes |
|---|---|
| [security/mfa/TwoFactorSettingsPage.tsx](web/src/pages/security/mfa/TwoFactorSettingsPage.tsx) | 2FA overview. |
| [security/mfa/PasskeysPage.tsx](web/src/pages/security/mfa/PasskeysPage.tsx) | Passkey enrolment — native biometrics. |
| [security/mfa/TotpEnrollPage.tsx](web/src/pages/security/mfa/TotpEnrollPage.tsx) | TOTP enrol. |
| [security/mfa/SignInChallengePage.tsx](web/src/pages/security/mfa/SignInChallengePage.tsx) | 2FA challenge at sign-in. |
| [security/mfa/BackupCodeSignInPage.tsx](web/src/pages/security/mfa/BackupCodeSignInPage.tsx) | Backup-code sign-in. |
| [security/mfa/BackupCodesViewerPage.tsx](web/src/pages/security/mfa/BackupCodesViewerPage.tsx) | View backup codes. |

(These are counted under MS in the 33-count above.)

---

## WEB — Web-only (45)

Desktop-first admin consoles and public/SEO surfaces. **Not bundled into the Capacitor build's route map** — the app 404s if navigated to. Users who need these open the web app.

### Admin back-office (37)

Approval queues, finance ops, package management, portal management, valuation moderation, scoring, areas, audit, whatsapp-listings admin.

| File | Notes |
|---|---|
| [admin/AccountRecoveryQueuePage.tsx](web/src/pages/admin/AccountRecoveryQueuePage.tsx) | Admin queue. |
| [admin/AccountRecoveryDetailPage.tsx](web/src/pages/admin/AccountRecoveryDetailPage.tsx) | Admin detail. |
| [admin/PortalModerationQueuePage.tsx](web/src/pages/admin/PortalModerationQueuePage.tsx) | Portal moderation. |
| [admin/PortalModerationDetailPage.tsx](web/src/pages/admin/PortalModerationDetailPage.tsx) | Portal moderation detail. |
| [admin/areas/AdminAreasPage.tsx](web/src/pages/admin/areas/AdminAreasPage.tsx) | Areas admin. |
| [admin/audit/AuditLogPage.tsx](web/src/pages/admin/audit/AuditLogPage.tsx) | Audit-log viewer (H5). |
| [admin/fin/*.tsx](web/src/pages/admin/fin/) | **21 files** — full finance console (approvals, contracts, credits, exceptions, facilities, holds, invoices, packages, pricing, reconciliation, subscriptions, tenants, usage, vendor costs, etc.). Desktop-only per finance-team UX. |
| [admin/packages/*.tsx](web/src/pages/admin/packages/) | Package catalogue admin (6 files). |
| [admin/platform-templates/*.tsx](web/src/pages/admin/platform-templates/) | Message-template admin (2). |
| [admin/portals/*.tsx](web/src/pages/admin/portals/) | Portal-registry admin (3). |
| [admin/pricing/PricingAdminPage.tsx](web/src/pages/admin/pricing/PricingAdminPage.tsx) | Pricing admin. |
| [admin/scoring/AdminScoringPage.tsx](web/src/pages/admin/scoring/AdminScoringPage.tsx) | Scoring admin. |
| [admin/valuation/*.tsx](web/src/pages/admin/valuation/) | Valuation moderation (2 pages + support). |
| [admin/whatsapp-listings/AdminWhatsAppListingsPage.tsx](web/src/pages/admin/whatsapp-listings/AdminWhatsAppListingsPage.tsx) | Admin WA listings queue. |

### Public / SEO / legal (8)

| File | Notes |
|---|---|
| [PublicAgencyPage.tsx](web/src/pages/PublicAgencyPage.tsx) | Public agency profile (SEO). |
| [PublicAgentPortfolioPage.tsx](web/src/pages/PublicAgentPortfolioPage.tsx) | Public agent portfolio (SEO). |
| [PublicWhiteLabelSitePage.tsx](web/src/pages/PublicWhiteLabelSitePage.tsx) | Agent white-label site. |
| [PublicWhiteLabelPropertyPage.tsx](web/src/pages/PublicWhiteLabelPropertyPage.tsx) | White-label listing page. |
| [public/RelationshipConsentPage.tsx](web/src/pages/public/RelationshipConsentPage.tsx) | Public consent capture. |
| [public/ScheduledDeletionConfirmationPage.tsx](web/src/pages/public/ScheduledDeletionConfirmationPage.tsx) | Deletion confirmation. |
| [PrivacyPage.tsx](web/src/pages/PrivacyPage.tsx) | Privacy policy. |
| [TermsPage.tsx](web/src/pages/TermsPage.tsx) | Terms. |

Privacy + Terms are duplicated as static bundle files inside the app to satisfy App Store / Play Store review — see App-Store checklist item below.

---

## SUB — Sub-components (60)

Not routes. These are `routes.tsx` maps, `shared.tsx` helpers, and page-internal components (`ChallengeLayout`, `PortalTrackerRow`, `ProDashboardParts`, activation `StepCard`, onboarding editors, report `FormBits`, etc.). They inherit their parent screen's classification — 48 inherit from mobile parents (bundled in Capacitor build), 12 inherit from admin/web parents.

Full list omitted for brevity — they're identified in the file tree by:
- `routes.tsx` (7 files: settings, security/mfa, agent/activation, agent/onboarding, agent/whatsapp-intake, admin/fin/shell — well, shell is different)
- `components/*.tsx` under activation, onboarding, portal-tracker
- `shared.tsx`, `packageShared.tsx`, `priceReportShared.tsx`
- Support widgets: `LivePollIndicator`, `OnboardingChecklistWidget`, `ActivationProgressBar`, `ActivationCelebrationBanner`, `ActivationChrome`, `OnboardingChrome`, `SkipWizardDialog`, `LockedInfoDialog`, `WhatsAppTourShell`, `WaMeQrCode`, `MfaSettingsChrome`, `ChallengeLayout`, `DisableTwoFactorModal`, `LoginFlow` (helper), `ProListingsTable`, `AddressInlineEditor`, `DescriptionInlineEditor`, `PhotoRailEditor`, `PriceInlineEditor`, `FormBits`, `ImpactPanel`, `OriginalReportAccordion`, `OutcomeShell`, `ReportIdentityCard`, `ReportedComparableCard`, `WeightingPanel`, `MarketImpactChip`, `ReporterPatternDot`, `badges`, `priceReportDialogs`, `PortalTrackerRow`, `TrackerEmptyState`, `TrackerFilterBar`, `TrackerKpiStrip`, `PackageVersionEditor` (finance sub), `SettingsUnavailablePage` (fallback).

---

## DEV — Dev tooling (2)

Never ship.

| File | Notes |
|---|---|
| [dev/ComponentInventory.tsx](web/src/pages/dev/ComponentInventory.tsx) | Design-system browser. |
| [inspector/InspectorPage.tsx](web/src/pages/inspector/InspectorPage.tsx) | Dev inspector. |

---

## Native-plugin requirements matrix

Screens that must call a Capacitor native plugin. These drive the initial `npm i @capacitor/…` list.

| Plugin | Screens |
|---|---|
| `@capacitor/camera` | ManualListingComposerPage, PhotoRailEditor, AgentProfilePage (avatar) |
| `@capacitor/push-notifications` | InboxPage (inquiry alerts), NotificationPreferencesPage, SignInChallengePage (2FA nudge) |
| `@capacitor/local-notifications` | TasksPage (task reminders), OpportunitiesPage (deal follow-ups) |
| `@capacitor/geolocation` | ManualListingComposerPage (address auto-fill), AreaProfilePage |
| `@capacitor/filesystem` | DataExportPage (save export ZIP locally), PublishReceiptPage (save receipt PDF) |
| `@capacitor/share` | ListingProfilePage, PublishReceiptPage, PublicWhiteLabelPropertyPage (share links), ActivationInviteTeamPage |
| `@capacitor/device` | risk-scoring signal collection (login), sessions page |
| `@capacitor/network` | Global — offline banner + queue |
| `@capacitor/preferences` | Auth token cache, feature flags |
| `@capacitor/status-bar` + `@capacitor/keyboard` | Global chrome |
| `@capacitor/haptics` | Confirmation actions across activation / onboarding |
| `@capacitor/biometric-auth` (community) or `capacitor-native-biometric` | LoginPage biometric unlock, PasskeysPage, ActivationPortalCredentialsPage |
| `@capacitor/browser` | External deep-links (WhatsApp connect, portal OAuth) |
| `@capacitor/app` | Deep-link intents (`wingcaster://…`) |

---

## Deep-link / URL scheme surface

Native shell registers `wingcaster://` scheme. Every route below must accept both `https://app.wingcaster.com/…` and `wingcaster://…` for cold-open from push / share / OAuth callback:

- `/inbox/thread/:id` — push notification lands here
- `/listings/:id` — share sheet + portal callback
- `/contacts/:id`, `/opportunities/:id`, `/tasks/:id`
- `/activation/*` — first-run cold-open
- `/auth/reset?token=…` — password reset from email
- `/auth/mfa/challenge` — MFA push nudge
- `/settings/passkeys/enroll` — biometric enrol from OS notification

---

## App-Store / Play-Store compliance checklist (drives Capacitor build config)

Independent of the code, the following must resolve BEFORE first TestFlight / internal-track upload:

- [ ] Bundled Privacy + Terms pages (App Store 5.1.1 — required at install-time, not just online)
- [ ] Account deletion path visible from Settings (`settings/DeleteAccountPage.tsx` — MS, already exists)
- [ ] `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSFaceIDUsageDescription` in `ios/App/App/Info.plist`
- [ ] Android `POST_NOTIFICATIONS`, `CAMERA`, `ACCESS_FINE_LOCATION`, `USE_BIOMETRIC` permissions in `AndroidManifest.xml`
- [ ] App Tracking Transparency prompt (or documented waiver — no tracking) for iOS
- [ ] Push-notification opt-in prompt is non-blocking (users can dismiss without abandoning onboarding)
- [ ] Sign-in-with-Apple offered alongside any other social sign-in (App Store 4.8) — currently no social sign-in, so waived
- [ ] Data-export ZIP saved via Files app, not silent background write (Files app integration)

---

## What this manifest does NOT cover (deferred to a later pass)

1. **Per-screen viewport audit** — some MS screens are known to break at 375px (finance tables, whitelabel builder). Not classifying them here as broken; a follow-up mobile-responsive-audit pass will run once Capacitor scaffold is up and a real device build exists.
2. **RTL parity** — Arabic layout parity is checked in the existing i18n test surface; not re-audited here.
3. **Performance ceilings** — screens that might need per-screen native modules (map-clustered listing search, video-scrub gallery) will be flagged during the perf pass after first build ships.
4. **Public Web Portal (Bazaar)** — separate consumer product per memory, not part of this Capacitor build. Bazaar gets its own manifest when we tackle that surface.

---

*Manifest generated 2026-09-17 from `find web/src/pages -type f -name "*.tsx" ! -name "*.test.tsx" | sort` on main @ `acb4a0fb`. 194 files classified. Regenerate when new pages land — script belongs in `scripts/regen-mobile-manifest.mjs` (to be written).*
