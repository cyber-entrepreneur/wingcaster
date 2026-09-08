# Screen Brief — PA-NAV-001 · Environment switcher (LIVE ↔ TEST)

**Layer-2 Brief for design AI consumption (v0 by Vercel — locked per D-S-03).**

Companion to `SCREEN_MATRIX_PA.md` entry `PA-NAV-001`. Global environment switcher for the PA persona only. LIVE / TEST context propagates to every PA financial route via server GUC.

---

## 🎨 Broadcast alignment

**Inherits `BROADCAST_ALIGNMENT_REFERENCE.md`.** Semantic `--lc-*` tokens only. No raw hex.

**Screen-specific callouts:**
- Badge in top bar (idle): `--lc-status-success` fill + white ink when LIVE; `--lc-status-warning` fill + `--lc-status-warning-text` ink when TEST. Corner radius `--lc-radius-sm`. Padding 4×10px. Font `var(--lc-type-caption)` weight 600.
- Badge on hover: darkens (`--lc-status-success-hover` / `--lc-status-warning-hover`).
- Popover: `--lc-surface-elevated`, `--lc-shadow-md`, `--lc-radius-md`.
- Option row (idle): `--lc-text` ink.
- Option row (active): subtle `--lc-action-primary-subtle` background + check icon in `--lc-status-success`.
- Confirmation dialog surface: `--lc-surface-elevated`.
- Confirmation dialog LIVE-warning banner: `--lc-status-warning-subtle` fill + `--lc-status-warning-text` ink + `AlertTriangle` icon in `--lc-status-warning`.
- Persistent-warning strip (across every page when in TEST): `--lc-status-warning` fill + white ink, full-width, 24px tall, sticky under the top bar.

---

## Meta

| | |
|---|---|
| Screen ID | PA-NAV-001 |
| Screen name | Environment switcher (LIVE ↔ TEST) |
| Persona | PA (platform admin) only — NEVER shown to agents or agency admins |
| Device targets | Desktop 1440px (primary), tablet 1024px+ (secondary). PA is desktop-only per D6. |
| Locale | English + Arabic (RTL) — Arabic for PA is rare but supported |
| Theme | Light + Dark |
| Route | Not a route — a component embedded in `SHR-NAV-001` top bar for PA persona only |
| Current state | MISSING as UI. Backend GUC exists (env context is set server-side per PA request). Verified. |

---

## Purpose (one sentence)

Give a PA a first-class, always-visible, deliberately-friction-guarded way to switch the entire admin context between LIVE (real customer data, real Paddle merchant) and TEST (sandbox data, sandbox Paddle merchant) — with a mandatory confirmation step on LIVE-bound switches to prevent accidents on production.

---

## Product context the AI needs

- **PA operates on financial data.** Grants, credits, refunds, dunning cases, invoices, package publishing — every action has monetary + audit consequences.
- **Wingcaster has a first-class TEST environment** (mirroring PA-facing routes with sandbox data + sandbox Paddle merchant credentials). PA regularly rehearses actions in TEST before executing in LIVE.
- **LIVE-to-TEST-to-LIVE cycles are frequent** during release cycles — feature ships to TEST, PA validates, then executes in LIVE.
- **Cross-env action leakage is unacceptable.** A grant executed in TEST must never touch LIVE data. The switcher is the single-source-of-truth binding: while `env=LIVE`, all PA API calls carry `X-Wingcaster-Env: live` header + server verifies against session; same for TEST.
- **The badge is ALWAYS visible.** Not a hidden menu item. PA at all times knows which environment they're in — no ambiguity ever.
- **In TEST mode, a persistent warning strip runs across every PA screen.** Full-width, sticky under top bar. This is intentional friction — TEST work should feel visually different, even if PA has been in TEST for hours.
- **In LIVE mode, no warning strip.** The badge is enough.

---

## Layout — badge (in top bar, always visible)

Positioned immediately after the WingCaster wordmark in the top bar. 24px tall, auto-width (padding sized to content).

- **LIVE state:** `LIVE` label + `Radio` (or `Circle` dot) icon on the logical-start side.
- **TEST state:** `TEST` label + `TestTube` (or `AlertTriangle`) icon.
- Click: opens the switcher popover.
- Cursor: pointer.

## Layout — popover (open state)

Anchored below the badge. Width 320px. Two option rows + a note.

