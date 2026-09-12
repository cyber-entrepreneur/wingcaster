import { useEffect, useMemo, useState } from 'react'
import { Check, Clipboard, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export interface WhatsAppHandshakePanelProps {
  /** e.g. `"WC-A4K9-JAMIL"` — human-hint + parseable form. */
  displayCode: string
  /** e.g. `"+971 4 XXX XXXX"` — formatted for display. */
  sharedNumberE164: string
  /** ISO 8601 — drives the countdown pill. */
  expiresAt: string
  /** "I didn't get it" → re-issue activation code (parent owns the POST). */
  onRegenerate: () => Promise<void>
  regenerating?: boolean
  className?: string
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Activation code + shared-number handshake block with QR placeholder,
 * copy, tel/wa.me link, and expiry countdown.
 *
 * Used by: AGT-WLB-002 (primary); future settings re-issue flows.
 *
 * Stub visual + prop types only — no real WhatsApp bind / QR encoding.
 */
export function WhatsAppHandshakePanel({
  displayCode,
  sharedNumberE164,
  expiresAt,
  onRegenerate,
  regenerating = false,
  className,
}: WhatsAppHandshakePanelProps) {
  const [copied, setCopied] = useState(false)
  const [remainingMs, setRemainingMs] = useState(() => Date.parse(expiresAt) - Date.now())

  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60_000))
  // AGT-WLB-002: announce expiry once per minute, not every ticking second.
  const minuteAnnouncement =
    remainingMs <= 0
      ? 'Activation code expired'
      : `Expires in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`

  const waMeHref = useMemo(() => {
    const n = digitsOnly(sharedNumberE164)
    return `https://wa.me/${n}?text=${encodeURIComponent(displayCode)}`
  }, [displayCode, sharedNumberE164])

  const telHref = useMemo(() => `tel:+${digitsOnly(sharedNumberE164)}`, [sharedNumberE164])

  useEffect(() => {
    setRemainingMs(Date.parse(expiresAt) - Date.now())
    const id = window.setInterval(() => {
      setRemainingMs(Date.parse(expiresAt) - Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section
      className={cn(
        'grid gap-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)]',
        'bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-md)]',
        'md:grid-cols-[3fr_2fr]',
        className,
      )}
    >
      <div className="flex flex-col gap-[var(--lc-space-md)]">
        <section aria-labelledby="handshake-code-label">
          <div className="mb-[var(--lc-space-sm)] flex flex-wrap items-center gap-2">
            <p
              id="handshake-code-label"
              className="text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]"
            >
              Your activation code
            </p>
            <Badge variant="outline">
              Expires in{' '}
              <Numeric className="ms-1 font-mono tabular-nums">
                {formatCountdown(remainingMs)}
              </Numeric>
            </Badge>
            <span className="sr-only" aria-live="polite" aria-atomic="true" data-handshake-live>
              {minuteAnnouncement}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Numeric
              as="p"
              className={cn(
                'select-all font-mono text-[length:var(--lc-type-display)] tabular-nums',
                'text-[var(--lc-text-primary)]',
              )}
            >
              {displayCode}
            </Numeric>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Copy activation code to clipboard"
              onClick={() => void handleCopy()}
            >
              {copied ? (
                <>
                  <Check className="me-1 h-4 w-4" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Clipboard className="me-1 h-4 w-4" aria-hidden />
                  Copy
                </>
              )}
            </Button>
          </div>
        </section>

        <div>
          <p className="mb-[var(--lc-space-sm)] text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">
            Send it to this WhatsApp number
          </p>
          <a
            href={waMeHref}
            className={cn(
              'inline-block font-mono text-[length:var(--lc-type-heading-2)]',
              'text-[var(--lc-text-brand)] underline-offset-4 hover:underline md:hidden',
            )}
          >
            <Numeric>{sharedNumberE164}</Numeric>
          </a>
          <a
            href={telHref}
            className={cn(
              'hidden font-mono text-[length:var(--lc-type-heading-2)]',
              'text-[var(--lc-text-brand)] underline-offset-4 hover:underline md:inline-block',
            )}
          >
            <Numeric>{sharedNumberE164}</Numeric>
          </a>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="self-start"
          disabled={regenerating}
          onClick={() => void onRegenerate()}
        >
          {regenerating ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
              Getting a fresh code…
            </>
          ) : (
            "I didn't get it"
          )}
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center gap-[var(--lc-space-sm)]">
        {/* QR encoding stub — real wa.me QR lands in the consumer wave. */}
        <div
          role="img"
          aria-label="QR code placeholder for WhatsApp deep link"
          className={cn(
            'flex h-[200px] w-[200px] items-center justify-center',
            'rounded-[var(--lc-radius-md)] border border-dashed border-[var(--lc-border-strong)]',
            'bg-[var(--lc-surface-sunken)] text-center text-sm text-[var(--lc-text-muted)]',
          )}
        >
          QR placeholder
        </div>
        <p className="text-center text-sm text-[var(--lc-text-muted)]">
          Or scan from another phone.
        </p>
      </div>
    </section>
  )
}
