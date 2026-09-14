/** @deprecated Prefer `useInboxSocket` from `@/lib/inbox/socket`. */
export {
  connectInboxSocket,
  useInboxSocket as useInboxRealtime,
  useInboxSocket,
  type InboxSocketEvent as InboxRealtimeEvent,
  type InboxSocketEvent,
  type InboxSocketStatus,
} from '@/lib/inbox/socket'
