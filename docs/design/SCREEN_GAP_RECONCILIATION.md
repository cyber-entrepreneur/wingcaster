# Screen Gap Reconciliation — git-truth vs. stale matrix labels

_Generated 2026-09-17 against `feat/mobile-deep-links` working tree. This is a **git-truth reconciliation**: verdicts are derived from the actual codebase (route map in `web/src/App.tsx` + `**/routes.tsx`, page files under `web/src/pages/`, components under `web/src/components/`), **not** from the `Current state:` labels in the four SCREEN_MATRIX_*.md documents. Those labels were written 2026-09-03/04, predate ~8 screen-dev waves plus the enterprise-hardening tranche, and are treated as stale and overridden here._

**Verdict legend** — BUILT: a real page/route/component implements the screen. PARTIAL: parent surface exists but the screen as specified is incomplete (e.g. index page present, dedicated detail/create sub-screen only as an inline affordance or not routed). MISSING: no meaningful implementation.

**Method** — 340 IDs were extracted from the four matrices (ID, name, declared route, key components). Each was matched against: (1) direct ID tags in code (80 IDs carry their matrix ID in source), (2) declared route vs. the wired route table, (3) key-component filenames vs. actual page/component files. 154 IDs matched a strong signal (ID-tag or wired route) → BUILT. The remaining 186 were manually inspected via content greps of the candidate hub pages; verdicts and evidence below reflect that inspection.

## Summary counts

| Persona | BUILT | PARTIAL | MISSING | Total |
|---|---:|---:|---:|---:|
| AGT (Agent) | 76 | 11 | 11 | 98 |
| AGN (Agency) | 33 | 15 | 19 | 67 |
| PA (Platform Admin) | 60 | 34 | 26 | 120 |
| SHR (Shared) | 47 | 4 | 4 | 55 |
| **TOTAL** | **216** | **64** | **60** | **340** |

## Agent matrix (SCREEN_MATRIX_AGENT.md)

