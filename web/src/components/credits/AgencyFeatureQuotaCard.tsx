import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { AgencyFeatureQuota } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'

export function AgencyFeatureQuotaCard({ quota }: { quota: AgencyFeatureQuota }) {
  const [expanded, setExpanded] = useState(false)
  const ratio = Math.min(1.5, Math.max(0, quota.usage_ratio || 0))
  const pct = Math.round(Math.min(100, ratio * 100))
  const barColor = quota.at_cap
    ? 'bg-red-600'
    : quota.near_cap
      ? 'bg-amber-500'
      : 'bg-emerald-600'

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-[var(--lc-text-primary)]">
              {quota.display_name || quota.feature_code}
            </p>
            <p className="text-sm text-[var(--lc-text-muted)]">
              <Numeric>{quota.used_credits?.toFixed(2) ?? '0.00'}</Numeric>
              {' of '}
              <Numeric>{quota.typical_credits?.toFixed(2) ?? '0.00'}</Numeric>
              {' typical this cycle'}
            </p>
          </div>
          {quota.agent_breakdown.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="ms-1">Agents</span>
            </Button>
          )}
        </div>

        <div
          className="h-2 overflow-hidden rounded-full bg-[var(--lc-action-secondary)]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>

        {quota.at_cap && (
          <p className="text-xs text-red-700">At typical monthly allowance for this feature.</p>
        )}
        {quota.near_cap && !quota.at_cap && (
          <p className="text-xs text-amber-700">Approaching typical monthly allowance.</p>
        )}
        {quota.soft_warning && !quota.at_cap && !quota.near_cap && (
          <p className="text-xs text-amber-700">
            Soft warning — shared wallet balance is the hard limit.
          </p>
        )}

        {expanded && quota.agent_breakdown.length > 0 && (
          <ul className="space-y-2 border-t border-[var(--lc-border)] pt-3">
            {quota.agent_breakdown.map((row) => (
              <li key={`${quota.feature_code}-${row.agent_user_id || row.agent_name}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-[var(--lc-text-primary)]">{row.agent_name}</span>
                <Numeric className="shrink-0 text-[var(--lc-text-muted)]">
                  {row.used_credits.toFixed(2)}
                </Numeric>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
