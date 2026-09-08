# Screen Brief — SHR-NAV-006 · Language selector

**Layer-2 Brief for design AI consumption (v0 by Vercel — locked per D-S-03).**

Companion to `SCREEN_MATRIX_SHARED.md` entry `SHR-NAV-006`. The global EN ↔ AR toggle. Without this component, Arabic RTL is unreachable — MENA launch blocker.

---

## 🎨 Broadcast alignment

**Inherits `BROADCAST_ALIGNMENT_REFERENCE.md`.** Semantic `--lc-*` tokens only. No raw hex.

**Screen-specific callouts:**
- Segmented-control shell: `--lc-surface-inset` fill, `--lc-border` outline. Corner radius: `--lc-radius-full` (pill).
- Active pill: `--lc-surface-elevated` fill, `--lc-shadow-sm` shadow, `--lc-text` ink. Weight 600.
- Idle pill: transparent fill, `--lc-text-muted` ink. Weight 500.
- Hover on idle pill: `--lc-surface-hover` fill.
- Focus ring: two-tone from base CSS.
- Selector typography: `var(--lc-type-body)` — Inter 500 14/20 for EN; `IBM Plex Sans Arabic` 500 14/20 for AR label.
- Motion: 180ms cubic-bezier(0.32, 0.72, 0, 1) on the active-pill slide.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-NAV-006 |
| Screen name | Language selector |
| Persona | Every user + anonymous |
| Device targets | Mobile 375px, tablet 768px, desktop 1440px |
| Locale | English + Arabic — this component IS the toggle |
| Theme | Light + Dark |
| Route | Not a route — a component embedded in `SHR-NAV-001` (top bar) authed, and in `SHR-AUT-001`/`SHR-AUT-006` header for anonymous |
| Current state | MISSING — verified: grep on `LanguageSelector\|LanguageToggle\|switchLanguage\|setLanguage\|setLocale` in `web/src` returns only `TemplateSettingsForm.tsx` (template-editor form control, not app-wide selector). i18n infrastructure exists in ~6 files; the UI selector does not. |

---

## Purpose (one sentence)

Give any user — anonymous or signed-in — a two-tap way to flip the entire app between English (LTR) and Arabic (RTL), with the choice persisted across sessions, devices (once signed in), and page loads.

---

## Product context the AI needs

- **MENA is Wingcaster's primary market.** UAE / KSA / Egypt / Lebanon — all Arabic-first territories. A signed-in Egyptian agent needs the app in Arabic; an English-speaking Dubai broker needs it in English. Neither should ever see a language they can't read.
- **RTL is a full-layout flip.** Not just text — the whole interface mirrors. `<html dir="rtl">` flips CSS logical properties across every component. This selector is what triggers it.
- **Persistence rules are opinionated:**
  - Anonymous: `localStorage['wingcaster.locale']` (survives page refresh, cleared with browser storage).
  - Signed-in: server-side `users.preferred_locale` (survives sign-out/sign-in on any device).
  - First-visit heuristic: browser `navigator.language` prefix → `ar-*` → Arabic; anything else → English.
- **The selector appears in three places:**
  - `SHR-NAV-001` top bar (authed).
  - `SHR-AUT-001` login header (anon).
  - `SHR-AUT-006` register wizard header (anon).
- **Segmented-control shape** (not a dropdown, not a toggle switch). Two visible pills side-by-side, one active — the fastest possible interaction at MENA agents' tap-speed on a bumpy taxi ride.
- **Arabic label rendering:** `العربية` in IBM Plex Sans Arabic (not the Latin-only stack fallback). Loading the font before the selector renders prevents a Latin-glyph flash.

---

## Layout — desktop ≥1024px

Segmented control, 32px tall, 88px wide. Two equal-width pills: `EN` and `العربية`.

- Placement in top bar: logical-end (right in LTR, left in RTL) side, immediately before the user-menu avatar.
- Active pill visually elevated (subtle shadow + surface elevation).
- Pill inner padding: 8px horizontal, 6px vertical.
- Between-pill gap: 2px (single-pill-appearance shell with the active pill floating inside).

## Layout — tablet 768px

Same as desktop.

## Layout — mobile 375px

- Same segmented control, unchanged dimensions. Compact enough to sit next to the tenant switcher in `SHR-NAV-001` without collision.
- If both the tenant switcher AND language selector don't fit on the top bar, the language selector migrates to `SHR-NAV-002` side drawer (see Interactions §mobile-collapse-rule).

## Layout — anonymous (SHR-AUT-001, SHR-AUT-006)

- Placement: top-right corner of the header strip, above the brand hero.
- Same segmented control, same dimensions.
- Font-loading priority: bump the Arabic font's `<link rel="preload">` above the LCP image so the Arabic label renders in the correct typeface immediately.