**Row 1: LIVE**
- Left: `Radio` icon in `--lc-status-success`.
- Middle: "LIVE" (weight 600) + "Production data + real Paddle merchant" (`var(--lc-type-caption)`, `--lc-text-muted`).
- Right: `Check` icon in `--lc-status-success` when active.

**Row 2: TEST**
- Left: `TestTube` icon in `--lc-status-warning`.
- Middle: "TEST" (weight 600) + "Sandbox data + sandbox Paddle merchant" (`var(--lc-type-caption)`, `--lc-text-muted`).
- Right: `Check` icon when active.

Footer note (below rows): "Env changes reload the current page. Confirm on LIVE-bound switches." (`var(--lc-type-caption)`, `--lc-text-muted`.)

---

## Layout — persistent TEST warning strip (top of every PA page while in TEST)

- Full width, sticky under `SHR-NAV-001` top bar.
- Height: 24px.
- Fill: `--lc-status-warning`. Ink: white/`--lc-status-warning-text`.
- Content, centered: `AlertTriangle` icon + "You are in TEST environment. Actions here do not affect production." + `Switch to LIVE →` link on the far end.
- Does NOT scroll. Sticks below top bar until env switches.

## Layout — LIVE-bound confirmation dialog

Modal, centered. 480px wide.

- Header: "Switch to LIVE?" with `AlertTriangle` icon in `--lc-status-warning`.
- Body:
  - Warning banner: "You're about to switch the admin console to LIVE. Any actions you take will affect real customers, real payments, and real audit records."
  - Checklist (checkboxes required for the CTA to enable):
    - `[ ]` I understand this switches the entire session context.
    - `[ ]` I understand any subsequent action affects production data.
  - Type-to-confirm input: user must type the literal string `SWITCH TO LIVE` (case-sensitive) to enable the CTA.
- Footer buttons:
  - `Cancel` (secondary).
  - `Switch to LIVE` (primary, disabled until both checkboxes checked AND type-to-confirm matches exactly).
- Escape / backdrop click: closes without switching.

## Layout — TEST-bound switch

- No confirmation dialog. Instant switch on option click.
- Toast on completion: "Switched to TEST environment."

## Layout — RTL variant

