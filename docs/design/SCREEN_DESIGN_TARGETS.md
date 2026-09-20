# Screen Design Targets — built in code, no design brief

_Generated 2026-09-20 by diffing `docs/design/SCREEN_GAP_RECONCILIATION.md` (340 planned/wireframe screen IDs vs git-truth code) against the 82 design briefs in `docs/design/briefs/`._

**Definition:** screens the gap-doc marks **BUILT** or **PARTIAL** (they exist in code) but that have **no design brief** — i.e. built without a full design pass. These are the candidates for Claude to design, to replace the current implementation later. **212 total.** PARTIAL = the screen exists but is incomplete vs spec (higher design priority).

> Note on interpretation: this treats a *design brief* as "in the wireframe/designed." If instead you mean screens with **no matrix entry at all** (truly off-plan), that's a different, smaller set — say the word and I'll compute it.

## Agent (AGT) — 62

| ID | Verdict | Name |
|---|---|---|
| AGT-APP-001 | BUILT | Public profile editor |
| AGT-APR-001 | BUILT | Pricing portfolio |
| AGT-APR-002 | BUILT | Adjust price |
| AGT-APR-003 | BUILT | Comparable detail + report bad |
| AGT-APR-006 | PARTIAL | My submitted reports |
| AGT-CHN-001 | BUILT | Channels list |
| AGT-CHN-002 | BUILT | Channel connect (OAuth wrapper) |
| AGT-CHN-003 | PARTIAL | Personal accounts ("my-connections") |
| AGT-CMD-001 | BUILT | Command center |
| AGT-CMP-001 | BUILT | Campaigns list |
| AGT-CMP-002 | BUILT | Campaign builder wizard (Guided) |
| AGT-CMP-003 | BUILT | Campaign builder single-page (Pro) |
| AGT-CMP-004 | PARTIAL | Campaign detail + performance |
| AGT-CTC-001 | BUILT | Contacts list |
| AGT-CTC-002 | BUILT | Contact detail (360) |
| AGT-CTC-003 | BUILT | Contact create / edit |
| AGT-CTC-005 | PARTIAL | Contact export |
| AGT-CTC-006 | BUILT | Lead score regenerate |
| AGT-HTX-001 | BUILT | Closed transactions list |
| AGT-HTX-002 | BUILT | Add closed transaction |
| AGT-INB-003 | BUILT | Compose new conversation |
| AGT-INB-004 | PARTIAL | Assign conversation |
| AGT-INB-005 | BUILT | Channel + source dual-badge treatment (CORRECTED — added 2026-09-04) |
| AGT-INT-001 | BUILT | Integrations (agent-scope) |
| AGT-LAI-001 | PARTIAL | Generate description |
| AGT-LAI-002 | PARTIAL | Refine / preview generated content (P0 — REWRITTEN 2026-09-04 per D9) |
| AGT-LST-005 | BUILT | original — Listing create/edit (Pro single-form) |
| AGT-LST-006 | BUILT | Listing analytics tab |
| AGT-LST-007 | BUILT | Listing share sheet |
| AGT-LST-008 | BUILT | Listing archive (soft delete) |
| AGT-LST-009 | BUILT | Listing delete (destructive) |
| AGT-LST-011 | BUILT | Publications tab |
| AGT-LST-012 | BUILT | Comments tab |
| AGT-NPF-001 | BUILT | Notifications inbox |
| AGT-NPF-002 | BUILT | Notification preferences |
| AGT-NVL-001 | BUILT | Neighborhood valuator (per listing) |
| AGT-OPP-001 | BUILT | Opportunities pipeline (Kanban, Pro) |
| AGT-OPP-001b | BUILT | Opportunities list (Guided, mobile) |
| AGT-OPP-002 | PARTIAL | Opportunity detail |
| AGT-OPP-003 | BUILT | Add opportunity |
| AGT-PUB-001 | BUILT | Publish this listing (Guided — one big button) |
| AGT-PUB-002 | BUILT | Publish per-channel (Pro or Guided-expanded) |
| AGT-PUB-004 | BUILT | Retry / republish |
| AGT-PUB-005 | BUILT | Portal submission form (real-estate portals) |
| AGT-REC-001 | BUILT | Portal submission outcome (WF-03 Recipient) (P0 — CONSOLIDATED 2026-09-04 per D9) |
| AGT-REC-005 | BUILT | Account recovery outcome (WF-04 Recipient) |
| AGT-ROU-001 | BUILT | Own routing preferences |
| AGT-SET-001 | BUILT | Settings home (agent) |
| AGT-SUB-001 | BUILT | My subscription |
| AGT-SUB-002 | BUILT | Change plan (solo agent) |
| AGT-SUB-003 | BUILT | Credits & top-up |
| AGT-SUB-005 | PARTIAL | Plan change outcome |
| AGT-SUB-006 | BUILT | Invoices (agent scope) |
| AGT-SUB-007 | BUILT | Credit notes (agent scope) |
| AGT-TPL-001 | BUILT | Templates list (agent-scope) |
| AGT-TPL-002 | BUILT | Template editor |
| AGT-TSK-001 | BUILT | Tasks list |
| AGT-TSK-002 | PARTIAL | Task detail / edit |
| AGT-WLA-001 | BUILT | Drafts inbox |
| AGT-WLA-002 | BUILT | Draft review (Approve / Edit / Discard) |
| AGT-WLA-003 | BUILT | Draft edit-before-approve |
| AGT-WLA-005 | PARTIAL | WhatsApp intake analytics |

