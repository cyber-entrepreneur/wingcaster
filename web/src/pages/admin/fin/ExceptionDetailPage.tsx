/**
 * PA-EXC-002 — Exception detail
 *
 * One exception: full context, notes, and resolution actions.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FinAdminGate } from './shell'

interface ExceptionNote {
  id: string
  body: string
  wont_fix: boolean
  created_at: string
}

interface ExceptionDetail {
  id: string
  exception_type: string
  severity: string
  status: string
  tenant_id?: string | null
  resource_type?: string | null
  resource_id?: string | null
  description: string
  created_at?: string | null
  deferred?: boolean
  resolve_command?: string | null
  dl?: string | null
  payload?: Record<string, unknown>
  related_drifts?: Array<{ drift_id: string; check_code?: string; run_id?: string }>
  notes?: ExceptionNote[]
}

function severityVariant(severity: string) {
  if (severity === 'CRITICAL') return 'destructive'
  if (severity === 'HIGH') return 'default'
  return 'secondary'
}

export function ExceptionDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const encodedId = encodeURIComponent(id)
  const [detail, setDetail] = useState<ExceptionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payloadOpen, setPayloadOpen] = useState(false)
  const [tab, setTab] = useState<'context' | 'notes'>('context')
  const [noteBody, setNoteBody] = useState('')
  const [wontFixBody, setWontFixBody] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const body = await api.finGet(`/exceptions/${encodedId}`) as unknown as ExceptionDetail
      setDetail(body)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load exception')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [encodedId, id])

  useEffect(() => {
    void reload()
  }, [reload])

  const payloadJson = useMemo(
    () => JSON.stringify(detail?.payload || {}, null, 2),
    [detail?.payload],
  )

  async function addNote() {
    if (!noteBody.trim()) return
    setBusy('note')
    setActionMessage(null)
    try {
      await api.finPost(`/exceptions/${encodedId}/notes`, { body: noteBody.trim() })
      setNoteBody('')
      await reload()
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to add note')
    } finally {
      setBusy(null)
    }
  }

  async function markWontFix() {
    if (wontFixBody.trim().length < 10) {
      setActionMessage('Wont-fix requires at least 10 characters of justification.')
      return
    }
    setBusy('wont-fix')
    setActionMessage(null)
    try {
      await api.finPost(`/exceptions/${encodedId}/wont-fix`, { justification: wontFixBody.trim() })
      setWontFixBody('')
      await reload()
      setActionMessage('Wont-fix justification recorded.')
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to record wont-fix')
    } finally {
      setBusy(null)
    }
  }

  async function resolveException() {
    setBusy('resolve')
    setActionMessage(null)
    try {
      await api.finPost(`/exceptions/${encodedId}/resolve`, { reason_code: 'OPERATOR' })
      setActionMessage('Exception resolved.')
      await reload()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Resolve is not available yet'
      setActionMessage(message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <FinAdminGate title="Exception detail">
      <Button asChild variant="ghost" size="sm" className="mb-4 ps-0">
        <Link to="/admin/fin/exceptions">
          <ArrowLeft className="me-2 h-4 w-4" aria-hidden="true" />
          Exceptions
        </Link>
      </Button>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading exception…
        </div>
      )}

      {!loading && error && !detail && (
        <div className="space-y-3">
          <p className="text-sm text-red-500">{error}</p>
          <Button variant="outline" onClick={() => void reload()}>Retry</Button>
        </div>
      )}

      {!loading && detail && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{detail.exception_type}</h2>
              <p className="text-sm text-muted-foreground">{detail.description}</p>
              <p className="text-xs text-muted-foreground">
                Tenant {detail.tenant_id || '—'}
                {detail.resource_type ? ` · ${detail.resource_type}` : ''}
                {detail.resource_id ? ` ${detail.resource_id}` : ''}
              </p>
              {detail.created_at && (
                <p className="text-xs text-muted-foreground">Opened {detail.created_at}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={severityVariant(detail.severity)}>{detail.severity}</Badge>
              <Badge variant="outline">{detail.status}</Badge>
              {detail.deferred && (
                <Badge variant="outline">{detail.dl || 'Deferred'}</Badge>
              )}
            </div>
          </div>

          {actionMessage && (
            <p className="text-sm text-amber-600" role="status">{actionMessage}</p>
          )}

          <div className="flex flex-wrap gap-2 border-b pb-2">
            <Button
              size="sm"
              variant={tab === 'context' ? 'default' : 'ghost'}
              onClick={() => setTab('context')}
            >
              Context
            </Button>
            <Button
              size="sm"
              variant={tab === 'notes' ? 'default' : 'ghost'}
              onClick={() => setTab('notes')}
            >
              Notes
            </Button>
          </div>

          {tab === 'context' && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Payload</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPayloadOpen((open) => !open)}
                    aria-expanded={payloadOpen}
                  >
                    {payloadOpen ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </CardHeader>
                {payloadOpen && (
                  <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-[var(--lc-surface-sunken)] p-3 text-xs">
                      {payloadJson}
                    </pre>
                  </CardContent>
                )}
              </Card>

              {(detail.related_drifts || []).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Related drift</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {detail.related_drifts?.map((drift) => (
                      <div key={drift.drift_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                        <div>
                          <div className="font-medium">{drift.check_code || 'Drift item'}</div>
                          <div className="text-xs text-muted-foreground">{drift.drift_id}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/fin/reconciliation${drift.run_id ? '' : ''}`)}
                        >
                          Open reconciliation
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Resolution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detail.deferred && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        Domain command not wired yet
                        {detail.dl ? ` (${detail.dl})` : ''}. Notes and wont-fix justifications are still recorded.
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => void resolveException()}
                      disabled={busy === 'resolve'}
                    >
                      {busy === 'resolve' ? 'Resolving…' : 'Resolve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/admin/fin/approvals')}
                    >
                      Escalate
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="wont-fix" className="text-sm font-medium">
                      Wont-fix justification
                    </label>
                    <textarea
                      id="wont-fix"
                      value={wontFixBody}
                      onChange={(e) => setWontFixBody(e.target.value)}
                      placeholder="Explain why this exception will not be fixed (min 10 characters)"
                      rows={3}
                      className="flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void markWontFix()}
                      disabled={busy === 'wont-fix'}
                    >
                      Mark wont-fix
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {tab === 'notes' && (
            <Card>
              <CardHeader>
                <CardTitle>Operator notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(detail.notes || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {(detail.notes || []).map((note) => (
                      <li key={note.id} className="rounded-lg border p-3 text-sm">
                        <div className="mb-1 flex flex-wrap gap-2">
                          {note.wont_fix && <Badge variant="outline">Wont-fix</Badge>}
                          <span className="text-xs text-muted-foreground">{note.created_at}</span>
                        </div>
                        <p>{note.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Add an operator note"
                    className="min-w-[16rem] flex-1"
                  />
                  <Button size="sm" onClick={() => void addNote()} disabled={busy === 'note'}>
                    Add note
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </FinAdminGate>
  )
}
