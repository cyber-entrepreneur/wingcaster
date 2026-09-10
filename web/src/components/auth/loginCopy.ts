/**
 * SHR-AUT-001 explicit copy table — EN + AR.
 * Labels must match the brief exactly (no exclamation marks).
 */

export type LoginLocale = 'en' | 'ar'

export const LOGIN_COPY = {
  'page.title': {
    en: 'Sign in — Wingcaster',
    ar: 'تسجيل الدخول — وينغكاستر',
  },
  'hero.tagline': {
    en: 'Welcome back.',
    ar: 'مرحبًا بعودتك.',
  },
  'federated.heading': {
    en: 'Sign in with',
    ar: 'الدخول عبر',
  },
  'federated.google': {
    en: 'Continue with Google',
    ar: 'المتابعة عبر Google',
  },
  'federated.apple': {
    en: 'Continue with Apple',
    ar: 'المتابعة عبر Apple',
  },
  'federated.facebook': {
    en: 'Continue with Facebook',
    ar: 'المتابعة عبر Facebook',
  },
  divider: {
    en: 'or use your account',
    ar: 'أو استخدم حسابك',
  },
  'tab.email': {
    en: 'Email',
    ar: 'البريد الإلكتروني',
  },
  'tab.username': {
    en: 'Username',
    ar: 'اسم المستخدم',
  },
  'tab.phone': {
    en: 'Phone',
    ar: 'الهاتف',
  },
  'field.email.placeholder': {
    en: 'you@agency.com',
    ar: 'you@agency.com',
  },
  'field.username.placeholder': {
    en: 'sara-almansoori',
    ar: 'sara-almansoori',
  },
  'field.phone.placeholder': {
    en: '50 123 4567',
    ar: '٥٠ ١٢٣ ٤٥٦٧',
  },
  'field.password.label': {
    en: 'Password',
    ar: 'كلمة المرور',
  },
  'field.password.show': {
    en: 'Show password',
    ar: 'إظهار كلمة المرور',
  },
  'field.password.hide': {
    en: 'Hide password',
    ar: 'إخفاء كلمة المرور',
  },
  'checkbox.remember': {
    en: 'Keep me signed in on this device',
    ar: 'إبقني مسجّلًا في هذا الجهاز',
  },
  'button.signin': {
    en: 'Sign in',
    ar: 'تسجيل الدخول',
  },
  'link.forgot': {
    en: 'Forgot password?',
    ar: 'نسيت كلمة المرور؟',
  },
  'footer.noaccount': {
    en: "Don't have an account?",
    ar: 'ليس لديك حساب؟',
  },
  'footer.create': {
    en: 'Create one →',
    ar: 'أنشئ حسابًا ←',
  },
  'footer.paddle': {
    en: 'Wingcaster does not store card details. Payments processed by Paddle.',
    ar: 'لا يخزّن وينغكاستر بيانات البطاقات. المدفوعات عبر Paddle.',
  },
  'error.invalid': {
    en: 'That email/username/phone or password is incorrect.',
    ar: 'البريد أو اسم المستخدم أو الهاتف أو كلمة المرور غير صحيحة.',
  },
  'error.locked': {
    en: 'This account is temporarily locked. Try again in {minutes} minutes or reset your password.',
    ar: 'تم قفل الحساب مؤقتًا. حاول بعد {minutes} دقيقة أو أعد تعيين كلمة المرور.',
  },
  'error.rate': {
    en: 'Too many attempts. Please wait {seconds} seconds.',
    ar: 'محاولات كثيرة. يرجى الانتظار {seconds} ثانية.',
  },
  'error.network': {
    en: "We couldn't reach Wingcaster. Check your connection and try again.",
    ar: 'تعذّر الوصول إلى وينغكاستر. تحقّق من اتصالك وحاول مجددًا.',
  },
  'error.oauth.google': {
    en: 'Google sign-in was cancelled or failed. Try again or use another method.',
    ar: 'تم إلغاء تسجيل الدخول بواسطة Google أو فشل. حاول مرة أخرى أو استخدم طريقة أخرى.',
  },
  'error.oauth.apple': {
    en: 'Apple sign-in was cancelled or failed. Try again or use another method.',
    ar: 'تم إلغاء تسجيل الدخول بواسطة Apple أو فشل. حاول مرة أخرى أو استخدم طريقة أخرى.',
  },
  'error.oauth.facebook': {
    en: 'Facebook sign-in was cancelled or failed. Try again or use another method.',
    ar: 'تم إلغاء تسجيل الدخول بواسطة Facebook أو فشل. حاول مرة أخرى أو استخدم طريقة أخرى.',
  },
  'success.redirect': {
    en: 'Signing you in…',
    ar: 'جارٍ تسجيل الدخول…',
  },
  'aria.google': {
    en: 'Sign in with Google',
    ar: 'تسجيل الدخول عبر Google',
  },
  'aria.apple': {
    en: 'Sign in with Apple',
    ar: 'تسجيل الدخول عبر Apple',
  },
  'aria.facebook': {
    en: 'Sign in with Facebook',
    ar: 'تسجيل الدخول عبر Facebook',
  },
  'field.email.label': {
    en: 'Email',
    ar: 'البريد الإلكتروني',
  },
  'field.username.label': {
    en: 'Username',
    ar: 'اسم المستخدم',
  },
  'field.phone.label': {
    en: 'Phone',
    ar: 'الهاتف',
  },
  'field.phone.country': {
    en: 'Country code',
    ar: 'رمز الدولة',
  },
  'oauth.tryAgain': {
    en: 'Try again',
    ar: 'حاول مرة أخرى',
  },
  'oauth.tryAnother': {
    en: 'Try another method',
    ar: 'جرّب طريقة أخرى',
  },
  'error.retry': {
    en: 'Retry',
    ar: 'إعادة المحاولة',
  },
} as const

export type LoginCopyKey = keyof typeof LOGIN_COPY

export function t(key: LoginCopyKey, locale: LoginLocale, vars?: Record<string, string | number>): string {
  let value: string = LOGIN_COPY[key][locale]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, String(v))
    }
  }
  return value
}
