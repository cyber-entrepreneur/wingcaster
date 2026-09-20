import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Info, Wrench, X } from 'lucide-react'
import { api, type PlatformStatusLevel, type PlatformStatusNotice } from '@/api/client'
import { useLocale, type AppLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'

/** SHR-ERR-005 — how often the global banner re-polls GET /api/status. */
export const PLATFORM_STATUS_POLL_MS = 60_000

const DISMISS_STORAGE_KEY = 'wingcaster.status.dismissed'

const COPY: Record<'region' | 'learnMore' | 'dismiss', Record<AppLocale, string>> = {
  region: { en: 'Platform status', ar: 'حالة المنصة' },
  learnMore: { en: 'Learn more', ar: 'اعرف المزيد' },
  dismiss: { en: 'Dismiss', ar: 'إغلاق' },
}

/**
 * Per-level chrome. `info` is a calm neutral strip; `degraded` warns; a
 * `maintenance` outage is the loudest (danger tokens). All three use only
 * `--lc-*` semantics so light/dark + RTL come for free.
 */
const LEVEL_STYLES: Record<
  PlatformStatusLevel,
  { container: string; glyph: typeof Info; role: 'status' | 'alert' }
> = {
  info: {
    container:
      'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-primary)] border-b border-[var(--lc-border)]',
    glyph: Info,
    role: 'status',
  },
  degraded: {
    container: 'bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]',
    glyph: AlertTriangle,
    role: 'status',
  },
  maintenance: {
    container: 'bg-[var(--lc-status-danger-bg)] text-[var(--lc-status-danger-fg)]',
    glyph: Wrench,
    role: 'alert',
  },
}

/** Stable per-revision key: an edited notice (new updated_at) resurfaces. */
function dismissKey(notice: PlatformStatusNotice): string {
  return `${notice.id}::${notice.updated_at}`
}

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

function writeDismissed(keys: Set<string>): void {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...keys]))
  } catch {
    /* private-mode browsers: dismissal simply won't persist across reloads */
  }
}

export interface PlatformStatusBannerProps {
  className?: string
  /** Test seam — defaults to the real 60s cadence. Set 0 to disable polling. */
  pollMs?: number
}

/**
 * SHR-ERR-005 — Maintenance / degraded banner.
 *
 * Renders atop every screen (mounted once in the app shell). Polls the public
 * `GET /api/status` and surfaces the single highest-severity live notice as a
 * full-width strip with a dismiss control and an optional "Learn more" link.
 * Renders nothing when the platform is healthy, the request fails, or the
 * active notice has already been dismissed — a status banner must never be the
 * thing that breaks the page.
 */
export function PlatformStatusBanner({ className, pollMs = PLATFORM_STATUS_POLL_MS }: PlatformStatusBannerProps) {
  const { locale, dir } = useLocale()
  const [notices, setNotices] = useState<PlatformStatusNotice[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed())
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await api.getPlatformStatus()
      if (mountedRef.current) setNotices(Array.isArray(res?.notices) ? res.notices : [])
    } catch {
      // Non-critical surface: swallow errors and keep the last known state.
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void load()
    if (!pollMs) return () => { mountedRef.current = false }
    const timer = setInterval(() => void load(), pollMs)
    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [load, pollMs])

  const active = notices.find((notice) => !dismissed.has(dismissKey(notice)))

  const onDismiss = useCallback(() => {
    if (!active) return
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(dismissKey(active))
      writeDismissed(next)
      return next
    })
  }, [active])

  if (!active) return null

  const style = LEVEL_STYLES[active.status] ?? LEVEL_STYLES.info
  const Glyph = style.glyph

  return (
    <div
      dir={dir}
      role={style.role}
      aria-live={style.role === 'alert' ? 'assertive' : 'polite'}
      aria-label={COPY.region[locale]}
      data-testid="platform-status-banner"
      data-level={active.status}
      className={cn('w-full font-[family-name:var(--lc-font-ui)]', style.container, className)}
    >
      <div className="mx-auto flex w-full max-w-[1440px] items-start gap-[var(--lc-space-sm)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
        <Glyph className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-[length:var(--lc-type-body-sm)]">
          <p className="font-semibold">{active.title}</p>
          {active.body ? <p className="mt-0.5 break-words opacity-90">{active.body}</p> : null}
          {active.learn_more_url ? (
            <a
              href={active.learn_more_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex font-semibold underline underline-offset-2"
            >
              {COPY.learnMore[locale]}
            </a>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={COPY.dismiss[locale]}
          className={cn(
            'ms-auto inline-flex shrink-0 items-center justify-center rounded-[var(--lc-radius-md)]',
            'min-h-[var(--lc-tap-target-min)] min-w-[var(--lc-tap-target-min)]',
            'hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current',
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