| ID | Name | Verdict | Evidence |
|---|---|---|---|
| AGT-ONB-001 | Welcome (post-signup) | BUILT | code-tagged AGT-ONB-001; route /onboarding |
| AGT-ONB-002 | WhatsApp intake tour (aha moment) | BUILT | code-tagged AGT-ONB-002; route /onboarding/whatsapp |
| AGT-ONB-003 | First-listing review (post-intake) | BUILT | code-tagged AGT-ONB-003; route /onboarding/first-listing/:x |
| AGT-ONB-004 | First-listing published (celebration) | BUILT | code-tagged AGT-ONB-004; route /onboarding/first-listing/published |
| AGT-ONB-005 | Progress checklist (persistent nudge) | BUILT | code-tagged AGT-ONB-005 |
| AGT-DSH-001 | Agent dashboard (mobile, Guided) | BUILT | code-tagged AGT-DSH-001; route /dashboard |
| AGT-DSH-002 | Agent dashboard (Pro) (P0 — REWRITTEN 2026-09-04 per D9 focused-domain) | BUILT | code-tagged AGT-DSH-002; route /dashboard |
| AGT-LST-001 | Listings index (card view, Guided, mobile) | BUILT | code-tagged AGT-LST-001; route /listings |
| AGT-LST-002 | Listings index (table view, Pro) (P0 — REWRITTEN 2026-09-04 per D9 focused-domain) | BUILT | code-tagged AGT-LST-002; route /listings |
| AGT-LST-003 | Listing detail (Guided, mobile) | BUILT | code-tagged AGT-LST-003; route /listings/:x |
| AGT-LST-004 | Listing create (Guided wizard, mobile) | BUILT | code-tagged AGT-LST-004; route /listings/new |
| AGT-LST-005 | original — Listing create/edit (Pro single-form) | BUILT | route /listings/new |
| AGT-LST-005 | original — Listing create/edit (Pro single-form) | BUILT | route /listings/new |
| AGT-LST-006 | Listing analytics tab | BUILT | route /listings/:x |
| AGT-LST-007 | Listing share sheet | BUILT | ListingProfilePage.tsx (share) + social-cards/SocialCardStudio.tsx |
| AGT-LST-008 | Listing archive (soft delete) | BUILT | ListingProfilePage.tsx (archive) |
| AGT-LST-009 | Listing delete (destructive) | BUILT | ListingProfilePage.tsx (delete) + listings/pro/TypedConfirmDialog.tsx |
| AGT-LST-010 | Add / edit offer on a listing | MISSING | — |
| AGT-LST-011 | Publications tab | BUILT | route /listings/:x; components/Timeline.tsx |
| AGT-LST-013 | Property disposition case (CORRECTED — added 2026-09-04) | MISSING | — |
| AGT-LST-014 | Canonical property view (multi-agency same property) | MISSING | — |
| AGT-LST-012 | Comments tab | BUILT | route /listings/:x |
| AGT-PUB-001 | Publish this listing (Guided — one big button) | BUILT | components/dashboard/PromoteDistributeModal.tsx |
| AGT-PUB-002 | Publish per-channel (Pro or Guided-expanded) | BUILT | PromoteDistributeModal.tsx (channel picker) |
| AGT-PUB-003 | Publish outcome / receipt (P0 — REWRITTEN 2026-09-04 per D9) | BUILT | code-tagged AGT-PUB-003 |
| AGT-PUB-004 | Retry / republish | BUILT | agent/PublishOutcomePage.tsx (retry) |
| AGT-PUB-005 | Portal submission form (real-estate portals) | BUILT | code-tagged AGT-PUB-005 |
| AGT-PUB-006 | Portal submission status tracker (WF-03 Recipient) (P0 — REWRITTEN 2026-09-04 per D9) | BUILT | code-tagged AGT-PUB-006 |
| AGT-PUB-007 | Schedule publish (later) | MISSING | — |
| AGT-WLA-001 | Drafts inbox | BUILT | route /agent/whatsapp-listings |
| AGT-WLA-002 | Draft review (Approve / Edit / Discard) | BUILT | code-tagged AGT-WLA-002 |
| AGT-WLA-003 | Draft edit-before-approve | BUILT | agent/whatsapp-listings/AgentWhatsAppListingsPage.tsx (edit) |
| AGT-WLA-004 | WhatsApp intake settings | MISSING | — |
| AGT-WLA-005 | WhatsApp intake analytics | PARTIAL | components/whatsapp-listings/UsageChart.tsx |
| AGT-LAI-001 | Generate description | PARTIAL | ListingProfilePage.tsx (AI affordance) |
| AGT-LAI-002 | Refine / preview generated content (P0 — REWRITTEN 2026-09-04 per D9) | PARTIAL | ListingProfilePage.tsx (Regenerate/AI) |
| AGT-NVL-001 | Neighborhood valuator (per listing) | BUILT | route /listings/:x/neighborhood-valuator |
| AGT-CTC-001 | Contacts list | BUILT | route /contacts |
| AGT-CTC-002 | Contact detail (360) | BUILT | route /contacts/:x; components/Timeline.tsx |
| AGT-CTC-003 | Contact create / edit | BUILT | ContactsPage.tsx (create/edit) |
| AGT-CTC-004 | Merge contacts | MISSING | — |
| AGT-CTC-005 | Contact export | PARTIAL | ContactDetailPage.tsx (export action) |
| AGT-CTC-007 | Contact relationships editor (CORRECTED — added 2026-09-04) | BUILT | code-tagged AGT-CTC-007 |
| AGT-CTC-006 | Lead score regenerate | BUILT | components/contact-360/Contact360Panel.tsx (regenerate) |
| AGT-OPP-001 | Opportunities pipeline (Kanban, Pro) | BUILT | route /opportunities |
| AGT-OPP-001b | Opportunities list (Guided, mobile) | BUILT | route /opportunities |
| AGT-OPP-002 | Opportunity detail | PARTIAL | OpportunitiesPage.tsx (no :id detail route) |
| AGT-OPP-003 | Add opportunity | BUILT | OpportunitiesPage.tsx (add) |
| AGT-TSK-001 | Tasks list | BUILT | route /tasks |
| AGT-TSK-002 | Task detail / edit | PARTIAL | TasksPage.tsx (inline edit) |
| AGT-TSK-003 | Reminder policies | MISSING | — |
| AGT-CMP-001 | Campaigns list | BUILT | route /campaigns |
| AGT-CMP-002 | Campaign builder wizard (Guided) | BUILT | route /campaigns/new |
| AGT-CMP-003 | Campaign builder single-page (Pro) | BUILT | route /campaigns/new |
| AGT-CMP-004 | Campaign detail + performance | PARTIAL | CampaignsPage.tsx (no :id route) |
| AGT-CMP-005 | Saved searches (audience source) | MISSING | — |
| AGT-TPL-001 | Templates list (agent-scope) | BUILT | route /message-templates |
| AGT-TPL-002 | Template editor | BUILT | MessageTemplatesPage.tsx (editor) |
| AGT-INB-001 | Inbox list | BUILT | code-tagged AGT-INB-001; route /dashboard/inbox |
| AGT-INB-002 | Conversation detail | BUILT | code-tagged AGT-INB-002; route /dashboard/inbox/:x |
| AGT-INB-003 | Compose new conversation | BUILT | components/inbox/ComposeNewDialog.tsx |
| AGT-INB-005 | Channel + source dual-badge treatment (CORRECTED — added 2026-09-04) | BUILT | code-tagged AGT-INB-005 |
| AGT-INB-004 | Assign conversation | PARTIAL | components/inbox/InboxBulkActionBar.tsx (assign) |
| AGT-HTX-001 | Closed transactions list | BUILT | HistoricalTransactionsPage.tsx |
| AGT-HTX-002 | Add closed transaction | BUILT | components/closed-transactions/RecordClosureModal.tsx |
| AGT-HTX-003 | Import closed transactions | MISSING | — |
| AGT-APR-001 | Pricing portfolio | BUILT | route /agent/pricing |
| AGT-APR-002 | Adjust price | BUILT | AgentPricingPage.tsx (adjust price) |
| AGT-APR-003 | Comparable detail + report bad | BUILT | agent/reports/BadComparableReportPage.tsx |
| AGT-APR-004 | Report bad comparable form (WF-05 Initiator) | BUILT | code-tagged AGT-APR-004 |
| AGT-APR-005 | Submit agent price report (WF-06 Initiator) | BUILT | code-tagged AGT-APR-005; route /agent/pricing/reports/new |
| AGT-APR-006 | My submitted reports | PARTIAL | AgentPricingPage.tsx (submitted reports) |
| AGT-APP-001 | Public profile editor | BUILT | AgentProfilePage.tsx (avatar/bio editor) |
| AGT-CMD-001 | Command center | BUILT | route /command-center |
| AGT-SUB-001 | My subscription | BUILT | route /my-subscription |
| AGT-SUB-002 | Change plan (solo agent) | BUILT | route /plans |
| AGT-SUB-003 | Credits & top-up | BUILT | route /my-credits; components/FeatureQuotaBar.tsx |
| AGT-SUB-004 | Cancel subscription (solo) | MISSING | — |
| AGT-SUB-005 | Plan change outcome | PARTIAL | MySubscriptionPage.tsx (change plan) |
| AGT-SUB-006 | Invoices (agent scope) | BUILT | route /my-invoices |
| AGT-SUB-007 | Credit notes (agent scope) | BUILT | route /my-credit-notes |
| AGT-NPF-001 | Notifications inbox | BUILT | route /notifications |
| AGT-NPF-002 | Notification preferences | BUILT | NotificationPreferencesPage.tsx |
| AGT-CHN-001 | Channels list | BUILT | SocialChannelsPage.tsx |
| AGT-CHN-002 | Channel connect (OAuth wrapper) | BUILT | SocialChannelsPage.tsx (OAuth connect) |
| AGT-CHN-003 | Personal accounts ("my-connections") | PARTIAL | SocialChannelsPage.tsx (personal accounts) |
| AGT-ROU-001 | Own routing preferences | BUILT | RoutingSettingsPage.tsx |
| AGT-INT-001 | Integrations (agent-scope) | BUILT | route /integrations |
| AGT-WLB-001 | My site (read-mostly) | BUILT | code-tagged AGT-WLB-001; route /white-label |
| AGT-REV-001 | Reviews received | MISSING | — |
| AGT-REC-001 | Portal submission outcome (WF-03 Recipient) (P0 — CONSOLIDATED 2026-09-04 per D9) | BUILT | agent/PortalTrackerPage.tsx (consolidated per D9) |
| AGT-REC-002 | Comparable-report outcome (WF-05 Recipient) (P0 — REWRITTEN 2026-09-04 per D9) | BUILT | code-tagged AGT-REC-002; route /agent/comparable-reports/:x |
| AGT-REC-003 | Agent price report outcome (WF-06 Recipient) (P0 — REWRITTEN 2026-09-04 per D9) | BUILT | code-tagged AGT-REC-003; route /agent/pricing/reports/:x/outcome |
| AGT-REC-004 | Agency application outcome (WF-02 Recipient) (P0 — REWRITTEN 2026-09-04 per D9) | BUILT | code-tagged AGT-REC-004; route /agency/applications/:x/status |
| AGT-REC-005 | Account recovery outcome (WF-04 Recipient) | BUILT | code-tagged AGT-REC-005 |
| AGT-REC-006 | Ownership transfer offered (WF-31 Recipient — target agent) | BUILT | code-tagged AGT-REC-006 |
| AGT-SET-001 | Settings home (agent) | BUILT | route /settings |
| AGT-SET-002 | Mode toggle (P0 — REWRITTEN 2026-09-04 per D9) | BUILT | code-tagged AGT-SET-002 |

