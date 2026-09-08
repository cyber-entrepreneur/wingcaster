# Screen Brief — SHR-MFA-005 · Backup codes viewer — DELTA

**Delta brief.** Inherits from `SHR-MFA-001-2fa-settings-brief.md` (enrollment anchor) for layout + tokens. **P0 per kickoff §5 row 10** — a user without the ability to retrieve backup codes has broken 2FA UX. **Has a critical backend constraint:** codes are shown ONCE at enrollment (SHR-MFA-003) and there is NO endpoint to fetch them again. This screen therefore functions primarily as a REGENERATION surface, with a first-view mode for the post-enrollment save flow.

---

## 🎨 Broadcast alignment

**Inherits from `BROADCAST_ALIGNMENT_REFERENCE.md`.** Delta callouts only:

- Code grid cell: `--lc-surface-sunken` background, `--lc-border` 1px border, `var(--lc-radius-md)` corners, `var(--lc-font-mono)` + `tabular-nums` + `letter-spacing: 0.1em`, cell height 48px minimum.
- Warning banner ("One-time use — save these now"): `--lc-status-warning-bg` + `--lc-status-warning-fg` + `⚠` glyph.
- Destructive Regenerate CTA: `<Button variant="destructive">` — requires step-up (SHR-MFA-007) first.
- Copy All / Download / Print buttons: `<Button variant="outline">` in a horizontal row.

---

## Meta (delta only)

| | |
|---|---|
| Screen ID | SHR-MFA-005 |
| Screen name | Backup codes viewer & regenerate |
| Route | `/settings/2fa/backup-codes` (with optional `?first-view=1` query param for post-enrollment mandatory-save mode) |
| Current state | MISSING. Backend has NO `GET /api/auth/2fa/backup-codes` — see BE-VERIFY-MFA-01. |
| Backend prerequisites | ⚠ **PARTIAL**. `/api/auth/2fa/totp/verify` returns codes once at enrollment (auth-2fa.js line 400). No standing GET endpoint. Regenerate does NOT exist as a standalone endpoint — this brief flags it as `[BE-BLOCKER-MFA-01]`: needs `POST /api/auth/2fa/backup-codes/regenerate` that requires elevation and returns 10 fresh codes + invalidates old ones. |

---

## Purpose

Give a user a place to (a) save the codes they just received on enrollment (first-view mode), (b) see how many codes they have left, and (c) regenerate a fresh set of 10 codes (invalidating the old set) when needed. Because the backend cannot retrieve existing plaintext codes, standing (non-first-view) mode shows only the COUNT + a Regenerate CTA — NOT the codes themselves.

---

## Delta from anchor

**Two distinct modes.**

### Mode A: First-view (post-enrollment, mandatory save)

Reached from SHR-MFA-003 success via `/settings/2fa/backup-codes?first-view=1` with codes passed in router state (in-memory, never URL/localStorage).

**Layout:**

- Stepper: `1 Set up · 2 Verify · [3] Save codes` — step 3 active.
- H1: "Save your backup codes"
- Sub: "These 10 codes let you sign in if you lose your authenticator. Each one works only once. Save them somewhere safe now — you won't see them again."
- **Warning banner** at top: `--lc-status-warning-*` tint, `⚠` glyph, text: "You'll only see these codes once. Save them before continuing."
- **Code grid** — 2 columns × 5 rows on desktop; 1 column × 10 rows on mobile. Each cell is a monospace code (`XXXX-XXXX-XXXX` format).
- **Action row** — horizontal buttons: `Copy all` · `Download .txt` · `Print`. Each with a lucide icon (Copy / Download / Printer). On mobile: stacked full-width.
- **Confirmation checkbox** — `<Checkbox>` + label: "I've saved my backup codes somewhere safe." Required before Continue is enabled.
- **Continue CTA** — primary orange, "Done — back to two-factor settings". Enabled only when checkbox is ticked. Routes to SHR-MFA-001.

**Interactions (first-view):**

