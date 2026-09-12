import { type ReactNode } from 'react'
import { Check, Compass, Loader2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsProCapable } from '@/hooks/useIsProCapable'
import { useUiMode, type UiMode } from '@/hooks/useUiMode'
import { useToast } from '@/components/ui/toast'

const COPY = {
  title: 'Interface mode',
  guidedCurrent: "You're in Guided mode",
  proCurrent: "You're in Pro mode",
  guidedLabel: 'Guided',
  guidedPitch: 'Big buttons, one decision at a time, plain language. All features available.',
  guidedBestFor: 'Best for: new users, occasional use, or when you want the simplest path.',
  proLabel: 'Pro',
  proPitch: 'Dense tables, keyboard shortcuts, bulk actions, saved views. All the same features.',
  proBestFor: 'Best for: power users, high listing volume, or when you value speed over hand-holding.',
  helper: 'You can switch anytime. Your preference syncs across devices.',
  mobileHelper:
    'Pro mode is available on tablet or larger screens (≥768px). Your preference is saved either way.',
  renderingGuided: 'Rendering Guided at this size',
} as const

export interface InterfaceModeCardProps {
  className?: string
  /** Test override for viewport gate. */
  forceProCapable?: boolean
  id?: string
}

/**
 * AGT-SET-002 — Guided ↔ Pro picker for settings.
 * Persists to tenant_memberships.data.ui_mode (per active tenant).
 */
export function InterfaceModeCard({
  className,
  forceProCapable,
  id = 'interface-mode',
}: InterfaceModeCardProps) {
  const { mode, setMode, switching, isProCapable } = useUiMode({ forceProCapable })
  const capable = useIsProCapable(forceProCapable)
  const { addToast } = useToast()
  const proDisabled = !capable

  const onSelect = async (next: UiMode) => {
    if (next === mode) return
    if (next === 'pro' && proDisabled) return
    const result = await setMode(next)
    if (result.ok) {
      addToast({
        title: `Switched to ${next === 'pro' ? 'Pro' : 'Guided'} mode.`,
        variant: 'success',
      })
    } else {
      addToast({
        title: "Couldn't switch modes. Try again?",
        description: result.error,
        variant: 'error',
      })
    }
  }

  return (
    <section
      id={id}
      data-testid="interface-mode-card"
      className={cn(
        'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]',
        className,
      )}
    >
      <div className="mb-[var(--lc-space-md)] flex flex-wrap items-baseline justify-between gap-[var(--lc-space-sm)]">
        <h2
          id={`${id}-title`}
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-2)', letterSpacing: 'var(--lc-tracking-heading-2)' }}
        >
          {COPY.title}
        </h2>
        <p
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-3)', letterSpacing: 'var(--lc-tracking-heading-3)' }}
          aria-live="polite"
        >
          <span aria-hidden="true">{mode === 'pro' ? '◆' : '○'}</span>{' '}
          {mode === 'pro' ? COPY.proCurrent : COPY.guidedCurrent}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${id}-title`}
        className="grid gap-[var(--lc-space-md)] md:grid-cols-2"
      >
        <ModeOption
          value="guided"
          selected={mode === 'guided'}
          disabled={switching}
          switching={switching && mode === 'guided'}
          icon={<Compass className="h-4 w-4" aria-hidden="true" />}
          label={COPY.guidedLabel}
          pitch={COPY.guidedPitch}
          bestFor={COPY.guidedBestFor}
          onSelect={onSelect}
        />
        <ModeOption
          value="pro"
          selected={mode === 'pro'}
          disabled={switching || proDisabled}
          switching={switching && mode === 'pro'}
          icon={<Zap className="h-4 w-4" aria-hidden="true" />}
          label={COPY.proLabel}
          pitch={COPY.proPitch}
          bestFor={COPY.proBestFor}
          onSelect={onSelect}
          helper={proDisabled ? COPY.mobileHelper : undefined}
          badge={mode === 'pro' && !isProCapable ? COPY.renderingGuided : undefined}
        />
      </div>

      <p
        className="mt-[var(--lc-space-md)] text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-body-sm)' }}
      >
        {COPY.helper}
      </p>
    </section>
  )
}

function ModeOption({
  value,
  selected,
  disabled,
  switching,
  icon,
  label,
  pitch,
  bestFor,
  onSelect,
  helper,
  badge,
}: {
  value: UiMode
  selected: boolean
  disabled?: boolean
  switching?: boolean
  icon: ReactNode
  label: string
  pitch: string
  bestFor: string
  onSelect: (mode: UiMode) => void
  helper?: string
  badge?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => onSelect(value)}
      className={cn(
        'relative min-h-tap rounded-[var(--lc-radius-lg)] p-[var(--lc-space-md)] text-start transition-colors duration-[var(--lc-duration-fast)]',
        selected
          ? 'border-2 border-[var(--lc-action-primary)] bg-[var(--lc-surface-selected)]'
          : 'border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
        disabled && !selected ? 'cursor-not-allowed opacity-50' : null,
      )}
    >
      {selected ? (
        <span className="absolute end-[var(--lc-space-sm)] top-[var(--lc-space-sm)] text-[var(--lc-action-primary)]">
          {switching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
      ) : null}

      <div className="mb-[var(--lc-space-sm)] flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lc-surface-sunken)] text-[var(--lc-text-heading)]">
        {icon}
      </div>
      <div
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-3)', letterSpacing: 'var(--lc-tracking-heading-3)' }}
      >
        {label}
      </div>
      <p className="mt-[var(--lc-space-2xs)] text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
        {pitch}
      </p>
      <p className="mt-[var(--lc-space-xs)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
        {bestFor}
      </p>
      {badge ? (
        <p
          className="mt-[var(--lc-space-xs)] text-[var(--lc-text-brand)]"
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {badge}
        </p>
      ) : null}
      {helper ? (
        <p
          className="mt-[var(--lc-space-xs)] text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {helper}
        </p>
      ) : null}
    </button>
  )
}
