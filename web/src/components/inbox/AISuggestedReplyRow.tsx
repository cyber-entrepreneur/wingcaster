import { Button } from '@/components/ui/button'

export type AISuggestedReplyRowProps = {
  suggestions: string[]
  loading?: boolean
  disabled?: boolean
  onInsert: (text: string) => void
}

function SkeletonChip({ widthClass }: { widthClass: string }) {
  return (
    <span
      className={`inline-flex min-h-11 h-11 shrink-0 animate-pulse rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] ${widthClass}`}
      aria-hidden
    />
  )
}

export function AISuggestedReplyRow({
  suggestions,
  loading,
  disabled,
  onInsert,
}: AISuggestedReplyRowProps) {
  if (!loading && suggestions.length === 0) return null

  return (
    <div
      className="flex min-h-11 shrink-0 items-center gap-2 overflow-x-auto border-t border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-2"
      aria-label="Suggested replies"
      aria-busy={loading || undefined}
    >
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
            className="min-h-11 h-11 shrink-0 rounded-[var(--lc-radius-pill)]"
            onClick={() => onInsert(text)}
          >
            {text}
          </Button>
        ))
      )}
    </div>
  )
}
