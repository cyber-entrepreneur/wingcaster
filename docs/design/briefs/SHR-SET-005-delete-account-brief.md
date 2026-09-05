# Screen Brief — SHR-SET-005 · Delete Account (3-factor destructive flow)

**Layer-2 Brief for design AI consumption.**

Companion to `SCREEN_MATRIX_SHARED.md` entries `SHR-SET-005 / 005b / 005c / 005d`. This brief specifies the entire 4-screen destructive workflow per user feedback (2026-09-03): liveness word → email confirmation → TOTP challenge → deletion scheduled.

---

## 🎨 Broadcast alignment (added 2026-09-04 post PR #41 merge)

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Inline hex or shadcn-generic references get replaced with `--lc-*` semantic tokens.

**Screen-specific Broadcast callouts for the 4-screen delete flow:**
- Warning color throughout: `--lc-status-underOffer-*` tokens (amber) for the "cautious" tone. NOT `--lc-status-unpublished-*` (red) — this is destructive but reversible-until-cool-down-expires, warrants amber caution not red alarm. Only the final "Delete permanently" primary button is `--lc-status-unpublished-fg` red.
- Random regenerable word display (SHR-SET-005): `font: var(--lc-type-data)` — mono, tabular. Copy button + refresh icon inline.
- Countdown pill (SHR-SET-005b / c): `<Numeric>` component wrapping the mm:ss value. Updates via `useEffect` at 1s tick.
- Step progress dots (SHR-SET-005c): 3 filled + 1 empty. Filled dots use `--lc-action-primary`. Empty dots use `--lc-border-strong`.
- 6-digit TOTP input (SHR-SET-005c): 6 boxes in a row, each 44×44 min, `font: var(--lc-type-data)` mono. Auto-advance between boxes. Paste of full code fills all boxes.
- Danger primary button (final Delete confirm on SHR-SET-005): `--lc-status-unpublished-fg` fill + `--lc-text-inverse` ink. Everywhere else, `<Button variant="destructive">` is fine.
- Two-tone focus ring on every interactive element — automatic via base CSS.
- Motion between the 4 screens: gentle slide (12px + fade, `--lc-duration-slow`). No emphasis easing here — destruction is not a celebration.
- Sobriety anti-pattern: NO confetti, NO "we'll miss you 😢", NO emoji. This is a legal action with cool-down.

---

## Meta

| | |
|---|---|
| Screen IDs | SHR-SET-005 (initiator), SHR-SET-005b (email-pending), SHR-SET-005c (TOTP challenge), SHR-SET-005d (scheduled) |
| Screen names | Delete Account — Confirm intent → Check your email → Verify with TOTP → Deletion scheduled |
| Persona | Any authenticated user (Agent solo, Agent in agency, Agency owner, PA) |
| Device targets | Mobile 375px (primary), desktop 1440px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Workflow | WF-16 (self-service account deletion) |
| Current state | MISSING — no delete-account flow exists today |

---

## Purpose (one sentence per screen)

- **SHR-SET-005** — Prove you are alive (not muscle-memorising a delete) by typing a fresh random word AND commit to starting the destructive process.
- **SHR-SET-005b** — Wait for and clearly signal the email confirmation.
- **SHR-SET-005c** — Verify identity via TOTP (or backup code) after clicking the email link.
- **SHR-SET-005d** — Communicate the 30-day cool-down window and how to cancel it.

---

## Design principles for this whole flow

- **Sober, not scary** — this is a legitimate action a user might genuinely want; don't shame them. But don't make it easy to do accidentally.
- **Never single-tap** — every advance requires a deliberate action.
- **Every step is reversible until the cool-down expires.** Say so, prominently.
- **Copy tells the user what will happen and what won't** — invoices retained, listings archived, contacts pseudonymized, credits forfeit, etc.
- **Agency owners blocked at step 1** if there are remaining agents — with clear next steps.
- **The unique random word regenerates on every attempt** (page refresh, modal reopen) — it is a liveness check, NOT a memorable password. Never re-use it.

---

## SHR-SET-005 — Confirm intent (initiator)

### Layout — mobile 375px

Reading top-to-bottom:

