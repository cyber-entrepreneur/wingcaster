/**
 * AGT-PUB-005 — Portal submission form (real-estate portals).
 *
 * Portal list comes from dynamic `portal_registry` (`GET /api/portals`).
 * Submit creates a publishing job and hands off to AGT-PUB-003 receipt:
 *   `/publish/receipts/:jobId`
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Globe2, Loader2, Send } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type RegistryPortal = {
  code: string
  display_name: string
  description: string | null
  logo_url: string | null
  country_codes: string[]
  primary_language: string | null
  is_active: boolean
  deprecated_at: string | null
  sla_hours: number | null
}

export function portalReceiptPath(jobId: string) {
  return `/publish/receipts/${jobId}`
}

export function PortalSubmitPage() {
  const { listingId, id } = useParams<{ listingId?: string; id?: string }>()
  const propertyId = listingId || id || ''
  const navigate = useNavigate()
  const { addToast } = useToast()
  usePageTitle('Submit to portals')

  const [propertyTitle, setPropertyTitle] = useState('')
  const [portals, setPortals] = useState<RegistryPortal[]>([])
  const [selected, setSelected] = useState<Record<string, string | null>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!propertyId) {
      setLoading(false)
      setError('Missing listing id')
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.getPortalRegistry(),
      api.getProperty(propertyId).catch(() => null),
    ])
      .then(([registry, property]) => {
        if (cancelled) return
        const list = Array.isArray(registry?.portals) ? registry.portals : []
        setPortals(list)
        if (property && typeof property === 'object' && 'title' in property) {
          setPropertyTitle(String((property as { title?: string }).title || ''))
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Failed to load portals'
        setError(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [propertyId])

  const chosenCodes = useMemo(() => Object.keys(selected), [selected])

  function togglePortal(code: string, countryCodes: string[]) {
    setSelected((prev) => {
      const next = { ...prev }
      if (code in next) {
        delete next[code]
      } else {
        next[code] = countryCodes.length === 1 ? countryCodes[0] : null
      }
      return next
    })
  }

  async function handleSubmit() {
    if (submitting || chosenCodes.length === 0 || !propertyId) return
    setSubmitting(true)
    setError('')
    try {
      const portalsPayload = chosenCodes.map((code) => {
        const country = selected[code]
        return country ? { code, country_code: country } : code
      })
      const result = await api.createPublishingJob(
        propertyId,
        portalsPayload,
        message.trim() || undefined,
      )
      const jobId = result?.jobId || result?.job?.id
      if (!jobId) {
        throw new Error('Submit succeeded but no job id was returned')
      }
      addToast({
        title: 'Submitted for review',
        description: `${chosenCodes.length} portal${chosenCodes.length === 1 ? '' : 's'} queued`,
        variant: 'success',
      })
      navigate(portalReceiptPath(jobId))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submit failed'
      setError(msg)
      addToast({ title: 'Submit failed', description: msg, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="portal-submit-loading">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6" data-testid="portal-submit-page">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to={propertyId ? `/listings/${propertyId}?tab=portals` : '/listings'}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-[var(--lc-text-primary)]">
            Submit to portals
          </h1>
          <p className="mt-0.5 truncate text-sm text-[var(--lc-text-muted)]">
            {propertyTitle || 'Listing'} · for PA review
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe2 className="h-5 w-5 text-[var(--lc-action-primary)]" />
            Choose portals
          </CardTitle>
          <CardDescription>
            Portals are loaded from the live registry. Submissions go to Platform Admin review
            before any live push.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {portals.length === 0 ? (
            <p
              className="rounded-md border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-4 text-sm text-[var(--lc-text-muted)]"
              data-testid="portal-submit-empty"
            >
              No portals are registered yet. Ask a Platform Admin to activate portals in the registry.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="portal-submit-list">
              {portals.map((portal) => {
                const isSel = portal.code in selected
                const countries = portal.country_codes || []
                return (
                  <li key={portal.code}>
                    <button
                      type="button"
                      data-testid={`portal-option-${portal.code}`}
                      onClick={() => togglePortal(portal.code, countries)}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        isSel
                          ? 'border-[var(--lc-action-primary)] bg-[var(--lc-surface-sunken)]'
                          : 'border-[var(--lc-border)] hover:bg-[var(--lc-surface-sunken)]'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md ${
                          isSel
                            ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                            : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]'
                        }`}
                      >
                        {portal.logo_url ? (
                          <img
                            src={portal.logo_url}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs font-semibold uppercase">
                            {portal.display_name.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[var(--lc-text-primary)]">
                            {portal.display_name}
                          </span>
                          {!portal.is_active && (
                            <Badge variant="outline" className="text-[10px]">
                              stub
                            </Badge>
                          )}
                          {countries.length > 0 && (
                            <span className="text-[11px] text-[var(--lc-text-muted)]">
                              {countries.join(' · ')}
                            </span>
                          )}
                        </div>
                        {portal.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--lc-text-muted)]">
                            {portal.description}
                          </p>
                        )}
                        {isSel && countries.length > 1 && (
                          <select
                            className="mt-2 block w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-2 py-1.5 text-xs"
                            value={selected[portal.code] || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const value = e.target.value || null
                              setSelected((prev) => ({ ...prev, [portal.code]: value }))
                            }}
                            aria-label={`Country for ${portal.display_name}`}
                          >
                            <option value="">All covered countries</option>
                            {countries.map((cc) => (
                              <option key={cc} value={cc}>
                                {cc}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      {isSel && (
                        <Check className="mt-1 h-5 w-5 shrink-0 text-[var(--lc-action-primary)]" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div>
            <Label htmlFor="portal-submit-note" className="text-xs">
              Note for reviewers (optional)
            </Label>
            <Input
              id="portal-submit-note"
              className="mt-1"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Priority — open house this weekend"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] px-3 py-2 text-sm text-[var(--lc-status-danger-fg)]"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || chosenCodes.length === 0}
              className="gap-2 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
              data-testid="portal-submit-cta"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit for review
              {chosenCodes.length > 0 ? ` (${chosenCodes.length})` : ''}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PortalSubmitPage
