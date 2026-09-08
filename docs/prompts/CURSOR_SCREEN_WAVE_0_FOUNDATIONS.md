# Cursor dispatch — Screen Matrix Wave 0: Foundations (nav chrome + login + branding cleanup)

**PR title (nav chrome):** `feat(nav): global chrome — top bar / side drawer / tenant switcher / language selector / bottom tab bar / env switcher / login refactor`

**PR title (branding cleanup — separate small PR):** `chore(web): remove Real Estate Bazaar branding leak + delete legacy prior-project docs`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~7-10 days of Cursor work + review for the nav-chrome PR. ~1 day for the branding-cleanup PR (in parallel).

**Rev 1 — 2026-09-06.**

**Depends on:** none. Wave 0 unblocks every subsequent screen; nothing blocks Wave 0.

**Screen Matrix workstream context:** Wave 0 of the [Phase-1 workflow-cluster dispatch model](../design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) locked at Rev 8. Ships the 6 anchor navigation-chrome components + refactors the existing login screen to match the SHR-AUT-001 brief. Bundles the branding-cleanup PR alongside per Rev-8 directive.

---

## 1. Why this PR

Every authenticated screen in the WingCaster product app must render under consistent chrome — a top bar with search + tenant switcher + language selector + notifications + user menu; a side drawer with per-persona navigation; a mobile bottom tab bar for agents; a PA-only environment switcher; and a fully-refactored login screen. Today none of this exists as unified components. The audit trail:

- **SHR-NAV-008 tenant switcher: MISSING.** Grep on `TenantSwitcher\|currentTenant\|switchTenant` in `web/src` returns zero files. Migration `028_tenant_authorization_foundation.sql` created the multi-tenant data model but no UI. Consequence today: every screen defaults to personal tenant; agency-scoped agents cannot access agency context; every agency workflow is unreachable. Platform-wide architecture breaker.
- **SHR-NAV-003 agent bottom tab bar: MISSING.** Grep on `BottomTab\|MobileTabBar\|TabBar` returns zero files. Mobile-first agent claim is aspirational without it.
- **SHR-NAV-006 language selector: MISSING.** Grep on `LanguageSelector\|LanguageToggle\|switchLanguage\|setLanguage\|setLocale` returns only `TemplateSettingsForm.tsx` (a template-editor form control, not the app-wide selector). MENA launch blocker.
- **SHR-NAV-001 top bar + SHR-NAV-002 side drawer: no unified components.** Scattered nav bits exist per-page.
- **PA-NAV-001 env switcher: MISSING as UI.** Backend GUC exists (env context is set server-side); frontend surface missing.
- **SHR-AUT-001 login: EXISTS as `web/src/pages/LoginPage.tsx`** but only supports email+password — needs the 6-identity-path refactor per brief.
- **Branding leak — [web/src/lib/usePageTitle.ts:3](../../web/src/lib/usePageTitle.ts) defaults every browser-tab title's suffix to "Real Estate Bazaar"**, affecting 41 caller sites across `web/src`. Plus dead `web/rebrand.py` script + legacy `web/docs/*.md` prior-project design documents.

This PR pair (nav chrome + branding cleanup) fixes all of it.

---

## 2. Read these briefs FIRST

Every screen brief for this wave is on disk. Do NOT re-derive from the matrix files. Read each brief in full and follow its contract exactly — copy tables, component palette, state variants, downstream implementation notes.