- Badge stays in the top bar; wordmark and badge move to the right side.
- Popover anchors below badge on the logical-start (right) side.
- Warning strip icon flips to the right; "Switch to LIVE" link migrates to the left.
- Confirmation dialog: checkboxes align to the right; type-to-confirm input is still Latin characters (the confirmation string does not translate — it's a literal safety token).

---

## Explicit copy (all strings, EN + AR)

| Key | EN | AR |
|---|---|---|
| `badge.live` | LIVE | مباشر |
| `badge.test` | TEST | اختبار |
| `popover.row.live.label` | LIVE | مباشر |
| `popover.row.live.desc` | Production data + real Paddle merchant | بيانات الإنتاج + تاجر Paddle حقيقي |
| `popover.row.test.label` | TEST | اختبار |
| `popover.row.test.desc` | Sandbox data + sandbox Paddle merchant | بيانات وضع الاختبار + تاجر Paddle للاختبار |
| `popover.footer.note` | Env changes reload the current page. Confirm on LIVE-bound switches. | تغيير البيئة يعيد تحميل الصفحة. تأكيد مطلوب للتبديل إلى المباشر. |
| `strip.warning.text` | You are in TEST environment. Actions here do not affect production. | أنت في بيئة الاختبار. الإجراءات هنا لا تؤثر على الإنتاج. |
| `strip.warning.link` | Switch to LIVE → | التبديل إلى المباشر ← |
| `confirm.title` | Switch to LIVE? | التبديل إلى المباشر؟ |
| `confirm.body` | You're about to switch the admin console to LIVE. Any actions you take will affect real customers, real payments, and real audit records. | أنت على وشك تبديل وحدة الإدارة إلى بيئة الإنتاج. أي إجراء تقوم به سيؤثر على عملاء حقيقيين ومدفوعات حقيقية وسجلات تدقيق حقيقية. |
| `confirm.check1` | I understand this switches the entire session context. | أدرك أن هذا يبدّل سياق الجلسة بالكامل. |
| `confirm.check2` | I understand any subsequent action affects production data. | أدرك أن أي إجراء لاحق يؤثر على بيانات الإنتاج. |
| `confirm.type.label` | Type SWITCH TO LIVE to confirm. | اكتب SWITCH TO LIVE للتأكيد. |
| `confirm.type.value` | SWITCH TO LIVE | SWITCH TO LIVE |
| `confirm.cancel` | Cancel | إلغاء |
| `confirm.cta` | Switch to LIVE | التبديل إلى المباشر |
| `toast.switched.live` | Switched to LIVE environment. | تم التبديل إلى بيئة المباشر. |
| `toast.switched.test` | Switched to TEST environment. | تم التبديل إلى بيئة الاختبار. |
| `error.switchFailed` | Couldn't switch environments. Try again. | تعذّر تبديل البيئات. حاول مرة أخرى. |

Copy voice: direct, careful, no exclamation marks. Confirmation copy is deliberately heavy — it exists to slow down an accident. The literal safety-token string `SWITCH TO LIVE` never translates.

---

## Component palette

- Custom: `<EnvBadge>` + `<EnvSwitcherPopover>` + `<EnvWarningStrip>` + `<EnvSwitchConfirmDialog>` — new components under `web/src/components/nav/`.
- `<Popover>` (Radix) for the switcher.
- `<Dialog>` (Radix) for the confirmation.
- `<Input>` for the type-to-confirm.
- `<Checkbox>` for the confirmation checklist.

Icons from `lucide-react`: `Radio`, `TestTube`, `Check`, `AlertTriangle`.

---

## Sample content for the AI to render against

**State 1 — Badge in LIVE state (light theme)**
- Green badge "LIVE" in top bar.

**State 2 — Badge in TEST state (light theme)**
- Amber badge "TEST" in top bar.
- Persistent warning strip visible full-width below top bar.

**State 3 — Popover open, LIVE currently active**
- LIVE row: check icon on right, subtle background tint.
- TEST row: idle.

**State 4 — Popover open, TEST currently active**

**State 5 — LIVE-bound confirmation dialog, checkboxes unchecked, CTA disabled**

**State 6 — LIVE-bound confirmation dialog, both checkboxes checked, type-to-confirm filled with `SWITCH TO LIVE`, CTA enabled**

**State 7 — Mid-switch overlay** — full-page `--lc-scrim` with a small centered spinner + "Switching…" text. ≤500ms.

**State 8 — Switch-failed toast** — "Couldn't switch environments. Try again."

**State 9 — Dark mode, LIVE badge**

**State 10 — RTL Arabic, TEST badge, warning strip in Arabic**

At least 10 renders.

---

## Interactions

- **Badge click** — opens popover.
- **Popover row click (LIVE → TEST or TEST → LIVE)** —
  - **TEST-bound switch:** fires `POST /api/admin/env/switch` with `{ target: 'test' }`; server sets session env; page reloads (or React Query invalidates all admin queries + refetches — reload is safer for first version); toast on completion.
  - **LIVE-bound switch:** opens the confirmation dialog. No API call yet.
- **Confirmation dialog CTA click** — fires `POST /api/admin/env/switch` with `{ target: 'live' }`; on success, dialog closes + page reloads + toast; on failure, dialog stays open + error banner appears.
- **Type-to-confirm** — case-sensitive exact match of `SWITCH TO LIVE`. Any mismatch keeps CTA disabled.
- **Escape / backdrop** — closes popover or dialog without switching.
- **Cross-tab sync** — a switch in one tab broadcasts via `BroadcastChannel('wingcaster-session')`; other PA tabs receive and reload themselves.
- **Failure to switch** — session env stays where it was; toast informs. No partial state.
- **Persistent warning strip link click** ("Switch to LIVE") — triggers the LIVE-bound switch confirmation dialog directly.
- **Reduced motion** — no popover slide; instant fade.

---

## State variants to render

At least 10 per §Sample Content.

---

## Accessibility (WCAG 2.1 AA)

- Badge is a button: `role="button"`, `aria-haspopup="dialog"`, `aria-label` per state (e.g. "Environment: LIVE. Click to switch.").
- Popover options: `role="radiogroup"` + `aria-checked` per row.
- Confirmation dialog: `role="alertdialog"`, focus trap, Escape closes (unless mid-switch API call).
- Warning strip: `role="status"` + `aria-live="polite"` on mount, so screen readers announce "You are in TEST environment" once.
- Type-to-confirm input: has visible label above ("Type SWITCH TO LIVE to confirm"), not placeholder-only.
- Color-only distinction forbidden: LIVE badge has an icon (Radio) + label; TEST badge has a different icon (TestTube) + label.
- Focus rings visible.
- Reduced-motion respected.

---

## Anti-patterns — do NOT do

- Do NOT allow LIVE-bound switches without the confirmation dialog. Ever.
- Do NOT skip the type-to-confirm safety token. Checkboxes alone are not enough friction.
- Do NOT hide the badge on any PA screen. It's always visible.
- Do NOT hide the warning strip on any PA screen while in TEST.
- Do NOT show this component for any non-PA persona.
- Do NOT allow the confirmation dialog CTA to enable while ANY checkbox is unchecked OR the type-to-confirm doesn't match exactly.
- Do NOT translate the safety token `SWITCH TO LIVE`. It's a literal string.
- Do NOT let the badge become subtle or muted. It must be assertively visible at all times.
- Do NOT show a confirmation for TEST-bound switches. TEST is safe.
- Do NOT put the env switcher inside a hamburger menu or under a "settings" section. It's chrome.
- Do NOT allow the user to keep the confirmation dialog open indefinitely if the session env has changed under them (e.g., from another tab). Detect and close with a "Session env changed elsewhere; refresh to continue" message.
- Do NOT allow keyboard shortcuts to bypass the confirmation dialog.

---

## Reference designs

- **Stripe dashboard mode switcher** (Test data ↔ Live data) — the primary anchor. Badge shape + confirmation pattern.
- **Paddle dashboard sandbox switcher** — MENA-adjacent pattern.
- **Vercel deployment environment badge** — badge geometry.

Do NOT anchor on: AWS console (regional dropdown is a different concept), Datadog (env selector is a filter, not a session context).

---

## Handoff instruction to v0

> Produce this component at desktop 1440px, in English (LTR) and Arabic (RTL), in light and dark themes. Render all 10 state variants per the list above. Use Radix Popover + Dialog primitives. Follow the copy table exactly — the safety token `SWITCH TO LIVE` never translates. Render enough of the surrounding top bar to show the badge in context. Render the warning strip full-width across a placeholder PA page.

---

## Downstream implementation notes (for Cursor Code, Wave 0 dispatch)

- New files:
  - `web/src/components/nav/EnvBadge.tsx`
  - `web/src/components/nav/EnvSwitcherPopover.tsx`
  - `web/src/components/nav/EnvWarningStrip.tsx`
  - `web/src/components/nav/EnvSwitchConfirmDialog.tsx`
- Embed:
  - Badge: in `TopBar.tsx` for PA persona only.
  - Warning strip: in `PaAppShell.tsx` between `<TopBar>` and `<Outlet />`, conditional on `env === 'test'`.
- State:
  - Session env source: `useSession()` → `session.environment ∈ {'live', 'test'}`. Backend GUC-derived.
- Backend routes (verify existence; add if missing):
  - `POST /api/admin/env/switch` body `{ target: 'live' | 'test' }` — server verifies caller is PA + updates session; returns fresh session.
- Persistence: session-based (server-side). Not localStorage.
- Cross-tab: `BroadcastChannel('wingcaster-session')` fires an `env-changed` message; other PA tabs listen and reload.
- Every PA-facing API client method automatically passes `X-Wingcaster-Env: <env>` header derived from session env. Verify existing axios/fetch client already does this; if not, add.
- Page reload on switch: for v1, use `window.location.reload()`. Later optimization: React Query invalidate + refetch instead.

## Test discipline

- **Unit tests:** badge renders correct label + color per env, popover opens on click, TEST-bound switch triggers API call directly, LIVE-bound switch opens confirmation dialog.
- **Confirmation dialog tests:** checkboxes gate CTA correctly, type-to-confirm requires exact match, Escape closes without switching.
- **Integration tests:** switch API call updates session, cross-tab broadcast received, page reloads on completion.
- **A11y tests:** keyboard nav works, screen reader announces env state, focus trap in dialog.
- **Visual tests:** all 10 variants captured.

## Definition of done

1. Badge renders in top bar for PA persona only.
2. Popover opens on badge click.
3. TEST-bound switch works instantly.
4. LIVE-bound switch requires confirmation dialog with type-to-confirm.
5. Warning strip renders on every PA page while in TEST.
6. Cross-tab sync verified.
7. RTL + dark mode verified.
8. Zero raw hex.
9. Storybook entries for all state variants.
