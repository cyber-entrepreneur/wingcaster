import { AlertTriangle, KeySquare } from 'lucide-react'
import { Numeric } from '@/components/ui/numeric'
import { MethodRow } from '@/components/mfa/MethodRow'
import { cn } from '@/lib/utils'

export interface BackupCodesRowProps {
  /** Unused codes remaining (0–10). */
  remaining: number
  /** Total codes in a set (default 10). */
  total?: number
  /** Warning threshold inclusive — default ≤2 per SHR-MFA-001. */
  warningThreshold?: number
  onManage?: () => void
  className?: string
}

/**
 * Backup-codes method row with low / empty warning tone logic.
 *
 * Used by: SHR-MFA-001. Composes `<MethodRow>` + `<Numeric>`.
 * Invariant: ≤ `warningThreshold` → warning tone; `0` → danger tone.
 * Stub visual only.
 */
export function BackupCodesRow({
  remaining,
  total = 10,
  warningThreshold = 2,
  onManage,
  className,
}: BackupCodesRowProps) {
  const tone =
    remaining <= 0 ? 'danger' : remaining <= warningThreshold ? 'warning' : 'default'

  const meta =
    remaining <= 0 ? (
      <span className="inline-flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        You have no backup codes left. Regenerate now.
      </span>
    ) : remaining <= warningThreshold ? (
      <span className="inline-flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Only <Numeric>{remaining}</Numeric> codes left. Regenerate them soon.
      </span>
    ) : (
      <span>
        <Numeric>{remaining}</Numeric> of <Numeric>{total}</Numeric> codes remaining
      </span>
    )

  return (
    <MethodRow
      className={cn(className)}
      icon={<KeySquare className="h-5 w-5" />}
      label="Backup codes"
      meta={meta}
      tone={tone}
      actionLabel="Manage"
      actionAriaLabel="Manage backup codes"
      onAction={onManage}
    />
  )
}