1. **Header bar**: back arrow (top-left, RTL: top-right), title `Delete Account` centered.
2. **Warning icon card** — a subdued warning color (amber, not red — this is a caution, not a stop). Icon: `AlertTriangle` from Lucide, 32×32.
3. **Impact heading**: "This will permanently delete your account after a 30-day cool-down."
4. **Impact list** — grouped bullets:
   - `Deleted immediately (at the end of the cool-down):`
     - Your profile and login
     - Your listings (archived to sold/withdrawn, then removed)
     - Your contacts (pseudonymized per GDPR)
     - Your unspent credits (forfeited)
   - `Kept for legal reasons:`
     - Invoices and payment records (7 years, per tax law)
     - Aggregate audit trail (redacted, no personal data)
   - `Effective right now:`
     - You will be signed out of every device
     - Your public agent profile will be hidden
5. **Random word card** — a light-elevated card:
   - Small label: `To confirm you're deleting on purpose, type this:`
   - Large monospace pill showing the word (regenerated fresh every load), e.g. `orange-piano-frost` — 24px, high contrast, mono font
   - Copy icon (secondary — most users should type, not copy)
   - Below the pill: input `Type the word` (autocomplete off, autocorrect off, spellcheck off)
   - "Get a new word" refresh link
6. **Reason picker** — dropdown (optional, unless > agency owner):
   - "Why are you leaving?" placeholder
   - Options: Too expensive · Missing feature · Switching to another tool · Business closed · Privacy concerns · Prefer not to say
   - Free-text notes below (optional)
7. **Danger button** — full-width, 48px, red primary color (`--danger`), label `Continue to email verification` — disabled until the word matches AND the reason picker has a value.
8. **Cancel link** — below the button, `Cancel` link, muted.

### Layout — desktop 1440px

Centered modal 480px wide, same content order. Backdrop dimmed. ESC closes.

### Explicit copy — SHR-SET-005 (EN + AR)

| Key | EN | AR |
|---|---|---|
| `title` | Delete Account | حذف الحساب |
| `intro` | This will permanently delete your account after a 30-day cool-down. | سيؤدي هذا إلى حذف حسابك نهائيًا بعد فترة تهدئة مدتها ٣٠ يومًا. |
| `impact.deleted.title` | Deleted at the end of the cool-down: | يُحذف في نهاية فترة التهدئة: |
| `impact.deleted.profile` | Your profile and login | ملفك الشخصي وتسجيل الدخول |
| `impact.deleted.listings` | Your listings — archived, then removed | إعلاناتك — تُؤرشف ثم تُزال |
| `impact.deleted.contacts` | Your contacts — pseudonymized per GDPR | جهات اتصالك — تُخفى الهوية وفقًا للائحة GDPR |
| `impact.deleted.credits` | Any unspent credits — forfeited | أي رصيد غير مستخدم — يُصادَر |
| `impact.kept.title` | Kept for legal reasons: | يُحتفظ به لأسباب قانونية: |
| `impact.kept.invoices` | Invoices and payment records (7 years) | الفواتير وسجلات الدفع (٧ سنوات) |
| `impact.kept.audit` | Aggregate audit trail (redacted) | سجل التدقيق العام (مُنقّح) |
| `impact.now.title` | Effective right now: | فوري: |
| `impact.now.signout` | You will be signed out of every device | ستُسجّل خروجك من جميع الأجهزة |
| `impact.now.public` | Your public profile will be hidden | سيُخفى ملفك العام |
| `word.label` | To confirm you're deleting on purpose, type this: | لتأكيد أنك تحذف عن قصد، اكتب هذا: |
| `word.input` | Type the word above | اكتب الكلمة أعلاه |
| `word.refresh` | Get a new word | كلمة جديدة |
| `reason.label` | Why are you leaving? | لماذا ترحل؟ |
| `reason.tooExpensive` | Too expensive | مكلف جدًا |
| `reason.missingFeature` | Missing a feature I need | ينقصه ميزة أحتاجها |
| `reason.switching` | Switching to another tool | التحوّل إلى أداة أخرى |
| `reason.businessClosed` | My business closed | أغلقت عملي |
| `reason.privacy` | Privacy concerns | مخاوف الخصوصية |
| `reason.preferNotToSay` | Prefer not to say | أفضّل عدم القول |
| `button.continue` | Continue to email verification | تابع إلى تأكيد البريد |
| `button.cancel` | Cancel | إلغاء |
| `block.agencyOwner` | You own an agency with {N} active members. Transfer ownership or remove all members before deleting your account. | أنت مالك وكالة تضم {N} أعضاء نشطين. انقل الملكية أو أزل جميع الأعضاء قبل حذف حسابك. |
| `block.pastDue` | You have unpaid invoices. Settle them or contact support before deleting. | لديك فواتير غير مدفوعة. سدّدها أو تواصل مع الدعم قبل الحذف. |

