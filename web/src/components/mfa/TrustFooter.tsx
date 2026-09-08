import { cn } from '@/lib/utils'

export interface TrustFooterProps {
  /**
   * Footer copy. Parent supplies i18n.
   * Defaults match SHR-MFA-004 idle trust line.
   */
  children?: string
  className?: string
}

/**
 * Small trust / reassurance footer under MFA + auth challenge forms.
 *
 * Used by: SHR-MFA-004, SHR-MFA-004b, SHR-AUT-001, SHR-AUT-006.
 * Tokens: `--lc-type-caption` + `--lc-text-muted`.
 */
export function TrustFooter({
  children = 'This code protects your account. It changes every 30 seconds.',
  className,
}: TrustFooterProps) {
  return (
    <p
      className={cn(
        'text-center font-[family-name:var(--lc-font-ui)]',
        'text-[length:var(--lc-type-caption)] tracking-[var(--lc-tracking-caption)]',
        'text-[var(--lc-text-muted)]',
        className,
      )}
    >
      {children}
    </p>
  )
}
