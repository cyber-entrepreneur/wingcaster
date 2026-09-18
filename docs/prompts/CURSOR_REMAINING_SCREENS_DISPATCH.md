# WingCaster — Remaining Screens Build Dispatch (parallel builder)

**Hand this to the parallel coding agent (Cursor).** It builds the *pending* WingCaster screens to best-of-breed, enterprise-grade quality, hybrid (web + Capacitor iOS/Android), fully faithful to the existing wireframes/briefs and the Broadcast design system. A separate track (Claude / the human) owns **Paddle payments + the go-live product-gap punch list** — do not touch those (see §8 boundary).

Copy everything below the line into the agent as its standing brief.

---

## 0. Mission

Build the remaining WingCaster screens so a real MENA real-estate agent/agency can use them on day one. Every screen ships **full-stack, tested, token-clean, RTL-correct, mobile-first, and CI-green** — no MVP, no stubs, no "affordance only." Match the wireframes and the enterprise-grade UX bar (think Salesforce/HubSpot/Compass, not a bootstrap admin theme).

## 1. Sources of truth (read before building each screen, in this precedence)

1. **The per-screen brief** — `docs/design/briefs/<ID>-*.md` when one exists (richest: layout, components, Broadcast callouts, states, actions).
2. **The screen matrix entry** — `docs/design/SCREEN_MATRIX_{AGENT,AGENCY,PA,SHARED}.md`, the `### <ID> — <name>` block (purpose, route, persona, device, mode, key components, actions, states, entry/exit).
3. **The build/gap state** — `docs/design/SCREEN_GAP_RECONCILIATION.md` (git-truth BUILT/PARTIAL/MISSING) and `docs/design/GO_LIVE_CRITICAL_MANIFEST.md` (launch-blocker vs fast-follow; **avoid the punch-list items in §3 of that manifest — those are the other track's**).
4. **The design system** — `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md` and `C:\Users\AliAchkar\Desktop\Wingcaster Design Tokens\`.
5. **The code itself** — an existing built sibling screen is the best template. E.g. copy structure from `web/src/pages/agent/PortalSubmitPage.tsx`, `web/src/components/listings/OffersPanel.tsx`, `web/src/pages/agency/settings/AgencySecurityPolicyPage.tsx`.

If brief and matrix disagree, the brief wins; if either disagrees with shipped code patterns, follow the code patterns for *conventions* and the brief for *content/layout*.

## 2. What to build & how to pick the next screen

Work the **PARTIAL then MISSING** screens from `SCREEN_GAP_RECONCILIATION.md`, **excluding** anything the other track owns (§8). Prefer, in order: Agent daily-driver → Agency management → Shared → Platform-Admin. One screen (or one tight family) per PR. Before starting a screen, `grep`/glob the codebase to confirm it isn't already built (several "MISSING" verdicts are stale — verify against `web/src/pages/**` and routes first).

## 3. Definition of done (per screen — all required)

- **Route** wired in the relevant `routes.tsx` (or `App.tsx`), lazy-loaded like its siblings.
- **Page/component** under `web/src/pages/**` or `web/src/components/**` matching the brief's layout + states (loading / empty / error / the screen's own variants). No placeholder text left in.
- **Backend** when the screen needs data: migration + `table-mapper` entry + a `registerRoutes(app, { authMiddleware })` module + zod validation + ownership gating. (See §5.)
- **API client** methods + TypeScript types in `web/src/api/client.ts`.
- **Tests**: component test(s) (vitest + `@testing-library/react`, `// @vitest-environment jsdom`) and backend route tests (supertest + mocked db/authz). Cover the happy path + validation + the ownership 404.
- **Design**: Broadcast `--lc-*` tokens only, aliased Tailwind palettes only, `<Numeric>` for numbers, RTL correct, works at 375px and in the Capacitor shell.
- **Green**: `tsc --noEmit` clean, `no-raw-hex` hygiene test passes, all tests pass, CI green on the PR.

## 4. Design-system contract (the `no-raw-hex` gate enforces most of this)

- **Never** a raw hex literal (`#rrggbb`) in `.ts/.tsx/.css`. Use `var(--lc-*)` semantic tokens. (QR modules `#000/#fff` are the only exception; see the test.)
- **Never** a GitHub `#123` issue reference in a comment — the hygiene regex reads it as hex. Write "issue 123".
- **Only aliased Tailwind palettes**: slate, gray, zinc, red, rose, amber, yellow, green, emerald, purple, violet, indigo, blue, cyan, pink, orange. **Not** `sky`, `teal`, `lime`, `stone`, `neutral`, `fuchsia` — the gate fails on those.
- Every numeric value renders through the `<Numeric>`/`lc-data` treatment (IBM Plex Mono + tabular-nums).
- **RTL/Arabic is first-class**: logical properties (`ps-`/`pe-`/`start-`/`end-`), never left/right; test the screen with `dir="rtl"`.
- **Mobile-first + Capacitor**: 375px baseline, thumb-reachable actions, no horizontal scroll; anything touching device hardware branches through `web/src/lib/mobile/platform.ts` (`isNativePlatform`/`onPlatform`), never inline `Capacitor.*` in a page.

## 5. Backend conventions (Postgres-only DAL)

- **Persistence helpers** from `./db.js`: `findAll/findOne/insert/update/remove(collection, fn)` — the `collection` maps to a table via `backend/src/persistence/table-mapper.js` (add your table's columns there).
- **Migrations**: `backend/src/persistence/migrations/NNN_name.sql`, `CREATE TABLE IF NOT EXISTS`, `CHECK` constraints for enums, indexes for the hot queries. **Migration numbering is the #1 parallel-work hazard** — see §7.
- **Routes**: `export function registerRoutes(app, { authMiddleware })`, `zod` `.strict()` schemas, `assertOwnsProperty`/`assertOwnsContact`/etc. from `lib/authz.js` for ownership, and **leak-safe 404** (deny → 404 "not found", never 403 that reveals existence). Register in `server.js` next to the sibling `registerRoutes` calls.
- **Serialize** DB rows to a clean API shape (null-coalesce optional fields); never leak internal/private columns.

## 6. Testing & verification contract (run what CI runs — no shortcuts)

- **Typecheck** is a CI gate: `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit` in `web/` must exit 0. (`tsc` can segfault under low heap — the flag avoids it. Exit 139 ≠ type error.) **Do not** substitute `vite build` — it skips typecheck.
- **Never claim green from a local shortcut.** Run the actual test files and check the PR's CI with `gh pr checks`.
- **Lockfile discipline**: if you add a dependency, run `npm install` and commit the updated `package-lock.json` in the same PR. CI uses `npm ci`, which hard-fails on an out-of-sync lockfile and reds every parallel PR.
- Backend tests live beside the route (`*.test.js`, vitest + supertest, mock `../db.js` + `../lib/authz.js`). Frontend tests mock `@/api/client`, wrap in `ToastProvider` when the component toasts.

## 7. Git / PR protocol

- **Every PR targets `main`.** Never base a PR on another feature branch — squash-merge deletes the base and auto-closes the child.
- **One screen / tight family per PR**, small and reviewable.
- **Migration numbering**: before opening a PR that adds a migration, `git fetch origin main`, rebase, and set your migration to the **next free integer above the highest on main _and_ above any number claimed by an open PR**. If two open PRs grab the same number, the second to merge breaks. When in doubt, take a higher number and note it in the PR body. (This track: use **440+** to stay clear of the payments/gap track's 376–439 reservation.)
- End commits with `Co-Authored-By:` per the repo's attribution convention; PR body ends with the repo's generated-with line.
- After opening a PR, watch its CI (`gh pr checks <n>`) and fix red before asking for review. Rebase onto main if it drifts.

## 8. Coordination boundary — do NOT touch these (other track owns them)

- **All Paddle / payments**: checkout, `TopUpDialog`, subscription create/change/cancel/outcome, billing portal wiring, credits wallet top-up, `credits/`, `fin/` billing surfaces.
- **The go-live punch list** in `GO_LIVE_CRITICAL_MANIFEST.md` §3: AGT-SUB-004/005, AGN-CRD-003, AGN-SUB-003/004/005, PA-FIN-003, PA-CRD-002/006, PA-SUB-003/004/005/006, PA-INV-002/003, PA-PAY-001/002, PA-USR-001/002, SHR-LEG-003/004, AGT-LAI-001/002, AGT-OPP-002, AGN-MEM-004/009, AGN-CRD-005, AGN-INV-002, AGN-SET-003, PA-ARE-002.
- **Integrations** (portal adapters Bayut/PF/Dubizzle/etc., WhatsApp/IG/Messenger connectors) — partner-gated, owned elsewhere.
- **Migrations 376–439** are reserved for the other track. Use **440+**.

Everything else in the 340-screen catalog that is PARTIAL or MISSING is yours.

## 9. Anti-patterns (hard-won — do not repeat)

- Claiming "done"/"green" from `vite build` or from tests alone while `tsc`/CI is red.
- Editing `package.json` without committing the reconciled `package-lock.json`.
- Reusing a migration number another branch already claimed.
- Raw hex or a non-aliased palette (`sky`, etc.) — the hygiene gate will red the whole suite.
- Stubs, "Phase 2 later" placeholders, or an affordance with no wired action.
- Stacking a PR on a non-`main` base.
- Left/right instead of logical (RTL) properties.

---

*Dispatch generated for parallel screen development while the payments + product-gap track proceeds separately. Regenerate the exclusion list from `GO_LIVE_CRITICAL_MANIFEST.md` if the punch list changes.*