## Agency matrix (SCREEN_MATRIX_AGENCY.md)

| ID | Name | Verdict | Evidence |
|---|---|---|---|
| AGN-DSH-001 | Agency dashboard | BUILT | code-tagged AGN-DSH-001; route /agency |
| AGN-DSH-002 | Onboarding checklist (first-run) | BUILT | code-tagged AGN-DSH-002 |
| AGN-MEM-001 | Members list | BUILT | code-tagged AGN-MEM-001 |
| AGN-MEM-002 | Applications queue (WF-02 Approval queue) | BUILT | code-tagged AGN-MEM-002 |
| AGN-MEM-002b | Application detail (WF-02 Approval detail) | BUILT | code-tagged AGN-MEM-002b |
| AGN-MEM-003 | Invite member | BUILT | AgencyManagementPage.tsx (invite) |
| AGN-MEM-004 | Pending invites list | PARTIAL | AgencyManagementPage.tsx (invites; no pending tab) |
| AGN-MEM-005 | Public join / accept invite (agent side) | BUILT | code-tagged AGN-MEM-005; route /agencies/:x/apply |
| AGN-MEM-006 | Member detail | BUILT | AgencyManagementPage.tsx (member detail) |
| AGN-MEM-007 | Change member role | BUILT | AgencyManagementPage.tsx (change role) |
| AGN-MEM-008 | Pause member (CORRECTED 2026-09-04 per D9 — pause_reason as first-class field) | MISSING | — |
| AGN-MEM-009 | End membership (offboarding workflow) | MISSING | — |
| AGN-ROL-001 | Roles overview | BUILT | code-tagged AGN-ROL-001; route /agency/settings/roles |
| AGN-ROL-002 | Role permissions detail | BUILT | code-tagged AGN-ROL-002; route /agency/settings/roles/:x |
| AGN-PRC-001 | Agency pricing portfolio | BUILT | route /agency/pricing |
| AGN-PRC-002 | Bulk price adjustment (CORRECTED 2026-09-04 — added safety rails) | PARTIAL | AgencyPricingPage.tsx (select; no bulk flow) |
| AGN-PRC-003 | Comparables browser | PARTIAL | AgencyPricingPage.tsx (comparables) |
| AGN-PRC-004 | Report bad comparable (WF-05 Initiator) | BUILT | route /reports/comparables/new (WF-05) |
| AGN-CRD-001 | Agency wallet overview | BUILT | MyCreditsPage.tsx + components/credits/CreditBalance.tsx |
| AGN-CRD-002 | Top-up credits (Paddle checkout path) | BUILT | components/credits/TopUpDialog.tsx |
| AGN-CRD-003 | Top-up outcome | PARTIAL | components/credits/TopUpDialog.tsx (outcome) |
| AGN-CRD-004 | Allocation rules | MISSING | — |
| AGN-CRD-005 | Allocate credits to agent(s) (CORRECTED 2026-09-04 — clawback specifics) | MISSING | — |
| AGN-CRD-006 | Feature quota view (agency aggregate) | BUILT | components/credits/FeatureQuotaBar.tsx |
| AGN-SUB-001 | Current subscription | BUILT | MySubscriptionPage.tsx |
| AGN-SUB-002 | Change plan (preview + confirm) | BUILT | PlansPage.tsx |
| AGN-SUB-003 | Change plan outcome | PARTIAL | PlansPage.tsx (outcome) |
| AGN-SUB-004 | Cancel subscription | MISSING | — |
| AGN-SUB-005 | Manage payment method | MISSING | — |
| AGN-INV-001 | Invoices list (tenant view) | BUILT | route /my-invoices |
| AGN-INV-002 | Invoice detail | PARTIAL | MyInvoicesPage.tsx (no :id detail route) |
| AGN-INV-003 | Credit notes list (tenant view) | BUILT | route /my-credit-notes |
| AGN-WLB-001 | Site overview + preview (REWRITTEN 2026-09-04 per D9) | BUILT | WhiteLabelBuilderPage.tsx |
| AGN-WLB-002 | Brand + template chooser (REWRITTEN 2026-09-04 per D9) | BUILT | WhiteLabelBuilderPage.tsx (brand/template) |
| AGN-WLB-003 | Copy fields editor (REWRITTEN 2026-09-04 per D9) | PARTIAL | WhiteLabelBuilderPage.tsx (no copy-editor section) |
| AGN-WLB-004 | Custom domain (UNCHANGED FROM ORIGINAL — REVIEWED 2026-09-04 per D9) | BUILT | WhiteLabelBuilderPage.tsx (custom domain) |
| AGN-WLB-005 | Analytics (REWRITTEN 2026-09-04 per D9 — merged with former AGN-WLB-006) | MISSING | — |
| AGN-WID-001 | Widgets list | BUILT | route /widgets |
| AGN-WID-002 | Widget builder | BUILT | WidgetBuilderPage.tsx |
| AGN-ROU-001 | Routing rules index | BUILT | RoutingSettingsPage.tsx |
| AGN-ROU-002 | Rule editor | PARTIAL | RoutingSettingsPage.tsx (rule) |
| AGN-ROU-003 | Test rule | BUILT | RoutingSettingsPage.tsx (test rule) |
| AGN-SYN-001 | Sync connections list | MISSING | — |
| AGN-SYN-002 | Connection detail + logs | MISSING | — |
| AGN-SYN-003 | Import listings from external source (WLB-based one-off) | MISSING | — |
| AGN-SYN-004 | Import job progress | MISSING | — |
| AGN-TPL-001 | Agency templates list | PARTIAL | MessageTemplatesPage.tsx (agent-scope only) |
| AGN-TPL-002 | Template editor (agency-scope) | PARTIAL | admin/platform-templates/TemplateEditPage.tsx (not agency-scoped) |
| AGN-WLA-001 | WhatsApp Listings entitlements | BUILT | route /agency/whatsapp-listings |
| AGN-WLA-002 | Update entitlement per agent | BUILT | components/whatsapp-listings/EntitlementForm.tsx |
| AGN-REP-001 | Reports home | MISSING | — |
| AGN-REP-002 | Listings performance report | MISSING | — |
| AGN-REP-003 | Lead conversion funnel | PARTIAL | CrmAnalyticsPage.tsx (funnel) |
| AGN-REP-004 | Agent leaderboard | MISSING | — |
| AGN-REP-005 | Credit spend report | MISSING | — |
| AGN-REP-006 | Campaign performance | MISSING | — |
| AGN-REP-007 | Revenue attribution | PARTIAL | CrmAnalyticsPage.tsx (revenue) |
| AGN-REP-008 | Custom report builder | MISSING | — |
| AGN-SET-001 | Settings home | PARTIAL | agency/settings/* (no home index) |
| AGN-SET-002 | Agency identity & branding | PARTIAL | WhiteLabelBuilderPage.tsx (branding) |
| AGN-SET-003 | Contact & business info | MISSING | — |
| AGN-SET-004 | Integrations | BUILT | route /integrations |
| AGN-SET-005 | Transfer ownership | BUILT | code-tagged AGN-SET-005 |
| AGN-SET-005b | Accept ownership transfer | BUILT | code-tagged AGN-SET-005b |
| AGN-SET-006 | Delete agency | MISSING | — |
| AGN-AUD-001 | Agency audit log (CORRECTED 2026-09-04 per D9 — backend endpoint required) | BUILT | route /agency/settings/audit + admin/audit/AuditLogPage.tsx |
| AGN-PUB-001 | Public profile settings | PARTIAL | PublicAgencyPage.tsx (view, not settings) |

## Platform Admin matrix (SCREEN_MATRIX_PA.md)

| ID | Name | Verdict | Evidence |
|---|---|---|---|
| PA-NAV-001 | Environment switcher + PA nav shell | BUILT | code-tagged PA-NAV-001 |
| PA-FIN-001 | Overview / dashboard | BUILT | route /admin/fin |
| PA-FIN-002 | Tenants list | BUILT | route /admin/fin/tenants |
| PA-FIN-003 | Tenant detail | PARTIAL | admin/fin/TenantsPage.tsx (no :id detail route) |
| PA-FIN-004 | Usage explorer | BUILT | route /admin/fin/usage |
| PA-FIN-005 | Configuration (platform settings) | BUILT | route /admin/fin/configuration |
| PA-CRD-001 | Wallets index | BUILT | route /admin/fin/credits |
| PA-CRD-002 | Wallet detail | PARTIAL | admin/fin/CreditsPage.tsx (wallet) |
| PA-CRD-003 | Credit lots (prepaid stock) index | PARTIAL | admin/fin/CreditsPage.tsx (lots) |
| PA-CRD-004 | Holds (current reservations) | BUILT | admin/fin/HoldsPage.tsx |
| PA-CRD-005 | Credit grant request form (Initiator) (P0 — ELEVATED 2026-09-04 per D9) | BUILT | code-tagged PA-CRD-005 |
| PA-CRD-006 | Grant outcome / receipt (P0 — REWRITTEN 2026-09-04 per D9) | PARTIAL | components/credits/* (grant outcome) |
| PA-CRD-007 | GDPR erasure for wallet history | MISSING | — |
| PA-CRD-008 | Janitor status widget | MISSING | — |
| PA-CRD-009 | Fin mirror worker status | MISSING | — |
| PA-FAC-001 | Facilities index | BUILT | route /admin/fin/facilities |
| PA-FAC-002 | Facility detail | PARTIAL | admin/fin/FacilitiesPage.tsx |
| PA-FAC-003 | Create facility | PARTIAL | admin/fin/FacilitiesPage.tsx (create) |
| PA-FAC-004 | Adjust facility limit | PARTIAL | admin/fin/FacilitiesPage.tsx (adjust limit) |
| PA-CON-001 | Contracts index | BUILT | route /admin/fin/contracts |
| PA-CON-002 | Contract detail | PARTIAL | admin/fin/ContractsPage.tsx |
| PA-CON-003 | Create / edit contract version | PARTIAL | admin/fin/ContractsPage.tsx (version) |
| PA-PRC-001 | Prices index | BUILT | route /admin/fin/pricing |
| PA-PRC-002 | Price detail + versions | PARTIAL | admin/fin/PricingPage.tsx |
| PA-PRC-003 | Create price version | PARTIAL | admin/fin/PricingPage.tsx (create version) |
| PA-PKG-001 | Packages index | BUILT | code-tagged PA-PKG-001; route /admin/fin/packages |
| PA-PKG-002 | Package detail (versions list) | BUILT | code-tagged PA-PKG-002; route /admin/fin/packages/:x |
| PA-PKG-003 | Create package | BUILT | code-tagged PA-PKG-003 |
| PA-PKG-004 | Package version editor (quotas + flags) | BUILT | code-tagged PA-PKG-004; route /admin/fin/packages/:x/versions/:x |
| PA-PKG-005 | Package approval (Approval detail / second-approver review) | BUILT | admin/packages/PackageApprovalDetailPage.tsx |
| PA-PKG-006 | Package deprecate | PARTIAL | admin/fin/PackagesPage.tsx (deprecate) |
| PA-PKG-007 | Feature registry admin | MISSING | — |
| PA-SUB-001 | Subscriptions index | BUILT | route /admin/fin/subscriptions |
| PA-SUB-002 | Subscription detail | BUILT | route /admin/fin/subscriptions/:x |
| PA-SUB-003 | Preview change plan | PARTIAL | admin/fin/SubscriptionDetailPage.tsx (preview) |
| PA-SUB-004 | Create subscription | PARTIAL | admin/fin/SubscriptionsPage.tsx (create) |
| PA-SUB-005 | Change plan outcome | PARTIAL | admin/fin/SubscriptionDetailPage.tsx (outcome) |
| PA-SUB-006 | Cancel subscription | PARTIAL | admin/fin/SubscriptionDetailPage.tsx (cancel) |
| PA-INV-001 | Invoices index | BUILT | route /admin/fin/invoices |
| PA-INV-002 | Invoice detail | PARTIAL | admin/fin/InvoicesPage.tsx |
| PA-INV-003 | Create credit note | PARTIAL | admin/fin/InvoicesPage.tsx (credit note) |
| PA-INV-004 | Create debit note | MISSING | — |
| PA-INV-005 | Manual invoice create | MISSING | — |
| PA-PAY-001 | Payments index | MISSING | — |
| PA-PAY-002 | Payment detail + apply | MISSING | — |
| PA-PAY-003 | Record manual payment | MISSING | — |
| PA-ACC-001 | Periods index | MISSING | — |
| PA-ACC-002 | Period detail | MISSING | — |
| PA-ACC-003 | Billing period close | MISSING | — |
| PA-VEN-001 | Vendors index | BUILT | admin/fin/VendorCostsPage.tsx |
| PA-VEN-002 | Vendor detail | PARTIAL | admin/fin/VendorCostsPage.tsx (detail) |
| PA-VEN-003 | Add / edit vendor rate | PARTIAL | admin/fin/VendorCostsPage.tsx (rate) |
| PA-VEN-004 | Vendor statement detail | PARTIAL | admin/fin/VendorCostsPage.tsx (statement) |
| PA-VEN-005 | Vendor statement reconcile action | PARTIAL | admin/fin/VendorCostsPage.tsx (reconcile) |
| PA-REC-001 | Reconciliation runs index | BUILT | route /admin/fin/reconciliation |
| PA-REC-002 | Reconciliation run detail | PARTIAL | admin/fin/ReconciliationPage.tsx |
| PA-REC-003 | Run reconciliation manually | PARTIAL | admin/fin/ReconciliationPage.tsx (run) |
| PA-REC-004 | Resolve drift item | PARTIAL | admin/fin/ReconciliationPage.tsx (resolve drift) |
| PA-EXC-001 | Exceptions index | BUILT | route /admin/fin/exceptions |
| PA-EXC-002 | Exception detail | PARTIAL | admin/fin/ExceptionsPage.tsx |
| PA-APR-001 | Approvals queue | BUILT | code-tagged PA-APR-001; route /admin/fin/approvals |
| PA-APR-002 | Approval detail (generic wrapper) | BUILT | admin/fin/ApprovalsPage.tsx + components/approval/StateBlocks.tsx |
| PA-APR-003 | Approval action confirmation (P0 — REWRITTEN 2026-09-04 per D9) | BUILT | code-tagged PA-APR-003 |
| PA-APR-004 | Approval audit trail per item | PARTIAL | components/approval/* (audit trail) |
| PA-APR-005 | Escalate approval (P0 — REWRITTEN 2026-09-04 per D9) | BUILT | code-tagged PA-APR-005 |
| PA-APR-006 | Recall submission (P0 — REWRITTEN 2026-09-04 per D9) | BUILT | code-tagged PA-APR-006 |
| PA-DUN-001 | Dunning cases index | MISSING | — |
| PA-DUN-002 | Dunning case detail | MISSING | — |
| PA-DUN-003 | Advance stage | MISSING | — |
| PA-DUN-004 | Cure case (mark paid) | MISSING | — |
| PA-DUN-005 | Write off (destructive + approval) | MISSING | — |
| PA-AUD-001 | Audit log | BUILT | code-tagged PA-AUD-001; route /admin/fin/audit |
| PA-AUD-002 | Retention policy | PARTIAL | admin/audit/AuditLogPage.tsx (retention) |
| PA-CFG-001 | Feature flags | BUILT | route /admin/fin/configuration |
| PA-CFG-002 | Worker cadence & health | BUILT | route /admin/fin/configuration |
| PA-CFG-003 | API keys & secrets rotation | BUILT | route /admin/fin/configuration |
| PA-CFG-004 | Regional & currency configuration | BUILT | route /admin/fin/configuration |
| PA-CFG-006 | Territories & disclosure fields config (CORRECTED — added 2026-09-04) | BUILT | route /admin/fin/configuration |
| PA-CFG-007 | Real Estate Bazaar integration config (CORRECTED — added 2026-09-04) | BUILT | route /admin/fin/configuration |
| PA-CFG-005 | Paddle config (SIMPLIFIED 2026-09-04 per D5 → Paddle-only single-provider surface) | BUILT | route /admin/fin/configuration |
| PA-TPL-001 | Templates index | BUILT | route /admin/message-templates |
| PA-TPL-002 | Template editor | BUILT | route /admin/message-templates/:x |
| PA-TPL-003 | Send test dialog | BUILT | components/platform-templates/SendTestDialog.tsx |
| PA-TPL-004 | Template versions history | BUILT | components/platform-templates/VersionsTab.tsx |
| PA-ARE-001 | Areas index | BUILT | route /admin/areas |
| PA-ARE-002 | Area detail + editor | PARTIAL | admin/areas/AdminAreasPage.tsx (no :id detail route) |
| PA-ARE-003 | Signals review | MISSING | — |
| PA-SCR-001 | Scoring dimensions | BUILT | route /admin/scoring |
| PA-SCR-002 | AI configs | PARTIAL | admin/scoring/AdminScoringPage.tsx (AI configs) |
| PA-SCR-003 | Calculate / recalculate scores | PARTIAL | admin/scoring/AdminScoringPage.tsx (recalc) |
| PA-SCR-004 | Manual score override | MISSING | — |
| PA-WLA-001 | WhatsApp Listings health | BUILT | route /admin/whatsapp-listings |
| PA-WLA-002 | Entitlements admin | BUILT | components/whatsapp-listings/EntitlementForm.tsx |
| PA-WLA-003 | Grant credits (WhatsApp module) | PARTIAL | admin/whatsapp-listings/AdminWhatsAppListingsPage.tsx (grant) |
| PA-WLA-004 | WhatsApp audit log | MISSING | — |
| PA-PVA-001 | Pricing config home | BUILT | route /admin/pricing |
| PA-PVA-002 | Sources CRUD | BUILT | admin/pricing/PricingAdminPage.tsx (sources) |
| PA-PVA-003 | Currency rates | BUILT | admin/pricing/PricingAdminPage.tsx (currency rates) |
| PA-PVA-004 | Normalization rules | BUILT | admin/pricing/PricingAdminPage.tsx (normalization) |
| PA-PVA-005 | CSV import | BUILT | admin/pricing/PricingAdminPage.tsx (CSV import) |
| PA-PVA-006 | Recalculation jobs | BUILT | admin/pricing/PricingAdminPage.tsx (recalc jobs) |
| PA-PVA-007 | Trend runs | BUILT | admin/pricing/PricingAdminPage.tsx (trend runs) |
| PA-PVA-008 | Comparable reports review | BUILT | code-tagged PA-PVA-008 |
| PA-PVA-008b | Comparable report detail | BUILT | code-tagged PA-PVA-008b |
| PA-PVA-009 | Agent price reports review | BUILT | code-tagged PA-PVA-009 |
| PA-PVA-011 | Canonical property resolution admin (CORRECTED — added 2026-09-04) | MISSING | — |
| PA-PVA-009b | Agent price report detail | BUILT | code-tagged PA-PVA-009b |
| PA-MOD-001 | Portal submissions queue (WF-03 Approval queue) (P0 — ANNOTATED 2026-09-04 per D9) | BUILT | code-tagged PA-MOD-001 |
| PA-MOD-002 | Portal submission detail (WF-03 Approval detail) | BUILT | code-tagged PA-MOD-002 |
| PA-MOD-003 | Submission audit trail | PARTIAL | admin/PortalModerationDetailPage.tsx (audit trail) |
| PA-ACR-001 | Recovery queue (WF-04 Approval queue) | BUILT | code-tagged PA-ACR-001 |
| PA-ACR-002 | Recovery detail (WF-04 Approval detail) | BUILT | code-tagged PA-ACR-002 |
| PA-NDL-001 | Dead-letter queue | MISSING | — |
| PA-CLS-001 | Classifier config | MISSING | — |
| PA-USR-001 | Users search | MISSING | — |
| PA-USR-002 | User detail (impersonate + promote) | MISSING | — |
| PA-GOO-001 | Google usage dashboard | MISSING | — |
| PA-CMD-001 | Command Center | BUILT | route /command-center |
| PA-INS-001 | Inspector queue | BUILT | route /inspector |
| PA-INS-002 | Inspection submit form | PARTIAL | inspector/InspectorPage.tsx (no submit route) |

## Shared matrix (SCREEN_MATRIX_SHARED.md)

| ID | Name | Verdict | Evidence |
|---|---|---|---|
| SHR-AUT-001 | Login (CORRECTED 2026-09-04 per user feedback — 6 identity paths) | BUILT | code-tagged SHR-AUT-001; route /login |
| SHR-AUT-002 | Sign in with OTP (request code) | BUILT | code-tagged SHR-AUT-002; route /login |
| SHR-AUT-002b | Verify OTP | BUILT | route /login |
| SHR-AUT-003 | Forgot password (request) | BUILT | route /forgot-password |
| SHR-AUT-003b | Forgot password sent (confirmation) | BUILT | route /forgot-password |
| SHR-AUT-004 | Reset password (from email link) | BUILT | route /reset-password |
| SHR-AUT-005 | Account recovery (request) | BUILT | code-tagged SHR-AUT-005; route /account-recovery |
| SHR-AUT-005b | Account recovery submitted | BUILT | route /account-recovery |
| SHR-AUT-005c | Account recovery complete (from admin-issued link) | BUILT | route /account-recovery/complete |
| SHR-AUT-006 | Register (agent OR agency free-tier signup) (CORRECTED 2026-09-04 per D9 — register-as-agency path) | BUILT | code-tagged SHR-AUT-006; route /register |
| SHR-MFA-001 | 2FA settings | BUILT | code-tagged SHR-MFA-001 |
| SHR-MFA-002 | TOTP setup (show QR) | BUILT | code-tagged SHR-MFA-002 |
| SHR-MFA-003 | TOTP setup (verify + save) | BUILT | code-tagged SHR-MFA-003 |
| SHR-MFA-004 | 2FA challenge at sign-in | BUILT | code-tagged SHR-MFA-004; route /login |
| SHR-MFA-004b | Sign in with backup code | BUILT | code-tagged SHR-MFA-004b; route /login |
| SHR-MFA-005 | Backup codes (view & regenerate) | BUILT | code-tagged SHR-MFA-005 |
| SHR-MFA-006 | Disable 2FA (dangerous) | BUILT | code-tagged SHR-MFA-006 |
| SHR-MFA-007 | Step-up authentication prompt | BUILT | code-tagged SHR-MFA-007 |
| SHR-NAV-001 | Post-auth landing router | BUILT | code-tagged SHR-NAV-001 |
| SHR-NAV-002 | Top navigation bar (desktop) / hamburger + drawer (mobile) | BUILT | code-tagged SHR-NAV-002 |
| SHR-NAV-003 | Bottom tab bar (Agent mobile only) | BUILT | code-tagged SHR-NAV-003 |
| SHR-NAV-004 | Notification center | BUILT | components/nav/NotificationsPopover.tsx |
| SHR-NAV-004b | Notification preferences | BUILT | NotificationPreferencesPage.tsx |
| SHR-NAV-005 | Command palette (⌘K) | BUILT | components/nav/GlobalSearch.tsx |
| SHR-NAV-006 | Language selector | BUILT | code-tagged SHR-NAV-006 |
| SHR-NAV-008 | Tenant switcher (CORRECTED 2026-09-04 — was missing from first pass) | BUILT | code-tagged SHR-NAV-008 |
| SHR-NAV-007 | Theme (dark/light) toggle | BUILT | components/ui/color-mode-toggle.tsx |
| SHR-ERR-001 | 404 Not Found | BUILT | route * |
| SHR-ERR-002 | 403 / Permission denied | PARTIAL | components/ErrorFallback.tsx (no dedicated 403 screen) |
| SHR-ERR-003 | 500 / Something went wrong | BUILT | components/ErrorBoundary.tsx + ErrorFallback.tsx |
| SHR-ERR-004 | Offline (Capacitor) | BUILT | components/inbox/InboxOfflineBanner.tsx + onboarding/OfflineBanner.tsx |
| SHR-ERR-005 | Maintenance / degraded | PARTIAL | components/nav/EnvWarningStrip.tsx |
| SHR-ERR-006 | Rate-limited | BUILT | components/mfa/RateLimitBanner.tsx |
| SHR-LEG-001 | Terms of Service | BUILT | route /terms |
| SHR-LEG-002 | Privacy Policy | BUILT | route /privacy |
| SHR-LEG-003 | Refund Policy | MISSING | — |
| SHR-LEG-004 | Cookie / Data Processing Notice | MISSING | — |
| SHR-PUB-001 | Public listing view | BUILT | route /listings/:x |
| SHR-PUB-002 | Public agent profile | BUILT | route /agent/:x |
| SHR-PUB-003 | Public agency profile | BUILT | code-tagged SHR-PUB-003; route /public/agency/:x |
| SHR-PUB-004 | Public area profile | BUILT | route /areas/:x |
| SHR-PUB-005 | Public white-label site (agency) | BUILT | route /site/:x |
| SHR-PUB-005b | Public white-label property detail | BUILT | route /site/:x/property/:x |
| SHR-PUB-006 | Public landing / marketing home | MISSING | — |
| SHR-PUB-007 | Public pricing | MISSING | — |
| SHR-SET-001 | Settings home | BUILT | code-tagged SHR-SET-001; route /settings |
| SHR-SET-002 | Account (profile) | BUILT | code-tagged SHR-SET-002 |
| SHR-SET-003 | Billing notification preferences | BUILT | code-tagged SHR-SET-003 |
| SHR-SET-004 | Sessions & devices | BUILT | code-tagged SHR-SET-004 |
| SHR-SET-005 | Delete account — Confirm intent (CORRECTED 2026-09-04 per user feedback) | BUILT | code-tagged SHR-SET-005 |
| SHR-SET-005b | Delete account — Check your email | PARTIAL | settings/DeleteAccountPage.tsx |
| SHR-SET-005c | Delete account — Verify with TOTP | BUILT | route /account-recovery/complete |
| SHR-SET-005d | Delete account — Scheduled | BUILT | public/ScheduledDeletionConfirmationPage.tsx + components/deletion/DeletionCountdown.tsx |
| SHR-INT-001 | Bazaar syndication opt-in (per-listing + tenant default) | BUILT | components/listings/composer/StepContactAttribution.tsx (Bazaar opt-in) |
| SHR-INT-002 | Bazaar performance in analytics | PARTIAL | Bazaar source present in widgets; not in analytics breakdown |

## MISSING + PARTIAL work queue (grouped by service-domain)

_Not-fully-built screens grouped by the 3-letter domain segment, to drive a build plan. `[P]` = PARTIAL, `[M]` = MISSING._

### AGN-CRD
- `AGN-CRD-003` [P] Top-up outcome
- `AGN-CRD-004` [M] Allocation rules
- `AGN-CRD-005` [M] Allocate credits to agent(s) (CORRECTED 2026-09-04 — clawback specifics)

### AGN-INV
- `AGN-INV-002` [P] Invoice detail

### AGN-MEM
- `AGN-MEM-004` [P] Pending invites list
- `AGN-MEM-008` [M] Pause member (CORRECTED 2026-09-04 per D9 — pause_reason as first-class field)
- `AGN-MEM-009` [M] End membership (offboarding workflow)

### AGN-PRC
- `AGN-PRC-002` [P] Bulk price adjustment (CORRECTED 2026-09-04 — added safety rails)
- `AGN-PRC-003` [P] Comparables browser

### AGN-PUB
- `AGN-PUB-001` [P] Public profile settings

### AGN-REP
- `AGN-REP-001` [M] Reports home
- `AGN-REP-002` [M] Listings performance report
- `AGN-REP-003` [P] Lead conversion funnel
- `AGN-REP-004` [M] Agent leaderboard
- `AGN-REP-005` [M] Credit spend report
- `AGN-REP-006` [M] Campaign performance
- `AGN-REP-007` [P] Revenue attribution
- `AGN-REP-008` [M] Custom report builder

### AGN-ROU
- `AGN-ROU-002` [P] Rule editor

### AGN-SET
- `AGN-SET-001` [P] Settings home
- `AGN-SET-002` [P] Agency identity & branding
- `AGN-SET-003` [M] Contact & business info
- `AGN-SET-006` [M] Delete agency

### AGN-SUB
- `AGN-SUB-003` [P] Change plan outcome
- `AGN-SUB-004` [M] Cancel subscription
- `AGN-SUB-005` [M] Manage payment method

### AGN-SYN
- `AGN-SYN-001` [M] Sync connections list
- `AGN-SYN-002` [M] Connection detail + logs
- `AGN-SYN-003` [M] Import listings from external source (WLB-based one-off)
- `AGN-SYN-004` [M] Import job progress

### AGN-TPL
- `AGN-TPL-001` [P] Agency templates list
- `AGN-TPL-002` [P] Template editor (agency-scope)

### AGN-WLB
- `AGN-WLB-003` [P] Copy fields editor (REWRITTEN 2026-09-04 per D9)
- `AGN-WLB-005` [M] Analytics (REWRITTEN 2026-09-04 per D9 — merged with former AGN-WLB-006)

### AGT-APR
- `AGT-APR-006` [P] My submitted reports

### AGT-CHN
- `AGT-CHN-003` [P] Personal accounts ("my-connections")

### AGT-CMP
- `AGT-CMP-004` [P] Campaign detail + performance
- `AGT-CMP-005` [M] Saved searches (audience source)

### AGT-CTC
- `AGT-CTC-004` [M] Merge contacts
- `AGT-CTC-005` [P] Contact export

### AGT-HTX
- `AGT-HTX-003` [M] Import closed transactions

### AGT-INB
- `AGT-INB-004` [P] Assign conversation

### AGT-LAI
- `AGT-LAI-001` [P] Generate description
- `AGT-LAI-002` [P] Refine / preview generated content (P0 — REWRITTEN 2026-09-04 per D9)

### AGT-LST
- `AGT-LST-010` [M] Add / edit offer on a listing — **built, PR #224 (Wave 1)**
- `AGT-LST-013` [M] Property disposition case (CORRECTED — added 2026-09-04)
- `AGT-LST-014` [M] Canonical property view (multi-agency same property)
- `AGT-LST-015` [M] Seller performance report / vendor report (ADDED 2026-09-17) — client-facing shareable report card; brief written, sequenced in Wave 1 after AGT-LST-006

### AGT-OPP
- `AGT-OPP-002` [P] Opportunity detail

### AGT-PUB
- `AGT-PUB-007` [M] Schedule publish (later)

### AGT-REV
- `AGT-REV-001` [M] Reviews received

### AGT-SUB
- `AGT-SUB-004` [M] Cancel subscription (solo)
- `AGT-SUB-005` [P] Plan change outcome

### AGT-TSK
- `AGT-TSK-002` [P] Task detail / edit
- `AGT-TSK-003` [M] Reminder policies

### AGT-WLA
- `AGT-WLA-004` [M] WhatsApp intake settings
- `AGT-WLA-005` [P] WhatsApp intake analytics

### PA-ACC
- `PA-ACC-001` [M] Periods index
- `PA-ACC-002` [M] Period detail
- `PA-ACC-003` [M] Billing period close

### PA-APR
- `PA-APR-004` [P] Approval audit trail per item

### PA-ARE
- `PA-ARE-002` [P] Area detail + editor
- `PA-ARE-003` [M] Signals review

### PA-AUD
- `PA-AUD-002` [P] Retention policy

### PA-CLS
- `PA-CLS-001` [M] Classifier config

### PA-CON
- `PA-CON-002` [P] Contract detail
- `PA-CON-003` [P] Create / edit contract version

### PA-CRD
- `PA-CRD-002` [P] Wallet detail
- `PA-CRD-003` [P] Credit lots (prepaid stock) index
- `PA-CRD-006` [P] Grant outcome / receipt (P0 — REWRITTEN 2026-09-04 per D9)
- `PA-CRD-007` [M] GDPR erasure for wallet history
- `PA-CRD-008` [M] Janitor status widget
- `PA-CRD-009` [M] Fin mirror worker status

### PA-DUN
- `PA-DUN-001` [M] Dunning cases index
- `PA-DUN-002` [M] Dunning case detail
- `PA-DUN-003` [M] Advance stage
- `PA-DUN-004` [M] Cure case (mark paid)
- `PA-DUN-005` [M] Write off (destructive + approval)

### PA-EXC
- `PA-EXC-002` [P] Exception detail

### PA-FAC
- `PA-FAC-002` [P] Facility detail
- `PA-FAC-003` [P] Create facility
- `PA-FAC-004` [P] Adjust facility limit

### PA-FIN
- `PA-FIN-003` [P] Tenant detail

### PA-GOO
- `PA-GOO-001` [M] Google usage dashboard

### PA-INS
- `PA-INS-002` [P] Inspection submit form

### PA-INV
- `PA-INV-002` [P] Invoice detail
- `PA-INV-003` [P] Create credit note
- `PA-INV-004` [M] Create debit note
- `PA-INV-005` [M] Manual invoice create

### PA-MOD
- `PA-MOD-003` [P] Submission audit trail

### PA-NDL
- `PA-NDL-001` [M] Dead-letter queue

### PA-PAY
- `PA-PAY-001` [M] Payments index
- `PA-PAY-002` [M] Payment detail + apply
- `PA-PAY-003` [M] Record manual payment

### PA-PKG
- `PA-PKG-006` [P] Package deprecate
- `PA-PKG-007` [M] Feature registry admin

### PA-PRC
- `PA-PRC-002` [P] Price detail + versions
- `PA-PRC-003` [P] Create price version

### PA-PVA
- `PA-PVA-011` [M] Canonical property resolution admin (CORRECTED — added 2026-09-04)

### PA-REC
- `PA-REC-002` [P] Reconciliation run detail
- `PA-REC-003` [P] Run reconciliation manually
- `PA-REC-004` [P] Resolve drift item

### PA-SCR
- `PA-SCR-002` [P] AI configs
- `PA-SCR-003` [P] Calculate / recalculate scores
- `PA-SCR-004` [M] Manual score override

### PA-SUB
- `PA-SUB-003` [P] Preview change plan
- `PA-SUB-004` [P] Create subscription
- `PA-SUB-005` [P] Change plan outcome
- `PA-SUB-006` [P] Cancel subscription

### PA-USR
- `PA-USR-001` [M] Users search
- `PA-USR-002` [M] User detail (impersonate + promote)

### PA-VEN
- `PA-VEN-002` [P] Vendor detail
- `PA-VEN-003` [P] Add / edit vendor rate
- `PA-VEN-004` [P] Vendor statement detail
- `PA-VEN-005` [P] Vendor statement reconcile action

### PA-WLA
- `PA-WLA-003` [P] Grant credits (WhatsApp module)
- `PA-WLA-004` [M] WhatsApp audit log

### SHR-ERR
- `SHR-ERR-002` [P] 403 / Permission denied
- `SHR-ERR-005` [P] Maintenance / degraded

### SHR-INT
- `SHR-INT-002` [P] Bazaar performance in analytics

### SHR-LEG
- `SHR-LEG-003` [M] Refund Policy
- `SHR-LEG-004` [M] Cookie / Data Processing Notice

### SHR-PUB
- `SHR-PUB-006` [M] Public landing / marketing home
- `SHR-PUB-007` [M] Public pricing

### SHR-SET
- `SHR-SET-005b` [P] Delete account — Check your email
