import {
  useCallback,
  useId,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { cn } from '@/lib/utils'

export interface OtpInputProps {
  /**
   * Number of digit cells. MFA briefs lock this at `6`
   * (SHR-MFA-003 / 004 / 007).
   */
  count?: number
  /** Controlled value — digit string of length 0..count. */
  value?: string
  /** Fires with the normalized digit string after each change. */
  onChange?: (value: string) => void
  /** When true, cells are non-interactive (verifying / rate-limited). */
  disabled?: boolean
  /** Error visual: danger border + optional shake class. */
  error?: boolean
  /** Autofocus the first empty cell on mount. */
  autoFocus?: boolean
  /** Accessible name for the group. Parent supplies i18n. */
  'aria-label'?: string
  className?: string
  id?: string
}

function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * 6-cell OTP code input with paste, backspace, and auto-advance.
 *
 * Used by: SHR-MFA-003, SHR-MFA-004, SHR-MFA-007 (and SHR-AUT-002).
 * Stub visual + interaction shape only — no TOTP crypto / API.
 *
 * Invariants:
 * - Cells stay LTR even in RTL layouts (Western digits from authenticator apps).
 * - Do NOT auto-submit on 6th digit — parent owns Verify.
 */
export function OtpInput({
  count = 6,
  value = '',
  onChange,
  disabled = false,
  error = false,
  autoFocus = false,
  'aria-label': ariaLabel = 'One-time code',
  className,
  id,
}: OtpInputProps) {
  const reactId = useId()
  const groupId = id ?? reactId
  const digits = onlyDigits(value).slice(0, count).padEnd(count, ' ').split('').map((c) => (c === ' ' ? '' : c))
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const emit = useCallback(
    (nextDigits: string[]) => {
      onChange?.(nextDigits.join('').slice(0, count))
    },
    [count, onChange],
  )

  const focusAt = (index: number) => {
    const el = refs.current[Math.max(0, Math.min(count - 1, index))]
    el?.focus()
    el?.select()
  }

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const raw = onlyDigits(e.target.value)
    if (!raw) {
      const next = [...digits]
      next[index] = ''
      emit(next)
      return
    }
    const next = [...digits]
    const chars = raw.split('')
    for (let i = 0; i < chars.length && index + i < count; i += 1) {
      next[index + i] = chars[i]!
    }
    emit(next)
    const advanceTo = Math.min(count - 1, index + chars.length)
    focusAt(advanceTo)
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        emit(next)
      } else if (index > 0) {
        e.preventDefault()
        const next = [...digits]
        next[index - 1] = ''
        emit(next)
        focusAt(index - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAt(index - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAt(index + 1)
    }
  }

  const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return
    e.preventDefault()
    const pasted = onlyDigits(e.clipboardData.getData('text'))
    if (!pasted) return
    const next = [...digits]
    for (let i = 0; i < pasted.length && index + i < count; i += 1) {
      next[index + i] = pasted[i]!
    }
    emit(next)
    focusAt(Math.min(count - 1, index + pasted.length))
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      id={groupId}
      dir="ltr"
      className={cn('flex gap-[var(--lc-space-xs)]', className)}
      data-otp-error={error || undefined}
    >
      {digits.map((digit, index) => (
        <input
          key={`${groupId}-${index}`}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={count}
          disabled={disabled}
          value={digit}
          aria-label={`Digit ${index + 1} of ${count}`}
          autoFocus={autoFocus && index === 0}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          className={cn(
            'h-14 w-10 text-center font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-heading-3)] tabular-nums',
            'sm:w-12',
            'rounded-[var(--lc-radius-md)] border-2 bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]',
            'border-[var(--lc-border-strong)]',
            'focus-visible:border-[var(--lc-action-primary)] focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-[var(--lc-status-danger-fg)]',
          )}
        />
      ))}
    </div>
  )
}
