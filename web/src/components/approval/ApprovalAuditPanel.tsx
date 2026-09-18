import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, RefreshCw } from 'lucide-react'
import { api } from '@/api/client'
import { Timeline, type TimelineEntry } from '@/components/security/Timeline'
import { PIIMask } from '@/components/security/PIIMask'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import type { ApprovalAuditEvent, ApprovalAuditTrail } from './approvalTypes'

export interface ApprovalAuditPanelProps {
  requestId: string
  onExport?: () => void
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function eventMessage(event: ApprovalAuditEvent): string {
  const actor = event.actor.email || event.actor.id
  if (event.type === 'SUBMITTED') {
    return actor ? `Submitted by ${actor}.` : 'Approval request submitted.'
  }
  if (event.type === 'APPROVED') {
    return actor ? `Approval recorded by ${actor}.` : 'Approval recorded.'
  }
  if (event.type === 'REJECTED') {
    return actor ? `Rejection recorded by ${actor}.` : 'Rejection recorded.'
  }
  return actor ? `${humanize(event.type)} by ${actor}.` : `${humanize(event.type)}.`
}

function hasSnapshot(value: Record<string, unknown> | null): value is Record<string, unknown> {
  return Boolean(value && Object.keys(value).length > 0)
}

function SnapshotDetails({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  if (!hasSnapshot(value)) return null
  return (
    <details className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)]">
      <summary className="cursor-pointer px-3 py-2 text-[var(--lc-text-primary)]">{label}</summary>
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words border-t border-[var(--lc-border)] px-3 py-2 text-[var(--lc-text-secondary)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  )
}

function EventMeta({ event, requestId }: { event: ApprovalAuditEvent; requestId: string }) {
  const actorValue = event.actor.email || event.actor.id
  return (
    <div className="flex min-w-0 flex-col gap-2 text-[var(--lc-text-muted)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {actorValue ? (
          <span>
            Actor:{' '}
            <PIIMask
              kind={event.actor.email ? 'email' : 'name'}
              value={actorValue}
              auditContext={{ caseId: requestId, field: `audit-actor-${event.id}` }}
              revealDurationMs={30_000}
            />
          </span>
        ) : (
          <span>Actor: system</span>
        )}
        {event.reason_code ? <span>Reason: {humanize(event.reason_code)}</span> : null}
        {event.integrity_hash ? (
          <span className="min-w-0">
            Integrity:{' '}
            <Numeric as="span" className="break-all">
              {event.integrity_hash.slice(0, 12)}
            </Numeric>
          </span>
        ) : null}
      </div>
      <SnapshotDetails label="Submitted payload" value={event.payload_snapshot} />
      <SnapshotDetails label="Before snapshot" value={event.before_state} />
      <SnapshotDetails label="After snapshot" value={event.after_state} />
    </div>
  )
}

export function ApprovalAuditPanel({ requestId, onExport }: ApprovalAuditPanelProps) {
  const [trail, setTrail] = useState<ApprovalAuditTrail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setTrail(await api.getApprovalAuditTrail(requestId))
    } catch {
      setTrail(null)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    void load()
  }, [load])

  const entries: TimelineEntry[] = useMemo(
    () =>
      (trail?.events || []).map((event) => ({
        id: event.id,
        at: event.occurred_at,
        status: event.status,
        title: humanize(event.type),
        message: eventMessage(event),
        meta: <EventMeta event={event} requestId={requestId} />,
      })),
    [requestId, trail],
  )

  const exportPdf = () => {
    if (onExport) onExport()
    else window.print()
  }

  return (
    <section
      aria-labelledby="approval-audit-title"
      className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] sm:p-[var(--lc-space-lg)]"
      data-screen="PA-APR-004"
    >
      <header className="mb-[var(--lc-space-md)] flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="approval-audit-title"
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-2)' }}
          >
            Approval audit trail
          </h2>
          <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            Immutable submission, decision, execution, and payload history.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={exportPdf} disabled={loading || error || !trail}>
          <Printer className="me-2 h-4 w-4" aria-hidden />
          Export PDF
        </Button>
      </header>

      {loading ? (
        <div className="flex flex-col gap-3" aria-label="Loading approval audit trail" role="status">
          <span className="h-16 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
          <span className="h-16 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-unpublished-bg)] p-3 text-[var(--lc-status-unpublished-fg)]"
        >
          <span>Couldn&apos;t load the approval audit trail.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="me-2 h-4 w-4" aria-hidden />
            Retry
          </Button>
        </div>
      ) : (
        <>
          {trail ? (
            <dl className="mb-[var(--lc-space-md)] grid gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-3 text-sm sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-[var(--lc-text-muted)]">Workflow</dt>
                <dd className="break-words text-[var(--lc-text-primary)]">
                  {trail.request.workflow_code || humanize(trail.request.action_kind)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--lc-text-muted)]">Request status</dt>
                <dd className="text-[var(--lc-text-primary)]">{humanize(trail.request.status)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[var(--lc-text-muted)]">Payload integrity</dt>
                <dd className="break-all text-[var(--lc-text-primary)]">
                  <Numeric>{trail.request.payload_hash.slice(0, 12)}</Numeric>
                </dd>
              </div>
            </dl>
          ) : null}
          <Timeline entries={entries} emptyLabel="No audit events have been recorded." />
        </>
      )}
    </section>
  )
}
