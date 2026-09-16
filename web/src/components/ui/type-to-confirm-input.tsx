import { useId, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface TypeToConfirmInputProps {
  /** Server-generated phrase the user must retype exactly (case-sensitive, trimmed at ends). */
  phrase: string
  value: string
  onValueChange: (next: string) => void
  /** Label with the phrase rendered inline; pass a render-prop for the highlighted `<code>`. */
  renderLabel: (phraseNode: ReactNode) => ReactNode
  helper?: ReactNode
  mismatchText: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

/** Exact-match check: case-sensitive, only outer whitespace trimmed. */
export function phraseMatches(input: string, phrase: string): boolean {
  return input.trim() === phrase.trim()
}

/**
 * `<TypeToConfirmInput>` — reusable high-value confirmation throttle.
 *
 * Shipped by PA-APR-003; reusable across any destructive/high-value surface
 * (tenant teardown, rate-card wipe, etc.). Renders a mono input plus inline
 * validation state (neutral / mismatch / match). Never autocompletes.
 */
export function TypeToConfirmInput({
  phrase,
  value,
  onValueChange,
  renderLabel,
  helper,
  mismatchText,
  disabled = false,
  autoFocus = false,
  className,
}: TypeToConfirmInputProps) {
  const inputId = useId()
  const helperId = useId()
  const errorId = useId()

  const isEmpty = value.length === 0
  const isMatch = phraseMatches(value, phrase)
  const isMismatch = !isEmpty && !isMatch

  const phraseNode = (
    <code
      className="rounded-[var(--lc-radius-sm)] bg-[var(--lc-status-underOffer-bg)] px-1.5 py-0.5 font-[family-name:var(--lc-font-mono)] text-[var(--lc-status-underOffer-fg)]"
      dir="ltr"
    >
      {phrase}
    </code>
  )

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={inputId}>{renderLabel(phraseNode)}</Label>
      <div className="relative">
        <Input
          id={inputId}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          disabled={disabled}
          autoFocus={autoFocus}
          dir="ltr"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={isMismatch || undefined}
          aria-describedby={cn(helper ? helperId : undefined, isMismatch ? errorId : undefined)}
          className={cn(
            'font-[family-name:var(--lc-font-mono)] tabular-nums pe-9',
            isMatch && 'border-[var(--lc-status-published-fg)]',
            isMismatch && 'border-[var(--lc-status-unpublished-fg)]',
          )}
          data-ttc-state={isMatch ? 'match' : isMismatch ? 'mismatch' : 'empty'}
        />
        {isMatch ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-[var(--lc-status-published-fg)]"
          >
            <Check className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      {helper ? (
        <p id={helperId} className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          {helper}
        </p>
      ) : null}
      {isMismatch ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-[var(--lc-status-unpublished-fg)]"
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {mismatchText}
        </p>
      ) : null}
    </div>
  )
}