### State variants

- **Idle** — button disabled
- **Word incorrect** — input in error state, message under it: `That's not the word. Try again or refresh for a new one.`
- **Blocked: agency owner** — replace the entire form with a block card + link to AGN-MEM-001 (member management) and AGN-SET-005 (transfer ownership)
- **Blocked: past-due** — replace with a block card + link to invoices
- **Submitting** — button spinner + label `Sending you an email…`
- **Error** — inline banner, retry

### Interactions

- Refresh button regenerates the word via server (`POST /api/auth/delete-account/regenerate-word`); old word invalidated
- Input is case-insensitive but whitespace-strict
- On submit → `POST /api/auth/delete-account/initiate` → sends email → navigate to SHR-SET-005b

---

## SHR-SET-005b — Check your email (waiting)

### Layout — mobile 375px

1. **Header**: back arrow, title `Check your email`.
2. **Illustrated hero** — envelope illustration, muted colors (not celebratory).
3. **Message**: 
   > We just sent a confirmation link to `s•••@propertyfinder.ae`. Click the link within **15 minutes** to continue.
   - Email is partially masked (first char + last dot of domain visible, everything else `•`).
4. **Countdown pill**: `Link expires in 14:52` — updates every second.
5. **Resend button** — outline, disabled for 60s after send (`Resend in 47s`).
6. **Change email link**: `Not this email?` (opens SHR-SET-002 in a new task to update email first, then user must start over).
7. **Cancel deletion button** — outline `Cancel deletion` — one-tap cancel of the entire in-flight flow, no penalty.

### Explicit copy — SHR-SET-005b

| Key | EN | AR |
|---|---|---|
| `title` | Check your email | تحقّق من بريدك |
| `hero.text` | We just sent a confirmation link to {maskedEmail}. Click it within {minutes} minutes to continue. | أرسلنا رابط تأكيد إلى {maskedEmail}. انقر عليه خلال {minutes} دقيقة للمتابعة. |
| `countdown` | Link expires in {mm:ss} | الرابط ينتهي خلال {mm:ss} |
| `resend.ready` | Resend email | إعادة الإرسال |
| `resend.wait` | Resend in {seconds}s | إعادة الإرسال بعد {seconds} ث |
| `changeEmail` | Not this email? | ليس هذا البريد؟ |
| `cancel` | Cancel deletion | إلغاء الحذف |
| `expired` | The link expired. Send a new one? | انتهى الرابط. أرسل رابطًا جديدًا؟ |
| `emailSent.toast` | Confirmation email sent. | تم إرسال بريد التأكيد. |

### State variants

- **Waiting** — countdown running
- **Expired** — countdown at 0, resend button prominent
- **Resent** — toast, countdown restarts

### Interactions

- Countdown auto-updates every 1s
- Resend triggers `POST /api/auth/delete-account/resend-email`
- Cancel triggers `POST /api/auth/delete-account/cancel` → back to SHR-SET-002 with toast `Deletion cancelled`
- Screen also acts as a polling watcher — if the user clicks the email link in the same browser, this screen auto-advances to SHR-SET-005c

### Email content (out of scope for design but noted)

Subject: `Confirm your Wingcaster account deletion`
Body: `Someone (hopefully you) started deleting your Wingcaster account. If it was you, click below to continue. If not, ignore this email and change your password.`
Button: `Continue deletion → SHR-SET-005c URL with signed token, TTL 15 min`

---

## SHR-SET-005c — Verify with TOTP (email-linked)

### Layout — mobile 375px

1. **Header** — no back arrow (this is a landing from email); title `One more step`.
2. **Progress indicator** — three dots at top, filled up to step 3 of 4: `● ● ● ○`
3. **Icon** — `ShieldCheck` from Lucide, 32×32
4. **Message**: 
   > For safety, enter the 6-digit code from your authenticator app to continue.
