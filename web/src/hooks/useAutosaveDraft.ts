import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

export interface UseAutosaveDraftOptions {
  /** Existing property id (edit mode or after first create). */
  propertyId: string | null
  /** Full form payload sent on save. */
  formState: Record<string, unknown>
  /** When false, autosave is disabled (e.g. hydration). */
  enabled?: boolean
  /** Idle debounce in ms (default 3000). */
  debounceMs?: number
  /** Called when a draft is first created via POST. */
  onCreated?: (id: string) => void
  /** Extra fields always merged (e.g. status: 'draft'). */
  basePayload?: Record<string, unknown>
}

export interface UseAutosaveDraftResult {
  status: AutosaveStatus
  lastSavedAt: Date | null
  error: string | null
  propertyId: string | null
  saveNow: () => Promise<boolean>
  /** Mark form dirty so next idle triggers save. */
  markDirty: () => void
}

function serialize(state: Record<string, unknown>): string {
  try {
    return JSON.stringify(state)
  } catch {
    return ''
  }
}

/**
 * Debounced listing draft autosave via existing PUT /api/properties/:id
 * (POST on first save when no id yet).
 */
export function useAutosaveDraft({
  propertyId: initialId,
  formState,
  enabled = true,
  debounceMs = 3000,
  onCreated,
  basePayload = { status: 'draft' },
}: UseAutosaveDraftOptions): UseAutosaveDraftResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [propertyId, setPropertyId] = useState<string | null>(initialId)

  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const formRef = useRef(formState)
  const lastSerializedRef = useRef(serialize(formState))
  const idRef = useRef(propertyId)
  const onCreatedRef = useRef(onCreated)
  const baseRef = useRef(basePayload)
  const retryCountRef = useRef(0)

  useEffect(() => {
    formRef.current = formState
  }, [formState])

  useEffect(() => {
    idRef.current = propertyId
  }, [propertyId])

  useEffect(() => {
    setPropertyId(initialId)
  }, [initialId])

  useEffect(() => {
    onCreatedRef.current = onCreated
  }, [onCreated])

  useEffect(() => {
    baseRef.current = basePayload
  }, [basePayload])

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!enabled || savingRef.current) return false
    const payload = { ...baseRef.current, ...formRef.current }
    const serialized = serialize(payload)
    if (!dirtyRef.current && serialized === lastSerializedRef.current && idRef.current) {
      return true
    }

    savingRef.current = true
    setStatus('saving')
    setError(null)

    try {
      let id = idRef.current
      if (!id) {
        const created = (await api.createProperty(payload)) as { id?: string }
        if (!created?.id) throw new Error('Create did not return an id')
        id = created.id
        setPropertyId(id)
        idRef.current = id
        onCreatedRef.current?.(id)
      } else {
        await api.updateProperty(id, payload)
      }
      lastSerializedRef.current = serialized
      dirtyRef.current = false
      retryCountRef.current = 0
      setLastSavedAt(new Date())
      setStatus('saved')
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed'
      setError(message)
      setStatus('failed')
      if (retryCountRef.current < 3) {
        const attempt = retryCountRef.current
        retryCountRef.current += 1
        const delay = Math.min(1000 * 2 ** attempt, 8000)
        window.setTimeout(() => {
          void saveNow()
        }, delay)
      }
      return false
    } finally {
      savingRef.current = false
    }
  }, [enabled])

  const markDirty = useCallback(() => {
    dirtyRef.current = true
  }, [])

  // Debounce on form changes
  useEffect(() => {
    if (!enabled) return
    const next = serialize(formState)
    if (next === lastSerializedRef.current) return
    dirtyRef.current = true
    const timer = window.setTimeout(() => {
      void saveNow()
    }, debounceMs)
    return () => window.clearTimeout(timer)
  }, [formState, enabled, debounceMs, saveNow])

  // Visibility / background save
  useEffect(() => {
    if (!enabled) return
    const onVis = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        void saveNow()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [enabled, saveNow])

  return {
    status,
    lastSavedAt,
    error,
    propertyId,
    saveNow,
    markDirty,
  }
}
