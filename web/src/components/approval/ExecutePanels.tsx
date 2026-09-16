import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Numeric } from '@/components/ui/numeric'
import { Badge } from '@/components/ui/badge'
import {
  TwoPersonProgress,
  type TwoPersonApprover,
} from '@/components/security/TwoPersonProgress'
import type {
  ExecutePreview,
  ApprovalValueTier,
  RiskSeverity,
  LedgerImpact,
} from './approvalTypes'
import { useTwoPersonCopy, type TwoPersonCopyKey } from './twoPersonCopy'

const TIER_COPY: Record<ApprovalValueTier, TwoPersonCopyKey> = {
  standard: 'tier.standard',
  elevated: 'tier.elevated',
  high_value: 'tier.high_value',
}

function SectionCard({
  surface,
  className,
  children,
}: {
  surface: 'raised' | 'sunken'
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--lc-radius-lg)] p-[var(--lc-space-lg)]',
        surface === 'raised'
          ? 'bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]'
          : 'bg-[var(--lc-surface-sunken)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** 2×2 request summary card (sunken). */
export function ExecuteRequestSummary({ preview }: { preview: ExecutePreview }) {
  const { t } = useTwoPersonCopy()
  const { request, action_summary, two_person } = preview
  const tierVariant =
    request.value_tier === 'high_value'
      ? 'unpublished'
      : request.value_tier === 'elevated'
        ? 'underOffer'
        : 'draft'

  return (
    <SectionCard surface="sunken">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div className="col-span-2">
          <dt className="uppercase tracking-[0.08em] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
            {t('summary.action')}
          </dt>
          <dd className="mt-0.5 text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
            {action_summary}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.08em] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
            {t('summary.tier')}
          </dt>
          <dd className="mt-1">
            <Badge variant={tierVariant}>{t(TIER_COPY[request.value_tier])}</Badge>
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.08em] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
            {t('summary.submittedBy')}
          </dt>
          <dd className="mt-1 flex items-center gap-2 text-sm text-[var(--lc-text-secondary)]">
            <span
              aria-hidden
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--lc-surface)] text-xs font-semibold text-[var(--lc-text-primary)]"
            >
              {request.submitted_by.initials}
            </span>
            <span className="min-w-0 truncate">{request.submitted_by.display_name}</span>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="uppercase tracking-[0.08em] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
            {t('summary.approvers')}
          </dt>
          <dd className="mt-2">
            <TwoPersonProgress
              firstApprover={
                two_person.first_approver
                  ? ({
                      id: two_person.first_approver.id ?? undefined,
                      displayName: two_person.first_approver.display_name,
                      initials: two_person.first_approver.initials,
                      signedOffAt: two_person.first_approver.signed_off_at,
                    } satisfies TwoPersonApprover)
                  : null
              }
              secondApprover={{
                id: two_person.second_approver_slot.candidate_id ?? undefined,
                initials: two_person.second_approver_slot.initials,
                signedOffAt: null,
              }}
              firstStepLabel={t('progress.first')}
              secondStepLabel={t('progress.second')}
              pendingSecondLabel={t('progress.pending')}
            />
          </dd>
        </div>
      </dl>
    </SectionCard>
  )
}