5. **6-digit code input** — 6 boxes in a row, auto-advance between boxes, paste-of-full-code supported
6. **Verify button** — full-width, primary color, label `Verify and delete`
7. **Backup code link** — `Use a backup code instead` (only if TOTP is enrolled)
8. **No TOTP fallback** — if the user doesn't have TOTP enrolled, this screen shows a password re-prompt instead (label: "Enter your password to confirm").
9. **Cancel deletion button** — outline, still available

### Explicit copy — SHR-SET-005c

| Key | EN | AR |
|---|---|---|
| `title` | One more step | خطوة أخيرة |
| `intro.totp` | For safety, enter the 6-digit code from your authenticator app to continue. | للأمان، أدخل الرمز المكوّن من ٦ أرقام من تطبيق المصادقة للمتابعة. |
| `intro.password` | For safety, enter your password to confirm. | للأمان، أدخل كلمة المرور للتأكيد. |
| `field.code.label` | Verification code | رمز التحقّق |
| `link.backup` | Use a backup code instead | استخدم رمز احتياطي بدلًا من ذلك |
| `button.verify` | Verify and delete | تحقّق واحذف |
| `error.wrongCode` | That code doesn't match. {remaining} attempts left. | الرمز غير صحيح. المحاولات المتبقية: {remaining}. |
| `error.expired` | This link expired. Start over. | انتهى الرابط. ابدأ من جديد. |
| `error.locked` | Too many wrong attempts. Deletion cancelled. Start over if you still want to delete. | محاولات خاطئة كثيرة. تم إلغاء الحذف. ابدأ من جديد إذا أردت الحذف. |
| `cancel` | Cancel deletion | إلغاء الحذف |

### State variants

- **Idle** — code empty, button disabled
- **Verifying** — spinner, `Verifying…`
- **Wrong code** — error text, remaining attempts shown
- **Rate-limited** — button disabled with countdown
- **Expired link** — full replacement, "Start over" CTA back to SHR-SET-005
- **Locked (too many wrong codes)** — full replacement, flow abandoned + cancel notification email sent to user

### Interactions

- Auto-focus first digit
- Paste of 6-digit string fills all boxes at once
- Verify triggers `POST /api/auth/delete-account/confirm` with token + code
- On success → server schedules deletion for +30 days → navigate to SHR-SET-005d
- User is signed out of all sessions immediately on success

---

## SHR-SET-005d — Deletion scheduled (recipient)

### Layout — mobile 375px

1. **Illustrated hero** — hourglass or clock illustration, muted
2. **Heading**: `Your account will be deleted on {date}`
3. **Message**:
   > Your Wingcaster account is scheduled for deletion on **Sunday, October 3, 2026** (30 days from today).
   > We'll email you a reminder one week and one day before the deletion.
4. **Cancel deletion card** — light-elevated:
   - Message: "Changed your mind? You can cancel any time before {date}."
   - Cancel Deletion button — outline, full-width
5. **What to expect** — collapsible section:
   - "Between now and {date}, your account is signed out and your public profile is hidden."
   - "You can sign back in with the same credentials to cancel the deletion."
   - "After {date}, this cannot be reversed."
6. **Contact support link** — footer

### Explicit copy — SHR-SET-005d

| Key | EN | AR |
|---|---|---|
| `title` | Your account will be deleted on {date} | سيُحذف حسابك في {date} |
| `intro` | Your Wingcaster account is scheduled for deletion on {longDate} ({daysAway} days from today). We'll email you a reminder one week and one day before the deletion. | تم جدولة حذف حسابك في {longDate} (بعد {daysAway} يومًا). سنُرسل تذكيرًا قبل أسبوع وقبل يوم من الحذف. |
| `cancelCard.text` | Changed your mind? You can cancel any time before {date}. | غيّرت رأيك؟ يمكنك الإلغاء في أي وقت قبل {date}. |
| `cancelCard.button` | Cancel Deletion | إلغاء الحذف |
| `expect.title` | What to expect | ماذا تتوقّع |
| `expect.p1` | Between now and {date}, your account is signed out and your public profile is hidden. | من الآن وحتى {date}، تم تسجيل خروج حسابك وإخفاء ملفك العام. |
| `expect.p2` | You can sign back in with the same credentials to cancel the deletion. | يمكنك تسجيل الدخول بنفس البيانات لإلغاء الحذف. |
| `expect.p3` | After {date}, this cannot be reversed. | بعد {date}، لا يمكن التراجع. |
| `support` | Contact support | تواصل مع الدعم |