1. [`docs/design/briefs/SHR-NAV-001-002-top-bar-side-drawer-brief.md`](../design/briefs/SHR-NAV-001-002-top-bar-side-drawer-brief.md) — top bar + side drawer (bundled brief)
2. [`docs/design/briefs/SHR-NAV-008-tenant-switcher-brief.md`](../design/briefs/SHR-NAV-008-tenant-switcher-brief.md) — tenant switcher
3. [`docs/design/briefs/SHR-NAV-006-language-selector-brief.md`](../design/briefs/SHR-NAV-006-language-selector-brief.md) — language selector
4. [`docs/design/briefs/SHR-NAV-003-agent-bottom-tab-bar-brief.md`](../design/briefs/SHR-NAV-003-agent-bottom-tab-bar-brief.md) — bottom tab bar
5. [`docs/design/briefs/PA-NAV-001-env-switcher-brief.md`](../design/briefs/PA-NAV-001-env-switcher-brief.md) — env switcher
6. [`docs/design/briefs/SHR-AUT-001-login-brief.md`](../design/briefs/SHR-AUT-001-login-brief.md) — login refactor
7. [`docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md) — governs every token / spacing / motion decision. Non-negotiable.

Also read for context but do NOT copy content from:
- [`docs/design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md`](../design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md) §5 (locked slate), §6 (Week 0 sequencing), §5a (backend blockers).
- [`docs/design/SCREEN_MATRIX_SHARED.md`](../design/SCREEN_MATRIX_SHARED.md) — matrix entries for SHR-NAV-001/002/003/006/008 + SHR-AUT-001.
- Migration `backend/src/persistence/migrations/028_tenant_authorization_foundation.sql` — multi-tenant data model.

---

## 3. Scope — nav-chrome PR

### 3.1 New files under `web/src/components/nav/`

| File | Purpose |
|---|---|
| `TopBar.tsx` | Fixed top bar per SHR-NAV-001 brief. |
| `SideDrawer.tsx` | Persistent expanded drawer per SHR-NAV-002 brief. |
| `SideDrawerRail.tsx` | Persistent collapsed 60px rail per SHR-NAV-002 brief. |
| `UserMenu.tsx` | User-menu popover — profile / preferences / password / 2FA / sign out. |
| `NotificationsPopover.tsx` | Notification bell popover. |
| `GlobalSearch.tsx` | Cmd+K / Ctrl+K search overlay using `cmdk`. |
| `TenantSwitcher.tsx` | Per SHR-NAV-008 brief. Trigger + popover (desktop/tablet) + bottom sheet (mobile). |
| `LanguageSelector.tsx` | Per SHR-NAV-006 brief. Segmented control with EN / العربية pills. |
| `BottomTabBar.tsx` | Per SHR-NAV-003 brief. Container. |
| `BottomTab.tsx` | Per SHR-NAV-003 brief. Cell primitive. |
| `BottomTabBadge.tsx` | Per SHR-NAV-003 brief. Badge primitive. |
| `MoreSheet.tsx` | Per SHR-NAV-003 brief. "More" bottom sheet. |
| `EnvBadge.tsx` | Per PA-NAV-001 brief. Badge in top bar. |
| `EnvSwitcherPopover.tsx` | Per PA-NAV-001 brief. LIVE / TEST option popover. |
| `EnvWarningStrip.tsx` | Per PA-NAV-001 brief. Sticky warning strip during TEST. |
| `EnvSwitchConfirmDialog.tsx` | Per PA-NAV-001 brief. LIVE-bound switch confirmation with type-to-confirm. |

### 3.2 New app-shell components under `web/src/app/`

| File | Purpose |
|---|---|
| `AgentAppShell.tsx` | Wraps every AGT-* route. Renders TopBar + SideDrawer (desktop) + BottomTabBar (mobile). |
| `AgencyAppShell.tsx` | Wraps every AGN-* route. Renders TopBar + SideDrawer only (desktop-only persona). |
| `PaAppShell.tsx` | Wraps every PA-* route. Renders TopBar (with EnvBadge) + SideDrawer + EnvWarningStrip (when env=test). |

Route the app so `useSession().persona ∈ {'agent', 'agency', 'pa'}` selects the appropriate shell after login redirect.

### 3.3 Refactor existing files

- `web/src/pages/LoginPage.tsx` — refactor per SHR-AUT-001 brief. Do NOT create a new file; replace the existing implementation. Add the 6-identity-path pattern (Google / Apple / Facebook OAuth + Email / Username / Phone + password). Add the identifier-type tab switcher. Match the copy table exactly.

### 3.4 New hooks under `web/src/hooks/`

| File | Purpose |
|---|---|
| `useLocale.ts` | Reads `users.preferred_locale`, syncs `<html lang>` + `<html dir>`, persists via API + localStorage, fires cross-tab BroadcastChannel. |
| `useTenant.ts` | Reads/writes `users.active_tenant_id`, lists available tenants, fires cross-tab BroadcastChannel. |
| `useEnv.ts` | Reads/writes session env for PA persona, fires cross-tab BroadcastChannel. |
| `useUnreadConversationCount.ts` | React Query subscription for inbox badge. Verify existing infra first. |
| `useContactAttentionCount.ts` | React Query subscription for contacts badge. Verify existing infra first. |
| `useHotkey.ts` | Cmd+K / Ctrl+K handler if a global hotkey lib is not already present. |
| `useVisualViewportKeyboardVisible.ts` | Detect soft keyboard so BottomTabBar hides. |

### 3.5 Cross-tab sync

- `web/src/lib/broadcast.ts` — thin wrapper around `BroadcastChannel('wingcaster-session')`. Events: `tenant-switched`, `locale-changed`, `env-changed`, `signed-out`.
- Each of the three switchers publishes on change; every open tab subscribes and reacts.

### 3.6 Font loading

Add to `web/index.html`:
```html
<link rel="preload" href="/fonts/ibm-plex-sans-arabic-500.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/ibm-plex-sans-arabic-600.woff2" as="font" type="font/woff2" crossorigin>
```

Confirm Broadcast tokens' font stack references these correctly; add `font-display: optional` in the `@font-face` if not already present (per SHR-NAV-006 brief §font-loading).

### 3.7 Backend endpoints — verify or add

For every endpoint below: check if it already exists (grep `server.js` + relevant module route files). If it exists and satisfies the contract, note that in the PR body. If it doesn't or its shape is wrong, add / fix it.

| Endpoint | Purpose | Payload / response |
|---|---|---|
| `GET /api/auth/me/tenants` | List tenants the user has access to | `{ tenants: [{ id, name, avatarUrl, role, listingsCount, agentsCount, isActive }] }` |
| `POST /api/auth/switch-tenant` | Set active tenant on session | body `{ tenantId }`; response fresh session |
| `PATCH /api/users/me` | Update preferences | body `{ preferred_locale?: 'en' \| 'ar' }` |
| `GET /api/auth/me/notifications` | List notifications for the popover | `{ notifications: [{ id, title, snippet, timestamp, unread, icon }], unreadCount }` |
| `POST /api/auth/me/notifications/mark-all-read` | Mark all read | — |
| `POST /api/search` | Global search (per-persona scoped server-side) | body `{ query, persona }`; response grouped results |
| `POST /api/admin/env/switch` | PA env switch | body `{ target: 'live' \| 'test' }`; response fresh session |
| `POST /api/auth/oauth/:provider/start` | Start OAuth handshake (google / apple / facebook) | initiates provider flow |
| `POST /api/auth/oauth/:provider/callback` | OAuth callback | consumes provider code |
| `POST /api/auth/login` | Existing — verify it accepts identifier + password with `identifier_type ∈ {'email','username','phone'}` field, not just email |

Backend field verifications:
- `users.active_tenant_id` — column exists per migration 028; verify.
- `users.preferred_locale` — column exists or add. Enum `('en', 'ar')`.
- `users.ui_prefs` JSONB — optional; used for drawer-mode persistence (or use localStorage).
- Session-env storage: server GUC exists per prior work; verify session-scoped env selector works.
- Sub-route: server middleware must set `X-Wingcaster-Env: <session env>` header on every response for the client to mirror on subsequent requests.

### 3.8 Test discipline

**Unit tests** (Vitest + React Testing Library, one per new component):
- Each nav component renders correct state per its brief's state-variant list.
- Every copy string from the brief tables matches (both EN and AR).
- Every state transition (idle → hover → focus → active) triggers correct styles.
- RTL variant flips correctly.
- Dark mode uses correct tokens.

**Integration tests**:
- Sign in → app shell renders per persona.
- Tenant switch → API fires + session updates + BroadcastChannel event received.
- Locale switch → `<html>` attributes update + persists.
- Env switch (PA) → confirmation dialog gate works + type-to-confirm required exact match.
- Bottom tab bar hides when soft keyboard visible + reappears on dismiss.
- Global search overlay opens with Cmd+K / Ctrl+K.

**Accessibility tests**:
- Every interactive element ≥ 44×44 tap target.
- Focus rings visible via keyboard nav.
- Screen reader announces route + tenant + locale changes via `aria-live`.
- Focus traps work in every popover + dialog + sheet.
- Skip-to-content link appears on first Tab.
- No color-only differentiation.

**Visual tests** (Chromatic or equivalent):
- Capture every state variant from every brief (target: ~80 snapshots across all 6 briefs).
- Include LTR + RTL, light + dark, mobile / tablet / desktop.

**`no-raw-hex.test.ts`** must stay green — every color reference is a `--lc-*` token.

### 3.9 Non-negotiables

1. **Every brief followed to the letter.** Copy tables, component palette, state variants, DoD checklists.
2. **`no-raw-hex.test.ts` green.** Every color is a `--lc-*` token.
3. **RTL verified on at least 5 core screens** (login, dashboard route, listings route, inbox route, settings route) beyond just component-level RTL renders.
4. **Cross-tab BroadcastChannel wired for tenant / locale / env changes.**
5. **PA env switcher LIVE-bound flow REQUIRES confirmation dialog + type-to-confirm exact match.** Cannot bypass.
6. **Bottom tab bar hides when soft keyboard is visible** — verified on real device (or emulated `visualViewport`).
7. **Every popover / dialog / sheet has a focus trap and Escape-to-close.**
8. **Fast + Real-Postgres CI green.**
9. **No new backend billing / financial routes.** Only the auth / env / search / notification routes listed above.
10. **PR body must include screenshots** of at least 10 state variants across the three personas + a link to a Vercel preview of the login refactor.

---

## 4. Scope — branding-cleanup PR (separate, small)

**Ships in parallel with the nav-chrome PR. Do NOT bundle them.** Nav-chrome touches ~30 new files + shell integrations; branding cleanup touches ~42 files with tiny changes each. Separate PRs make review sane.

### 4.1 The `usePageTitle` default fix

- Edit `web/src/lib/usePageTitle.ts:3` — change default suffix from `'Real Estate Bazaar'` to `'WingCaster'`.
- Audit every one of the 41 caller sites (grep `usePageTitle` in `web/src`) — verify none pass an explicit `'Real Estate Bazaar'` suffix. If any do, remove that argument or fix it.

### 4.2 Delete `web/rebrand.py`

Dead script. References `C:\Users\AliAchkar\Documents\kimi\workspace\souq-ajjar-realestate` — an external path unrelated to WingCaster. Confirmed prior-codebase artifact.

### 4.3 Legacy `web/docs/*.md` — mark or delete

These are labeled "Souq Ajjar / Real Estate Bazaar" — prior-project design documents, not WingCaster architecture:
- `web/docs/design-architecture-audit.md`
- `web/docs/design-architecture-decisions.md`
- `web/docs/feature-capability-audit.md`
- `web/docs/marketplace-domain-model.md`
- `web/docs/tickets/029-attribution-and-listing-identity.md`
- `web/docs/tickets/029b-listing-hrid-and-pki.md`
- `web/docs/tickets/029b-phase2-actions.md`
- `web/docs/tickets/029c-locality-code-scheme.md`

**Decision:** delete them. They pre-date WingCaster's architecture and are actively confusing. If any information in them is still relevant, extract it into a new `docs/design/*.md` under WingCaster's canonical docs directory first (unlikely — the WingCaster architecture is already documented in the four SCREEN_MATRIX files + BROADCAST_ALIGNMENT_REFERENCE).

### 4.4 Grep + cleanup

Grep for any remaining "Real Estate Bazaar" / "Souq Ajjar" / "Find Iqar" / "@findiqar" / "realestatebazaar" strings in `web/src` (excluding the SCREEN_MATRIX docs which correctly mention Bazaar as WingCaster's separate consumer product). Where found in user-facing code, replace with "WingCaster" or delete. Cite each change in the PR body.

### 4.5 PR body content

- Grep summary (before / after counts).
- List of files touched.
- Note that this does NOT change any product behavior — only branding + dead-code cleanup.

---

## 5. Definition of done

**Nav-chrome PR:**
1. All 16 new nav components + 3 app shells + 6 hooks + broadcast lib + font preload land.
2. Login refactor per SHR-AUT-001 brief lands.
3. Every backend endpoint listed in §3.7 verified or added.
4. `no-raw-hex.test.ts` + fast + integration + a11y + real-Postgres CI green.
5. Vercel preview attached, with screenshots of 10+ state variants across 3 personas in PR body.
6. Cross-tab BroadcastChannel verified working across 2+ tabs.
7. PA env switcher LIVE-bound flow verified requiring exact type-to-confirm.
8. Mobile bottom tab bar verified hiding on soft-keyboard.
9. RTL verified on login + at least 5 additional core routes.

**Branding-cleanup PR:**
1. `usePageTitle.ts` default suffix fixed.
2. All 41 callers audited.
3. `web/rebrand.py` deleted.
4. Legacy `web/docs/*.md` deleted.
5. Grep for remaining leaked strings clean.
6. Fast CI green (no visual regressions expected).

---

## 6. Follow-ups (do NOT include in this PR pair)

- **Wave 1 (WF-02 join-agency cluster)** — separate Cursor dispatch, depends on Wave 0 shell landing.
- **`AGT-ACT-*` activation wizard** — Wave 4 add-on per Rev 8, separate briefs still to author.
- **Notification-history screen** (`/notifications` route) — Phase 2. Wave 0 ships the popover only.
- **User-preferences screen** (`/settings/preferences`) — Phase 2 (Wave 4 in current sequencing). User-menu popover links to it but the screen itself is Phase-2 scope from Rev 8.
- **Search backend per-persona scoping enforcement** — verify server-side but treat as security prerequisite; do not build a permission-audit tool here.
- **[BE-BLOCKER-04] `conversations.source_channel` decomposition** — Week 4 slot, does NOT block Wave 0.
- **[BE-DESIGN-01] dynamic portal registry** — Week 2 slot, does NOT block Wave 0.

---

## 7. Out of scope

- Any change to backend billing / financial / credit / package / subscription code.
- Any Agent / Agency / PA business-logic screen. Wave 0 is chrome only + login.
- Real Arabic content for MDX / marketing site. That workstream is separate.
- Real testimonials / logos on marketing surfaces.
- Notification-history screen at `/notifications`.
- User-preferences screen at `/settings/preferences`.
- Dynamic portal registry (Week 2).
- `source_channel` decomposition (Week 4).
- MFA operational flows (Week 4).
- Settings shell (Week 4).
- Any AGT / AGN / PA data screen. All those are later waves per §6.
