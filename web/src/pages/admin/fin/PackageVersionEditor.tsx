import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinAdminGate } from './shell'

const FLAG_CODES = [
  'white-label', 'xml-feed', 'command-center', 'agency-management', 'inspector',
  'crm.contacts', 'crm.tasks', 'crm.opportunities', 'listings.crud',
]

type Feature = Record<string, unknown>
type Quota = { feature_id: string; credits_per_property: number; rollover_policy: string; overage_credit_price_micro_usd: string }

export function PackageVersionEditor() {
  const { id, vid } = useParams()
  const navigate = useNavigate()
  const [version, setVersion] = useState<Record<string, unknown> | null>(null)
  const [features, setFeatures] = useState<Feature[]>([])
  const [propertiesCovered, setPropertiesCovered] = useState('0')
  const [monthlyPrice, setMonthlyPrice] = useState('0')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [quotas, setQuotas] = useState<Record<string, Quota>>({})
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [previewN, setPreviewN] = useState(10)
  const [message, setMessage] = useState('')
  const published = String(version?.state || '') === 'PUBLISHED' || String(version?.state || '') === 'DEPRECATED'

  const load = useCallback(() => {
    if (!id || !vid) return
    void Promise.all([
      api.finGet(`/packages/${id}/versions/${vid}`),
      api.finGet('/metered-features?active=true'),
    ]).then(([ver, feats]) => {
      setVersion(ver)
      setPropertiesCovered(String(ver.properties_covered ?? 0))
      setMonthlyPrice(String(ver.monthly_price_minor ?? 0))
      setEffectiveFrom(ver.effective_from ? String(ver.effective_from).slice(0, 16) : '')
      const nextQuotas: Record<string, Quota> = {}
      for (const q of (ver.quotas || []) as Array<Record<string, unknown>>) {
        nextQuotas[String(q.feature_id)] = {
          feature_id: String(q.feature_id),
          credits_per_property: Number(q.credits_per_property),
          rollover_policy: String(q.rollover_policy || 'expire'),
          overage_credit_price_micro_usd: q.overage_credit_price_micro_usd == null ? '' : String(q.overage_credit_price_micro_usd),
        }
      }
      setQuotas(nextQuotas)
      const nextFlags: Record<string, boolean> = {}
      for (const f of (ver.flags || []) as Array<Record<string, unknown>>) {
        nextFlags[String(f.feature_code)] = Boolean(f.enabled)
      }
      setFlags(nextFlags)
      setFeatures((feats.features || []) as Feature[])
    })
  }, [id, vid])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return features.filter((f) => {
      const code = String(f.code || '')
      const cat = String(f.category || '')
      if (category && cat !== category) return false
      if (search && !code.includes(search) && !String(f.display_name || '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [features, category, search])

  const livePreview = useMemo(() => {
    let total = 0
    const breakdown = Object.values(quotas).map((q) => {
      const credits = q.credits_per_property * previewN
      total += credits
      const feature = features.find((f) => String(f.id) === q.feature_id)
      return { feature_code: String(feature?.code || q.feature_id), total_credits: credits }
    })
    const revenueMinor = Number(monthlyPrice || 0) * previewN
    return { total_credits: total, breakdown, monthly_revenue_minor: revenueMinor }
  }, [quotas, previewN, monthlyPrice, features])

  async function saveDraft() {
    if (!id || !vid || published) return
    await api.finPatch(`/packages/${id}/versions/${vid}`, {
      properties_covered: Number(propertiesCovered),
      monthly_price_minor: Number(monthlyPrice),
      effective_from: effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined,
    })
    const existing = new Set(Object.keys(quotas))
    for (const quota of Object.values(quotas)) {
      await api.finPost(`/packages/${id}/versions/${vid}/quotas`, {
        feature_id: quota.feature_id,
        credits_per_property: quota.credits_per_property,
        rollover_policy: quota.rollover_policy,
        overage_credit_price_micro_usd: quota.overage_credit_price_micro_usd === '' ? null : Number(quota.overage_credit_price_micro_usd),
      })
    }
    const serverQuotas = ((version?.quotas || []) as Array<Record<string, unknown>>).map((q) => String(q.feature_id))
    for (const featureId of serverQuotas) {
      if (!existing.has(featureId)) {
        await api.finDelete(`/packages/${id}/versions/${vid}/quotas/${featureId}`)
      }
    }
    for (const code of FLAG_CODES) {
      if (flags[code]) {
        await api.finPost(`/packages/${id}/versions/${vid}/flags`, { feature_code: code, enabled: true })
      } else {
        await api.finDelete(`/packages/${id}/versions/${vid}/flags/${encodeURIComponent(code)}`).catch(() => undefined)
      }
    }
    setMessage('Draft saved')
    load()
  }

  const canSubmit = Object.keys(quotas).length > 0 || Number(monthlyPrice) > 0
  const isOwn = false

  return (
    <FinAdminGate title="Package version">
      <p className="mb-3 text-sm text-muted-foreground">
        {String(version?.package_display_name || '')} · v{String(version?.version_number || '')} · {String(version?.state || 'DRAFT')} · {String(version?.tier || '')} / {String(version?.target_audience || '')}
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Economics</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="properties_covered">properties_covered</Label>
                <Input id="properties_covered" type="number" min={0} disabled={published} value={propertiesCovered}
                  onChange={(e) => setPropertiesCovered(e.target.value)} onBlur={() => void saveDraft()} />
              </div>
              <div>
                <Label htmlFor="monthly_price_minor">monthly_price_minor</Label>
                <Input id="monthly_price_minor" type="number" min={0} disabled={published} value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)} onBlur={() => void saveDraft()} />
              </div>
              <div>
                <Label htmlFor="effective_from">effective_from</Label>
                <Input id="effective_from" type="datetime-local" disabled={published} value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Feature quotas</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-3 flex gap-2">
                <Input placeholder="search" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Input placeholder="category" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-1">Feature</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Credits / property</th>
                    <th>Rollover</th>
                    <th>Overage µUSD</th>
                    <th>Total @ {previewN}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((feature) => {
                    const fid = String(feature.id)
                    const quota = quotas[fid]
                    return (
                      <tr key={fid} className="border-t">
                        <td className="py-1">{String(feature.display_name)}</td>
                        <td>{String(feature.category)}</td>
                        <td>{String(feature.meter_unit)}</td>
                        <td>
                          {quota ? (
                            <Input type="number" min={0} className="h-8 w-24" value={quota.credits_per_property}
                              disabled={published}
                              onChange={(e) => setQuotas((cur) => ({
                                ...cur,
                                [fid]: { ...quota, credits_per_property: Number(e.target.value) },
                              }))} />
                          ) : (
                            <Button size="sm" variant="outline" disabled={published} onClick={() => setQuotas((cur) => ({
                              ...cur,
                              [fid]: { feature_id: fid, credits_per_property: 0, rollover_policy: 'expire', overage_credit_price_micro_usd: '' },
                            }))}>Add</Button>
                          )}
                        </td>
                        <td>
                          {quota && (
                            <select className="h-8 rounded border bg-background text-sm" disabled={published} value={quota.rollover_policy}
                              onChange={(e) => setQuotas((cur) => ({ ...cur, [fid]: { ...quota, rollover_policy: e.target.value } }))}>
                              <option value="expire">expire</option>
                              <option value="carry">carry</option>
                            </select>
                          )}
                        </td>
                        <td>
                          {quota && (
                            <Input className="h-8 w-28" disabled={published} value={quota.overage_credit_price_micro_usd}
                              onChange={(e) => setQuotas((cur) => ({ ...cur, [fid]: { ...quota, overage_credit_price_micro_usd: e.target.value } }))} />
                          )}
                        </td>
                        <td>{quota ? quota.credits_per_property * previewN : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Feature flags</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {FLAG_CODES.map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={published} checked={Boolean(flags[code])}
                    onChange={(e) => setFlags((cur) => ({ ...cur, [code]: e.target.checked }))} />
                  {code}
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 h-fit">
          <Card>
            <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Label htmlFor="preview_n">properties_committed ({previewN})</Label>
              <input id="preview_n" type="range" min={0} max={200} value={previewN}
                onChange={(e) => setPreviewN(Number(e.target.value))} className="w-full" />
              <p>total_credits: <strong>{livePreview.total_credits}</strong></p>
              <p>monthly revenue (minor): {livePreview.monthly_revenue_minor}</p>
              <ul className="max-h-40 overflow-auto text-xs">
                {livePreview.breakdown.map((row) => (
                  <li key={row.feature_code}>{row.feature_code}: {row.total_credits}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={published} onClick={() => void saveDraft()}>Save draft</Button>
        <Button size="sm" disabled={published || !canSubmit} onClick={() => {
          void saveDraft().then(() => api.finPost(`/packages/${id}/versions/${vid}/submit-for-approval`, {}))
            .then(() => { setMessage('Submitted for approval'); load() })
        }}>Submit for approval</Button>
        <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/fin/packages/${id}`)}>Cancel</Button>
        {isOwn ? <p className="text-sm text-muted-foreground">you cannot approve your own submissions</p> : null}
      </div>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
      <p className="mt-2 text-sm"><Link to={`/admin/fin/packages/${id}`} className="underline">Back to package</Link></p>
    </FinAdminGate>
  )
}
