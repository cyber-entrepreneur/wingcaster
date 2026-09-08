import { useEffect, useId, useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface RevealableSecretProps {
  /** Plaintext secret (held in React state by parent — never localStorage). */
  secret: string
  /**
   * Display grouping size for readability (default 4 → `XXXX-XXXX-…`).
   */
  groupSize?: number
  /** When true, start masked (mobile default per SHR-MFA-002). */
  initiallyRevealed?: boolean
  /** Auto-rehide after N ms once revealed. `0` disables. Default 30000. */
  rehideMs?: number
  /** Aria label for the secret text. */
  'aria-label'?: string
  copyLabel?: string
  copiedLabel?: string
  revealLabel?: string
  className?: string
}

function groupSecret(secret: string, groupSize: number): string {
  const clean = secret.replace(/\s|-/g, '')
  const parts: string[] = []
  for (let i = 0; i < clean.length; i += groupSize) {
    parts.push(clean.slice(i, i + groupSize))
  }
  return parts.join('-')
}

/**
 * Mono secret display with copy + reveal-on-tap (shoulder-surf guard).
 *
 * Used by: SHR-MFA-002 ("Can't scan?" collapsible). Reusable for future API-key surfaces.
 * Stub visual only — no TOTP crypto.
 */
export function RevealableSecret({
  secret,
  groupSize = 4,
  initiallyRevealed = false,
  rehideMs = 30_000,
  'aria-label': ariaLabel = 'TOTP secret key — read carefully',
  copyLabel = 'Copy code',
  copiedLabel = 'Copied ✓',
  revealLabel = 'Tap to reveal',
  className,
}: RevealableSecretProps) {
  const id = useId()
  const [revealed, setRevealed] = useState(initiallyRevealed)
  const [copied, setCopied] = useState(false)
  const display = groupSecret(secret, groupSize)

  useEffect(() => {
    if (!revealed || rehideMs <= 0) return
    const t = window.setTimeout(() => setRevealed(false), rehideMs)
    return () => window.clearTimeout(t)
  }, [revealed, rehideMs, secret])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Stub — parent waves may surface a toast.
    }
  }

  return (
    <div
      className={cn(
        'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]',
        className,
      )}
    >
      <div className="relative">
        <p
          id={id}
          aria-label={ariaLabel}
          className={cn(
            'break-all font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-body)]',
            'tracking-[0.05em] tabular-nums text-[var(--lc-text-primary)]',
            !revealed && 'select-none blur-sm',
          )}
        >
          {display || '————-————-————'}
        </p>

        {!revealed ? (
          <button
            type="button"
            className={cn(
              'absolute inset-0 flex items-center justify-center gap-2',
              'rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-raised)]',
              'text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]',
            )}
            onClick={() => setRevealed(true)}
          >
            <Eye className="h-4 w-4" aria-hidden />
            {revealLabel}
          </button>
        ) : null}
      </div>

      <div className="mt-[var(--lc-space-sm)] flex flex-wrap gap-[var(--lc-space-xs)]">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRevealed((v) => !v)}
          aria-controls={id}
          aria-expanded={revealed}
        >
          {revealed ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          {revealed ? 'Hide' : 'Reveal'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} disabled={!secret}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? copiedLabel : copyLabel}
        </Button>
        <span className="sr-only" aria-live="polite">
          {copied ? 'Secret copied to clipboard' : ''}
        </span>
      </div>
    </div>
  )
}
