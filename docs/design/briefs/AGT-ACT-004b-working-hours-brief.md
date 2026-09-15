# Screen Brief — AGT-ACT-004b · Activation wizard — Working hours (delta)

**Layer-2 Brief for design AI consumption. DELTA on `AGT-ACT-001-activation-welcome-brief.md`.**

Companion to Step 4 on the AGT-ACT-001 welcome hub (`activation_state.steps[working_hours]`, `order: 4`). Wave-4 Phase-1 add-on.

> **ID note:** Matrix IDs AGT-ACT-001..005 map WhatsApp / first listing / **portal credentials** / invite team. Working hours is Step 4 in the hub but never received a matrix row. This brief uses **AGT-ACT-004b** so it does not collide with `AGT-ACT-004` (portal credentials). Route and step_id remain `working_hours`.

**Inherits everything from AGT-ACT-001.** Read that anchor first — Broadcast callouts, ACT-vs-ONB coexistence contract, progress-bar persistence, backend `activation_state` contract, anti-patterns, and DoD all apply verbatim. Deltas below.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ACT-004b |
| Screen name | Activation wizard — Working hours & response time |
| Route | `/activate/working-hours` |
| Backend prerequisites | ✅ `POST /api/agent/activation_state/complete` + defer · working-hours payload stored on step metadata (or agent notification prefs — same write path as dashboard settings if already shared) |
| Depends on | AGT-ACT-001 |
| Current state | SHIPPED in code (`ActivationWorkingHoursPage`) — brief was the documentation gap |
| Visibility | All activation personas (solo, agency-owner, agency-joining). Not persona-gated. |

---

## Purpose

Capture when the agent is available and how quickly leads should expect a first reply, so auto-responders and SLA chips never overpromise. Completing this step flips `working_hours` to `complete` and returns to the welcome hub (with `?celebrate=1` when this is the final remaining step).

---

## What this screen is (and is NOT)

**IS:** a focused form — weekday window, weekend window, typical first-reply minutes — with mark-complete and defer. Uses `<Numeric>` for minute values in captions/counters.

**IS NOT:** a full calendar / availability product. Recurring exceptions, PTO, and per-channel overrides live in Settings later. Do not build a weekly grid here.

---

## Layout deltas from AGT-ACT-001

Single-column, centered, max-width 640px.

**Zone 1 — Header + breadcrumb:** `Activation wizard → Step 4 · Set your working hours`.

**Zone 2 — Persistent progress bar:** same as other AGT-ACT sub-screens (`progressSize="sm"`).

**Zone 3 — Task intro:**
- H1: "Set your working hours & response time" — `var(--lc-type-heading-1)`, `--lc-text-heading`.
- Sub: "Tell leads when to expect a reply so auto-responders never overpromise." — `var(--lc-type-body-lg)`, `--lc-text-muted`.

**Zone 4 — Hours form** (not-started / in-progress only):
- 2×2 grid on ≥640px (`sm:grid-cols-2`), stacked on mobile:
  - Weekdays from — `<Input type="time">` (default `09:00`)
  - Weekdays until — `<Input type="time">` (default `18:00`)
  - Weekend from — `<Input type="time">` (default `10:00`)
  - Weekend until — `<Input type="time">` (default `14:00`)
- Response row: "Typical first-reply time (minutes)" — `<Input type="number" inputMode="numeric" min={1} max={240}>` (default `15`). Display any echoed numeric with `<Numeric>`.
- Every control meets the **44px tap floor** (`min-h-tap`).
- Labels use `<Label htmlFor=…>`; RTL uses logical spacing only (`ms-*` / `me-*` / `ps-*` / `pe-*`).

**Zone 5 — Footer actions:**
- Primary `<Button type="submit">` "Mark complete" (busy → "Saving…", disabled while saving).
- Secondary `<Button variant="ghost">` "I'll do this later" — POSTs defer, returns to `/activate` (no celebrate).

**Already-complete variant:** replace Zone 4–5 with:
- Caption: `Completed via {source} — {timestamp}. Nothing left to do here.` (`<Numeric>` on the timestamp fragment).
- Primary: "Return to activation wizard →".

**Loading skeleton:** pulse block inside `ActivationChrome` (same pattern as sibling steps).

---

## Explicit copy deltas

| Slot | Copy (EN) | Copy (AR) |
|---|---|---|
| Page title | Working hours | ساعات العمل |
| Breadcrumb | Set your working hours | حدّد ساعات عملك |
| H1 | Set your working hours & response time | حدّد ساعات عملك ووقت الرد |
| Sub | Tell leads when to expect a reply so auto-responders never overpromise. | أخبر العملاء متى يتوقعون ردًا حتى لا تُبالغ الردود التلقائية في الوعود. |
| Weekdays from | Weekdays from | أيام الأسبوع من |
| Weekdays until | Weekdays until | أيام الأسبوع حتى |
| Weekend from | Weekend from | عطلة نهاية الأسبوع من |
| Weekend until | Weekend until | عطلة نهاية الأسبوع حتى |
| Response label | Typical first-reply time (minutes) | وقت الرد الأول المعتاد (بالدقائق) |
| Primary CTA | Mark complete | تعليم كمكتمل |
| Primary busy | Saving… | جارٍ الحفظ… |
| Defer | I'll do this later | سأفعل هذا لاحقًا |
| Already-complete helper | Nothing left to do here. | لا شيء متبقٍ هنا. |
| Return | Return to activation wizard | العودة إلى معالج التفعيل |

