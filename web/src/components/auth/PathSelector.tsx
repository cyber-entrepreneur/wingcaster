import { Building2, Check, User, Users } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { rt, type RegisterLocale, type RegistrationPath } from './registerCopy'

export type PathSelectorProps = {
  value: RegistrationPath | null
  onChange: (path: RegistrationPath) => void
  locale?: RegisterLocale
  disabled?: boolean
  className?: string
}

const PATHS: Array<{
  id: RegistrationPath
  Icon: typeof User
  labelKey: 'path.solo.label' | 'path.join.label' | 'path.agency.label'
  descKey: 'path.solo.desc' | 'path.join.desc' | 'path.agency.desc'
}> = [
  { id: 'solo', Icon: User, labelKey: 'path.solo.label', descKey: 'path.solo.desc' },
  { id: 'join', Icon: Users, labelKey: 'path.join.label', descKey: 'path.join.desc' },
  { id: 'agency', Icon: Building2, labelKey: 'path.agency.label', descKey: 'path.agency.desc' },
]

/**
 * SHR-AUT-006 Step 1 — three-card radio group for registration path.
 * Desktop: 3-column grid. Mobile: stacked rows.
 */
export function PathSelector({
  value,
  onChange,
  locale = 'en',
  disabled = false,
  className,
}: PathSelectorProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const idx = value ? PATHS.findIndex((p) => p.id === value) : -1
    let next = idx
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      next = (idx + 1 + PATHS.length) % PATHS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      next = (idx - 1 + PATHS.length) % PATHS.length
    } else {
      return
    }
    onChange(PATHS[next].id)
  }

  return (
    <div className={cn('flex flex-col gap-[var(--lc-space-sm)]', className)}>
      <h2
        id="path-selector-heading"
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-3)', letterSpacing: 'var(--lc-tracking-heading-3)' }}
      >
        {rt('path.heading', locale)}
      </h2>

      <div
        role="radiogroup"
        aria-labelledby="path-selector-heading"
        className="grid grid-cols-1 gap-[var(--lc-space-sm)] md:grid-cols-3"
        onKeyDown={onKeyDown}
      >
        {PATHS.map(({ id, Icon, labelKey, descKey }) => {
          const selected = value === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              data-testid={`path-card-${id}`}
              className={cn(
                'relative flex min-h-[var(--lc-tap-target-min)] flex-col items-start gap-[var(--lc-space-xs)]',
                'rounded-[var(--lc-radius-lg)] p-[var(--lc-space-md)] text-start',
                'bg-[var(--lc-surface-raised)] transition-[border-color,background-color] duration-[var(--lc-duration-fast)] ease-out',
                'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                selected
                  ? 'border-2 border-[var(--lc-action-primary)]'
                  : 'border border-[var(--lc-border)]',
              )}
              style={
                selected
                  ? {
                      background:
                        'color-mix(in srgb, var(--lc-action-primary) 8%, var(--lc-surface-raised))',
                    }
                  : undefined
              }
              onClick={() => onChange(id)}
            >
              {selected ? (
                <Check
                  className="absolute end-[var(--lc-space-sm)] top-[var(--lc-space-sm)] h-4 w-4 text-[var(--lc-action-primary)]"
                  aria-hidden
                />
              ) : null}
              <Icon className="h-6 w-6 text-[var(--lc-text-heading)]" aria-hidden />
              <span
                className="text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-body-lg)', fontWeight: 600 }}
              >
                {rt(labelKey, locale)}
              </span>
              <span
                className="text-[var(--lc-text-muted)]"
                style={{ font: 'var(--lc-type-body-sm)' }}
              >
                {rt(descKey, locale)}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
        {rt('path.helper', locale)}
      </p>

      <span className="sr-only" aria-live="polite">
        {value === 'solo'
          ? rt('path.announce.solo', locale)
          : value === 'join'
            ? rt('path.announce.join', locale)
            : value === 'agency'
              ? rt('path.announce.agency', locale)
              : ''}
      </span>
    </div>
  )
}
