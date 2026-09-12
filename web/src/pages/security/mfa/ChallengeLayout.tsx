import type { ReactNode } from 'react'
import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { cn } from '@/lib/utils'

export function ChallengeLayout({
  children,
  heroLine = 'Your account is protected.',
}: {
  children: ReactNode
  heroLine?: string
}) {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[var(--lc-bg-page)]">
      <div className="lg:grid lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[3fr_2fr]">
        <main className="flex items-start justify-center px-4 py-6 lg:items-center lg:px-8">
          <div className="mx-auto flex w-full max-w-[400px] flex-col gap-[var(--lc-space-xl)] pb-[max(var(--lc-space-xl),env(safe-area-inset-bottom))] pt-[var(--lc-space-md)] lg:pt-[var(--lc-space-3xl)]">
            <div className="flex items-start justify-end">
              <LanguageSelector />
            </div>
            {children}
          </div>
        </main>
        <aside className="relative hidden overflow-hidden bg-[var(--lc-surface-inverse)] lg:block">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(135deg, var(--lc-action-primary) 0%, transparent 55%), linear-gradient(225deg, var(--lc-accent) 0%, transparent 40%)',
            }}
          />
          <div className="relative flex h-full flex-col justify-end gap-[var(--lc-space-md)] p-[var(--lc-space-3xl)] text-[var(--lc-text-inverse)]">
            <p
              className="max-w-md"
              style={{
                font: 'var(--lc-type-heading-2)',
                letterSpacing: 'var(--lc-tracking-heading-2)',
              }}
            >
              WingCaster
            </p>
            <p className={cn('max-w-md opacity-90')} style={{ font: 'var(--lc-type-body-lg)' }}>
              {heroLine}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
