/**
 * PA — Market on/off registry (migration 804).
 *
 * Turn a market ON to offer it to agents and activate its listing-verification
 * triggers; OFF hides it from the composer and suppresses those triggers. Launch
 * config is Lebanon-only. Consumes GET/PUT /api/admin/markets (platform-admin).
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MarketRow {
  code: string
  label: string
  enabled: boolean
}

export function MarketsAdminPage() {
  usePageTitle('Markets')
  const { addToast } = useToast()
  const [markets, setMarkets] = useState<MarketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getAdminMarkets()
      setMarkets(res.markets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load markets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(row: MarketRow) {
    const next = !row.enabled
    setSaving(row.code)
    // optimistic
    setMarkets((prev) => prev.map((m) => (m.code === row.code ? { ...m, enabled: next } : m)))
    try {
      await api.setAdminMarket(row.code, next)
      addToast({
        title: `${row.label} ${next ? 'enabled' : 'disabled'}.`,
        variant: 'success',
      })
    } catch (err) {
      // revert
      setMarkets((prev) => prev.map((m) => (m.code === row.code ? { ...m, enabled: row.enabled } : m)))
      addToast({
        title: 'Could not update market',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setSaving(null)
    }
  }

  const enabledCount = markets.filter((m) => m.enabled).length

  return (
    <div className="mx-auto max-w-3xl px-[var(--lc-space-md)] py-[var(--lc-space-xl)]">
      <div className="mb-[var(--lc-space-xl)] flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--lc-type-heading-1)] font-semibold text-[var(--lc-text-heading)]">
            Markets
          </h1>
          <p className="mt-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
            Turn a market on to offer it to agents and activate its listing-verification
            requirements. Off hides it from the composer and suppresses those triggers.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-status-unpublished-fg)] bg-[var(--lc-status-unpublished-bg)] px-3 py-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-unpublished-fg)]"
        >
          {error}
        </div>
      ) : (
        <>
          <p className="mb-3 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            {enabledCount} of {markets.length} markets on
          </p>
          <ul className="space-y-2">
            {markets.map((row) => (
              <li
                key={row.code}
                className="flex items-center justify-between gap-4 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4"
              >
                <div>
                  <span className="font-semibold text-[var(--lc-text-heading)]">{row.label}</span>
                  <span className="ml-2 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                    {row.code}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.enabled}
                  aria-label={`${row.enabled ? 'Disable' : 'Enable'} ${row.label}`}
                  disabled={saving === row.code}
                  onClick={() => void toggle(row)}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-[var(--lc-radius-pill)] transition-colors',
                    row.enabled
                      ? 'bg-[var(--lc-action-primary)]'
                      : 'bg-[var(--lc-surface-sunken)] border border-[var(--lc-border-strong)]',
                    saving === row.code && 'opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 transform rounded-full bg-[var(--lc-surface)] shadow transition-transform',
                      row.enabled ? 'translate-x-5' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
