import { useEffect, useRef, useState } from 'react'
import {
  FileCode2,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Send,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CharacterCounter, isOverChannelLimit } from '@/components/inbox/CharacterCounter'
import { channelLabel } from '@/lib/inbox-labels'
import { formatFileSize } from '@/lib/inbox-media'
import { isSpeechAvailable, startDictation, type DictationHandle } from '@/lib/voice-dictation'
import { cn } from '@/lib/utils'

export type ComposeAttachment = {
  id: string
  file?: File
  url: string
  mime: string
  filename: string
  size_bytes: number
  kind: 'image' | 'audio' | 'video' | 'pdf' | 'file'
}

export type ComposeTemplate = {
  id: string
  name: string
  body: string
  channel?: string | null
  preview?: string | null
}

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
  offline?: boolean
  attachments?: ComposeAttachment[]
  onAttachmentsChange?: (next: ComposeAttachment[]) => void
  templates?: ComposeTemplate[]
  templatesLoading?: boolean
  onRequestTemplates?: () => void
  onInsertTemplate?: (template: ComposeTemplate) => void
}

const MAX_BYTES = 25 * 1024 * 1024

function classifyFile(file: File): ComposeAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  return 'file'
}

export type AttachmentsPickerProps = {
  attachments: ComposeAttachment[]
  onAttachmentsChange: (next: ComposeAttachment[]) => void
  disabled?: boolean
  triggerClassName?: string
  triggerLabel?: string
  includeVoiceNote?: boolean
  onVoiceNote?: () => void
}

