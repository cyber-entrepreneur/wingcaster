import type { LucideIcon } from 'lucide-react'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/** One metadata pill in the echo card meta row (up to 4). */
export type ContextEchoMetaItem = {
  key: string
  /** Optional short label shown before the value. */
  label?: string
  value: string | number
  /** When true, value renders via `<Numeric>`. */
  numeric?: boolean
  /** When set, value renders via `<ChannelMark>`. */
  channel?: string
}

export type ContextEchoCardProps = {
  glyph: LucideIcon
  /** Heading — address, listing name, agent name, etc. */
  title: string
  /** Muted second line. */
  subtitle?: string
  /** Small metadata pills — up to 4. */
  meta_row?: ContextEchoMetaItem[]
  /** If present, the whole card is a link with selected-surface hover. */
  href?: string
  className?: string
}

function MetaValue({ item }: { item: ContextEchoMetaItem }) {
  if (item.channel) {
    return <ChannelMark channel={item.channel} label={String(item.value)} />
  }
  if (item.numeric) {
    return <Numeric>{item.value}</Numeric>
  }
  return <span>{item.value}</span>
}

/**
 * Read-only “here is what you’re acting on” reassurance card.
 *
 * Used by: AGT-APR-004 (comparable echo), AGT-APR-005 (subject property/area),
 * AGT-PUB-005 (listing under moderation), PA-CRD-005 (grant target).
 *
 * Stub visual + prop shape only — no navigation / fetch logic.
 */
export function ContextEchoCard({
  glyph: Glyph,
  title,
  subtitle,
  meta_row,
  href,
  className,
}: ContextEchoCardProps) {
  const meta = (meta_row ?? []).slice(0, 4)

  const body = (
    <>
      <div className="flex items-start gap-[var(--lc-space-sm)]">
        <Glyph
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lc-text-muted)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--lc-type-heading-3)] text-[var(--lc-text-heading)]">
            {title}
          </p>
          {subtitle ? (
            <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {meta.length > 0 ? (
        <div
          className={cn(
            'mt-[var(--lc-space-sm)] flex flex-wrap items-center gap-x-2 gap-y-1',
            'text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]',
          )}
        >
          {meta.map((item, index) => (
            <span key={item.key} className="inline-flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden className="text-[var(--lc-text-muted)]">
                  ·
                </span>
              ) : null}
              {item.label ? (
                <span>
                  {item.label}: <MetaValue item={item} />
                </span>
              ) : (
                <MetaValue item={item} />
              )}
            </span>
          ))}
        </div>
      ) : null}
    </>
  )

  const surfaceClass = cn(
    'block w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
    'bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]',
    'text-start no-underline',
    href && 'hover:bg-[var(--lc-action-secondary)] focus-visible:outline-none',
    className,
  )

  if (href) {
    return (
      <a href={href} className={surfaceClass}>
        {body}
      </a>
    )
  }

  return (
    <div className={surfaceClass} role="group" aria-label={title}>
      {body}
    </div>
  )
}