### RTL variant
- The whole segmented control mirrors position on the top bar (moves to the logical-start / right side).
- Pill order stays: `EN` still on the left inside the control, `العربية` on the right — pill order does NOT flip when the app is in Arabic, so users always know which pill activates which language.
- Active pill correctly rendered on the right (`العربية`).

---

## Explicit copy (all strings, EN + AR)

| Key | EN | AR |
|---|---|---|
| `label.en` | EN | EN |
| `label.ar` | العربية | العربية |
| `aria.control` | Language | اللغة |
| `aria.selected.en` | English selected | تم اختيار الإنجليزية |
| `aria.selected.ar` | Arabic selected | تم اختيار العربية |
| `announce.switched.en` | Language changed to English. | تم تغيير اللغة إلى الإنجليزية. |
| `announce.switched.ar` | Language changed to Arabic. | تم تغيير اللغة إلى العربية. |
| `error.switchFailed` | Couldn't save your language preference. Try again. | تعذّر حفظ تفضيل اللغة. يرجى المحاولة مرة أخرى. |

Copy voice: labels are the language names themselves — English speakers see `EN`, Arabic speakers see `العربية`. Both pills always show BOTH labels so a person who can't read one language can still find the other.

**Critical: labels never translate.** The `EN` pill always reads "EN" regardless of active language. The `العربية` pill always reads "العربية" regardless of active language. This is the standard cross-cultural switcher pattern.

---

## Component palette

- Custom: `<LanguageSelector>` — new component under `web/src/components/nav/`. Wraps a Radix `<ToggleGroup>` primitive with the segmented-control skin.
- `<VisuallyHidden>` from `@radix-ui/react-visually-hidden` for the ARIA label.

No icons.

Fonts:
- Latin: system stack via existing base CSS.
- Arabic: `IBM Plex Sans Arabic` — must be pre-loaded via `<link rel="preload" as="font" crossorigin>` in `web/index.html`.

---

## Sample content for the AI to render against

**State 1 — English active, LTR context, light mode**
- `EN` pill: elevated + weight-600 ink.
- `العربية` pill: muted, transparent.

**State 2 — Arabic active, RTL context, light mode**
- Selector rendered at logical-start of top bar (which reads right in RTL).
- `العربية` pill: elevated + weight-600, correctly rendered in IBM Plex Sans Arabic.
- `EN` pill: muted.

**State 3 — English active, dark mode**
**State 4 — Arabic active, dark mode, RTL**
**State 5 — Hover on the inactive pill** (mouse hover, `--lc-surface-hover`)
**State 6 — Focus on the inactive pill** (keyboard focus, two-tone focus ring visible)
**State 7 — Mid-transition** (active-pill sliding, 90ms into the 180ms motion)
**State 8 — Failure toast** — segmented control + a toast below "Couldn't save your language preference."

---

## Interactions

- **Click on inactive pill** — instant swap: `<html dir>` and `<html lang>` update immediately; app re-renders in new locale; active-pill slides across the shell with 180ms cubic-bezier ease; persistence write (localStorage for anon, POST /api/users/me/locale for signed-in) fires in the background — non-blocking on the visual switch.
- **Keyboard: Tab → focus lands on the control; Space or Enter toggles.** ArrowLeft / ArrowRight cycles between pills (in LTR) — reversed in RTL.
- **Persistence failure** — visual switch already applied; toast informs "Couldn't save your language preference" with a Retry action. Preference stays in the current session but resets on next sign-in.
- **Cross-tab sync** — when a signed-in user changes locale in one tab, `BroadcastChannel('wingcaster-session')` fires; other open tabs receive it and re-render.
- **First-render heuristic** — before any user interaction, determine locale by: (1) `users.preferred_locale` if signed in; (2) `localStorage['wingcaster.locale']` if present; (3) `navigator.language.startsWith('ar')` → Arabic; (4) default English. No flash of wrong language.
- **Font loading** — Arabic font pre-loaded via `<link rel="preload">`. If font hasn't loaded yet when Arabic activates, use `IBM Plex Sans Arabic` with a system Arabic-fallback (`Tahoma, "Segoe UI", sans-serif`) to prevent tofu boxes.
- **Reduced motion** — respect `prefers-reduced-motion: reduce`: skip the active-pill slide; snap directly.

### Mobile-collapse rule
If `SHR-NAV-001` top bar cannot fit both the tenant switcher AND the language selector at 320px viewport, the language selector moves into `SHR-NAV-002` side drawer as the first item under a "Language" section header. Same segmented control component, just relocated. Detection: `useMediaQuery('(max-width: 359px)')`.

---

## State variants to render

1. Idle — EN active, LTR, light
2. Idle — AR active, RTL, light
3. Idle — EN active, LTR, dark
4. Idle — AR active, RTL, dark
5. Hover — inactive pill
6. Focus — inactive pill (keyboard focus)
7. Mid-transition (active-pill sliding)
8. Persistence failure toast
9. Mobile-collapsed variant — in `SHR-NAV-002` side drawer under "Language" header
10. Anonymous placement — in `SHR-AUT-001` header

