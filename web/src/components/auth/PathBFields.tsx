import { useId } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { rt, type RegisterLocale } from './registerCopy'

export type PathBFieldsProps = {
  value: string
  onChange: (slugOrCode: string) => void
  locale?: RegisterLocale
  disabled?: boolean
  error?: string
  /** Browse agencies directory — Phase 2; link still present per brief. */
  browseHref?: string
  className?: string
}

/**
 * SHR-AUT-006 Step 3 for path=join — agency slug / invitation code.
 */
export function PathBFields({
  value,
  onChange,
  locale = 'en',
  disabled = false,
  error,
  browseHref = '/agencies',
  className,
}: PathBFieldsProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--lc-space-sm)] overflow-hidden',
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1',
        'duration-[200ms] ease-out',
        className,
      )}
      data-testid="path-b-fields"
    >
      <span className="sr-only" aria-live="polite">
        {rt('pathB.revealed', locale)}
      </span>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{rt('pathB.label', locale)}</Label>
        <Input
          id={id}
          type="text"
          dir="ltr"
          autoComplete="organization"
          placeholder={rt('pathB.placeholder', locale)}
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {error ? (
          <p id={errorId} className="text-xs text-[var(--lc-status-unpublished-fg)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Link
        to={browseHref}
        className="inline-flex min-h-[var(--lc-tap-target-min)] items-center text-[var(--lc-action-primary)] underline-offset-2 hover:underline"
        style={{ font: 'var(--lc-type-body-sm)' }}
      >
        {rt('pathB.browse', locale)}
      </Link>
    </div>
  )
}
