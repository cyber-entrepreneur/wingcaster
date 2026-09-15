import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type { OriginalReportBody } from './outcomeTypes'

export type OriginalReportAccordionProps = {
  reportId: string
  /** REC-002: "What you originally reported"; REC-003: "What you originally submitted". */
  headerLabel?: string
  body: OriginalReportBody
  className?: string
}

/**
 * Shared original-submission accordion for AGT-REC-002 / AGT-REC-003.
 * Closed by default; Accordion semantics via button + aria-expanded.
 */
export function OriginalReportAccordion({
  reportId,
  headerLabel = 'What you originally reported',
  body,
  className,
}: OriginalReportAccordionProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const evidence = body.evidence ?? []
  const shown = evidence.slice(0, 3)
  const more = Math.max(0, evidence.length - shown.length)

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-sm',
        className,
      )}
    >
      <h2 className="sr-only">{headerLabel}</h2>
      <button
        type="button"
        className="flex min-h-tap w-full items-center justify-between gap-[var(--lc-space-md)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-start"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-body)' }}
        >
          {headerLabel}
        </span>
        <span className="flex items-center gap-[var(--lc-space-sm)]">
          <Numeric
            className="text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-caption)' }}
            dir="ltr"
          >
            {reportId}
          </Numeric>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-[var(--lc-text-muted)] transition-transform duration-base ease-out motion-reduce:transition-none',
              open && 'rotate-90',
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="border-t border-[var(--lc-border)] px-[var(--lc-space-md)] py-[var(--lc-space-md)]"
      >
        {body.reasonLabel ? (
          <div className="mb-[var(--lc-space-sm)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            <span className="text-[var(--lc-text-muted)]">Reason: </span>
            <Badge variant="outline" className="rounded-pill">
              {body.reasonLabel}
            </Badge>
          </div>
        ) : null}

        {body.marketSegmentLabel ? (
          <div className="mb-[var(--lc-space-sm)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            <span className="text-[var(--lc-text-muted)]">Market segment: </span>
            <Badge variant="outline" className="rounded-pill">
              {body.marketSegmentLabel}
            </Badge>
          </div>
        ) : null}

        {body.priceBands && body.priceBands.length > 0 ? (
          <table className="mb-[var(--lc-space-sm)] w-full text-start" style={{ font: 'var(--lc-type-body-sm)' }}>
            <tbody>
              {body.priceBands.map((band) => (
                <tr key={band.label} className="border-b border-[var(--lc-border)] last:border-0">
                  <th scope="row" className="py-1 pe-2 font-normal text-[var(--lc-text-muted)]">
                    {band.label}
                  </th>
                  <td className="py-1">
                    <Numeric dir="ltr">
                      {band.value_aed ?? band.value ?? '—'}
                      {band.currency ? ` ${band.currency}` : band.value_aed != null ? ' AED' : ''}
                    </Numeric>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {(body.notes || body.methodologyNotes) ? (
          <p
            className="mb-[var(--lc-space-sm)] whitespace-pre-wrap text-[var(--lc-text-primary)]"
            style={{ font: 'var(--lc-type-body)' }}
          >
            {body.notes || body.methodologyNotes}
          </p>
        ) : null}

        {shown.length > 0 ? (
          <div>
            <p
              className="mb-[var(--lc-space-xs)] text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
            >
              {body.marketSegmentLabel ? 'Attachments' : 'Evidence'}
            </p>
            <ul role="list" className="flex flex-wrap gap-[var(--lc-space-xs)]">
              {shown.map((item, i) => {
                const src = item.signed_url || item.url
                const alt = `${item.kind || 'evidence'} ${i + 1}`
                return (
                  <li key={`${src || item.filename || i}`} role="listitem">
                    {src ? (
                      <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square h-16 w-16 overflow-hidden rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]"
                      >
                        <img
                          src={src}
                          alt={alt}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ) : (
                      <span
                        className="flex aspect-square h-16 w-16 items-center justify-center rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]"
                        style={{ font: 'var(--lc-type-caption)' }}
                      >
                        {item.kind || 'file'}
                      </span>
                    )}
                  </li>
                )
              })}
              {more > 0 ? (
                <li role="listitem">
                  <Badge variant="outline" className="rounded-pill">
                    +{more} more
                  </Badge>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