## Agency (AGN) — 40

| ID | Verdict | Name |
|---|---|---|
| AGN-AUD-001 | BUILT | Agency audit log (CORRECTED 2026-09-04 per D9 — backend endpoint required) |
| AGN-CRD-001 | BUILT | Agency wallet overview |
| AGN-CRD-002 | BUILT | Top-up credits (Paddle checkout path) |
| AGN-CRD-003 | PARTIAL | Top-up outcome |
| AGN-CRD-006 | BUILT | Feature quota view (agency aggregate) |
| AGN-DSH-001 | BUILT | Agency dashboard |
| AGN-INV-001 | BUILT | Invoices list (tenant view) |
| AGN-INV-002 | PARTIAL | Invoice detail |
| AGN-INV-003 | BUILT | Credit notes list (tenant view) |
| AGN-MEM-001 | BUILT | Members list |
| AGN-MEM-003 | BUILT | Invite member |
| AGN-MEM-004 | PARTIAL | Pending invites list |
| AGN-MEM-006 | BUILT | Member detail |
| AGN-MEM-007 | BUILT | Change member role |
| AGN-PRC-001 | BUILT | Agency pricing portfolio |
| AGN-PRC-002 | PARTIAL | Bulk price adjustment (CORRECTED 2026-09-04 — added safety rails) |
| AGN-PRC-003 | PARTIAL | Comparables browser |
| AGN-PRC-004 | BUILT | Report bad comparable (WF-05 Initiator) |
| AGN-PUB-001 | PARTIAL | Public profile settings |
| AGN-REP-003 | PARTIAL | Lead conversion funnel |
| AGN-REP-007 | PARTIAL | Revenue attribution |
| AGN-ROU-001 | BUILT | Routing rules index |
| AGN-ROU-002 | PARTIAL | Rule editor |
| AGN-ROU-003 | BUILT | Test rule |
| AGN-SET-001 | PARTIAL | Settings home |
| AGN-SET-002 | PARTIAL | Agency identity & branding |
| AGN-SET-004 | BUILT | Integrations |
| AGN-SUB-001 | BUILT | Current subscription |
| AGN-SUB-002 | BUILT | Change plan (preview + confirm) |
| AGN-SUB-003 | PARTIAL | Change plan outcome |
| AGN-TPL-001 | PARTIAL | Agency templates list |
| AGN-TPL-002 | PARTIAL | Template editor (agency-scope) |
| AGN-WID-001 | BUILT | Widgets list |
| AGN-WID-002 | BUILT | Widget builder |
| AGN-WLA-001 | BUILT | WhatsApp Listings entitlements |
| AGN-WLA-002 | BUILT | Update entitlement per agent |
| AGN-WLB-001 | BUILT | Site overview + preview (REWRITTEN 2026-09-04 per D9) |
| AGN-WLB-002 | BUILT | Brand + template chooser (REWRITTEN 2026-09-04 per D9) |
| AGN-WLB-003 | PARTIAL | Copy fields editor (REWRITTEN 2026-09-04 per D9) |
| AGN-WLB-004 | BUILT | Custom domain (UNCHANGED FROM ORIGINAL — REVIEWED 2026-09-04 per D9) |

