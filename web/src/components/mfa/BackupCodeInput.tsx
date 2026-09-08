import { useId, type ChangeEvent } from 'react'
import { cn } from '@/lib/utils'

export interface BackupCodeInputProps {
  /** Controlled display value (may include dashes). */
  value?: string
  /**
   * Fires with both the formatted display string and a normalized
   * (uppercase, dashes stripped) code for API submit.
   */
  onChange?: (formatted: string, normalized: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  placeholder?: string
  'aria-label'?: string
  id?: string
  className?: string
}

const CODE_LENGTH = 12

/**
 * Format raw alphanumeric into `XXXX-XXXX-XXXX` groups.
 * Parent should not require the user to type dashes.
 */
export function formatBackupCode(raw: string): { formatted: string; normalized: string } {
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH)
  const parts: string[] = []
  for (let i = 0; i < normalized.length; i += 4) {
    parts.push(normalized.slice(i, i + 4))
  }
  return { formatted: parts.join('-'), normalized }
}

/**
 * Single-line backup-code input with auto-uppercase + dash grouping.
 *
 * Used by: SHR-MFA-004b, SHR-MFA-006, SHR-MFA-007 (TOTP → backup fallback).
 * Stub visual + formatting only — no crypto / API.
 */
export function BackupCodeInput({
  value = '',
  onChange,
  disabled = false,
  error = false,
  autoFocus = false,
  placeholder = 'XXXX-XXXX-XXXX',
  'aria-label': ariaLabel = 'Backup code',
  id,
  className,
}: BackupCodeInputProps) {
  const reactId = useId()
  const inputId = id ?? reactId

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { formatted, normalized } = formatBackupCode(e.target.value)
    onChange?.(formatted, normalized)
  }

  return (
    <input
      id={inputId}
      type="text"
      autoComplete="off"
      spellCheck={false}
      autoFocus={autoFocus}
      disabled={disabled}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={error || undefined}
      onChange={handleChange}
      className={cn(
        'h-14 w-full max-w-[320px] px-[var(--lc-space-md)]',
        'rounded-[var(--lc-radius-md)] border-2 bg-[var(--lc-surface-raised)]',
        'font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-body-lg)] tabular-nums',
        'uppercase tracking-[0.1em] text-[var(--lc-text-primary)]',
        'border-[var(--lc-border-strong)] placeholder:text-[var(--lc-text-muted)]',
        'focus-visible:border-[var(--lc-action-primary)] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-[var(--lc-status-danger-fg)]',
        className,
      )}
      style={{ textTransform: 'uppercase' }}
    />
  )
}
