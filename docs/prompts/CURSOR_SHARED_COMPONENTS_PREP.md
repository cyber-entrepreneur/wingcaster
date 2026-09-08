# Cursor dispatch — Shared Components Prep

**PR title:** `feat(shared): extract cross-wave Broadcast primitives (REC-family, PA-queue-family, forms, MFA, Settings shell, ONB, WLB)`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~4-5 days with parallel agents; ~7-10 days serial

**Rev 1 — 2026-09-08**

**Depends on:** Wave 0 shell components merged (this PR extracts child primitives that shells consume; nav-chrome + AppShells must exist first).

**Screen Matrix workstream context:** cross-wave optimization. 40+ shared components were surfaced during Phase-1 brief authoring; extracting them ONCE before Waves 1-8+ dispatch cuts ~15% code volume off every downstream wave. Companion to [SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md](../design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) §5a (grep "shared components" for the family maps).

---

## 1. Why this dispatch

Every Phase-1 brief surfaced shared primitives that downstream screens import verbatim. Building each in-place inside the first screen that uses it (the naive path) forces every subsequent wave to touch shared code AGAIN, invites drift, and complicates review.

**Solution:** one dedicated small-scoped PR that extracts every cross-wave primitive into `web/src/components/{queue,recipient,onboarding,forms,settings,agency,portals}/` with stub JSDoc + minimal implementation. Downstream waves import these + populate implementation details as they build their consumer screens.

**Alternative rejected:** build in-place per wave. Rejected because Wave 1 already surfaced the pattern with `<IdentityForm>` needing to be shared between SHR-AUT-006 and AGN-MEM-005 — if built inside SHR-AUT-006, AGN-MEM-005 either reimplements or reaches across concerns. Bad shape.

## 2. Read these files FIRST

- [SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md](../design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) §5a — grep "shared components" (16+ blocks each listing family + members)
- Every brief listed in §3 below — each documents the component's contract in its own §Component palette and §Downstream implementation sections
- [BROADCAST_ALIGNMENT_REFERENCE.md](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md) — token contract

## 3. Component inventory (extraction targets)

### 3.1 REC-family (recipient screens)

**Path:** `web/src/components/recipient/`

**Source-of-truth brief:** [AGT-REC-004](../design/briefs/AGT-REC-004-application-outcome-brief.md) is the anchor. AGT-REC-002/003/006 inherit.

**Primitives:**
- `<StatusHero>` — state-typed glyph + label + timestamp band. Supports `emphasis="loud" | "default"` (REC-002 APPROVED-AND-QUARANTINED + REC-003 APPROVED-AS-SIGNAL-ONLY need default variant per AGT-REC-002/003 briefs)
- `<OutcomeTimeline>` — vertical `<ol>` rail with complete/current/pending/skipped dot states + optional signal-lamp pulse
- `<ResolverMessage>` — attribution row + Markdown-subset renderer with consistent empty state
- `<PrimaryCtaPerState>` — exactly-one-primary rule + stacked-mobile / sidebar-desktop layout + "no destructive red on REC" doctrine

**Also uses REC-family:** AGT-PUB-003 (imports StatusHero + PrimaryCtaPerState verbatim + adds `<PortalReceiptCard>`, `<AggregateOutcomeHero>`, `<CreditsSummary>`)

### 3.2 PA-queue-family

**Path:** `web/src/components/queue/`

**Source-of-truth brief:** [PA-MOD-001](../design/briefs/PA-MOD-001-portal-moderation-queue-brief.md). PA-ACR-001, PA-PVA-008/009, PA-APR-001, PA-PKG-003 inherit.

**Primitives:**
- `<PAQueueFilterStrip>` — env-badge + status + submitted-within + risk-tier + custom-filters slot
- `<PAQueueTable>` — filterable table + row-selection + row-click-to-detail
- `<PAQueueBulkBar>` — floating bulk-action bar (approve / reject / assign). NOTE: WF-04 (PA-ACR) and WF-05 (PA-PVA-008) OMIT this for PII / market-impact safety reasons. Configurable via `showBulk` prop.
- `<PAQueueBulkApproveDialog>` + `<PAQueueBulkReasonDialog>` — bulk-action confirmations
- `<PAQueueKeyboardShortcutsPanel>` — J/K/A/R/I/Enter/X/Shift+A/./?/Esc reference panel

