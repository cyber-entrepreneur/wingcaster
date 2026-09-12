import { useRef } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CharacterCounter, isOverChannelLimit } from '@/components/inbox/CharacterCounter'
import { cn } from '@/lib/utils'

export type ComposeBarProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  channel: string
  contactFirstName?: string | null
  disabled?: boolean
  sending?: boolean
  closed?: boolean
  onReopen?: () => void
}

export function ComposeBar({
  value,
  onChange,
  onSend,
  channel,
  contactFirstName,
  disabled,
  sending,
  closed,
  onReopen,
}: ComposeBarProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const overLimit = isOverChannelLimit(value, channel)
  const canSend = Boolean(value.trim()) && !sending && !disabled && !closed && !overLimit

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div className="shrink-0 border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-4 py-3 shadow-[0_-2px_0_rgba(25,21,18,0.06)]">
      <div className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              contactFirstName
                ? `Reply to ${contactFirstName}…`
                : 'Type your reply…'
            }
            rows={1}
            disabled={closed || disabled || sending}
            aria-label="Compose message"
            className={cn(
              'max-h-40 min-h-[44px] w-full resize-y rounded-[var(--lc-radius-lg)]',
              'border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 pe-16',
              'text-[length:var(--lc-type-body)] text-[var(--lc-text-primary)]',
              'placeholder:text-[var(--lc-text-muted)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
          <div className="pointer-events-none absolute bottom-2 end-2">
            <CharacterCounter text={value} channel={channel} />
          </div>
        </div>
        <Button
          size="icon"
          className="h-11 w-11 shrink-0 rounded-[var(--lc-radius-lg)]"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          aria-busy={sending || undefined}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {closed ? (
        <p className="mt-1.5 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          Conversation closed —{' '}
          {onReopen ? (
            <button type="button" onClick={onReopen} className="underline hover:text-[var(--lc-text-primary)]">
              reopen
            </button>
          ) : (
            'reopen'
          )}{' '}
          to reply.
        </p>
      ) : null}
    </div>
  )
}
