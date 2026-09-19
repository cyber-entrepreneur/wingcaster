import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, Loader2, Settings2 } from 'lucide-react'
import { api, type AgencyWalletOverview, type AgencyWalletTransaction } from '@/api/client'
import { AllocationDonut } from '@/components/credits/AllocationDonut'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { downloadCsv } from '@/lib/downloadCsv'
import { usePageTitle } from '@/lib/usePageTitle'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'
type TransactionFilter = 'all' | 'top_up' | 'consumption'

function csvCell(value: string | number) {
  const text = String(value ?? '')
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function formatTransactionType(type: string) {
  if (type === 'top_up') return 'Top-up'
  if (type === 'consumption') return 'Consumption'
  return type
}

export function AgencyCreditsWalletPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Agency credits')

  const affiliation = (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const role = affiliation?.role || null
  const canAttemptLoad = Boolean(
    role === 'owner'
    || role === 'admin'
    || role === 'member',
  )

  const [overview, setOverview] = useState<AgencyWalletOverview | null>(null)
  const [loadState, setLoadState] = useState<LoadState>(canAttemptLoad ? 'loading' : 'forbidden')
  const [txFilter, setTxFilter] = useState<TransactionFilter>('all')
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertDraft, setAlertDraft] = useState('100')
  const [savingAlert, setSavingAlert] = useState(false)

  const load = useCallback(async () => {
    if (!canAttemptLoad) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const data = await api.getAgencyWalletOverview()
      setOverview(data)
      setAlertDraft(String(data.settings.low_balance_alert_threshold))
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) setLoadState('forbidden')
      else setLoadState('error')
    }
  }, [canAttemptLoad])

  useEffect(() => {
    void load()
  }, [load])

  const filteredTransactions = useMemo(() => {
    const rows = overview?.transactions || []
    if (txFilter === 'all') return rows
    return rows.filter((row) => row.type === txFilter)
  }, [overview?.transactions, txFilter])

  const exportTransactions = () => {
    const rows = filteredTransactions
    const headers = ['date', 'type', 'amount', 'description']
    const csvRows = rows.map((row: AgencyWalletTransaction) => [
      row.created_at,
      formatTransactionType(row.type),
      row.amount,
      row.description || '',
    ].map(csvCell).join(','))
    downloadCsv(
      [headers.join(','), ...csvRows].join('\n'),
      `agency-wallet-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    addToast({ title: 'Transactions exported', variant: 'success' })
  }

  const saveAlertThreshold = async () => {
    const threshold = Number(alertDraft)
    if (!Number.isFinite(threshold) || threshold < 0) {
      addToast({ title: 'Enter a valid threshold', variant: 'error' })
      return
    }
    setSavingAlert(true)
    try {
      const { settings } = await api.updateAgencyWalletSettings(threshold)
      setOverview((current) => current ? {
        ...current,
        settings,
        alerts: {
          ...current.alerts,
          threshold: settings.low_balance_alert_threshold,
          is_low_balance: current.balance.credits_remaining < settings.low_balance_alert_threshold,
        },
      } : current)
      setAlertOpen(false)
      addToast({ title: 'Alert threshold saved', variant: 'success' })
    } catch (err) {
      addToast({
        title: 'Could not save threshold',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setSavingAlert(false)
    }
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center" data-screen="AGN-CRD-001">
        <h1 className="text-2xl font-semibold text-[var(--lc-text-primary)]">Agency wallet</h1>
        <p className="mt-3 text-[var(--lc-text-muted)]">
          You need owner, admin, finance, or read-only access to view the agency credit wallet.
        </p>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" data-screen="AGN-CRD-001">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-label="Loading wallet" />
      </div>
    )
  }

  if (loadState === 'error' || !overview) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center" data-screen="AGN-CRD-001">
        <h1 className="text-2xl font-semibold text-[var(--lc-text-primary)]">Agency wallet</h1>
        <p className="text-[var(--lc-text-muted)]">The wallet overview could not be loaded.</p>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    )
  }

  const { balance, kpis, allocation, alerts, permissions } = overview

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8" data-screen="AGN-CRD-001">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--lc-text-primary)] sm:text-3xl">
            Agency wallet
          </h1>
          <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
            Agency-wide credit balance, allocation, and transaction history.
          </p>
        </div>
        {permissions.can_manage_settings && (
          <Button variant="outline" onClick={() => setAlertOpen(true)}>
            <Settings2 className="me-2 h-4 w-4" />
            Set alert threshold
          </Button>
        )}
      </div>

      {alerts.is_low_balance && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Low balance</p>
            <p className="text-sm">
              Agency pool is below your alert threshold of{' '}
              <Numeric>{alerts.threshold.toFixed(2)}</Numeric> credits.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Wallet balance" value={kpis.wallet_balance} suffix="credits" />
        <KpiCard title="MTD spend" value={kpis.mtd_spend} suffix="credits" />
        <KpiCard title="Burn rate" value={kpis.burn_rate_daily} suffix="/ day" />
        <KpiCard
          title="Days until exhausted"
          value={kpis.days_until_exhausted ?? '—'}
          suffix={kpis.days_until_exhausted == null ? '' : 'days'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
            <CardDescription>
              <Numeric>{allocation.allocated_total.toFixed(2)}</Numeric> credits with agents ·{' '}
              <Numeric>{allocation.unallocated_pool.toFixed(2)}</Numeric> in the shared pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationDonut slices={allocation.slices} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pool status</CardTitle>
            <CardDescription>Reserved credits are held for in-flight operations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-[var(--lc-text-muted)]">Available in pool</span>
              <Numeric className="text-2xl font-semibold text-[var(--lc-text-primary)]">
                {balance.credits_remaining.toFixed(2)}
              </Numeric>
            </div>
            {balance.credits_reserved > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-[var(--lc-text-muted)]">Reserved</span>
                <Numeric className="text-sm text-[var(--lc-text-muted)]">
                  {balance.credits_reserved.toFixed(2)}
                </Numeric>
              </div>
            )}
            {balance.hard_block && (
              <Badge variant="destructive">Hard block — pool is empty</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Last 50 agency wallet transactions</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={txFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setTxFilter('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={txFilter === 'top_up' ? 'default' : 'outline'}
              onClick={() => setTxFilter('top_up')}
            >
              Top-ups
            </Button>
            <Button
              size="sm"
              variant={txFilter === 'consumption' ? 'default' : 'outline'}
              onClick={() => setTxFilter('consumption')}
            >
              Consumption
            </Button>
            <Button size="sm" variant="outline" onClick={exportTransactions}>
              <Download className="me-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-sm text-[var(--lc-text-muted)]">No transactions match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--lc-border)] text-start text-[var(--lc-text-muted)]">
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--lc-border)] last:border-0">
                      <td className="px-2 py-2 text-[var(--lc-text-primary)]">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-[var(--lc-text-primary)]">
                        {formatTransactionType(row.type)}
                      </td>
                      <td className="px-2 py-2">
                        <Numeric>{row.amount.toFixed(2)}</Numeric>
                      </td>
                      <td className="px-2 py-2 text-[var(--lc-text-muted)]">
                        {row.description || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set alert threshold</DialogTitle>
            <DialogDescription>
              Show a low-balance banner when the agency pool drops below this amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="alert-threshold">Threshold (credits)</Label>
            <Input
              id="alert-threshold"
              inputMode="decimal"
              value={alertDraft}
              onChange={(event) => setAlertDraft(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveAlertThreshold()} disabled={savingAlert}>
              {savingAlert ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KpiCard({
  title,
  value,
  suffix,
}: {
  title: string
  value: number | string
  suffix: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <Numeric className="text-2xl font-semibold text-[var(--lc-text-primary)]">
            {typeof value === 'number' ? value.toFixed(2) : value}
          </Numeric>
          {suffix && <span className="text-sm text-[var(--lc-text-muted)]">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
