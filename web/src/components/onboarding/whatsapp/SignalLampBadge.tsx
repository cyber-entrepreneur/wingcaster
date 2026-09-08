import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type SignalLampState = 'listening' | 'reconnecting' | 'offline' | 'live-broadcast'

export interface SignalLampBadgeProps {
  state: SignalLampState
  /** Visible label (parent supplies i18n). e.g. "Live — connected to …". */
  label?: string
  /** Optional masked E.164 rendered via `<Numeric>`. */
  phoneE164Masked?: string
  className?: string
}

const STATE_LABEL: Record<SignalLampState, string> = {
  listening: 'Listening',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
  'live-broadcast': 'Live',
}

/**
 * Live / reconnect / offline signal lamp for WhatsApp intake waiting.
 *
 * **Importer-restricted:** only AGT-WLB-003 (`WhatsAppWaitingPage`) and
 * AGT-DSH-001 (dashboard attention card) may import this module.
 * Guard with an assertion test that limits importers to those two files.
 *
 * Used by: AGT-WLB-003, AGT-DSH-001.
 *
 * Stub visual + prop types only — no real binding poll.
 */
export function SignalLampBadge({
  state,
  label,
  phoneE164Masked,
  className,
}: SignalLampBadgeProps) {
  const pulse =
    state === 'listening' || state === 'live-broadcast' || state === 'reconnecting'
  const offline = state === 'offline'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-[var(--lc-radius-md)]',
        'px-[var(--lc-space-sm)] py-1',
        'text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]',
        className,
      )}
      data-signal-lamp-state={state}
    >
      <span
        aria-hidden
        className={cn(
          'h-3 w-3 shrink-0 rounded-full outline outline-1',
          offline
            ? 'bg-[var(--lc-text-muted)] outline-[var(--lc-border-strong)]'
            : 'bg-[var(--lc-accent-bold)] outline-[var(--lc-accent-bold-edge)]',
          pulse &&
            'motion-safe:animate-pulse motion-safe:[animation-duration:var(--lc-duration-slow)]',
        )}
      />
      <span>
        {label ?? STATE_LABEL[state]}
        {phoneE164Masked ? (
          <>
            {' '}
            <Numeric>{phoneE164Masked}</Numeric>
          </>
        ) : null}
      </span>
    </div>
  )
}
