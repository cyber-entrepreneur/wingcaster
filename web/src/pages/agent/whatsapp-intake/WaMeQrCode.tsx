import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { cn } from '@/lib/utils'

interface WaMeQrCodeProps {
  href: string
  label?: string
  className?: string
}

/**
 * Black-on-white QR for the wa.me deep-link. Surrounding chrome follows dark
 * mode; the QR itself stays high-contrast dark-on-light for scanners.
 */
export function WaMeQrCode({ href, label = 'WhatsApp deep-link QR code', className }: WaMeQrCodeProps) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    if (!href) {
      setSrc('')
      return
    }
    let cancelled = false
    QRCode.toDataURL(href, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc('')
      })
    return () => {
      cancelled = true
    }
  }, [href])

  return (
    <div className={cn('flex flex-col items-center gap-[var(--lc-space-sm)]', className)}>
      <div
        data-testid="wa-me-qr"
        data-qr-contrast="black-on-white"
        className="flex h-[200px] w-[200px] items-center justify-center rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-[var(--lc-space-xs)]"
        style={{ backgroundColor: 'white' }}
      >
        {src ? (
          <img src={src} alt={label} width={200} height={200} className="h-full w-full" />
        ) : (
          <span className="text-center text-sm text-[var(--lc-text-muted)]">QR</span>
        )}
      </div>
      <p className="text-center text-sm text-[var(--lc-text-muted)]">Or scan from another phone.</p>
    </div>
  )
}
