import type { ReactNode } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/**
 * Decision message from the resolver (agency owner / PA / system).
 *
 * Used by: AGT-REC-002, AGT-REC-003, AGT-REC-004, AGT-REC-005, AGT-REC-006.
 *
 * Markdown subset only: paragraph, line break, link, inline emphasis.
 * Forbidden (stripped silently): images, headings, lists, tables, code blocks.
 * Empty / null message still renders the card with muted empty-state copy.
 */
export type ResolverMessageProps = {
  resolver: {
    display_name: string
    /** e.g. "Owner", "Admin", "Platform Administrator". */
    role_label: string
    avatar_url?: string
  }
  /** ISO 8601. */
  decided_at: string
  /** Markdown-subset; null renders muted empty state. */
  message: string | null
  /** Default: "No message provided." */
  empty_state_copy?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function formatTimestampStub(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Strict Markdown-subset stub (no react-markdown dependency in prep PR).
 * Allows: paragraphs, line breaks, links, **bold** / *italic*.
 * Strips: images, headings, lists, tables, code fences.
 */
function renderMarkdownSubset(source: string): ReactNode[] {
  const cleaned = source
    .replace(/!\[[^\]]*]\([^)]*\)/g, '') // images
    .replace(/^#{1,6}\s+.+$/gm, '') // headings
    .replace(/^\s*([-*+]|\d+\.)\s+.+$/gm, '') // lists
    .replace(/\|.+\|/g, '') // crude table rows
    .replace(/```[\s\S]*?```/g, '') // fenced code
    .replace(/`[^`]*`/g, '') // inline code

  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  return paragraphs.map((para, pi) => {
    const lines = para.split('\n')
    const nodes: ReactNode[] = []

    lines.forEach((line, li) => {
      if (li > 0) nodes.push(<br key={`br-${pi}-${li}`} />)
      nodes.push(...inlineNodes(line, `${pi}-${li}`))
    })

    return (
      <p key={`p-${pi}`} className="mb-[var(--lc-space-sm)] last:mb-0">
        {nodes}
      </p>
    )
  })
}

function inlineNodes(text: string, keyPrefix: string): ReactNode[] {
  // Links then bold/italic — simple sequential tokenizer for stub fidelity.
  const nodes: ReactNode[] = []
  const pattern =
    /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }
    if (match[1]) {
      nodes.push(
        <a
          key={`${keyPrefix}-a-${i}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--lc-text-brand)] underline underline-offset-2"
        >
          {match[2]}
          <span className="sr-only"> (opens in new tab)</span>
        </a>,
      )
    } else if (match[4]) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold">
          {match[5]}
        </strong>,
      )
    } else if (match[6]) {
      nodes.push(
        <em key={`${keyPrefix}-i-${i}`} className="italic">
          {match[7]}
        </em>,
      )
    }
    last = match.index + match[0].length
    i += 1
  }

  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function ResolverMessage({
  resolver,
  decided_at,
  message,
  empty_state_copy = 'No message provided.',
}: ResolverMessageProps) {
  const isEmpty = message == null || message.trim() === ''
  const decidedLabel = formatTimestampStub(decided_at)

  return (
    <article
      className={cn(
        'rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-sm',
      )}
      aria-label={`Message from ${resolver.display_name}, ${resolver.role_label}, decided ${decidedLabel}`}
    >
      <header className="mb-[var(--lc-space-md)] flex flex-wrap items-center gap-[var(--lc-space-sm)]">
        <Avatar className="h-8 w-8">
          {resolver.avatar_url ? (
            <AvatarImage src={resolver.avatar_url} alt="" />
          ) : null}
          <AvatarFallback className="text-xs">{initials(resolver.display_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 text-start">
          <div className="flex flex-wrap items-center gap-[var(--lc-space-xs)]">
            <span
              className="truncate text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-body)' }}
            >
              {resolver.display_name}
            </span>
            <Badge variant="outline" className="rounded-pill">
              {resolver.role_label}
            </Badge>
          </div>
        </div>
        <Numeric
          className="ms-auto text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {decidedLabel}
        </Numeric>
      </header>

      <div
        role="article"
        className={cn(
          isEmpty && 'italic text-[var(--lc-text-muted)]',
          !isEmpty && 'text-[var(--lc-text-primary)]',
        )}
        style={{ font: 'var(--lc-type-body-lg)' }}
      >
        {isEmpty ? empty_state_copy : renderMarkdownSubset(message)}
      </div>
    </article>
  )
}
