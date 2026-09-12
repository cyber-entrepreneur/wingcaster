import { Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CmdEmptyState } from '@/components/layout/CmdEmptyState'

export type InboxEmptyVariant = 'first-run' | 'filtered' | 'search' | 'preview'

export type InboxEmptyStateProps = {
  variant: InboxEmptyVariant
  query?: string
  onClearFilters?: () => void
  onClearSearch?: () => void
}

export function InboxEmptyState({ variant, query, onClearFilters, onClearSearch }: InboxEmptyStateProps) {
  if (variant === 'preview') {
    return (
      <CmdEmptyState
        icon={<Inbox className="h-8 w-8" />}
        title="Select a conversation to preview it here"
        description="Tap a conversation in the list. Compose a new one when you're ready."
      />
    )
  }

  if (variant === 'search') {
    return (
      <CmdEmptyState
        icon={<Inbox className="h-6 w-6" />}
        title={`No matches for "${query || ''}"`}
        description="Try a different search term."
        action={
          onClearSearch ? (
            <Button variant="outline" size="sm" onClick={onClearSearch}>
              Clear search
            </Button>
          ) : undefined
        }
        className="py-10"
      />
    )
  }

  if (variant === 'filtered') {
    return (
      <CmdEmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="No conversations match your filters"
        description="Clear filters to see everything in your inbox."
        action={
          onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
        className="py-10"
      />
    )
  }

  return (
    <CmdEmptyState
      icon={<Inbox className="h-8 w-8" />}
      title="No conversations yet"
      description="Every message from every channel lands here. Connect WhatsApp intake to catch your first inquiry."
      action={
        <div className="flex flex-col items-center gap-2">
          <Button asChild>
            <Link to="/onboarding/whatsapp">Connect WhatsApp intake →</Link>
          </Button>
          <Button variant="ghost" size="sm" disabled>
            Or compose one yourself
          </Button>
        </div>
      }
      className="py-12"
    />
  )
}
