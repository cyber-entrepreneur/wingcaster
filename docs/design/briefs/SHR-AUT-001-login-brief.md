# Screen Brief — SHR-AUT-001 · Sign in

**Layer-2 Brief for design AI consumption (Cursor Design / v0 / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_SHARED.md` entry `SHR-AUT-001`. This brief is what you paste into a design AI to get a compelling mockup — with explicit copy, layout, components, sample content, and mood.

---

## 🎨 Broadcast alignment (added 2026-09-04 post PR #41 merge)

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Where inline hex values (`#FCFCFD`, `#1D4ED8`, etc.) or shadcn-generic references appear in sections that follow, replace them with the semantic `--lc-*` tokens per the alignment reference.

**Screen-specific Broadcast callouts for the login screen:**
- Hero + heading: `font: var(--lc-type-display)` for the "Welcome back" line — Archivo 800 32/38. Loud is on-brand for Broadcast.
- Primary sign-in button: `--lc-action-primary` fill + `--lc-action-primary-text` ink. Hover: `--lc-action-primary-hover` (DARKER — never lighter).
- OAuth provider buttons (Google / Apple / Facebook): follow each provider's OWN brand guidelines, NOT Broadcast tokens. Focus rings on them still use the base two-tone `--lc-focus-ring` + `--lc-focus-ring-contrast`.
- Divider "or use your account": `<Separator>` with centered text. Rule color `--lc-border`. Text color `--lc-text-muted`.
- Identifier-type tabs (Email / Username / Phone): `<Tabs>` primitive. Active-tab underline uses `--lc-action-primary`.
- Password field: `<Input>` primitive. Eye toggle uses `Eye` / `EyeOff` from lucide-react.
- Trust footer ("payments processed by Paddle"): `font: var(--lc-type-caption)`, color `--lc-text-muted`.
- Two-tone focus ring is automatic on all interactive elements via the base CSS — do not override per element.
- Mobile 44px tap-target floor is automatic — do not shrink OAuth buttons or the "Sign in" button below it.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-AUT-001 |
| Screen name | Sign in |
| Persona | Public / anonymous |
| Device targets | Mobile 375px (primary), desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/login` |
| Current state | EXISTS at `web/src/pages/LoginPage.tsx` — this brief supersedes with the 6-identity-path pattern from feedback 2026-09-03 |

---

## Purpose (one sentence)

Give someone who already has a Wingcaster account the fastest possible path back in — via a social identity provider they already trust (Google / Apple / Facebook) or with credentials they know (Email / Username / Phone Number + Password) — while making it obvious how to recover a lost password or sign up for the first time.

---

## Product context the AI needs

- **Wingcaster** is a real-estate SaaS for MENA/Gulf agents and agencies. Design bias: warm, professional, MENA-appropriate; not Silicon-Valley playful, not corporate-stuffy.
- MENA users primarily use WhatsApp, Google, and Instagram on mobile. Facebook is regionally common but declining among under-35 agents. Apple is important in the Gulf but not in Egypt/Lebanon.
- Users span from tech-illiterate ("only uses WhatsApp") to power-user. The sign-in screen must not intimidate the first group.
- Arabic reads right-to-left and uses different numerals; layout MUST mirror on Arabic locale.
- Primary device is a mid-range Android at 375px. If it doesn't work well one-handed on a bumpy taxi ride, it fails.

---

## Layout — mobile 375px, portrait

Reading top to bottom:

1. **Top status area**
   - Language selector: two pills side by side — `EN` and `العربية` — top-right (or top-left in RTL). Active pill filled, inactive outlined. 40×40px tap targets.
   - Small back arrow top-left only if user arrived from a "sign up" or "learn more" page (never from a cold URL).

2. **Brand hero (72px tall)**
   - Wingcaster wordmark (SVG, dark on light theme, light on dark).
   - Optional: one-line tagline in muted color — for example "Sign in to your dashboard".

3. **Federated identity block** (the primary path for most returning users)
   - Section header (small, uppercase, muted): `Sign in with` — with a horizontal divider on either side ("Sign in with —").
   - Three full-width buttons stacked, 48px tall each, 12px spacing between:
     - **Continue with Google** — official Google G logo left, `Continue with Google` label. White background, subtle border, `#3c4043` text on light; dark surface on dark theme.
     - **Continue with Apple** — official Apple logo left, `Continue with Apple` label. Black background + white label on light theme; white background + black label on dark theme (per Apple HIG).
     - **Continue with Facebook** — official Facebook logo left, `Continue with Facebook` label. `#1877F2` background, white label.
   - All three buttons follow their respective brand guidelines exactly — do not skin them differently. Icon-left, label-center.
   - Focus states: 2px focus ring in the token color, not the provider brand color.

4. **Divider "or use your account"**
   - Muted horizontal rule with the text "or use your account" centered on it. `text-sm text-muted-foreground`.
   - Bilingual: Arabic reads "أو استخدم حسابك".

5. **Direct-credentials form**
   - **Identifier-type switcher** — three tabs at the top of the form: `Email` · `Username` · `Phone`. Underline for active tab. Tabs cycle the input's type + validation.
     - Email tab: input `type=email`, `inputMode=email`, autocomplete `username`. Placeholder: "you@agency.com".
     - Username tab: input `type=text` with prefix `@`, autocomplete `username`. Placeholder: "sara-almansoori". Show a live availability check on blur? No — this is sign-in, not registration.
     - Phone tab: country selector (auto-detected, override tappable) + numeric input, `inputMode=tel`, autocomplete `tel`. Placeholder: "50 123 4567" with the country's format.
   - **Password field** — always visible under the identifier. `type=password`, autocomplete `current-password`. Suffix icon: eye toggle to show/hide.
   - **Remember me** — checkbox with label "Keep me signed in on this device", `text-sm`. Default: OFF (secure by default).
   - **Sign in button** — full-width, 48px tall, primary color, label "Sign in". Disabled until identifier + password are non-empty.
   - Below the button, one line: `Forgot password?` — link, `text-sm`, right-aligned in LTR (left-aligned in RTL).

6. **Footer link**
   - Text: `Don't have an account?` **`Create one →`** (link).
   - Below (small, muted): `Wingcaster does not store card details. Payments processed by Paddle.` — builds trust; only shown once Paddle is integrated.

Vertical rhythm: 24px between blocks, 12px within blocks. Safe-area inset at the bottom respected for iOS.

## Layout — desktop 1440px

Two-column split. Left 60% is brand + testimonial + featured listing photo carousel (an actual Wingcaster listing, rotating every 8s). Right 40% is the auth stack — same content as mobile but centered in a 400px column with 40px top padding. Language selector top-right of the right column, not the page.

---

## Explicit copy (all strings, EN + AR)

| Key | EN | AR |
|---|---|---|
| `page.title` | Sign in — Wingcaster | تسجيل الدخول — وينغكاستر |
| `hero.tagline` | Welcome back. | مرحبًا بعودتك. |
| `federated.heading` | Sign in with | الدخول عبر |
| `federated.google` | Continue with Google | المتابعة عبر Google |
| `federated.apple` | Continue with Apple | المتابعة عبر Apple |
| `federated.facebook` | Continue with Facebook | المتابعة عبر Facebook |
| `divider` | or use your account | أو استخدم حسابك |
| `tab.email` | Email | البريد الإلكتروني |
| `tab.username` | Username | اسم المستخدم |
| `tab.phone` | Phone | الهاتف |
| `field.email.placeholder` | you@agency.com | you@agency.com |
| `field.username.placeholder` | sara-almansoori | sara-almansoori |
| `field.phone.placeholder` | 50 123 4567 | ٥٠ ١٢٣ ٤٥٦٧ |
| `field.password.label` | Password | كلمة المرور |
| `field.password.show` | Show password | إظهار كلمة المرور |
| `field.password.hide` | Hide password | إخفاء كلمة المرور |
| `checkbox.remember` | Keep me signed in on this device | إبقني مسجّلًا في هذا الجهاز |
| `button.signin` | Sign in | تسجيل الدخول |
| `link.forgot` | Forgot password? | نسيت كلمة المرور؟ |
| `footer.noaccount` | Don't have an account? | ليس لديك حساب؟ |
| `footer.create` | Create one → | أنشئ حسابًا ← |
| `footer.paddle` | Wingcaster does not store card details. Payments processed by Paddle. | لا يخزّن وينغكاستر بيانات البطاقات. المدفوعات عبر Paddle. |
| `error.invalid` | That email/username/phone or password is incorrect. | البريد أو اسم المستخدم أو الهاتف أو كلمة المرور غير صحيحة. |
| `error.locked` | This account is temporarily locked. Try again in {minutes} minutes or reset your password. | تم قفل الحساب مؤقتًا. حاول بعد {minutes} دقيقة أو أعد تعيين كلمة المرور. |
| `error.rate` | Too many attempts. Please wait {seconds} seconds. | محاولات كثيرة. يرجى الانتظار {seconds} ثانية. |
| `error.network` | We couldn't reach Wingcaster. Check your connection and try again. | تعذّر الوصول إلى وينغكاستر. تحقّق من اتصالك وحاول مجددًا. |
| `error.oauth.google` | Google sign-in was cancelled or failed. Try again or use another method. | تم إلغاء تسجيل الدخول بواسطة Google أو فشل. حاول مرة أخرى أو استخدم طريقة أخرى. |
| `success.redirect` | Signing you in… | جارٍ تسجيل الدخول… |

Copy voice: warm, direct, second-person, no exclamation marks, no "!". Never "Oops" or "Whoops".

---

## Component palette (shadcn / Radix / Tailwind — this project's stack)

Use these exact primitives from `web/src/components/ui/*`:

- `<Button>` variants: `primary` (sign-in), `outline` (federated), `link` (forgot password / footer)
- `<Input>` with `<Label>` (visible, not placeholder-only)
- `<Tabs>` for identifier-type switcher
- `<Checkbox>` for Remember me
- `<Separator>` with centered text pattern for the divider
- Custom: OAuth-branded buttons (build if not present) — must match the three provider style guides exactly

Icons: `lucide-react`
- `Eye` / `EyeOff` for password toggle
- `AlertCircle` for error toast
- Federated icons: use official SVGs from the providers (do NOT rely on Lucide's simplified versions)

Fonts:
- Latin: system font stack (San Francisco / Segoe UI / Roboto) at 15px base, 16px inputs
- Arabic: `IBM Plex Sans Arabic` at 15px base, 16px inputs (weights 400 + 600 loaded)

Colors (design system tokens; light theme values shown):
- `--bg` `#FCFCFD`, `--bg-elevated` `#FFFFFF`
- `--fg` `#0F172A`, `--fg-muted` `#64748B`
- `--border` `#E2E8F0`, `--border-focus` `#1D4ED8`
- `--primary` `#1D4ED8`, `--primary-fg` `#FFFFFF`
- Dark theme: invert with warm neutrals (not pure black) — `--bg` `#0B0F1A`, `--fg` `#F1F5F9`

Corner radius: 12px on buttons and inputs. Shadow on the credentials form is subtle (0 1px 2px rgba(0,0,0,0.06)) — brand hero has none.

Motion: 150ms ease-out on focus rings; 220ms on tab switch (identifier-type). No confetti or gimmicks on this screen — signing in is not a celebration moment.

---

## Sample content for the AI to render against

Two rendered variants would show:

**Filled state (mid-typing on Email tab, English)**
- Email: `sara@propertyfinder.ae`
- Password: `••••••••••••` (with eye toggle visible)
- Remember me: checked
- Sign in button: enabled, primary

**Error state (wrong credentials, Arabic RTL)**
- Layout mirrored
- Above the Sign in button: red text `البريد أو كلمة المرور غير صحيحة.` with an `AlertCircle` icon
- Field borders keep default color (no per-field error painting — the message is above the button)
- Sign in button: enabled (for retry)

**Rate-limited state**
- Sign in button: disabled with countdown label — `تسجيل الدخول (١٥ ث)` — enables when countdown hits 0
- Muted card above: "Too many attempts. Please wait 15 seconds."

---

## Interactions

- Autofocus the identifier input on mount (unless coming back from "forgot password" — then keep focus at the top).
- Tab switching (Email/Username/Phone) preserves the password field value; identifier value clears with a subtle fade.
- Enter key submits from any input (respect browser default; ensure no accidental form submission on tab switch).
- Password reveal is temporary (auto-re-hide after 5 seconds).
- Federated buttons open a popup (desktop) or in-app browser tab (mobile via Capacitor Browser plugin). On success, the popup closes and the calling page navigates.
- Escape key on any modal closes it (unless a rate-limit countdown is running).

---

## State variants to render

1. **Idle** — empty form, primary CTA disabled.
2. **Filled + enabled** — as above.
3. **Loading** — Sign in button shows a spinner + label `Signing you in…`; form fields disabled.
4. **Error: bad credentials** — see sample.
5. **Error: rate-limited** — countdown shown as above.
6. **Error: network** — inline banner at top of form with retry button.
7. **Error: OAuth failed** — inline banner explaining which provider failed, with Try Again + Try another method.
8. **MFA branch** — after successful password, the whole form is replaced by a TOTP 6-digit input with `Use backup code` link (renders as SHR-MFA-004 — separate brief).

---

## Accessibility (WCAG 2.1 AA)

- All interactive elements ≥ 44×44 tap targets (iOS HIG) — 48×48 preferred (Android Material)
- Contrast: body text ≥ 4.5:1, large text ≥ 3:1, buttons ≥ 4.5:1 on primary
- Focus rings visible on every focusable element, keyboard-only navigable in logical order (top to bottom)
- Screen-reader labels on every icon-only element (eye toggle, language pills, password reveal)
- Error messages announced via `aria-live=polite` region
- Language switcher updates `<html dir>` immediately and announces the change
- Federated buttons carry an aria-label including the action verb: `aria-label="Sign in with Google"`

---

## Anti-patterns — do NOT do

- Do not use "!" in copy. No "Welcome back!" — just "Welcome back."
- Do not use placeholder text as the only label. Every input has a visible `<Label>`.
- Do not put the federated buttons below the password form — federated is the expected primary path for many MENA users and must be above.
- Do not enumerate whether an email exists ("no account found with this email"). Uniform error copy per §"error.invalid".
- Do not render the sign-in button as full-width with a chevron — this is not a wizard step.
- Do not add a "Sign in with WhatsApp" button — we deliver auth via WhatsApp OTP but that is a code-verification flow, not a federated identity provider.
- Do not skin the federated buttons with Wingcaster colors — brand guidelines are strict.

---

## Reference designs (for style anchoring)

- **Shopify sign-in** — federated + email pattern, clean and warm
- **Notion sign-in** — divider treatment, footer trust copy
- **Linear sign-in** — motion, focus rings
- **Bayut mobile app sign-in** — MENA style baseline, warm color palette
- **Vercel sign-in** — dark-mode treatment

Do NOT anchor on: Stripe (too B2B-cold), Amazon (too dense), MS-365 (too corporate).

---

## Handoff instruction to the design AI

> Produce this screen at mobile 375px and desktop 1440px, in English (LTR) and Arabic (RTL), in light and dark themes — that's 8 total renders. Use shadcn/ui components already present in the codebase. Follow the copy table exactly. Match the reference designs' feel but not their exact style. Return the mockups as inline SVG or as a Figma frame with a component export.

---

## Downstream implementation notes (for Cursor Code, later)

- Route + component: `web/src/pages/LoginPage.tsx` — refactor the existing file, don't create a new one
- Backend supports: `POST /api/auth/login` (email/username/phone + password), `POST /api/auth/oauth/:provider/start` (needs to be added; only email/OTP exist today per backend audit)
- New backend work required: OAuth handshake routes for google/apple/facebook, identifier resolution across email/username/phone, unique-username table with reserved-words list
- Feedback log reference: `SCREEN_MATRIX_FEEDBACK.md` entry `2026-09-03 — Signup & signin identity paths`
