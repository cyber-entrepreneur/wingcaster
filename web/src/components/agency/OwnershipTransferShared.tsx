import { Fragment, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useOwnershipTransferCopy,
  type OwnershipTransferCopyKey,
} from '@/pages/agency/ownershipTransferCopy'

/** Renders `**bold**` spans without a full markdown dependency. */
function renderBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) => {
    const m = chunk.match(/^\*\*([^*]+)\*\*$/)
    if (m) {
      return (
        <strong key={i} className="font-semibold">
          {m[1]}
        </strong>
      )
    }
    return <Fragment key={i}>{chunk}</Fragment>
  })
}

interface ImpactBannerProps {
  perspective: 'initiator' | 'recipient'
  agencyName: string
  /** Target name (initiator view) or initiator name (recipient view). */
  otherName: string
}

/**
 * Amber-bordered consequence banner. `--lc-status-underOffer-fg` accent per the
 * token gotcha (warning → underOffer). Never uses danger/red for the banner.
 */
export function OwnershipImpactBanner({ perspective, agencyName, otherName }: ImpactBannerProps) {
  const { t } = useOwnershipTransferCopy()
  const isInit = perspective === 'initiator'
  const vars = { agency: agencyName, target: otherName, initiator: otherName }

  const impactKeys: OwnershipTransferCopyKey[] = isInit
    ? ['init.impact.billing', 'init.impact.contract', 'init.impact.escalation', 'init.impact.legal', 'init.impact.role']
    : ['recv.impl.billing', 'recv.impl.contract', 'recv.impl.escalation', 'recv.impl.legal', 'recv.impl.initiatorRole']

  const unchangedKeys: OwnershipTransferCopyKey[] = isInit
    ? ['init.unchanged.listings', 'init.unchanged.capabilities', 'init.unchanged.brand']
    : ['recv.unchanged.listings', 'recv.unchanged.capabilities', 'recv.unchanged.brand']

  return (
    <section
      role="region"
      aria-labelledby="ownership-impact-heading"
      className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]"
      style={{ borderInlineStart: '4px solid var(--lc-status-underOffer-fg)' }}
    >
      <div className="flex items-start gap-[var(--lc-space-md)]">
        <AlertTriangle
          className="h-7 w-7 shrink-0 text-[var(--lc-status-underOffer-fg)]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h2
            id="ownership-impact-heading"
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-3)' }}
          >
            {t(isInit ? 'init.impact.heading' : 'recv.impl.heading', vars)}
          </h2>
          <ul className="mt-[var(--lc-space-sm)] space-y-[var(--lc-space-xs)] text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
            {impactKeys.map((key) => (
              <li key={key} className="flex gap-2">
                <span aria-hidden="true" className="text-[var(--lc-status-underOffer-fg)]">•</span>
                <span>{renderBold(t(key, vars))}</span>
              </li>
            ))}
          </ul>

          <h3
            className="mt-[var(--lc-space-md)] text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-overline)' }}
          >
            {t('init.unchanged.heading')}
          </h3>
          <ul className="mt-[var(--lc-space-2xs)] space-y-[var(--lc-space-2xs)] text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {unchangedKeys.map((key) => (
              <li key={key} className="flex gap-2">
                <span aria-hidden="true" className="text-[var(--lc-text-muted)]">•</span>
                <span>{t(key, vars)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

interface TerminalStateCardProps {
  glyph: LucideIcon
  title: string
  body?: string
  primary: { label: string; onClick: () => void }
}

/**
 * Terminal card for cancelled / expired / already-resolved / invalid-token
 * variants. `role="status"` so screen readers announce it on load; each variant
 * pairs a distinct glyph + label + surface tint (no color-only differentiation).
 */
export function TerminalStateCard({ glyph: Glyph, title, body, primary }: TerminalStateCardProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-[var(--lc-space-md)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] text-center shadow-[var(--lc-elevation-sm)]"
    >
      <Glyph className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
      <p className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
        {title}
      </p>
      {body ? (
        <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
          {body}
        </p>
      ) : null}
      <Button type="button" variant="default" onClick={primary.onClick}>
        {primary.label}
      </Button>
    </div>
  )
}

/** 30-day reversal-window reassurance card (sunken surface, brand glyph). */
export function ReversalWindowNotice({ perspective }: { perspective: 'initiator' | 'recipient' }) {
  const { t } = useOwnershipTransferCopy()
  return (
    <div className="flex items-start gap-[var(--lc-space-md)] rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
      <RotateCcw className="h-5 w-5 shrink-0 text-[var(--lc-text-brand)]" aria-hidden="true" />
      <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
        {renderBold(t(perspective === 'initiator' ? 'init.reversal.notice' : 'recv.reversal.notice'))}
      </p>
    </div>
  )
}