/** Diff panel with strikethrough-before + green-after. */
export function ExecuteDiffPanel({ diff }: { diff: ExecutePreview['diff'] }) {
  const { t } = useTwoPersonCopy()
  return (
    <SectionCard surface="raised">
      <h3 className="mb-3 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
        {t('diff.title')}
      </h3>
      {diff.length === 0 ? (
        <p className="text-sm text-[var(--lc-text-muted)]">{t('diff.empty')}</p>
      ) : (
        <ul className="flex max-h-[240px] flex-col gap-2 overflow-y-auto" role="list">
          {diff.map((row, idx) => {
            const numeric = row.kind === 'money' || row.kind === 'date'
            const Before = numeric ? Numeric : 'span'
            const After = numeric ? Numeric : 'span'
            return (
              <li
                key={`${row.field}-${idx}`}
                className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block uppercase tracking-[0.08em] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
                    {row.field}
                  </span>
                  <Before className="line-through decoration-[var(--lc-text-muted)] text-[var(--lc-text-secondary)]">
                    {row.before ?? '—'}
                  </Before>
                </span>
                <ArrowRight aria-hidden className="mt-4 h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" />
                <After className="mt-4 font-semibold text-[var(--lc-status-published-fg)]">
                  {row.after ?? '—'}
                </After>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

const RISK_GLYPH: Record<RiskSeverity, string> = { info: '●', warn: '▲', danger: '◆' }
const RISK_TONE: Record<RiskSeverity, string> = {
  info: 'text-[var(--lc-status-published-dot)]',
  warn: 'text-[var(--lc-status-underOffer-dot)]',
  danger: 'text-[var(--lc-status-unpublished-dot)]',
}

/** Risk-signals card — renders only when non-empty. */
export function ExecuteRiskSignals({ signals }: { signals: ExecutePreview['risk_signals'] }) {
  const { t } = useTwoPersonCopy()
  if (!signals || signals.length === 0) return null
  return (
    <SectionCard surface="raised">
      <h3 className="mb-3 flex items-center gap-1.5 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
        <span aria-hidden className="text-[var(--lc-status-underOffer-dot)]">▲</span>
        {t('risk.title')}
      </h3>
      <ul className="flex flex-col gap-2" role="list">
        {signals.map((signal, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-[var(--lc-text-secondary)]">
            <span aria-hidden className={cn('mt-0.5', RISK_TONE[signal.severity])}>
              {RISK_GLYPH[signal.severity]}
            </span>
            <span className="min-w-0">
              <span className="sr-only">{`${signal.severity}: `}</span>
              {signal.label}
              {signal.detail ? (
                <span className="block text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                  {signal.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

/** Ledger-impact preview — balanced check + total row. */
export function ExecuteLedgerPreview({
  ledger,
  env,
}: {
  ledger: LedgerImpact
  env: string
}) {
  const { t } = useTwoPersonCopy()
  const envLabel = env === 'test' ? t('chip.test') : t('chip.live')
  return (
    <SectionCard surface="sunken">
      <h3 className="mb-3 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
        {t('ledger.title')}
      </h3>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t('ledger.title')}</caption>
        <thead>
          <tr className="text-[var(--lc-text-muted)]">
            <th scope="col" className="pb-1 text-start uppercase tracking-[0.08em]" style={{ font: 'var(--lc-type-overline)' }}>
              {t('ledger.account')}
            </th>
            <th scope="col" className="pb-1 text-end uppercase tracking-[0.08em]" style={{ font: 'var(--lc-type-overline)' }}>
              {t('ledger.debit')}
            </th>
            <th scope="col" className="pb-1 text-end uppercase tracking-[0.08em]" style={{ font: 'var(--lc-type-overline)' }}>
              {t('ledger.credit')}
            </th>
          </tr>
        </thead>
        <tbody>
          {ledger.rows.map((row, idx) => (
            <tr key={`${row.account_code}-${idx}`} className="border-t border-[var(--lc-border)]">
              <td className="py-1.5">
                <span className="text-[var(--lc-text-secondary)]">
                  <Numeric as="span">{row.account_code}</Numeric> · {row.account_label}
                </span>
              </td>
              <td className="py-1.5 text-end">
                {row.debit ? <Numeric as="span">{`${ledger.currency} ${row.debit}`}</Numeric> : '—'}
              </td>
              <td className="py-1.5 text-end">
                {row.credit ? <Numeric as="span">{`${ledger.currency} ${row.credit}`}</Numeric> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--lc-border-strong)] font-semibold text-[var(--lc-text-primary)]">
            <td className="py-1.5">
              {t('ledger.totals')}
              {ledger.balanced ? (
                <span className="ms-2 text-[var(--lc-status-published-fg)]">
                  <span aria-hidden>✓</span> <span className="sr-only">{t('ledger.balanced')}</span>
                </span>
              ) : null}
            </td>
            <td className="py-1.5 text-end">
              <Numeric as="span">{`${ledger.currency} ${ledger.totals.debit}`}</Numeric>
            </td>
            <td className="py-1.5 text-end">
              <Numeric as="span">{`${ledger.currency} ${ledger.totals.credit}`}</Numeric>
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
        {t('ledger.footer', { env: envLabel })}
      </p>
    </SectionCard>
  )
}