## Platform Admin (PA) — 78

| ID | Verdict | Name |
|---|---|---|
| PA-APR-001 | BUILT | Approvals queue |
| PA-APR-002 | BUILT | Approval detail (generic wrapper) |
| PA-APR-004 | PARTIAL | Approval audit trail per item |
| PA-ARE-001 | BUILT | Areas index |
| PA-ARE-002 | PARTIAL | Area detail + editor |
| PA-AUD-001 | BUILT | Audit log |
| PA-AUD-002 | PARTIAL | Retention policy |
| PA-CFG-001 | BUILT | Feature flags |
| PA-CFG-002 | BUILT | Worker cadence & health |
| PA-CFG-003 | BUILT | API keys & secrets rotation |
| PA-CFG-004 | BUILT | Regional & currency configuration |
| PA-CFG-005 | BUILT | Paddle config (SIMPLIFIED 2026-09-04 per D5 → Paddle-only single-provider surface) |
| PA-CFG-006 | BUILT | Territories & disclosure fields config (CORRECTED — added 2026-09-04) |
| PA-CFG-007 | BUILT | Real Estate Bazaar integration config (CORRECTED — added 2026-09-04) |
| PA-CMD-001 | BUILT | Command Center |
| PA-CON-001 | BUILT | Contracts index |
| PA-CON-002 | PARTIAL | Contract detail |
| PA-CON-003 | PARTIAL | Create / edit contract version |
| PA-CRD-001 | BUILT | Wallets index |
| PA-CRD-002 | PARTIAL | Wallet detail |
| PA-CRD-003 | PARTIAL | Credit lots (prepaid stock) index |
| PA-CRD-004 | BUILT | Holds (current reservations) |
| PA-CRD-005 | BUILT | Credit grant request form (Initiator) (P0 — ELEVATED 2026-09-04 per D9) |
| PA-CRD-006 | PARTIAL | Grant outcome / receipt (P0 — REWRITTEN 2026-09-04 per D9) |
| PA-EXC-001 | BUILT | Exceptions index |
| PA-EXC-002 | PARTIAL | Exception detail |
| PA-FAC-001 | BUILT | Facilities index |
| PA-FAC-002 | PARTIAL | Facility detail |
| PA-FAC-003 | PARTIAL | Create facility |
| PA-FAC-004 | PARTIAL | Adjust facility limit |
| PA-FIN-001 | BUILT | Overview / dashboard |
| PA-FIN-002 | BUILT | Tenants list |
| PA-FIN-003 | PARTIAL | Tenant detail |
| PA-FIN-004 | BUILT | Usage explorer |
| PA-FIN-005 | BUILT | Configuration (platform settings) |
| PA-INS-001 | BUILT | Inspector queue |
| PA-INS-002 | PARTIAL | Inspection submit form |
| PA-INV-001 | BUILT | Invoices index |
| PA-INV-002 | PARTIAL | Invoice detail |
| PA-INV-003 | PARTIAL | Create credit note |
| PA-MOD-003 | PARTIAL | Submission audit trail |
| PA-PKG-005 | BUILT | Package approval (Approval detail / second-approver review) |
| PA-PKG-006 | PARTIAL | Package deprecate |
| PA-PRC-001 | BUILT | Prices index |
| PA-PRC-002 | PARTIAL | Price detail + versions |
| PA-PRC-003 | PARTIAL | Create price version |
| PA-PVA-001 | BUILT | Pricing config home |
| PA-PVA-002 | BUILT | Sources CRUD |
| PA-PVA-003 | BUILT | Currency rates |
| PA-PVA-004 | BUILT | Normalization rules |
| PA-PVA-005 | BUILT | CSV import |
| PA-PVA-006 | BUILT | Recalculation jobs |
| PA-PVA-007 | BUILT | Trend runs |
| PA-REC-001 | BUILT | Reconciliation runs index |
| PA-REC-002 | PARTIAL | Reconciliation run detail |
| PA-REC-003 | PARTIAL | Run reconciliation manually |
| PA-REC-004 | PARTIAL | Resolve drift item |
| PA-SCR-001 | BUILT | Scoring dimensions |
| PA-SCR-002 | PARTIAL | AI configs |
| PA-SCR-003 | PARTIAL | Calculate / recalculate scores |
| PA-SUB-001 | BUILT | Subscriptions index |
| PA-SUB-002 | BUILT | Subscription detail |
| PA-SUB-003 | PARTIAL | Preview change plan |
| PA-SUB-004 | PARTIAL | Create subscription |
| PA-SUB-005 | PARTIAL | Change plan outcome |
| PA-SUB-006 | PARTIAL | Cancel subscription |
| PA-TPL-001 | BUILT | Templates index |
| PA-TPL-002 | BUILT | Template editor |
| PA-TPL-003 | BUILT | Send test dialog |
| PA-TPL-004 | BUILT | Template versions history |
| PA-VEN-001 | BUILT | Vendors index |
| PA-VEN-002 | PARTIAL | Vendor detail |
| PA-VEN-003 | PARTIAL | Add / edit vendor rate |
| PA-VEN-004 | PARTIAL | Vendor statement detail |
| PA-VEN-005 | PARTIAL | Vendor statement reconcile action |
| PA-WLA-001 | BUILT | WhatsApp Listings health |
| PA-WLA-002 | BUILT | Entitlements admin |
| PA-WLA-003 | PARTIAL | Grant credits (WhatsApp module) |