All strings live in `web/src/pages/agent/activation/copy.ts` (`hours.*` + shared `common.*`) in LOGIN_COPY `{ en, ar }` shape; consume via `useLocale()`.

---

## State variants

| Variant | Condition | Render |
|---|---|---|
| **Loading** | `useActivationState().isLoading` or `state == null` | Chrome + pulse skeleton; progress `0/0`. |
| **Fresh / in progress** | `working_hours.state` ∈ `{not_started, in_progress, deferred}` | Full form with defaults (or last-saved metadata if present). |
| **Already complete** | `working_hours.state === "complete"` | Completed-via caption + return CTA only — no editable fields. |
| **Saving** | Submit in flight | Primary disabled, label "Saving…". |
| **Save error** | `complete()` rejects / non-OK | Destructive toast (EN+AR); stay on page; fields retain values. Do **not** navigate. |
| **Validation error** | `weekday_end ≤ weekday_start`, weekend inverted, or `response_minutes` out of 1–240 | Inline field error under the offending control; block submit. |
| **Empty / cleared fields** | User clears a time input | Native `required` or explicit inline "Required" — never submit empty windows. |
| **Defer success** | Ghost CTA clicked | POST defer → navigate `/activate`; hub card shows Skipped/deferred variant. |
| **Final-step celebrate** | Completing this step flips completedCount from `total-1` → `total` | Navigate `/activate?celebrate=1` so the hub fires the 4→5 banner. |
| **Offline / network** | fetch fails | Error toast; stay; allow retry. |

---

## PII posture

- **No PII on this screen.** Hours and response minutes are operational prefs, not identity.
- Do **not** echo agent name, email, phone, or license on this page.
- Audit: every successful `complete` / `defer` write must produce an audit-log row (same activation audit channel as sibling steps). No reveal/mask UI required here.
- If Settings later surfaces the same prefs next to profile fields, those fields use `<PIIMask>` — out of scope for this brief.

---

## Interactions (deltas)

**On mount:**
- `GET` activation state via `useActivationState()`.
- Focus the first time input (`weekday-start`) after load (brief §Interactions parity with welcome).

**On submit (mark complete):**
- POST `activation_state/complete` with:
  ```json
  {
    "step_id": "working_hours",
    "completed_via": "dashboard_action",
    "metadata": {
      "weekday_start": "09:00",
      "weekday_end": "18:00",
      "weekend_start": "10:00",
      "weekend_end": "14:00",
      "response_minutes": 15
    }
  }
  ```
- On success: navigate `/activate` or `/activate?celebrate=1` per final-step detector.
- On failure: toast + stay.

**On defer:**
- POST defer for `working_hours` → `/activate` (never celebrate).

**On already-complete return:**
- Navigate `/activate` without re-POSTing complete.

---

## Anti-patterns (deltas)

- ❌ Do not invent a weekly calendar grid or per-day exception editor on this screen.
- ❌ Do not navigate away on failed save (user must see the error and retry).
- ❌ Do not hardcode English — every string through `copy.ts` + `useLocale()`.
- ❌ Do not use physical `ml-*` / `mr-*` / `pl-*` / `pr-*` / `left-*` / `right-*`.
- ❌ Do not put JWT or PII in the URL when returning to `/activate`.
- ❌ Do not celebrate on defer or on mid-funnel complete (only when this completion is the 4→5 flip).

---

## Downstream implementation notes (deltas)

- **File:** `web/src/pages/agent/activation/ActivationWorkingHoursPage.tsx` — route `/activate/working-hours`.
- **Copy:** `hours.*` keys in `activation/copy.ts`.
- **Hook:** reuse `useActivationState()` (`complete`, `defer`, counters).
- **Chrome:** `ActivationChrome` with `breadcrumb.step = 4`.
- **Tests (required):**
  - Unit: form defaults, validation bounds, already-complete branch, celebrate when final step.
  - Integration: defer returns to `/activate`; failed complete stays + toast.
  - a11y: labeled inputs, 44px targets, axe smoke.
  - RTL: `?locale=ar` renders Arabic from copy table.
- All Broadcast + a11y + RTL + dark-mode requirements from AGT-ACT-001 apply verbatim.

---

## Definition of done (deltas)

- [x] Page + EN/AR copy shipped on `feat/wave-4a-act`.
- [x] Unit coverage for Working Hours (including final-step `celebrate=1`).
- [ ] This brief reviewed against live UI (full-read).
- [ ] v0 / design AI can regenerate every state variant from this delta alone.
- [ ] Cross-brief: hub Step 4 CTA deep-links here; completion returns to hub with correct celebrate semantics.