export function AttachmentsPicker({
  attachments,
  onAttachmentsChange,
  disabled,
  triggerClassName,
  triggerLabel = 'Attach',
  includeVoiceNote = false,
  onVoiceNote,
}: AttachmentsPickerProps) {
  const [attachOpen, setAttachOpen] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const next = [...attachments]
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) continue
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
        mime: file.type,
        filename: file.name,
        size_bytes: file.size,
        kind: classifyFile(file),
      })
    }
    onAttachmentsChange(next)
    setAttachOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn('min-h-11 gap-2', triggerClassName)}
        aria-label="Attach a photo, document, or voice note"
        disabled={disabled}
        onClick={() => setAttachOpen(true)}
      >
        <Paperclip className="h-4 w-4" />
        {triggerLabel}
      </Button>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Button className="min-h-11" variant="outline" onClick={() => photoRef.current?.click()}>
              Photo
            </Button>
            <Button className="min-h-11" variant="outline" onClick={() => docRef.current?.click()}>
              Document
            </Button>
            {includeVoiceNote ? (
              <Button
                className="min-h-11"
                variant="outline"
                onClick={() => {
                  setAttachOpen(false)
                  onVoiceNote?.()
                }}
              >
                Voice note
              </Button>
            ) : null}
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <input
            ref={docRef}
            type="file"
            accept=".pdf,.doc,.docx,.xlsx,application/pdf"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function ListeningWaveform() {
  return (
    <span
      className="inline-flex h-4 items-end gap-0.5"
      aria-hidden
      data-listening-waveform="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-0.5 animate-pulse rounded-[var(--lc-radius-pill)] bg-[var(--lc-accent-bold)]"
          style={{
            height: `${6 + ((i % 3) + 1) * 3}px`,
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </span>
  )
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
  offline,
  attachments = [],
  onAttachmentsChange,
  templates = [],
  templatesLoading,
  onRequestTemplates,
  onInsertTemplate,
}: ComposeBarProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateWarning, setTemplateWarning] = useState<ComposeTemplate | null>(null)
  const [dictating, setDictating] = useState(false)
  const [dictationError, setDictationError] = useState<string | null>(null)
  const [speechAvailable, setSpeechAvailable] = useState(false)
  const [partialTranscript, setPartialTranscript] = useState('')
  const recognitionRef = useRef<DictationHandle | null>(null)
  const valueRef = useRef(value)
  const baselineRef = useRef(value)
  valueRef.current = value

  const overLimit = isOverChannelLimit(value, channel)
  const hasAttachments = attachments.length > 0
  const canSend =
    (Boolean(value.trim()) || hasAttachments) &&
    !sending &&
    !disabled &&
    !closed &&
    !overLimit

  useEffect(() => {
    let mounted = true
    isSpeechAvailable().then((available) => {
      if (mounted) setSpeechAvailable(available)
    })
    return () => {
      mounted = false
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  const addFiles = (files: FileList | null) => {
    if (!files || !onAttachmentsChange) return
    const next = [...attachments]
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) continue
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
        mime: file.type,
        filename: file.name,
        size_bytes: file.size,
        kind: classifyFile(file),
      })
    }
    onAttachmentsChange(next)
    setAttachOpen(false)
  }

  const removeAttachment = (id: string) => {
    onAttachmentsChange?.(attachments.filter((item) => item.id !== id))
  }

  const startVoice = async () => {
    setDictationError(null)
    setPartialTranscript('')
    baselineRef.current = valueRef.current
    try {
      const handle = await startDictation(navigator.language || 'ar-AE', {
        onPartial: (transcript) => {
          setPartialTranscript(transcript)
        },
        onFinal: (transcript) => {
          const base = baselineRef.current
          const joined = `${base}${base && !base.endsWith(' ') ? ' ' : ''}${transcript}`.trimStart()
          onChange(joined)
          baselineRef.current = joined
          setPartialTranscript('')
        },
        onError: (message) => {
          setDictationError(message)
          setDictating(false)
          setPartialTranscript('')
        },
        onEnd: () => {
          setDictating(false)
          setPartialTranscript('')
        },
      })
      recognitionRef.current = handle
      setDictating(true)
    } catch {
      setDictationError('Microphone access needed for voice dictation.')
      setDictating(false)
    }
  }

  const stopVoice = async () => {
    await recognitionRef.current?.stop()
    recognitionRef.current = null
    setDictating(false)
    setPartialTranscript('')
  }

  useEffect(
    () => () => {
      void recognitionRef.current?.stop()
    },
    [],
  )

  const pickTemplate = (template: ComposeTemplate) => {
    const declared = String(template.channel || '').toLowerCase()
    if (declared && declared !== 'all' && declared !== channel.toLowerCase()) {
      setTemplateWarning(template)
      return
    }
    onInsertTemplate?.(template)
    setTemplateOpen(false)
  }

  const displayValue =
    dictating && partialTranscript
      ? `${baselineRef.current}${baselineRef.current && !baselineRef.current.endsWith(' ') ? ' ' : ''}${partialTranscript}`
      : value

  return (
    <div className="shrink-0 border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-4 py-3 shadow-[var(--lc-elevation-sm)]">
      {attachments.length > 0 ? (
        <div className="mb-2 flex gap-2 overflow-x-auto" aria-label="Queued attachments">
          {attachments.map((item) => (
            <div
              key={item.id}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]"
            >
              {item.kind === 'image' ? (
                <img src={item.url} alt={item.filename} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center px-1 text-center text-[10px] text-[var(--lc-text-muted)]">
                  {item.filename}
                  {item.size_bytes ? <span>{formatFileSize(item.size_bytes)}</span> : null}
                </span>
              )}
              <button
                type="button"
                className="absolute end-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-inverse)] text-[var(--lc-text-inverse)]"
                aria-label="Remove attachment"
                onClick={() => removeAttachment(item.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {dictating ? (
        <div
          className="mb-2 flex min-h-11 items-center gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-3 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]"
          aria-live="polite"
        >
          <ListeningWaveform />
          Listening…
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="Attach a photo, document, or voice note"
          disabled={closed || disabled}
          onClick={() => setAttachOpen(true)}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="Insert template"
          disabled={closed || disabled}
          onClick={() => {
            onRequestTemplates?.()
            setTemplateOpen(true)
          }}
        >
          <FileCode2 className="h-4 w-4" />
        </Button>

        <div className="relative min-w-0 flex-1">
          <textarea
            ref={ref}
            value={displayValue}
            onChange={(e) => {
              if (dictating) return
              onChange(e.target.value)
            }}
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

        {speechAvailable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-11 w-11 shrink-0"
            aria-label={dictating ? 'Stop dictation' : 'Dictate with voice'}
            aria-pressed={dictating}
            disabled={closed || disabled}
            onClick={
              dictating
                ? () => {
                    void stopVoice()
                  }
                : () => {
                    void startVoice()
                  }
            }
          >
            {dictating ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {dictating ? (
              <span
                className="absolute end-1 top-1 h-2 w-2 rounded-[var(--lc-radius-pill)] bg-[var(--lc-accent-bold)]"
                aria-hidden
              />
            ) : null}
          </Button>
        ) : null}

        <Button
          size="icon"
          className="h-11 w-11 shrink-0 rounded-[var(--lc-radius-lg)]"
          onClick={onSend}
          disabled={!canSend}
          aria-label={offline ? 'Queue' : 'Send message'}
          aria-busy={sending || undefined}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {dictationError ? (
        <p className="mt-1.5 text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]">
          {dictationError}
        </p>
      ) : null}

      {closed ? (
        <p className="mt-1.5 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          Conversation closed —{' '}
          {onReopen ? (
            <button
              type="button"
              onClick={onReopen}
              className="underline hover:text-[var(--lc-text-primary)]"
            >
              reopen
            </button>
          ) : (
            'reopen'
          )}{' '}
          to reply.
        </p>
      ) : null}

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Button className="min-h-11" variant="outline" onClick={() => photoRef.current?.click()}>
              Photo
            </Button>
            <Button className="min-h-11" variant="outline" onClick={() => docRef.current?.click()}>
              Document
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              onClick={() => {
                setAttachOpen(false)
                void startVoice()
              }}
            >
              Voice note
            </Button>
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <input
            ref={docRef}
            type="file"
            accept=".pdf,.doc,.docx,.xlsx,application/pdf"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert template</DialogTitle>
          </DialogHeader>
          {templatesLoading ? (
            <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              Loading templates…
            </p>
          ) : templates.length === 0 ? (
            <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              No templates yet. Save one from Settings to insert it here.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className="min-h-11 w-full rounded-[var(--lc-radius-md)] px-3 py-2 text-start hover:bg-[var(--lc-surface-sunken)]"
                    onClick={() => pickTemplate(template)}
                  >
                    <span className="block font-medium">{template.name}</span>
                    <span className="block truncate text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                      {template.preview || template.body}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(templateWarning)} onOpenChange={() => setTemplateWarning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              This template isn&apos;t tuned for {channelLabel(channel)}. Send anyway?
            </DialogTitle>
          </DialogHeader>
          <Button
            className="min-h-11"
            onClick={() => {
              if (templateWarning) onInsertTemplate?.(templateWarning)
              setTemplateWarning(null)
              setTemplateOpen(false)
            }}
          >
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