## Shared (SHR) — 32

| ID | Verdict | Name |
|---|---|---|
| SHR-AUT-002 | BUILT | Sign in with OTP (request code) |
| SHR-AUT-002b | BUILT | Verify OTP |
| SHR-AUT-003 | BUILT | Forgot password (request) |
| SHR-AUT-003b | BUILT | Forgot password sent (confirmation) |
| SHR-AUT-004 | BUILT | Reset password (from email link) |
| SHR-AUT-005 | BUILT | Account recovery (request) |
| SHR-AUT-005b | BUILT | Account recovery submitted |
| SHR-AUT-005c | BUILT | Account recovery complete (from admin-issued link) |
| SHR-ERR-001 | BUILT | 404 Not Found |
| SHR-ERR-002 | PARTIAL | 403 / Permission denied |
| SHR-ERR-003 | BUILT | 500 / Something went wrong |
| SHR-ERR-004 | BUILT | Offline (Capacitor) |
| SHR-ERR-005 | PARTIAL | Maintenance / degraded |
| SHR-ERR-006 | BUILT | Rate-limited |
| SHR-INT-001 | BUILT | Bazaar syndication opt-in (per-listing + tenant default) |
| SHR-INT-002 | PARTIAL | Bazaar performance in analytics |
| SHR-LEG-001 | BUILT | Terms of Service |
| SHR-LEG-002 | BUILT | Privacy Policy |
| SHR-NAV-002 | BUILT | Top navigation bar (desktop) / hamburger + drawer (mobile) |
| SHR-NAV-004 | BUILT | Notification center |
| SHR-NAV-004b | BUILT | Notification preferences |
| SHR-NAV-005 | BUILT | Command palette (⌘K) |
| SHR-NAV-007 | BUILT | Theme (dark/light) toggle |
| SHR-PUB-001 | BUILT | Public listing view |
| SHR-PUB-002 | BUILT | Public agent profile |
| SHR-PUB-003 | BUILT | Public agency profile |
| SHR-PUB-004 | BUILT | Public area profile |
| SHR-PUB-005 | BUILT | Public white-label site (agency) |
| SHR-PUB-005b | BUILT | Public white-label property detail |
| SHR-SET-005b | PARTIAL | Delete account — Check your email |
| SHR-SET-005c | BUILT | Delete account — Verify with TOTP |
| SHR-SET-005d | BUILT | Delete account — Scheduled |

