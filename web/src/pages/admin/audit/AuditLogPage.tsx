import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Download, Loader2, Search, SlidersHorizontal } from 'lucide-react'
import {
  api,
  getAuthToken,
  type AuditLogEntry,
  type AuditLogSearchFilters,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { formatRelativeTime, formatShortDate } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * Audit log viewer (H5 — cross-cutting).
 *
 * The `audit_log` table has been writing rows for months — agency
 * applications, package approvals, ownership transfers, MFA policy changes,
 * PAT revocations, passkey enrollments — but no UI existed to search it.
 * This is the SOC 2 CC7.2 evidence surface an auditor asks about.
 *
 * Access:
 *   - Platform admin sees all tenants' rows.
 *   - Agency owner/admin sees only their own tenant's rows.
 *   - Regular members see an empty result (not a 403).
 *
 * Filters compose (all AND'd) — type, entity type, date range, free-text.
 * Pagination via offset/limit; total shown so the pager knows the extent.
 * CSV export uses the caller's Authorization header so the download is
 * fetched-then-blob'd (avoids leaking the token in a bare `<a href>`).
 */

const PAGE_SIZE = 25

export function AuditLogPage() {
  const { addToast } = useToast()
  const location = useLocation()
  const isPlatformAudit = location.pathname.startsWith('/admin/audit')
  usePageTitle('Audit log')

  const [filters, setFilters] = useState<AuditLogSearchFilters>({})
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [downloadingCsv, setDownloadingCsv] = useState(false)
  // Draft filters — updated on input change; committed to `filters` on Search.
  const [draftType, setDraftType] = useState('')
  const [draftEntity, setDraftEntity] = useState('')
  const [draftActor, setDraftActor] = useState('')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [draftQ, setDraftQ] = useState('')

  const load = useCallback(
    async (nextOffset = offset) => {
      setLoading(true)
      try {
        const res = await api.searchAuditLog({
          ...filters,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })
        setEntries(res.entries)
        setTotal(res.pagination.total)
        setOffset(res.pagination.offset)
      } catch (err) {
        addToast({
          variant: 'error',
          title: 'Could not load audit log',
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setLoading(false)
      }
    },
    [filters, offset, addToast],
  )

  useEffect(() => {
    void load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  function applyFilters() {
    setOffset(0)
    setFilters({
      type: draftType.trim() || undefined,
      entity_type: draftEntity.trim() || undefined,
      actor_id: draftActor.trim() || undefined,
      from: draftFrom || undefined,
      to: draftTo || undefined,
      q: draftQ.trim() || undefined,
    })
  }

  function clearFilters() {
    setDraftType('')
    setDraftEntity('')
    setDraftActor('')
    setDraftFrom('')
    setDraftTo('')
    setDraftQ('')
    setFilters({})
    setOffset(0)
  }

  async function downloadCsv() {
    setDownloadingCsv(true)
    try {
      const url = api.auditLogCsvPath(filters)
      const token = getAuthToken()
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`CSV download failed (${res.status})`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'CSV export failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setDownloadingCsv(false)
    }
  }

  const pageInfo = useMemo(() => {
    if (total === 0) return '0 entries'
    const from = offset + 1
    const to = Math.min(offset + entries.length, total)
    return `${from}–${to} of ${total} entries`
  }, [entries.length, offset, total])

  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  return (
    <div className="mx-auto max-w-[1100px] p-[var(--lc-space-lg)] pb-[var(--lc-space-3xl)]">
      <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-[var(--lc-space-sm)]">
        <div className="min-w-0">
          <h1
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
          >
            Audit log
          </h1>
          <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
            Every security-sensitive action across the platform. Filter by type, entity, actor, date
            range, or free-text. Export to CSV for auditor review.
          </p>
        </div>
        {isPlatformAudit && (
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/admin/audit/retention" data-testid="audit-retention-link">
              <SlidersHorizontal className="h-4 w-4" />
              Retention policy
            </Link>
          </Button>
        )}
      </header>

      <section
        aria-label="Filters"
        className="mb-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]"
      >
        <div className="grid grid-cols-1 gap-[var(--lc-space-sm)] sm:grid-cols-3">
          <div>
            <Label htmlFor="audit-type">Type</Label>
            <Input
              id="audit-type"
              value={draftType}
              onChange={(e) => setDraftType(e.target.value)}
              placeholder="agency_mfa_policy_updated"
            />
          </div>
          <div>
            <Label htmlFor="audit-entity">Entity type</Label>
            <Input
              id="audit-entity"
              value={draftEntity}
              onChange={(e) => setDraftEntity(e.target.value)}
              placeholder="agency_mfa_policy"
            />
          </div>
          <div>
            <Label htmlFor="audit-actor">Actor (user id)</Label>
            <Input
              id="audit-actor"
              value={draftActor}
              onChange={(e) => setDraftActor(e.target.value)}
              placeholder="user-…"
            />
          </div>
          <div>
            <Label htmlFor="audit-from">From</Label>
            <Input
              id="audit-from"
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="audit-to">To</Label>
            <Input
              id="audit-to"
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="audit-q">Free text</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lc-text-muted)]"
                aria-hidden
              />
              <Input
                id="audit-q"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="e.g. passkey"
                className="ps-9"
              />
            </div>
          </div>
        </div>
        <div className="mt-[var(--lc-space-md)] flex flex-wrap gap-[var(--lc-space-sm)]">
          <Button type="button" onClick={applyFilters}>
            <Search className="me-2 h-4 w-4" aria-hidden />
            Search
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void downloadCsv()}
            disabled={downloadingCsv}
          >
            {downloadingCsv ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="me-2 h-4 w-4" aria-hidden />
            )}
            Export CSV
          </Button>
        </div>
      </section>

      <section aria-label="Results">
        <div className="mb-[var(--lc-space-sm)] flex items-center justify-between">
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {loading ? 'Loading…' : pageInfo}
          </p>
          <div className="flex gap-[var(--lc-space-xs)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrev || loading}
              onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canNext || loading}
              onClick={() => void load(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>

        {loading && entries.length === 0 ? (
          <div aria-busy="true" className="space-y-[var(--lc-space-sm)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div
            role="status"
            className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)] text-center text-[var(--lc-text-muted)]"
          >
            No audit entries match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
            <table className="w-full border-collapse text-start">
              <thead>
                <tr className="bg-[var(--lc-surface-sunken)] text-[length:var(--lc-type-overline)] text-[var(--lc-text-muted)]">
                  <th className="px-3 py-2 text-start">When</th>
                  <th className="px-3 py-2 text-start">Type</th>
                  <th className="px-3 py-2 text-start">Entity</th>
                  <th className="px-3 py-2 text-start">Actor</th>
                  <th className="px-3 py-2 text-start">Agency</th>
                  <th className="px-3 py-2 text-start">IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--lc-border)] hover:bg-[var(--lc-surface-sunken)]"
                  >
                    <td
                      className="px-3 py-3 text-[length:var(--lc-type-body-sm)]"
                      title={row.created_at}
                    >
                      {formatRelativeTime(row.created_at)}
                      <br />
                      <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                        {formatShortDate(row.created_at)}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-body-sm)]">
                      {row.type}
                      {row.action ? (
                        <span className="text-[var(--lc-text-muted)]"> · {row.action}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-[length:var(--lc-type-body-sm)]">
                      {row.entity_type}
                      {row.entity_id ? (
                        <>
                          <br />
                          <code className="text-[var(--lc-text-muted)]">{row.entity_id}</code>
                        </>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-caption)]">
                      {row.agent_id || '—'}
                    </td>
                    <td className="px-3 py-3 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-caption)]">
                      {row.agency_id || '—'}
                    </td>
                    <td className="px-3 py-3 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-caption)]">
                      {row.ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
