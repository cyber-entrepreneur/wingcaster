import { WifiOff } from 'lucide-react'

export function InboxOfflineBanner({
  queuedSend,
}: {
  queuedSend?: boolean
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-4 py-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-primary)]"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        {queuedSend
          ? "You're offline. Messages will send when connection returns."
          : "You're offline. Showing the last sync — new messages will appear once you reconnect."}
      </span>
    </div>
  )
}
