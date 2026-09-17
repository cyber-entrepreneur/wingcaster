import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Download, FileArchive, Loader2 } from 'lucide-react'
import { api, getAuthToken, type DataExportRecord } from '@/api/client'
import { SettingsPaneHeader } from '@/components/settings'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatRelativeTime, formatShortDate } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * Self-serve data export (issue 192b).
 *
 * GDPR Art. 20 + UAE Fed 45/2021 + KSA PDPL — every data subject can ask
 * for a machine-readable copy of their data. This page kicks off the
 * async job, polls status, and hands the user a signed download link
 * once complete.
 *
 * The download endpoint requires the caller's Authorization header, so
 * this page fetches the file as a blob and creates a client-side download
 * link rather than routing the browser to a bare URL.
 */

const POLL_INTERVAL_MS = 3000

function bytesToHuman(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DataExportPage() {
  const { addToast } = useToast()
  usePageTitle('Data export')

  const [exports, setExports] = useState<DataExportRecord[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [requesting, setRequesting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const { exports: rows } = await api.listDataExports()
      setExports(rows)
      setLoadState('ready')
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not load data exports',
        description: err instanceof Error ? err.message : undefined,
      })
      setLoadState('error')
    }
  }, [addToast])

  useEffect(() => {
    void load()
  }, [load])

  // Poll while any row is still pending / running.
  useEffect(() => {
    const anyInFlight = exports.some((e) => e.status === 'pending' || e.status === 'running')
    if (!anyInFlight) {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }
    if (pollRef.current == null) {
      pollRef.current = window.setInterval(() => {
        void load()
      }, POLL_INTERVAL_MS)
    }
    return () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [exports, load])

  async function requestExport() {
    setRequesting(true)
    try {
      const { export: row } = await api.requestDataExport()
      setExports((prev) => [row, ...prev])
      addToast({
        variant: 'success',
        title: 'Data export requested',
        description: "We'll notify you when it's ready to download.",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start export.'
      addToast({ variant: 'error', title: 'Could not start data export', description: message })
    } finally {
      setRequesting(false)
    }
  }

  async function downloadExport(id: string) {
    setDownloadingId(id)
    try {
      // Download endpoint requires our Authorization header, so we fetch
      // as blob rather than routing the browser directly.
      const url = api.dataExportDownloadPath(id)
      const token = getAuthToken()
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        throw new Error(`Download failed (${res.status})`)
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `wingcaster-export-${id}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not download export',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const hasInFlight = exports.some((e) => e.status === 'pending' || e.status === 'running')

  return (
    <div>
      <SettingsPaneHeader
        title="Data export"
        sub="Download a machine-readable copy of your data (JSON). Complies with GDPR Art. 20, UAE Fed 45/2021 and KSA PDPL portability rights."
      />

      <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
        <div className="flex items-start gap-[var(--lc-space-md)]">
          <FileArchive className="mt-1 h-6 w-6 text-[var(--lc-text-muted)]" aria-hidden />
          <div className="flex-1">
            <h2
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-3)' }}
            >
              Request a data export
            </h2>
            <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
              Includes your profile, contacts, opportunities, sessions, activity log, and account
              settings. Server-side secrets (password hash, encrypted 2FA secret) are excluded.
              Files stay downloadable for 7 days.
            </p>
          </div>
          <Button
            type="button"
            disabled={requesting || hasInFlight}
            onClick={() => void requestExport()}
          >
            {requesting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                Requesting…
              </>
            ) : (
              'Request export'
            )}
          </Button>
        </div>
        {hasInFlight ? (
          <p
            className="mt-[var(--lc-space-md)] text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]"
            aria-live="polite"
          >
            An export is currently being prepared. Please wait for it to finish before requesting
            another.
          </p>
        ) : null}
      </section>

      <section className="mt-[var(--lc-space-xl)]">
        <h2
          className="mb-[var(--lc-space-md)] text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-2)' }}
        >
          Your exports
        </h2>
        {loadState === 'loading' ? (
          <div aria-busy="true" className="space-y-[var(--lc-space-sm)]">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
            ))}
          </div>
        ) : null}
        {loadState === 'ready' && exports.length === 0 ? (
          <p className="text-[var(--lc-text-muted)]">You have not requested any data exports yet.</p>
        ) : null}
        {loadState === 'ready' && exports.length > 0 ? (
          <ul aria-label="Data exports" className="divide-y divide-[var(--lc-border)]">
            {exports.map((row) => {
              const isExpired = new Date(row.expires_at).getTime() <= Date.now()
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-[var(--lc-space-sm)] py-[var(--lc-space-md)] sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p style={{ font: 'var(--lc-type-body)' }}>
                      Export requested {formatRelativeTime(row.requested_at)}
                    </p>
                    <p
                      className="text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-body-sm)' }}
                    >
                      Status:{' '}
                      <span data-status={row.status} className="font-medium">
                        {row.status}
                      </span>
                      {row.bytes ? ` · ${bytesToHuman(row.bytes)}` : ''}
                      {row.completed_at
                        ? ` · completed ${formatRelativeTime(row.completed_at)}`
                        : ''}
                    </p>
                    <p
                      className="text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-caption)' }}
                    >
                      {isExpired ? 'Expired' : `Expires ${formatShortDate(row.expires_at)}`}
                      {row.sha256 ? ` · sha256 ${row.sha256.slice(0, 12)}…` : ''}
                    </p>
                    {row.error ? (
                      <p
                        role="alert"
                        className="mt-[var(--lc-space-xs)] flex items-start gap-[var(--lc-space-xs)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-danger-fg)]"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        {row.error}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-[var(--lc-space-sm)]">
                    {row.status === 'complete' && !isExpired ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void downloadExport(row.id)}
                        disabled={downloadingId === row.id}
                        aria-label={`Download export ${row.id}`}
                      >
                        {downloadingId === row.id ? (
                          <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Download className="me-2 h-4 w-4" aria-hidden />
                        )}
                        Download
                      </Button>
                    ) : row.status === 'pending' || row.status === 'running' ? (
                      <span className="flex items-center gap-[var(--lc-space-xs)] text-[var(--lc-text-muted)]">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Preparing…
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
