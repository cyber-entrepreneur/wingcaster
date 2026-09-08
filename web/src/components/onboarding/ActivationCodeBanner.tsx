import { Check, Copy, Loader2, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/** Binding lifecycle for the activation-code card (AGT-ONB-002 B4). */
export type ActivationCodeStatus = 'pending' | 'connected' | 'expired'

export interface ActivationCodeBannerProps {
  /** Display code, e.g. `"WC-A7K3"`. */
  code: string
  /** Shared Business number E.164 / display form. Prop name matches brief. */
  shared_number: string
  /** ISO 8601 expiry. Drives countdown when `status="pending"`. */
  expires_at: string
  /** `pending` countdown · `connected` green pill · `expired` draft pill. */
  status: ActivationCodeStatus
  /** Masked agent phone shown in connected pill, e.g. `"+971 5X XXX 4321"`. */
  connectedPhoneLabel?: string
  /** Optional human countdown override (parent may tick). */
  countdownLabel?: string
  /** Copy handler — parent owns clipboard + toast. */
  onCopy?: (target: 'code' | 'number') => void
  /** Regenerate / re-poll affordance ("Check again" / get new code). */
  onCheckAgain?: () => void
  /** Loading state for regenerate / check. */
  checking?: boolean
  /** Which value was just copied (swap Copy → Check for 2s). */
  copiedTarget?: 'code' | 'number' | null
  className?: string
}

/**
 * Activation-code + shared-number banner (Broadcast B1–B4).
 *
 * Used by: AGT-ONB-002, AGT-SET-004 (WhatsApp re-bind).
 * Related: AGT-WLB-001 `<WhatsAppHandshakePanel>` (Agent 4) covers QR + tel deep-link;
 * this banner is the ONB/settings reuse surface for code + number + status.
 * Stub visual + prop types only — no polling.
 */
export function ActivationCodeBanner({
  code,
  shared_number,
  expires_at,
  status,
  connectedPhoneLabel,
  countdownLabel,
  onCopy,
  onCheckAgain,
  checking = false,
  copiedTarget = null,
  className,
}: ActivationCodeBannerProps) {
  return (
    <section
      aria-labelledby="activation-code-label"
      className={cn(
        'rounded-[var(--lc-radius-xl)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)]',
        'shadow-[var(--lc-elevation-md)]',
        className,
      )}
      data-activation-status={status}
      data-expires-at={expires_at}
    >
      <div className="mb-[var(--lc-space-md)] flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            id="activation-code-label"
            className="mb-1 text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-overline)' }}
          >
            Your activation code
          </p>
          <Numeric
            as="p"
            className="select-all text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-display)', fontFamily: 'var(--lc-font-mono)' }}
          >
            {code}
          </Numeric>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Copy activation code to clipboard"
          onClick={() => onCopy?.('code')}
        >
          {copiedTarget === 'code' ? (
            <Check className="h-4 w-4 text-[var(--lc-status-published-fg)]" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="mb-[var(--lc-space-md)] flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="mb-1 text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-overline)' }}
          >
            Send it to this WhatsApp number
          </p>
          <div className="flex items-center gap-2">
            <ChannelMark channel="whatsapp" className="h-6 w-6" />
            <Numeric
              as="p"
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-2)', fontFamily: 'var(--lc-font-mono)' }}
            >
              {shared_number}
            </Numeric>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Copy shared WhatsApp number"
          onClick={() => onCopy?.('number')}
        >
          {copiedTarget === 'number' ? (
            <Check className="h-4 w-4 text-[var(--lc-status-published-fg)]" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {status === 'pending' ? (
          <p
            className="text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
            aria-live="polite"
          >
            {countdownLabel ?? `Code expires at ${expires_at}`}
          </p>
        ) : null}

        {status === 'connected' ? (
          <Badge status="published">
            Connected{connectedPhoneLabel ? ` · ${connectedPhoneLabel}` : ''}
          </Badge>
        ) : null}

        {status === 'expired' ? (
          <Badge status="draft">Code expired · get a new one</Badge>
        ) : null}

        {onCheckAgain ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={checking}
            onClick={onCheckAgain}
          >
            {checking ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
            )}
            {status === 'expired' ? 'Get a new code' : 'Check again'}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