**7 family invariants (documented in code JSDoc):** env-badge-always-visible; env-scoped data; two-person rule; bulk-reject-requires-reason + bulk-approve-count-confirm; step-up for high-risk + bulk>5; immutable audit; 5s undo grace for single-row only; keyboard-first.

### 3.3 Wave-4 onboarding family

**Path:** `web/src/components/onboarding/`

**Source-of-truth briefs:** [AGT-ONB-001](../design/briefs/AGT-ONB-001-onboarding-welcome-brief.md), [AGT-WLB-001](../design/briefs/AGT-WLB-001-whatsapp-connect-brief.md)

**Primitives:**
- `<OnboardingProgressMarker>` — used by AGT-ONB-001/002/003/004
- `<IntakePathCard>` — AGT-ONB-001 + -004 next-actions
- `<ActivationCodeBanner>` — AGT-ONB-002, reused by AGT-SET-004
- `<OnboardingStepper>` + `<SignalLampDot>` — AGT-ONB-002 + -004 thumbnail
- `<DraftListingPreview>` — AGT-ONB-003, reused by AGT-WLA-002
- `<CelebrationHeader tone>` — AGT-ONB-003 subdued + -004 loud (variant prop)
- `<PublishingOverlay>` — AGT-ONB-003 + any future publish
- `<OnboardingChecklistCard>` + `<OnboardingPill>` + `<ProgressRing>` + `<SparkleBurst>` — AGT-ONB-005 (mounted on AGT-DSH-001)
- `<OfflineBanner>` — all 5 ONB screens
- `useOnboardingState()` — SWR hook consumed by ONB screens + AGT-DSH-001

### 3.4 WhatsApp intake tour family

**Path:** `web/src/components/onboarding/whatsapp/`

**Source-of-truth briefs:** [AGT-WLB-002](../design/briefs/AGT-WLB-002-activation-code-brief.md), [AGT-WLB-004](../design/briefs/AGT-WLB-004-listing-drafting-brief.md)

**Primitives:**
- `<TourFrame>` — 5-dot progress + safe-exit chrome
- `<StepHero>` — neutral default; `emphasis="success"` loud-orange only on -005
- `<BenefitList>` — -001 only
- `<WhatsAppHandshakePanel>` — code + shared-number + QR + copy + tel-link + countdown; used on -002
- `<LiveDraftCanvas>` — SSE/polling/fallback-aware streaming field grid; -004
- `<SignalLampBadge>` — -003 only (importer-restricted to WLB-003 + AGT-DSH-001)
- `<InboundMessageSummary>` — -004
- `<ListingPreviewCard>` — -005, reused by AGT-LST-003

### 3.5 MFA family

**Path:** `web/src/components/mfa/`

**Source-of-truth briefs:** [SHR-MFA-001](../design/briefs/SHR-MFA-001-2fa-settings-brief.md), [SHR-MFA-004](../design/briefs/SHR-MFA-004-2fa-challenge-brief.md)

**Primitives:**
- `<OtpInput>` — 6-cell code input; used by MFA-003/004/007
- `<BackupCodeInput>` — single-line auto-formatting; used by MFA-004b/006/007
- `<RateLimitBanner>` — MFA-004/004b/007
- `<TrustFooter>` — MFA-004/004b/AUT-001/AUT-006
- `<StepUpModal>` + `<StepUpProvider>` + `useStepUp()` hook — MFA-005/006, SET-004/005, PA credit surfaces, AGN ownership transfer
- `<TwoFactorStatusHero>` + `<MethodRow>` + `<BackupCodesRow>` — MFA-001, reused in SET-004
- `<EnrollmentStepper>` — MFA-002/003/005
- `<PasswordGateCard>` — MFA-002/006
- `<RevealableSecret>` — MFA-002
- `<BackupCodeGrid>` — MFA-005
- `web/src/print.css` addition for backup-codes print

### 3.6 Settings shell

**Path:** `web/src/components/settings/`

