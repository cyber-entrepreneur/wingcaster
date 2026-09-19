/**
 * PA-WLA-004 — WhatsApp audit log.
 * Route: /admin/whatsapp-listings/audit
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { api, getAuthToken } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

export interface WhatsAppAuditLogEntry {
  id: string
  at: string
  tenant: string | null
  event: string
  reference: string | null
  actor: string | null
  agent_id?: string | null
  agency_id?: string | null
  action?: string | null
  entity_type?: string | null
  entity_id?: string | null
}

const PAGE_SIZE = 50

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function WhatsAppAuditLogPage() {
  const { addToast } = useToast()
  usePageTitle('WhatsApp audit log')

  const [items, setItems] = useState<WhatsAppAuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const [draftAgentId, setDraftAgentId] = useState('')
  const [draftAction, setDraftAction] = useState('')
  const [agentId, setAgentId] = useState('')
  const [action, setAction] = useState('')

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      limit: String(PAGE_SIZE),
      offset: String(offset),
    }
    if (agentId) params.agent_id = agentId
    if (action) params.action = action
    return params
  }, [agentId, action, offset])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const body = await api.getAdminWhatsAppListingsAuditLog(queryParams)
      setItems((body.items || []) as WhatsAppAuditLogEntry[])
      setTotal(Number(body.total || 0))
    } catch (err) {
      setError(true)
      setItems([])
      addToast({
        variant: 'error',
        title: 'Could not load WhatsApp audit log',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, queryParams])

  useEffect(() => {
    void load()
  }, [load])

  const applyFilters = () => {
    setAgentId(draftAgentId.trim())
    setAction(draftAction.trim())
    setOffset(0)
  }

  const exportCsv = async () => {
    setDownloading(true)
    try {
      const url = api.adminWhatsAppListingsAuditLogCsvPath({
        agent_id: agentId || undefined,
        action: action || undefined,
        limit: '500',
        offset: '0',
      })
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `whatsapp-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      anchor.click()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Export failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setDownloading(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageIndex = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="mx-auto max-w-[1200px] px-[var(--lc-space-2xl)] py-[var(--lc-space-2xl)]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
            PA-WLA-004
          </p>
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            WhatsApp audit log
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            Per-tenant intake events for the WhatsApp Listings module — draft created, approved, discarded,
            reprocessed, and admin credit grants.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button type="button" variant="outline" onClick={() => void exportCsv()} disabled={downloading}>
            {downloading ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="me-2 h-4 w-4" aria-hidden="true" />
            )}
            Export CSV
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="wa-audit-agent">Agent ID</Label>
          <Input
            id="wa-audit-agent"
            value={draftAgentId}
            onChange={(e) => setDraftAgentId(e.target.value)}
            placeholder="Filter by agent"
            className="mt-1"
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="wa-audit-action">Event</Label>
          <Input
            id="wa-audit-action"
            value={draftAction}
            onChange={(e) => setDraftAction(e.target.value)}
            placeholder="e.g. draft_created"
            className="mt-1"
          />
        </div>
        <Button type="button" onClick={applyFilters}>
          Apply filters
        </Button>
      </div>

      {loading ? (
        <p role="status" style={{ font: 'var(--lc-type-body)' }}>
          Loading audit log…
        </p>
      ) : error ? (
        <div role="alert" className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-4">
          <p style={{ font: 'var(--lc-type-body)' }}>Could not load audit entries.</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : !items.length ? (
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
          No audit entries match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]">
          <table className="w-full min-w-[760px] text-start" style={{ font: 'var(--lc-type-body-sm)' }}>
            <thead className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--lc-border)]">
                  <td className="px-4 py-3 whitespace-nowrap">{formatTimestamp(row.at)}</td>
                  <td className="px-4 py-3 font-mono">{row.tenant || '—'}</td>
                  <td className="px-4 py-3">{row.event || row.action || '—'}</td>
                  <td className="px-4 py-3 font-mono">{row.reference || row.entity_id || '—'}</td>
                  <td className="px-4 py-3 font-mono">{row.actor || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          Showing {items.length ? offset + 1 : 0}–{offset + items.length} of {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset <= 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </Button>
          <span className="text-sm text-[var(--lc-text-muted)]">
            Page {pageIndex} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>

      <p className="mt-6" style={{ font: 'var(--lc-type-caption)' }}>
        <Link to="/admin/whatsapp-listings" className="text-[var(--lc-text-brand)] hover:underline">
          Back to WhatsApp Listings admin
        </Link>
      </p>
    </div>
  )
}

export default WhatsAppAuditLogPage
