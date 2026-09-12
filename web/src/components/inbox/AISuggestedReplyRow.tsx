import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type AISuggestedReplyRowProps = {
  suggestions: string[]
  loading?: boolean
  disabled?: boolean
  onInsert: (text: string) => void
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
    >
      {loading ? (
        <span className="inline-flex items-center gap-2 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting suggestions
        </span>
      ) : (
        suggestions.map((text) => (
          <Button
            key={text}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-8 shrink-0 rounded-[var(--lc-radius-pill)]"
            onClick={() => onInsert(text)}
          >
            {text}
          </Button>
        ))
      )}
    </div>
  )
}