### State variants

- **Just-scheduled** — the primary state
- **Approaching deadline (< 7 days)** — banner turns amber
- **Approaching deadline (< 24 hours)** — banner turns red, urgency copy

### Interactions

- Cancel Deletion → `POST /api/auth/delete-account/cancel` → returns to normal signed-in state with toast `Deletion cancelled`
- Sign-in on any device during cool-down shows a cancel banner at top of every page (`Your account is scheduled for deletion on {date}. Cancel deletion?`)

---

## Design system reuse

All four screens use:
- `<Card>` for content wrappers
- `<Button variant="danger">` for the primary destructive action (SHR-SET-005 only)
- `<Button variant="outline">` for cancel + resend + backup-code
- `<Input>` with `<Label>` for word, TOTP, password
- `<Alert variant="warning">` for the impact banner
- `<Progress>` for the 3-dot step indicator on SHR-SET-005c

Icons: `AlertTriangle`, `ShieldCheck`, `RefreshCw`, `Copy` (all from Lucide).

Motion:
- Between screens: gentle slide (12px + fade, 220ms). No dramatic transitions.
- Word regeneration: word text fades out + new word fades in over 300ms.
- Countdown: number tick, no animation.

---

## Sample content the AI should render

Render each of the 4 screens at:
- Mobile 375px, English (LTR), light theme
- Mobile 375px, Arabic (RTL), dark theme

That's 8 canvas frames. Use these sample values:

- User email: `sara.almansoori@propertyfinder.ae` (mask as `s•••@propertyfinder.ae`)
- Fresh random word: `orange-piano-frost`
- Countdown at time of render: `14:52` (SHR-SET-005b), `13:47` (SHR-SET-005c step 3)
- Scheduled deletion date: `Sunday, October 3, 2026` / `الأحد، ٣ أكتوبر ٢٠٢٦`
- Cool-down days: `30`
- Agency-owner-blocked scenario: `You own an agency with 12 active members.`

---

## Anti-patterns — do NOT do

- Do not use a red confirm button on step 1 that looks the same as normal buttons. It must READ red.
- Do not require the user to type "DELETE MY ACCOUNT" or similar — a random regenerated word is stronger AND less irritating.
- Do not add gimmicks (confetti, sad emoji, "we'll miss you 😢"). Sober tone throughout.
- Do not silently pre-populate the reason from analytics.
- Do not show the full email address in the "Check your email" screen — mask it (security best practice).
- Do not allow the whole flow to complete in one browser session without leaving the app — the email round-trip is the whole point.
- Do not truncate the impact list. Users need to see every consequence.

---

## Reference designs

- **GitHub delete account flow** — clear staged flow with typed confirmation
- **Google account deletion** — sober tone, impact list, cool-down
- **Stripe account close** — reason picker treatment
- **Notion delete workspace** — cool-down countdown UI

---

## Downstream implementation notes (Cursor Code)

- Backend endpoints to add:
  - `POST /api/auth/delete-account/initiate` — creates a `DeletionRequest` row, generates word, sends email
  - `POST /api/auth/delete-account/regenerate-word` — invalidates old, issues new
  - `POST /api/auth/delete-account/resend-email` — re-dispatches confirmation email (rate-limited)
  - `POST /api/auth/delete-account/confirm` — token + TOTP → schedule deletion for +30d
  - `POST /api/auth/delete-account/cancel` — cancel the scheduled deletion at any time before deletion runs
- Worker: `deletion-worker.js` on a cron (daily) — for each request past cool-down: runs GDPR erasure pipeline (`credits/erasure.js` etc.), archives listings, signs out sessions, pseudonymizes contacts, retains invoices.
- Audit: every step writes `PA-AUD-001` entries with actor + IP + user-agent.
- Agency-owner guard: server-side rejection with 409 + specific error code when owner has active members or past-due invoices. Frontend renders block card.
