import { useCallback, useState } from 'react'
import type { EvidenceFile } from '@/components/forms'
import { EVIDENCE_MAX_BYTES } from './constants'

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `evd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Local evidence state for submit forms.
 * Upload is stubbed client-side (Shared Prep EvidenceUploader is visual-only);
 * completed tiles carry a blob/object URL for optional supporting_document_url.
 */
export function useEvidenceFiles(maxFiles: number, maxBytes = EVIDENCE_MAX_BYTES) {
  const [files, setFiles] = useState<EvidenceFile[]>([])

  const onAdd = useCallback(
    (incoming: File[]) => {
      setFiles((prev) => {
        const room = Math.max(0, maxFiles - prev.length)
        const next = incoming.slice(0, room).map((file): EvidenceFile => {
          const tooLarge = file.size > maxBytes
          const id = newId()
          if (tooLarge) {
            return {
              id,
              name: file.name,
              size_bytes: file.size,
              content_type: file.type || 'application/octet-stream',
              status: 'error',
              error_message: 'File too large — 10 MB max.',
            }
          }
          const thumbnail =
            file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
          return {
            id,
            name: file.name,
            size_bytes: file.size,
            content_type: file.type || 'application/octet-stream',
            status: 'complete',
            progress_pct: 100,
            thumbnail_url: thumbnail,
            server_url: thumbnail,
          }
        })
        return [...prev, ...next]
      })
    },
    [maxBytes, maxFiles],
  )

  const onRemove = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id)
      if (target?.thumbnail_url?.startsWith('blob:')) {
        URL.revokeObjectURL(target.thumbnail_url)
      }
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  const reset = useCallback(() => setFiles([]), [])

  const uploading = files.some((f) => f.status === 'uploading')
  const completeIds = files.filter((f) => f.status === 'complete').map((f) => f.id)
  const firstCompleteUrl =
    files.find((f) => f.status === 'complete' && f.server_url)?.server_url ?? null

  return {
    files,
    setFiles,
    onAdd,
    onRemove,
    reset,
    uploading,
    completeIds,
    firstCompleteUrl,
  }
}
