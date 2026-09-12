export type InboxAttachment = {
  id?: string
  url: string
  mime?: string | null
  filename?: string | null
  size_bytes?: number | null
  kind: 'image' | 'audio' | 'video' | 'pdf' | 'file'
}

export type InboxMediaFields = {
  image_url?: string | null
  audio_url?: string | null
  content_type?: string | null
  attachments?: Array<{
    id?: string
    url?: string
    mime?: string | null
    filename?: string | null
    size_bytes?: number | null
    kind?: string | null
  }> | null
  metadata?: { attachments?: InboxMediaFields['attachments'] } | null
}

function classify(mime: string | null | undefined, url: string, filename?: string | null): InboxAttachment['kind'] {
  const m = String(mime || '').toLowerCase()
  const name = `${filename || ''} ${url}`.toLowerCase()
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)(\?|$)/.test(name)) return 'image'
  if (m.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|webm|aac)(\?|$)/.test(name)) return 'audio'
  if (m.startsWith('video/') || /\.(mp4|mov|webm)(\?|$)/.test(name)) return 'video'
  if (m === 'application/pdf' || /\.pdf(\?|$)/.test(name)) return 'pdf'
  return 'file'
}

function pushUnique(out: InboxAttachment[], item: InboxAttachment) {
  if (!item.url) return
  if (out.some((existing) => existing.url === item.url && existing.kind === item.kind)) return
  out.push(item)
}

export function collectInboxAttachments(message: InboxMediaFields): InboxAttachment[] {
  const out: InboxAttachment[] = []
  const raw = [...(message.attachments || []), ...(message.metadata?.attachments || [])]
  for (const item of raw) {
    const url = String(item?.url || '').trim()
    if (!url) continue
    const kind = (item.kind as InboxAttachment['kind']) || classify(item.mime, url, item.filename)
    pushUnique(out, {
      id: item.id,
      url,
      mime: item.mime,
      filename: item.filename || null,
      size_bytes: item.size_bytes ?? null,
      kind,
    })
  }
  if (message.image_url) {
    const name = message.image_url.split('/').pop() || 'image'
    pushUnique(out, {
      url: message.image_url,
      mime: 'image/*',
      kind: 'image',
      filename: name.split('?')[0],
    })
  }
  if (message.audio_url) {
    const name = message.audio_url.split('/').pop() || 'voice-note'
    pushUnique(out, {
      url: message.audio_url,
      mime: 'audio/*',
      kind: 'audio',
      filename: name.split('?')[0],
    })
  }
  const contentType = String(message.content_type || '').toLowerCase()
  if (contentType.startsWith('image/') && message.image_url) {
    // already added
  }
  return out
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`
  return `${Math.round(bytes / 104857.6) / 10} MB`
}

export function mimeSuffix(mime: string | null | undefined, filename?: string | null): string {
  if (filename && filename.includes('.')) return filename.split('.').pop()?.toUpperCase() || 'FILE'
  const m = String(mime || '').toLowerCase()
  if (m === 'application/pdf') return 'PDF'
  if (m.includes('word')) return 'DOCX'
  if (m.includes('sheet') || m.includes('excel')) return 'XLSX'
  if (m.split('/')[1]) return m.split('/')[1].toUpperCase()
  return 'FILE'
}