- Copy all: `navigator.clipboard.writeText(codes.join("\n"))`. Show "Copied ✓" for 1500ms + screen-reader announcement.
- Download: generate a `Blob` with contents `WingCaster two-factor backup codes\nGenerated: <ISO date>\nAccount: <email>\n\n<one code per line>` and trigger download as `wingcaster-backup-codes-<date>.txt`.
- Print: `window.print()`. A print stylesheet in `web/src/print.css` reformats the page to codes-only (hide chrome + nav + buttons).
- Navigation guard: if user tries to leave without ticking the checkbox, show a modal: "Leave without saving? You won't be able to see these codes again."

### Mode B: Standing view (from SHR-MFA-001 Manage link)

Reached from SHR-MFA-001 backup-codes-row Manage link at `/settings/2fa/backup-codes`.

**Layout:**

- Breadcrumb: `Settings › Two-factor authentication › Backup codes`
- H1: "Backup codes"
- Sub: "For security, WingCaster cannot show you the codes you already saved. To get a new set of 10, regenerate below — this replaces your old set."
- **Status card** — small `<Card>` with `--lc-surface-raised`: icon (`KeySquare`) + counter "You have {n} unused codes." rendered via `<Numeric>`. Warning tint when ≤ 2.
- **Regenerate section**:
  - Sub-heading: "Get a new set of codes"
  - Body: "Regenerating creates 10 fresh codes and invalidates all your current codes. Use this if you've lost your saved codes, or if you've used most of them."
  - Destructive CTA: "Regenerate backup codes" — triggers step-up (SHR-MFA-007) → then confirmation modal ("Yes, regenerate — this invalidates my current codes") → then POST to regenerate endpoint → transitions the page to Mode A first-view with the fresh codes.
- **Back link** — "← Back to two-factor settings" — routes to SHR-MFA-001.

**Copy delta:**

| Slot | Copy |
|---|---|
| Mode A stepper | Set up · Verify · **Save codes** |
| Mode A H1 | Save your backup codes |
| Mode A sub | These 10 codes let you sign in if you lose your authenticator. Each one works only once. Save them somewhere safe now — you won't see them again. |
| Mode A warning banner | ⚠ You'll only see these codes once. Save them before continuing. |
| Mode A copy button | Copy all |
| Mode A copy button (copied) | Copied ✓ |
| Mode A download button | Download .txt |
| Mode A print button | Print |
| Mode A confirmation checkbox | I've saved my backup codes somewhere safe. |
| Mode A continue CTA | Done — back to two-factor settings |
| Mode A leave-guard modal title | Leave without saving? |
| Mode A leave-guard modal body | You won't be able to see these codes again. WingCaster cannot show them a second time. |
| Mode A leave-guard confirm | Leave anyway |
| Mode A leave-guard cancel | Stay and save |
| Mode B breadcrumb | Settings › Two-factor authentication › Backup codes |
| Mode B H1 | Backup codes |
| Mode B sub | For security, WingCaster cannot show you the codes you already saved. To get a new set of 10, regenerate below — this replaces your old set. |
| Mode B counter | You have {n} unused codes. |
| Mode B counter low-warning | Only {n} codes left. Consider regenerating soon. |
| Mode B counter empty-warning | You have no unused codes left. Regenerate now to restore access. |
| Mode B regen sub-heading | Get a new set of codes |
| Mode B regen body | Regenerating creates 10 fresh codes and invalidates all your current codes. Use this if you've lost your saved codes, or if you've used most of them. |
| Mode B regen CTA | Regenerate backup codes |
| Regen confirm modal title | Regenerate backup codes? |
| Regen confirm modal body | This invalidates all your current backup codes. You'll get 10 fresh codes to save. This can't be undone. |
| Regen confirm CTA | Yes, regenerate |
| Regen confirm cancel | Cancel |

**Interactions delta (Mode B specific):**

