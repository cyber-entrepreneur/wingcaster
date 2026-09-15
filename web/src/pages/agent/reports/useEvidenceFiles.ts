import { useCallback, useRef, useState } from 'react'
import type { EvidenceFile } from '@/components/forms'
import { api } from '@/api/client'
import { EVIDENCE_MAX_BYTES } from './constants'
import type { ReportLocale } from './copy'

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `evd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  )
}

export type EvidenceTooLargeCopy = {
  en: string
  ar: string
}

const DEFAULT_TOO_LARGE: EvidenceTooLargeCopy = {
  en: 'File too large — 10 MB max.',
  ar: 'الملف كبير جدًا — الحد الأقصى 10 ميجابايت.',
}

export type UseEvidenceFilesOptions = {
  maxFiles: number
  maxBytes?: number
  locale?: ReportLocale
  tooLargeCopy?: EvidenceTooLargeCopy
  /** Toast when a file is rejected for size. */
  onTooLarge?: (message: string) => void
}

/**
 * Real multipart evidence upload for WF-05 / WF-06 submitters.
 * Status: uploading → complete | error. Captures server id / url / sha256.
 */
export function useEvidenceFiles(
  maxFilesOrOptions: number | UseEvidenceFilesOptions,
  maxBytesArg = EVIDENCE_MAX_BYTES,
) {
  const options: UseEvidenceFilesOptions =
    typeof maxFilesOrOptions === 'number'
      ? { maxFiles: maxFilesOrOptions, maxBytes: maxBytesArg }
      : maxFilesOrOptions

  const maxFiles = options.maxFiles
  const maxBytes = options.maxBytes ?? EVIDENCE_MAX_BYTES
  const locale = options.locale ?? 'en'
  const tooLargeCopy = options.tooLargeCopy ?? DEFAULT_TOO_LARGE
  const onTooLarge = options.onTooLarge

  const [files, setFiles] = useState<EvidenceFile[]>([])
  const rawFilesRef = useRef<Map<string, File>>(new Map())

  const tooLargeMessage = tooLargeCopy[locale] || tooLargeCopy.en

  const uploadOne = useCallback(async (clientId: string, file: File) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === clientId
          ? { ...f, status: 'uploading' as const, progress_pct: 10, error_message: undefined }
          : f,
      ),
    )
    try {
      const result = await api.uploadPricingEvidence(file)
      setFiles((prev) =>
        prev.map((f) =>
          f.id === clientId
            ? {
                ...f,
                id: result.id,
                status: 'complete' as const,
                progress_pct: 100,
                server_url: result.url,
                sha256: result.sha256,
                error_message: undefined,
              }
            : f,
        ),
      )
      rawFilesRef.current.delete(clientId)
      rawFilesRef.current.set(result.id, file)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setFiles((prev) =>
        prev.map((f) =>
          f.id === clientId
            ? { ...f, status: 'error' as const, progress_pct: 0, error_message: message }
            : f,
        ),
      )
      return null
    }
  }, [])

  const onAdd = useCallback(
    (incoming: File[]) => {
      const room = Math.max(0, maxFiles - files.length)
      const accepted = incoming.slice(0, room)
      const staged: EvidenceFile[] = []

      for (const file of accepted) {
        const id = newId()
        if (file.size > maxBytes) {
          onTooLarge?.(tooLargeMessage)
          staged.push({
            id,
            name: file.name,
            size_bytes: file.size,
            content_type: file.type || 'application/octet-stream',
            status: 'error',
            error_message: tooLargeMessage,
          })
          continue
        }
        const thumbnail =
          file.type.startsWith('image/') && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(file)
            : undefined
        rawFilesRef.current.set(id, file)
        staged.push({
          id,
          name: file.name,
          size_bytes: file.size,
          content_type: file.type || 'application/octet-stream',
          status: 'uploading',
          progress_pct: 0,
          thumbnail_url: thumbnail,
        })
        void uploadOne(id, file)
      }

      if (staged.length > 0) {
        setFiles((prev) => [...prev, ...staged])
      }
    },
    [files.length, maxBytes, maxFiles, onTooLarge, tooLargeMessage, uploadOne],
  )

  const onRemove = useCallback(async (id: string) => {
    const target = files.find((f) => f.id === id)
    const shouldDeleteRemote = Boolean(target && target.status === 'complete' && target.server_url)
    if (target?.thumbnail_url?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(target.thumbnail_url)
    }
    setFiles((prev) => prev.filter((f) => f.id !== id))
    rawFilesRef.current.delete(id)
    if (shouldDeleteRemote) {
      try {
        await api.deletePricingEvidence(id)
      } catch {
        /* local remove still wins */
      }
    }
  }, [files])

  const retry = useCallback(
    async (id: string) => {
      const raw = rawFilesRef.current.get(id)
      const current = files.find((f) => f.id === id)
      if (!raw || !current) return
      await uploadOne(id, raw)
    },
    [files, uploadOne],
  )

  const reset = useCallback(() => {
    setFiles((prev) => {
      for (const f of prev) {
        if (f.thumbnail_url?.startsWith('blob:')) URL.revokeObjectURL(f.thumbnail_url)
      }
      return []
    })
    rawFilesRef.current.clear()
  }, [])

  const uploading = files.some((f) => f.status === 'uploading')
  const completeIds = files.filter((f) => f.status === 'complete').map((f) => f.id)
  const firstCompleteUrl =
    files.find((f) => f.status === 'complete' && f.server_url)?.server_url ?? null

  return {
    files,
    setFiles,
    onAdd,
    onRemove,
    retry,
    reset,
    uploading,
    completeIds,
    firstCompleteUrl,
  }
}
