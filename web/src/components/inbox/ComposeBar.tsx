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

type SpeechRec = {
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function classifyFile(file: File): ComposeAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  return 'file'
}

function SpeechCtor(): (new () => SpeechRec) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
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
  const recognitionRef = useRef<SpeechRec | null>(null)

  const overLimit = isOverChannelLimit(value, channel)
  const hasAttachments = attachments.length > 0
  const canSend =
    (Boolean(value.trim()) || hasAttachments) &&
    !sending &&
    !disabled &&
    !closed &&
    !overLimit
  const speechAvailable = typeof window !== 'undefined' && Boolean(SpeechCtor())

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

  const startDictation = () => {
    setDictationError(null)
    const Ctor = SpeechCtor()
    if (!Ctor) {
      setDictationError('Voice dictation is not available in this browser.')
      return
    }
    if (!navigator.onLine) {
      setDictationError('Voice dictation needs an internet connection.')
      return
    }
    try {
      const rec = new Ctor()
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = (event) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript
        }
        if (transcript) onChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}${transcript}`.trimStart())
      }
      rec.onerror = (event) => {
        setDictating(false)
        if (event.error === 'not-allowed') {
          setDictationError('Microphone access needed for voice dictation.')
        } else {
          setDictationError('Voice dictation stopped.')
        }
      }
      rec.onend = () => setDictating(false)
      recognitionRef.current = rec
      rec.start()
      setDictating(true)
    } catch {
      setDictationError('Microphone access needed for voice dictation.')
    }
  }

  const stopDictation = () => {
    recognitionRef.current?.stop()
    setDictating(false)
  }

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const pickTemplate = (template: ComposeTemplate) => {
    const declared = String(template.channel || '').toLowerCase()
    if (declared && declared !== 'all' && declared !== channel.toLowerCase()) {
      setTemplateWarning(template)
      return
    }
    onInsertTemplate?.(template)
    setTemplateOpen(false)
  }

  return (
    <div className="shrink-0 border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-4 py-3 shadow-[0_-2px_0_rgba(25,21,18,0.06)]">
      {attachments.length > 0 ? (
        <div className="mb-2 flex gap-2 overflow-x-auto" aria-label="Queued attachments">
          {attachments.map((item) => (
            <div key={item.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
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

      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
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
          className="h-10 w-10 shrink-0"
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

        {speechAvailable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 shrink-0"
            aria-label={dictating ? 'Stop dictation' : 'Dictate with voice'}
            aria-pressed={dictating}
            disabled={closed || disabled}
            onClick={dictating ? stopDictation : startDictation}
          >
            {dictating ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {dictating ? (
              <span className="absolute end-1 top-1 h-2 w-2 rounded-[var(--lc-radius-pill)] bg-[var(--lc-accent-bold)]" aria-hidden />
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
            <button type="button" onClick={onReopen} className="underline hover:text-[var(--lc-text-primary)]">
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
            <Button variant="outline" onClick={() => photoRef.current?.click()}>Photo</Button>
            <Button variant="outline" onClick={() => docRef.current?.click()}>Document</Button>
            <Button
              variant="outline"
              onClick={() => {
                setAttachOpen(false)
                startDictation()
              }}
            >
              Voice note
            </Button>
          </div>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => addFiles(e.target.files)} />
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
            <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">Loading templates…</p>
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
                    className="w-full rounded-[var(--lc-radius-md)] px-3 py-2 text-start hover:bg-[var(--lc-surface-sunken)]"
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
            <DialogTitle>This template isn&apos;t tuned for {channelLabel(channel)}. Send anyway?</DialogTitle>
          </DialogHeader>
          <Button
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
