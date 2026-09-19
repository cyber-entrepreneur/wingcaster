/**
 * PA-PVA-011 — Canonical property resolution detail + decision panel.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { canonicalResolutionApi, type CanonicalDetail } from './canonicalApi'

export function CanonicalResolutionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { addToast } = useToast()
  const [detail, setDetail] = useState<CanonicalDetail | null>(null)
  const [selectedListingId, setSelectedListingId] = useState('')
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [reason, setReason] = useState('PA review override')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  function reload() {
    if (!id) return
    setLoading(true)
    void canonicalResolutionApi.get(id)
      .then((body) => {
        setDetail(body.canonical || null)
        const primary = body.canonical?.siblings?.find((row) => row.is_primary)?.id
          || body.canonical?.siblings?.[0]?.id
          || ''
        setSelectedListingId(primary)
      })
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load canonical group',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [id])

  async function act(label: string, work: Promise<unknown>) {
    setBusy(true)
    try {
      await work
      addToast({ variant: 'success', title: `${label} completed` })
      reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: `${label} failed`,
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card><CardHeader><CardTitle>Platform admin required</CardTitle></CardHeader></Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <Link to="/admin/pricing/canonical" className="text-sm underline text-[var(--lc-text-muted)]">
          Back to canonical queue
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold">Canonical property detail</h1>
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Compare sibling listings side-by-side and apply primary, split, merge, or hold decisions.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : !detail ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Canonical group not found.</p>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg">
                <Numeric>{String(detail.location || detail.city || detail.id)}</Numeric>
              </CardTitle>
              {detail.on_hold ? <Badge variant="destructive">On hold</Badge> : <Badge variant="secondary">Active</Badge>}
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p>Primary agency: <Numeric>{String(detail.primary_agency_name || '—')}</Numeric></p>
              <p>Disputes: <Numeric>{String(detail.dispute_count ?? 0)}</Numeric></p>
              {detail.hold_reason ? <p className="sm:col-span-2">Hold reason: {detail.hold_reason}</p> : null}
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-lg">Sibling listings</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-[var(--lc-surface-sunken)] text-left">
                  <tr>
                    <th className="px-3 py-2">Listing</th>
                    <th className="px-3 py-2">Agency</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Updated</th>
                    <th className="px-3 py-2">Primary</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.siblings || []).map((row) => (
                    <tr key={row.id} className="border-t border-[var(--lc-border)]">
                      <td className="px-3 py-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="canonical-listing"
                            checked={selectedListingId === row.id}
                            onChange={() => setSelectedListingId(row.id)}
                          />
                          <span><Numeric>{String(row.title || row.id)}</Numeric></span>
                        </label>
                      </td>
                      <td className="px-3 py-2"><Numeric>{String(row.agency_name || row.agent_name || '—')}</Numeric></td>
                      <td className="px-3 py-2"><Numeric>{String(row.price ?? '—')} {row.price_unit || ''}</Numeric></td>
                      <td className="px-3 py-2"><Numeric>{String(row.updated_at || row.listed_date || '—')}</Numeric></td>
                      <td className="px-3 py-2">{row.is_primary ? <Badge variant="secondary">Primary</Badge> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-lg">Decision panel</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <label htmlFor="canonical-reason" className="text-xs text-[var(--lc-text-muted)]">Reason</label>
                <input
                  id="canonical-reason"
                  className="mt-1 block min-h-tap w-full max-w-xl rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="canonical-merge-target" className="text-xs text-[var(--lc-text-muted)]">Merge target canonical id</label>
                <input
                  id="canonical-merge-target"
                  className="mt-1 block min-h-tap w-full max-w-xl rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  placeholder="UUID of target canonical"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={busy || !selectedListingId || !reason.trim()}
                  onClick={() => id && void act('Change primary', canonicalResolutionApi.changePrimary(id, {
                    listing_id: selectedListingId,
                    reason: reason.trim(),
                  }))}
                >
                  Change primary
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !selectedListingId || !reason.trim()}
                  onClick={() => id && void act('Split listing', canonicalResolutionApi.split(id, {
                    listing_id: selectedListingId,
                    reason: reason.trim(),
                  }))}
                >
                  Split listing
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !mergeTargetId.trim() || !reason.trim()}
                  onClick={() => id && void act('Merge canonicals', canonicalResolutionApi.merge(id, {
                    target_canonical_id: mergeTargetId.trim(),
                    reason: reason.trim(),
                  })).then(() => navigate(`/admin/pricing/canonical/${mergeTargetId.trim()}`))}
                >
                  Merge into target
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !reason.trim()}
                  onClick={() => id && void act(detail.on_hold ? 'Release hold' : 'Hold investigation', canonicalResolutionApi.hold(id, {
                    reason: reason.trim(),
                    release: detail.on_hold,
                  }))}
                >
                  {detail.on_hold ? 'Release hold' : 'Hold pending investigation'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default CanonicalResolutionDetailPage
