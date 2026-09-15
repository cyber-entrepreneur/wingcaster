import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HelpCircle, MoreVertical } from 'lucide-react'
import { OfflineBanner } from '@/components/onboarding'
import { ColorModeToggle } from '@/components/ui/color-mode-toggle'
import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Numeric } from '@/components/ui/numeric'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { act, type ActivationLocale } from '../copy'
import { useOnlineStatus } from '../useOnlineStatus'
import { ActivationProgressBar } from './ActivationProgressBar'
import { SkipWizardDialog } from './SkipWizardDialog'

export interface ActivationChromeProps {
  breadcrumb?: { step: number; title: string }
  completed: number
  total: number
  progressSize?: 'lg' | 'sm'
  celebrate?: boolean
  children: ReactNode
  hero?: ReactNode
  footer?: ReactNode
  className?: string
  maxWidthClass?: string
}

export function ActivationChrome({
  breadcrumb,
  completed,
  total,
  progressSize = 'lg',
  celebrate = false,
  children,
  hero,
  footer,
  className,
  maxWidthClass = 'max-w-[960px]',
}: ActivationChromeProps) {
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  const [skipOpen, setSkipOpen] = useState(false)

  const skip = (
    <Button
      type="button"
      variant="link"
      className="text-[var(--lc-text-muted)]"
      onClick={() => setSkipOpen(true)}
    >
      {act('chrome.skip', locale)}
    </Button>
  )

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      <OfflineBanner show={!online} message={act('chrome.offline', locale)} />
      <header className="flex h-14 items-center justify-between border-b border-[var(--lc-border)] px-[var(--lc-space-md)]">
        <Link
          to="/dashboard"
          className="font-[family-name:var(--lc-font-display)] text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-3)' }}
        >
          {act('chrome.brand', locale)}
        </Link>
        <div className="hidden items-center gap-[var(--lc-space-sm)] md:flex">
          <LanguageSelector />
          <ColorModeToggle />
          {skip}
        </div>
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={act('chrome.more', locale)}>
                <MoreVertical className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-2">
                <LanguageSelector />
              </div>
              <div className="px-2 py-2">
                <ColorModeToggle />
              </div>
              <DropdownMenuItem onSelect={() => setSkipOpen(true)}>{act('chrome.skip', locale)}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full px-[var(--lc-space-md)] py-[var(--lc-space-xl)]',
          maxWidthClass,
          className,
        )}
      >
        {breadcrumb ? (
          <nav
            aria-label="Breadcrumb"
            className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-caption)' }}
          >
            <Link to="/activate" className="text-[var(--lc-text-brand)] hover:underline">
              {act('chrome.breadcrumb', locale)}
            </Link>
            {` ${act('chrome.breadcrumb.step', locale)} `}
            <Numeric>{breadcrumb.step}</Numeric>
            {` · ${breadcrumb.title}`}
          </nav>
        ) : null}

        {hero}

        <ActivationProgressBar
          completed={completed}
          total={total}
          size={progressSize}
          celebrate={celebrate}
          className="mb-[var(--lc-space-xl)]"
        />

        <div className={cn(!online && 'pointer-events-none opacity-60')}>{children}</div>

        {footer}
      </main>

      <SkipWizardDialog
        open={skipOpen}
        onOpenChange={setSkipOpen}
        onConfirm={() => {
          setSkipOpen(false)
          navigate('/dashboard')
        }}
      />
    </div>
  )
}

export function ActivationFooterHelper({ promoteDashboard = false }: { promoteDashboard?: boolean }) {
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  return (
    <div className="mt-[var(--lc-space-2xl)] flex flex-col gap-[var(--lc-space-sm)] border-t border-[var(--lc-border)] pt-[var(--lc-space-lg)] md:flex-row md:items-center md:justify-between">
      <Link
        to="/onboarding/welcome"
        className="inline-flex min-h-tap items-center gap-2 text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-body-sm)' }}
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
        {act('footer.guided', locale)}{' '}
        <span className="text-[var(--lc-text-brand)]">{act('footer.guided.cta', locale)}</span>
      </Link>
      <Button asChild variant={promoteDashboard ? 'default' : 'ghost'} className={promoteDashboard ? 'w-full md:w-auto' : ''}>
        <Link to="/dashboard">{act('footer.dashboard', locale)}</Link>
      </Button>
    </div>
  )
}
