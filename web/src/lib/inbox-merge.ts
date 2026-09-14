import { channelLabel } from '@/lib/inbox-labels'
import { readChannel, readSource } from '@/lib/channel-source'

export type InboxMergeMode = 'merged' | 'separate'

export type MergeableConversation = {
  id: string
  contact_id?: string | null
  contact_name: string | null
  contact_email?: string | null
  contact_phone?: string | null
  contact_masked?: boolean
  channel?: string | null
  source?: string | null
  source_channel?: string | null
  last_message_at: string | null
  last_message_preview: string
  unread_count: number
  is_unread_by_agent?: boolean
  priority_score?: number | null
  priority_reason?: string | null
  assigned_agent_id?: string | null
  assigned_agent_name?: string | null
  status?: string
  archived_at?: string | null
}

export type MergedInboxRow = MergeableConversation & {
  channel: string
  source: string
  channels: string[]
  sources: string[]
  conversation_ids: string[]
  merged: boolean
}

function mergeKey(row: MergeableConversation): string {
  if (row.contact_id) return `cid:${row.contact_id}`
  const email = String(row.contact_email || '').trim().toLowerCase()
  if (email) return `email:${email}`
  const phone = String(row.contact_phone || '').replace(/\D/g, '')
  if (phone.length >= 8) return `phone:${phone}`
  const name = String(row.contact_name || '').trim().toLowerCase()
  if (name && name !== 'unknown') return `name:${name}`
  return `id:${row.id}`
}

function ts(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : 0
}

function uniquePreserve<T>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const key = String(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export function isArchivedConversation(row: MergeableConversation): boolean {
  return Boolean(row.archived_at) || String(row.status || '') === 'archived'
}

export function prefixedSnippet(channel: string, preview: string): string {
  const body = preview || 'No messages'
  return `${channelLabel(channel)}: ${body}`
}

export function groupConversationsForInbox(
  rows: MergeableConversation[],
  mode: InboxMergeMode,
): MergedInboxRow[] {
  const visible = rows.filter((row) => !isArchivedConversation(row))
  if (mode !== 'merged') {
    return visible.map((row) => {
      const channel = readChannel(row)
      const source = readSource(row)
      return {
        ...row,
        channel,
        source,
        channels: [channel],
        sources: [source],
        conversation_ids: [row.id],
        merged: false,
      }
    })
  }

  const groups = new Map<string, MergeableConversation[]>()
  for (const row of visible) {
    const key = mergeKey(row)
    const list = groups.get(key) || []
    list.push(row)
    groups.set(key, list)
  }

  const merged: MergedInboxRow[] = []
  for (const members of groups.values()) {
    const sorted = [...members].sort((a, b) => ts(b.last_message_at) - ts(a.last_message_at))
    const primary = sorted[0]
    const channels = uniquePreserve(sorted.map((row) => readChannel(row)))
    const sources = uniquePreserve(sorted.map((row) => readSource(row)))
    const unread = sorted.reduce((sum, row) => sum + (row.unread_count || 0), 0)
    const anyUnread = sorted.some((row) => row.unread_count > 0 || row.is_unread_by_agent)
    const topPriority = sorted.reduce(
      (best, row) => ((row.priority_score ?? 0) > (best.priority_score ?? 0) ? row : best),
      primary,
    )
    merged.push({
      ...primary,
      channel: readChannel(primary),
      source: readSource(primary),
      channels,
      sources,
      conversation_ids: sorted.map((row) => row.id),
      last_message_preview: prefixedSnippet(readChannel(primary), primary.last_message_preview),
      unread_count: unread,
      is_unread_by_agent: anyUnread,
      priority_score: topPriority.priority_score,
      priority_reason: topPriority.priority_reason,
      merged: sorted.length > 1,
    })
  }
  return merged
}