**Source-of-truth brief:** [SHR-SET-001](../design/briefs/SHR-SET-001-settings-home-brief.md)

**Primitives:**
- `<SettingsShell>` — top-level shell; renders sidebar + right-pane
- `<SettingsSidebar>` — nav sidebar for desktop
- `<SettingsNavGroup>` — group of settings items (Account, Security, etc.)
- `<SettingsNavItem>` — one settings item link
- `<SettingsCardList>` — mobile grouped-cards fallback
- `<SettingsCardRow>` — mobile card row

SHR-SET-002/003/004/005 register as child routes and specify right-pane content only.

### 3.7 Agency identity primitives

**Path:** `web/src/components/agency/`

**Source-of-truth brief:** [AGN-MEM-005](../design/briefs/AGN-MEM-005-public-join-apply-brief.md)

**Primitives:**
- `<AgencyIdentityCard>` — logo + name + description + size + primary market + active-listings count. Reused on SHR-PUB-003, AGN-DSH-001 attention cards
- `<PersonaChip>` — role badge (owner / admin / member / applicant). Reused across every agency surface
- `<OwnershipTransferChallenge>` — 3-factor challenge (password step-up + email OTP + typed agency-name). Used by AGN-SET-005b + AGT-REC-006 reversal modal

### 3.8 Form primitives

**Path:** `web/src/components/forms/`

**Source-of-truth briefs:** [AGT-APR-004](../design/briefs/AGT-APR-004-submit-bad-comparable-report-brief.md), [SHR-AUT-006](../design/briefs/SHR-AUT-006-signup-brief.md)

**Primitives:**
- `<EvidenceUploader>` — file-upload grid with progress/error tiles, `max_files` prop. AGT-APR-004/005, PA-CRD-005 grant initiator
- `<ContextEchoCard>` — read-only "here's what you're acting on" reassurance. Same consumers
- `<IdentityForm>` — the tab-switcher + inputs + password + strength meter + consent block from SHR-AUT-006. Reused by AGN-MEM-005 guest-signup collapsible per that brief's cross-brief dependency note

### 3.9 Portal / channel primitives

**Path:** `web/src/components/ui/portal-status-pill.tsx` and `web/src/components/portals/`

**Source-of-truth briefs:** [AGT-PUB-006](../design/briefs/AGT-PUB-006-portal-tracker-brief.md), [PA-POR-001](../design/briefs/PA-POR-001-portal-list-brief.md)

**Primitives:**
- `<PortalStatusPill>` — 6-status enum; used by AGT-PUB-003 receipt cards + AGT-PUB-006 tracker rows. Elevated to `components/ui/`
- `<PortalReceiptCard>` — per-portal receipt row for AGT-PUB-003, reused by AGT-PUB-006
- `<AggregateOutcomeHero>` — StatusHero adapter with 3-pill counter row
- `<CreditsSummary>` — credits-reconciliation block
- Add `web/src/components/ui/channel-mark.tsx` if not already present (used across inbox screens)

### 3.10 PII + audit primitives

**Path:** `web/src/components/security/`

**Source-of-truth briefs:** [PA-ACR-001/002](../design/briefs/PA-ACR-001-account-recovery-queue-brief.md)

**Primitives:**
- `<PIIMask>` — masked-by-default + click-to-reveal + audit-log write on reveal. Reusable across PA-USR, PA-SUP, PA-KYC
- `<TwoPersonProgress>` — reusable across every WF-07/08/17-25/27-28 second-approval surface
- `<Timeline>` — shared with PA-AUD-001 if not already shipped

## 4. Parallelization directive

Spawn 10 concurrent agents — one per component family in §3. Every family has a disjoint directory. Zero collision.

**Phase A — spawn concurrently (10 agents):**

1. REC-family (`recipient/`)
2. PA-queue-family (`queue/`)
3. Onboarding family (`onboarding/`)
4. WhatsApp intake tour (`onboarding/whatsapp/`)
5. MFA family (`mfa/`)
6. Settings shell (`settings/`)
7. Agency identity (`agency/`)
8. Form primitives (`forms/`)
9. Portal/channel primitives (`ui/portal-status-pill.tsx` + `portals/`)
10. PII/audit (`security/`)

