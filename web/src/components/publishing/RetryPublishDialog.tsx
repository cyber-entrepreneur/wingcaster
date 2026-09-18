/**
 * AGT-PUB-004 — Retry / republish with inline fixes.
 * Modal from AGT-LST-011 (publications) or AGT-PUB-003 (publish receipt).
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { api, type PublishingDestination, type PublishingDestinationRetryResult } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ERROR_CLASS_HELPER,
  ERROR_CLASS_LABEL,
  defaultFixDeepLink,
  isPortalErrorClass,
  type PortalErrorClass,
} from '@/components/portals'

export type RetryPublishDialogTarget =
  | {
      kind: 'destination'
      jobId: string
      listingId: string
      destination: PublishingDestination
    }
  | {
      kind: 'distribution'
      listingId: string
      distributionId: string
      platform: string
      errorMessage?: string | null
    }

export interface RetryPublishDialogProps {
  open: boolean
  target: RetryPublishDialogTarget | null
  onClose: () => void
  onRetried?: (result: PublishingDestinationRetryResult | Record<string, unknown>) => void
}

function needsInlineListingEdit(errorClass: PortalErrorClass | null | undefined): boolean {
  return errorClass === 'INVALID_CONTENT' || errorClass === 'PORTAL_RULES_VIOLATION'
}

export function RetryPublishDialog({ open, target, onClose, onRetried }: RetryPublishDialogProps) {
  const { addToast } = useToast()
  const [loadingProperty, setLoadingProperty] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [initialTitle, setInitialTitle] = useState('')
  const [initialDescription, setInitialDescription] = useState('')
  const [retrying, setRetrying] = useState(false)

  const destinationTarget = target?.kind === 'destination' ? target : null
  const errorClass: PortalErrorClass | null =
    destinationTarget && isPortalErrorClass(destinationTarget.destination.error_class)
      ? destinationTarget.destination.error_class
      : null

  const showInlineEdit = destinationTarget ? needsInlineListingEdit(errorClass) : false

  const failureBanner = useMemo(() => {
    if (!target) return ''
    if (target.kind === 'distribution') {
      return target.errorMessage || 'This publication failed. Review the details and retry.'
    }
    const dest = target.destination
    const label = errorClass ? ERROR_CLASS_LABEL[errorClass] : 'Publish failed'
    const detail = dest.portal_message?.trim()
    const helper = errorClass ? ERROR_CLASS_HELPER[errorClass] : undefined
    return [label, detail, helper].filter(Boolean).join(' — ')
  }, [target, errorClass])

  useEffect(() => {
    if (!open || !destinationTarget || !showInlineEdit) return
    let cancelled = false
    setLoadingProperty(true)
    api
      .getProperty(destinationTarget.listingId)
      .then((property) => {
        if (cancelled) return
        const nextTitle = String(property.title || '')
        const nextDescription = String(property.description || '')
        setTitle(nextTitle)
        setDescription(nextDescription)
        setInitialTitle(nextTitle)
        setInitialDescription(nextDescription)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          addToast({
            title: 'Could not load listing',
            description: err instanceof Error ? err.message : 'Try again',
            variant: 'error',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProperty(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, destinationTarget?.listingId, showInlineEdit, addToast, destinationTarget])

  useEffect(() => {
    if (!open) {
      setTitle('')
      setDescription('')
      setInitialTitle('')
      setInitialDescription('')
    }
  }, [open])

  const fixHref =
    destinationTarget && errorClass
      ? destinationTarget.destination.fix_deep_link ||
        defaultFixDeepLink(errorClass, {
          listingId: destinationTarget.listingId,
          portalCode: destinationTarget.destination.portal.code,
        })
      : null

  const handleRetry = async () => {
    if (!target || retrying) return
    setRetrying(true)
    try {
      if (target.kind === 'destination') {
        const listingChanged =
          showInlineEdit &&
          (title.trim() !== initialTitle.trim() || description.trim() !== initialDescription.trim())
        if (listingChanged) {
          await api.updateProperty(target.listingId, {
            title: title.trim(),
            description: description.trim(),
          })
        }
        const result = await api.retryPublishingDestination(target.jobId, target.destination.id)
        addToast({ title: 'Retry started', variant: 'success' })
        onRetried?.(result)
        onClose()
        return
      }

      const updated = await api.retryDistribution(target.distributionId)
      addToast({
        title: updated.status === 'published' ? 'Republication succeeded' : 'Retry attempted',
        variant: updated.status === 'published' ? 'success' : 'default',
      })
      onRetried?.(updated as Record<string, unknown>)
      onClose()
    } catch (err: unknown) {
      addToast({
        title: 'Retry failed',
        description: err instanceof Error ? err.message : 'Could not retry',
        variant: 'error',
      })
    } finally {
      setRetrying(false)
    }
  }

  if (!open || !target) return null

  const portalName =
    target.kind === 'destination'
      ? target.destination.portal.display_name || target.destination.portal.code || 'Portal'
      : target.platform

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="retry-publish-title"
      data-screen="AGT-PUB-004"
      data-testid="retry-publish-dialog"
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] shadow-[var(--lc-elevation-lg)]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--lc-border)] px-4 py-3">
          <div>
            <h2 id="retry-publish-title" className="text-sm font-semibold">
              Fix and retry — {portalName}
            </h2>
            <p className="text-xs text-muted-foreground">Review the failure, adjust content if needed, then retry.</p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-[var(--lc-surface-sunken)]"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div
            className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{failureBanner}</p>
          </div>

          {showInlineEdit && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Edit affected listing fields</p>
              {loadingProperty ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="retry-title">Listing title</Label>
                    <Input
                      id="retry-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="retry-description">Description</Label>
                    <textarea
                      id="retry-description"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {fixHref && errorClass === 'AUTH_EXPIRED' && (
            <p className="text-xs text-muted-foreground">
              You may need to reconnect the channel before retrying.{' '}
              <a href={fixHref} className="font-medium text-[var(--lc-action-primary)] underline">
                Open channel settings
              </a>
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-[var(--lc-border)] px-4 py-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={retrying}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
            disabled={retrying || (showInlineEdit && loadingProperty) || (showInlineEdit && !title.trim())}
            onClick={() => void handleRetry()}
            data-testid="retry-publish-submit"
          >
            {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Retry publish
          </Button>
        </div>
      </div>
    </div>
  )
}
