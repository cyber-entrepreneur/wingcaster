/**
 * PA-PKG family shared primitives — console frame (admin gate + env strip +
 * min-viewport), status badge, and formatting helpers. Token-only styling.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useEnv } from '@/hooks/useEnv'
import { Badge } from '@/components/ui/badge'
import { usePackagesCopy, type PackagesCopyKey } from './packagesCopy'
import type { PackageVersionState } from './types'

const STATE_STATUS: Record<PackageVersionState, string> = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending',
  PUBLISHED: 'published',
  DEPRECATED: 'archived',
}

const STATE_LABEL_KEY: Record<PackageVersionState, PackagesCopyKey> = {
  DRAFT: 'status.draft',
  PENDING_APPROVAL: 'status.pending',
  PUBLISHED: 'status.active',
  DEPRECATED: 'status.deprecated',
}

export function PackageStatusBadge({ state }: { state: PackageVersionState }) {
  const { t } = usePackagesCopy()
  return (
    <Badge status={STATE_STATUS[state]} data-pkg-status={state}>
      {t(STATE_LABEL_KEY[state])}
    </Badge>
  )
}

/**
 * PA console frame: enforces admin access, renders the TEST env strip, and the
 * below-min-viewport fallback. Children render inside the page background.
 */
export function PackageConsoleFrame({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  const { env } = useEnv()
  const { t } = usePackagesCopy()

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
          {t('shell.forbidden.title')}
        </h1>
        <Link
          to="/admin"
          className="mt-4 inline-block text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
        >
          {t('shell.forbidden.home')}
        </Link>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      <div
        role="status"
        className="hidden px-4 py-2 text-center text-sm text-[var(--lc-text-muted)] lg:block"
        data-testid="pkg-viewport-note-desktop"
        aria-hidden
      />
      <div
        role="status"
        className="border-b border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-4 py-16 text-center text-sm text-[var(--lc-text-muted)] lg:hidden"
      >
        {t('shell.viewport.title')}{' '}
        <Link to="/admin" className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline">
          {t('shell.viewport.back')}
        </Link>
      </div>
      <div className="hidden lg:block">
        {env === 'test' ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="pkg-test-strip"
            className="border-b border-[var(--lc-status-underOffer-fg)] bg-[var(--lc-status-underOffer-bg)] px-4 py-1.5 text-center text-[var(--lc-status-underOffer-fg)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            {t('shell.test.strip')}
          </div>
        ) : null}
        <div className="mx-auto max-w-[1440px] px-[var(--lc-space-xl)] py-[var(--lc-space-xl)]">
          {children}
        </div>
      </div>
    </div>
  )
}

