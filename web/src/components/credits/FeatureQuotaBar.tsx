import { Card, CardContent } from '@/components/ui/card'
import type { FeatureQuota } from '@/api/client'

export function FeatureQuotaBar({ quota }: { quota: FeatureQuota }) {
  const ratio = Math.min(1.5, Math.max(0, quota.usage_ratio || 0))
  const pct = Math.round(Math.min(100, ratio * 100))
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">{quota.display_name || quota.feature_code}</span>
          <span className="text-muted-foreground">
            {quota.used_credits?.toFixed?.(2) ?? (quota.quota_used_this_cycle / 100).toFixed(2)}
            {' of '}
            {(quota.typical_credits ?? quota.quota_display / 100).toFixed(2)} typical
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`h-full ${quota.soft_warning ? 'bg-amber-500' : 'bg-emerald-600'}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        {quota.soft_warning ? (
          <p className="text-xs text-amber-700">
            You have used 100% of the typical monthly allowance for this feature. This is a soft warning —
            you can keep going while shared balance remains. Hard block only at total balance = 0.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Informational quota. Shared wallet is the hard limit.</p>
        )}
      </CardContent>
    </Card>
  )
}
