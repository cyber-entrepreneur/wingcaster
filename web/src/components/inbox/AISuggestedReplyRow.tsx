import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/api/client'

export type AiUsageToday = {
  used: number
  cap: number
  resets_at: string
}

export type AISuggestedReplyRowProps = {
  suggestions: string[]
  loading?: boolean
  disabled?: boolean
  onInsert: (text: string) => void
  /** Bump after each successful suggestion generation to refresh usage. */
  usageRefreshToken?: number
  /** Set when the last generate call returned AI_DAILY_CAP / AI_MONTHLY_CAP. */
  capError?: { resets_at?: string; code?: string } | null
}

function formatResetTime(iso: string | undefined): string {
  if (!iso) return 'midnight UTC'
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    })
  } catch {
    return 'midnight UTC'
  }
}

function SkeletonChip({ widthClass }: { widthClass: string }) {
  return (
    <span
      className={`inline-flex h-11 min-h-11 shrink-0 animate-pulse rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] ${widthClass}`}
      aria-hidden
    />
  )
}

export function AISuggestedReplyRow({
  suggestions,
  loading,
  disabled,
  onInsert,
  usageRefreshToken = 0,
  capError = null,
}: AISuggestedReplyRowProps) {
  const [usage, setUsage] = useState<AiUsageToday | null>(null)

  const refreshUsage = useCallback(async () => {
    try {
      const snap = await api.getMyAiUsageToday()
      if (snap && typeof snap.used === 'number' && typeof snap.cap === 'number') {
        setUsage({
          used: snap.used,
          cap: snap.cap,
          resets_at: snap.resets_at,
        })
      }
    } catch {
      // usage counter is non-critical
    }
  }, [])

  useEffect(() => {
    void refreshUsage()
  }, [refreshUsage, usageRefreshToken])

  if (!loading && suggestions.length === 0 && !capError) {
    if (!(usage != null && usage.used >= 150)) return null
  }

  const resetsAt = formatResetTime(capError?.resets_at || usage?.resets_at)
  const showCounter = usage != null && usage.used >= 150
  const showChips = Boolean(loading || suggestions.length > 0)

  return (
    <div
      className="flex min-h-11 shrink-0 flex-col gap-1 border-t border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-2"
      aria-label="Suggested replies"
      aria-busy={loading || undefined}
    >
      {capError ? (
        <p
          className="text-start text-xs text-[var(--lc-status-danger-fg)]"
          role="status"
        >
          AI suggestions paused — daily cap reached. Resets at {resetsAt}.
        </p>
      ) : null}

      {!capError && showCounter ? (
        <span className="text-start text-xs text-[var(--lc-text-muted)]">
          AI usage {usage.used}/{usage.cap} today · resets at {resetsAt}
        </span>
      ) : null}

      {!capError && showChips ? (
        <div className="flex items-center gap-2 overflow-x-auto">
          {loading ? (
            <>
              <SkeletonChip widthClass="w-28" />
              <SkeletonChip widthClass="w-36" />
              <SkeletonChip widthClass="w-24" />
            </>
          ) : (
            suggestions.map((text) => (
              <Button
                key={text}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-11 min-h-11 shrink-0 rounded-[var(--lc-radius-pill)]"
                onClick={() => onInsert(text)}
              >
                {text}
              </Button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
