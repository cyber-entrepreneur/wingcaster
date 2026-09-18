import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, Instagram, MessageCircle, Share2, X } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { isNativePlatform } from '@/lib/mobile/platform'

export type SharePayload = {
  title?: string
  description?: string
  url?: string
  image?: string | null
}

function parseSharePayload(raw: unknown): SharePayload {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  return {
    title: typeof o.title === 'string' ? o.title : undefined,
    description: typeof o.description === 'string' ? o.description : undefined,
    url: typeof o.url === 'string' ? o.url : undefined,
    image: typeof o.image === 'string' ? o.image : o.image === null ? null : undefined,
  }
}

function whatsAppShareUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
}

async function trackShare(propertyId: string, method: string) {
  try {
    await api.trackPropertyEvent(propertyId, { type: 'click', channel: 'share', referrer: method })
  } catch {
    /* telemetry is best-effort */
  }
}

export interface ListingShareSheetProps {
  propertyId: string
  open: boolean
  onClose: () => void
}

export function ListingShareSheet({ propertyId, open, onClose }: ListingShareSheetProps) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState<SharePayload | null>(null)
  const [qrUrl, setQrUrl] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await api.getSharePayload(propertyId)
      setPayload(parseSharePayload(raw))
    } catch {
      addToast({ title: 'Could not load share link', variant: 'error' })
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [propertyId, addToast])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open || !payload?.url) {
      setQrUrl('')
      return
    }
    let cancelled = false
    QRCode.toDataURL(payload.url, { width: 280, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setQrUrl(url) })
      .catch(() => { if (!cancelled) setQrUrl('') })
    return () => { cancelled = true }
  }, [open, payload?.url])

  const shareText = payload?.title || 'Check out this listing'

  const copyLink = async () => {
    if (!payload?.url) {
      addToast({ title: 'Public link unavailable', variant: 'error' })
      return
    }
    try {
      await navigator.clipboard.writeText(payload.url)
      void trackShare(propertyId, 'copy_link')
      addToast({ title: 'Link copied', variant: 'success' })
    } catch {
      addToast({ title: 'Copy failed', variant: 'error' })
    }
  }

  const nativeShare = async () => {
    if (!payload?.url) {
      addToast({ title: 'Public link unavailable', variant: 'error' })
      return
    }
    try {
      if (isNativePlatform()) {
        const { Share } = await import('@capacitor/share')
        await Share.share({
          title: shareText,
          text: payload.description || shareText,
          url: payload.url,
          dialogTitle: 'Share listing',
        })
      } else if (typeof navigator.share === 'function') {
        await navigator.share({
          title: shareText,
          text: payload.description || shareText,
          url: payload.url,
        })
      } else {
        await copyLink()
        return
      }
      void trackShare(propertyId, 'native_share')
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      addToast({ title: 'Share cancelled or unavailable', variant: 'error' })
    }
  }

  const shareWhatsApp = () => {
    if (!payload?.url) {
      addToast({ title: 'Public link unavailable', variant: 'error' })
      return
    }
    void trackShare(propertyId, 'whatsapp')
    window.open(whatsAppShareUrl(shareText, payload.url), '_blank', 'noopener,noreferrer')
  }

  const shareInstagramStory = async () => {
    if (!payload?.url) {
      addToast({ title: 'Public link unavailable', variant: 'error' })
      return
    }
    try {
      await navigator.clipboard.writeText(payload.url)
      void trackShare(propertyId, 'instagram_story')
      if (isNativePlatform()) {
        window.location.href = 'instagram://story-camera'
      } else {
        window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
      }
      addToast({
        title: 'Link copied for your story',
        description: 'Paste the link sticker in Instagram Stories.',
        variant: 'success',
      })
    } catch {
      addToast({ title: 'Could not prepare Instagram share', variant: 'error' })
    }
  }

  const downloadQr = () => {
    if (!qrUrl) return
    const anchor = document.createElement('a')
    anchor.href = qrUrl
    anchor.download = `listing-${propertyId}-qr.png`
    anchor.click()
    void trackShare(propertyId, 'qr_download')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-overlay flex items-end justify-center lc-overlay sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share listing"
        className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl bg-[var(--lc-surface)] shadow-xl sm:rounded-2xl"
        data-screen="AGT-LST-007"
      >
        <div className="flex items-start justify-between border-b border-[var(--lc-border)] p-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--lc-text-heading)]">Share listing</h2>
            <p className="mt-0.5 text-sm text-[var(--lc-text-muted)]">
              Send the public buyer link — QR, WhatsApp, or native share.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-[var(--lc-surface-sunken)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading share link…</p>
          ) : !payload?.url ? (
            <p className="rounded-md border border-dashed bg-[var(--lc-surface-sunken)] p-4 text-sm text-muted-foreground">
              This listing does not have a public share URL yet. Publish it to your site or portals first.
            </p>
          ) : (
            <>
              {qrUrl ? (
                <div className="flex flex-col items-center gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
                  <img src={qrUrl} alt="QR code for listing link" className="h-56 w-56 rounded-md" />
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadQr}>
                    <Download className="h-4 w-4" />
                    Download QR
                  </Button>
                </div>
              ) : null}

              <div className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-xs text-[var(--lc-text-muted)] break-all">
                {payload.url}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => void copyLink()}>
                  <Copy className="h-4 w-4" />
                  Copy link
                </Button>
                <Button type="button" variant="outline" className="justify-start gap-2" onClick={shareWhatsApp}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => void shareInstagramStory()}>
                  <Instagram className="h-4 w-4" />
                  Instagram story
                </Button>
                <Button type="button" className="justify-start gap-2 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]" onClick={() => void nativeShare()}>
                  <Share2 className="h-4 w-4" />
                  Share…
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-[var(--lc-border)] p-4">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
