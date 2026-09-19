/**
 * PA-PVA-011 — Canonical property resolution admin queue.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { canonicalResolutionApi, type CanonicalQueueItem } from './canonicalApi'

export function CanonicalResolutionQueuePage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<CanonicalQueueItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void canonicalResolutionApi.list()
      .then((body) => setItems(body.items || []))
      .finally(() => setLoading(false))
  }, [])

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card><CardHeader><CardTitle>Platform admin required</CardTitle></CardHeader></Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Canonical property resolution</h1>
          <p className="text-sm text-[var(--lc-text-muted)]">
            Review contested dedup groups, false-positive merges, and false-negative misses.
          </p>
        </div>
        <Link to="/admin/pricing" className="text-sm underline text-[var(--lc-text-muted)]">
          Back to pricing config
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : !items.length ? (
        <Card><CardContent className="py-6 text-sm text-[var(--lc-text-muted)]">No canonical groups need review.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--lc-surface-sunken)] text-left">
                <tr>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Siblings</th>
                  <th className="px-3 py-2">Primary agency</th>
                  <th className="px-3 py-2">Disputes</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-t border-[var(--lc-border)] hover:bg-[var(--lc-surface-sunken)]"
                    onClick={() => navigate(`/admin/pricing/canonical/${item.id}`)}
                  >
                    <td className="px-3 py-2">
                      <Numeric>{String(item.address || item.id)}</Numeric>
                      {item.city ? (
                        <p className="text-xs text-[var(--lc-text-muted)]">
                          <Numeric>{String(item.city)}</Numeric>
                          {item.neighborhood ? ` · ${item.neighborhood}` : ''}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2"><Numeric>{String(item.sibling_count ?? 0)}</Numeric></td>
                    <td className="px-3 py-2"><Numeric>{String(item.primary_agency_name || '—')}</Numeric></td>
                    <td className="px-3 py-2"><Numeric>{String(item.dispute_count ?? 0)}</Numeric></td>
                    <td className="px-3 py-2">
                      {item.on_hold ? <Badge variant="destructive">On hold</Badge> : <Badge variant="secondary">Open</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default CanonicalResolutionQueuePage
