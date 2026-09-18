import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import { api, type AccessRequestInput } from '@/api/client'
import { useLocale, type AppLocale } from '@/hooks/useLocale'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const COPY: Record<
  'title' | 'defaultReason' | 'goHome' | 'requestAccess' | 'requesting' | 'requested' | 'alreadyRequested' | 'requestError',
  Record<AppLocale, string>
> = {
  title: { en: "You don't have access to this page", ar: 'ليس لديك صلاحية الوصول إلى هذه الصفحة' },
  defaultReason: {
    en: 'Your account is signed in, but it is not permitted to view this area.',
    ar: 'تم تسجيل دخول حسابك، لكنه غير مخوّل لعرض هذا القسم.',
  },
  goHome: { en: 'Go home', ar: 'الصفحة الرئيسية' },
  requestAccess: { en: 'Request access', ar: 'طلب الوصول' },
  requesting: { en: 'Sending request…', ar: 'جارٍ إرسال الطلب…' },
  requested: { en: "Access requested — we've notified the right person.", ar: 'تم إرسال طلب الوصول — أبلغنا الشخص المختص.' },
  alreadyRequested: { en: "You've already requested access. We'll be in touch.", ar: 'لقد طلبت الوصول بالفعل. سنتواصل معك.' },
  requestError: { en: "Couldn't send the request. Please try again.", ar: 'تعذّر إرسال الطلب. حاول مرة أخرى.' },
}

type RequestState = 'idle' | 'submitting' | 'submitted' | 'already' | 'error'

export interface PermissionDeniedProps {
  /** Overrides the default headline. */
  title?: string
  /**
   * Plain-language context — e.g. "This area is for platform admins." Never
   * enumerate the resource itself; only why access is denied.
   */
  reason?: string
  /** Where the primary CTA sends the user. Defaults to the app root. */
  homeHref?: string
  /**
   * When set, renders a "Request access" action that files a persisted request
   * (POST /api/access-requests) and notifies the party who can grant it.
   */
  requestAccess?: AccessRequestInput
  className?: string
}

/**
 * SHR-ERR-002 — 403 / Permission denied.
 *
 * A calm, reusable permission-denied surface for any protected route or guard.
 * Shows why access is denied, a "Go home" CTA, and (optionally) a "Request
 * access" action wired to a real, idempotent backend request. Tokens-only,
 * RTL-correct via logical props + document direction, mobile-first.
 */
export function PermissionDenied({ title, reason, homeHref = '/', requestAccess, className }: PermissionDeniedProps) {
  const { locale, dir } = useLocale()
  const [state, setState] = useState<RequestState>('idle')

  const onRequest = useCallback(async () => {
    if (!requestAccess) return
    setState('submitting')
    try {
      const result = await api.requestAccess(requestAccess)
      setState(result.already_requested ? 'already' : 'submitted')
    } catch {
      setState('error')
    }
  }, [requestAccess])

  const done = state === 'submitted' || state === 'already'

  return (
    <div
      dir={dir}
      role="alert"
      data-testid="permission-denied"
      className={cn(
        'mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-[var(--lc-space-md)] py-[var(--lc-space-xl)] text-center',
        'font-[family-name:var(--lc-font-ui)]',
        className,
      )}
    >
      <span className="mb-[var(--lc-space-md)] inline-flex h-12 w-12 items-center justify-center rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)]">
        <ShieldAlert className="h-6 w-6 text-[var(--lc-text-muted)]" aria-hidden="true" />
      </span>

      <h1 className="text-[length:var(--lc-type-heading-2)] font-semibold text-[var(--lc-text-heading)]">
        {title ?? COPY.title[locale]}
      </h1>
      <p className="mt-[var(--lc-space-sm)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
        {reason ?? COPY.defaultReason[locale]}
      </p>

      <div className="mt-[var(--lc-space-lg)] flex w-full flex-col items-center gap-[var(--lc-space-sm)]">
        <Button asChild className="w-full sm:w-auto">
          <Link to={homeHref}>{COPY.goHome[locale]}</Link>
        </Button>

        {requestAccess && !done ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onRequest}
            disabled={state === 'submitting'}
          >
            {state === 'submitting' ? COPY.requesting[locale] : COPY.requestAccess[locale]}
          </Button>
        ) : null}

        {done ? (
          <p
            role="status"
            className="inline-flex items-center gap-[var(--lc-space-2xs)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-primary)]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--lc-status-published-fg)]" aria-hidden="true" />
            {state === 'already' ? COPY.alreadyRequested[locale] : COPY.requested[locale]}
          </p>
        ) : null}

        {state === 'error' ? (
          <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-unpublished-fg)]">
            {COPY.requestError[locale]}
          </p>
        ) : null}
      </div>
    </div>
  )
}
