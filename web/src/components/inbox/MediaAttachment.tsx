import { useState } from 'react'
import { AlertCircle, FileText, Paperclip, Pause, Play } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Numeric } from '@/components/ui/numeric'
import { formatFileSize, mimeSuffix, type InboxAttachment } from '@/lib/inbox-media'
import { cn } from '@/lib/utils'

const WAVEFORM_POINTS = [4, 10, 16, 8, 18, 12, 20, 7, 14, 9, 17, 11, 6, 15, 19, 8, 13, 5, 16, 10]

export function MediaAttachment({
  attachment,
  outbound,
}: {
  attachment: InboxAttachment
  outbound?: boolean
}) {
  if (attachment.kind === 'image') return <ImageCard attachment={attachment} />
  if (attachment.kind === 'video') return <VideoCard attachment={attachment} />
  if (attachment.kind === 'audio') return <AudioCard attachment={attachment} />
  return <FileCard attachment={attachment} outbound={outbound} />
}

function ImageCard({ attachment }: { attachment: InboxAttachment }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 block overflow-hidden rounded-[var(--lc-radius-md)]"
        aria-label={attachment.filename || 'Open image'}
      >
        <img
          src={attachment.url}
          alt={attachment.filename || 'Image attachment'}
          className="h-[180px] w-[240px] object-cover"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2">
          <img
            src={attachment.url}
            alt={attachment.filename || 'Image attachment'}
            className="max-h-[80vh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function VideoCard({ attachment }: { attachment: InboxAttachment }) {
  return (
    <video
      src={attachment.url}
      controls
      className="mt-2 h-[180px] w-[240px] rounded-[var(--lc-radius-md)] object-cover"
      aria-label={attachment.filename || 'Video attachment'}
    />
  )
}

function AudioCard({ attachment }: { attachment: InboxAttachment }) {
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)

  const label = formatClock(elapsed || duration)
  return (
    <div
      className="mt-2 flex h-12 w-[240px] items-center gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-raised)] px-2"
      aria-label={attachment.filename || 'Audio attachment'}
    >
      <audio
        src={attachment.url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          setPlaying(false)
          setElapsed(0)
        }}
        data-inbox-audio
        className="hidden"
      />
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-[var(--lc-radius-pill)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={(e) => {
          const audio = (e.currentTarget.parentElement?.querySelector('audio') as HTMLAudioElement | null)
          if (!audio) return
          if (audio.paused) void audio.play()
          else audio.pause()
        }}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <svg viewBox="0 0 80 24" className="h-6 flex-1" aria-hidden>
        <polyline
          fill="none"
          stroke="var(--lc-text-secondary)"
          strokeWidth="1.5"
          points={WAVEFORM_POINTS.map((y, i) => `${i * 4},${24 - y}`).join(' ')}
        />
      </svg>
      <Numeric className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">{label}</Numeric>
    </div>
  )
}

function FileCard({
  attachment,
  outbound,
}: {
  attachment: InboxAttachment
  outbound?: boolean
}) {
  const isPdf = attachment.kind === 'pdf'
  const suffix = mimeSuffix(attachment.mime, attachment.filename)
  const size = formatFileSize(attachment.size_bytes)
  return (
    <a
      href={attachment.url}
      download={attachment.filename || undefined}
      className={cn(
        'mt-2 flex h-16 w-[240px] items-center gap-3 rounded-[var(--lc-radius-md)] px-3',
        outbound
          ? 'bg-[var(--lc-action-primary-scrim,rgba(255,255,255,0.16))]'
          : 'bg-[var(--lc-surface-raised)]',
      )}
      aria-label={attachment.filename || 'Download file'}
    >
      {isPdf ? (
        <FileText className="h-6 w-6 shrink-0" aria-hidden />
      ) : (
        <Paperclip className="h-6 w-6 shrink-0" aria-hidden />
      )}
      <span className="min-w-0">
        <span className="block truncate text-[length:var(--lc-type-body-sm)]">
          {attachment.filename || 'Attachment'}
        </span>
        <span className="text-[length:var(--lc-type-caption)] opacity-80">
          {size ? `${size} · ${suffix}` : suffix}
        </span>
      </span>
      {!attachment.url ? <AlertCircle className="h-4 w-4" /> : null}
    </a>
  )
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0))
  const mm = Math.floor(total / 60)
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
