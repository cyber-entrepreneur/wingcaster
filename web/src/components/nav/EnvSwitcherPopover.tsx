import { useState, type ReactNode } from 'react'
import { Check, Loader2, Radio, TestTube } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EnvBadge, envCopy } from '@/components/nav/EnvBadge'
import { EnvSwitchConfirmDialog } from '@/components/nav/EnvSwitchConfirmDialog'
import { useToast } from '@/components/ui/toast'
import { useEnv, type WingcasterEnv } from '@/hooks/useEnv'
import { useLocale, type AppLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'

export interface EnvSwitcherPopoverProps {
  env: WingcasterEnv
  locale?: AppLocale
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Called when PA picks an option. Parent must gate LIVE-bound via confirm dialog. */
  onSelect: (target: WingcasterEnv) => void
  disabled?: boolean
  className?: string
  align?: 'start' | 'center' | 'end'
}

/**
 * PA-NAV-001 — LIVE / TEST option popover anchored under EnvBadge.
 * Uses Radix DropdownMenu (popover primitive already in the app).
 */
export function EnvSwitcherPopover({
  env,
  locale = 'en',
  open,
  onOpenChange,
  onSelect,
  disabled = false,
  className,
  align = 'start',
}: EnvSwitcherPopoverProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <EnvBadge env={env} locale={locale} className={className} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className={cn(
          'z-dropdown w-[320px] p-[var(--lc-space-xs)]',
          'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
          'bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]',
          'shadow-[var(--lc-elevation-md)]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
        )}
      >
        <div role="radiogroup" aria-label={envCopy('badge.aria.live', locale).split('.')[0]}>
          <EnvOptionRow
            value="live"
            active={env === 'live'}
            locale={locale}
            icon={
              <Radio
                className="h-4 w-4 text-[var(--lc-status-published-dot)]"
                aria-hidden="true"
              />
            }
            label={envCopy('popover.row.live.label', locale)}
            description={envCopy('popover.row.live.desc', locale)}
            onSelect={() => onSelect('live')}
          />
          <EnvOptionRow
            value="test"
            active={env === 'test'}
            locale={locale}
            icon={
              <TestTube
                className="h-4 w-4 text-[var(--lc-status-underOffer-dot)]"
                aria-hidden="true"
              />
            }
            label={envCopy('popover.row.test.label', locale)}
            description={envCopy('popover.row.test.desc', locale)}
            onSelect={() => onSelect('test')}
          />
        </div>
        <p
          className={cn(
            'mt-[var(--lc-space-xs)] px-[var(--lc-space-xs)] pt-[var(--lc-space-2xs)]',
            'border-t border-[var(--lc-border)]',
            'font-[var(--lc-type-caption)] tracking-[var(--lc-tracking-caption)]',
            'text-[var(--lc-text-muted)]',
          )}
        >
          {envCopy('popover.footer.note', locale)}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EnvOptionRow({
  value,
  active,
  locale: _locale,
  icon,
  label,
  description,
  onSelect,
}: {
  value: WingcasterEnv
  active: boolean
  locale: AppLocale
  icon: ReactNode
  label: string
  description: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-env={value}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-[var(--lc-space-sm)]',
        'rounded-[var(--lc-radius-sm)] px-[var(--lc-space-sm)] py-[var(--lc-space-xs)]',
        'text-start text-[var(--lc-text-primary)]',
        'transition-colors duration-[var(--lc-duration-fast)] ease-[var(--lc-easing-out)]',
        'motion-reduce:transition-none',
        'focus-visible:outline-none',
        'hover:bg-[var(--lc-action-secondary)]',
        active && 'bg-[var(--lc-action-secondary)]',
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-5">{label}</span>
        <span
          className={cn(
            'block font-[var(--lc-type-caption)] tracking-[var(--lc-tracking-caption)]',
            'text-[var(--lc-text-muted)]',
          )}
        >
          {description}
        </span>
      </span>
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden={!active}>
        {active ? (
          <Check className="h-4 w-4 text-[var(--lc-status-published-dot)]" aria-hidden="true" />
        ) : null}
      </span>
    </button>
  )
}

function EnvSwitchingOverlay({ locale }: { locale: AppLocale }) {
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center lc-overlay"
      role="status"
      aria-live="assertive"
    >
      <div
        className={cn(
          'flex items-center gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)]',
          'bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
          'shadow-[var(--lc-elevation-md)] text-[var(--lc-text-primary)]',
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="font-[var(--lc-type-body)]">{envCopy('switching.label', locale)}</span>
      </div>
    </div>
  )
}

export interface PaEnvSwitcherProps {
  className?: string
}

/**
 * Top-bar entry for PA-NAV-001: badge + popover + LIVE confirm dialog + overlay.
 * PA persona only — mount from TopBar when persona === 'pa'.
 */
export function PaEnvSwitcher({ className }: PaEnvSwitcherProps) {
  const { locale } = useLocale()
  const { addToast } = useToast()
  const {
    env,
    switching,
    confirmLiveOpen,
    sessionChangedElsewhere,
    error,
    selectEnv,
    confirmSwitchToLive,
    closeLiveConfirm,
  } = useEnv()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const handleSelect = async (target: WingcasterEnv) => {
    setPopoverOpen(false)
    try {
      await selectEnv(target)
      if (target === 'test') {
        addToast({
          variant: 'success',
          description: envCopy('toast.switched.test', locale),
        })
      }
    } catch {
      addToast({
        variant: 'error',
        description: envCopy('error.switchFailed', locale),
      })
    }
  }

  const handleConfirm = async () => {
    try {
      await confirmSwitchToLive({ confirmed: true })
      addToast({
        variant: 'success',
        description: envCopy('toast.switched.live', locale),
      })
    } catch {
      addToast({
        variant: 'error',
        description: envCopy('error.switchFailed', locale),
      })
    }
  }

  return (
    <>
      <EnvSwitcherPopover
        env={env}
        locale={locale}
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        onSelect={(target) => void handleSelect(target)}
        disabled={switching}
        className={className}
      />
      <EnvSwitchConfirmDialog
        open={confirmLiveOpen}
        locale={locale}
        switching={switching}
        error={error}
        sessionChangedElsewhere={sessionChangedElsewhere}
        onOpenChange={(next) => {
          if (!next) closeLiveConfirm()
        }}
        onConfirm={handleConfirm}
      />
      {switching ? <EnvSwitchingOverlay locale={locale} /> : null}
    </>
  )
}
