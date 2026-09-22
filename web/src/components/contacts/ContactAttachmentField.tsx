import { useRef, useState } from 'react'
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { api, getAuthToken } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { PreApprovalRef } from '@/components/contacts/contactForm'

const ACCEPT = '.pdf,.doc,.docx,image/*,application/pdf'

export type ContactAttachmentFieldProps = {
  /** The saved contact id. Undefined in create mode — upload needs a record. */
  contactId?: string
  value: PreApprovalRef | null
  onChange: (next: PreApprovalRef | null) => void
}

/**
 * Pre-Approval Letter upload. Financial PII, so the file goes to a private,
 * tenant-gated store (never a public URL) and downloads are fetched with the
 * auth header. In create mode there is no contact id yet, so the field prompts
 * the agent to save first.
 */
export function ContactAttachmentField({ contactId, value, onChange }: ContactAttachmentFieldProps) {
  const { addToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file || !contactId) return
    setBusy(true)
    try {
      const res = await api.uploadContactAttachment(contactId, file, 'pre_approval_letter')
      onChange({
        attachment_id: res.attachment.id,
        filename: res.attachment.filename || file.name,
        content_type: res.attachment.content_type || file.type,
        size_bytes: res.attachment.size_bytes ?? file.size,
      })
      addToast({ title: 'Pre-approval letter uploaded', variant: 'success' })
    } catch (e: unknown) {
      addToast({
        title: 'Upload failed',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDownload() {
    if (!contactId || !value) return
    try {
      const res = await fetch(api.contactAttachmentDownloadPath(contactId, value.attachment_id), {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = value.filename || 'pre-approval-letter'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      addToast({
        title: 'Could not download file',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'error',
      })
    }
  }

  async function handleRemove() {
    if (!contactId || !value) return
    setBusy(true)
    try {
      await api.deleteContactAttachment(contactId, value.attachment_id)
      onChange(null)
      addToast({ title: 'Pre-approval letter removed', variant: 'success' })
    } catch (e: unknown) {
      addToast({
        title: 'Could not remove file',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!contactId) {
    return (
      <p className="rounded-md border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-3 text-sm text-[var(--lc-text-muted)]">
        Save the contact first, then upload a Pre-Approval Letter here.
      </p>
    )
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" aria-hidden="true" />
          <span className="truncate text-sm text-[var(--lc-text-primary)]">{value.filename || 'Pre-approval letter'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => void handleDownload()}>
            <Download className="h-4 w-4" aria-hidden="true" /> Download
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove pre-approval letter" disabled={busy} onClick={() => void handleRemove()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Pre-approval letter file"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" className="gap-1.5" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
        Upload pre-approval letter
      </Button>
      <p className="mt-1 text-xs text-[var(--lc-text-muted)]">PDF, Word, or image. Stored privately.</p>
    </div>
  )
}
