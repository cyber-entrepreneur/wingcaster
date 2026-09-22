import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Mic, Square, Trash2, Upload } from 'lucide-react'
import { api, getAuthToken } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

type VoiceNote = { id: string; filename: string | null; content_type?: string | null; size_bytes?: number | null }

export type VoiceNoteFieldProps = {
  /** Saved contact id; undefined in create mode (recording needs a record). */
  contactId?: string
}

function recordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder !== 'undefined' &&
    Boolean(navigator?.mediaDevices?.getUserMedia)
  )
}

/**
 * Voice note capture for the full form. Records via MediaRecorder when supported,
 * with an audio-file upload fallback otherwise. Audio is stored in the same
 * private, tenant-gated contact_attachments store (kind: voice_note).
 */
export function VoiceNoteField({ contactId }: VoiceNoteFieldProps) {
  const { addToast } = useToast()
  const [notes, setNotes] = useState<VoiceNote[]>([])
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const canRecord = recordingSupported()

  useEffect(() => {
    if (!contactId) return
    let cancelled = false
    api.getContactAttachments(contactId, 'voice_note')
      .then((r) => {
        if (!cancelled) setNotes((r.attachments || []).map((a) => ({ id: a.id, filename: a.filename, content_type: a.content_type, size_bytes: a.size_bytes })))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [contactId])

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }
  useEffect(() => () => stopStream(), [])

  async function uploadVoice(file: File | undefined) {
    if (!file || !contactId) return
    setBusy(true)
    try {
      const res = await api.uploadContactAttachment(contactId, file, 'voice_note')
      setNotes((prev) => [
        { id: res.attachment.id, filename: res.attachment.filename, content_type: res.attachment.content_type, size_bytes: res.attachment.size_bytes },
        ...prev,
      ])
      addToast({ title: 'Voice note added', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Could not save voice note', description: e instanceof Error ? e.message : 'Try again', variant: 'error' })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        stopStream()
        const ext = type.includes('ogg') ? 'ogg' : 'webm'
        void uploadVoice(new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' }))
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
    } catch (e: unknown) {
      stopStream()
      addToast({ title: 'Microphone unavailable', description: e instanceof Error ? e.message : 'Check permissions', variant: 'error' })
    }
  }

  function stopRecording() {
    try {
      recorderRef.current?.stop()
    } finally {
      recorderRef.current = null
      setRecording(false)
    }
  }

  async function handleDownload(note: VoiceNote) {
    if (!contactId) return
    try {
      const res = await fetch(api.contactAttachmentDownloadPath(contactId, note.id), {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = note.filename || 'voice-note'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      addToast({ title: 'Could not download voice note', description: e instanceof Error ? e.message : 'Try again', variant: 'error' })
    }
  }

  async function handleRemove(note: VoiceNote) {
    if (!contactId) return
    try {
      await api.deleteContactAttachment(contactId, note.id)
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
      addToast({ title: 'Voice note removed', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Could not remove voice note', description: e instanceof Error ? e.message : 'Try again', variant: 'error' })
    }
  }

  if (!contactId) {
    return (
      <p className="rounded-md border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-3 text-sm text-[var(--lc-text-muted)]">
        Save the contact first, then record or upload a voice note here.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canRecord ? (
          recording ? (
            <Button type="button" variant="destructive" className="gap-1.5" onClick={stopRecording}>
              <Square className="h-4 w-4" aria-hidden="true" /> Stop recording
            </Button>
          ) : (
            <Button type="button" variant="outline" className="gap-1.5" disabled={busy} onClick={() => void startRecording()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
              Record voice note
            </Button>
          )
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              className="sr-only"
              aria-label="Voice note audio file"
              onChange={(e) => void uploadVoice(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" className="gap-1.5" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              Upload voice note
            </Button>
            <span className="text-xs text-[var(--lc-text-muted)]">Recording isn’t supported here — upload an audio file.</span>
          </>
        )}
      </div>

      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2">
              <span className="truncate text-sm text-[var(--lc-text-primary)]">{note.filename || 'Voice note'}</span>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => void handleDownload(note)}>
                  <Download className="h-4 w-4" aria-hidden="true" /> Download
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove voice note ${note.filename || note.id}`} onClick={() => void handleRemove(note)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