At least 10 renders.

---

## Accessibility (WCAG 2.1 AA)

- Control has `role="radiogroup"` with `aria-label="Language"`.
- Each pill: `role="radio"`, `aria-checked` on active, `aria-label` per copy table.
- Tap targets ≥ 44×44 — the whole pill including padding meets this.
- Focus ring visible on keyboard nav.
- Screen reader announcement on switch: `aria-live="polite"` region emits the `announce.switched.*` string.
- Color is never the only indicator: elevated pill has BOTH different weight AND shadow — screen readers get `aria-checked`.
- Reduced motion respected.
- Font swap does not cause layout shift: `font-display: swap` disallowed for Arabic — use `optional` or preload to avoid CLS spikes on the switcher.
- **RTL flip announcement:** when locale changes, in addition to the toast, the app title in `document.title` updates so the screen-reader reads the new page title in the new language.

---

## Anti-patterns — do NOT do

- Do NOT translate the pill labels. `EN` never becomes "English"; `العربية` never becomes "Arabic".
- Do NOT use flag icons. Flags represent countries, not languages — inaccurate + politically fraught.
- Do NOT hide the selector behind a dropdown or "…" menu. Two visible pills is the fastest interaction.
- Do NOT put a confirmation modal before the switch. Locale change is reversible.
- Do NOT use a toggle switch (on/off metaphor). Neither language is "off."
- Do NOT auto-detect locale after first user interaction. Once the user picks a language, respect it forever.
- Do NOT flip the pill order in RTL. Pills stay left-to-right; the active pill just moves to the right when Arabic is chosen.
- Do NOT reload the page on switch. In-place re-render only.
- Do NOT block the visual switch on the persistence-API response. Fire it async, show a toast on failure.
- Do NOT show the switcher on the delete-account-confirmation screen or any destructive-action modal (avoid distraction).

---

## Reference designs

- **Airbnb footer language + currency picker** — segmented shape, pattern for "keep labels in their own language".
- **Duolingo language selector** — inline switching, no reload.
- **Booking.com language menu** — MENA-familiar, though they use a dropdown (do NOT copy that shape).
- **Notion workspace language toggle** — small segmented pattern.

Do NOT anchor on: Google Search (dropdown), Microsoft (long form), sites with flag icons.

---

## Handoff instruction to v0

> Produce this component at desktop 1440px, tablet 768px, and mobile 375px, in English (LTR) and Arabic (RTL), in light and dark themes. Render all 10 state variants per the list above. Use a Radix ToggleGroup or equivalent. Follow the copy table exactly — pill labels never translate. Do not design the surrounding top-bar chrome; render enough of it for context.

---

## Downstream implementation notes (for Cursor Code, Wave 0 dispatch)

- New file: `web/src/components/nav/LanguageSelector.tsx`.
- Locale store: verify existing i18n infra (client.ts + related). If a locale-management hook doesn't exist, create `web/src/hooks/useLocale.ts` — reads `users.preferred_locale`, syncs `<html lang>` + `<html dir>`, fires `BroadcastChannel`.
- Backend: verify or add `PATCH /api/users/me` with a `preferred_locale` field. Schema: enum ('en', 'ar'), stored on `users` row.
- localStorage key: `'wingcaster.locale'`.
- BroadcastChannel key: `'wingcaster-session'` (shared with tenant switcher).
- Preload font: add to `web/index.html`:
  ```html
  <link rel="preload" href="/fonts/ibm-plex-sans-arabic-500.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/ibm-plex-sans-arabic-600.woff2" as="font" type="font/woff2" crossorigin>
  ```
- CSS: set `html[dir="rtl"] { direction: rtl; }` at the root; every component uses logical properties (`padding-inline-start` not `padding-left`).
- Confirm every existing screen renders correctly under `dir="rtl"` — this is a full-app change; expect a few components to need logical-property fixes as they surface during QA.

## Test discipline

- **Unit tests:** clicking swaps pill state, `<html lang>`/`<html dir>` updated, `BroadcastChannel` fires, localStorage / API call fires (mocked).
- **Integration tests:** navigate through the app in Arabic, verify at least 5 key screens render RTL correctly (Dashboard, Listings, Inbox, Contacts, Settings).
- **A11y tests:** keyboard nav (Tab, Enter, Space, Arrow keys), screen reader announces via `aria-live`, focus ring visible.
- **Visual tests:** all 10 variants captured.

## Definition of done

1. Selector renders in `SHR-NAV-001` top bar for authed users.
2. Selector renders in `SHR-AUT-001` + `SHR-AUT-006` headers for anon users.
3. First-render heuristic works (server pref → localStorage → `navigator.language` → default EN).
4. Persistence works for both anon (localStorage) and signed-in (API).
5. Cross-tab sync works.
6. RTL flip verified across at least 5 core screens.
7. Zero raw hex.
8. Screen reader announces switch correctly.
9. Storybook entry per state variant.
