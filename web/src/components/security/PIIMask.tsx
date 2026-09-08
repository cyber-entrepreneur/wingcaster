import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * PII field kinds supported by `<PIIMask>`.
 * Core set from PA-ACR-001; `user_agent` + `evidence_filename` from PA-ACR-002.
 */
export type PIIMaskKind =
  | 'email'
  | 'phone'
  | 'username'
  | 'name'
  | 'ip'
  | 'user_agent'
  | 'evidence_filename'

/**
 * Audit context forwarded via `onReveal`. Parent screens POST to reveal-audit
 * (e.g. `[BE-ACR-06]`); this primitive never writes audit logs itself.
 */
export interface PIIMaskAuditContext {
  /** Case / request id the reveal applies to. */
  caseId: string
  /** Field key recorded in the audit event (`email`, `phone`, `ip`, …). */
  field: string
}

export interface PIIMaskProps {
  /**
   * Plaintext value shown only after reveal succeeds.
   * Never render this in skeletons, URLs, or error toasts.
   */
  value: string
  /**
   * Server-precomputed masked display (preferred). When omitted, a local
   * stub mask is derived from `value` + `kind` for preview/dev only.
   */
  maskedValue?: string
  /** Identifier kind — drives aria-label + default mask shape. */
  kind: PIIMaskKind
  /** Context passed to `onReveal` for the parent audit call. */
  auditContext: PIIMaskAuditContext
  /**
   * Stub audit hook — called before unmask.
   * Used by: PA-ACR-001/002, PA-USR-*, PA-SUP-*, PA-KYC-*.
   * Do NOT write real audit logs inside this component.
   * Return a rejected promise (or throw) to block reveal (e.g. rate-limit).
   */
  onReveal?: (ctx: PIIMaskAuditContext & { kind: PIIMaskKind }) => void | Promise<void>
  /**
   * Auto re-mask window in ms. PA-ACR-001/002: 30_000.
   * Set `0` to disable auto re-mask (tests only).
   */
  revealDurationMs?: number
  /** Optional controlled revealed state. When set, component is controlled. */
  revealed?: boolean
  /** Controlled reveal change callback. */
  onRevealedChange?: (revealed: boolean) => void
  className?: string
}

function fallbackMask(value: string, kind: PIIMaskKind): string {
  const v = value.trim()
  if (!v) return '••••'
  switch (kind) {
    case 'email': {
      const at = v.indexOf('@')
      if (at <= 0) return `${v[0] ?? '*'}***`
      const local = v.slice(0, at)
      const domain = v.slice(at + 1)
      const domainMasked = domain.replace(/[^.]+/g, (part) =>
        part.length <= 2 ? '*'.repeat(part.length) : `${'*'.repeat(Math.min(8, part.length))}`,
      )
      return `${local[0] ?? '*'}***@${domainMasked}`
    }
    case 'phone':
      if (v.length < 4) return '*'.repeat(v.length)
      return `${v.slice(0, 4)}${'*'.repeat(Math.max(3, v.length - 6))}${v.slice(-2)}`
    case 'name': {
      const parts = v.split(/\s+/).filter(Boolean)
      return parts
        .map((p, i) => (i === 0 ? `${p[0] ?? ''}*****` : p.length <= 1 ? '*' : `${p[0] ?? ''}***`))
        .join(' ')
    }
    case 'username':
      return v.length <= 4
        ? '*'.repeat(v.length)
        : `${v.slice(0, 2)}${'*'.repeat(Math.min(4, v.length - 4))}${v.slice(-2)}`
    case 'ip':
      return v.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.XXX.XXX')
    case 'user_agent':
      return v.length > 24 ? `${v.slice(0, 18)}…` : v
    case 'evidence_filename': {
      const dot = v.lastIndexOf('.')
      if (dot <= 0) return `${v[0] ?? '*'}****`
      return `${v[0] ?? '*'}****${v.slice(dot)}`
    }
    default:
      return '••••••••'
  }
}

/**
 * Masked-by-default PII cell with click-to-reveal + stub audit callback.
 *
 * Used by: PA-ACR-001 (queue), PA-ACR-002 (detail), and reusable across
 * PA-USR-*, PA-SUP-*, PA-KYC-* support surfaces.
 *
 * Invariants:
 * - Masked by default; reveal is deliberate.
 * - `onReveal` is a stub hook — parents own the real audit API.
 * - Auto re-masks after `revealDurationMs` (default 30s).
 * - Masked identifiers stay LTR via bidi isolation in RTL locales.
 * - Colors: only `var(--lc-*)` tokens.
 *
 * Stub visual + prop types only — no real audit API.
 */
export function PIIMask({
  value,
  maskedValue,
  kind,
  auditContext,
  onReveal,
  revealDurationMs = 30_000,
  revealed: revealedControlled,
  onRevealedChange,
  className,
}: PIIMaskProps) {
  const liveId = useId()
  const [internalRevealed, setInternalRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isControlled = revealedControlled !== undefined
  const revealed = isControlled ? revealedControlled : internalRevealed

  const displayMasked = maskedValue ?? fallbackMask(value, kind)

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const setRevealed = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalRevealed(next)
      onRevealedChange?.(next)
    },
    [isControlled, onRevealedChange],
  )

  const remask = useCallback(() => {
    clearTimer()
    setRevealed(false)
    setLiveMessage(`${kind} re-masked.`)
  }, [clearTimer, kind, setRevealed])

  useEffect(() => () => clearTimer(), [clearTimer])

  const handleReveal = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onReveal?.({ ...auditContext, kind })
      setRevealed(true)
      setLiveMessage(
        revealDurationMs > 0
          ? `${kind.replace('_', ' ')} revealed for ${Math.round(revealDurationMs / 1000)} seconds.`
          : `${kind.replace('_', ' ')} revealed.`,
      )
      clearTimer()
      if (revealDurationMs > 0) {
        timerRef.current = setTimeout(() => {
          remask()
        }, revealDurationMs)
      }
    } catch {
      setLiveMessage(`Couldn't record audit — reveal denied.`)
    } finally {
      setBusy(false)
    }
  }

  const handleHide = () => {
    remask()
  }

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5',
        revealed &&
          'rounded-[var(--lc-radius-md)] ring-2 ring-[var(--lc-accent-bold-edge)] ring-offset-1 ring-offset-[var(--lc-surface)]',
        className,
      )}
      data-pii-kind={kind}
      data-pii-revealed={revealed ? 'true' : 'false'}
    >
      <span
        dir="ltr"
        className={cn(
          'truncate font-[var(--lc-font-mono)] tabular-nums',
          revealed
            ? 'text-[var(--lc-text-primary)] tracking-normal'
            : 'text-[var(--lc-text-muted)] tracking-[0.05em]',
        )}
        aria-label={
          revealed
            ? undefined
            : `Masked ${kind.replace('_', ' ')} — press V or click reveal to disclose (audited)`
        }
      >
        {revealed ? value : displayMasked}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={busy}
        aria-pressed={revealed}
        aria-label={revealed ? 'Hide PII' : 'Reveal PII (audited)'}
        title={revealed ? 'Hide PII' : 'Reveal PII (audited)'}
        className={cn(
          'h-tap w-tap shrink-0 text-[var(--lc-text-muted)]',
          'hover:text-[var(--lc-text-brand)]',
        )}
        onClick={() => {
          void (revealed ? handleHide() : handleReveal())
        }}
      >
        {revealed ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </Button>

      <span id={liveId} className="sr-only" aria-live="polite">
        {liveMessage}
      </span>
    </span>
  )
}