**Each agent's job:** for its family, create the file(s), export the primitives with proper TypeScript types + JSDoc, implement enough behavior to compile + render + pass a smoke test. Full implementation details land per-consumer-screen in downstream waves. **NOT trying to fully implement business logic here — just extract the interface + stub visual + prop types.**

**Phase B — sequential AFTER Phase A merges:**

11. **Storybook / preview page agent** — build `web/src/pages/dev/ComponentInventory.tsx` (dev-only route `/dev/components`) that renders every primitive in default + variant states. Serves as the visual regression baseline + a Cursor reference for downstream waves. Touches only `pages/dev/*`.

12. **Cross-family import test** — Real-Postgres + integration test that every downstream brief's listed component actually exists + has the expected prop signature. Compile check + type-check via `tsc --noEmit`. Touches only test files.

## 5. Coordination table

| # | Agent | Path | Depends on | Est. days |
|---|---|---|---|---|
| 1 | REC | `components/recipient/` | Wave 0 tokens | 1 |
| 2 | PA-queue | `components/queue/` | Wave 0 tokens | 1 |
| 3 | Onboarding | `components/onboarding/` | Wave 0 tokens | 1 |
| 4 | WLB | `components/onboarding/whatsapp/` | Wave 0 tokens | 1 |
| 5 | MFA | `components/mfa/` | Wave 0 tokens | 1 |
| 6 | Settings | `components/settings/` | Wave 0 shells + nav | 0.5 |
| 7 | Agency | `components/agency/` | Wave 0 tokens | 0.5 |
| 8 | Forms | `components/forms/` | Wave 0 tokens | 1 |
| 9 | Portal/channel | `components/ui/portal-status-pill.tsx` + `components/portals/` | Wave 0 tokens | 0.5 |
| 10 | Security | `components/security/` | Wave 0 tokens | 0.5 |
| 11 | Component inventory | `pages/dev/ComponentInventory.tsx` | Agents 1-10 | 1 |
| 12 | Import test | `test/` | Agents 1-10 | 0.5 |

## 6. Non-negotiables

1. **Every primitive matches its brief's Component palette exactly** — prop names, prop types, variant enums.
2. **`no-raw-hex.test.ts` green** — every color is a `--lc-*` token.
3. **RTL + dark mode** on every primitive.
4. **JSDoc on every export** explaining consumers ("Used by AGT-REC-002/003/004/006") + variant enums + prop invariants (e.g. "PA-queue-family: bulk actions omitted when `showBulk={false}` for WF-04/WF-05 safety").
5. **No business-logic implementation** here — primitives are visual + prop-shape only. Business logic lands per consumer screen.
6. **Every family has at least one Storybook / inventory-page example** rendered in dev at `/dev/components`.
7. **TypeScript strict mode green** — no `any` unless justified with a JSDoc `@justified` tag.
8. **Zero touches to Wave 0 files or Wave 1 files.**

## 7. Definition of done

1. All 10 family directories + primitives exist + exports compile + TypeScript strict green.
2. `/dev/components` renders every primitive with default + variants.
3. Cross-family import test proves every downstream brief's listed component exists with expected prop signature.
4. `no-raw-hex.test.ts` + build CI green.
5. RTL + dark verified visually on `/dev/components` preview.
6. PR body includes screenshots of the component inventory page in LTR/RTL × light/dark.

## 8. Follow-ups (do NOT include in this PR)

- Full business-logic implementation per primitive — lands in the consumer-screen wave that first uses it.
- Any variant not documented in the source-of-truth brief — flag as follow-up.
- Localization strings — primitives take `label` / `helperText` etc. as props; parent screens supply content.
- Icon library additions — if a primitive needs a lucide-react icon not already imported, add to the primitive; do NOT create a custom SVG.

## 9. Out of scope

- Any consumer-screen implementation.
- Any backend endpoint.
- Any color / spacing / motion token additions (Broadcast tokens are locked from PR #41).
- Any new npm package installation beyond what's in `package.json` today. If a primitive needs a new lib (unlikely at extract stage), FLAG in PR body for discussion.
- Any change to Wave 0's `app/AppShell*.tsx` or `components/nav/*`.