- On mount: GET `/api/auth/2fa/status` to load `backup_codes_remaining` count. No other data loaded.
- On Regenerate click: trigger step-up (`useStepUp()`), then on step-up success open the Regen confirm modal, then on confirm POST to `/api/auth/2fa/backup-codes/regenerate` with the elevated token. Response returns the 10 fresh codes → page transitions to Mode A first-view rendering with the fresh set + query param `?first-view=1` in URL.
- After regenerate + save: on Continue, route to SHR-MFA-001 which will re-read the count.

**State variants delta:**

| Variant | Mode | Behavior |
|---|---|---|
| **Loading — count** | B | Skeleton status card + button. |
| **Standing — normal** | B | Count ≥ 3. Muted status card. |
| **Standing — low** | B | Count 1-2. Warning tint on status card. |
| **Standing — empty** | B | Count 0. Danger tint + emphatic Regenerate CTA. |
| **First-view — codes visible** | A | 10 codes rendered in grid, confirmation checkbox unchecked. |
| **First-view — confirmed** | A | Checkbox ticked, Continue enabled. |
| **First-view — leave-guard modal** | A | Modal open over dimmed content. |
| **Regen — step-up in flight** | B | Screen dimmed behind SHR-MFA-007 modal. |
| **Regen — confirm modal** | B | Confirm modal over content. |
| **Regen — POST in flight** | B | Regenerate CTA shows spinner. |
| **Regen — success** | B → A | Transitions to Mode A with fresh codes. |
| **Regen — error** | B | Toast: "Could not regenerate. Try again." Content unchanged. |
| **Missing codes in state (Mode A)** | A | Redirect to Mode B — user hit /backup-codes?first-view=1 without codes in router state (page reload); Mode B is the safe fallback. |
| **Print preview** | A or B | Print stylesheet hides all chrome, shows only codes grid + generation date + account email. |

**Anti-patterns delta:**

- ❌ Do not attempt to fetch existing codes from any endpoint. There is none. Mode B is intentionally view-less by backend design.
- ❌ Do not persist codes in localStorage. Router state or a `useRef` only. Rely on the user to save via Copy/Download/Print.
- ❌ Do not skip the confirmation checkbox in Mode A. Mandatory acknowledgment before leaving.
- ❌ Do not skip step-up before Regenerate. It's a destructive security action.
- ❌ Do not allow Regenerate without a step-up modal appearing. Both step-up AND explicit confirmation modal required (defense in depth per auth-2fa.js Disable pattern comment).
- ❌ Do not include a "Print all" without a corresponding print stylesheet. The stylesheet must exist.
- ❌ Do not truncate codes visually (e.g., `XXXX-…`) even briefly during copy states — user must see the full code to verify.

**Backend contract delta:**

`GET /api/auth/2fa/status` — used to load `backup_codes_remaining`.

`POST /api/auth/2fa/backup-codes/regenerate` — **DOES NOT YET EXIST** — flag as `[BE-BLOCKER-MFA-01]` in kickoff §5a. Contract to be implemented:
```
Request: {} (empty)
Headers: X-Elevated-Token: <elevated>
Response 200: { backup_codes: [...10 codes...], backup_codes_remaining: 10 }
Response 401: elevated token missing/expired
Response 503: encryption unavailable (same as verify endpoint's failure mode)
```
Semantics: DELETE all existing user_backup_codes rows for user, INSERT 10 fresh bcrypt-hashed codes, return plaintext ONCE.

**Shared primitives:**

- `BackupCodeGrid` — the 2×5 or 1×10 grid layout, potentially reusable for other "one-shot secret display" surfaces.
- Reuse `EnrollmentStepper` from SHR-MFA-002/003 (Mode A only).
- Reuse `PrintStyles` addition to `web/src/print.css` — brief-scope only, but write it once for all print-friendly surfaces.

**Definition of done:** Mode A first-view + confirmed + leave-guard, Mode B standing + low + empty + regen step-up + regen confirm + regen success transition, mobile + RTL + dark states rendered; JSX committed; `[BE-BLOCKER-MFA-01]` filed; regenerate endpoint delivered as part of the same PR.
